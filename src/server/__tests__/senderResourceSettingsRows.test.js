import { describe, expect, it } from 'vitest';

import { getSettingsSenderResourceRows } from '../../features/console/senderResourceSettingsRows.js';

describe('sender resource settings rows', () => {
  it('does not show submitted Kakao applications as review-pending resources', () => {
    const rows = getSettingsSenderResourceRows({
      applications: [
        {
          id: 'application_kakao_pending',
          requestedValue: '@bizuo',
          resourceType: 'kakao_sender_key',
          status: 'submitted',
        },
      ],
      resources: [
        {
          id: 'link_kakao_active',
          isDefault: true,
          resource: {
            displayName: '@bizuo',
            providerStatus: 'active',
            status: 'active',
            type: 'kakao_sender_key',
            value: 'sender-key-1',
          },
        },
      ],
    }, 'kakao_sender_key');

    expect(rows).toEqual([
      expect.objectContaining({
        label: '@bizuo',
        linkId: 'link_kakao_active',
        statusLabel: '사용 가능',
      }),
    ]);
    expect(JSON.stringify(rows)).not.toContain('검수 대기');
    expect(JSON.stringify(rows)).not.toContain('application_kakao_pending');
  });

  it('keeps submitted SMS applications visible as review-pending resources', () => {
    const rows = getSettingsSenderResourceRows({
      applications: [
        {
          id: 'application_sms_pending',
          requestedValue: '15446859',
          resourceType: 'sms_send_no',
          senderNumberType: 'company',
          status: 'submitted',
        },
      ],
      resources: [],
    }, 'sms_send_no');

    expect(rows).toEqual([
      expect.objectContaining({
        isPendingApplication: true,
        label: '1544-6859',
        limitLabel: '검수 후 적용',
        statusLabel: '회사번호 · 검수 대기',
      }),
    ]);
  });
});
