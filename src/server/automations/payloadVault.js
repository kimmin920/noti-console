import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

import { RELAY_ERROR_CODES } from '../relay/constants.js';

export const AUTOMATION_EVENT_DATA_ENCRYPTION_KEY_ENV = 'AUTOMATION_EVENT_DATA_ENCRYPTION_KEY';
export const AUTOMATION_EVENT_PAYLOAD_VERSION = 1;

const AES_256_GCM_KEY_BYTES = 32;
const AES_GCM_IV_BYTES = 12;
const AES_GCM_ALGORITHM = 'aes-256-gcm';

export class AutomationPayloadVaultError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'AutomationPayloadVaultError';
    this.code = RELAY_ERROR_CODES.RELAY_CONFIG_ERROR;
    this.retryable = false;
    this.cause = cause;
  }
}

export function resolveAutomationPayloadVaultConfig(env = process.env) {
  return {
    key: resolveAutomationPayloadVaultKey(env[AUTOMATION_EVENT_DATA_ENCRYPTION_KEY_ENV]),
    version: AUTOMATION_EVENT_PAYLOAD_VERSION,
  };
}

export function resolveAutomationPayloadVaultKey(value) {
  if (isKeyBuffer(value)) {
    return Buffer.from(value);
  }

  if (typeof value !== 'string' || value.trim() === '') {
    throw new AutomationPayloadVaultError(`${AUTOMATION_EVENT_DATA_ENCRYPTION_KEY_ENV} is required.`);
  }

  const decoded = Buffer.from(value.trim(), 'base64');

  if (decoded.length !== AES_256_GCM_KEY_BYTES || decoded.toString('base64') !== normalizeBase64(value)) {
    throw new AutomationPayloadVaultError(
      `${AUTOMATION_EVENT_DATA_ENCRYPTION_KEY_ENV} must be a base64-encoded 32-byte key.`
    );
  }

  return decoded;
}

export function encryptAutomationEventPayload(payload, options = {}) {
  const config = resolveVaultConfigFromOptions(options);
  const plaintext = serializeJsonPayload(payload);
  const iv = randomBytes(AES_GCM_IV_BYTES);
  const cipher = createCipheriv(AES_GCM_ALGORITHM, config.key, iv);
  cipher.setAAD(versionAad(config.version));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    eventPayloadCiphertext: ciphertext.toString('base64'),
    eventPayloadIv: iv.toString('base64'),
    eventPayloadTag: tag.toString('base64'),
    eventPayloadVersion: config.version,
  };
}

export function decryptAutomationEventPayload(encryptedPayload, options = {}) {
  const config = resolveVaultConfigFromOptions(options);
  const envelope = normalizeEncryptedPayloadEnvelope(encryptedPayload);

  try {
    const decipher = createDecipheriv(
      AES_GCM_ALGORITHM,
      config.key,
      Buffer.from(envelope.eventPayloadIv, 'base64')
    );
    decipher.setAAD(versionAad(envelope.eventPayloadVersion));
    decipher.setAuthTag(Buffer.from(envelope.eventPayloadTag, 'base64'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.eventPayloadCiphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');

    return JSON.parse(plaintext);
  } catch (error) {
    throw new AutomationPayloadVaultError('Automation event payload could not be decrypted.', { cause: error });
  }
}

export function maskPhoneNumber(value) {
  const digits = normalizePhoneDigits(value);
  if (!digits) return null;
  if (digits.length <= 4) return '*'.repeat(digits.length);

  const prefixLength = Math.min(3, Math.max(0, digits.length - 4));
  const suffix = digits.slice(-4);
  const maskLength = Math.max(4, digits.length - prefixLength - suffix.length);

  return `${digits.slice(0, prefixLength)}${'*'.repeat(maskLength)}${suffix}`;
}

export function hashTargetRef(value, options = {}) {
  const normalizedValue = normalizeTargetRef(value);
  if (!normalizedValue) return null;

  const key = options.key
    ? resolveAutomationPayloadVaultKey(options.key)
    : resolveAutomationPayloadVaultConfig(options.env).key;

  return base64Url(createHmac('sha256', key).update(normalizedValue).digest());
}

function resolveVaultConfigFromOptions(options) {
  if (options.config?.key) {
    return {
      key: resolveAutomationPayloadVaultKey(options.config.key),
      version: options.config.version ?? AUTOMATION_EVENT_PAYLOAD_VERSION,
    };
  }

  if (options.key) {
    return {
      key: resolveAutomationPayloadVaultKey(options.key),
      version: options.version ?? AUTOMATION_EVENT_PAYLOAD_VERSION,
    };
  }

  return resolveAutomationPayloadVaultConfig(options.env);
}

function serializeJsonPayload(payload) {
  try {
    const plaintext = JSON.stringify(payload);
    if (plaintext === undefined) {
      throw new TypeError('Payload is not JSON-compatible.');
    }
    return plaintext;
  } catch (error) {
    throw new AutomationPayloadVaultError('Automation event payload must be JSON-compatible.', { cause: error });
  }
}

function normalizeEncryptedPayloadEnvelope(encryptedPayload) {
  const version = encryptedPayload?.eventPayloadVersion ?? AUTOMATION_EVENT_PAYLOAD_VERSION;

  if (
    typeof encryptedPayload?.eventPayloadCiphertext !== 'string' ||
    typeof encryptedPayload?.eventPayloadIv !== 'string' ||
    typeof encryptedPayload?.eventPayloadTag !== 'string' ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    throw new AutomationPayloadVaultError('Automation event payload envelope is invalid.');
  }

  return {
    eventPayloadCiphertext: encryptedPayload.eventPayloadCiphertext,
    eventPayloadIv: encryptedPayload.eventPayloadIv,
    eventPayloadTag: encryptedPayload.eventPayloadTag,
    eventPayloadVersion: version,
  };
}

function versionAad(version) {
  return Buffer.from(`automation-event-payload:v${version}`, 'utf8');
}

function normalizePhoneDigits(value) {
  if (value == null) return '';
  return String(value).replace(/\D/g, '');
}

function normalizeTargetRef(value) {
  if (value == null) return '';

  const digits = normalizePhoneDigits(value);
  return digits || String(value).trim();
}

function normalizeBase64(value) {
  return Buffer.from(String(value).trim(), 'base64').toString('base64');
}

function base64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function isKeyBuffer(value) {
  return (
    value instanceof Uint8Array &&
    value.byteLength === AES_256_GCM_KEY_BYTES
  );
}
