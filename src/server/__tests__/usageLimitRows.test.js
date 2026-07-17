import { describe, expect, it } from 'vitest';

import { buildRequestOptions } from '../../features/console/settings/usageLimitRows.js';

describe('usage limit request options', () => {
  it('creates one channel-wide Kakao request option per sender resource', () => {
    const requestOptions = buildRequestOptions({
      smsResources: [
        {
          senderResourceId: 'sms_resource_1',
          resource: { quotaLimit: 1000, value: '0212345678' },
        },
      ],
      kakaoResources: [
        {
          senderResourceId: 'kakao_resource_1',
          resource: { displayName: '스토어 채널', quotaLimit: 1000, value: 'sender_key_1' },
        },
        {
          senderResourceId: 'kakao_resource_2',
          resource: { displayName: '프로모션 채널', quotaLimit: 3000, value: 'sender_key_2' },
        },
      ],
    });

    expect(requestOptions).toHaveLength(3);
    expect(requestOptions).toEqual([
      expect.objectContaining({
        channel: 'sms',
        currentLimit: 1000,
        senderResourceId: 'sms_resource_1',
        value: 'sms:sms_resource_1',
      }),
      expect.objectContaining({
        channel: 'kakao',
        currentLimit: 1000,
        label: '카카오 채널 · 스토어 채널',
        senderResourceId: 'kakao_resource_1',
        value: 'kakao:kakao_resource_1',
      }),
      expect.objectContaining({
        channel: 'kakao',
        currentLimit: 3000,
        label: '카카오 채널 · 프로모션 채널',
        senderResourceId: 'kakao_resource_2',
        value: 'kakao:kakao_resource_2',
      }),
    ]);
  });
});
