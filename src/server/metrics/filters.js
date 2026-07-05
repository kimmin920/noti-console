import { RelayValidationError } from '../relay/errors.js';

export const METRICS_TIME_ZONE = 'Asia/Seoul';
export const CHANNELS = ['sms', 'lms', 'mms', 'alimtalk', 'brand-message'];
export const SOURCE_TYPES = ['manual', 'automation'];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RANGE_DAYS = new Map([
  ['7d', 7],
  ['15d', 15],
  ['30d', 30],
]);

export function normalizeMetricsQuery(query, currentTime) {
  const range = normalizeRange(query.range);
  const source = normalizeSource(query.source);
  const channel = normalizeChannel(query.channel);
  const days = RANGE_DAYS.get(range);
  const currentDayStart = getZonedDayStart(currentTime);
  const from = new Date(currentDayStart.getTime() - (days - 1) * MS_PER_DAY);

  return {
    channel,
    generatedAt: currentTime,
    granularity: 'day',
    period: {
      from,
      range,
      to: currentTime,
    },
    source,
  };
}

export function getZonedDayStart(date) {
  return new Date(`${formatZonedDate(date)}T00:00:00+09:00`);
}

export function formatZonedDate(value) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: METRICS_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(new Date(value));
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

function normalizeRange(value) {
  return typeof value === 'string' && RANGE_DAYS.has(value) ? value : '15d';
}

function normalizeChannel(value) {
  if (!value || value === 'all') return 'all';
  if (CHANNELS.includes(value)) return value;
  throw new RelayValidationError('지원하지 않는 메트릭 채널입니다.');
}

function normalizeSource(value) {
  if (!value || value === 'all') return 'all';
  if (SOURCE_TYPES.includes(value)) return value;
  throw new RelayValidationError('지원하지 않는 메트릭 출처입니다.');
}
