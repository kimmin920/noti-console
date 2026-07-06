import { randomBytes } from 'node:crypto';

import { getDb } from '../../db/client.js';
import { resolvePublPappTokenSecrets } from '../publPapp/config.js';
import { PublPappTokenError, verifyLocalAccessToken } from '../publPapp/tokens.js';
import { RELAY_ERROR_CODES } from '../relay/constants.js';
import { RelayError } from '../relay/errors.js';
import { readDevActorCredential } from './devAuth.js';
import { createAuthRepository } from './repository.js';

export {
  DEV_BROWSER_AUTH_USER_ID_COOKIE,
  DEV_RELAY_ACTOR_USER_ID_HEADER,
  RELAY_DEV_AUTH_HEADER_ENABLED_ENV,
  isDevAuthHeaderEnabled,
} from './devAuth.js';

export const AUTH_PROVIDERS = Object.freeze({
  CLERK: 'clerk',
  PUBL: 'publ',
  GOOGLE: 'google',
  KAKAO: 'kakao',
});

const USER_STATUS_ACTIVE = 'active';
const BILLING_ACCOUNT_STATUS_ACTIVE = 'active';

export async function resolveRelayActor(request) {
  return createActorResolver({
    repository: createAuthRepository(getDb()),
  }).resolve(request);
}

export function createActorResolver({
  repository,
  env = process.env,
  clerkAuth = defaultClerkAuth,
  clerkCurrentUser = defaultClerkCurrentUser,
  makeUserRef = () => createShortRef('u'),
  makeBillingRef = () => createShortRef('b'),
  now = () => new Date(),
} = {}) {
  return {
    async resolve(request) {
      const devActorCredential = readDevActorCredential(request, env);

      if (devActorCredential?.authProvider === 'dev_cookie') {
        return resolveDevActor({
          repository,
          actorUserId: devActorCredential.userId,
          authProvider: devActorCredential.authProvider,
        });
      }

      const clerkState = await readClerkAuthState(clerkAuth);

      if (isAuthenticatedClerkState(clerkState)) {
        return resolveClerkActor({
          repository,
          clerkUserId: clerkState.userId,
          clerkCurrentUser,
          makeUserRef,
          makeBillingRef,
        });
      }

      const publBearerToken = readBearerToken(request);

      if (publBearerToken) {
        return resolvePublBearerActor({
          repository,
          env,
          now,
          token: publBearerToken,
        });
      }

      if (devActorCredential) {
        return resolveDevActor({
          repository,
          actorUserId: devActorCredential.userId,
          authProvider: devActorCredential.authProvider,
        });
      }

      throw unauthorizedError();
    },
  };
}

async function resolvePublBearerActor({ repository, env, now, token }) {
  const tokenPayload = verifyPublBearerToken(token, { env, now });
  const sessionLookup = await repository.findActivePublPappSessionByAccessToken?.({
    sessionId: tokenPayload.sessionId,
    consumerId: tokenPayload.consumerId,
    userId: tokenPayload.userId,
    accessTokenJti: tokenPayload.jti,
    now: now(),
  });

  if (!sessionLookup?.session || !sessionLookup?.user || !sessionLookup?.account) {
    throw unauthorizedError();
  }

  assertPublTokenMatchesSession(tokenPayload, sessionLookup.session);

  return toActor({
    user: sessionLookup.user,
    authProvider: AUTH_PROVIDERS.PUBL,
    externalAuthAccount: sessionLookup.account,
  });
}

async function resolveClerkActor({ repository, clerkUserId, clerkCurrentUser, makeUserRef, makeBillingRef }) {
  const mappedAccount = await repository.findExternalAuthAccount({
    provider: AUTH_PROVIDERS.CLERK,
    providerAccountId: clerkUserId,
  });

  if (mappedAccount?.user) {
    return toActor({
      user: mappedAccount.user,
      authProvider: AUTH_PROVIDERS.CLERK,
      externalAuthAccount: mappedAccount.account,
    });
  }

  const clerkUser = await clerkCurrentUser();
  const profile = extractClerkProfile({ clerkUserId, clerkUser });

  if (!profile.email) {
    throw new RelayError({
      code: RELAY_ERROR_CODES.UNAUTHORIZED,
      message: 'Authenticated account needs onboarding.',
      retryable: false,
      status: 401,
    });
  }

  const existingUser = await repository.findUserByEmail?.(profile.email);
  if (existingUser) {
    const concurrentMappedAccount = await findConcurrentClerkMapping({
      repository,
      clerkUserId,
      email: profile.email,
    });
    if (concurrentMappedAccount) {
      return toClerkActor(concurrentMappedAccount);
    }

    throw accountLinkingError();
  }

  try {
    const created = await repository.createUserWithExternalAuthAccount({
      user: {
        userRef: makeUserRef(),
        email: profile.email,
        name: profile.name,
        status: USER_STATUS_ACTIVE,
        isOperator: false,
      },
      billingAccount: {
        billingRef: makeBillingRef(),
        ownerType: 'user',
        status: BILLING_ACCOUNT_STATUS_ACTIVE,
      },
      externalAuthAccount: {
        provider: AUTH_PROVIDERS.CLERK,
        providerAccountId: clerkUserId,
        email: profile.email,
        displayName: profile.name,
      },
    });

    return toActor({
      user: created.user,
      authProvider: AUTH_PROVIDERS.CLERK,
      externalAuthAccount: created.externalAuthAccount,
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const concurrentMappedAccount = await findConcurrentClerkMapping({
      repository,
      clerkUserId,
      email: profile.email,
    });
    if (concurrentMappedAccount) {
      return toClerkActor(concurrentMappedAccount);
    }

    const existingUserAfterConflict = await repository.findUserByEmail?.(profile.email);
    if (existingUserAfterConflict) {
      throw accountLinkingError();
    }

    throw error;
  }
}

async function resolveDevActor({ repository, actorUserId, authProvider }) {
  const user = await repository.getUserById(actorUserId);

  if (!user) {
    throw unauthorizedError();
  }

  return toActor({
    user,
    authProvider,
    externalAuthAccount: null,
  });
}

function toActor({ user, authProvider, externalAuthAccount }) {
  return {
    user,
    userId: user.id,
    authProvider,
    externalAuthAccount,
  };
}

function toClerkActor(mappedAccount) {
  return toActor({
    user: mappedAccount.user,
    authProvider: AUTH_PROVIDERS.CLERK,
    externalAuthAccount: mappedAccount.account,
  });
}

async function findConcurrentClerkMapping({ repository, clerkUserId, email }) {
  const mappedByAccountId = await repository.findExternalAuthAccount({
    provider: AUTH_PROVIDERS.CLERK,
    providerAccountId: clerkUserId,
  });
  if (mappedByAccountId?.user) {
    return mappedByAccountId;
  }

  const mappedByEmail = await repository.findExternalAuthAccountByProviderEmail?.({
    provider: AUTH_PROVIDERS.CLERK,
    email,
  });
  if (mappedByEmail?.user && mappedByEmail.account?.providerAccountId === clerkUserId) {
    return mappedByEmail;
  }

  return null;
}

async function readClerkAuthState(clerkAuth) {
  try {
    return await clerkAuth();
  } catch {
    return null;
  }
}

function isAuthenticatedClerkState(clerkState) {
  return Boolean(
    clerkState?.userId &&
      (clerkState.isAuthenticated === true || clerkState.isAuthenticated === undefined)
  );
}

function extractClerkProfile({ clerkUserId, clerkUser }) {
  const email =
    normalizeOptionalString(clerkUser?.primaryEmailAddress?.emailAddress) ??
    normalizeOptionalString(clerkUser?.emailAddresses?.[0]?.emailAddress);
  const name =
    normalizeOptionalString(clerkUser?.fullName) ??
    normalizeOptionalString([clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ')) ??
    email ??
    clerkUserId;

  return {
    email,
    name,
  };
}

function readBearerToken(request) {
  const authorization = normalizeOptionalString(request?.headers?.get?.('authorization'));
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const token = normalizeOptionalString(authorization.slice('Bearer '.length));
  if (!token) {
    throw unauthorizedError();
  }

  return token;
}

function verifyPublBearerToken(token, { env, now }) {
  try {
    const { accessTokenSecret } = resolvePublPappTokenSecrets(env);
    const payload = verifyLocalAccessToken(token, {
      now,
      secret: accessTokenSecret,
    });

    return normalizePublAccessPayload(payload);
  } catch (error) {
    if (error instanceof RelayError || error instanceof PublPappTokenError) {
      throw unauthorizedError();
    }

    throw error;
  }
}

function normalizePublAccessPayload(payload) {
  const normalized = {
    channelCode: normalizeOptionalString(payload?.channelCode),
    consumerId: normalizeOptionalString(payload?.consumerId),
    jti: normalizeOptionalString(payload?.jti),
    pAppCode: normalizeOptionalString(payload?.pAppCode),
    sessionId: normalizeOptionalString(payload?.sessionId),
    userId: normalizeOptionalString(payload?.userId),
  };

  if (
    !normalized.channelCode ||
    !normalized.consumerId ||
    !normalized.jti ||
    !normalized.pAppCode ||
    !normalized.sessionId ||
    !normalized.userId
  ) {
    throw unauthorizedError();
  }

  return normalized;
}

function assertPublTokenMatchesSession(payload, session) {
  if (
    session.id !== payload.sessionId ||
    session.consumerId !== payload.consumerId ||
    session.userId !== payload.userId ||
    session.pAppCode !== payload.pAppCode ||
    session.channelCode !== payload.channelCode ||
    session.accessTokenJti !== payload.jti
  ) {
    throw unauthorizedError();
  }
}

function unauthorizedError() {
  return new RelayError({
    code: RELAY_ERROR_CODES.UNAUTHORIZED,
    message: 'Authentication is required.',
    retryable: false,
    status: 401,
  });
}

function accountLinkingError() {
  return new RelayError({
    code: RELAY_ERROR_CODES.UNAUTHORIZED,
    message: 'Authenticated account needs account linking.',
    retryable: false,
    status: 401,
  });
}

function isUniqueConstraintError(error) {
  let current = error;
  while (current && typeof current === 'object') {
    if (current.code === '23505') return true;
    current = current.cause;
  }
  return false;
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function createShortRef(prefix) {
  return `${prefix}_${randomBytes(8).toString('hex')}`;
}

async function defaultClerkAuth() {
  const { auth } = await import('@clerk/nextjs/server');
  return auth();
}

async function defaultClerkCurrentUser() {
  const { currentUser } = await import('@clerk/nextjs/server');
  return currentUser();
}
