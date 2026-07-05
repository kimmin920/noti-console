import { describe, expect, it } from 'vitest';

import { messageReservationQueryKeys } from '../../features/console/messageReservations/queryKeys.js';

describe('message reservation query keys', () => {
  it('keeps the disabled group detail query safe before a reservation group is selected', () => {
    expect(() => messageReservationQueryKeys.groupDetail(null)).not.toThrow();
    expect(messageReservationQueryKeys.groupDetail(null)).toEqual([
      'message-reservation-groups',
      'detail',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('uses opaque group identity without provider request id arrays', () => {
    const key = messageReservationQueryKeys.groupDetail({
      channel: 'sms',
      from: '2026-06-06T00:00:00.000Z',
      groupId: 'opaque-group-id',
      providerRequestIds: ['sms-request-1', 'sms-request-2'],
      to: '2026-06-12T23:59:59.999Z',
      devMockReservations: '1',
    });

    expect(key).toEqual([
      'message-reservation-groups',
      'detail',
      'opaque-group-id',
      'sms',
      '2026-06-06T00:00:00.000Z',
      '2026-06-12T23:59:59.999Z',
      '1',
    ]);
    expect(JSON.stringify(key)).not.toContain('sms-request-1');
    expect(JSON.stringify(key)).not.toContain('sms-request-2');
  });
});
