import { createHash } from 'node:crypto';
import { CHANNELS, SMS_GROUPING_KEY_MAX_LENGTH } from './constants.js';
import { RelayValidationError } from './errors.js';

const CLIENT_REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMPACT_REF_PATTERN = /^[A-Za-z0-9_-]{1,20}$/;
const SENDER_GROUPING_KEY_PATTERN =
  /^u:([A-Za-z0-9_-]{1,20}):b:([A-Za-z0-9_-]{1,20}):r:([A-Za-z0-9_-]{1,20}):q:([A-Za-z0-9_-]{1,20})$/;
const RECIPIENT_GROUPING_KEY_PATTERN =
  /^u:([A-Za-z0-9_-]{1,20}):b:([A-Za-z0-9_-]{1,20}):r:([A-Za-z0-9_-]{1,20}):q:([A-Za-z0-9_-]{1,20}):n:([0-9]+)$/;
const REQUEST_REF_LENGTH = 12;

export function validateClientRequestId(clientRequestId) {
  if (typeof clientRequestId !== 'string') {
    throw new RelayValidationError('clientRequestId must be a UUID string.');
  }

  const normalized = clientRequestId.trim().toLowerCase();

  if (!CLIENT_REQUEST_ID_PATTERN.test(normalized)) {
    throw new RelayValidationError('clientRequestId must be a valid UUID.');
  }

  return normalized;
}

export function deriveRequestRef(clientRequestId) {
  const normalized = validateClientRequestId(clientRequestId);
  return createHash('sha256').update(normalized).digest('base64url').slice(0, REQUEST_REF_LENGTH);
}

export function buildSenderGroupingKey({ userRef, billingRef, resourceRef, requestRef }) {
  const key = `u:${validateCompactRef('userRef', userRef)}:b:${validateCompactRef(
    'billingRef',
    billingRef
  )}:r:${validateCompactRef('resourceRef', resourceRef)}:q:${validateCompactRef('requestRef', requestRef)}`;

  assertGroupingKeyLength('senderGroupingKey', key);
  return key;
}

export function buildRecipientGroupingKey(senderGroupingKey, recipientIndex) {
  if (typeof senderGroupingKey !== 'string' || !senderGroupingKey.trim()) {
    throw new RelayValidationError('senderGroupingKey is required.');
  }

  if (!Number.isSafeInteger(recipientIndex) || recipientIndex < 0) {
    throw new RelayValidationError('recipientIndex must be a non-negative integer.');
  }

  const key = `${senderGroupingKey}:n:${recipientIndex}`;
  assertGroupingKeyLength('recipientGroupingKey', key);
  return key;
}

export function buildGroupingKeys({ clientRequestId, userRef, billingRef, resourceRef, recipientIndex }) {
  const requestRef = deriveRequestRef(clientRequestId);
  const senderGroupingKey = buildSenderGroupingKey({
    userRef,
    billingRef,
    resourceRef,
    requestRef,
  });

  return {
    requestRef,
    senderGroupingKey,
    recipientGroupingKey: buildRecipientGroupingKey(senderGroupingKey, recipientIndex),
  };
}

export function parseSenderGroupingKey(senderGroupingKey) {
  if (typeof senderGroupingKey !== 'string') return null;

  const match = SENDER_GROUPING_KEY_PATTERN.exec(senderGroupingKey.trim());
  if (!match) return null;

  return {
    userRef: match[1],
    billingRef: match[2],
    resourceRef: match[3],
    requestRef: match[4],
    senderGroupingKey: match[0],
  };
}

export function parseRecipientGroupingKey(recipientGroupingKey) {
  if (typeof recipientGroupingKey !== 'string') return null;

  const match = RECIPIENT_GROUPING_KEY_PATTERN.exec(recipientGroupingKey.trim());
  if (!match) return null;

  const senderGroupingKey = `u:${match[1]}:b:${match[2]}:r:${match[3]}:q:${match[4]}`;

  return {
    userRef: match[1],
    billingRef: match[2],
    resourceRef: match[3],
    requestRef: match[4],
    recipientIndex: Number(match[5]),
    senderGroupingKey,
    recipientGroupingKey: match[0],
  };
}

export function resolveGroupingFromKeys({ senderGroupingKey, recipientGroupingKey }) {
  const parsedSender = parseSenderGroupingKey(senderGroupingKey);
  const parsedRecipient = parseRecipientGroupingKey(recipientGroupingKey);

  if (parsedSender && parsedRecipient && parsedSender.senderGroupingKey !== parsedRecipient.senderGroupingKey) {
    return null;
  }

  return parsedRecipient ?? parsedSender;
}

export function resolveGroupingFromProviderRow(row) {
  if (!row || typeof row !== 'object') return null;

  return resolveGroupingFromKeys({
    senderGroupingKey: row.senderGroupingKey ?? row.groupingKey ?? row.sendGroupingKey ?? row._senderGroupingKey,
    recipientGroupingKey: row.recipientGroupingKey ?? row.receiveGroupingKey,
  });
}

export function buildAlimtalkIdempotencyKey({ clientRequestId, userRef, resourceRef, requestRef }) {
  return buildKakaoBizmessageIdempotencyKey({
    channel: CHANNELS.ALIMTALK,
    clientRequestId,
    requestRef,
    resourceRef,
    userRef,
  });
}

export function buildBrandMessageIdempotencyKey({ clientRequestId, userRef, resourceRef, requestRef }) {
  return buildKakaoBizmessageIdempotencyKey({
    channel: CHANNELS.BRAND_MESSAGE,
    clientRequestId,
    requestRef,
    resourceRef,
    userRef,
  });
}

export function buildKakaoBizmessageIdempotencyKey({ channel, clientRequestId, userRef, resourceRef, requestRef }) {
  const resolvedRequestRef = requestRef ? validateCompactRef('requestRef', requestRef) : deriveRequestRef(clientRequestId);
  const normalizedChannel = validateKakaoBizmessageChannel(channel);

  return `i:${normalizedChannel}:u:${validateCompactRef('userRef', userRef)}:r:${validateCompactRef(
    'resourceRef',
    resourceRef
  )}:q:${resolvedRequestRef}`;
}

export function validateCompactRef(name, value) {
  if (typeof value !== 'string' || !COMPACT_REF_PATTERN.test(value)) {
    throw new RelayValidationError(`${name} must be 1-20 ASCII letters, numbers, underscores, or hyphens.`);
  }

  return value;
}

function assertGroupingKeyLength(name, key) {
  if (key.length > SMS_GROUPING_KEY_MAX_LENGTH) {
    throw new RelayValidationError(`${name} must be ${SMS_GROUPING_KEY_MAX_LENGTH} characters or fewer.`);
  }
}

function validateKakaoBizmessageChannel(channel) {
  if (channel === CHANNELS.ALIMTALK || channel === CHANNELS.BRAND_MESSAGE) {
    return channel;
  }

  throw new RelayValidationError('channel must be alimtalk or brand-message.');
}
