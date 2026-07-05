import { getDb } from '../../db/client.js';
import { auditLogs } from '../../db/schema.js';
import { RELAY_ERROR_CODES } from '../relay/constants.js';
import {
  RelayError,
  extractProviderDetails,
  isProviderRateLimit,
  isProviderTimeout,
} from '../relay/errors.js';

const AUDIT_HANDLED = Symbol.for('messaging-app.audit.handled');
const MAX_AUDIT_STRING_LENGTH = 240;
const REDACTED_NUMBER = '[redacted-number]';
const FORBIDDEN_METADATA_KEYS = new Set([
  'accessToken',
  'apiKey',
  'appKey',
  'authorization',
  'body',
  'content',
  'contentPreview',
  'downloadUrl',
  'externalUrl',
  'messageBody',
  'messageContent',
  'nhnResultPayload',
  'nhnSecretKey',
  'objectKey',
  'objectUrl',
  'password',
  'privateUrl',
  'providerAccessToken',
  'providerRefreshToken',
  'providerSecret',
  'providerToken',
  'publicUrl',
  'raw',
  'rawPayload',
  'refreshToken',
  'recipientList',
  'recipientNo',
  'recipients',
  'requestBody',
  'responseBody',
  'resultPayload',
  'r2Bucket',
  'r2ObjectKey',
  'secret',
  'secretKey',
  'sendResultList',
  'signedUrl',
  'templateContent',
  'templateParameter',
  'templateParameters',
  'templatePayload',
  'templateSourcePayload',
  'token',
  'x-secret-key',
  'xSecretKey',
  'X-Secret-Key',
].map((key) => key.toLowerCase()));

export const AUDIT_ACTIONS = Object.freeze({
  LOCAL_VALIDATION_REJECTED: 'local_validation.rejected',
  PROVIDER_TIMEOUT: 'provider.timeout',
  PROVIDER_RATE_LIMITED: 'provider.rate_limited',
});

export function createDefaultAuditRepository() {
  return createAuditRepository(getDb());
}

export function createAuditRepository(db) {
  return {
    async createAuditLog(values) {
      const [auditLog] = await db
        .insert(auditLogs)
        .values({
          ...values,
          metadataJson: sanitizeAuditMetadata(values.metadataJson ?? {}),
        })
        .returning();
      return auditLog;
    },
  };
}

export async function auditRelayFailure({
  repository,
  error,
  actorUserId = null,
  operation,
  targetType = 'relay',
  targetId = null,
  metadataJson = {},
  markHandled = true,
}) {
  if (!repository?.createAuditLog || isAuditHandled(error)) {
    return null;
  }

  const action = getAuditableAction(error);
  if (!action) {
    return null;
  }

  const auditLog = await repository.createAuditLog({
    actorUserId,
    action,
    targetType,
    targetId,
    metadataJson: sanitizeAuditMetadata({
      operation,
      ...metadataJson,
      ...toSafeErrorMetadata(error),
    }),
  });

  if (markHandled && error && typeof error === 'object') {
    Object.defineProperty(error, AUDIT_HANDLED, {
      value: true,
      configurable: true,
    });
  }

  return auditLog;
}

export function isAuditableRelayFailure(error) {
  return Boolean(getAuditableAction(error));
}

function isAuditHandled(error) {
  return Boolean(error && typeof error === 'object' && error[AUDIT_HANDLED]);
}

function getAuditableAction(error) {
  if (isProviderRateLimit(error)) {
    return AUDIT_ACTIONS.PROVIDER_RATE_LIMITED;
  }

  if (isProviderTimeout(error)) {
    return AUDIT_ACTIONS.PROVIDER_TIMEOUT;
  }

  if (error instanceof RelayError && error.code === RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED) {
    return AUDIT_ACTIONS.LOCAL_VALIDATION_REJECTED;
  }

  return null;
}

function toSafeErrorMetadata(error) {
  if (isProviderRateLimit(error) || isProviderTimeout(error)) {
    const details = extractProviderDetails(error);

    return {
      errorSource: 'nhn',
      providerCode:
        details.providerCode === null || details.providerCode === undefined
          ? null
          : String(details.providerCode),
      providerMessage:
        details.providerMessage === null || details.providerMessage === undefined
          ? null
          : String(details.providerMessage),
    };
  }

  if (error instanceof RelayError) {
    return {
      errorSource: error.source,
      errorCode: error.code,
      errorMessage: error.message,
    };
  }

  return {
    errorSource: 'relay',
    errorMessage: 'Relay operation failed.',
  };
}

export function sanitizeAuditMetadata(value) {
  return sanitizeValue(value);
}

function sanitizeValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map(sanitizeValue).filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    const result = {};

    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())) {
        continue;
      }

      const sanitized = sanitizeValue(item);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }

    return result;
  }
  if (typeof value === 'string') {
    return redactSensitiveText(value).slice(0, MAX_AUDIT_STRING_LENGTH);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return String(value).slice(0, MAX_AUDIT_STRING_LENGTH);
}

function redactSensitiveText(value) {
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value;
  }

  return value.replace(/\+?\d[\d\s-]{6,}\d/g, REDACTED_NUMBER);
}
