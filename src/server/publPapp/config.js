import { createHash, timingSafeEqual } from 'node:crypto';

import { RELAY_ERROR_CODES } from '../relay/constants.js';
import { RelayError } from '../relay/errors.js';

export const PUBL_PAPP_ENV = Object.freeze({
  TEST_CODE: 'PUBL_PAPP_TEST_CODE',
  TEST_OUTGOING_API_KEY: 'PUBL_PAPP_TEST_OUTGOING_API_KEY',
  TEST_OUTGOING_SECRET_KEY: 'PUBL_PAPP_TEST_OUTGOING_SECRET_KEY',
  RELEASE_CODE: 'PUBL_PAPP_RELEASE_CODE',
  RELEASE_OUTGOING_API_KEY: 'PUBL_PAPP_RELEASE_OUTGOING_API_KEY',
  RELEASE_OUTGOING_SECRET_KEY: 'PUBL_PAPP_RELEASE_OUTGOING_SECRET_KEY',
  ACCESS_TOKEN_SECRET: 'PUBL_PAPP_ACCESS_TOKEN_SECRET',
  REFRESH_TOKEN_HASH_SECRET: 'PUBL_PAPP_REFRESH_TOKEN_HASH_SECRET',
});

export const PUBL_PAPP_STAGES = Object.freeze({
  TEST: 'test',
  RELEASE: 'release',
});

export const PUBL_PAPP_DEFAULT_CODES = Object.freeze({
  TEST: '3RD_A00003_TEST',
  RELEASE: '3RD_A00003',
});

const PUBL_PAPP_CREDENTIAL_DEFINITIONS = Object.freeze([
  Object.freeze({
    stage: PUBL_PAPP_STAGES.TEST,
    pAppCodeEnvName: PUBL_PAPP_ENV.TEST_CODE,
    defaultPAppCode: PUBL_PAPP_DEFAULT_CODES.TEST,
    outgoingApiKeyEnvName: PUBL_PAPP_ENV.TEST_OUTGOING_API_KEY,
    outgoingSecretKeyEnvName: PUBL_PAPP_ENV.TEST_OUTGOING_SECRET_KEY,
  }),
  Object.freeze({
    stage: PUBL_PAPP_STAGES.RELEASE,
    pAppCodeEnvName: PUBL_PAPP_ENV.RELEASE_CODE,
    defaultPAppCode: PUBL_PAPP_DEFAULT_CODES.RELEASE,
    outgoingApiKeyEnvName: PUBL_PAPP_ENV.RELEASE_OUTGOING_API_KEY,
    outgoingSecretKeyEnvName: PUBL_PAPP_ENV.RELEASE_OUTGOING_SECRET_KEY,
  }),
]);

export function resolvePublPappConfig(env = process.env) {
  return {
    credentials: resolvePublPappCredentials(env),
    tokenSecrets: resolvePublPappTokenSecrets(env),
  };
}

export function resolvePublPappCredentials(env = process.env) {
  const credentials = PUBL_PAPP_CREDENTIAL_DEFINITIONS
    .map((definition) => resolveCredentialDefinition(env, definition))
    .filter(Boolean);

  validateCredentialUniqueness(credentials, 'pAppCode', 'pAppCode');
  validateCredentialUniqueness(credentials, 'outgoingApiKey', 'outgoing api key');

  return credentials;
}

export function resolvePublPappTokenSecrets(env = process.env) {
  return {
    accessTokenSecret: readRequiredEnv(env, PUBL_PAPP_ENV.ACCESS_TOKEN_SECRET),
    refreshTokenHashSecret: readRequiredEnv(env, PUBL_PAPP_ENV.REFRESH_TOKEN_HASH_SECRET),
  };
}

export function selectPublPappCredentialByApiKey(apiKey, options = {}) {
  const normalizedApiKey = normalizeNonEmptyString(apiKey);
  if (!normalizedApiKey) {
    throwPublPappAuthError('Publ PApp apiKey is required.');
  }

  const matches = getPublPappCredentials(options)
    .filter((credential) => safeEqualString(credential.outgoingApiKey, normalizedApiKey));

  if (matches.length === 0) {
    throwPublPappAuthError('Publ PApp credential was not found.');
  }

  if (matches.length > 1) {
    throwPublPappConfigError('Publ PApp credential configuration is ambiguous for apiKey.');
  }

  return matches[0];
}

export function selectPublPappCredentialByPAppCode(pAppCode, options = {}) {
  const normalizedPAppCode = normalizeNonEmptyString(pAppCode);
  if (!normalizedPAppCode) {
    throwPublPappAuthError('Publ PApp pAppCode is required.');
  }

  const matches = getPublPappCredentials(options)
    .filter((credential) => credential.pAppCode === normalizedPAppCode);

  if (matches.length === 0) {
    throwPublPappAuthError('Publ PApp credential was not found.');
  }

  if (matches.length > 1) {
    throwPublPappConfigError('Publ PApp credential configuration is ambiguous for pAppCode.');
  }

  return matches[0];
}

function resolveCredentialDefinition(env, definition) {
  const pAppCode = readOptionalEnv(env, definition.pAppCodeEnvName) ?? definition.defaultPAppCode;
  const outgoingApiKey = readOptionalEnv(env, definition.outgoingApiKeyEnvName);
  const outgoingSecretKey = readOptionalEnv(env, definition.outgoingSecretKeyEnvName);

  if (!outgoingApiKey && !outgoingSecretKey) {
    return null;
  }

  if (!outgoingApiKey) {
    throwPublPappConfigError(`${definition.outgoingApiKeyEnvName} is required when ${definition.outgoingSecretKeyEnvName} is set.`);
  }

  if (!outgoingSecretKey) {
    throwPublPappConfigError(`${definition.outgoingSecretKeyEnvName} is required when ${definition.outgoingApiKeyEnvName} is set.`);
  }

  return Object.freeze({
    stage: definition.stage,
    pAppCode,
    outgoingApiKey,
    outgoingSecretKey,
    envNames: Object.freeze({
      pAppCode: definition.pAppCodeEnvName,
      outgoingApiKey: definition.outgoingApiKeyEnvName,
      outgoingSecretKey: definition.outgoingSecretKeyEnvName,
    }),
  });
}

function getPublPappCredentials(options) {
  if (Array.isArray(options.credentials)) {
    return options.credentials;
  }

  if (Array.isArray(options.config?.credentials)) {
    return options.config.credentials;
  }

  return resolvePublPappCredentials(options.env ?? process.env);
}

function validateCredentialUniqueness(credentials, key, label) {
  const seen = new Set();

  for (const credential of credentials) {
    const value = credential[key];
    if (seen.has(value)) {
      throwPublPappConfigError(`Publ PApp credential configuration is ambiguous for ${label}.`);
    }

    seen.add(value);
  }
}

function readRequiredEnv(env, name) {
  const value = readOptionalEnv(env, name);
  if (!value) {
    throwPublPappConfigError(`${name} is required.`);
  }

  return value;
}

function readOptionalEnv(env, name) {
  const value = typeof env[name] === 'string' ? env[name].trim() : '';
  return value || null;
}

function normalizeNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function safeEqualString(left, right) {
  const leftHash = hashForCompare(left);
  const rightHash = hashForCompare(right);
  return timingSafeEqual(leftHash, rightHash);
}

function hashForCompare(value) {
  return createHash('sha256')
    .update(String(value ?? ''))
    .digest();
}

function throwPublPappConfigError(message) {
  throw new RelayError({
    code: RELAY_ERROR_CODES.RELAY_CONFIG_ERROR,
    message,
    retryable: false,
    status: 500,
  });
}

function throwPublPappAuthError(message) {
  throw new RelayError({
    code: RELAY_ERROR_CODES.UNAUTHORIZED,
    message,
    retryable: false,
    status: 401,
  });
}
