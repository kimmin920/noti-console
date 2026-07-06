import { getDb } from '../../db/client.js';
import { RELAY_ERROR_CODES } from '../relay/constants.js';
import { RelayError } from '../relay/errors.js';
import {
  resolvePublPappConfig,
  selectPublPappCredentialByApiKey,
} from './config.js';
import { createPublPappSessionRepository } from './repository.js';
import {
  PUBL_PAPP_TOKEN_CONSTANTS,
  PublPappTokenError,
  addTokenSeconds,
  createLocalAccessToken,
  generatePublPappAccessTokenJti,
  generatePublPappRefreshToken,
  hashPublPappRefreshToken,
  verifyLocalAccessToken,
  verifyPublOutgoingJwt,
} from './tokens.js';

const PUBL_PAPP_ERROR_CODES = Object.freeze({
  BAD_REQUEST: 'BAD_REQUEST',
  FORBIDDEN: RELAY_ERROR_CODES.FORBIDDEN,
  SERVER_ERROR: 'SERVER_ERROR',
  UNAUTHORIZED: RELAY_ERROR_CODES.UNAUTHORIZED,
});

const SAFE_ERROR_MESSAGES = Object.freeze({
  BAD_REQUEST: 'Request body is invalid',
  FORBIDDEN: 'Token ownership mismatch',
  SERVER_ERROR: 'Server configuration or storage error',
  UNAUTHORIZED: 'Invalid api key or token',
});

export class PublPappEndpointError extends Error {
  constructor({ code, message, status, cause } = {}) {
    super(message);
    this.name = 'PublPappEndpointError';
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export function createDefaultPublPappTokenExchangeService() {
  return createPublPappTokenExchangeService({
    config: resolvePublPappConfig(),
    repository: createPublPappSessionRepository(getDb()),
  });
}

export function createPublPappTokenExchangeService({
  config,
  makeAccessTokenJti = generatePublPappAccessTokenJti,
  makeRefreshToken = generatePublPappRefreshToken,
  now = () => new Date(),
  repository,
} = {}) {
  if (!repository) {
    throwServerError(new Error('Publ PApp repository is required.'));
  }

  const resolvedConfig = config ?? resolvePublPappConfig();

  return {
    async exchangeToken({ apiKey, authorization }) {
      const { claim } = verifyPublRequest({
        apiKey,
        authorization,
        config: resolvedConfig,
        now,
      });
      const issuedAt = now();
      const refreshToken = makeRefreshToken();
      const refreshTokenHash = hashPublPappRefreshToken(
        refreshToken,
        resolvedConfig.tokenSecrets.refreshTokenHashSecret
      );
      const accessTokenJti = makeAccessTokenJti();
      const accessTokenExpiresAt = addTokenSeconds(
        issuedAt,
        PUBL_PAPP_TOKEN_CONSTANTS.ACCESS_TOKEN_TTL_SECONDS
      );
      const refreshTokenExpiresAt = addTokenSeconds(
        issuedAt,
        PUBL_PAPP_TOKEN_CONSTANTS.REFRESH_TOKEN_TTL_SECONDS
      );

      const provisioned = await repository.provisionSessionForExchange({
        accessTokenExpiresAt,
        accessTokenJti,
        claim,
        now: issuedAt,
        refreshTokenExpiresAt,
        refreshTokenHash,
      });
      const accessToken = createLocalAccessToken({
        claim,
        now,
        secret: resolvedConfig.tokenSecrets.accessTokenSecret,
        session: provisioned.session,
        user: provisioned.user,
      });

      return {
        accessToken,
        refreshToken,
      };
    },

    async refreshToken({ apiKey, authorization, previousAccessToken, refreshToken }) {
      const { claim } = verifyPublRequest({
        apiKey,
        authorization,
        config: resolvedConfig,
        now,
      });
      const refreshTokenHash = hashPublPappRefreshToken(
        refreshToken,
        resolvedConfig.tokenSecrets.refreshTokenHashSecret
      );
      const activeSession = await repository.findActiveSessionByRefreshToken({
        consumerId: claim.consumerId,
        now: now(),
        refreshTokenHash,
      });

      if (!activeSession?.session || !activeSession?.user) {
        throwUnauthorized();
      }

      assertSessionMatchesClaim(activeSession.session, claim);
      assertPreviousAccessTokenMatchesSession({
        claim,
        previousAccessToken,
        secret: resolvedConfig.tokenSecrets.accessTokenSecret,
        session: activeSession.session,
      });

      const issuedAt = now();
      const accessTokenJti = makeAccessTokenJti();
      const accessTokenExpiresAt = addTokenSeconds(
        issuedAt,
        PUBL_PAPP_TOKEN_CONSTANTS.ACCESS_TOKEN_TTL_SECONDS
      );
      const provisioned = await repository.provisionSessionForExchange({
        accessTokenExpiresAt,
        accessTokenJti,
        claim,
        now: issuedAt,
        refreshTokenExpiresAt: activeSession.session.refreshTokenExpiresAt,
        refreshTokenHash,
      });

      return {
        accessToken: createLocalAccessToken({
          claim,
          now,
          secret: resolvedConfig.tokenSecrets.accessTokenSecret,
          session: provisioned.session,
          user: provisioned.user,
        }),
      };
    },
  };
}

export function verifyPublRequest({
  apiKey,
  authorization,
  config,
  now = () => new Date(),
}) {
  let credential;

  try {
    credential = selectPublPappCredentialByApiKey(apiKey, { config });
  } catch (error) {
    throwEndpointErrorFromConfig(error);
  }

  const jwt = parseBearerAuthorization(authorization);
  let payload;

  try {
    payload = verifyPublOutgoingJwt(jwt, {
      now,
      secret: credential.outgoingSecretKey,
    });
  } catch (error) {
    throwUnauthorized(error);
  }

  const claim = validatePublClaim(payload);

  if (payload.sub !== `Consumer:${claim.consumerId}`) {
    throwUnauthorized();
  }

  if (claim.pAppCode !== credential.pAppCode) {
    throwForbidden();
  }

  return { claim, credential, payload };
}

export function toPublPappEndpointError(error) {
  if (error instanceof PublPappEndpointError) {
    return error;
  }

  if (error instanceof RelayError) {
    if (error.code === RELAY_ERROR_CODES.UNAUTHORIZED || error.status === 401) {
      return createEndpointError({
        code: PUBL_PAPP_ERROR_CODES.UNAUTHORIZED,
        message: SAFE_ERROR_MESSAGES.UNAUTHORIZED,
        status: 401,
      });
    }

    return createEndpointError({
      code: PUBL_PAPP_ERROR_CODES.SERVER_ERROR,
      message: SAFE_ERROR_MESSAGES.SERVER_ERROR,
      status: 500,
    });
  }

  return createEndpointError({
    code: PUBL_PAPP_ERROR_CODES.SERVER_ERROR,
    message: SAFE_ERROR_MESSAGES.SERVER_ERROR,
    status: 500,
  });
}

function parseBearerAuthorization(value) {
  const normalized = normalizeString(value);
  if (!normalized?.startsWith('Bearer ')) {
    throwUnauthorized();
  }

  const token = normalized.slice('Bearer '.length).trim();
  if (!token) {
    throwUnauthorized();
  }

  return token;
}

function validatePublClaim(payload) {
  const claim = payload?.claim;
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) {
    throwUnauthorized();
  }

  return {
    channelCode: normalizeRequiredString(claim.channelCode, 'claim.channelCode', { maxLength: 160 }),
    channelId: normalizeRequiredInteger(claim.channelId, 'claim.channelId'),
    consumerId: normalizeRequiredString(claim.consumerId, 'claim.consumerId', { maxLength: 255 }),
    distinctId: normalizeRequiredString(claim.distinctId, 'claim.distinctId', { maxLength: 255 }),
    installedPAppId: normalizeRequiredInteger(claim.installedPAppId, 'claim.installedPAppId'),
    pAppCode: normalizeRequiredString(claim.pAppCode, 'claim.pAppCode', { maxLength: 80 }),
    role: normalizeRequiredString(claim.role, 'claim.role', { maxLength: 80 }),
  };
}

function assertSessionMatchesClaim(session, claim) {
  if (
    session.consumerId !== claim.consumerId ||
    session.pAppCode !== claim.pAppCode ||
    session.channelCode !== claim.channelCode
  ) {
    throwForbidden();
  }
}

function assertPreviousAccessTokenMatchesSession({
  claim,
  previousAccessToken,
  secret,
  session,
}) {
  let payload;

  try {
    payload = verifyLocalAccessToken(previousAccessToken, {
      ignoreExpiration: true,
      secret,
    });
  } catch (error) {
    if (error instanceof PublPappTokenError) {
      throwForbidden(error);
    }

    throw error;
  }

  if (
    payload.consumerId !== claim.consumerId ||
    payload.pAppCode !== claim.pAppCode ||
    payload.sessionId !== session.id ||
    payload.jti !== session.accessTokenJti
  ) {
    throwForbidden();
  }
}

function normalizeRequiredString(value, fieldName, { maxLength } = {}) {
  const normalized = normalizeString(value);
  if (!normalized) {
    throwUnauthorized(new Error(`${fieldName} is required.`));
  }

  if (maxLength && normalized.length > maxLength) {
    throwUnauthorized(new Error(`${fieldName} is too long.`));
  }

  return normalized;
}

function normalizeRequiredInteger(value, fieldName) {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 0) {
    throwUnauthorized(new Error(`${fieldName} must be a non-negative safe integer.`));
  }

  return number;
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function throwEndpointErrorFromConfig(error) {
  if (error instanceof RelayError && (error.code === RELAY_ERROR_CODES.UNAUTHORIZED || error.status === 401)) {
    throwUnauthorized(error);
  }

  throwServerError(error);
}

function createEndpointError({ code, message, status, cause }) {
  return new PublPappEndpointError({
    code,
    message,
    status,
    cause,
  });
}

function throwUnauthorized(cause) {
  throw createEndpointError({
    code: PUBL_PAPP_ERROR_CODES.UNAUTHORIZED,
    message: SAFE_ERROR_MESSAGES.UNAUTHORIZED,
    status: 401,
    cause,
  });
}

function throwForbidden(cause) {
  throw createEndpointError({
    code: PUBL_PAPP_ERROR_CODES.FORBIDDEN,
    message: SAFE_ERROR_MESSAGES.FORBIDDEN,
    status: 403,
    cause,
  });
}

function throwServerError(cause) {
  throw createEndpointError({
    code: PUBL_PAPP_ERROR_CODES.SERVER_ERROR,
    message: SAFE_ERROR_MESSAGES.SERVER_ERROR,
    status: 500,
    cause,
  });
}
