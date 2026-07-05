import { createHmac, timingSafeEqual } from 'node:crypto';

export const PUBL_OPEN_API_REPLAY_WINDOW_MS = 5 * 60 * 1000;

const MAX_SIGNATURE_LENGTH = 256;

export function verifyPublOpenApiSignature({
  env = process.env,
  headers,
  now = () => new Date(),
  rawBody,
} = {}) {
  const secret = normalizeSecret(env.PUBL_OPEN_API_WEBHOOK_SECRET);

  if (!secret) {
    return {
      ok: false,
      reason: 'missing_secret',
    };
  }

  const timestamp = normalizeHeader(headers?.get?.('x-publ-timestamp'));
  const signature = normalizeSignature(headers?.get?.('x-publ-signature'));
  const timestampDate = parsePublTimestamp(timestamp);

  if (!timestampDate || !isWithinReplayWindow(timestampDate, now())) {
    return {
      ok: false,
      reason: 'invalid_timestamp',
    };
  }

  if (!signature) {
    return {
      ok: false,
      reason: 'invalid_signature',
    };
  }

  const expectedSignature = createPublOpenApiSignature({
    rawBody,
    secret,
    timestamp,
  });

  return {
    ok: timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    ),
    reason: 'invalid_signature',
  };
}

export function createPublOpenApiSignature({ rawBody, secret, timestamp }) {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody ?? ''}`)
    .digest('hex');
}

function normalizeSecret(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeHeader(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeSignature(value) {
  const signature = normalizeHeader(value);
  if (!signature || signature.length > MAX_SIGNATURE_LENGTH) return null;

  const normalized = signature.startsWith('sha256=')
    ? signature.slice('sha256='.length)
    : signature;

  return /^[a-f0-9]{64}$/i.test(normalized) ? normalized.toLowerCase() : null;
}

function parsePublTimestamp(value) {
  if (!value) return null;

  if (/^\d+$/.test(value)) {
    const numericValue = Number(value);
    if (!Number.isSafeInteger(numericValue)) return null;

    const millis = value.length <= 10 ? numericValue * 1000 : numericValue;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinReplayWindow(timestampDate, nowDate) {
  const timestampMs = timestampDate.getTime();
  const nowMs = nowDate instanceof Date ? nowDate.getTime() : new Date(nowDate).getTime();

  if (!Number.isFinite(timestampMs) || !Number.isFinite(nowMs)) {
    return false;
  }

  return Math.abs(nowMs - timestampMs) <= PUBL_OPEN_API_REPLAY_WINDOW_MS;
}
