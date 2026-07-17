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
  const period = normalizePeriod(query, currentTime);
  const source = normalizeSource(query.source);
  const channels = normalizeChannels(query.channel);

  return {
    channel: channels.length === 0 ? 'all' : channels.join(','),
    channels,
    generatedAt: currentTime,
    granularity: 'day',
    period,
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

function normalizePeriod(query, currentTime) {
  if (query.from || query.to) return normalizeCustomPeriod(query, currentTime);

  const range = normalizeRange(query.range);
  const days = RANGE_DAYS.get(range);
  const currentDayStart = getZonedDayStart(currentTime);
  return {
    from: new Date(currentDayStart.getTime() - (days - 1) * MS_PER_DAY),
    range,
    to: currentTime,
  };
}

function normalizeCustomPeriod(query, currentTime) {
  const from = parseZonedDate(query.from, false);
  const requestedTo = parseZonedDate(query.to ?? query.from, true);
  const to = requestedTo > currentTime ? currentTime : requestedTo;
  const dayCount = Math.floor((getZonedDayStart(to).getTime() - getZonedDayStart(from).getTime()) / MS_PER_DAY) + 1;

  if (from > to || dayCount < 1 || dayCount > 30) {
    throw new RelayValidationError('발송 현황 조회 기간은 최대 30일입니다.');
  }

  return { from, range: 'custom', to };
}

function parseZonedDate(value, endOfDay) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RelayValidationError('발송 현황 날짜 형식이 올바르지 않습니다.');
  }

  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+09:00`);
  if (Number.isNaN(date.getTime()) || formatZonedDate(date) !== value) {
    throw new RelayValidationError('발송 현황 날짜 형식이 올바르지 않습니다.');
  }
  return date;
}

function normalizeChannels(value) {
  if (!value || value === 'all') return [];
  const channels = [...new Set(String(value).split(',').filter(Boolean))];
  if (channels.length > 0 && channels.every((channel) => CHANNELS.includes(channel))) return channels;
  throw new RelayValidationError('지원하지 않는 발송 현황 채널입니다.');
}

function normalizeSource(value) {
  if (!value || value === 'all') return 'all';
  if (SOURCE_TYPES.includes(value)) return value;
  throw new RelayValidationError('지원하지 않는 발송 현황 출처입니다.');
}
