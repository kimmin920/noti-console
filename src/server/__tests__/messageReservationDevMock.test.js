import { describe, expect, it } from 'vitest';

import {
  createDevMessageReservationMockDependencies,
  isDevMessageReservationsMockQuery,
} from '../messageReservations/devMock.js';
import { createMessageReservationService } from '../messageReservations/service.js';

const RANGE_QUERY = {
  channel: 'all',
  from: '2026-06-06T00:00:00.000Z',
  page: 1,
  pageSize: 20,
  to: '2026-06-12T23:59:59.999Z',
};

describe('message reservation dev mock', () => {
  it('is enabled only outside production by an explicit query flag', () => {
    expect(isDevMessageReservationsMockQuery({ devMockReservations: '1' }, { NODE_ENV: 'development' })).toBe(true);
    expect(isDevMessageReservationsMockQuery({ devMockReservations: 'true' }, { NODE_ENV: 'test' })).toBe(true);
    expect(isDevMessageReservationsMockQuery({ devMockReservations: '0' }, { NODE_ENV: 'development' })).toBe(false);
    expect(isDevMessageReservationsMockQuery({ devMockReservations: '1' }, { NODE_ENV: 'production' })).toBe(false);
  });

  it('lists fake reservation groups across SMS, Alimtalk, and brand message without provider sends', async () => {
    const service = createMockReservationService();
    const result = await service.listReservationGroups({
      actorUserId: 'user_1',
      query: RANGE_QUERY,
    });

    const bulkGroup = result.groups.find((group) => group.groupType === 'bulk_run');
    const completedGroup = result.groups.find((group) => group.representativeRequestId === 'dev-completed-reservation');

    expect(result.groups.map((group) => group.channel)).toEqual(expect.arrayContaining([
      'sms',
      'alimtalk',
      'brand-message',
    ]));
    expect(bulkGroup).toEqual(expect.objectContaining({
      aggregateState: 'reserved',
      managementTitle: '개발 예약 벌크 3개 배치',
      providerRequestCount: 3,
      recipientCount: 12,
    }));
    expect(completedGroup).toEqual(expect.objectContaining({
      aggregateState: 'completed',
      completedCount: 1,
      failedCount: 1,
      recipientCount: 2,
    }));
  });

  it('loads and cancels the fake SMS bulk group by opaque group id', async () => {
    const service = createMockReservationService();
    const listResult = await service.listReservationGroups({
      actorUserId: 'user_1',
      query: RANGE_QUERY,
    });
    const bulkGroup = listResult.groups.find((group) => group.groupType === 'bulk_run');

    const detail = await service.getReservationGroupDetailById({
      actorUserId: 'user_1',
      groupId: bulkGroup.id,
      query: RANGE_QUERY,
    });
    const cancelResult = await service.cancelReservationGroupById({
      actorUserId: 'user_1',
      groupId: bulkGroup.id,
      query: RANGE_QUERY,
    });
    const batchRecipients = await service.getReservationBatchRecipients({
      actorUserId: 'user_1',
      groupId: bulkGroup.id,
      providerRequestId: 'dev-bulk-reservation-2',
      query: {
        ...RANGE_QUERY,
        page: 1,
        pageSize: 2,
      },
    });

    expect(detail.recipients).toEqual([]);
    expect(detail.batches).toEqual([
      expect.objectContaining({
        observedRecipientCount: 4,
        providerRequestId: 'dev-bulk-reservation-1',
        recipientCount: 4,
        sequence: 1,
        totalBatches: 3,
      }),
      expect.objectContaining({
        observedRecipientCount: 4,
        providerRequestId: 'dev-bulk-reservation-2',
        recipientCount: 4,
        sequence: 2,
        totalBatches: 3,
      }),
      expect.objectContaining({
        observedRecipientCount: 4,
        providerRequestId: 'dev-bulk-reservation-3',
        recipientCount: 4,
        sequence: 3,
        totalBatches: 3,
      }),
    ]);
    expect(JSON.stringify(detail.batches)).not.toContain('010');
    expect(batchRecipients).toEqual(expect.objectContaining({
      hasNextPage: true,
      page: 1,
      pageSize: 2,
      total: 4,
    }));
    expect(batchRecipients.recipients).toHaveLength(2);
    expect(batchRecipients.recipients.every((recipient) => recipient.requestId === 'dev-bulk-reservation-2')).toBe(true);
    expect(cancelResult).toEqual(expect.objectContaining({
      canceledCount: 12,
      channel: 'sms',
      requestedCount: 12,
      state: 'canceled',
      targetCount: 12,
    }));
  });

  it('keeps non-SMS cancellation rejected even for mock reservations', async () => {
    const service = createMockReservationService();
    const listResult = await service.listReservationGroups({
      actorUserId: 'user_1',
      query: RANGE_QUERY,
    });
    const alimtalkGroup = listResult.groups.find((group) => group.channel === 'alimtalk');

    await expect(service.cancelReservationGroupById({
      actorUserId: 'user_1',
      groupId: alimtalkGroup.id,
      query: RANGE_QUERY,
    })).rejects.toThrow('Only SMS reservation cancellation is supported.');
  });
});

function createMockReservationService() {
  return createMessageReservationService(
    createDevMessageReservationMockDependencies({
      repository: createBaseRepository(),
    })
  );
}

function createBaseRepository() {
  return {
    async getUserById(userId) {
      if (userId !== 'user_1') return null;

      return {
        email: 'user@example.com',
        id: 'user_1',
        status: 'active',
        userRef: 'user-ref-1',
      };
    },
  };
}
