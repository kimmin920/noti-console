import { describe, expect, it, vi } from 'vitest';

import { createSettlementService } from '../settlements/service.js';
import { CHANNELS, SENDER_RESOURCE_TYPES } from '../relay/constants.js';
import { NhnProviderError } from '../relay/errors.js';
import { buildRecipientGroupingKey, buildSenderGroupingKey } from '../relay/groupingKeys.js';

const FIXED_NOW = new Date('2026-06-02T03:00:00.000Z');
const PERIOD = {
  startReceiveDate: '2026-06-01T00:00:00+09:00',
  endReceiveDate: '2026-06-01T23:59:59+09:00',
};

describe('settlement aggregation service', () => {
  it('aggregates successful SMS and AlimTalk deliveries into summaries only', async () => {
    const repository = createMemoryRepository();
    const smsGroupingKey = senderGroupingKey({ requestRef: 'smsreq1' });
    const kakaoGroupingKey = senderGroupingKey({ resourceRef: 'kakaoref1', requestRef: 'alimreq1' });
    const smsClient = createSmsClient({
      listMessageResults: vi.fn(async (query) =>
        query.messageType === 'SMS'
          ? smsResultPage([
              createSmsResult({
                requestId: 'sms-success',
                senderGroupingKey: smsGroupingKey,
                recipientGroupingKey: buildRecipientGroupingKey(smsGroupingKey, 0),
                recipientNo: '01012345678',
                body: 'must not persist',
              }),
              createSmsResult({
                requestId: 'sms-failed',
                senderGroupingKey: smsGroupingKey,
                recipientGroupingKey: buildRecipientGroupingKey(smsGroupingKey, 1),
                msgStatus: '0',
                resultCode: '2000',
              }),
            ])
          : smsResultPage([])
      ),
    });
    const kakaoClient = createKakaoClient({
      listAlimtalkMessageResults: vi.fn(async () =>
        alimtalkResultPage([
          createAlimtalkResult({
            requestId: 'alim-success',
            recipientSeq: 1,
            messageStatus: 'COMPLETED',
            resultCode: 'MRC01',
          }),
        ])
      ),
      getAlimtalkMessage: vi.fn(async () => ({
        message: {
          requestId: 'alim-success',
          recipientSeq: 1,
          recipientNo: '01099999999',
          content: 'rendered content must not persist',
          senderGroupingKey: kakaoGroupingKey,
          recipientGroupingKey: buildRecipientGroupingKey(kakaoGroupingKey, 0),
        },
      })),
    });
    const service = createTestService({ repository, smsClient, kakaoClient });

    const result = await service.createRun({
      actorUserId: 'operator_1',
      payload: PERIOD,
    });

    expect(result.run).toMatchObject({
      status: 'succeeded',
      requestedBy: 'operator_1',
      errorMessage: null,
    });
    expect(result.summaries).toEqual([
      expect.objectContaining({
        billingAccountId: 'billing_1',
        userId: 'user_1',
        channel: CHANNELS.ALIMTALK,
        usageType: 'all',
        deliveredCount: 1,
      }),
      expect.objectContaining({
        billingAccountId: 'billing_1',
        userId: 'user_1',
        channel: CHANNELS.SMS,
        usageType: 'all',
        deliveredCount: 1,
      }),
    ]);
    expect(kakaoClient.getAlimtalkMessage).toHaveBeenCalledWith({
      requestId: 'alim-success',
      recipientSeq: 1,
    });
    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'settlement_run.created',
        actorUserId: 'operator_1',
        targetType: 'settlement_run',
      }),
    ]);
    expect(JSON.stringify(repository.summaries)).not.toContain('01012345678');
    expect(JSON.stringify(repository.summaries)).not.toContain('01099999999');
    expect(JSON.stringify(repository.summaries)).not.toContain('must not persist');
    expect(JSON.stringify(repository.auditLogs)).not.toContain('010');
  });

  it('counts successful AlimTalk SMS fallback as sms usage', async () => {
    const repository = createMemoryRepository();
    const kakaoGroupingKey = senderGroupingKey({ resourceRef: 'kakaoref1', requestRef: 'fallback1' });
    const kakaoClient = createKakaoClient({
      listAlimtalkMessageResults: vi.fn(async () =>
        alimtalkResultPage([
          createAlimtalkResult({
            requestId: 'alim-failed',
            recipientSeq: 1,
            messageStatus: 'FAILED',
            resultCode: 'MRC02',
            resendStatus: 'RSC04',
            resendResultCode: '1000',
            resendRequestId: 'sms-fallback-request',
          }),
        ])
      ),
      getAlimtalkMessage: vi.fn(async () => ({
        message: {
          requestId: 'alim-failed',
          recipientSeq: 1,
          senderGroupingKey: kakaoGroupingKey,
          recipientGroupingKey: buildRecipientGroupingKey(kakaoGroupingKey, 0),
        },
      })),
    });
    const service = createTestService({ repository, kakaoClient });

    const result = await service.createRun({
      actorUserId: 'operator_1',
      payload: PERIOD,
    });

    expect(result.run.status).toBe('succeeded');
    expect(result.summaries).toEqual([
      expect.objectContaining({
        channel: CHANNELS.SMS,
        deliveredCount: 1,
      }),
    ]);
    expect(result.summaries).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: CHANNELS.ALIMTALK,
        }),
      ])
    );
  });

  it('counts NHN Kakao numeric success result codes in settlement summaries', async () => {
    const repository = createMemoryRepository();
    const kakaoGroupingKey = senderGroupingKey({ resourceRef: 'kakaoref1', requestRef: 'alimreq1000' });
    const kakaoClient = createKakaoClient({
      listAlimtalkMessageResults: vi.fn(async () =>
        alimtalkResultPage([
          createAlimtalkResult({
            requestId: 'alim-success-1000',
            recipientSeq: 1,
            messageStatus: 'COMPLETED',
            resultCode: '1000',
          }),
        ])
      ),
      getAlimtalkMessage: vi.fn(async () => ({
        message: {
          requestId: 'alim-success-1000',
          recipientSeq: 1,
          senderGroupingKey: kakaoGroupingKey,
          recipientGroupingKey: buildRecipientGroupingKey(kakaoGroupingKey, 0),
        },
      })),
    });
    const service = createTestService({ repository, kakaoClient });

    const result = await service.createRun({
      actorUserId: 'operator_1',
      payload: PERIOD,
    });

    expect(result.summaries).toEqual([
      expect.objectContaining({
        channel: CHANNELS.ALIMTALK,
        deliveredCount: 1,
      }),
    ]);
  });

  it('does not count provider API result code zero as delivered settlement usage', async () => {
    const repository = createMemoryRepository();
    const smsGroupingKey = senderGroupingKey({ requestRef: 'smszero1' });
    const kakaoGroupingKey = senderGroupingKey({ resourceRef: 'kakaoref1', requestRef: 'alimzero1' });
    const smsClient = createSmsClient({
      listMessageResults: vi.fn(async (query) =>
        query.messageType === 'SMS'
          ? smsResultPage([
              createSmsResult({
                requestId: 'sms-zero',
                senderGroupingKey: smsGroupingKey,
                recipientGroupingKey: buildRecipientGroupingKey(smsGroupingKey, 0),
                msgStatus: '3',
                resultCode: '0',
              }),
            ])
          : smsResultPage([])
      ),
    });
    const kakaoClient = createKakaoClient({
      listAlimtalkMessageResults: vi.fn(async () =>
        alimtalkResultPage([
          createAlimtalkResult({
            requestId: 'alim-zero',
            recipientSeq: 1,
            messageStatus: 'COMPLETED',
            resultCode: '0',
          }),
          createAlimtalkResult({
            requestId: 'alim-fallback-zero',
            recipientSeq: 2,
            messageStatus: 'FAILED',
            resultCode: 'MRC02',
            resendStatus: 'RSC04',
            resendResultCode: '0',
          }),
        ])
      ),
      getAlimtalkMessage: vi.fn(async ({ requestId, recipientSeq }) => ({
        message: {
          requestId,
          recipientSeq,
          senderGroupingKey: kakaoGroupingKey,
          recipientGroupingKey: buildRecipientGroupingKey(kakaoGroupingKey, recipientSeq - 1),
        },
      })),
    });
    const service = createTestService({ repository, smsClient, kakaoClient });

    const result = await service.createRun({
      actorUserId: 'operator_1',
      payload: PERIOD,
    });

    expect(result.summaries).toEqual([]);
  });

  it('splits long periods into safe result-update ranges and pages until exhausted', async () => {
    const repository = createMemoryRepository();
    const smsGroupingKey = senderGroupingKey({ requestRef: 'splitreq1' });
    const smsClient = createSmsClient({
      listMessageResults: vi.fn(async (query) => {
        if (query.messageType !== 'SMS') return smsResultPage([]);
        if (query.startUpdateDate === '2026-06-01 00:00:00' && query.pageNum === 1) {
          return smsResultPage(
            [
              createSmsResult({
                requestId: 'sms-page-one',
                senderGroupingKey: smsGroupingKey,
                recipientGroupingKey: buildRecipientGroupingKey(smsGroupingKey, 0),
              }),
            ],
            { totalCount: 1001, pageSize: 1000 }
          );
        }
        return smsResultPage([], { totalCount: 1001, pageSize: 1000 });
      }),
    });
    const service = createTestService({ repository, smsClient });

    await service.createRun({
      actorUserId: 'operator_1',
      payload: {
        startReceiveDate: '2026-06-01T00:00:00+09:00',
        endReceiveDate: '2026-06-03T00:00:01+09:00',
      },
    });

    const smsCalls = smsClient.listMessageResults.mock.calls
      .map(([query]) => query)
      .filter((query) => query.messageType === 'SMS');

    expect(smsCalls).toEqual([
      expect.objectContaining({
        startUpdateDate: '2026-06-01 00:00:00',
        endUpdateDate: '2026-06-01 23:59:59',
        pageNum: 1,
      }),
      expect.objectContaining({
        startUpdateDate: '2026-06-01 00:00:00',
        endUpdateDate: '2026-06-01 23:59:59',
        pageNum: 2,
      }),
      expect.objectContaining({
        startUpdateDate: '2026-06-02 00:00:00',
        endUpdateDate: '2026-06-02 23:59:59',
        pageNum: 1,
      }),
      expect.objectContaining({
        startUpdateDate: '2026-06-03 00:00:00',
        endUpdateDate: '2026-06-03 00:00:01',
        pageNum: 1,
      }),
    ]);
  });

  it('continues settlement result paging until the provider total count is exhausted', async () => {
    const repository = createMemoryRepository();
    const smsGroupingKey = senderGroupingKey({ requestRef: 'deeppage1' });
    const smsClient = createSmsClient({
      listMessageResults: vi.fn(async (query) => {
        if (query.messageType !== 'SMS') return smsResultPage([]);

        return smsResultPage(
          [
            createSmsResult({
              requestId: `sms-result-page-${query.pageNum}`,
              recipientSeq: query.pageNum,
              senderGroupingKey: smsGroupingKey,
              recipientGroupingKey: buildRecipientGroupingKey(smsGroupingKey, query.pageNum - 1),
            }),
          ],
          { totalCount: 3000, pageSize: 1000 }
        );
      }),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.createRun({
      actorUserId: 'operator_1',
      payload: PERIOD,
    });

    const smsCalls = smsClient.listMessageResults.mock.calls
      .map(([query]) => query)
      .filter((query) => query.messageType === 'SMS');

    expect(smsCalls.map((query) => query.pageNum)).toEqual([1, 2, 3]);
    expect(result.run.status).toBe('succeeded');
    expect(result.summaries).toEqual([
      expect.objectContaining({
        channel: CHANNELS.SMS,
        deliveredCount: 3,
      }),
    ]);
  });

  it('marks the run failed when NHN 429 retries are exhausted', async () => {
    const repository = createMemoryRepository();
    const sleep = vi.fn(async () => {});
    const smsClient = createSmsClient({
      listMessageResults: vi.fn(async () => {
        throw new NhnProviderError({
          status: 429,
          providerCode: 429,
          providerMessage: 'Too Many Requests',
        });
      }),
    });
    const service = createTestService({ repository, smsClient, sleep });

    const result = await service.createRun({
      actorUserId: 'operator_1',
      payload: PERIOD,
    });

    expect(result.run.status).toBe('failed');
    expect(result.run.errorMessage).toContain('Too Many Requests');
    expect(result.summaries).toEqual([]);
    expect(repository.summaries).toEqual([]);
    expect(smsClient.listMessageResults).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 200, 400]);
    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'settlement_run.created',
        targetType: 'settlement_run',
      }),
      expect.objectContaining({
        action: 'provider.rate_limited',
        actorUserId: 'operator_1',
        targetType: 'settlement_run',
        targetId: result.run.id,
        metadataJson: expect.objectContaining({
          operation: 'settlement.aggregate',
          errorSource: 'nhn',
          providerCode: '429',
          providerMessage: 'Too Many Requests',
          retryAttempts: 3,
        }),
      }),
    ]);
    expect(JSON.stringify(repository.auditLogs)).not.toContain('010');
    expect(JSON.stringify(repository.auditLogs)).not.toContain('must not persist');
  });

  it('finalizes succeeded runs once and rejects later mutation', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });
    const created = await service.createRun({
      actorUserId: 'operator_1',
      payload: PERIOD,
    });

    const finalized = await service.finalizeRun({
      actorUserId: 'operator_1',
      runId: created.run.id,
    });

    expect(finalized.run).toMatchObject({
      id: created.run.id,
      status: 'finalized',
      finalizedBy: 'operator_1',
      finalizedAt: FIXED_NOW.toISOString(),
    });
    expect(repository.auditLogs.map((log) => log.action)).toEqual([
      'settlement_run.created',
      'settlement_run.finalized',
    ]);

    await expect(
      service.finalizeRun({
        actorUserId: 'operator_1',
        runId: created.run.id,
      })
    ).rejects.toThrow('already finalized');
  });
});

function createTestService({ repository, smsClient, kakaoClient, sleep } = {}) {
  return createSettlementService({
    repository: repository || createMemoryRepository(),
    smsClient: smsClient || createSmsClient(),
    kakaoClient: kakaoClient || createKakaoClient(),
    now: () => FIXED_NOW,
    sleep: sleep || vi.fn(async () => {}),
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
      {
        id: 'operator_1',
        userRef: 'opref1',
        email: 'operator@example.com',
        status: 'active',
        isOperator: true,
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
        status: 'active',
      },
      {
        id: 'kakao_resource_1',
        resourceRef: 'kakaoref1',
        provider: 'nhn',
        type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
        value: 'sender-key-1',
        status: 'active',
      },
    ],
    links: overrides.links || [
      createLink({ id: 'sms_link_1', senderResourceId: 'sms_resource_1' }),
      createLink({ id: 'kakao_link_1', senderResourceId: 'kakao_resource_1' }),
    ],
    runs: overrides.runs || [],
    summaries: overrides.summaries || [],
    auditLogs: overrides.auditLogs || [],

    async getUserById(userId) {
      return this.users.find((user) => user.id === userId) ?? null;
    },

    async listUsers() {
      return this.users;
    },

    async listBillingAccounts() {
      return this.billingAccounts;
    },

    async listSenderResources() {
      return this.resources;
    },

    async listUserSenderResources() {
      return this.links;
    },

    async createSettlementRun(values) {
      const run = {
        id: `run_${this.runs.length + 1}`,
        finalizedBy: null,
        finalizedAt: null,
        errorMessage: null,
        createdAt: FIXED_NOW,
        ...values,
      };
      this.runs.push(run);
      return run;
    },

    async updateSettlementRun(runId, values) {
      const run = this.runs.find((item) => item.id === runId);
      Object.assign(run, values);
      return run;
    },

    async listSettlementRuns({ status } = {}) {
      return this.runs.filter((run) => !status || run.status === status);
    },

    async getSettlementRun(runId) {
      return this.runs.find((run) => run.id === runId) ?? null;
    },

    async listUsageSummaries(runId) {
      return this.summaries.filter((summary) => summary.runId === runId);
    },

    async getSettlementRunWithSummaries(runId) {
      const run = await this.getSettlementRun(runId);
      if (!run) return null;
      return {
        run,
        summaries: await this.listUsageSummaries(run.id),
      };
    },

    async createUsageSummaries(records) {
      const inserted = records.map((record) => ({
        id: `summary_${this.summaries.length + 1}`,
        createdAt: FIXED_NOW,
        ...record,
      }));
      this.summaries.push(...inserted);
      return inserted;
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
    listMessageResults: overrides.listMessageResults || vi.fn(async () => smsResultPage([])),
  };
}

function createKakaoClient(overrides = {}) {
  return {
    listAlimtalkMessageResults: overrides.listAlimtalkMessageResults || vi.fn(async () => alimtalkResultPage([])),
    getAlimtalkMessage: overrides.getAlimtalkMessage || vi.fn(),
  };
}

function createSmsResult(overrides = {}) {
  const groupingKey = overrides.senderGroupingKey || senderGroupingKey({ requestRef: 'smsreq1' });

  return {
    messageType: 'SMS',
    requestId: 'sms-request',
    recipientSeq: 1,
    resultCode: '1000',
    msgStatus: '3',
    resultDate: '2026-06-01 10:00:00.0',
    updateDate: '2026-06-01 10:01:00.0',
    senderGroupingKey: groupingKey,
    recipientGroupingKey: buildRecipientGroupingKey(groupingKey, 0),
    ...overrides,
  };
}

function createAlimtalkResult(overrides = {}) {
  return {
    requestId: 'alim-request',
    recipientSeq: 1,
    receiveDate: '2026-06-01 10:00',
    messageStatus: 'COMPLETED',
    resultCode: 'MRC01',
    ...overrides,
  };
}

function smsResultPage(items, overrides = {}) {
  return {
    header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
    body: {
      pageNum: 1,
      pageSize: overrides.pageSize ?? 1000,
      totalCount: overrides.totalCount ?? items.length,
      data: items,
    },
  };
}

function alimtalkResultPage(items, overrides = {}) {
  return {
    header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
    body: {
      pageNum: 1,
      pageSize: overrides.pageSize ?? 1000,
      totalCount: overrides.totalCount ?? items.length,
      messages: items,
    },
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
