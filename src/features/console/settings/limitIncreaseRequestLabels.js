export const LIMIT_REQUEST_STATUS_OPTIONS = [
  { label: '검토 대기', value: 'submitted' },
  { label: '전체', value: 'all' },
  { label: '승인됨', value: 'approved' },
  { label: '반려됨', value: 'rejected' },
];

export function getLimitRequestStatusLabel(status) {
  if (status === 'approved') return '승인됨';
  if (status === 'rejected') return '반려됨';
  if (status === 'canceled') return '취소됨';
  return '검토 대기';
}

export function getLimitRequestStatusTone(status) {
  if (status === 'approved') return 'green';
  if (status === 'rejected') return 'red';
  if (status === 'canceled') return 'neutral';
  return 'yellow';
}

export function getLimitRequestChannelLabel(channel) {
  if (channel === 'kakao' || channel === 'alimtalk' || channel === 'brand-message') return '카카오 채널';
  return '문자';
}

export function getLimitRequestScopeLabel(scope) {
  return scope === 'daily_channel' ? '채널별 일 한도' : '월 한도';
}

export function formatLimitCount(value, { cadence } = {}) {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  const prefix = cadence ? `${cadence} ` : '';
  return `${prefix}${new Intl.NumberFormat('ko-KR').format(number)}건`;
}

export function formatLimitDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function getLimitRequestTargetLabel(request) {
  const channel = getLimitRequestChannelLabel(request.channel);
  const sender = request.senderResource?.displayName || request.senderResource?.value;
  return sender ? `${channel} · ${sender}` : channel;
}
