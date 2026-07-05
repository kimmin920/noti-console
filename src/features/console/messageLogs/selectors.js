import {
  getKakaoFailureReason,
  getKakaoFailureResultLabel,
  isKakaoFailureResult,
  isKakaoSuccessResult,
} from '../messageResults/kakaoResultCodes.js';
import {
  getSmsResultCodeLabel,
  isSmsFailureResult,
  isSmsSuccessResult,
} from '../messageResults/smsResultCodes.js';

const BRAND_MESSAGE_CHANNEL = 'brand-message';
const PROVIDER_IN_PROGRESS_STATES = new Set(['queued', 'sending']);
const PROVIDER_PARTIAL_OR_FAILED_STATES = new Set(['partial', 'rejected', 'failed', 'blocked', 'unknown', 'canceled']);
const DEFAULT_PAGE_SIZE = 20;
const MESSAGE_LOG_DEMO_CASES_VALUE = 'cases';

export const MESSAGE_LOG_CHANNEL_OPTIONS = [
  { label: 'SMS', value: 'sms' },
  { label: '알림톡', value: 'alimtalk' },
  { label: '브랜드 메시지', value: BRAND_MESSAGE_CHANNEL },
];

export const SMS_MESSAGE_TYPE_OPTIONS = [
  { label: '전체', value: 'all' },
  { label: 'SMS', value: 'sms' },
  { label: 'LMS', value: 'lms' },
  { label: 'MMS', value: 'mms' },
];

export function getDefaultMessageLogRange(now = new Date()) {
  return {
    from: addDays(startOfDay(now), -6),
    to: startOfDay(now),
  };
}

export function getMessageLogFiltersFromSearchParams(searchParams, now = new Date()) {
  const defaultRange = getDefaultMessageLogRange(now);
  const channel = MESSAGE_LOG_CHANNEL_OPTIONS.some((option) => option.value === searchParams.get('channel'))
    ? searchParams.get('channel')
    : 'sms';
  const messageType = channel === 'sms' && SMS_MESSAGE_TYPE_OPTIONS.some((option) => option.value === searchParams.get('messageType'))
    ? searchParams.get('messageType')
    : 'all';
  const page = normalizePositiveInteger(searchParams.get('page'), 1);
  const pageSize = normalizePageSize(searchParams.get('pageSize'));

  return {
    channel,
    demoCases: isMessageLogDemoCasesSearchParam(searchParams.get('demo')),
    from: parseSearchDate(searchParams.get('from')) ?? defaultRange.from,
    messageType,
    page,
    pageSize,
    to: parseSearchDate(searchParams.get('to')) ?? defaultRange.to,
  };
}

export function toMessageLogQueryParams(filters) {
  const range = toFullDayIsoRange(filters);

  return {
    channel: filters.channel,
    ...(filters.demoCases ? { demo: MESSAGE_LOG_DEMO_CASES_VALUE } : {}),
    from: range.from,
    ...(filters.channel === 'sms' && filters.messageType && filters.messageType !== 'all'
      ? { messageType: filters.messageType }
      : {}),
    page: filters.page,
    pageSize: filters.pageSize,
    to: range.to,
  };
}

export function toMessageLogUrlParams(filters, mode) {
  const params = new URLSearchParams();

  if (mode === 'embed') {
    params.set('mode', 'embed');
  }

  if (filters.demoCases) {
    params.set('demo', MESSAGE_LOG_DEMO_CASES_VALUE);
  }
  params.set('channel', filters.channel);
  if (filters.channel === 'sms' && filters.messageType && filters.messageType !== 'all') {
    params.set('messageType', filters.messageType);
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

export function getChannelLabel(channel) {
  return [...MESSAGE_LOG_CHANNEL_OPTIONS, ...SMS_MESSAGE_TYPE_OPTIONS]
    .find((option) => option.value === channel)?.label ?? channel;
}

export function getMessageLogGroupSentAt(group) {
  return group?.requestDate ?? group?.scheduledAt ?? group?.createdAt ?? null;
}

export function getMessageLogStatus(log) {
  if (isSuccessLog(log)) {
    return {
      label: '성공',
      state: 'success',
      tone: 'green',
    };
  }

  if (isFailedMessageLog(log)) {
    return {
      label: '실패',
      state: 'failed',
      tone: 'critical',
    };
  }

  return {
    label: '처리 중',
    state: 'pending',
    tone: 'neutral',
  };
}

export function getMessageLogResultLabel(log) {
  const channel = normalizeValue(log?.channel).toLowerCase();
  const resultCode = normalizeValue(log?.resultCode);

  if (isSmsFamilyChannel(channel)) {
    if (isSuccessLog(log)) {
      return getSmsResultCodeLabel(resultCode) || '성공';
    }

    if (isFailedMessageLog(log)) {
      const codeLabel = getSmsResultCodeLabel(resultCode);
      return codeLabel ? `실패 · ${codeLabel}` : '실패';
    }
  }

  if (isSuccessLog(log)) return '성공';
  if (isFailedMessageLog(log)) {
    if (channel === 'alimtalk' || channel === BRAND_MESSAGE_CHANNEL) {
      return getKakaoFailureResultLabel(log);
    }

    return normalizeValue(log?.resultMessage) || resultCode || '실패';
  }

  return resultCode || normalizeValue(log?.resultMessage) || '-';
}

export function getMessageLogGroupStatus(group) {
  const providerState = normalizeValue(group?.providerState);
  const resultState = normalizeValue(group?.resultState);
  const pendingCount = getCount(group, 'pendingCount');
  const failureCount = getFailureCount(group);

  if (PROVIDER_IN_PROGRESS_STATES.has(providerState)) {
    return {
      label: '접수 중',
      state: 'pending',
      tone: 'neutral',
    };
  }

  if (resultState === 'stale' || (group?.resultFinalizedAt && pendingCount > 0)) {
    return {
      label: '집계 마감 · 일부 미확인',
      state: 'unknown',
      tone: 'warning',
    };
  }

  if (isResultComplete(group)) {
    if (failureCount > 0 || PROVIDER_PARTIAL_OR_FAILED_STATES.has(providerState)) {
      return {
        label: '완료 · 일부 실패',
        state: 'failed',
        tone: 'critical',
      };
    }

    return {
      label: '완료 · 성공',
      state: 'success',
      tone: 'green',
    };
  }

  if (PROVIDER_PARTIAL_OR_FAILED_STATES.has(providerState)) {
    return {
      label: '접수 일부 실패 · 결과 집계 중',
      state: 'partial',
      tone: 'critical',
    };
  }

  return {
    label: '접수 완료 · 결과 집계 중',
    state: 'pending',
    tone: 'neutral',
  };
}

export function getMessageLogGroupProviderStatus(group) {
  switch (group?.providerState) {
    case 'accepted':
      return {
        label: '접수 완료',
        state: 'success',
        tone: 'green',
      };
    case 'partial':
      return {
        label: '일부 접수',
        state: 'unknown',
        tone: 'warning',
      };
    case 'queued':
    case 'sending':
      return {
        label: '접수 대기',
        state: 'pending',
        tone: 'neutral',
      };
    case 'canceled':
      return {
        label: '취소됨',
        state: 'pending',
        tone: 'neutral',
      };
    case 'rejected':
    case 'blocked':
    case 'failed':
      return {
        label: '접수 실패',
        state: 'failed',
        tone: 'critical',
      };
    default:
      return {
        label: '확인 필요',
        state: 'unknown',
        tone: 'warning',
      };
  }
}

export function getMessageLogGroupKindLabel(group) {
  if (group?.sendTiming === 'scheduled') return '예약';
  return group?.sendKind === 'bulk' ? '대량' : '일반';
}

export function getMessageLogGroupSourceLabel(group) {
  const source = group?.source;

  if (source?.type === 'automation') {
    const ruleName = normalizeValue(source.automationRuleName);
    return ruleName ? `자동화 · ${ruleName}` : '자동화';
  }

  return normalizeValue(source?.label) || '직접 발송';
}

export function getMessageLogGroupSourceDetailItems(group) {
  const source = group?.source;

  if (source?.type !== 'automation') {
    return [];
  }

  return [
    { label: '이벤트 키', value: source.eventKey },
    { label: '외부 이벤트 ID', value: source.externalEventId },
    { label: '채널 코드', value: source.channelCode },
    { label: '자동화 Rule ID', value: source.automationRuleId },
    { label: '자동화 Delivery ID', value: source.automationDeliveryId },
  ].filter((item) => normalizeValue(item.value));
}

export function getMessageLogGroupProviderSummary(group) {
  const total = Number(group?.providerRequestCount ?? 0);
  const accepted = Number(group?.acceptedRequestCount ?? 0);

  if (group?.providerState === 'accepted') return '접수 완료';
  if (group?.providerState === 'partial') return `접수 ${accepted.toLocaleString('ko-KR')}/${total.toLocaleString('ko-KR')}`;
  if (group?.providerState === 'queued' || group?.providerState === 'sending') return '접수 대기';
  if (group?.providerState === 'canceled') return '취소됨';
  if (group?.providerState === 'rejected' || group?.providerState === 'failed' || group?.providerState === 'blocked') {
    return '접수 실패';
  }
  return '확인 필요';
}

export function getMessageLogGroupResultSummary(group) {
  const successCount = getCount(group, 'successCount');
  const failureCount = getFailureCount(group);
  const pendingCount = getCount(group, 'pendingCount');

  if (!isResultComplete(group) || pendingCount > 0) {
    return [
      `성공 ${successCount.toLocaleString('ko-KR')}`,
      `실패 ${failureCount.toLocaleString('ko-KR')}`,
      `미확인 ${pendingCount.toLocaleString('ko-KR')}`,
    ].join(' · ');
  }

  return [
    `성공 ${successCount.toLocaleString('ko-KR')}`,
    `실패 ${failureCount.toLocaleString('ko-KR')}`,
    `성공률 ${formatSuccessRate(successCount, failureCount)}`,
  ].join(' · ');
}

export function getMessageLogFailureResultLabel(failure) {
  const resultCodeLabel = normalizeValue(failure?.resultCodeLabel);
  if (resultCodeLabel) return resultCodeLabel;

  const reason = getMessageLogFailureReason(failure);
  return reason ? `실패 · ${reason}` : '실패';
}

export function getMessageLogFailureReason(log) {
  const channel = normalizeValue(log?.channel).toLowerCase();
  const resultCode = normalizeValue(log?.resultCode);
  const resultMessage = normalizeValue(log?.resultMessage);

  if (channel === 'alimtalk' || channel === BRAND_MESSAGE_CHANNEL) {
    return getKakaoFailureReason({ resultCode, resultMessage });
  }

  if (!channel || isSmsFamilyChannel(channel)) {
    return getSmsResultCodeLabel(resultCode);
  }

  return resultMessage || resultCode;
}

export function getMessageLogGroupRowId(group) {
  return normalizeValue(group?.id);
}

export function getMessageLogGroupPageTotal(data) {
  return Number.isFinite(data?.total) ? data.total : data?.groups?.length ?? 0;
}

export function formatMessageLogGroupCounts(group) {
  const recipientCount = Number(group?.recipientCount ?? 0);
  const recipientNo = normalizeValue(group?.representativeRecipientNo ?? group?.recipientNo);

  if (recipientCount === 1 && recipientNo) {
    return recipientNo;
  }

  return `${recipientCount.toLocaleString('ko-KR')}명`;
}

export function getMessageLogGroupDisplayPreview(group) {
  if (group?.groupType === 'bulk_run') {
    return normalizeValue(group.managementTitle) || '-';
  }

  return normalizeValue(group?.managementTitle) || normalizeValue(group?.contentPreview) || '-';
}

export function isFailedMessageLog(log) {
  const channel = normalizeValue(log?.channel).toLowerCase();
  const resultCode = normalizeValue(log?.resultCode).toUpperCase();
  const status = normalizeValue(log?.status).toUpperCase();

  if (channel === 'alimtalk' || channel === BRAND_MESSAGE_CHANNEL) {
    return isKakaoFailureResult({ resultCode, status });
  }

  return isSmsFailureResult({ resultCode, status });
}

export function canResendMessageLog(log) {
  return isFailedMessageLog(log) && log?.channel !== BRAND_MESSAGE_CHANNEL;
}

export function formatMessageLogDate(value) {
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

export function getMessageLogRowId(log) {
  return [log?.channel, log?.requestId, log?.recipientSeq].map((value) => normalizeValue(value)).join(':');
}

export function getMessageLogPageTotal(data) {
  return Number.isFinite(data?.total) ? data.total : data?.logs?.length ?? 0;
}

function isSuccessLog(log) {
  const channel = normalizeValue(log?.channel).toLowerCase();
  const resultCode = normalizeValue(log?.resultCode).toUpperCase();
  const status = normalizeValue(log?.status).toUpperCase();

  if (channel === 'alimtalk' || channel === BRAND_MESSAGE_CHANNEL) {
    return isKakaoSuccessResult({ resultCode, status });
  }

  return isSmsSuccessResult({ resultCode, status });
}

function isSmsFamilyChannel(channel) {
  return channel === 'sms' || channel === 'lms' || channel === 'mms';
}

function isResultComplete(group) {
  const resultState = normalizeValue(group?.resultState);
  const pendingCount = getCount(group, 'pendingCount');
  const hasFinalizedAt = Boolean(group?.resultFinalizedAt);

  return resultState === 'synced' || (hasFinalizedAt && pendingCount === 0);
}

function getFailureCount(group) {
  return getCount(group, 'failedCount') + getCount(group, 'canceledCount');
}

function getCount(source, key) {
  const number = Number(source?.[key] ?? 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function formatSuccessRate(successCount, failureCount) {
  const total = successCount + failureCount;
  if (total <= 0) return '0%';

  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format((successCount / total) * 100) + '%';
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function normalizePageSize(value) {
  const number = Number(value);
  return [20, 50, 100].includes(number) ? number : DEFAULT_PAGE_SIZE;
}

function isMessageLogDemoCasesSearchParam(value) {
  return process.env.NODE_ENV !== 'production' && normalizeValue(value).toLowerCase() === MESSAGE_LOG_DEMO_CASES_VALUE;
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
