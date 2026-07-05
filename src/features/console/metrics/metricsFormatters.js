export const METRICS_RANGE_OPTIONS = [
  { label: '최근 7일', value: '7d' },
  { label: '최근 15일', value: '15d' },
  { label: '최근 30일', value: '30d' },
];

export const METRICS_CHANNEL_OPTIONS = [
  { label: '모든 채널', value: 'all' },
  { label: 'SMS', value: 'sms' },
  { label: 'LMS', value: 'lms' },
  { label: 'MMS', value: 'mms' },
  { label: '알림톡', value: 'alimtalk' },
  { label: '브랜드 메시지', value: 'brand-message' },
];

export const METRICS_SOURCE_OPTIONS = [
  { label: '전체 출처', value: 'all' },
  { label: '수동 발송', value: 'manual' },
  { label: '자동화', value: 'automation' },
];

const CHANNEL_LABELS = new Map(METRICS_CHANNEL_OPTIONS.map((option) => [option.value, option.label]));

export function formatMetricNumber(value) {
  return Number(value ?? 0).toLocaleString('ko-KR');
}

export function formatMetricPercent(value) {
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 1,
    style: 'percent',
  }).format(Number(value ?? 0));
}

export function formatMetricDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value));
}

export function getMetricsChannelLabel(channel) {
  return CHANNEL_LABELS.get(channel) ?? channel ?? '-';
}
