const AUTOMATION_SEND_CHANNEL_LABELS = {
  alimtalk: '알림톡',
  'brand-message': '브랜드 메시지',
  lms: 'LMS',
  mms: 'MMS',
  sms: 'SMS',
};

export const AUTOMATION_STATUS_LABELS = {
  archived: '보관됨',
  disabled: '비활성화',
  enabled: '활성화',
};

export function formatAutomationSendChannel(value) {
  return AUTOMATION_SEND_CHANNEL_LABELS[value] ?? value ?? '-';
}

export function formatAutomationRuleDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function getConditionSummary(condition) {
  const clauses = Array.isArray(condition?.all) ? condition.all : [];
  return clauses.length > 0 ? `${clauses.length}개 조건` : '항상 실행';
}

export function getCooldownSummary(policy) {
  if (!policy?.enabled) return '꺼짐';
  const seconds = Number(policy.windowSeconds ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return '켜짐';
  if (seconds % 3600 === 0) return `${seconds / 3600}시간`;
  if (seconds % 60 === 0) return `${seconds / 60}분`;
  return `${seconds}초`;
}
