import { describe, expect, it, vi } from 'vitest';

import { createMessageLogService } from '../messageLogs/service.js';
import { createInitialResultSnapshot, mergeResultSnapshotEntries } from '../messageLogs/repository.js';
import { createNhnSmsWebhookReceiver } from '../nhn/smsWebhookReceiver.js';
import { CHANNELS, SENDER_RESOURCE_TYPES } from '../relay/constants.js';
import { buildRecipientGroupingKey, buildSenderGroupingKey, deriveRequestRef } from '../relay/groupingKeys.js';

const FIXED_NOW = new Date('2026-06-09T06:00:00.000Z');
const CLIENT_REQUEST_ID = 'de305d54-75b4-431b-adb2-eb6b9e546014';
const WEBHOOK_URL = 'http://localhost/api/nhn/webhooks/sms';
const WEBHOOK_ENV = {
  NHN_SMS_APP_KEY: 'sms-app-key',
  NHN_SMS_WEBHOOK_SIGNATURE: 'webhook-secret',
};

describe('message log ledger service', () => {
  it('lists local ledger groups without provider log scans', async () => {
    const repository = createLedgerRepository();
    const smsClient = createSmsClient();
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    const result = await service.listLogGroups({
      actorUserId: 'user_1',
      query: { channel: CHANNELS.SMS, page: '1', pageSize: '20' },
    });

    expect(result).toMatchObject({
      channel: CHANNELS.SMS,
      total: 2,
      groups: [
        {
          id: 'ledger_group_lms',
          channel: CHANNELS.LMS,
          managementTitle: 'LMS notice',
          providerState: 'accepted',
          resultState: 'synced',
          senderLabel: 'Main SMS',
        },
        {
          id: 'ledger_group_sms',
          channel: CHANNELS.SMS,
          managementTitle: 'SMS notice',
          providerRequestCount: 1,
          acceptedRequestCount: 1,
        },
      ],
    });
    expect(smsClient.listSmsMessages).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('sms-provider-1');
    expect(JSON.stringify(result)).not.toContain('01012345678');
  });

  it('exposes message-log send source metadata from existing group fields', async () => {
    const repository = createLedgerRepository({
      groups: [
        createGroup({
          id: 'ledger_group_source_type',
          managementTitle: 'Automation by source type',
          sourceType: 'automation',
          sourceEventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
          sourceExternalEventId: 'event-source-type',
          sourceChannelCode: 'publ-demo-vvee-001',
          sourceAutomationRuleId: '11111111-1111-4111-8111-111111111111',
          sourceAutomationDeliveryId: '22222222-2222-4222-8222-222222222222',
        }),
        createGroup({
          id: 'ledger_group_rule_source',
          managementTitle: 'Automation by rule id',
          sourceAutomationRuleId: '33333333-3333-4333-8333-333333333333',
          sourceExternalEventId: 'event-rule-only',
        }),
        createGroup({
          id: 'ledger_group_delivery_source',
          managementTitle: 'Automation by delivery id',
          sourceAutomationDeliveryId: '44444444-4444-4444-8444-444444444444',
          sourceExternalEventId: 'event-delivery-only',
        }),
        createGroup({
          id: 'ledger_group_manual_external_event',
          managementTitle: 'Manual API event metadata',
          sourceExternalEventId: 'event-metadata-only',
        }),
      ],
      requests: [],
    });
    const service = createMessageLogService({
      repository,
      smsClient: createSmsClient(),
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    const list = await service.listLogGroups({
      actorUserId: 'user_1',
      query: { channel: CHANNELS.SMS, page: '1', pageSize: '20' },
    });
    const detail = await service.getLogGroupDetail({
      actorUserId: 'user_1',
      groupId: 'ledger_group_source_type',
      query: { channel: CHANNELS.SMS },
    });
    const groupsById = new Map(list.groups.map((group) => [group.id, group]));

    expect(groupsById.get('ledger_group_source_type')).toMatchObject({
      source: {
        type: 'automation',
        label: '자동화',
        eventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
        externalEventId: 'event-source-type',
        channelCode: 'publ-demo-vvee-001',
        automationRuleId: '11111111-1111-4111-8111-111111111111',
        automationRuleName: null,
        automationDeliveryId: '22222222-2222-4222-8222-222222222222',
      },
    });
    expect(groupsById.get('ledger_group_rule_source')).toMatchObject({
      source: {
        type: 'automation',
        externalEventId: 'event-rule-only',
        automationRuleId: '33333333-3333-4333-8333-333333333333',
      },
    });
    expect(groupsById.get('ledger_group_delivery_source')).toMatchObject({
      source: {
        type: 'automation',
        externalEventId: 'event-delivery-only',
        automationDeliveryId: '44444444-4444-4444-8444-444444444444',
      },
    });
    expect(groupsById.get('ledger_group_manual_external_event')).toMatchObject({
      source: {
        type: 'manual',
        label: '직접 발송',
      },
    });
    expect(detail.group).toMatchObject({
      id: 'ledger_group_source_type',
      source: {
        type: 'automation',
        label: '자동화',
      },
    });
  });

  it('lists SMS bulk groups after webhook payloads update local snapshots', async () => {
    const providerRequestIds = ['sms-bulk-log-1', 'sms-bulk-log-2', 'sms-bulk-log-3'];
    const repository = createLedgerRepository({
      groups: [
        createGroup({
          acceptedRequestCount: 3,
          id: 'ledger_group_bulk',
          managementTitle: 'June bulk log',
          providerRequestCount: 3,
          sendKind: 'bulk',
          totalRecipientCount: 3,
        }),
      ],
      requests: createBulkRequests({
        groupId: 'ledger_group_bulk',
        providerRequestIds,
      }),
    });
    const receiver = createTestWebhookReceiver({ repository });
    const smsClient = createSmsClient();
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    const response = await receiver.handleRequest(createWebhookRequest({
      body: createWebhookPayload({
        hooks: providerRequestIds.map((requestId, index) =>
          createWebhookHook({
            requestId,
            requestRef: `reqbulk${index + 1}`,
          })
        ),
      }),
    }));
    const body = await response.json();
    const result = await service.listLogGroups({
      actorUserId: 'user_1',
      query: { channel: CHANNELS.SMS, page: '1', pageSize: '20' },
    });

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      changedCount: 3,
      updatedCount: 3,
      validCount: 3,
    });
    expect(result).toMatchObject({
      total: 1,
      groups: [
        {
          aggregateState: 'success',
          failedCount: 0,
          managementTitle: 'June bulk log',
          pendingCount: 0,
          providerRequestCount: 3,
          recipientCount: 3,
          resultState: 'synced',
          sendKind: 'bulk',
          sendTiming: 'immediate',
          successCount: 3,
        },
      ],
    });
    expect(repository.mergeCalls.map((call) => call.providerRequestId)).toEqual(providerRequestIds);
    expect(smsClient.listSmsMessages).not.toHaveBeenCalled();
    expect(smsClient.listMessageResults).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('sms-bulk-log');
  });

  it('lists scheduled SMS bulk groups after webhook payloads update local snapshots', async () => {
    const scheduledAt = new Date('2026-06-09T05:30:00.000Z');
    const providerRequestIds = ['sms-scheduled-log-1', 'sms-scheduled-log-2', 'sms-scheduled-log-3'];
    const repository = createLedgerRepository({
      groups: [
        createGroup({
          acceptedRequestCount: 3,
          id: 'ledger_group_scheduled_bulk',
          managementTitle: 'Scheduled bulk log',
          pendingCount: 3,
          providerRequestCount: 3,
          scheduledAt,
          sendKind: 'bulk',
          sendTiming: 'scheduled',
          totalRecipientCount: 3,
        }),
      ],
      requests: createBulkRequests({
        groupId: 'ledger_group_scheduled_bulk',
        initializeSnapshot: true,
        providerRequestIds,
      }),
    });
    const receiver = createTestWebhookReceiver({ repository });
    const smsClient = createSmsClient();
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    const response = await receiver.handleRequest(createWebhookRequest({
      body: createWebhookPayload({
        hooks: [
          createWebhookHook({
            requestId: 'sms-scheduled-log-1',
            requestRef: 'reqscheduled1',
          }),
          createWebhookHook({
            messageStatus: 'FAILED',
            requestId: 'sms-scheduled-log-2',
            requestRef: 'reqscheduled2',
            resultCode: '3000',
          }),
        ],
      }),
    }));
    const body = await response.json();
    const result = await service.listLogGroups({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        from: '2026-06-09T00:00:00.000Z',
        page: '1',
        pageSize: '20',
        to: '2026-06-10T00:00:00.000Z',
      },
    });

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      changedCount: 2,
      updatedCount: 2,
      validCount: 2,
    });
    expect(result).toMatchObject({
      total: 1,
      groups: [
        {
          aggregateState: 'partial',
          failedCount: 1,
          managementTitle: 'Scheduled bulk log',
          pendingCount: 1,
          providerRequestCount: 3,
          recipientCount: 3,
          requestDate: scheduledAt.toISOString(),
          resultState: 'partially_synced',
          scheduledAt: scheduledAt.toISOString(),
          sendKind: 'bulk',
          sendTiming: 'scheduled',
          successCount: 1,
        },
      ],
    });
    expect(repository.mergeCalls.map((call) => call.providerRequestId)).toEqual([
      'sms-scheduled-log-1',
      'sms-scheduled-log-2',
    ]);
    expect(smsClient.listSmsMessages).not.toHaveBeenCalled();
    expect(smsClient.listMessageResults).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('sms-scheduled-log');
  });

  it('loads group detail locally and fetches recipients only for one local request', async () => {
    const repository = createLedgerRepository();
    const groupingKey = buildSenderGroupingKey({
      userRef: 'u1ref',
      billingRef: 'b1ref',
      resourceRef: 'smsref1',
      requestRef: 'reqledger1',
    });
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async (query) => ({
        body: {
          data: [
            {
              requestId: 'sms-provider-1',
              recipientSeq: 1,
              recipientNo: '01012345678',
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 0),
              requestDate: '2026-06-09 15:00:00',
              msgStatus: 3,
              resultCode: 1000,
              resultMessage: 'SUCCESS',
            },
          ],
          pageSize: query.pageSize,
          totalCount: 1,
        },
      })),
    });
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    const detail = await service.getLogGroupDetail({
      actorUserId: 'user_1',
      groupId: 'ledger_group_sms',
      query: { channel: CHANNELS.SMS },
    });
    const recipients = await service.listLogGroupRequestRecipients({
      actorUserId: 'user_1',
      groupId: 'ledger_group_sms',
      requestLocalId: 'ledger_request_sms',
      query: { page: '1', pageSize: '100' },
    });

    expect(detail).toMatchObject({
      group: { id: 'ledger_group_sms' },
      requests: [{ id: 'ledger_request_sms', canFetchRecipients: true }],
      recipients: [],
    });
    expect(smsClient.listSmsMessages).toHaveBeenCalledTimes(1);
    expect(smsClient.listSmsMessages.mock.calls[0][0]).toMatchObject({
      pageNum: 1,
      pageSize: 100,
      requestId: 'sms-provider-1',
      sendNo: '15446859',
    });
    expect(recipients.recipients).toEqual([
      expect.objectContaining({
        requestId: 'sms-provider-1',
        recipientSeq: 1,
      }),
    ]);
    expect(repository.persistedRecipientRows).toEqual([]);
  });

  it('lists snapshot failures from local ids without provider scans', async () => {
    const repository = createLedgerRepository({
      groups: [
        createGroup({
          failedCount: 3,
          id: 'ledger_group_failures',
          pendingCount: 1,
          resultState: 'partially_synced',
          successCount: 1,
          totalRecipientCount: 5,
        }),
      ],
      requests: [
        createRequest({
          failedCount: 3,
          groupId: 'ledger_group_failures',
          id: 'ledger_request_failures',
          pendingCount: 1,
          recipientCount: 5,
          resultSnapshotJson: {
            states: ['P', 'F', 'F', 'S', 'F'],
            resultCodes: [null, '3003', 'E915', '1000', null],
            failedRecipientNos: {
              2: '01099998888',
            },
          },
          resultState: 'partially_synced',
          successCount: 1,
        }),
      ],
    });
    const smsClient = createSmsClient();
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    const firstPage = await service.listLogGroupRequestFailures({
      actorUserId: 'user_1',
      groupId: 'ledger_group_failures',
      requestLocalId: 'ledger_request_failures',
      query: { page: '1', pageSize: '2' },
    });
    const secondPage = await service.listLogGroupRequestFailures({
      actorUserId: 'user_1',
      groupId: 'ledger_group_failures',
      requestLocalId: 'ledger_request_failures',
      query: { page: '2', pageSize: '2' },
    });

    expect(firstPage).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 3,
      hasNextPage: true,
      group: { id: 'ledger_group_failures' },
      request: { id: 'ledger_request_failures', sequence: 1, label: '요청 1' },
      failures: [
        {
          groupId: 'ledger_group_failures',
          requestLocalId: 'ledger_request_failures',
          recipientSeq: 2,
          recipientNo: '01099998888',
          resultCode: '3003',
          resultCodeLabel: '실패 · 수신 번호 오류 또는 결번',
        },
        {
          groupId: 'ledger_group_failures',
          requestLocalId: 'ledger_request_failures',
          recipientSeq: 3,
          recipientNo: null,
          resultCode: 'E915',
          resultCodeLabel: '실패 · 중복 메시지',
        },
      ],
    });
    expect(secondPage).toMatchObject({
      page: 2,
      pageSize: 2,
      total: 3,
      hasNextPage: false,
      failures: [
        {
          recipientSeq: 5,
          recipientNo: null,
          resultCode: null,
          resultCodeLabel: '실패',
        },
      ],
    });
    expect(smsClient.listSmsMessages).not.toHaveBeenCalled();
    expect(smsClient.getSmsMessage).not.toHaveBeenCalled();
    expect(JSON.stringify(firstPage)).not.toContain('sms-provider-1');
    expect(JSON.stringify(firstPage)).not.toContain('01012345678');
  });

  it('fetches one selected recipient detail through local ids without exposing provider request ids', async () => {
    const repository = createLedgerRepository();
    repository.requests.find((request) => request.id === 'ledger_request_sms').recipientCount = 2;
    const groupingKey = buildSenderGroupingKey({
      userRef: 'u1ref',
      billingRef: 'b1ref',
      resourceRef: 'smsref1',
      requestRef: 'reqledger1',
    });
    const smsClient = createSmsClient({
      getSmsMessage: vi.fn(async () => ({
        body: {
          data: {
            requestId: 'sms-provider-1',
            recipientSeq: 2,
            recipientNo: '01012345678',
            senderGroupingKey: groupingKey,
            recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 1),
            requestDate: '2026-06-09 15:00:00',
            msgStatus: 5,
            resultCode: 3003,
            resultMessage: 'FAILED',
            body: 'Selected failure body',
          },
        },
      })),
    });
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    const result = await service.getLogGroupRequestRecipientDetail({
      actorUserId: 'user_1',
      groupId: 'ledger_group_sms',
      requestLocalId: 'ledger_request_sms',
      recipientSeq: 2,
    });

    expect(smsClient.getSmsMessage).toHaveBeenCalledTimes(1);
    expect(smsClient.getSmsMessage).toHaveBeenCalledWith({
      requestId: 'sms-provider-1',
      recipientSeq: 2,
    });
    expect(result).toMatchObject({
      group: { id: 'ledger_group_sms' },
      request: { id: 'ledger_request_sms', sequence: 1, label: '요청 1' },
      recipient: {
        id: 'local:ledger_group_sms:ledger_request_sms:2',
        channel: CHANNELS.SMS,
        groupId: 'ledger_group_sms',
        requestLocalId: 'ledger_request_sms',
        recipientSeq: 2,
        recipientNo: '01012345678',
        detail: {
          recipientNo: '01012345678',
          content: 'Selected failure body',
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('sms-provider-1');
    expect(JSON.stringify(result)).not.toContain('senderGroupingKey');
    expect(JSON.stringify(result)).not.toContain('recipientGroupingKey');
  });

  it('rejects another actor before listing failures or fetching selected detail', async () => {
    const repository = createLedgerRepository();
    const smsClient = createSmsClient();
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    await expect(
      service.listLogGroupRequestFailures({
        actorUserId: 'other_user',
        groupId: 'ledger_group_sms',
        requestLocalId: 'ledger_request_sms',
        query: { page: '1', pageSize: '20' },
      })
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.getLogGroupRequestRecipientDetail({
        actorUserId: 'other_user',
        groupId: 'ledger_group_sms',
        requestLocalId: 'ledger_request_sms',
        recipientSeq: 1,
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(smsClient.getSmsMessage).not.toHaveBeenCalled();
    expect(smsClient.listSmsMessages).not.toHaveBeenCalled();
  });

  it('returns retention-expired local responses for archived request failure and detail routes', async () => {
    const repository = createLedgerRepository();
    repository.requests.push(createRequest({
      groupId: 'ledger_group_archived',
      id: 'ledger_request_archived',
      resultSnapshotJson: {
        states: ['F'],
        resultCodes: ['3003'],
      },
    }));
    const smsClient = createSmsClient();
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    const failures = await service.listLogGroupRequestFailures({
      actorUserId: 'user_1',
      groupId: 'ledger_group_archived',
      requestLocalId: 'ledger_request_archived',
      query: { page: '1', pageSize: '20' },
    });
    const detail = await service.getLogGroupRequestRecipientDetail({
      actorUserId: 'user_1',
      groupId: 'ledger_group_archived',
      requestLocalId: 'ledger_request_archived',
      recipientSeq: 1,
    });

    expect(failures).toMatchObject({
      archived: true,
      message: '보관 기간이 지난 발송입니다.',
      failures: [],
    });
    expect(detail).toMatchObject({
      archived: true,
      message: '보관 기간이 지난 발송입니다.',
      recipient: null,
    });
    expect(smsClient.getSmsMessage).not.toHaveBeenCalled();
    expect(smsClient.listSmsMessages).not.toHaveBeenCalled();
    expect(JSON.stringify(detail)).not.toContain('sms-provider-1');
  });

  it('syncs a basic ledger group when the user explicitly checks latest results', async () => {
    const repository = createLedgerRepository();
    const groupingKey = buildSenderGroupingKey({
      userRef: 'u1ref',
      billingRef: 'b1ref',
      resourceRef: 'smsref1',
      requestRef: 'reqledger1',
    });
    const smsClient = createSmsClient({
      listSmsMessages: vi.fn(async () => ({
        body: {
          data: [
            {
              requestId: 'sms-provider-1',
              recipientSeq: 1,
              recipientNo: '01012345678',
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 0),
              requestDate: '2026-06-09 15:00:00',
              msgStatus: 3,
              resultCode: 1000,
              resultMessage: 'SUCCESS',
            },
            {
              requestId: 'sms-provider-1',
              recipientSeq: 2,
              recipientNo: '01099998888',
              senderGroupingKey: groupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 5),
              requestDate: '2026-06-09 15:00:00',
              msgStatus: 5,
              resultCode: 3003,
              resultMessage: 'FAILED',
            },
          ],
          pageSize: 1000,
          totalCount: 2,
        },
      })),
    });
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    const result = await service.syncLogGroupResults({
      actorUserId: 'user_1',
      groupId: 'ledger_group_sms',
    });

    expect(smsClient.listSmsMessages).toHaveBeenCalledTimes(1);
    expect(repository.mergeCalls).toEqual([
      {
        authoritative: true,
        finalize: false,
        providerRequestId: 'sms-provider-1',
        results: [{ recipientSeq: 1, resultCode: '1000', state: 'S' }],
      },
    ]);
    expect(result.group).toMatchObject({
      id: 'ledger_group_sms',
      resultState: 'synced',
      successCount: 1,
      failedCount: 0,
      pendingCount: 0,
    });
    expect(repository.groups.find((group) => group.id === 'ledger_group_sms')).toMatchObject({
      resultState: 'synced',
      successCount: 1,
    });
    expect(repository.requests.find((request) => request.id === 'ledger_request_sms')).toMatchObject({
      resultState: 'synced',
      successCount: 1,
    });
  });

  it('runs 30-minute message-results correction for pending accepted SMS-family rows only', async () => {
    const repository = createLedgerRepository({ groups: [], requests: [] });
    const createdAt = new Date(FIXED_NOW.getTime() - 31 * 60 * 1000);
    for (const channel of [CHANNELS.SMS, CHANNELS.LMS, CHANNELS.MMS]) {
      repository.groups.push(createGroup({
        channel,
        createdAt,
        id: `ledger_group_${channel}`,
        pendingCount: 2,
        totalRecipientCount: 2,
      }));
      repository.requests.push(createRequest({
        createdAt,
        groupId: `ledger_group_${channel}`,
        id: `ledger_request_${channel}`,
        pendingCount: 2,
        providerRequestId: `${channel}-provider-1`,
        recipientCount: 2,
        resultSnapshotJson: createInitialResultSnapshot(2),
      }));
    }
    repository.groups.push(createGroup({
      channel: CHANNELS.SMS,
      createdAt,
      id: 'ledger_group_unknown',
      pendingCount: 2,
      providerState: 'unknown',
      totalRecipientCount: 2,
    }));
    repository.requests.push(createRequest({
      createdAt,
      groupId: 'ledger_group_unknown',
      id: 'ledger_request_unknown',
      pendingCount: 2,
      providerRequestId: null,
      providerState: 'unknown',
      recipientCount: 2,
      resultSnapshotJson: createInitialResultSnapshot(2),
    }));
    const smsClient = createSmsClient({
      listMessageResults: vi.fn(async (query) => {
        const channel = query.messageType.toLowerCase();
        return smsResultPage([
          {
            requestId: `${channel}-provider-1`,
            recipientSeq: 1,
            resultCode: '1000',
          },
        ], { pageSize: query.pageSize, totalCount: 1 });
      }),
    });
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    const result = await service.correctDueMessageResults({ limit: 10, workerId: 'worker-correction' });

    expect(result).toMatchObject({
      processedCount: 3,
      correctedCount: 3,
      errorCount: 0,
    });
    expect(smsClient.listMessageResults.mock.calls.map(([query]) => query.messageType).sort()).toEqual([
      'LMS',
      'MMS',
      'SMS',
    ]);
    expect(smsClient.listSmsMessages).not.toHaveBeenCalled();
    expect(smsClient.listMmsMessages).not.toHaveBeenCalled();
    expect(repository.requests.find((request) => request.id === 'ledger_request_sms')).toMatchObject({
      pendingCount: 1,
      resultState: 'partially_synced',
      successCount: 1,
    });
    const unknownRequest = repository.requests.find((request) => request.id === 'ledger_request_unknown');
    expect(unknownRequest).toMatchObject({
      resultState: 'not_synced',
    });
    expect(unknownRequest).not.toHaveProperty('syncLockedBy');
  });

  it('includes failed SMS recipient numbers in message-results correction entries', async () => {
    const repository = createLedgerRepository({ groups: [], requests: [] });
    const createdAt = new Date(FIXED_NOW.getTime() - 31 * 60 * 1000);
    repository.groups.push(createGroup({
      createdAt,
      id: 'ledger_group_sms_failed_number',
      pendingCount: 1,
      totalRecipientCount: 1,
    }));
    repository.requests.push(createRequest({
      createdAt,
      groupId: 'ledger_group_sms_failed_number',
      id: 'ledger_request_sms_failed_number',
      pendingCount: 1,
      providerRequestId: 'sms-provider-failed-number',
      recipientCount: 1,
      resultSnapshotJson: createInitialResultSnapshot(1),
    }));
    const smsClient = createSmsClient({
      listMessageResults: vi.fn(async () => smsResultPage([
        {
          recipientNo: '01099998888',
          recipientSeq: 1,
          requestId: 'sms-provider-failed-number',
          resultCode: '3003',
        },
      ])),
    });
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    await service.correctDueMessageResults({ limit: 10, workerId: 'worker-correction' });

    expect(repository.mergeCalls).toMatchObject([
      {
        authoritative: true,
        finalize: false,
        providerRequestId: 'sms-provider-failed-number',
        results: [{ recipientNo: '01099998888', recipientSeq: 1, resultCode: '3003', state: 'F' }],
      },
    ]);
    expect(repository.requests.find((request) => request.id === 'ledger_request_sms_failed_number')).toMatchObject({
      failedCount: 1,
      pendingCount: 0,
      resultSnapshotJson: {
        states: ['F'],
        resultCodes: ['3003'],
        failedRecipientNos: {
          1: '01099998888',
        },
      },
    });
  });

  it('runs 30-minute correction for pending accepted Kakao Bizmessage rows through provider logs', async () => {
    const repository = createLedgerRepository({ groups: [], requests: [] });
    const createdAt = new Date(FIXED_NOW.getTime() - 31 * 60 * 1000);
    repository.groups.push(
      createGroup({
        channel: CHANNELS.ALIMTALK,
        createdAt,
        id: 'ledger_group_alimtalk',
        pendingCount: 2,
        senderResourceId: 'kakao_resource_1',
        totalRecipientCount: 2,
      }),
      createGroup({
        channel: CHANNELS.BRAND_MESSAGE,
        createdAt,
        id: 'ledger_group_brand_message',
        pendingCount: 2,
        senderResourceId: 'kakao_resource_1',
        totalRecipientCount: 2,
      })
    );
    repository.requests.push(
      createRequest({
        createdAt,
        groupId: 'ledger_group_alimtalk',
        id: 'ledger_request_alimtalk',
        pendingCount: 2,
        providerRequestId: 'alimtalk-provider-1',
        recipientCount: 2,
        resultSnapshotJson: createInitialResultSnapshot(2),
      }),
      createRequest({
        createdAt,
        groupId: 'ledger_group_brand_message',
        id: 'ledger_request_brand_message',
        pendingCount: 2,
        providerRequestId: 'brand-message-provider-1',
        recipientCount: 2,
        resultSnapshotJson: createInitialResultSnapshot(2),
      })
    );
    const smsClient = createSmsClient();
    const kakaoClient = createKakaoClient({
      listAlimtalkMessages: vi.fn(async (query) =>
        kakaoResultPage([
          createKakaoProviderMessage({
            requestId: 'alimtalk-provider-1',
            requestRef: 'reqalim1',
          }),
        ], { pageSize: query.pageSize, totalCount: 1 })),
      listBrandMessages: vi.fn(async (query) =>
        kakaoResultPage([
          createKakaoProviderMessage({
            messageStatus: 'FAILED',
            requestId: 'brand-message-provider-1',
            requestRef: 'reqbrand1',
            resultCode: 'MRC04',
          }),
        ], { pageSize: query.pageSize, totalCount: 1 })),
    });
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient,
      now: () => FIXED_NOW,
    });

    const result = await service.correctDueMessageResults({ limit: 10 });

    expect(result).toMatchObject({
      processedCount: 2,
      correctedCount: 2,
      errorCount: 0,
    });
    expect(kakaoClient.listAlimtalkMessages).toHaveBeenCalledWith(expect.objectContaining({
      endRequestDate: '2026-06-09 15:00',
      pageNum: 1,
      pageSize: 1000,
      requestId: 'alimtalk-provider-1',
      senderKey: 'sender-key-1',
      startRequestDate: '2026-06-09 14:24',
    }));
    expect(kakaoClient.listBrandMessages).toHaveBeenCalledWith(expect.objectContaining({
      endRequestDate: '2026-06-09 15:00',
      pageNum: 1,
      pageSize: 1000,
      requestId: 'brand-message-provider-1',
      senderKey: 'sender-key-1',
      startRequestDate: '2026-06-09 14:24',
    }));
    expect(smsClient.listMessageResults).not.toHaveBeenCalled();
    expect(repository.requests.find((request) => request.id === 'ledger_request_alimtalk')).toMatchObject({
      pendingCount: 1,
      resultState: 'partially_synced',
      successCount: 1,
    });
    expect(repository.requests.find((request) => request.id === 'ledger_request_brand_message')).toMatchObject({
      failedCount: 1,
      pendingCount: 1,
      resultState: 'partially_synced',
      resultSnapshotJson: {
        failedRecipientNos: {
          1: '01012345678',
        },
      },
    });
    expect(JSON.stringify(repository.mergeCalls)).not.toContain('Sensitive kakao body');
  });

  it('keeps polling an open SMS fallback after the primary Kakao result is finalized', async () => {
    const openedAt = new Date(FIXED_NOW.getTime() - 31 * 60 * 1000);
    const group = createGroup({
      channel: CHANNELS.ALIMTALK,
      id: 'ledger_group_fallback_open',
      pendingCount: 0,
      resultFinalizedAt: openedAt,
      resultState: 'synced',
      senderResourceId: 'kakao_resource_1',
      successCount: 0,
      totalRecipientCount: 1,
    });
    const request = createRequest({
      failedCount: 1,
      groupId: group.id,
      id: 'ledger_request_fallback_open',
      pendingCount: 0,
      providerRequestId: 'alimtalk-fallback-provider-1',
      recipientCount: 1,
      resultFinalizedAt: openedAt,
      resultSnapshotJson: { states: ['F'], resultCodes: ['MRC04'] },
      resultState: 'synced',
    });
    const fallbackReservation = {
      consumedCount: 0,
      fallbackOpenedAt: openedAt,
      releasedCount: 0,
      reservedCount: 1,
      resultFinalizedAt: null,
      resultSyncedAt: null,
    };
    const repository = createLedgerRepository({ groups: [group], requests: [request] });
    repository.leaseMessageResultCorrectionRequests = vi.fn(async () => ([{
      fallbackReservation,
      group,
      providerRequest: request,
    }]));
    repository.mergeProviderRequestResultSnapshotByProviderRequestId = vi.fn(async () => ({
      group,
      providerRequest: request,
    }));
    const kakaoClient = createKakaoClient({
      listAlimtalkMessages: vi.fn(async (query) =>
        kakaoResultPage([
          createKakaoProviderMessage({
            messageStatus: 'FAILED',
            requestId: request.providerRequestId,
            requestRef: 'reqfallback1',
            resendResultCode: '1000',
            resendStatus: 'RSC04',
            resultCode: 'MRC04',
          }),
        ], { pageSize: query.pageSize, totalCount: 1 })),
    });
    const service = createMessageLogService({
      repository,
      smsClient: createSmsClient(),
      kakaoClient,
      now: () => FIXED_NOW,
    });

    const result = await service.correctDueMessageResults({ limit: 10, workerId: 'worker-fallback' });

    expect(result).toMatchObject({ correctedCount: 1, errorCount: 0, processedCount: 1 });
    expect(repository.mergeProviderRequestResultSnapshotByProviderRequestId).toHaveBeenCalledWith(
      expect.objectContaining({
        authoritative: true,
        fallbackResults: [
          { recipientSeq: 1, resendResultCode: '1000', resendStatus: 'RSC04' },
        ],
        finalize: false,
        finalizeFallback: false,
        providerRequestId: request.providerRequestId,
      })
    );
  });

  it('does not count Kakao completed rows with non-success result codes as successful', async () => {
    const createdAt = new Date(FIXED_NOW.getTime() - 31 * 60 * 1000);
    const repository = createLedgerRepository({
      groups: [
        createGroup({
          channel: CHANNELS.ALIMTALK,
          createdAt,
          id: 'ledger_group_alimtalk_bad_parameter',
          pendingCount: 1,
          senderResourceId: 'kakao_resource_1',
          totalRecipientCount: 1,
        }),
      ],
      requests: [
        createRequest({
          createdAt,
          groupId: 'ledger_group_alimtalk_bad_parameter',
          id: 'ledger_request_alimtalk_bad_parameter',
          pendingCount: 1,
          providerRequestId: 'alimtalk-bad-parameter-provider',
          recipientCount: 1,
          resultSnapshotJson: createInitialResultSnapshot(1),
        }),
      ],
    });
    const kakaoClient = createKakaoClient({
      listAlimtalkMessages: vi.fn(async (query) =>
        kakaoResultPage([
          createKakaoProviderMessage({
            messageStatus: 'COMPLETED',
            requestId: 'alimtalk-bad-parameter-provider',
            requestRef: 'reqbadparameter1',
            resultCode: '1030',
          }),
        ], { pageSize: query.pageSize, totalCount: 1 })),
    });
    const service = createMessageLogService({
      repository,
      smsClient: createSmsClient(),
      kakaoClient,
      now: () => FIXED_NOW,
    });

    await service.correctDueMessageResults({ limit: 10 });
    const failures = await service.listLogGroupRequestFailures({
      actorUserId: 'user_1',
      groupId: 'ledger_group_alimtalk_bad_parameter',
      requestLocalId: 'ledger_request_alimtalk_bad_parameter',
      query: { page: '1', pageSize: '20' },
    });

    expect(repository.mergeCalls).toMatchObject([
      {
        authoritative: true,
        finalize: false,
        providerRequestId: 'alimtalk-bad-parameter-provider',
        results: [{ recipientNo: '01012345678', recipientSeq: 1, resultCode: '1030', state: 'F' }],
      },
    ]);
    expect(repository.requests.find((request) => request.id === 'ledger_request_alimtalk_bad_parameter')).toMatchObject({
      failedCount: 1,
      pendingCount: 0,
      resultState: 'synced',
      resultSnapshotJson: {
        failedRecipientNos: {
          1: '01012345678',
        },
      },
      successCount: 0,
    });
    expect(repository.groups.find((group) => group.id === 'ledger_group_alimtalk_bad_parameter')).toMatchObject({
      failedCount: 1,
      pendingCount: 0,
      resultState: 'synced',
      successCount: 0,
    });
    expect(failures.failures).toMatchObject([
      {
        channel: CHANNELS.ALIMTALK,
        recipientSeq: 1,
        recipientNo: '01012345678',
        resultCode: '1030',
        resultCodeLabel: '실패 · 잘못된 파라미터 요청',
      },
    ]);
  });

  it('merges found Brand Message status polling logs into the local ledger snapshot', async () => {
    const repository = createLedgerRepository({
      groups: [
        createGroup({
          channel: CHANNELS.BRAND_MESSAGE,
          id: 'ledger_group_brand_status',
          pendingCount: 1,
          senderResourceId: 'kakao_resource_1',
          totalRecipientCount: 1,
        }),
      ],
      requests: [
        createRequest({
          groupId: 'ledger_group_brand_status',
          id: 'ledger_request_brand_status',
          pendingCount: 1,
          providerRequestId: 'brand-status-provider',
          recipientCount: 1,
          resultSnapshotJson: createInitialResultSnapshot(1),
        }),
      ],
    });
    const requestRef = deriveRequestRef(CLIENT_REQUEST_ID);
    const kakaoClient = createKakaoClient({
      listBrandMessages: vi.fn(async (query) =>
        kakaoResultPage([
          createKakaoProviderMessage({
            requestId: 'brand-status-provider',
            requestRef,
          }),
        ], { pageSize: query.pageSize, totalCount: 1 })),
    });
    const service = createMessageLogService({
      repository,
      smsClient: createSmsClient(),
      kakaoClient,
      now: () => FIXED_NOW,
    });

    const result = await service.getStatus({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.BRAND_MESSAGE,
        clientRequestId: CLIENT_REQUEST_ID,
        senderResourceId: 'kakao_resource_1',
      },
    });

    expect(result).toMatchObject({
      channel: CHANNELS.BRAND_MESSAGE,
      clientRequestId: CLIENT_REQUEST_ID,
      senderResourceId: 'kakao_resource_1',
      state: 'found',
    });
    expect(kakaoClient.listBrandMessages).toHaveBeenCalledWith(expect.objectContaining({
      senderGroupingKey: buildSenderGroupingKey({
        userRef: 'u1ref',
        billingRef: 'b1ref',
        resourceRef: 'kakaoref1',
        requestRef,
      }),
      senderKey: 'sender-key-1',
    }));
    expect(repository.mergeCalls).toEqual([
      {
        authoritative: false,
        finalize: false,
        providerRequestId: 'brand-status-provider',
        results: [{ recipientSeq: 1, resultCode: 'MRC01', state: 'S' }],
      },
    ]);
    expect(repository.requests.find((request) => request.id === 'ledger_request_brand_status')).toMatchObject({
      pendingCount: 0,
      resultState: 'synced',
      successCount: 1,
    });
  });

  it('merges found status polling failures with failed recipient numbers', async () => {
    const repository = createLedgerRepository({
      groups: [
        createGroup({
          channel: CHANNELS.BRAND_MESSAGE,
          id: 'ledger_group_brand_status_failure',
          pendingCount: 1,
          senderResourceId: 'kakao_resource_1',
          totalRecipientCount: 1,
        }),
      ],
      requests: [
        createRequest({
          groupId: 'ledger_group_brand_status_failure',
          id: 'ledger_request_brand_status_failure',
          pendingCount: 1,
          providerRequestId: 'brand-status-failed-provider',
          recipientCount: 1,
          resultSnapshotJson: createInitialResultSnapshot(1),
        }),
      ],
    });
    const requestRef = deriveRequestRef(CLIENT_REQUEST_ID);
    const kakaoClient = createKakaoClient({
      listBrandMessages: vi.fn(async (query) =>
        kakaoResultPage([
          createKakaoProviderMessage({
            messageStatus: 'COMPLETED',
            requestId: 'brand-status-failed-provider',
            requestRef,
            resultCode: 'MRC04',
          }),
        ], { pageSize: query.pageSize, totalCount: 1 })),
    });
    const service = createMessageLogService({
      repository,
      smsClient: createSmsClient(),
      kakaoClient,
      now: () => FIXED_NOW,
    });

    await service.getStatus({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.BRAND_MESSAGE,
        clientRequestId: CLIENT_REQUEST_ID,
        senderResourceId: 'kakao_resource_1',
      },
    });

    expect(repository.mergeCalls).toEqual([
      {
        authoritative: false,
        finalize: false,
        providerRequestId: 'brand-status-failed-provider',
        results: [{ recipientNo: '01012345678', recipientSeq: 1, resultCode: 'MRC04', state: 'F' }],
      },
    ]);
    expect(repository.requests.find((request) => request.id === 'ledger_request_brand_status_failure')).toMatchObject({
      failedCount: 1,
      pendingCount: 0,
      resultSnapshotJson: {
        states: ['F'],
        resultCodes: ['MRC04'],
        failedRecipientNos: {
          1: '01012345678',
        },
      },
    });
  });

  it('uses scheduledAt for correction eligibility and skips future scheduled sends', async () => {
    const repository = createLedgerRepository({ groups: [], requests: [] });
    const oldCreatedAt = new Date(FIXED_NOW.getTime() - 4 * 60 * 60 * 1000);
    const sentScheduledAt = new Date(FIXED_NOW.getTime() - 31 * 60 * 1000);
    const futureScheduledAt = new Date(FIXED_NOW.getTime() + 60 * 60 * 1000);
    repository.groups.push(
      createGroup({
        createdAt: oldCreatedAt,
        id: 'ledger_group_scheduled_due',
        pendingCount: 1,
        scheduledAt: sentScheduledAt,
        sendTiming: 'scheduled',
        totalRecipientCount: 1,
      }),
      createGroup({
        createdAt: oldCreatedAt,
        id: 'ledger_group_scheduled_future',
        pendingCount: 1,
        scheduledAt: futureScheduledAt,
        sendTiming: 'scheduled',
        totalRecipientCount: 1,
      })
    );
    repository.requests.push(
      createRequest({
        createdAt: oldCreatedAt,
        groupId: 'ledger_group_scheduled_due',
        id: 'ledger_request_scheduled_due',
        pendingCount: 1,
        providerRequestId: 'sms-scheduled-due',
        resultSnapshotJson: createInitialResultSnapshot(1),
      }),
      createRequest({
        createdAt: oldCreatedAt,
        groupId: 'ledger_group_scheduled_future',
        id: 'ledger_request_scheduled_future',
        pendingCount: 1,
        providerRequestId: 'sms-scheduled-future',
        resultSnapshotJson: createInitialResultSnapshot(1),
      })
    );
    const smsClient = createSmsClient({
      listMessageResults: vi.fn(async () => smsResultPage([
        { requestId: 'sms-scheduled-due', recipientSeq: 1, resultCode: '1000' },
      ])),
    });
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    await service.correctDueMessageResults({ limit: 10 });

    expect(smsClient.listMessageResults).toHaveBeenCalledTimes(1);
    expect(repository.requests.find((request) => request.id === 'ledger_request_scheduled_due')).toMatchObject({
      resultState: 'synced',
      successCount: 1,
    });
    expect(repository.requests.find((request) => request.id === 'ledger_request_scheduled_future')).toMatchObject({
      resultState: 'not_synced',
      successCount: 0,
    });
  });

  it('finalizes unresolved two-hour correction rows as stale', async () => {
    const repository = createLedgerRepository({ groups: [], requests: [] });
    const createdAt = new Date(FIXED_NOW.getTime() - 121 * 60 * 1000);
    repository.groups.push(createGroup({
      createdAt,
      id: 'ledger_group_final',
      pendingCount: 2,
      totalRecipientCount: 2,
    }));
    repository.requests.push(createRequest({
      createdAt,
      groupId: 'ledger_group_final',
      id: 'ledger_request_final',
      pendingCount: 2,
      providerRequestId: 'sms-final-provider',
      recipientCount: 2,
      resultSnapshotJson: createInitialResultSnapshot(2),
    }));
    const smsClient = createSmsClient({
      listMessageResults: vi.fn(async () => smsResultPage([])),
    });
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    const result = await service.correctDueMessageResults({ limit: 10 });

    expect(result).toMatchObject({
      finalizedCount: 1,
      staleCount: 1,
    });
    expect(repository.requests.find((request) => request.id === 'ledger_request_final')).toMatchObject({
      pendingCount: 2,
      resultFinalizedAt: FIXED_NOW,
      resultState: 'stale',
    });
    expect(repository.groups.find((group) => group.id === 'ledger_group_final')).toMatchObject({
      pendingCount: 2,
      resultFinalizedAt: FIXED_NOW,
      resultState: 'stale',
    });
  });

  it('finalizes unresolved two-hour Kakao correction rows as stale', async () => {
    const repository = createLedgerRepository({ groups: [], requests: [] });
    const createdAt = new Date(FIXED_NOW.getTime() - 121 * 60 * 1000);
    repository.groups.push(createGroup({
      channel: CHANNELS.BRAND_MESSAGE,
      createdAt,
      id: 'ledger_group_brand_final',
      pendingCount: 2,
      senderResourceId: 'kakao_resource_1',
      totalRecipientCount: 2,
    }));
    repository.requests.push(createRequest({
      createdAt,
      groupId: 'ledger_group_brand_final',
      id: 'ledger_request_brand_final',
      pendingCount: 2,
      providerRequestId: 'brand-final-provider',
      recipientCount: 2,
      resultSnapshotJson: createInitialResultSnapshot(2),
    }));
    const smsClient = createSmsClient();
    const kakaoClient = createKakaoClient({
      listBrandMessages: vi.fn(async () => kakaoResultPage([])),
    });
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient,
      now: () => FIXED_NOW,
    });

    const result = await service.correctDueMessageResults({ limit: 10 });

    expect(result).toMatchObject({
      finalizedCount: 1,
      staleCount: 1,
    });
    expect(kakaoClient.listBrandMessages).toHaveBeenCalledTimes(1);
    expect(smsClient.listMessageResults).not.toHaveBeenCalled();
    expect(repository.requests.find((request) => request.id === 'ledger_request_brand_final')).toMatchObject({
      pendingCount: 2,
      resultFinalizedAt: FIXED_NOW,
      resultState: 'stale',
    });
    expect(repository.groups.find((group) => group.id === 'ledger_group_brand_final')).toMatchObject({
      pendingCount: 2,
      resultFinalizedAt: FIXED_NOW,
      resultState: 'stale',
    });
  });

  it('splits message-results correction windows at one day and overlaps the cursor', async () => {
    const repository = createLedgerRepository({ groups: [], requests: [] });
    const createdAt = new Date('2026-06-07T00:00:00.000Z');
    const resultSyncedAt = new Date('2026-06-07T06:00:00.000Z');
    repository.groups.push(createGroup({
      createdAt,
      id: 'ledger_group_split',
      pendingCount: 1,
      totalRecipientCount: 1,
    }));
    repository.requests.push(createRequest({
      createdAt,
      groupId: 'ledger_group_split',
      id: 'ledger_request_split',
      pendingCount: 1,
      providerRequestId: 'sms-split-provider',
      recipientCount: 1,
      resultSnapshotJson: createInitialResultSnapshot(1),
      resultSyncedAt,
      syncAttempts: 1,
    }));
    const smsClient = createSmsClient({
      listMessageResults: vi.fn(async () => smsResultPage([])),
    });
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    await service.correctDueMessageResults({ limit: 10 });

    const queries = smsClient.listMessageResults.mock.calls.map(([query]) => query);
    expect(queries.length).toBeGreaterThan(1);
    expect(queries[0]).toMatchObject({
      startUpdateDate: '2026-06-07 14:55:00',
    });
    for (const query of queries) {
      expect(Date.parse(query.endUpdateDate.replace(' ', 'T')) - Date.parse(query.startUpdateDate.replace(' ', 'T')))
        .toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    }
  });

  it('filters message-results rows and authoritatively corrects webhook conflicts', async () => {
    const repository = createLedgerRepository({ groups: [], requests: [] });
    const createdAt = new Date(FIXED_NOW.getTime() - 31 * 60 * 1000);
    repository.groups.push(createGroup({
      createdAt,
      failedCount: 1,
      id: 'ledger_group_conflict',
      pendingCount: 1,
      totalRecipientCount: 2,
    }));
    repository.requests.push(createRequest({
      createdAt,
      failedCount: 1,
      groupId: 'ledger_group_conflict',
      id: 'ledger_request_conflict',
      pendingCount: 1,
      providerRequestId: 'sms-conflict-provider',
      recipientCount: 2,
      resultSnapshotJson: {
        states: ['F', 'P'],
        resultCodes: ['3003', null],
      },
      resultSnapshotVersion: 1,
      resultState: 'partially_synced',
    }));
    const smsClient = createSmsClient({
      listMessageResults: vi.fn(async () => smsResultPage([
        { requestId: 'sms-conflict-provider', recipientSeq: 1, resultCode: '1000' },
        { requestId: 'sms-conflict-provider', recipientSeq: 2, resultCode: '1000' },
        { requestId: 'sms-conflict-provider', recipientSeq: 3, resultCode: '1000' },
        { requestId: 'other-provider', recipientSeq: 1, resultCode: '1000' },
      ])),
    });
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    await service.correctDueMessageResults({ limit: 10 });

    expect(repository.mergeCalls).toEqual([
      {
        authoritative: true,
        finalize: false,
        providerRequestId: 'sms-conflict-provider',
        results: [
          { recipientGroupingKey: null, recipientSeq: 1, resultCode: '1000', state: 'S' },
          { recipientGroupingKey: null, recipientSeq: 2, resultCode: '1000', state: 'S' },
        ],
      },
    ]);
    expect(repository.requests.find((request) => request.id === 'ledger_request_conflict')).toMatchObject({
      failedCount: 0,
      pendingCount: 0,
      resultSnapshotJson: {
        states: ['S', 'S'],
        resultCodes: ['1000', '1000'],
      },
      resultSnapshotVersion: 2,
      resultState: 'synced',
      successCount: 2,
    });
  });

  it('lists only sends whose effective send time has arrived', async () => {
    const repository = createLedgerRepository();
    const pastScheduledAt = new Date(FIXED_NOW.getTime() - 30 * 60 * 1000);
    repository.groups.push(
      createGroup({
        id: 'ledger_group_scheduled_sent',
        managementTitle: 'Scheduled sent notice',
        scheduledAt: pastScheduledAt,
        sendTiming: 'scheduled',
      }),
      createGroup({
        createdAt: new Date(FIXED_NOW.getTime() - 60 * 60 * 1000),
        id: 'ledger_group_future_scheduled',
        managementTitle: 'Future scheduled notice',
        scheduledAt: new Date(FIXED_NOW.getTime() + 60 * 60 * 1000),
        sendTiming: 'scheduled',
      })
    );
    repository.requests.push(
      createRequest({ groupId: 'ledger_group_scheduled_sent', id: 'ledger_request_scheduled_sent' }),
      createRequest({ groupId: 'ledger_group_future_scheduled', id: 'ledger_request_future_scheduled' })
    );
    const service = createMessageLogService({
      repository,
      smsClient: createSmsClient(),
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    const result = await service.listLogGroups({
      actorUserId: 'user_1',
      query: { channel: CHANNELS.SMS, page: '1', pageSize: '20' },
    });

    expect(result.groups.map((group) => group.id)).toContain('ledger_group_scheduled_sent');
    expect(result.groups.map((group) => group.id)).not.toContain('ledger_group_future_scheduled');
    expect(result.groups.find((group) => group.id === 'ledger_group_scheduled_sent')).toMatchObject({
      requestDate: pastScheduledAt.toISOString(),
      sendTiming: 'scheduled',
    });
  });

  it('shows development message log cases without provider scans or local ledger rows', async () => {
    const repository = createDemoRepository();
    const smsClient = createSmsClient();
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    const list = await service.listLogGroups({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        demo: 'cases',
        page: '1',
        pageSize: '20',
      },
    });
    const detail = await service.getLogGroupDetail({
      actorUserId: 'user_1',
      groupId: 'dev-log-case-sms-bulk-success',
      query: { channel: CHANNELS.SMS },
    });
    const recipients = await service.listLogGroupRequestRecipients({
      actorUserId: 'user_1',
      groupId: 'dev-log-case-sms-bulk-success',
      requestLocalId: detail.requests[0].id,
      query: { page: '1', pageSize: '100' },
    });
    const recipientDetail = await service.getDetail({
      actorUserId: 'user_1',
      channel: CHANNELS.SMS,
      requestId: recipients.recipients[0].requestId,
      recipientSeq: recipients.recipients[0].recipientSeq,
    });

    expect(list).toMatchObject({
      demo: true,
      channel: CHANNELS.SMS,
      total: 11,
    });
    expect(list.groups.map((group) => group.managementTitle)).toContain('대량 SMS - 전체 성공');
    expect(list.groups.map((group) => group.managementTitle)).toContain('예약 SMS - 발송 완료');
    expect(list.groups.map((group) => group.providerState)).toEqual(expect.arrayContaining([
      'accepted',
      'failed',
      'partial',
      'queued',
      'unknown',
    ]));
    expect(detail.requests[0]).toMatchObject({
      canFetchRecipients: true,
      providerState: 'accepted',
    });
    expect(detail.requests[0]).not.toHaveProperty('providerRequestId');
    expect(recipients.recipients).toHaveLength(3);
    expect(recipientDetail).toMatchObject({
      detail: {
        recipientNo: recipients.recipients[0].recipientNo,
      },
      requestId: recipients.recipients[0].requestId,
    });
    expect(smsClient.listSmsMessages).not.toHaveBeenCalled();
    expect(smsClient.getSmsMessage).not.toHaveBeenCalled();
  });

  it('keeps development demo sync and resend local-only', async () => {
    const repository = createDemoRepository();
    const smsClient = createSmsClient();
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    const sync = await service.syncLogGroupResults({
      actorUserId: 'user_1',
      groupId: 'dev-log-case-sms-bulk-success',
    });
    const resend = await service.resend({
      actorUserId: 'user_1',
      channel: CHANNELS.SMS,
      requestId: 'dev-provider-request-sms-provider-failed-1',
      recipientSeq: 1,
    });

    expect(sync).toMatchObject({
      demo: true,
      state: 'completed',
      group: { id: 'dev-log-case-sms-bulk-success' },
    });
    expect(resend).toMatchObject({
      demo: true,
      state: 'accepted',
    });
    expect(smsClient.listSmsMessages).not.toHaveBeenCalled();
    expect(smsClient.getSmsMessage).not.toHaveBeenCalled();
  });

  it('keeps development demo export local-only', async () => {
    const repository = createDemoRepository();
    const smsClient = createSmsClient();
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    const result = await service.exportLogs({
      actorUserId: 'user_1',
      query: {
        channel: CHANNELS.SMS,
        demo: 'cases',
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
      },
    });
    const csv = await readStream(result.stream);

    expect(result).toMatchObject({
      demo: true,
      filename: 'message-log-demo-cases.csv',
      rowCount: 0,
    });
    expect(csv).toBe('id,channel,requestId,recipientSeq,senderLabel,recipientNo,contentPreview,templateCode,requestDate,receiveDate,status,resultCode,resultMessage\n');
    expect(smsClient.listSmsMessages).not.toHaveBeenCalled();
  });

  it('fails closed when a provider request id is not in the local ledger', async () => {
    const repository = createLedgerRepository();
    const smsClient = createSmsClient();
    const service = createMessageLogService({
      repository,
      smsClient,
      kakaoClient: createKakaoClient(),
      now: () => FIXED_NOW,
    });

    await expect(
      service.getDetail({
        actorUserId: 'user_1',
        channel: CHANNELS.SMS,
        requestId: 'not-owned-provider-id',
        recipientSeq: 1,
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(smsClient.getSmsMessage).not.toHaveBeenCalled();
  });
});

function createDemoRepository() {
  return {
    async getUserById(userId) {
      return userId === 'user_1' ? { id: 'user_1', status: 'active' } : null;
    },
  };
}

function createLedgerRepository(overrides = {}) {
  return {
    persistedRecipientRows: [],
    users: [
      { id: 'user_1', userRef: 'u1ref', status: 'active' },
      { id: 'other_user', userRef: 'otherref', status: 'active' },
    ],
    billingAccounts: [{ id: 'billing_1', billingRef: 'b1ref', ownerId: 'user_1', ownerType: 'user', status: 'active' }],
    resources: [{
      displayName: 'Main SMS',
      id: 'sms_resource_1',
      provider: 'nhn',
      resourceRef: 'smsref1',
      status: 'active',
      type: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
      value: '15446859',
    }, {
      displayName: '@store',
      id: 'kakao_resource_1',
      provider: 'nhn',
      resourceRef: 'kakaoref1',
      status: 'active',
      type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
      value: 'sender-key-1',
    }],
    links: [
      {
        billingAccountId: 'billing_1',
        role: 'viewer',
        senderResourceId: 'sms_resource_1',
        status: 'active',
        userId: 'user_1',
      },
      {
        billingAccountId: 'billing_1',
        role: 'viewer',
        senderResourceId: 'kakao_resource_1',
        status: 'active',
        userId: 'user_1',
      },
    ],
    groups: overrides.groups ?? [
      createGroup({ id: 'ledger_group_sms', managementTitle: 'SMS notice' }),
      createGroup({
        channel: CHANNELS.LMS,
        createdAt: FIXED_NOW,
        id: 'ledger_group_lms',
        managementTitle: 'LMS notice',
        resultState: 'synced',
        successCount: 1,
      }),
      createGroup({ archivedAt: FIXED_NOW, id: 'ledger_group_archived' }),
      createGroup({ id: 'ledger_group_other_actor', userId: 'other_user' }),
    ],
    requests: overrides.requests ?? [
      createRequest({ groupId: 'ledger_group_sms', id: 'ledger_request_sms' }),
      createRequest({ groupId: 'ledger_group_lms', id: 'ledger_request_lms', providerRequestId: 'lms-provider-1' }),
    ],
    mergeCalls: [],
    async countGroupsForActor(args) {
      return (await this.listGroupsForActor({ ...args, limit: 100, offset: 0 })).length;
    },
    async getBillingAccountById(billingAccountId) {
      return this.billingAccounts.find((item) => item.id === billingAccountId) ?? null;
    },
    async findBillingAccountForUser(userId) {
      return this.billingAccounts.find((item) => item.ownerId === userId) ?? null;
    },
    async getGroupForActor({ actorUserId, groupId, includeArchived = false }) {
      return this.groups.find((group) => (
        group.id === groupId
        && group.userId === actorUserId
        && (includeArchived || !group.archivedAt)
      )) ?? null;
    },
    async getGroupById({ groupId, includeArchived = false }) {
      return this.groups.find((group) => (
        group.id === groupId
        && (includeArchived || !group.archivedAt)
      )) ?? null;
    },
    async getProviderRequestForActor({ actorUserId, requestId, includeArchived = false }) {
      const request = this.requests.find((item) => item.id === requestId);
      const group = request ? this.groups.find((item) => item.id === request.groupId) : null;
      if (!request || !group || group.userId !== actorUserId || (!includeArchived && group.archivedAt)) return null;
      return { group, providerRequest: request };
    },
    async getProviderRequestForActorByProviderRequestId({ actorUserId, channel, providerRequestId }) {
      const request = this.requests.find((item) => item.providerRequestId === providerRequestId);
      const group = request ? this.groups.find((item) => item.id === request.groupId) : null;
      if (!request || !group || group.userId !== actorUserId || group.channel !== channel || group.archivedAt) return null;
      return { group, providerRequest: request };
    },
    async getUserById(userId) {
      return this.users.find((user) => user.id === userId) ?? null;
    },
    async listGroupsForActor({
      actorUserId,
      channels,
      includeArchived = false,
      limit = 20,
      offset = 0,
      senderResourceIds,
      sentAtFrom,
      sentAtTo,
      sentAtUntil,
    }) {
      return this.groups
        .filter((group) => group.userId === actorUserId)
        .filter((group) => !channels?.length || channels.includes(group.channel))
        .filter((group) => !senderResourceIds?.length || senderResourceIds.includes(group.senderResourceId))
        .filter((group) => isGroupSentAtInRange(group, { sentAtFrom, sentAtTo, sentAtUntil }))
        .filter((group) => includeArchived || !group.archivedAt)
        .sort((left, right) => Number(getGroupSentAt(right)) - Number(getGroupSentAt(left)) || left.id.localeCompare(right.id))
        .slice(offset, offset + limit);
    },
    async listProviderRequestsForGroup(groupId) {
      return this.requests.filter((request) => request.groupId === groupId);
    },
    async listUserSenderResources(userId) {
      return this.links
        .filter((link) => link.userId === userId)
        .map((link) => ({
          link,
          resource: this.resources.find((resource) => resource.id === link.senderResourceId),
        }));
    },
    async updateGroup({ groupId, values, now = FIXED_NOW }) {
      const group = this.groups.find((item) => item.id === groupId);
      if (!group) return null;
      Object.assign(group, values, { updatedAt: now });
      return group;
    },
    async updateProviderRequest({ requestId, values, now = FIXED_NOW }) {
      const request = this.requests.find((item) => item.id === requestId);
      if (!request) return null;
      Object.assign(request, values, { updatedAt: now });
      return request;
    },
    async leaseMessageResultCorrectionRequests({
      finalCorrectionDueBefore,
      firstCorrectionDueBefore,
      leaseExpiresAt,
      limit = 10,
      now = FIXED_NOW,
      workerId,
    }) {
      const candidates = this.requests
        .map((request) => ({
          group: this.groups.find((group) => group.id === request.groupId),
          providerRequest: request,
        }))
        .filter(({ group, providerRequest }) => {
          const effectiveAt = group?.scheduledAt ?? providerRequest.createdAt ?? group?.createdAt;
          const syncAttempts = Number(providerRequest.syncAttempts ?? 0);

          return group
            && [
              CHANNELS.SMS,
              CHANNELS.LMS,
              CHANNELS.MMS,
              CHANNELS.ALIMTALK,
              CHANNELS.BRAND_MESSAGE,
            ].includes(group.channel)
            && !group.archivedAt
            && !group.resultFinalizedAt
            && ['accepted', 'partial'].includes(group.providerState)
            && providerRequest.providerState === 'accepted'
            && providerRequest.providerRequestId
            && providerRequest.resultSnapshotJson
            && !providerRequest.resultFinalizedAt
            && providerRequest.pendingCount > 0
            && effectiveAt
            && effectiveAt <= now
            && (
              (syncAttempts === 0 && effectiveAt <= firstCorrectionDueBefore)
              || effectiveAt <= finalCorrectionDueBefore
            )
            && (!providerRequest.syncLeaseExpiresAt || providerRequest.syncLeaseExpiresAt <= now);
        })
        .sort(({ group: leftGroup, providerRequest: left }, { group: rightGroup, providerRequest: right }) => {
          const leftEffective = leftGroup.scheduledAt ?? left.createdAt ?? leftGroup.createdAt;
          const rightEffective = rightGroup.scheduledAt ?? right.createdAt ?? rightGroup.createdAt;
          return Number(leftEffective) - Number(rightEffective) || left.id.localeCompare(right.id);
        })
        .slice(0, limit);

      for (const { providerRequest } of candidates) {
        providerRequest.resultState = 'syncing';
        providerRequest.syncAttempts = Number(providerRequest.syncAttempts ?? 0) + 1;
        providerRequest.syncLeaseExpiresAt = leaseExpiresAt;
        providerRequest.syncLockedBy = workerId;
        providerRequest.updatedAt = now;
      }

      return candidates;
    },
    async mergeProviderRequestResultSnapshotByProviderRequestId({
      authoritative = false,
      clearSyncLease = false,
      finalize = false,
      nextSyncAtWhenPending,
      now = FIXED_NOW,
      providerRequestId,
      results = [],
      updateNextSyncAt = false,
    }) {
      this.mergeCalls.push({ authoritative, finalize, providerRequestId, results });
      const request = this.requests.find((item) => item.providerRequestId === providerRequestId);
      const group = request ? this.groups.find((item) => item.id === request.groupId) : null;
      if (!request || !group) return null;

      const merge = mergeResultSnapshotEntries({
        authoritative,
        entries: results,
        recipientCount: request.recipientCount,
        snapshot: request.resultSnapshotJson,
      });
      const shouldFinalize = finalize || merge.counts.pendingCount === 0;
      const shouldUpdate = Boolean(
        merge.changedCount > 0
          || merge.initialized
          || finalize
          || clearSyncLease
          || updateNextSyncAt
      );

      if (shouldUpdate) {
        Object.assign(request, merge.counts, {
          firstResultReceivedAt: request.firstResultReceivedAt ?? (merge.firstTerminalChanged ? now : null),
          resultFinalizedAt: shouldFinalize ? (request.resultFinalizedAt ?? now) : request.resultFinalizedAt,
          resultSnapshotJson: merge.snapshot,
          resultSnapshotVersion: Number(request.resultSnapshotVersion ?? 0) + (merge.changedCount > 0 ? 1 : 0),
          resultState: getMemoryResultStateFromCounts(merge.counts, { finalized: shouldFinalize }),
          resultSyncedAt: now,
          updatedAt: now,
        });

        if (clearSyncLease) {
          request.syncLeaseExpiresAt = null;
          request.syncLockedBy = null;
        }

        if (updateNextSyncAt) {
          request.nextSyncAt = shouldFinalize ? null : nextSyncAtWhenPending;
        }
      }

      rollupMemoryGroupFromRequests(group, this.requests, now);

      return {
        changedCount: merge.changedCount,
        group,
        groupId: group.id,
        providerRequest: request,
      };
    },
  };
}

function createTestWebhookReceiver({ repository }) {
  return createNhnSmsWebhookReceiver({
    env: WEBHOOK_ENV,
    now: () => FIXED_NOW,
    repository,
  });
}

function createWebhookRequest({ body, headers = {} } = {}) {
  return new Request(WEBHOOK_URL, {
    body: JSON.stringify(body ?? createWebhookPayload()),
    headers: {
      'content-type': 'application/json',
      'X-Nhn-Webhook-Signature': 'webhook-secret',
      ...headers,
    },
    method: 'POST',
  });
}

function createWebhookPayload(overrides = {}) {
  return {
    appKey: 'sms-app-key',
    event: 'MESSAGE_RESULT_UPDATE',
    hooks: [createWebhookHook()],
    hooksId: 'hooks-1',
    productName: 'SMS',
    webhookConfigId: 'webhook-config-1',
    ...overrides,
  };
}

function createWebhookHook({
  messageStatus = 'COMPLETED',
  recipientSeq = 1,
  requestId = 'sms-provider-1',
  requestRef = 'reqledger1',
  resultCode = '1000',
} = {}) {
  const senderGroupingKey = buildSenderGroupingKey({
    userRef: 'u1ref',
    billingRef: 'b1ref',
    resourceRef: 'smsref1',
    requestRef,
  });

  return {
    hookId: `hook-${requestId}-${recipientSeq}`,
    messageStatus,
    receiveDate: '2026-06-09T06:00:10',
    recipientGroupingKey: buildRecipientGroupingKey(senderGroupingKey, recipientSeq - 1),
    recipientSeq,
    requestDate: '2026-06-09T06:00:00',
    requestId,
    resultCode,
    sendNo: '15446859',
    senderGroupingKey,
    senderType: 'NORMAL_SMS',
  };
}

function createBulkRequests({ groupId, initializeSnapshot = false, providerRequestIds }) {
  return providerRequestIds.map((providerRequestId, index) => {
    const snapshot = initializeSnapshot ? createInitialResultSnapshot(1) : undefined;

    return createRequest({
      groupId,
      id: `${groupId}_request_${index + 1}`,
      pendingCount: snapshot ? 1 : 0,
      providerRequestId,
      recipientCount: 1,
      resultSnapshotJson: snapshot,
      sequence: index + 1,
    });
  });
}

function createGroup(overrides = {}) {
  return {
    acceptedRequestCount: 1,
    billingAccountId: 'billing_1',
    canceledCount: 0,
    channel: CHANNELS.SMS,
    createdAt: new Date('2026-06-09T06:00:00.000Z'),
    expiresAt: new Date('2026-09-07T06:00:00.000Z'),
    failedCount: 0,
    id: 'ledger_group_sms',
    managementTitle: 'SMS notice',
    pendingCount: 0,
    providerRequestCount: 1,
    providerState: 'accepted',
    resultState: 'not_synced',
    senderResourceId: 'sms_resource_1',
    sendKind: 'basic',
    sendTiming: 'immediate',
    successCount: 0,
    totalRecipientCount: 1,
    userId: 'user_1',
    ...overrides,
  };
}

function getGroupSentAt(group) {
  return group?.scheduledAt ?? group?.createdAt ?? null;
}

function isGroupSentAtInRange(group, { sentAtFrom, sentAtTo, sentAtUntil }) {
  const sentAt = getGroupSentAt(group);
  if (!sentAt) return false;
  if (sentAtFrom && sentAt < sentAtFrom) return false;
  if (sentAtTo && sentAt > sentAtTo) return false;
  if (sentAtUntil && sentAt > sentAtUntil) return false;
  return true;
}

function createRequest(overrides = {}) {
  return {
    canceledCount: 0,
    createdAt: new Date('2026-06-09T06:00:00.000Z'),
    failedCount: 0,
    groupId: 'ledger_group_sms',
    id: 'ledger_request_sms',
    pendingCount: 0,
    providerRequestId: 'sms-provider-1',
    providerState: 'accepted',
    recipientCount: 1,
    resultSnapshotVersion: 0,
    resultState: 'not_synced',
    sequence: 1,
    successCount: 0,
    ...overrides,
  };
}

function createSmsClient(overrides = {}) {
  return {
    getSmsMessage: overrides.getSmsMessage ?? vi.fn(),
    listMessageResults: overrides.listMessageResults ?? vi.fn(async () => smsResultPage([])),
    listSmsMessages: overrides.listSmsMessages ?? vi.fn(),
    listMmsMessages: overrides.listMmsMessages ?? vi.fn(),
  };
}

function createKakaoClient(overrides = {}) {
  return {
    getAlimtalkMessage: overrides.getAlimtalkMessage ?? vi.fn(),
    getBrandMessage: overrides.getBrandMessage ?? vi.fn(),
    listAlimtalkMessages: overrides.listAlimtalkMessages ?? vi.fn(),
    listBrandMessages: overrides.listBrandMessages ?? vi.fn(),
  };
}

function smsResultPage(items, overrides = {}) {
  return {
    body: {
      data: items,
      pageNum: overrides.pageNum ?? 1,
      pageSize: overrides.pageSize ?? 1000,
      totalCount: overrides.totalCount ?? items.length,
    },
    header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
  };
}

function kakaoResultPage(items, overrides = {}) {
  return {
    header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
    messageSearchResultResponse: {
      messages: items,
      pageNum: overrides.pageNum ?? 1,
      pageSize: overrides.pageSize ?? 1000,
      totalCount: overrides.totalCount ?? items.length,
    },
  };
}

function createKakaoProviderMessage({
  messageStatus = 'COMPLETED',
  recipientSeq = 1,
  requestId,
  requestRef,
  resendResultCode,
  resendStatus,
  resultCode = 'MRC01',
} = {}) {
  const senderGroupingKey = buildSenderGroupingKey({
    userRef: 'u1ref',
    billingRef: 'b1ref',
    resourceRef: 'kakaoref1',
    requestRef,
  });

  return {
    content: 'Sensitive kakao body',
    messageStatus,
    receiveDate: '2026-06-09 14:35',
    recipientGroupingKey: buildRecipientGroupingKey(senderGroupingKey, recipientSeq - 1),
    recipientNo: '01012345678',
    recipientSeq,
    requestDate: '2026-06-09 14:30',
    requestId,
    resultCode,
    resultMessage: resultCode === 'MRC01' ? 'SUCCESS' : 'FAILED',
    ...(resendResultCode ? { resendResultCode } : {}),
    ...(resendStatus ? { resendStatus } : {}),
    senderGroupingKey,
    templateCode: 'ORDER_READY',
  };
}

function rollupMemoryGroupFromRequests(group, requests, now) {
  const groupRequests = requests.filter((request) => request.groupId === group.id);

  Object.assign(group, {
    acceptedRequestCount: groupRequests.filter((request) => request.providerState === 'accepted').length,
    canceledCount: sumMemoryRequestCount(groupRequests, 'canceledCount'),
    failedCount: sumMemoryRequestCount(groupRequests, 'failedCount'),
    pendingCount: sumMemoryRequestCount(groupRequests, 'pendingCount'),
    providerRequestCount: groupRequests.length,
    resultFinalizedAt: groupRequests.every((request) => request.resultFinalizedAt)
      ? latestDate(groupRequests.map((request) => request.resultFinalizedAt))
      : null,
    resultState: getMemoryGroupResultState(groupRequests),
    resultSyncedAt: latestDate(groupRequests.map((request) => request.resultSyncedAt)),
    successCount: sumMemoryRequestCount(groupRequests, 'successCount'),
    updatedAt: now,
  });

  return group;
}

function sumMemoryRequestCount(requests, key) {
  return requests.reduce((total, request) => total + Number(request[key] ?? 0), 0);
}

function getMemoryResultStateFromCounts(counts, { finalized = false } = {}) {
  const total = counts.successCount + counts.failedCount + counts.pendingCount + counts.canceledCount;
  if (finalized && counts.pendingCount > 0) return 'stale';
  if (total === 0 || counts.pendingCount === total) return 'not_synced';
  if (counts.pendingCount > 0) return 'partially_synced';
  return 'synced';
}

function getMemoryGroupResultState(requests) {
  if (requests.every((request) => request.resultState === 'synced')) return 'synced';
  if (requests.some((request) => request.resultState === 'syncing')) return 'syncing';
  if (requests.some((request) => request.resultState === 'stale')) return 'stale';
  if (requests.some((request) => request.resultState === 'partially_synced')) return 'partially_synced';
  if (requests.some((request) => request.resultState === 'synced')) return 'partially_synced';
  if (requests.some((request) => request.resultState === 'error')) return 'error';
  return 'not_synced';
}

function latestDate(values) {
  const dates = values.filter(Boolean).map((value) => new Date(value)).filter((date) => Number.isFinite(date.getTime()));
  if (!dates.length) return null;

  return new Date(Math.max(...dates.map((date) => date.getTime())));
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
