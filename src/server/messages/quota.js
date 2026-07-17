const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export const SENDER_RESOURCE_QUOTA_CHANNELS = Object.freeze({
  SMS: 'sms',
  ALIMTALK: 'alimtalk',
  BRAND_MESSAGE: 'brand-message',
});

const SMS_CHANNELS = new Set(['sms', 'lms', 'mms']);
const KAKAO_CHANNELS = new Set([
  SENDER_RESOURCE_QUOTA_CHANNELS.ALIMTALK,
  SENDER_RESOURCE_QUOTA_CHANNELS.BRAND_MESSAGE,
]);

export class SenderResourceQuotaExceededError extends Error {
  constructor({ quotaChannel, requestedCount, senderResourceId }) {
    super('Sender resource quota is not available for this send.');
    this.name = 'SenderResourceQuotaExceededError';
    this.quotaChannel = quotaChannel;
    this.requestedCount = requestedCount;
    this.senderResourceId = senderResourceId;
  }
}

export function buildSenderResourceQuotaDescriptor({ channel, effectiveAt, senderResourceId }) {
  const quotaChannel = toQuotaChannel(channel);
  const period = quotaChannel === SENDER_RESOURCE_QUOTA_CHANNELS.SMS
    ? getKstMonthlyQuotaPeriod(effectiveAt)
    : getKstDailyQuotaPeriod(effectiveAt);

  return {
    senderResourceId: requireString(senderResourceId, 'senderResourceId'),
    quotaChannel,
    ...period,
  };
}

export function getKstMonthlyQuotaPeriod(value) {
  const { monthIndex, year } = getKstDateParts(value);
  const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;
  const nextYear = monthIndex === 11 ? year + 1 : year;

  return {
    periodStartAt: fromKstParts({ year, monthIndex, day: 1 }),
    periodEndAt: fromKstParts({ year: nextYear, monthIndex: nextMonthIndex, day: 1 }),
  };
}

export function getKstDailyQuotaPeriod(value) {
  const { day, monthIndex, year } = getKstDateParts(value);
  const periodStartAt = fromKstParts({ year, monthIndex, day });

  return {
    periodStartAt,
    periodEndAt: new Date(periodStartAt.getTime() + 24 * 60 * 60 * 1000),
  };
}

export function getQuotaAvailableCount(bucket) {
  const limit = toNonNegativeInteger(bucket?.quotaLimit);
  const reserved = toNonNegativeInteger(bucket?.reservedCount);
  const consumed = toNonNegativeInteger(bucket?.consumedCount);

  return Math.max(0, limit - reserved - consumed);
}

export function getQuotaSettlementTargets(resultCounts) {
  return {
    targetConsumedCount: toNonNegativeInteger(resultCounts?.successCount),
    targetReleasedCount:
      toNonNegativeInteger(resultCounts?.failedCount)
      + toNonNegativeInteger(resultCounts?.canceledCount),
  };
}

export function createInitialFallbackQuotaSnapshot(recipientCount) {
  const length = toNonNegativeInteger(recipientCount);

  return {
    states: Array.from({ length }, () => 'P'),
    resultCodes: Array.from({ length }, () => null),
  };
}

export function countQuotaSnapshotStates(snapshot, recipientCount) {
  const length = toNonNegativeInteger(recipientCount);
  const counts = { canceledCount: 0, failedCount: 0, pendingCount: 0, successCount: 0 };

  for (let index = 0; index < length; index += 1) {
    const state = snapshot?.states?.[index];

    if (state === 'S') counts.successCount += 1;
    else if (state === 'F') counts.failedCount += 1;
    else if (state === 'C') counts.canceledCount += 1;
    else counts.pendingCount += 1;
  }

  return counts;
}

function toQuotaChannel(channel) {
  if (SMS_CHANNELS.has(channel)) return SENDER_RESOURCE_QUOTA_CHANNELS.SMS;
  if (KAKAO_CHANNELS.has(channel)) return channel;

  throw new TypeError(`Unsupported quota channel: ${String(channel)}`);
}

function getKstDateParts(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError('effectiveAt must be a valid date.');
  }

  const shifted = new Date(date.getTime() + KST_OFFSET_MS);

  return {
    day: shifted.getUTCDate(),
    monthIndex: shifted.getUTCMonth(),
    year: shifted.getUTCFullYear(),
  };
}

function fromKstParts({ day, monthIndex, year }) {
  return new Date(Date.UTC(year, monthIndex, day) - KST_OFFSET_MS);
}

function requireString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} is required.`);
  }

  return value.trim();
}

function toNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}
