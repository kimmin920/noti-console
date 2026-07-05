const DEFAULT_PAGE_SIZE = 20;
const DEV_MESSAGE_RESERVATIONS_PARAM = 'devMockReservations';

export const MESSAGE_RESERVATION_CHANNEL_OPTIONS = [
  { label: '모두', value: 'all' },
  { label: 'SMS', value: 'sms' },
  { label: '알림톡', value: 'alimtalk' },
  { label: '브랜드메시지', value: 'brand-message' },
];

export const MESSAGE_RESERVATION_DATE_PRESETS = [
  { daysForward: 0, label: '오늘', value: 'today' },
  { daysForward: 2, label: '향후 3일', value: 'next-3-days' },
  { daysForward: 6, label: '향후 7일', value: 'next-7-days' },
  { daysForward: 13, label: '향후 14일', value: 'next-14-days' },
  { daysForward: 29, label: '향후 30일', value: 'next-30-days' },
  { daysForward: 59, label: '향후 60일', value: 'next-60-days' },
];

export function getDefaultMessageReservationRange(now = new Date()) {
  return {
    from: startOfDay(now),
    to: addDays(startOfDay(now), 6),
  };
}

export function getMessageReservationFiltersFromSearchParams(searchParams, now = new Date()) {
  const defaultRange = getDefaultMessageReservationRange(now);
  const channel = MESSAGE_RESERVATION_CHANNEL_OPTIONS.some((option) => option.value === searchParams.get('channel'))
    ? searchParams.get('channel')
    : 'all';
  const page = normalizePositiveInteger(searchParams.get('page'), 1);
  const pageSize = normalizePageSize(searchParams.get('pageSize'));
  const devMockReservations = normalizeDevMockReservations(searchParams.get(DEV_MESSAGE_RESERVATIONS_PARAM));

  return {
    channel,
    ...(devMockReservations ? { devMockReservations } : {}),
    from: parseSearchDate(searchParams.get('from')) ?? defaultRange.from,
    page,
    pageSize,
    to: parseSearchDate(searchParams.get('to')) ?? defaultRange.to,
  };
}

export function toMessageReservationQueryParams(filters) {
  const range = toFullDayIsoRange(filters);

  return {
    channel: filters.channel,
    ...(filters.devMockReservations ? { devMockReservations: filters.devMockReservations } : {}),
    from: range.from,
    page: filters.page,
    pageSize: filters.pageSize,
    to: range.to,
  };
}

export function toMessageReservationUrlParams(filters, mode) {
  const params = new URLSearchParams();

  if (mode === 'embed') {
    params.set('mode', 'embed');
  }

  params.set('channel', filters.channel);
  if (filters.devMockReservations) {
    params.set(DEV_MESSAGE_RESERVATIONS_PARAM, filters.devMockReservations);
  }
  params.set('from', toDateInputValue(filters.from));
  params.set('to', toDateInputValue(filters.to));
  params.set('page', String(filters.page));
  params.set('pageSize', String(filters.pageSize));

  return params;
}

export function toFullDayIsoRange({ from, to }) {
  return {
    from: startOfDay(from).toISOString(),
    to: endOfDay(to).toISOString(),
  };
}

export function getReservationChannelLabel(channel) {
  return MESSAGE_RESERVATION_CHANNEL_OPTIONS.find((option) => option.value === channel)?.label ?? channel;
}

export function getMessageReservationGroupStatus(group) {
  switch (group?.aggregateState) {
    case 'reserved':
      return {
        label: '예약됨',
        state: 'reserved',
        tone: 'neutral',
      };
    case 'sending':
      return {
        label: '발송 중',
        state: 'sending',
        tone: 'neutral',
      };
    case 'completed':
      return {
        label: '완료됨',
        state: 'completed',
        tone: 'green',
      };
    case 'canceled':
      return {
        label: '취소됨',
        state: 'canceled',
        tone: 'neutral',
      };
    case 'failed':
      return {
        label: '실패',
        state: 'failed',
        tone: 'critical',
      };
    case 'unknown':
      return {
        label: '상태 확인 불가',
        state: 'unknown',
        tone: 'critical',
      };
    default:
      return {
        label: '상태 확인 불가',
        state: 'unknown',
        tone: 'critical',
      };
  }
}

export function getMessageReservationRecipientStatus(recipient) {
  return getMessageReservationGroupStatus({ aggregateState: classifyRecipientState(recipient) });
}

export function getMessageReservationBatchStatus(batch) {
  return getMessageReservationGroupStatus({ aggregateState: batch?.aggregateState });
}

export function canCancelMessageReservationGroup(group) {
  return group?.channel === 'sms' && Number(group?.reservedCount ?? 0) > 0;
}

export function getMessageReservationManagementTitle(group) {
  if (group?.groupType === 'bulk_run') {
    return normalizeValue(group.managementTitle) || '-';
  }

  return normalizeValue(group?.managementTitle) || normalizeValue(group?.contentPreview) || '-';
}

export function formatMessageReservationGroupCounts(group) {
  const recipientCount = Number(group?.recipientCount ?? 0);
  const reservedCount = Number(group?.reservedCount ?? 0);
  const canceledCount = Number(group?.canceledCount ?? 0);
  const completedCount = Number(group?.completedCount ?? 0);
  const failedCount = Number(group?.failedCount ?? 0);

  return `${recipientCount}명 · 예약 ${reservedCount} · 완료 ${completedCount} · 취소 ${canceledCount} · 실패 ${failedCount}`;
}

export function formatMessageReservationRecipientCount(group) {
  return `${Number(group?.recipientCount ?? 0).toLocaleString('ko-KR')}명`;
}

export function formatMessageReservationBatchRecipientCount(batch) {
  return `${Number(batch?.recipientCount ?? 0).toLocaleString('ko-KR')}명`;
}

export function formatMessageReservationBatchLabel(batch) {
  const sequence = Number(batch?.sequence ?? 0);
  const totalBatches = Number(batch?.totalBatches ?? 0);

  if (sequence > 0 && totalBatches > 0) {
    return `배치 ${sequence}/${totalBatches}`;
  }

  return sequence > 0 ? `배치 ${sequence}` : '배치';
}

export function formatMessageReservationBatchResult(batch) {
  return normalizeValue(batch?.errorMessage)
    || normalizeValue(batch?.errorCode)
    || normalizeValue(batch?.errorState)
    || '-';
}

export function formatMessageReservationSuccessRate(group) {
  const state = group?.aggregateState;

  if (!['completed', 'failed'].includes(state)) {
    return '-';
  }

  const completedCount = Number(group?.completedCount ?? 0);
  const failedCount = Number(group?.failedCount ?? 0);
  const denominator = completedCount + failedCount;

  if (denominator <= 0) {
    return '-';
  }

  return `${Math.round((completedCount / denominator) * 100)}%`;
}

export function formatMessageReservationBatchSuccessRate(batch) {
  if (Number.isFinite(batch?.successRate)) {
    return `${batch.successRate}%`;
  }

  return formatMessageReservationSuccessRate(batch);
}

export function getMessageReservationGroupRowId(group) {
  return normalizeValue(group?.id ?? group?.requestId);
}

export function getMessageReservationPageTotal(data) {
  return Number.isFinite(data?.total) ? data.total : data?.groups?.length ?? 0;
}

export function getMessageReservationRecipientRowId(recipient) {
  return [
    recipient?.channel,
    recipient?.senderResourceId,
    recipient?.requestId,
    recipient?.recipientSeq,
  ].map((value) => normalizeValue(value)).join(':');
}

export function getMessageReservationBatchRowId(batch) {
  return [
    batch?.id,
    batch?.providerRequestId,
    batch?.sequence,
  ].map((value) => normalizeValue(value)).join(':');
}

export function formatMessageReservationDate(value) {
  const normalized = normalizeValue(value);
  if (!normalized) return '-';

  const date = new Date(normalized.includes('T') ? normalized : normalized.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(date);
}

function classifyRecipientState(recipient) {
  const status = normalizeValue(recipient?.status).toUpperCase();

  if (['CANCEL', 'CANCELED', 'CANCELLED', 'CANCEL_REQUEST', 'CANCEL_REQUESTED'].includes(status)) {
    return 'canceled';
  }

  if (['4', '5', 'ERROR', 'FAIL', 'FAILED'].includes(status)) {
    return 'failed';
  }

  if (['3', 'COMPLETE', 'COMPLETED', 'SUCCESS', 'SUCCEEDED'].includes(status)) {
    return 'completed';
  }

  if (['2', 'IN_PROGRESS', 'PROCESS', 'PROCESSING', 'SEND', 'SENDING'].includes(status)) {
    return 'sending';
  }

  if (['0', '1', 'READY', 'RESERVE', 'RESERVED', 'SCHEDULED', 'WAIT', 'WAITING'].includes(status)) {
    return 'reserved';
  }

  return 'pending';
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function normalizePageSize(value) {
  const number = Number(value);
  return [20, 50, 100].includes(number) ? number : DEFAULT_PAGE_SIZE;
}

function normalizeDevMockReservations(value) {
  const normalized = normalizeValue(value).toLowerCase();
  return ['1', 'true', 'yes'].includes(normalized) ? '1' : null;
}

function parseSearchDate(value) {
  const normalized = normalizeValue(value);
  if (!normalized) return null;

  const date = new Date(normalized.includes('T') ? normalized : `${normalized}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInputValue(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function normalizeValue(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}
