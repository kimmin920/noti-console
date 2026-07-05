import { describe, expect, it, vi } from 'vitest';

import { createMessageLogService } from '../messageLogs/service.js';
import { CHANNELS, RELAY_ERROR_CODES, SENDER_RESOURCE_TYPES } from '../relay/constants.js';
import {
  buildRecipientGroupingKey,
  buildSenderGroupingKey,
  deriveRequestRef,
} from '../relay/groupingKeys.js';

const CLIENT_REQUEST_ID = 'de305d54-75b4-431b-adb2-eb6b9e546014';
const FIXED_NOW = new Date('2026-06-04T15:18:42.000Z');

describe('message log proxy service', () => {
  it('filters NHN SMS logs by active resource grouping keys before returning DTOs', async () => {
    const repository = createMemoryRepository();
    const authorizedGroupingKey = senderGroupingKey({ requestRef: 'reqauth1' });
    const unauthorizedGroupingKey = 'u:other:b:b1ref:r:smsref1:q:reqother';
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          pageNum: 1,
          pageSize: 1000,
          totalCount: 99,
          data: [
            createSmsLog({
              requestId: 'sms-authorized',
              senderGroupingKey: authorizedGroupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(authorizedGroupingKey, 0),
              body: 'Visible preview',
            }),
            createSmsLog({
              requestId: 'sms-unauthorized',
              senderGroupingKey: unauthorizedGroupingKey,
              recipientGroupingKey: `${unauthorizedGroupingKey}:n:0`,
              recipientNo: '01099999999',
              body: 'Sensitive unauthorized body',
            }),
          ],
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.listLogs({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
        page: '1',
        pageSize: '20',
      },
    });

    expect(smsClient.listSmsMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        sendNo: '15446859',
        startRequestDate: '2026-06-01 09:00:00',
        endRequestDate: '2026-06-02 09:00:00',
      })
    );
    expect(result).toMatchObject({
      channel: CHANNELS.SMS,
      page: 1,
      pageSize: 20,
      hasNextPage: false,
      total: 1,
      logs: [
        {
          id: 'sms:sms-authorized:1',
          requestId: 'sms-authorized',
          recipientSeq: 1,
          senderLabel: 'Main SMS',
          recipientNo: '01012345678',
          contentPreview: 'Visible preview',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('sms-unauthorized');
    expect(JSON.stringify(result)).not.toContain('01099999999');
    expect(JSON.stringify(result)).not.toContain('Sensitive unauthorized body');
    expect(result.logs[0]).not.toHaveProperty('grouping');
    expect(result.logs[0]).not.toHaveProperty('context');
    expect(result.logs[0]).not.toHaveProperty('raw');
    expect(repository.auditLogs).toEqual([]);
  });

  it('keeps the compatibility row list recipient-row based before grouped logs are used', async () => {
    const repository = createMemoryRepository();
    const groupingKey = senderGroupingKey({ requestRef: 'reqrows1' });
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async () => ({
        body: {
          data: [
            createSmsLog({
              requestId: 'sms-row-request',
              recipientSeq: 1,
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 0),
            }),
            createSmsLog({
              requestId: 'sms-row-request',
              recipientSeq: 2,
              recipientNo: '01022222222',
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 1),
            }),
          ],
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.listLogs({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
      },
    });

    expect(result).toMatchObject({
      total: 2,
      logs: [
        { recipientSeq: 1 },
        { recipientSeq: 2 },
      ],
    });
  });

  it('groups authorized SMS rows by app send before paginating the grouped list', async () => {
    const repository = createMemoryRepository();
    const groupingKey = senderGroupingKey({ requestRef: 'reqgroup1' });
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async () => ({
        body: {
          data: [
            createSmsLog({
              requestId: 'sms-group-request',
              recipientSeq: 1,
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 0),
              body: 'Grouped visible preview',
              requestDate: '2026-06-01 09:00:00',
              receiveDate: '2026-06-01 09:01:00',
              msgStatus: 3,
              resultCode: 1000,
            }),
            createSmsLog({
              requestId: 'sms-group-request',
              recipientSeq: 2,
              recipientNo: '01022222222',
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 1),
              body: 'Second grouped body',
              requestDate: '2026-06-01 09:02:00',
              receiveDate: '2026-06-01 09:03:00',
              msgStatus: 5,
              resultCode: 3000,
              resultMessage: 'FAILED',
            }),
            createSmsLog({
              requestId: 'sms-group-request',
              recipientSeq: 3,
              recipientNo: '01033333333',
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 2),
              body: 'Pending grouped body',
              requestDate: '2026-06-01 09:04:00',
              receiveDate: null,
              msgStatus: 2,
              resultCode: null,
              resultMessage: null,
            }),
          ],
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.listLogGroups({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
        page: '1',
        pageSize: '20',
      },
    });

    expect(result).toMatchObject({
      channel: CHANNELS.SMS,
      page: 1,
      pageSize: 20,
      hasNextPage: false,
      total: 1,
      groups: [
        {
          channel: CHANNELS.SMS,
          senderLabel: 'Main SMS',
          templateCode: 'SMS_TEMPLATE',
          contentPreview: 'Grouped visible preview',
          requestDate: '2026-06-01 09:00:00',
          receiveDate: '2026-06-01 09:03:00',
          recipientCount: 3,
          successCount: 1,
          failedCount: 1,
          pendingCount: 1,
          aggregateState: 'partial',
          representativeRequestId: 'sms-group-request',
          providerRequestCount: 1,
        },
      ],
    });
    expect(result.groups[0].id).toEqual(expect.any(String));
    expect(result.groups[0]).not.toHaveProperty('representativeRecipientNo');
    expect(result.groups[0].id).not.toContain('reqgroup1');
    expect(JSON.stringify(result)).not.toContain('01022222222');
    expect(JSON.stringify(result)).not.toContain('01033333333');
    expect(JSON.stringify(result)).not.toContain('senderGroupingKey');
    expect(JSON.stringify(result)).not.toContain('recipientGroupingKey');
    expect(JSON.stringify(result)).not.toContain('reqgroup1');
    expect(result.groups[0]).not.toHaveProperty('grouping');
    expect(result.groups[0]).not.toHaveProperty('context');
    expect(result.groups[0]).not.toHaveProperty('raw');
  });

  it('groups SMS bulk logs by local bulk run id across provider request ids', async () => {
    const repository = createMemoryRepository({
      bulkMappings: createBulkMappings({
        managementSendName: 'June bulk log',
        providerRequestIds: ['sms-bulk-log-1', 'sms-bulk-log-2', 'sms-bulk-log-3'],
        requestDate: null,
        totalRecipients: 3,
      }),
    });
    const groupingKeys = ['reqbulk1', 'reqbulk2', 'reqbulk3'].map((requestRef) => senderGroupingKey({ requestRef }));
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async () => ({
        body: {
          data: [
            createSmsLog({
              requestId: 'sms-bulk-log-1',
              recipientSeq: 1,
              senderGroupingKey: groupingKeys[0],
              recipientGroupingKey: buildRecipientGroupingKey(groupingKeys[0], 0),
            }),
            createSmsLog({
              requestId: 'sms-bulk-log-2',
              recipientSeq: 1,
              senderGroupingKey: groupingKeys[1],
              recipientGroupingKey: buildRecipientGroupingKey(groupingKeys[1], 0),
            }),
            createSmsLog({
              requestId: 'sms-bulk-log-3',
              recipientSeq: 1,
              senderGroupingKey: groupingKeys[2],
              recipientGroupingKey: buildRecipientGroupingKey(groupingKeys[2], 0),
            }),
          ],
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.listLogGroups({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
      },
    });
    const detail = await service.getLogGroupDetail({
      actorUserId: 'user_1',
      groupId: result.groups[0].id,
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
      },
    });

    expect(result).toMatchObject({
      total: 1,
      groups: [
        {
          groupType: 'bulk_run',
          bulkRunId: 'bulk_run_1',
          managementTitle: 'June bulk log',
          providerRequestCount: 3,
          recipientCount: 3,
        },
      ],
    });
    expect(result.groups[0].id).not.toContain('bulk_run_1');
    expect(result.groups[0].id).not.toContain('sms-bulk-log');
    expect(result.groups[0]).not.toHaveProperty('providerRequestIds');
    expect(JSON.stringify(result)).not.toContain('bulk:');
    expect(detail).toMatchObject({
      group: {
        id: result.groups[0].id,
        groupType: 'bulk_run',
        recipientCount: 3,
      },
      recipients: [
        { requestId: 'sms-bulk-log-1' },
        { requestId: 'sms-bulk-log-2' },
        { requestId: 'sms-bulk-log-3' },
      ],
    });
  });

  it('groups scheduled SMS bulk final logs by local run id and aggregates outcomes', async () => {
    const repository = createMemoryRepository({
      bulkMappings: createBulkMappings({
        managementSendName: 'Scheduled bulk log',
        providerRequestIds: ['sms-scheduled-log-1', 'sms-scheduled-log-2', 'sms-scheduled-log-3'],
        requestDate: '2026-06-07 10:00',
        totalRecipients: 3,
      }),
    });
    const groupingKeys = ['reqscheduled1', 'reqscheduled2', 'reqscheduled3']
      .map((requestRef) => senderGroupingKey({ requestRef }));
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async () => ({
        body: {
          data: [
            createSmsLog({
              requestId: 'sms-scheduled-log-1',
              recipientSeq: 1,
              senderGroupingKey: groupingKeys[0],
              recipientGroupingKey: buildRecipientGroupingKey(groupingKeys[0], 0),
              requestDate: '2026-06-07 10:00:00',
              receiveDate: '2026-06-07 10:01:00',
              msgStatus: 3,
              resultCode: 1000,
            }),
            createSmsLog({
              requestId: 'sms-scheduled-log-2',
              recipientSeq: 1,
              senderGroupingKey: groupingKeys[1],
              recipientGroupingKey: buildRecipientGroupingKey(groupingKeys[1], 0),
              requestDate: '2026-06-07 10:00:00',
              receiveDate: '2026-06-07 10:03:00',
              msgStatus: 5,
              resultCode: 3000,
              resultMessage: 'FAILED',
            }),
            createSmsLog({
              requestId: 'sms-scheduled-log-3',
              recipientSeq: 1,
              senderGroupingKey: groupingKeys[2],
              recipientGroupingKey: buildRecipientGroupingKey(groupingKeys[2], 0),
              requestDate: '2026-06-07 10:00:00',
              receiveDate: null,
              msgStatus: 2,
              resultCode: null,
              resultMessage: 'PENDING',
            }),
          ],
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.listLogGroups({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-12T00:00:00.000Z',
      },
    });

    expect(result).toMatchObject({
      total: 1,
      groups: [
        {
          aggregateState: 'partial',
          failedCount: 1,
          groupType: 'bulk_run',
          managementTitle: 'Scheduled bulk log',
          pendingCount: 1,
          providerRequestCount: 3,
          recipientCount: 3,
          requestDate: '2026-06-07 10:00:00',
          receiveDate: '2026-06-07 10:03:00',
          successCount: 1,
        },
      ],
    });
    expect(result.groups[0]).not.toHaveProperty('providerRequestIds');
    expect(JSON.stringify(result)).not.toContain('bulk:');
  });

  it('ignores bulk log mappings owned by another user without leaking titles', async () => {
    const repository = createMemoryRepository({
      bulkMappings: createBulkMappings({
        managementSendName: 'Other user bulk log title',
        providerRequestIds: ['sms-other-user-log'],
        requestDate: null,
        runId: 'bulk_run_other_user',
        totalRecipients: 1,
        userId: 'user_2',
      }),
    });
    const groupingKey = senderGroupingKey({ requestRef: 'reqotheruserlog' });
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async () => ({
        body: {
          data: [
            createSmsLog({
              requestId: 'sms-other-user-log',
              recipientSeq: 1,
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 0),
            }),
          ],
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.listLogGroups({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
      },
    });

    expect(result).toMatchObject({
      total: 1,
      groups: [
        {
          groupType: 'provider_request',
          managementTitle: null,
          providerRequestCount: 1,
          representativeRequestId: 'sms-other-user-log',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('Other user bulk log title');
  });

  it('classifies mixed success, failed, and pending grouped rows as partial', async () => {
    const repository = createMemoryRepository();
    const groupingKey = senderGroupingKey({ requestRef: 'reqmixed1' });
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async () => ({
        body: {
          data: [
            createSmsLog({
              requestId: 'sms-mixed-group',
              recipientSeq: 1,
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 0),
              msgStatus: 3,
              resultCode: 1000,
            }),
            createSmsLog({
              requestId: 'sms-mixed-group',
              recipientSeq: 2,
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 1),
              msgStatus: 5,
              resultCode: 3000,
            }),
            createSmsLog({
              requestId: 'sms-mixed-group',
              recipientSeq: 3,
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 2),
              msgStatus: 2,
              resultCode: null,
              resultMessage: 'PENDING',
            }),
          ],
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.listLogGroups({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
      },
    });

    expect(result).toMatchObject({
      total: 1,
      groups: [
        {
          representativeRequestId: 'sms-mixed-group',
          recipientCount: 3,
          successCount: 1,
          failedCount: 1,
          pendingCount: 1,
          aggregateState: 'partial',
        },
      ],
    });
  });

  it('paginates grouped logs by group count after authorization', async () => {
    const repository = createMemoryRepository();
    const newerGroupingKey = senderGroupingKey({ requestRef: 'reqnewer1' });
    const olderGroupingKey = senderGroupingKey({ requestRef: 'reqolder1' });
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async () => ({
        body: {
          data: [
            createSmsLog({
              requestId: 'sms-older',
              senderGroupingKey: olderGroupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(olderGroupingKey, 0),
              requestDate: '2026-06-01 08:00:00',
            }),
            createSmsLog({
              requestId: 'sms-newer',
              senderGroupingKey: newerGroupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(newerGroupingKey, 0),
              requestDate: '2026-06-01 10:00:00',
            }),
          ],
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.listLogGroups({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
        page: '2',
        pageSize: '1',
      },
    });

    expect(result).toMatchObject({
      page: 2,
      pageSize: 1,
      hasNextPage: false,
      total: 2,
      groups: [
        {
          representativeRequestId: 'sms-older',
          recipientCount: 1,
          representativeRecipientNo: '01012345678',
        },
      ],
    });
  });

  it('filters unauthorized rows before grouping log summaries', async () => {
    const repository = createMemoryRepository();
    const authorizedGroupingKey = senderGroupingKey({ requestRef: 'reqsafe1' });
    const unauthorizedGroupingKey = 'u:other:b:b1ref:r:smsref1:q:reqsafe1';
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async () => ({
        body: {
          data: [
            createSmsLog({
              requestId: 'sms-safe',
              senderGroupingKey: authorizedGroupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(authorizedGroupingKey, 0),
              body: 'Authorized summary',
            }),
            createSmsLog({
              requestId: 'sms-sensitive',
              senderGroupingKey: unauthorizedGroupingKey,
              recipientGroupingKey: `${unauthorizedGroupingKey}:n:0`,
              recipientNo: '01099999999',
              body: 'Sensitive unauthorized group body',
            }),
          ],
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.listLogGroups({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
      },
    });

    expect(result).toMatchObject({
      total: 1,
      groups: [
        {
          representativeRequestId: 'sms-safe',
          recipientCount: 1,
          representativeRecipientNo: '01012345678',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('sms-sensitive');
    expect(JSON.stringify(result)).not.toContain('01099999999');
    expect(JSON.stringify(result)).not.toContain('Sensitive unauthorized group body');
  });

  it('returns grouped log detail with all authorized recipient rows only', async () => {
    const repository = createMemoryRepository();
    const groupingKey = senderGroupingKey({ requestRef: 'reqdetailgroup1' });
    const otherGroupingKey = senderGroupingKey({ requestRef: 'reqdetailgroup2' });
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async () => ({
        body: {
          data: [
            createSmsLog({
              requestId: 'sms-detail-group',
              recipientSeq: 1,
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 0),
            }),
            createSmsLog({
              requestId: 'sms-detail-group',
              recipientSeq: 2,
              recipientNo: '01022222222',
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 1),
            }),
            createSmsLog({
              requestId: 'sms-other-group',
              recipientSeq: 1,
              recipientNo: '01033333333',
              senderGroupingKey: otherGroupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(otherGroupingKey, 0),
            }),
          ],
        },
      })),
    });
    const service = createTestService({ repository, smsClient });
    const list = await service.listLogGroups({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
      },
    });
    const group = list.groups.find((item) => item.representativeRequestId === 'sms-detail-group');

    const detail = await service.getLogGroupDetail({
      actorUserId: 'user_1',
      groupId: group.id,
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
      },
    });

    expect(detail).toMatchObject({
      group: {
        id: group.id,
        representativeRequestId: 'sms-detail-group',
        recipientCount: 2,
      },
      recipients: [
        {
          requestId: 'sms-detail-group',
          recipientSeq: 1,
        },
        {
          requestId: 'sms-detail-group',
          recipientSeq: 2,
          recipientNo: '01022222222',
        },
      ],
    });
    expect(JSON.stringify(detail)).not.toContain('sms-other-group');
    expect(JSON.stringify(detail)).not.toContain('01033333333');
    expect(JSON.stringify(detail)).not.toContain('senderGroupingKey');
    expect(JSON.stringify(detail)).not.toContain('recipientGroupingKey');
    expect(JSON.stringify(detail)).not.toContain('reqdetailgroup1');
    expect(detail.group).not.toHaveProperty('grouping');
    expect(detail.group).not.toHaveProperty('context');
    expect(detail.group).not.toHaveProperty('raw');
    expect(detail.recipients[0]).not.toHaveProperty('grouping');
    expect(detail.recipients[0]).not.toHaveProperty('context');
    expect(detail.recipients[0]).not.toHaveProperty('raw');
  });

  it('fails closed for absent grouped log detail', async () => {
    const repository = createMemoryRepository();
    const groupingKey = senderGroupingKey({ requestRef: 'reqabsent1' });
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async () => ({
        body: {
          data: [
            createSmsLog({
              requestId: 'sms-present',
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 0),
            }),
          ],
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    await expect(
      service.getLogGroupDetail({
        actorUserId: 'user_1',
        groupId: 'missing-group',
        query: {
          channel: CHANNELS.SMS,
          from: '2026-06-01T00:00:00.000Z',
          to: '2026-06-02T00:00:00.000Z',
        },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.FORBIDDEN,
      status: 403,
      message: expect.not.stringContaining('missing-group'),
    });
  });

  it('finds status by deriving the sender grouping key from clientRequestId', async () => {
    const repository = createMemoryRepository();
    const requestRef = deriveRequestRef(CLIENT_REQUEST_ID);
    const groupingKey = senderGroupingKey({ requestRef });
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async () => ({
        body: {
          data: [
            createSmsLog({
              requestId: 'sms-after-timeout',
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 0),
              msgStatus: 3,
              resultCode: 1000,
            }),
          ],
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.getStatus({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        senderResourceId: 'sms_resource_1',
        clientRequestId: CLIENT_REQUEST_ID,
        from: '2026-05-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
      },
    });

    expect(smsClient.listSmsMessages).toHaveBeenCalledWith(
      {
        pageNum: 1,
        pageSize: 1000,
        senderGroupingKey: groupingKey,
        sendNo: '15446859',
        startRequestDate: '2026-06-04 00:18:42',
        endRequestDate: '2026-06-05 00:18:42',
      }
    );
    expect(result).toMatchObject({
      state: 'found',
      clientRequestId: CLIENT_REQUEST_ID,
      logs: [
        {
          requestId: 'sms-after-timeout',
          resultCode: 1000,
        },
      ],
    });
    expect(result.logs[0]).not.toHaveProperty('grouping');
    expect(result.logs[0]).not.toHaveProperty('context');
    expect(result.logs[0]).not.toHaveProperty('raw');
  });

  it('finds Brand Message status with the Kakao sender resource grouping key', async () => {
    const repository = createMemoryRepository();
    const requestRef = deriveRequestRef(CLIENT_REQUEST_ID);
    const groupingKey = senderGroupingKey({ requestRef, resourceRef: 'kakaoref1' });
    const kakaoClient = createKakaoClient({
      listBrandMessages: vi.fn(async () => ({
        messageSearchResultResponse: {
          pageNum: 1,
          pageSize: 1000,
          totalCount: 1,
          messages: [
            createBrandLog({
              requestId: 'brand-after-timeout',
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 0),
              resultCode: 'MRC01',
              messageStatus: 'COMPLETED',
            }),
          ],
        },
      })),
    });
    const service = createTestService({ repository, kakaoClient });

    const result = await service.getStatus({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.BRAND_MESSAGE,
        senderResourceId: 'kakao_resource_1',
        clientRequestId: CLIENT_REQUEST_ID,
      },
    });

    expect(kakaoClient.listBrandMessages).toHaveBeenCalledWith({
      pageNum: 1,
      pageSize: 1000,
      senderGroupingKey: groupingKey,
      senderKey: 'sender-key-1',
      startRequestDate: '2026-06-04 00:18',
      endRequestDate: '2026-06-05 00:18',
    });
    expect(result).toMatchObject({
      state: 'found',
      channel: CHANNELS.BRAND_MESSAGE,
      clientRequestId: CLIENT_REQUEST_ID,
      logs: [
        {
          requestId: 'brand-after-timeout',
          resultCode: 'MRC01',
          status: 'COMPLETED',
        },
      ],
    });
    expect(result.logs[0]).not.toHaveProperty('grouping');
    expect(result.logs[0]).not.toHaveProperty('context');
    expect(result.logs[0]).not.toHaveProperty('raw');
  });

  it('filters NHN Brand Message logs by active Kakao sender grouping keys', async () => {
    const repository = createMemoryRepository();
    const authorizedGroupingKey = senderGroupingKey({ requestRef: 'brandauth1', resourceRef: 'kakaoref1' });
    const unauthorizedGroupingKey = 'u:other:b:b1ref:r:kakaoref1:q:brandother';
    const kakaoClient = createKakaoClient({
      listBrandMessages: vi.fn(async () => ({
        messageSearchResultResponse: {
          pageNum: 1,
          pageSize: 1000,
          totalCount: 2,
          messages: [
            createBrandLog({
              requestId: 'brand-authorized',
              senderGroupingKey: authorizedGroupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(authorizedGroupingKey, 0),
              content: 'Visible brand preview',
            }),
            createBrandLog({
              requestId: 'brand-unauthorized',
              senderGroupingKey: unauthorizedGroupingKey,
              recipientGroupingKey: `${unauthorizedGroupingKey}:n:0`,
              recipientNo: '01099999999',
              content: 'Sensitive unauthorized brand body',
            }),
          ],
        },
      })),
    });
    const service = createTestService({ repository, kakaoClient });

    const result = await service.listLogs({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.BRAND_MESSAGE,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
        page: '1',
        pageSize: '20',
      },
    });

    expect(kakaoClient.listBrandMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        senderKey: 'sender-key-1',
        startRequestDate: '2026-06-01 09:00',
        endRequestDate: '2026-06-02 09:00',
      })
    );
    expect(result).toMatchObject({
      channel: CHANNELS.BRAND_MESSAGE,
      page: 1,
      pageSize: 20,
      total: 1,
      logs: [
        {
          id: 'brand-message:brand-authorized:1',
          requestId: 'brand-authorized',
          senderLabel: '@store',
          contentPreview: 'Visible brand preview',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('brand-unauthorized');
    expect(JSON.stringify(result)).not.toContain('01099999999');
    expect(JSON.stringify(result)).not.toContain('Sensitive unauthorized brand body');
  });

  it('paginates status lookup over complete provider results', async () => {
    const repository = createMemoryRepository();
    const requestRef = deriveRequestRef(CLIENT_REQUEST_ID);
    const groupingKey = senderGroupingKey({ requestRef });
    const otherGroupingKey = 'u:other:b:b1ref:r:smsref1:q:reqother';
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async (query) => {
        const pageNum = Number(query.pageNum);

        return {
          body: {
            pageNum,
            pageSize: 1000,
            totalCount: 12000,
            data:
              pageNum === 12
                ? [
                    createSmsLog({
                      requestId: 'sms-deep-status',
                      senderGroupingKey: groupingKey,
                      recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 0),
                      msgStatus: 3,
                      resultCode: 1000,
                    }),
                  ]
                : [
                    createSmsLog({
                      requestId: `sms-other-${pageNum}`,
                      senderGroupingKey: otherGroupingKey,
                      recipientGroupingKey: `${otherGroupingKey}:n:${pageNum}`,
                    }),
                  ],
          },
        };
      }),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.getStatus({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        senderResourceId: 'sms_resource_1',
        clientRequestId: CLIENT_REQUEST_ID,
      },
    });

    expect(smsClient.listSmsMessages).toHaveBeenCalledTimes(12);
    expect(result).toMatchObject({
      state: 'found',
      logs: [
        {
          requestId: 'sms-deep-status',
        },
      ],
    });
  });

  it('paginates application logs over complete provider results after many unauthorized pages', async () => {
    const repository = createMemoryRepository();
    const lateGroupingKeyOne = senderGroupingKey({ requestRef: 'lateauth1' });
    const lateGroupingKeyTwo = senderGroupingKey({ requestRef: 'lateauth2' });
    const unauthorizedGroupingKey = 'u:other:b:b1ref:r:smsref1:q:reqother';
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async (query) => {
        const pageNum = Number(query.pageNum);
        const data =
          pageNum === 21
            ? [
                createSmsLog({
                  requestId: 'sms-late-one',
                  senderGroupingKey: lateGroupingKeyOne,
                  recipientGroupingKey: buildRecipientGroupingKey(lateGroupingKeyOne, 0),
                  requestDate: '2026-06-01 10:00:00',
                }),
              ]
            : pageNum === 22
              ? [
                  createSmsLog({
                    requestId: 'sms-late-two',
                    senderGroupingKey: lateGroupingKeyTwo,
                    recipientGroupingKey: buildRecipientGroupingKey(lateGroupingKeyTwo, 0),
                    requestDate: '2026-06-01 09:00:00',
                  }),
                ]
              : [
                  createSmsLog({
                    requestId: `sms-unauthorized-${pageNum}`,
                    senderGroupingKey: unauthorizedGroupingKey,
                    recipientGroupingKey: `${unauthorizedGroupingKey}:n:${pageNum}`,
                    recipientNo: '01099999999',
                    body: 'Sensitive unauthorized body',
                  }),
                ];

        return {
          body: {
            pageNum,
            pageSize: 1000,
            totalCount: 22000,
            data,
          },
        };
      }),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.listLogs({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
        page: '2',
        pageSize: '1',
      },
    });

    expect(smsClient.listSmsMessages).toHaveBeenCalledTimes(22);
    expect(smsClient.listSmsMessages).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageNum: 22,
        pageSize: 1000,
      })
    );
    expect(result).toMatchObject({
      page: 2,
      pageSize: 1,
      hasNextPage: false,
      total: 2,
      logs: [
        {
          requestId: 'sms-late-two',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('sms-unauthorized');
    expect(JSON.stringify(result)).not.toContain('01099999999');
    expect(JSON.stringify(result)).not.toContain('Sensitive unauthorized body');
  });

  it('fails loudly instead of silently truncating excessive provider log scans', async () => {
    const repository = createMemoryRepository();
    const unauthorizedGroupingKey = 'u:other:b:b1ref:r:smsref1:q:reqother';
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async (query) => ({
        body: {
          pageNum: query.pageNum,
          pageSize: 1000,
          totalCount: 101000,
          data: [
            createSmsLog({
              requestId: `sms-excessive-${query.pageNum}`,
              senderGroupingKey: unauthorizedGroupingKey,
              recipientGroupingKey: `${unauthorizedGroupingKey}:n:${query.pageNum}`,
            }),
          ],
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    await expect(
      service.listLogs({
        actorUserId: 'user_1',
        query: {
          channel: CHANNELS.SMS,
          from: '2026-06-01T00:00:00.000Z',
          to: '2026-06-02T00:00:00.000Z',
        },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      message: 'Provider log scan exceeded 100 pages. Narrow the date range and try again.',
    });
    expect(smsClient.listSmsMessages).toHaveBeenCalledTimes(100);
  });

  it('fails closed for unauthorized detail without echoing raw recipient or content', async () => {
    const repository = createMemoryRepository();
    const smsClient = createSmsClient({
      getSmsMessage: vi.fn(async () => ({
        body: {
          data: createSmsLog({
            requestId: 'sms-other-user',
            senderGroupingKey: 'u:other:b:b1ref:r:smsref1:q:reqother',
            recipientGroupingKey: 'u:other:b:b1ref:r:smsref1:q:reqother:n:0',
            recipientNo: '01099999999',
            body: 'Do not leak this body',
          }),
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    await expect(
      service.getDetail({
        actorUserId: 'user_1',
        channel: CHANNELS.SMS,
        requestId: 'sms-other-user',
        recipientSeq: 1,
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.FORBIDDEN,
      status: 403,
      message: expect.not.stringContaining('01099999999'),
    });
  });

  it('returns authorized detail without raw provider rows or local context', async () => {
    const repository = createMemoryRepository();
    const groupingKey = senderGroupingKey({ requestRef: 'reqdetail1' });
    const smsClient = createSmsClient({
      getSmsMessage: vi.fn(async () => ({
        body: {
          data: createSmsLog({
            requestId: 'sms-detail',
            senderGroupingKey: groupingKey,
            recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 0),
            recipientNo: '01012345678',
            body: 'Authorized detail body',
          }),
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.getDetail({
      actorUserId: 'user_1',
      channel: CHANNELS.SMS,
      requestId: 'sms-detail',
      recipientSeq: 1,
    });

    expect(result).toMatchObject({
      id: 'sms:sms-detail:1',
      requestId: 'sms-detail',
      detail: {
        recipientNo: '01012345678',
        content: 'Authorized detail body',
      },
    });
    expect(result).not.toHaveProperty('grouping');
    expect(result).not.toHaveProperty('context');
    expect(result).not.toHaveProperty('raw');
    expect(JSON.stringify(result)).not.toContain('senderGroupingKey');
    expect(JSON.stringify(result)).not.toContain('recipientGroupingKey');
  });

  it('returns authorized Brand Message detail without raw provider rows or local context', async () => {
    const repository = createMemoryRepository();
    const groupingKey = senderGroupingKey({ requestRef: 'branddetail1', resourceRef: 'kakaoref1' });
    const kakaoClient = createKakaoClient({
      getBrandMessage: vi.fn(async () => ({
        message: createBrandLog({
          requestId: 'brand-detail',
          senderGroupingKey: groupingKey,
          recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 0),
          recipientNo: '01012345678',
          content: 'Authorized brand detail body',
        }),
      })),
    });
    const service = createTestService({ repository, kakaoClient });

    const result = await service.getDetail({
      actorUserId: 'user_1',
      channel: CHANNELS.BRAND_MESSAGE,
      requestId: 'brand-detail',
      recipientSeq: 1,
    });

    expect(kakaoClient.getBrandMessage).toHaveBeenCalledWith({
      requestId: 'brand-detail',
      recipientSeq: 1,
    });
    expect(result).toMatchObject({
      id: 'brand-message:brand-detail:1',
      channel: CHANNELS.BRAND_MESSAGE,
      detail: {
        recipientNo: '01012345678',
        content: 'Authorized brand detail body',
      },
    });
    expect(result).not.toHaveProperty('grouping');
    expect(result).not.toHaveProperty('context');
    expect(result).not.toHaveProperty('raw');
    expect(JSON.stringify(result)).not.toContain('senderGroupingKey');
    expect(JSON.stringify(result)).not.toContain('recipientGroupingKey');
  });

  it('streams authorized CSV export, hardens formula cells, and audits metadata only', async () => {
    const repository = createMemoryRepository();
    const groupingKey = senderGroupingKey({ requestRef: 'reqexport1' });
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async () => ({
        body: {
          data: [
            createSmsLog({
              requestId: 'sms-export',
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 0),
              recipientNo: '+821012345678',
              body: '=spreadsheet-risk',
              resultMessage: '@provider message',
            }),
          ],
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.exportLogs({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
      },
    });
    const csv = await readStream(result.stream);

    expect(result.filename).toBe('message-logs-sms-2026-06-01-2026-06-02.csv');
    expect(result.rowCount).toBe(1);
    expect(csv).toContain('"sms-export"');
    expect(csv).toContain('"\'=spreadsheet-risk"');
    expect(csv).toContain('"\'@provider message"');
    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'message_logs.exported',
        actorUserId: 'user_1',
        metadataJson: expect.objectContaining({
          channel: CHANNELS.SMS,
          from: '2026-06-01T00:00:00.000Z',
          to: '2026-06-02T00:00:00.000Z',
          exportedCount: 1,
          senderResourceIds: ['sms_resource_1'],
          providerPagesFetched: 1,
        }),
      }),
    ]);
    expect(JSON.stringify(repository.auditLogs)).not.toContain('+821012345678');
    expect(JSON.stringify(repository.auditLogs)).not.toContain('spreadsheet-risk');
    expect(JSON.stringify(repository.auditLogs)).not.toContain('reqexport1');
  });

  it('fetches all provider pages for CSV export instead of silently truncating at the old ceiling', async () => {
    const repository = createMemoryRepository();
    const groupingKey = senderGroupingKey({ requestRef: 'lateexport1' });
    const unauthorizedGroupingKey = 'u:other:b:b1ref:r:smsref1:q:reqother';
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async (query) => {
        const pageNum = Number(query.pageNum);
        const data =
          pageNum === 21
            ? [
                createSmsLog({
                  requestId: 'sms-export-late',
                  senderGroupingKey: groupingKey,
                  recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 0),
                  body: 'Late export row',
                }),
              ]
            : [
                createSmsLog({
                  requestId: `sms-export-unauthorized-${pageNum}`,
                  senderGroupingKey: unauthorizedGroupingKey,
                  recipientGroupingKey: `${unauthorizedGroupingKey}:n:${pageNum}`,
                  recipientNo: '01099999999',
                  body: 'Unauthorized export body',
                }),
              ];

        return {
          body: {
            pageNum,
            pageSize: 1000,
            totalCount: 21000,
            data,
          },
        };
      }),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.exportLogs({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
      },
    });
    const csv = await readStream(result.stream);

    expect(smsClient.listSmsMessages).toHaveBeenCalledTimes(21);
    expect(smsClient.listSmsMessages).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageNum: 21,
        pageSize: 1000,
      })
    );
    expect(result.rowCount).toBe(1);
    expect(csv).toContain('"sms-export-late"');
    expect(csv).not.toContain('sms-export-unauthorized');
    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'message_logs.exported',
        metadataJson: expect.objectContaining({
          exportedCount: 1,
          providerPagesFetched: 21,
          providerTotalCount: 21000,
        }),
      }),
    ]);
    expect(JSON.stringify(repository.auditLogs)).not.toContain('01099999999');
    expect(JSON.stringify(repository.auditLogs)).not.toContain('Unauthorized export body');
    expect(JSON.stringify(repository.auditLogs)).not.toContain('lateexport1');
  });

  it('resends an authorized failed AlimTalk row with new grouping and idempotency identity', async () => {
    const repository = createMemoryRepository();
    const oldGroupingKey = senderGroupingKey({ requestRef: 'oldrequest1', resourceRef: 'kakaoref1' });
    const kakaoClient = createKakaoClient({
      getAlimtalkMessage: vi.fn(async () => ({
        message: {
          requestId: 'alim-old',
          recipientSeq: 1,
          senderKey: 'sender-key-1',
          templateCode: 'ORDER_READY',
          recipientNo: '01012345678',
          content: 'Sensitive rendered AlimTalk content',
          resultCode: 'MRC02',
          resultMessage: 'Failed',
          messageStatus: 'FAILED',
          senderGroupingKey: oldGroupingKey,
          recipientGroupingKey: buildRecipientGroupingKey(oldGroupingKey, 0),
          buttons: [{ type: 'WL', name: 'View', linkMo: 'https://example.com' }],
        },
      })),
      sendRawAlimtalkMessage: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        message: { requestId: 'alim-new' },
      })),
    });
    const service = createTestService({ repository, kakaoClient });

    const result = await service.resend({
      actorUserId: 'user_1',
      channel: CHANNELS.ALIMTALK,
      requestId: 'alim-old',
      recipientSeq: 1,
    });

    const [providerBody, providerOptions] = kakaoClient.sendRawAlimtalkMessage.mock.calls[0];
    expect(providerBody.senderGroupingKey).toMatch(/^u:u1ref:b:b1ref:r:kakaoref1:q:/);
    expect(providerBody.senderGroupingKey).not.toBe(oldGroupingKey);
    expect(providerBody.recipientList[0]).toMatchObject({
      recipientNo: '01012345678',
      content: 'Sensitive rendered AlimTalk content',
      recipientGroupingKey: `${providerBody.senderGroupingKey}:n:0`,
      buttons: [{ type: 'WL', name: 'View', linkMo: 'https://example.com' }],
    });
    expect(providerOptions.idempotencyKey).toMatch(/^i:alimtalk:u:u1ref:r:kakaoref1:q:/);
    expect(providerOptions.idempotencyKey).not.toContain('oldrequest1');
    expect(result).toMatchObject({
      state: 'accepted_by_provider',
      channel: CHANNELS.ALIMTALK,
      original: {
        requestId: 'alim-old',
        recipientSeq: 1,
      },
      provider: {
        requestId: 'alim-new',
      },
    });
    expect(JSON.stringify(result)).not.toContain('01012345678');
    expect(JSON.stringify(result)).not.toContain('Sensitive rendered AlimTalk content');
  });

  it('rejects log date ranges longer than 30 days before calling NHN', async () => {
    const smsClient = createSmsClient();
    const service = createTestService({ smsClient });

    await expect(
      service.listLogs({
        actorUserId: 'user_1',
        query: {
          channel: CHANNELS.SMS,
          from: '2026-05-01T00:00:00.000Z',
          to: '2026-06-02T00:00:00.000Z',
        },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
    });
    expect(smsClient.listSmsMessages).not.toHaveBeenCalled();
  });
});

function createTestService({ repository, smsClient, kakaoClient } = {}) {
  return createMessageLogService({
    repository: repository || createMemoryRepository(),
    smsClient: smsClient || createSmsClient(),
    kakaoClient: kakaoClient || createKakaoClient(),
    now: () => FIXED_NOW,
  });
}

function createMemoryRepository(overrides = {}) {
  return {
    users: overrides.users || [
      {
        id: 'user_1',
        userRef: 'u1ref',
        email: 'user@example.com',
        status: 'active',
        isOperator: false,
      },
    ],
    billingAccounts: overrides.billingAccounts || [
      {
        id: 'billing_1',
        billingRef: 'b1ref',
        ownerType: 'user',
        ownerId: 'user_1',
        status: 'active',
      },
    ],
    resources: overrides.resources || [
      {
        id: 'sms_resource_1',
        resourceRef: 'smsref1',
        provider: 'nhn',
        type: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
        value: '15446859',
        displayName: 'Main SMS',
        status: 'active',
        providerStatus: 'approved',
      },
      {
        id: 'kakao_resource_1',
        resourceRef: 'kakaoref1',
        provider: 'nhn',
        type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
        value: 'sender-key-1',
        displayName: '@store',
        status: 'active',
        providerStatus: 'active',
      },
    ],
    links: overrides.links || [
      createLink({ id: 'sms_link_1', senderResourceId: 'sms_resource_1', role: 'sender' }),
      createLink({ id: 'kakao_link_1', senderResourceId: 'kakao_resource_1', role: 'sender' }),
    ],
    auditLogs: [],
    bulkMappings: overrides.bulkMappings ?? new Map(),

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

    async getBillingAccountById(billingAccountId) {
      return this.billingAccounts.find((billingAccount) => billingAccount.id === billingAccountId) ?? null;
    },

    async findBillingAccountForUser(userId) {
      return (
        this.billingAccounts.find(
          (billingAccount) => billingAccount.ownerType === 'user' && billingAccount.ownerId === userId
        ) ?? null
      );
    },

    async findSmsBulkRunMappingsByProviderRequestIds({ actorUserId, channel, providerRequestIds, senderResourceId }) {
      const ids = [...new Set(providerRequestIds.filter((value) => typeof value === 'string' && value.trim()))];
      const mappings = new Map();

      for (const id of ids) {
        const mapping = this.bulkMappings.get(id);
        if (
          mapping?.run?.userId === actorUserId
          && (!channel || mapping.run.channel === channel)
          && (!senderResourceId || mapping.run.senderResourceId === senderResourceId)
        ) {
          mappings.set(id, mapping);
        }
      }

      return mappings;
    },

    async createAuditLog(values) {
      const auditLog = {
        id: `audit_${this.auditLogs.length + 1}`,
        createdAt: FIXED_NOW,
        ...values,
      };
      this.auditLogs.push(auditLog);
      return auditLog;
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

function createLink({ id, senderResourceId, role = 'sender', status = 'active' }) {
  return {
    id,
    userId: 'user_1',
    senderResourceId,
    billingAccountId: 'billing_1',
    role,
    status,
    isDefault: false,
  };
}

function createSmsClient(overrides = {}) {
  return {
    sendSms: overrides.sendSms || vi.fn(),
    sendMms: overrides.sendMms || vi.fn(),
    listSmsMessages: overrides.listSmsMessages || vi.fn(),
    getSmsMessage: overrides.getSmsMessage || vi.fn(),
    listMmsMessages: overrides.listMmsMessages || vi.fn(),
    getMmsMessage: overrides.getMmsMessage || vi.fn(),
    listMessageResults: overrides.listMessageResults || vi.fn(),
  };
}

function createKakaoClient(overrides = {}) {
  return {
    sendRawAlimtalkMessage: overrides.sendRawAlimtalkMessage || vi.fn(),
    listAlimtalkMessages: overrides.listAlimtalkMessages || vi.fn(),
    getAlimtalkMessage: overrides.getAlimtalkMessage || vi.fn(),
    listAlimtalkMessageResults: overrides.listAlimtalkMessageResults || vi.fn(),
    listBrandMessages: overrides.listBrandMessages || vi.fn(),
    getBrandMessage: overrides.getBrandMessage || vi.fn(),
  };
}

function createSmsLog(overrides = {}) {
  return {
    requestId: 'sms-request',
    recipientSeq: 1,
    recipientNo: '01012345678',
    body: 'Message body',
    templateId: 'SMS_TEMPLATE',
    requestDate: '2026-06-01 09:00:00',
    receiveDate: '2026-06-01 09:01:00',
    msgStatus: 3,
    resultCode: 1000,
    resultMessage: 'SUCCESS',
    ...overrides,
  };
}

function createBrandLog(overrides = {}) {
  return {
    requestId: 'brand-request',
    recipientSeq: 1,
    recipientNo: '01012345678',
    content: 'Brand message body',
    templateCode: 'BRAND_TEMPLATE',
    requestDate: '2026-06-01 09:00:00',
    receiveDate: '2026-06-01 09:01:00',
    messageStatus: 'COMPLETED',
    resultCode: 'MRC01',
    resultMessage: 'SUCCESS',
    ...overrides,
  };
}

function senderGroupingKey({ requestRef, resourceRef = 'smsref1' }) {
  return buildSenderGroupingKey({
    userRef: 'u1ref',
    billingRef: 'b1ref',
    resourceRef,
    requestRef,
  });
}

async function readStream(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
  }

  output += decoder.decode();
  return output;
}
