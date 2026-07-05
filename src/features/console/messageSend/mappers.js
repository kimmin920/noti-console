import { formatSmsSenderLabel } from '../senderResourceLabels.js';

const SMS_RESOURCE_TYPE = 'sms_send_no';
const KAKAO_RESOURCE_TYPE = 'kakao_sender_key';
const COMMON_KAKAO_SENDER_PROFILE_IDENTIFIERS = new Set([
  '@비주오',
  '@publ',
  '2f9e6a06b25c497001400cab5f5f94ca726080b5',
  '954b4486e661a019badabd5ebe15d7ef7e27cb31',
]);
const SENDABLE_SENDER_RESOURCE_ROLES = new Set(['owner', 'sender']);

export function getSenderResourceItems(data, type) {
  return getSenderResourceRows(data, type).map((item) => item.resource);
}

export function getKakaoSenderResourceItems(data) {
  return getSenderResourceItems(data, KAKAO_RESOURCE_TYPE);
}

function getSenderResourceRows(data, type) {
  const resources = Array.isArray(data?.resources) ? data.resources : [];

  return resources
    .filter((item) => (
      item?.resource
      && item.resource.type === type
      && item.resource.status === 'active'
      && (item.status === undefined || item.status === 'active')
    ));
}

export function getSmsSenderOptions(data) {
  const resources = getSenderResourceRows(data, SMS_RESOURCE_TYPE);
  const useOnlySenderAsDefault = resources.length === 1;

  return resources
    .map((item) => ({
      isDefault: Boolean(item.isDefault) || useOnlySenderAsDefault,
      label: formatSmsSenderLabel(item.resource),
      phoneNumber: item.resource.value,
      senderResourceId: item.resource.id,
      value: item.resource.id,
    }))
    .sort(compareSenderOptionDefaults);
}

export function getAlimtalkSenderProfiles(data) {
  return getSenderResourceRows(data, KAKAO_RESOURCE_TYPE)
    .filter(isSendableSenderResourceRow)
    .map((item) => {
      const resource = item.resource;

      return {
        label: formatKakaoSenderLabel(resource),
        plusFriendId: resource.displayName || resource.value,
        senderKey: resource.value,
        senderProfileType: '채널',
        senderResourceId: resource.id,
        value: resource.id,
      };
    });
}

export function getAutomationKakaoSenderProfiles(data) {
  return getAlimtalkSenderProfiles(data);
}

export function getSmsTemplateLookupScopes(data) {
  return getSmsSenderOptions(data).map((option) => ({
    label: option.label,
    senderResourceIds: [option.value],
    type: 'owned',
    value: `sender:${option.value}`,
  }));
}

export function getKakaoTemplateLookupScopes(data) {
  const rows = getSenderResourceRows(data, KAKAO_RESOURCE_TYPE);
  const commonResourceIds = rows
    .filter((item) => isCommonKakaoSenderProfile(item.resource))
    .map((item) => item.resource.id)
    .filter(Boolean);
  const ownedScopes = getAlimtalkSenderProfiles(data)
    .filter((option) => !isCommonKakaoSenderProfile({
      displayName: option.plusFriendId,
      value: option.senderKey,
    }))
    .map((option) => ({
      label: option.label,
      senderResourceIds: [option.value],
      type: 'owned',
      value: `sender:${option.value}`,
    }));
  const scopes = [];

  if (commonResourceIds.length > 0) {
    scopes.push({
      label: '공통 (@비주오 + @publ)',
      senderResourceIds: commonResourceIds,
      type: 'common',
      value: 'common',
    });
  }

  return [...scopes, ...ownedScopes];
}

export function getKakaoTemplateLookupSenderResourceId(data, preferredSenderResourceId) {
  const rows = getSenderResourceRows(data, KAKAO_RESOURCE_TYPE);
  const resources = rows.map((item) => item.resource);
  const preferredRow = rows.find((item) => item.resource.id === preferredSenderResourceId);

  if (preferredRow && isSendableSenderResourceRow(preferredRow)) {
    return preferredRow.resource.id;
  }

  const sendableRow = rows.find(isSendableSenderResourceRow);
  if (sendableRow) {
    return sendableRow.resource.id;
  }

  const userResource = resources.find((resource) => !isCommonKakaoSenderProfile(resource));

  return userResource?.id ?? resources[0]?.id ?? '';
}

export function getResolvedSenderOptionValue(value, options) {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';

  if (normalizedValue && options.some((option) => option.value === normalizedValue)) {
    return normalizedValue;
  }

  return options[0]?.value ?? '';
}

export function getTemplateOptions(data) {
  return Array.isArray(data?.templates) ? data.templates : [];
}

function formatKakaoSenderLabel(resource) {
  if (resource.displayName) {
    return resource.displayName;
  }

  return resource.value || resource.id;
}

export function isCommonKakaoSenderProfile(resource) {
  return [resource.displayName, resource.value]
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .some((value) => COMMON_KAKAO_SENDER_PROFILE_IDENTIFIERS.has(value));
}

function isSendableSenderResourceRow(item) {
  return SENDABLE_SENDER_RESOURCE_ROLES.has(item?.role);
}

function compareSenderOptionDefaults(left, right) {
  if (left.isDefault === right.isDefault) {
    return 0;
  }

  return left.isDefault ? -1 : 1;
}
