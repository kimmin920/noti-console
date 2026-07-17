import { describe, expect, it, vi } from 'vitest';

import { createMessageReservationService } from '../messageReservations/service.js';
import { CHANNELS, SENDER_RESOURCE_TYPES } from '../relay/constants.js';
import {
  buildRecipientGroupingKey,
  buildSenderGroupingKey,
} from '../relay/groupingKeys.js';

const FIXED_NOW = new Date('2026-06-06T00:00:00.000Z');

describe('message reservation proxy', () => {
  it('groups SMS reservations by requestId for an authorized sender resource', async () => {
    const smsClient = createSmsClient({
      listReservations: vi.fn(async () => ({
        body: {
          data: [
            createReservation({ recipientSeq: 1, recipientNo: '01011112222' }),
            createReservation({ recipientSeq: 2, recipientNo: '01033334444' }),
            createReservation({
              recipientSeq: 3,
              recipientNo: '01099998888',
              senderGroupingKey: senderGroupingKey({ userRef: 'other' }),
            }),
          ],
          pageNum: 1,
          pageSize: 1000,
          totalCount: 2,
        },
      })),
    });
    const service = createTestService({ smsClient });

    const result = await service.listReservationGroups({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-06T00:00:00.000Z',
        to: '2026-06-12T23:59:59.999Z',
        page: '1',
        pageSize: '20',
      },
    });

    expect(smsClient.listReservations).toHaveBeenCalledWith(
      expect.objectContaining({
        sendNo: '15446859',
        startRequestDate: '2026-06-06 09:00:00',
        endRequestDate: '2026-06-13 08:59:59',
      })
    );
    expect(result).toMatchObject({
      channel: CHANNELS.SMS,
      total: 1,
      groups: [
        {
          aggregateState: 'reserved',
          channel: CHANNELS.SMS,
          contentPreview: 'Reservation body',
          senderResourceId: 'sms_resource_1',
          recipientCount: 2,
          requestDate: '2026-06-07 10:00:00',
          requestId: 'reservation-request-1',
          reservedCount: 2,
          senderLabel: 'Main SMS',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('01011112222');
  });

  it('groups SMS bulk reservations by local run id before paginating', async () => {
    const repository = createMemoryRepository({
      bulkMappings: createBulkMappings({
        managementSendName: 'June bulk reservation',
        providerRequestIds: ['sms-bulk-request-1', 'sms-bulk-request-2', 'sms-bulk-request-3'],
        requestDate: '2026-06-07 10:00',
        totalRecipients: 3000,
      }),
    });
    const smsClient = createSmsClient({
      listReservations: vi.fn(async ({ pageNum }) => ({
        body: {
          data: Array.from({ length: 1000 }, (_, index) =>
            createReservation({
              body: `Bulk body page ${pageNum}`,
              recipientSeq: index + 1,
              requestId: `sms-bulk-request-${pageNum}`,
            })
          ),
          pageNum,
          pageSize: 1000,
          totalCount: 3000,
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.listReservationGroups({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-06T00:00:00.000Z',
        to: '2026-06-12T23:59:59.999Z',
        page: '1',
        pageSize: '20',
      },
    });

    expect(result).toMatchObject({
      total: 1,
      groups: [
        {
          groupType: 'bulk_run',
          bulkRunId: 'bulk_run_1',
          managementTitle: 'June bulk reservation',
          providerRequestCount: 3,
          recipientCount: 3000,
          requestDate: '2026-06-07 10:00:00',
        },
      ],
    });
    expect(result.groups[0].id).toEqual(expect.any(String));
    expect(result.groups[0].id).not.toContain('bulk_run_1');
    expect(result.groups[0].id).not.toContain('sms-bulk-request');
    expect(result.groups[0]).not.toHaveProperty('providerRequestIds');
    expect(JSON.stringify(result)).not.toContain('bulk:');
  });

  it('aggregates mapped bulk reservation states and keeps unmapped rows separate', async () => {
    const repository = createMemoryRepository({
      bulkMappings: new Map([
        ...createBulkMappings({
          managementSendName: 'Finished bulk reservation',
          providerRequestIds: ['sms-bulk-finished-1', 'sms-bulk-finished-2', 'sms-bulk-finished-3'],
          requestDate: '2026-06-07 11:00',
          totalRecipients: 3,
        }),
        ...createBulkMappings({
          managementSendName: 'Other actor reservation title',
          providerRequestIds: ['sms-other-actor-run'],
          requestDate: '2026-06-07 12:00',
          runId: 'bulk_run_other_actor',
          totalRecipients: 1,
          userId: 'user_2',
        }),
      ]),
    });
    const smsClient = createSmsClient({
      listReservations: vi.fn(async () => ({
        body: {
          data: [
            createReservation({ messageStatus: 'COMPLETED', recipientSeq: 1, requestId: 'sms-bulk-finished-1' }),
            createReservation({ messageStatus: 'FAILED', recipientSeq: 2, requestId: 'sms-bulk-finished-2' }),
            createReservation({ messageStatus: 'CANCEL', recipientSeq: 3, requestId: 'sms-bulk-finished-3' }),
            createReservation({ recipientSeq: 4, requestId: 'sms-unmapped-reservation' }),
            createReservation({ recipientSeq: 5, requestId: 'sms-other-actor-run' }),
          ],
          pageNum: 1,
          pageSize: 1000,
          totalCount: 5,
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.listReservationGroups({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-06T00:00:00.000Z',
        to: '2026-06-12T23:59:59.999Z',
        page: '1',
        pageSize: '20',
      },
    });
    const bulkGroup = result.groups.find((group) => group.groupType === 'bulk_run');
    const providerRequestIds = result.groups
      .filter((group) => group.groupType === 'provider_request')
      .map((group) => group.requestId);

    expect(result.total).toBe(3);
    expect(bulkGroup).toMatchObject({
      aggregateState: 'completed',
      canceledCount: 1,
      completedCount: 1,
      failedCount: 1,
      groupType: 'bulk_run',
      managementTitle: 'Finished bulk reservation',
      providerRequestCount: 3,
      recipientCount: 3,
    });
    expect(providerRequestIds).toEqual(expect.arrayContaining([
      'sms-other-actor-run',
      'sms-unmapped-reservation',
    ]));
    expect(JSON.stringify(result)).not.toContain('Other actor reservation title');
  });

  it('includes SMS reservations without grouping keys when they match an authorized sender number', async () => {
    const smsClient = createSmsClient({
      listReservations: vi.fn(async () => ({
        body: {
          data: [
            createReservation({
              recipientNo: '01011112222',
              recipientSeq: 1,
              recipientGroupingKey: undefined,
              senderGroupingKey: undefined,
            }),
            createReservation({
              recipientNo: '01099998888',
              recipientSeq: 2,
              recipientGroupingKey: undefined,
              sendNo: '01099998888',
              senderGroupingKey: undefined,
            }),
          ],
          pageNum: 1,
          pageSize: 1000,
          totalCount: 2,
        },
      })),
    });
    const service = createTestService({ smsClient });

    const result = await service.listReservationGroups({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-06T00:00:00.000Z',
        to: '2026-06-12T23:59:59.999Z',
        page: '1',
        pageSize: '20',
      },
    });

    expect(result).toMatchObject({
      total: 1,
      groups: [
        {
          channel: CHANNELS.SMS,
          recipientCount: 1,
          requestId: 'reservation-request-1',
          senderResourceId: 'sms_resource_1',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('01099998888');
  });

  it('loads one reservation group as recipient rows by requestId', async () => {
    const smsClient = createSmsClient({
      listReservations: vi.fn(async () => ({
        body: {
          data: [
            createReservation({ recipientSeq: 1, recipientNo: '01011112222' }),
            createReservation({ recipientSeq: 2, recipientNo: '01033334444', messageStatus: 'CANCEL' }),
          ],
          pageNum: 1,
          pageSize: 1000,
          totalCount: 2,
        },
      })),
    });
    const service = createTestService({ smsClient });

    const result = await service.getReservationGroupDetail({
      actorUserId: 'user_1',
      requestId: 'reservation-request-1',
      query: { channel: CHANNELS.SMS, senderResourceId: 'sms_resource_1' },
    });

    expect(smsClient.listReservations).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'reservation-request-1',
        sendNo: '15446859',
      })
    );
    expect(result).toMatchObject({
      batches: [],
      group: {
        aggregateState: 'reserved',
        canceledCount: 1,
        recipientCount: 2,
        requestId: 'reservation-request-1',
        reservedCount: 1,
      },
      recipients: [
        {
          recipientNo: '01011112222',
          recipientSeq: 1,
          status: 'RESERVED',
        },
        {
          recipientNo: '01033334444',
          recipientSeq: 2,
          status: 'CANCEL',
        },
      ],
    });
  });

  it('cancels every reserved recipient in one requestId group', async () => {
    const mergeProviderRequestResultSnapshotByProviderRequestId = vi.fn(async () => ({}));
    const repository = createMemoryRepository({ mergeProviderRequestResultSnapshotByProviderRequestId });
    const smsClient = createSmsClient({
      cancelReservations: vi.fn(async () => ({
        body: {
          data: {
            canceledCount: 2,
            requestedCount: 2,
          },
        },
      })),
      listReservations: vi.fn(async () => ({
        body: {
          data: [
            createReservation({ recipientSeq: 1, recipientNo: '01011112222' }),
            createReservation({ recipientSeq: 2, recipientNo: '01033334444' }),
            createReservation({ recipientSeq: 3, recipientNo: '01055556666', messageStatus: 'CANCEL' }),
          ],
          pageNum: 1,
          pageSize: 1000,
          totalCount: 3,
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.cancelReservationGroup({
      actorUserId: 'user_1',
      requestId: 'reservation-request-1',
      query: { channel: CHANNELS.SMS, senderResourceId: 'sms_resource_1' },
    });

    expect(smsClient.listReservations).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'reservation-request-1',
        sendNo: '15446859',
      })
    );
    expect(smsClient.cancelReservations).toHaveBeenCalledWith({
      reservationList: [
        { recipientSeq: 1, requestId: 'reservation-request-1' },
        { recipientSeq: 2, requestId: 'reservation-request-1' },
      ],
      updateUser: 'u1ref',
    });
    expect(result).toMatchObject({
      canceledCount: 2,
      channel: CHANNELS.SMS,
      requestedCount: 2,
      requestId: 'reservation-request-1',
      skippedCount: 1,
      state: 'canceled',
    });
    expect(mergeProviderRequestResultSnapshotByProviderRequestId).toHaveBeenCalledWith({
      authoritative: true,
      now: FIXED_NOW,
      providerRequestId: 'reservation-request-1',
      results: [
        { recipientSeq: 1, resultCode: 'RESERVATION_CANCELED', state: 'C' },
        { recipientSeq: 2, resultCode: 'RESERVATION_CANCELED', state: 'C' },
      ],
    });
  });

  it('loads and cancels a bulk reservation group by opaque group id', async () => {
    const repository = createMemoryRepository({
      bulkMappings: new Map([
        ...createBulkMappings({
          managementSendName: 'Grouped cancel title',
          providerRequestIds: ['sms-bulk-cancel-1', 'sms-bulk-cancel-2', 'sms-bulk-cancel-3'],
          requestDate: '2026-06-07 10:00',
          totalRecipients: 3,
        }),
        ...createBulkMappings({
          managementSendName: 'Other grouped title',
          providerRequestIds: ['sms-bulk-cancel-other'],
          requestDate: '2026-06-07 10:00',
          runId: 'bulk_run_2',
          totalRecipients: 1,
        }),
      ]),
    });
    const smsClient = createSmsClient({
      cancelReservations: vi.fn(async () => ({
        body: { data: { canceledCount: 3, requestedCount: 3 } },
      })),
      listReservations: vi.fn(async () => ({
        body: {
          data: [
            createReservation({ recipientSeq: 1, requestId: 'sms-bulk-cancel-1' }),
            createReservation({ recipientSeq: 2, requestId: 'sms-bulk-cancel-2' }),
            createReservation({ recipientSeq: 3, requestId: 'sms-bulk-cancel-3' }),
            createReservation({ recipientSeq: 4, requestId: 'sms-bulk-cancel-other' }),
          ],
          pageNum: 1,
          pageSize: 1000,
          totalCount: 4,
        },
      })),
    });
    const service = createTestService({ repository, smsClient });
    const list = await service.listReservationGroups({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-06T00:00:00.000Z',
        to: '2026-06-12T23:59:59.999Z',
      },
    });
    const group = list.groups.find((item) => item.managementTitle === 'Grouped cancel title');

    const detail = await service.getReservationGroupDetailById({
      actorUserId: 'user_1',
      groupId: group.id,
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-06T00:00:00.000Z',
        to: '2026-06-12T23:59:59.999Z',
      },
    });
    const cancel = await service.cancelReservationGroupById({
      actorUserId: 'user_1',
      groupId: group.id,
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-06T00:00:00.000Z',
        to: '2026-06-12T23:59:59.999Z',
      },
    });
    const batchRecipients = await service.getReservationBatchRecipients({
      actorUserId: 'user_1',
      groupId: group.id,
      providerRequestId: 'sms-bulk-cancel-2',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-06T00:00:00.000Z',
        page: 1,
        pageSize: 1,
        to: '2026-06-12T23:59:59.999Z',
      },
    });

    expect(detail).toMatchObject({
      batches: [
        {
          aggregateState: 'reserved',
          observedRecipientCount: 1,
          providerRequestId: 'sms-bulk-cancel-1',
          recipientCount: 1,
          reservedCount: 1,
          sequence: 1,
          successRate: null,
          totalBatches: 3,
        },
        {
          aggregateState: 'reserved',
          observedRecipientCount: 1,
          providerRequestId: 'sms-bulk-cancel-2',
          recipientCount: 1,
          reservedCount: 1,
          sequence: 2,
          successRate: null,
          totalBatches: 3,
        },
        {
          aggregateState: 'reserved',
          observedRecipientCount: 1,
          providerRequestId: 'sms-bulk-cancel-3',
          recipientCount: 1,
          reservedCount: 1,
          sequence: 3,
          successRate: null,
          totalBatches: 3,
        },
      ],
      group: {
        id: group.id,
        groupType: 'bulk_run',
        managementTitle: 'Grouped cancel title',
        recipientCount: 3,
      },
      recipients: [],
    });
    expect(JSON.stringify(detail)).not.toContain('sms-bulk-cancel-other');
    expect(JSON.stringify(detail)).not.toContain('01000000000');
    expect(batchRecipients).toMatchObject({
      batch: {
        providerRequestId: 'sms-bulk-cancel-2',
        sequence: 2,
      },
      page: 1,
      pageSize: 1,
      recipients: [
        { requestId: 'sms-bulk-cancel-2', recipientSeq: 2 },
      ],
      total: 1,
    });
    expect(smsClient.cancelReservations).toHaveBeenCalledWith({
      reservationList: [
        { recipientSeq: 1, requestId: 'sms-bulk-cancel-1' },
        { recipientSeq: 2, requestId: 'sms-bulk-cancel-2' },
        { recipientSeq: 3, requestId: 'sms-bulk-cancel-3' },
      ],
      updateUser: 'u1ref',
    });
    expect(cancel).toMatchObject({
      canceledCount: 3,
      groupId: group.id,
      state: 'canceled',
    });
    expect(JSON.stringify(cancel)).not.toContain('sms-bulk-cancel-other');
  });

  it('rejects a group cancellation when no reserved recipients remain', async () => {
    const smsClient = createSmsClient({
      cancelReservations: vi.fn(),
      listReservations: vi.fn(async () => ({
        body: {
          data: [
            createReservation({ messageStatus: 'CANCEL', recipientSeq: 1 }),
            createReservation({ messageStatus: 'COMPLETED', recipientSeq: 2 }),
          ],
          pageNum: 1,
          pageSize: 1000,
          totalCount: 2,
        },
      })),
    });
    const service = createTestService({ smsClient });

    await expect(
      service.cancelReservationGroup({
        actorUserId: 'user_1',
        requestId: 'reservation-request-1',
        query: { channel: CHANNELS.SMS, senderResourceId: 'sms_resource_1' },
      })
    ).rejects.toMatchObject({
      message: 'No cancelable reserved recipients were found.',
      status: 400,
    });
    expect(smsClient.cancelReservations).not.toHaveBeenCalled();
  });

  it('does not allow viewer role to cancel reservation groups', async () => {
    const repository = createMemoryRepository();
    repository.links[0] = { ...repository.links[0], role: 'viewer' };
    const smsClient = createSmsClient({
      cancelReservations: vi.fn(),
      listReservations: vi.fn(),
    });
    const service = createTestService({ repository, smsClient });

    await expect(
      service.cancelReservationGroup({
        actorUserId: 'user_1',
        requestId: 'reservation-request-1',
        query: { channel: CHANNELS.SMS, senderResourceId: 'sms_resource_1' },
      })
    ).rejects.toMatchObject({
      status: 403,
    });
    expect(smsClient.cancelReservations).not.toHaveBeenCalled();
  });

  it('aggregates all supported channels before paginating reservation groups', async () => {
    const smsClient = createSmsClient({
      listReservations: vi.fn(async () => ({
        body: {
          data: [createReservation({ requestDate: '2026-06-07 10:00:00' })],
          pageNum: 1,
          pageSize: 1000,
          totalCount: 1,
        },
      })),
    });
    const kakaoClient = createKakaoClient({
      listAlimtalkMessages: vi.fn(async () => kakaoMessagePage([
        createKakaoMessage({
          channel: CHANNELS.ALIMTALK,
          requestDate: '2026-06-07 11:00',
          requestId: 'alimtalk-request-1',
        }),
      ])),
      listBrandMessages: vi.fn(async () => kakaoMessagePage([
        createKakaoMessage({
          channel: CHANNELS.BRAND_MESSAGE,
          requestDate: '2026-06-07 12:00',
          requestId: 'brand-request-1',
        }),
      ])),
    });
    const service = createTestService({ kakaoClient, smsClient });

    const result = await service.listReservationGroups({
      actorUserId: 'user_1',
      query: {
        channel: 'all',
        from: '2026-06-06T00:00:00.000Z',
        to: '2026-06-12T23:59:59.999Z',
        page: '1',
        pageSize: '2',
      },
    });

    expect(smsClient.listReservations).toHaveBeenCalledWith(expect.objectContaining({
      endRequestDate: '2026-06-13 08:59:59',
      sendNo: '15446859',
      startRequestDate: '2026-06-06 09:00:00',
    }));
    expect(kakaoClient.listAlimtalkMessages).toHaveBeenCalledWith(expect.objectContaining({
      endRequestDate: '2026-06-13 08:59',
      senderKey: 'kakao-sender-key',
      startRequestDate: '2026-06-06 09:00',
    }));
    expect(kakaoClient.listBrandMessages).toHaveBeenCalledWith(expect.objectContaining({
      endRequestDate: '2026-06-13 08:59',
      senderKey: 'kakao-sender-key',
      startRequestDate: '2026-06-06 09:00',
    }));
    expect(result).toMatchObject({
      channel: 'all',
      hasNextPage: true,
      total: 3,
      groups: [
        { channel: CHANNELS.SMS, requestId: 'reservation-request-1', senderResourceId: 'sms_resource_1' },
        { channel: CHANNELS.ALIMTALK, requestId: 'alimtalk-request-1', senderResourceId: 'kakao_resource_1' },
      ],
    });
  });

  it('loads all-tab details by channel and sender resource identity', async () => {
    const smsClient = createSmsClient({ listReservations: vi.fn() });
    const kakaoClient = createKakaoClient({
      listAlimtalkMessages: vi.fn(async () => kakaoMessagePage([
        createKakaoMessage({
          channel: CHANNELS.ALIMTALK,
          requestId: 'shared-request-id',
        }),
      ])),
      listBrandMessages: vi.fn(async () => kakaoMessagePage([
        createKakaoMessage({
          channel: CHANNELS.BRAND_MESSAGE,
          requestId: 'shared-request-id',
        }),
      ])),
    });
    const service = createTestService({ kakaoClient, smsClient });

    const result = await service.getReservationGroupDetail({
      actorUserId: 'user_1',
      requestId: 'shared-request-id',
      query: {
        channel: CHANNELS.BRAND_MESSAGE,
        senderResourceId: 'kakao_resource_1',
      },
    });

    expect(smsClient.listReservations).not.toHaveBeenCalled();
    expect(result.group).toMatchObject({
      channel: CHANNELS.BRAND_MESSAGE,
      requestId: 'shared-request-id',
      senderResourceId: 'kakao_resource_1',
    });
  });

  it('rejects reserved alimtalk cancellation until non-SMS cancel endpoint support is confirmed', async () => {
    const kakaoClient = createKakaoClient({
      cancelAlimtalkMessages: vi.fn(async () => ({ header: { isSuccessful: true } })),
      listAlimtalkMessages: vi.fn(async () => kakaoMessagePage([
        createKakaoMessage({ channel: CHANNELS.ALIMTALK, recipientSeq: 1 }),
        createKakaoMessage({ channel: CHANNELS.ALIMTALK, recipientSeq: 2 }),
        createKakaoMessage({ channel: CHANNELS.ALIMTALK, messageStatus: 'CANCEL', recipientSeq: 3 }),
      ])),
    });
    const service = createTestService({ kakaoClient });

    await expect(
      service.cancelReservationGroup({
        actorUserId: 'user_1',
        requestId: 'reservation-request-1',
        query: { channel: CHANNELS.ALIMTALK, senderResourceId: 'kakao_resource_1' },
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(kakaoClient.cancelAlimtalkMessages).not.toHaveBeenCalled();
  });

  it('rejects reserved brand message cancellation until non-SMS cancel endpoint support is confirmed', async () => {
    const kakaoClient = createKakaoClient({
      cancelBrandMessages: vi.fn(async () => ({ header: { isSuccessful: true } })),
      listBrandMessages: vi.fn(async () => kakaoMessagePage([
        createKakaoMessage({ channel: CHANNELS.BRAND_MESSAGE, recipientSeq: 4 }),
      ])),
    });
    const service = createTestService({ kakaoClient });

    await expect(
      service.cancelReservationGroup({
        actorUserId: 'user_1',
        requestId: 'reservation-request-1',
        query: { channel: CHANNELS.BRAND_MESSAGE, senderResourceId: 'kakao_resource_1' },
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(kakaoClient.cancelBrandMessages).not.toHaveBeenCalled();
  });

  it('rejects group-id alimtalk cancellation until non-SMS cancel endpoint support is confirmed', async () => {
    const kakaoClient = createKakaoClient({
      cancelAlimtalkMessages: vi.fn(async () => ({ header: { isSuccessful: true } })),
      listAlimtalkMessages: vi.fn(async () => kakaoMessagePage([
        createKakaoMessage({ channel: CHANNELS.ALIMTALK, recipientSeq: 1 }),
      ])),
    });
    const service = createTestService({ kakaoClient });
    const query = {
      channel: CHANNELS.ALIMTALK,
      from: '2026-06-06T00:00:00.000Z',
      to: '2026-06-12T23:59:59.999Z',
    };
    const list = await service.listReservationGroups({
      actorUserId: 'user_1',
      query,
    });

    await expect(
      service.cancelReservationGroupById({
        actorUserId: 'user_1',
        groupId: list.groups[0].id,
        query,
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(kakaoClient.cancelAlimtalkMessages).not.toHaveBeenCalled();
  });
});

function createTestService({
  kakaoClient = createKakaoClient(),
  repository = createMemoryRepository(),
  smsClient = createSmsClient(),
} = {}) {
  return createMessageReservationService({
    kakaoClient,
    now: () => FIXED_NOW,
    repository,
    smsClient,
  });
}

function createMemoryRepository(overrides = {}) {
  return {
    billingAccounts: [
      {
        billingRef: 'b1ref',
        id: 'billing_1',
        ownerId: 'user_1',
        ownerType: 'user',
        status: 'active',
      },
    ],
    links: [
      {
        billingAccountId: 'billing_1',
        id: 'sms_link_1',
        isDefault: false,
        role: 'sender',
        senderResourceId: 'sms_resource_1',
        status: 'active',
        userId: 'user_1',
      },
      {
        billingAccountId: 'billing_1',
        id: 'kakao_link_1',
        isDefault: false,
        role: 'sender',
        senderResourceId: 'kakao_resource_1',
        status: 'active',
        userId: 'user_1',
      },
    ],
    resources: [
      {
        displayName: 'Main SMS',
        id: 'sms_resource_1',
        provider: 'nhn',
        providerStatus: 'approved',
        resourceRef: 'smsref1',
        status: 'active',
        type: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
        value: '15446859',
      },
      {
        displayName: 'Main Kakao',
        id: 'kakao_resource_1',
        provider: 'nhn',
        providerStatus: 'approved',
        resourceRef: 'kakaoref1',
        status: 'active',
        type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
        value: 'kakao-sender-key',
      },
    ],
    users: [
      {
        email: 'user@example.com',
        id: 'user_1',
        isOperator: false,
        status: 'active',
        userRef: 'u1ref',
      },
    ],
    bulkMappings: overrides.bulkMappings ?? new Map(),
    ...(overrides.mergeProviderRequestResultSnapshotByProviderRequestId
      ? {
          mergeProviderRequestResultSnapshotByProviderRequestId:
            overrides.mergeProviderRequestResultSnapshotByProviderRequestId,
        }
      : {}),
    async findBillingAccountForUser(userId) {
      return this.billingAccounts.find((item) => item.ownerType === 'user' && item.ownerId === userId) ?? null;
    },
    async getBillingAccountById(billingAccountId) {
      return this.billingAccounts.find((item) => item.id === billingAccountId) ?? null;
    },
    async getUserById(userId) {
      return this.users.find((user) => user.id === userId) ?? null;
    },
    async listUserSenderResources(userId) {
      return this.links
        .filter((link) => link.userId === userId)
        .map((link) => ({
          link,
          resource: this.resources.find((resource) => resource.id === link.senderResourceId),
        }));
    },
    async findSmsBulkRunMappingsByProviderRequestIds({ actorUserId, providerRequestIds, senderResourceId }) {
      const ids = [...new Set(providerRequestIds.filter((value) => typeof value === 'string' && value.trim()))];
      const mappings = new Map();

      for (const id of ids) {
        const mapping = this.bulkMappings.get(id);
        if (
          mapping?.run?.userId === actorUserId
          && (!senderResourceId || mapping.run.senderResourceId === senderResourceId)
        ) {
          mappings.set(id, mapping);
        }
      }

      return mappings;
    },
    async listSmsBulkBatchesForActor({ actorUserId, runId, senderResourceId }) {
      return Array.from(this.bulkMappings.values())
        .filter((mapping) =>
          mapping?.run?.id === runId
          && mapping.run.userId === actorUserId
          && (!senderResourceId || mapping.run.senderResourceId === senderResourceId)
        )
        .map((mapping) => ({
          errorCode: mapping.batch.errorCode ?? null,
          errorMessage: mapping.batch.errorMessage ?? null,
          errorState: mapping.batch.errorState ?? null,
          id: mapping.batch.id,
          providerRequestId: mapping.batch.providerRequestId,
          recipientCount: mapping.batch.recipientCount,
          requestDate: mapping.run.requestDate,
          runId: mapping.batch.runId,
          sequence: mapping.batch.sequence,
          status: mapping.batch.status,
          totalBatches: mapping.run.totalBatches,
        }))
        .sort((left, right) => left.sequence - right.sequence);
    },
  };
}

function createBulkMappings({
  managementSendName,
  providerRequestIds,
  requestDate,
  runId = 'bulk_run_1',
  senderResourceId = 'sms_resource_1',
  totalRecipients,
  userId = 'user_1',
}) {
  return new Map(providerRequestIds.map((providerRequestId, index) => [
    providerRequestId,
    {
      batch: {
        id: `bulk_batch_${index + 1}`,
        providerRequestId,
        recipientCount: Math.floor(totalRecipients / providerRequestIds.length),
        runId,
        sequence: index + 1,
        status: 'accepted',
      },
      run: {
        acceptedCount: totalRecipients,
        batchSize: 1000,
        billingAccountId: 'billing_1',
        channel: 'sms',
        failedCount: 0,
        id: runId,
        managementSendName,
        rejectedCount: 0,
        requestDate,
        senderResourceId,
        status: 'completed',
        totalBatches: providerRequestIds.length,
        totalRecipients,
        unknownCount: 0,
        userId,
      },
    },
  ]));
}

function createSmsClient(overrides = {}) {
  return {
    cancelReservations: overrides.cancelReservations ?? vi.fn(),
    getReservation: overrides.getReservation ?? vi.fn(),
    listReservations: overrides.listReservations ?? vi.fn(),
  };
}

function createKakaoClient(overrides = {}) {
  return {
    cancelAlimtalkMessages: overrides.cancelAlimtalkMessages ?? vi.fn(),
    cancelBrandMessages: overrides.cancelBrandMessages ?? vi.fn(),
    listAlimtalkMessages: overrides.listAlimtalkMessages ?? vi.fn(async () => kakaoMessagePage([])),
    listBrandMessages: overrides.listBrandMessages ?? vi.fn(async () => kakaoMessagePage([])),
  };
}

function createReservation(overrides = {}) {
  const reservation = {
    body: 'Reservation body',
    createDate: '2026-06-06 09:10:00',
    messageStatus: 'RESERVED',
    messageType: 'SMS',
    recipientNo: '01000000000',
    recipientSeq: 1,
    requestDate: '2026-06-07 10:00:00',
    requestId: 'reservation-request-1',
    sendNo: '15446859',
    senderGroupingKey: senderGroupingKey(),
    sendType: '0',
    ...overrides,
  };

  return {
    ...(reservation.senderGroupingKey
      ? { recipientGroupingKey: buildRecipientGroupingKey(reservation.senderGroupingKey, reservation.recipientSeq - 1) }
      : {}),
    ...reservation,
  };
}

function createKakaoMessage({ channel = CHANNELS.ALIMTALK, ...overrides } = {}) {
  const message = {
    content: 'Kakao reservation body',
    createDate: '2026-06-06 09:20',
    messageStatus: 'READY',
    recipientNo: '01000000000',
    recipientSeq: 1,
    requestDate: '2026-06-07 10:00',
    requestId: 'reservation-request-1',
    senderGroupingKey: senderGroupingKey({ resourceRef: 'kakaoref1' }),
    senderKey: 'kakao-sender-key',
    templateCode: channel === CHANNELS.ALIMTALK ? 'alimtalk-template' : 'brand-template',
    ...overrides,
  };

  return {
    recipientGroupingKey: buildRecipientGroupingKey(message.senderGroupingKey, message.recipientSeq - 1),
    ...message,
  };
}

function kakaoMessagePage(messages) {
  return {
    messageSearchResultResponse: {
      messages,
      pageSize: 1000,
      totalCount: messages.length,
    },
  };
}

function senderGroupingKey({
  billingRef = 'b1ref',
  requestRef = 'reqref1',
  resourceRef = 'smsref1',
  userRef = 'u1ref',
} = {}) {
  return buildSenderGroupingKey({
    billingRef,
    requestRef,
    resourceRef,
    userRef,
  });
}
