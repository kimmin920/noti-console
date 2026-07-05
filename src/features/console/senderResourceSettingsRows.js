import {
  formatSettingsPhoneNumber,
  formatSettingsSmsSenderLabel,
} from './senderResourceLabels.js';

const SMS_SENDER_RESOURCE_TYPE = 'sms_send_no';

export function getSettingsSenderResourceRows(data, type) {
  const resources = Array.isArray(data?.resources) ? data.resources : [];
  const applications = Array.isArray(data?.applications) ? data.applications : [];

  const resourceRows = resources
    .filter((item) => item?.resource?.type === type)
    .map((item) => {
      const resource = item.resource;
      const label = type === SMS_SENDER_RESOURCE_TYPE
        ? formatSettingsSmsSenderLabel(resource)
        : formatSettingsKakaoSenderLabel(resource);

      return {
        isDefault: Boolean(item.isDefault),
        label,
        limitLabel: getSettingsSenderResourceLimitLabel(resource),
        linkId: item.id,
        statusLabel: getSettingsSenderResourceStatusLabel(item),
      };
    });

  const applicationRows = type === SMS_SENDER_RESOURCE_TYPE
    ? applications
      .filter((application) => (
        application?.resourceType === type
        && ['submitted', 'rejected'].includes(application.status)
      ))
      .map((application) => ({
        isDefault: false,
        isPendingApplication: application.status === 'submitted',
        isRejectedApplication: application.status === 'rejected',
        applicationId: application.id,
        label: formatSettingsPhoneNumber(application.requestedValue),
        limitLabel: application.status === 'rejected' ? '재신청 가능' : '검수 후 적용',
        linkId: `application-${application.id}`,
        statusLabel: getSettingsSenderApplicationStatusLabel(application),
      }))
    : [];

  return [...applicationRows, ...resourceRows];
}

function getSettingsSenderApplicationStatusLabel(application) {
  const typeLabel = application.senderNumberType === 'company' ? '회사번호' : '개인번호';

  if (application.status === 'rejected') {
    const reason = String(application.rejectReason ?? '').trim();
    return reason ? `${typeLabel} · 반려 사유: ${reason}` : `${typeLabel} · 반려됨`;
  }

  return `${typeLabel} · 검수 대기`;
}

function formatSettingsKakaoSenderLabel(resource) {
  if (resource.displayName && resource.displayName !== resource.value) {
    return resource.displayName;
  }

  return resource.value || resource.id;
}

function getSettingsSenderResourceStatusLabel(item) {
  const labels = [
    item.resource?.providerStatus,
    item.resource?.status,
    item.status,
  ].filter(Boolean);

  if (!labels.length) {
    return '상태 정보 없음';
  }

  return Array.from(new Set(labels.map(getSettingsSenderResourceStatusText))).join(' · ');
}

function getSettingsSenderResourceLimitLabel(resource) {
  const metadata = resource.metadataJson ?? {};
  const limit = metadata.dailyLimit ?? metadata.monthlyLimit ?? metadata.limit;

  if (!limit) {
    return '한도 정보 없음';
  }

  if (typeof limit === 'number') {
    return limit.toLocaleString();
  }

  return String(limit);
}

function getSettingsSenderResourceStatusText(value) {
  const normalized = String(value ?? '').toLowerCase();

  if (normalized === 'active' || normalized === 'approved') {
    return '사용 가능';
  }

  if (normalized === 'submitted') {
    return '검토 중';
  }

  if (normalized === 'pending') {
    return '대기';
  }

  if (normalized === 'rejected') {
    return '반려';
  }

  return String(value ?? '');
}
