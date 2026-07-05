import { describe, expect, it } from 'vitest';

import {
  getAlimtalkSenderProfiles,
  getAutomationKakaoSenderProfiles,
  getKakaoTemplateLookupScopes,
  getKakaoTemplateLookupSenderResourceId,
  getResolvedSenderOptionValue,
  getSmsSenderOptions,
} from '../../features/console/messageSend/mappers.js';
import {
  formatSettingsPhoneNumber,
  formatSettingsSmsSenderLabel,
} from '../../features/console/senderResourceLabels.js';

describe('sender resource labels', () => {
  it('shows an SMS sender number once when displayName is the formatted value', () => {
    expect(formatSettingsSmsSenderLabel({
      displayName: '010-9769-0373',
      id: 'sms_resource_1',
      value: '01097690373',
    })).toBe('010-9769-0373');
  });

  it('keeps a custom SMS display name with the formatted number', () => {
    expect(formatSettingsSmsSenderLabel({
      displayName: '대표 발신번호',
      id: 'sms_resource_1',
      value: '01097690373',
    })).toBe('대표 발신번호 010-9769-0373');
  });

  it('does not append the number when a custom display name already includes it', () => {
    expect(formatSettingsSmsSenderLabel({
      displayName: '대표 010-9769-0373',
      id: 'sms_resource_1',
      value: '01097690373',
    })).toBe('대표 010-9769-0373');
  });

  it('formats common Korean sender number shapes', () => {
    expect(formatSettingsPhoneNumber('01097690373')).toBe('010-9769-0373');
    expect(formatSettingsPhoneNumber('15446859')).toBe('1544-6859');
    expect(formatSettingsPhoneNumber('0212345678')).toBe('02-1234-5678');
  });

  it('shows message-send SMS sender options without duplicate formatted display names', () => {
    expect(getSmsSenderOptions({
      resources: [{
        resource: {
          displayName: '010-9769-0373',
          id: 'sms_resource_1',
          status: 'active',
          type: 'sms_send_no',
          value: '01097690373',
        },
      }],
    })).toEqual([{
      isDefault: true,
      label: '010-9769-0373',
      phoneNumber: '01097690373',
      senderResourceId: 'sms_resource_1',
      value: 'sms_resource_1',
    }]);
  });

  it('orders the default SMS sender first for message-send options', () => {
    expect(getSmsSenderOptions({
      resources: [
        {
          isDefault: false,
          resource: {
            displayName: null,
            id: 'sms_resource_1',
            status: 'active',
            type: 'sms_send_no',
            value: '15446859',
          },
        },
        {
          isDefault: true,
          resource: {
            displayName: null,
            id: 'sms_resource_2',
            status: 'active',
            type: 'sms_send_no',
            value: '01097690373',
          },
        },
      ],
    }).map((option) => option.value)).toEqual(['sms_resource_2', 'sms_resource_1']);
  });

  it('shows sendable Kakao sender profiles even when they match common senders', () => {
    expect(getAlimtalkSenderProfiles(createKakaoSenderResourceData())).toEqual([{
      label: '@비주오',
      plusFriendId: '@비주오',
      senderKey: '2f9e6a06b25c497001400cab5f5f94ca726080b5',
      senderProfileType: '채널',
      senderResourceId: 'kakao_common_visuo',
      value: 'kakao_common_visuo',
    }, {
      label: '@store',
      plusFriendId: '@store',
      senderKey: 'sender-key-store',
      senderProfileType: '채널',
      senderResourceId: 'kakao_store',
      value: 'kakao_store',
    }]);
  });

  it('uses a user Kakao sender as the template lookup resource before common fallbacks', () => {
    expect(getKakaoTemplateLookupSenderResourceId(
      createKakaoSenderResourceData(),
      'kakao_common_publ'
    )).toBe('kakao_common_visuo');

    expect(getKakaoTemplateLookupSenderResourceId(
      createKakaoSenderResourceData(),
      'kakao_common_visuo'
    )).toBe('kakao_common_visuo');

    expect(getKakaoTemplateLookupSenderResourceId(
      createKakaoSenderResourceData(),
      'kakao_store'
    )).toBe('kakao_store');
  });

  it('keeps automation senders role-based while Kakao template lookup keeps common scoped', () => {
    expect(getAutomationKakaoSenderProfiles(createKakaoSenderResourceData()).map((option) => option.value))
      .toEqual(['kakao_common_visuo', 'kakao_store']);

    expect(getKakaoTemplateLookupScopes(createKakaoSenderResourceData())).toEqual([
      {
        label: '공통 (@비주오 + @publ)',
        senderResourceIds: ['kakao_common_visuo', 'kakao_common_publ', 'kakao_common_key_only'],
        type: 'common',
        value: 'common',
      },
      {
        label: '@store',
        senderResourceIds: ['kakao_store'],
        type: 'owned',
        value: 'sender:kakao_store',
      },
    ]);
  });

  it('falls back to a common Kakao sender when no user channel exists for template lookup', () => {
    expect(getKakaoTemplateLookupSenderResourceId({
      resources: [
        {
          resource: {
            displayName: '@publ',
            id: 'kakao_common_publ',
            status: 'active',
            type: 'kakao_sender_key',
            value: '954b4486e661a019badabd5ebe15d7ef7e27cb31',
          },
        },
      ],
    })).toBe('kakao_common_publ');
  });

  it('falls back from stale playground sender profile IDs to active sender resources', () => {
    expect(getResolvedSenderOptionValue('brand-profile-acme', [
      { value: 'kakao_resource_1' },
      { value: 'kakao_resource_2' },
    ])).toBe('kakao_resource_1');

    expect(getResolvedSenderOptionValue('kakao_resource_2', [
      { value: 'kakao_resource_1' },
      { value: 'kakao_resource_2' },
    ])).toBe('kakao_resource_2');

    expect(getResolvedSenderOptionValue('brand-profile-acme', [])).toBe('');
  });
});

function createKakaoSenderResourceData() {
  return {
    resources: [
      {
        role: 'owner',
        status: 'active',
        resource: {
          displayName: '@비주오',
          id: 'kakao_common_visuo',
          status: 'active',
          type: 'kakao_sender_key',
          value: '2f9e6a06b25c497001400cab5f5f94ca726080b5',
        },
      },
      {
        role: 'viewer',
        status: 'active',
        resource: {
          displayName: '@publ',
          id: 'kakao_common_publ',
          status: 'active',
          type: 'kakao_sender_key',
          value: '954b4486e661a019badabd5ebe15d7ef7e27cb31',
        },
      },
      {
        role: 'viewer',
        status: 'active',
        resource: {
          displayName: null,
          id: 'kakao_common_key_only',
          status: 'active',
          type: 'kakao_sender_key',
          value: '954b4486e661a019badabd5ebe15d7ef7e27cb31',
        },
      },
      {
        role: 'sender',
        status: 'active',
        resource: {
          displayName: '@store',
          id: 'kakao_store',
          status: 'active',
          type: 'kakao_sender_key',
          value: 'sender-key-store',
        },
      },
    ],
  };
}
