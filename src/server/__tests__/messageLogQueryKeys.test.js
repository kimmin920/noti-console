import { describe, expect, it } from 'vitest';

import { messageLogQueryKeys } from '../../features/console/messageLogs/queryKeys.js';

describe('message log query keys', () => {
  it('keeps the disabled detail query safe before a log row is selected', () => {
    expect(() => messageLogQueryKeys.detail(null)).not.toThrow();
    expect(messageLogQueryKeys.detail(null)).toEqual([
      'message-logs',
      'detail',
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('keeps the disabled group detail query safe before a group row is selected', () => {
    expect(() => messageLogQueryKeys.groupDetail(null)).not.toThrow();
    expect(messageLogQueryKeys.groupDetail(null)).toEqual([
      'message-log-groups',
      'detail',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('uses opaque group identity without provider request id arrays', () => {
    const key = messageLogQueryKeys.groupDetail({
      channel: 'sms',
      from: '2026-06-01T00:00:00.000Z',
      groupId: 'opaque-log-group-id',
      providerRequestIds: ['sms-log-request-1', 'sms-log-request-2'],
      to: '2026-06-02T00:00:00.000Z',
    });

    expect(key).toEqual([
      'message-log-groups',
      'detail',
      'opaque-log-group-id',
      'sms',
      undefined,
      '2026-06-01T00:00:00.000Z',
      '2026-06-02T00:00:00.000Z',
    ]);
    expect(JSON.stringify(key)).not.toContain('sms-log-request-1');
    expect(JSON.stringify(key)).not.toContain('sms-log-request-2');
  });

  it('keys request recipient pages by local request id only', () => {
    const key = messageLogQueryKeys.groupRequestRecipients({
      groupId: 'local-group-1',
      page: 1,
      pageSize: 100,
      providerRequestId: 'provider-request-hidden',
      requestLocalId: 'local-request-1',
    });

    expect(key).toEqual([
      'message-log-groups',
      'request-recipients',
      'local-group-1',
      'local-request-1',
      undefined,
      1,
      100,
    ]);
    expect(JSON.stringify(key)).not.toContain('provider-request-hidden');
  });

  it('keys request failure pages by local request id only', () => {
    const key = messageLogQueryKeys.groupRequestFailures({
      groupId: 'local-group-1',
      page: 1,
      pageSize: 100,
      providerRequestId: 'provider-request-hidden',
      requestLocalId: 'local-request-1',
    });

    expect(key).toEqual([
      'message-log-groups',
      'request-failures',
      'local-group-1',
      'local-request-1',
      undefined,
      1,
      100,
    ]);
    expect(JSON.stringify(key)).not.toContain('provider-request-hidden');
  });

  it('keys request recipient detail by local request id and recipient sequence', () => {
    const key = messageLogQueryKeys.groupRequestRecipientDetail({
      groupId: 'local-group-1',
      providerRequestId: 'provider-request-hidden',
      recipientSeq: 7,
      requestLocalId: 'local-request-1',
    });

    expect(key).toEqual([
      'message-log-groups',
      'request-recipient-detail',
      'local-group-1',
      'local-request-1',
      7,
    ]);
    expect(JSON.stringify(key)).not.toContain('provider-request-hidden');
  });
});
