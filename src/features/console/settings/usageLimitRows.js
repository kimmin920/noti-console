import { formatLimitCount, getLimitRequestChannelLabel } from './limitIncreaseRequestLabels.js';

const KAKAO_SENDER_RESOURCE_TYPE = 'kakao_sender_key';
const KAKAO_DAILY_LIMIT = 1000;

export function getSmsLimitRows(smsQuota, loading) {
  if (loading) {
    return [
      { id: 'sms-loading', detail: '현재 월 quota 확인', label: '월 한도', value: '불러오는 중' },
    ];
  }

  return [
    {
      id: 'sms-monthly-limit',
      detail: '사용자 기준 월 단위',
      label: '월 한도',
      value: smsQuota ? formatLimitCount(smsQuota.limit, { cadence: '월' }) : '월 단위 한도 미설정',
    },
    {
      id: 'sms-monthly-usage',
      detail: '발송 완료와 예약을 합산',
      label: '이번 달 사용량',
      value: smsQuota
        ? `${formatLimitCount((smsQuota.consumed ?? 0) + (smsQuota.reserved ?? 0))} / ${formatLimitCount(smsQuota.limit)}`
        : '-',
    },
  ];
}

export function getKakaoLimitRows(kakaoResources, loading) {
  if (loading) {
    return [{ id: 'kakao-loading', detail: '카카오 채널 확인', label: '채널별 한도', value: '불러오는 중' }];
  }

  if (kakaoResources.length === 0) {
    return [{
      id: 'kakao-empty',
      detail: '발신 수단 관리에서 카카오 비즈채널을 연결하세요.',
      label: '카카오 채널 없음',
      value: '일 1,000건',
    }];
  }

  return kakaoResources.flatMap((resource) => {
    const label = resource.resource.displayName || resource.resource.value;
    return [
      { id: `${resource.senderResourceId}-alimtalk`, detail: '채널별 일 한도', label: `${label} · 알림톡`, value: '일 1,000건' },
      { id: `${resource.senderResourceId}-brand`, detail: '채널별 일 한도', label: `${label} · 브랜드메시지`, value: '일 1,000건' },
    ];
  });
}

export function buildRequestOptions({ kakaoResources, smsQuota }) {
  const smsLimit = smsQuota?.limit ?? null;

  return [
    {
      cadence: '월',
      channel: 'sms',
      currentLimit: smsLimit,
      detail: '문자 사용자 월 단위 한도',
      label: '문자 월 한도',
      senderResourceId: null,
      value: 'sms',
    },
    ...kakaoResources.flatMap((resource) => {
      const label = resource.resource.displayName || resource.resource.value;
      const senderResourceId = resource.senderResourceId;
      return [
        {
          cadence: '일',
          channel: 'alimtalk',
          currentLimit: KAKAO_DAILY_LIMIT,
          detail: `${label} 채널별 알림톡 일 한도`,
          label: `${getLimitRequestChannelLabel('alimtalk')} · ${label}`,
          senderResourceId,
          value: `alimtalk:${senderResourceId}`,
        },
        {
          cadence: '일',
          channel: 'brand-message',
          currentLimit: KAKAO_DAILY_LIMIT,
          detail: `${label} 채널별 브랜드메시지 일 한도`,
          label: `${getLimitRequestChannelLabel('brand-message')} · ${label}`,
          senderResourceId,
          value: `brand-message:${senderResourceId}`,
        },
      ];
    }),
  ];
}

export function getActiveKakaoResources(senderResourcesData) {
  return (senderResourcesData?.resources ?? []).filter((resource) => (
    resource.status === 'active'
    && resource.resource?.status === 'active'
    && resource.resource?.type === KAKAO_SENDER_RESOURCE_TYPE
  ));
}
