import { NHN_DIRECT_API_BASE_URLS } from '../relay/constants.js';
import { RelayError } from '../relay/errors.js';
import { RELAY_ERROR_CODES } from '../relay/constants.js';

export const NHN_RELAY_ENV = Object.freeze({
  SMS_APP_KEY: 'NHN_SMS_APP_KEY',
  SMS_WEBHOOK_SIGNATURE: 'NHN_SMS_WEBHOOK_SIGNATURE',
  SMS_SECRET_KEY: 'NHN_SMS_SECRET_KEY',
  SMS_BASE_URL: 'NHN_SMS_API_BASE_URL',
  KAKAO_APP_KEY: 'NHN_KAKAO_BIZMESSAGE_APP_KEY',
  KAKAO_WEBHOOK_SIGNATURE: 'NHN_KAKAO_BIZMESSAGE_WEBHOOK_SIGNATURE',
  KAKAO_SECRET_KEY: 'NHN_KAKAO_BIZMESSAGE_SECRET_KEY',
  KAKAO_BASE_URL: 'NHN_KAKAO_BIZMESSAGE_API_BASE_URL',
});

export function resolveNhnRelayConfig(env = process.env) {
  return {
    sms: resolveNhnSmsConfig(env),
    kakaoBizmessage: resolveNhnKakaoBizmessageConfig(env),
  };
}

export function resolveNhnSmsConfig(env = process.env) {
  return resolveProductConfig(env, {
    appKeyName: NHN_RELAY_ENV.SMS_APP_KEY,
    secretKeyName: NHN_RELAY_ENV.SMS_SECRET_KEY,
    baseUrlName: NHN_RELAY_ENV.SMS_BASE_URL,
    defaultBaseUrl: NHN_DIRECT_API_BASE_URLS.SMS,
  });
}

export function resolveNhnSmsWebhookConfig(env = process.env) {
  return {
    appKey: readRequiredEnv(env, NHN_RELAY_ENV.SMS_APP_KEY),
    signature: readRequiredEnv(env, NHN_RELAY_ENV.SMS_WEBHOOK_SIGNATURE),
  };
}

export function resolveNhnKakaoBizmessageConfig(env = process.env) {
  return resolveProductConfig(env, {
    appKeyName: NHN_RELAY_ENV.KAKAO_APP_KEY,
    secretKeyName: NHN_RELAY_ENV.KAKAO_SECRET_KEY,
    baseUrlName: NHN_RELAY_ENV.KAKAO_BASE_URL,
    defaultBaseUrl: NHN_DIRECT_API_BASE_URLS.KAKAO_BIZMESSAGE,
  });
}

export function resolveNhnKakaoBizmessageWebhookConfig(env = process.env) {
  return {
    appKey: readRequiredEnv(env, NHN_RELAY_ENV.KAKAO_APP_KEY),
    signature: readRequiredEnv(env, NHN_RELAY_ENV.KAKAO_WEBHOOK_SIGNATURE),
  };
}

export function isNhnRelayConfigured(env = process.env) {
  try {
    resolveNhnRelayConfig(env);
    return true;
  } catch (error) {
    if (error instanceof RelayError && error.code === RELAY_ERROR_CODES.RELAY_CONFIG_ERROR) {
      return false;
    }

    throw error;
  }
}

function resolveProductConfig(env, { appKeyName, secretKeyName, baseUrlName, defaultBaseUrl, optionalValues = {} }) {
  return {
    appKey: readRequiredEnv(env, appKeyName),
    secretKey: readRequiredEnv(env, secretKeyName),
    baseUrl: readBaseUrl(env, baseUrlName, defaultBaseUrl),
    ...optionalValues,
  };
}

function readRequiredEnv(env, name) {
  const value = typeof env[name] === 'string' ? env[name].trim() : '';

  if (!value) {
    throwRelayConfigError(`${name} is required.`);
  }

  return value;
}

function readBaseUrl(env, name, fallback) {
  const raw = typeof env[name] === 'string' && env[name].trim() ? env[name].trim() : fallback;
  let parsed;

  try {
    parsed = new URL(raw);
  } catch {
    throwRelayConfigError(`${name} must be a valid URL.`);
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throwRelayConfigError(`${name} must use http or https.`);
  }

  const normalized = raw.replace(/\/+$/, '');

  if (/notification[-_]?hub/i.test(normalized)) {
    throwRelayConfigError(`${name} must point to a direct NHN product API, not Notification Hub.`);
  }

  return normalized;
}

function throwRelayConfigError(message) {
  throw new RelayError({
    code: RELAY_ERROR_CODES.RELAY_CONFIG_ERROR,
    message,
    retryable: false,
    status: 500,
  });
}
