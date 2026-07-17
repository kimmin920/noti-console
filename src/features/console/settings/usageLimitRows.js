import { formatLimitCount, getLimitRequestChannelLabel } from './limitIncreaseRequestLabels.js';
import { formatSettingsPhoneNumber } from '../senderResourceLabels.js';

const SMS_SENDER_RESOURCE_TYPE = 'sms_send_no';
const KAKAO_SENDER_RESOURCE_TYPE = 'kakao_sender_key';

export function buildRequestOptions({ kakaoResources, smsResources }) {
  return [
    ...smsResources.map((resource) => ({
      cadence: '월',
      channel: 'sms',
      currentLimit: resource.resource.quotaLimit,
      detail: `${formatSettingsPhoneNumber(resource.resource.value)} 발신번호의 월 한도`,
      label: `문자 · ${formatSettingsPhoneNumber(resource.resource.value)}`,
      senderResourceId: resource.senderResourceId,
      value: `sms:${resource.senderResourceId}`,
    })),
    ...kakaoResources.map((resource) => {
      const label = resource.resource.displayName || resource.resource.value;
      const senderResourceId = resource.senderResourceId;
      return {
        cadence: '일',
        channel: 'kakao',
        currentLimit: resource.resource.quotaLimit,
        detail: `${label} 채널의 알림톡·브랜드메시지 일 한도`,
        label: `${getLimitRequestChannelLabel('kakao')} · ${label}`,
        senderResourceId,
        value: `kakao:${senderResourceId}`,
      };
    }),
  ];
}

export function getActiveKakaoResources(senderResourcesData) {
  return getActiveSenderResources(senderResourcesData, KAKAO_SENDER_RESOURCE_TYPE);
}

export function getActiveSmsResources(senderResourcesData) {
  return getActiveSenderResources(senderResourcesData, SMS_SENDER_RESOURCE_TYPE);
}

function getActiveSenderResources(senderResourcesData, type) {
  return (senderResourcesData?.resources ?? []).filter((resource) => (
    resource.status === 'active'
    && resource.resource?.status === 'active'
    && resource.resource?.type === type
  ));
}
