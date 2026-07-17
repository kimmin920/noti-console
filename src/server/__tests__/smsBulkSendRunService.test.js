import { describe, expect, it, vi } from 'vitest';

import { SmsBulkSendQuotaError } from '../messages/repository.js';
import { createMessageSendService } from '../messages/service.js';
import { CHANNELS, RELAY_ERROR_CODES, SEND_RESPONSE_STATES, SENDER_RESOURCE_TYPES } from '../relay/constants.js';

const FIXED_NOW = new Date('2026-06-05T00:00:00.000Z');
const DIRECT_CLIENT_REQUEST_ID = 'de305d54-75b4-431b-adb2-eb6b9e546014';

describe('SMS bulk send run service', () => {
  it('creates a 50000-recipient run as 50 batches without exposing sensitive payloads', async () => {
    const repository = createMessageRepository({ quotaLimit: 60_000 });
    const bulkRunRepository = createBulkRunRepository({ quotaLimit: 60_000 });
    const service = createService({ bulkRunRepository, repository });
    const recipients = createRecipients(50_000);

    const result = await service.createSmsBulkSendRun({
      actorUserId: 'user_1',
      payload: {
        body: 'Pickup code ##code##',
        managementTitle: 'June pickup reminders',
        recipients,
        senderResourceId: 'sms_resource_1',
      },
    });

    expect(result).toMatchObject({
      acceptedRecipientCount: 0,
      batchSize: 1000,
      channel: CHANNELS.SMS,
      managementSendName: 'June pickup reminders',
      state: 'queued',
      totalBatchCount: 50,
      totalRecipientCount: 50_000,
    });
    expect(bulkRunRepository.runs).toHaveLength(1);
    expect(bulkRunRepository.batches).toHaveLength(50);
    expect(bulkRunRepository.quotaBucket).toMatchObject({
      periodEndAt: new Date('2026-06-30T14:59:59.999Z'),
      periodStartAt: new Date('2026-05-31T15:00:00.000Z'),
      quotaLimit: 60_000,
      quotaScope: 'sender_resource_period',
      senderResourceId: 'sms_resource_1',
    });
    expect(new Set(bulkRunRepository.batches.map((batch) => batch.clientRequestId)).size).toBe(50);
    expect(JSON.stringify(result)).not.toContain('01000000000');
    expect(JSON.stringify(result)).not.toContain('Pickup code');
    expect(JSON.stringify(repository.auditLogs)).not.toContain('01000000000');
    expect(JSON.stringify(repository.auditLogs)).not.toContain('Pickup code');
  });

  it('keeps direct SMS sends limited to 1000 recipients', async () => {
    const service = createService();

    await expect(
      service.sendSms({
        actorUserId: 'user_1',
        payload: {
          body: 'Direct send',
          clientRequestId: DIRECT_CLIENT_REQUEST_ID,
          recipients: createRecipients(1001),
          senderResourceId: 'sms_resource_1',
        },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
    });
  });

  it('rejects bulk creation when the sender number quota is insufficient', async () => {
    const bulkRunRepository = createBulkRunRepository({ quotaLimit: 1000 });
    const service = createService({ bulkRunRepository });

    await expect(
      service.createSmsBulkSendRun({
        actorUserId: 'user_1',
        payload: {
          body: 'Quota blocked',
          recipients: createRecipients(1001),
          senderResourceId: 'sms_resource_1',
        },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.SENDER_RESOURCE_QUOTA_EXCEEDED,
      status: 429,
    });
    expect(bulkRunRepository.runs).toEqual([]);
    expect(bulkRunRepository.batches).toEqual([]);
  });

  it('processes accepted provider batches sequentially and consumes quota', async () => {
    const bulkRunRepository = createBulkRunRepository({ quotaLimit: 10_000 });
    const smsClient = createSmsClient();
    const service = createService({ bulkRunRepository, smsClient });

    const run = await service.createSmsBulkSendRun({
      actorUserId: 'user_1',
      payload: {
        body: 'Bulk body',
        recipients: createRecipients(2000),
        senderResourceId: 'sms_resource_1',
      },
    });

    const first = await service.processNextSmsBulkSendBatch();
    const second = await service.processNextSmsBulkSendBatch();

    expect(first).toMatchObject({ processed: true, status: 'accepted' });
    expect(second).toMatchObject({
      processed: true,
      status: 'accepted',
      run: {
        acceptedRecipientCount: 2000,
        state: 'completed',
      },
    });
    expect(smsClient.sendSms).toHaveBeenCalledTimes(2);
    expect(bulkRunRepository.batches.map((batch) => batch.payloadJson)).toEqual([null, null]);
    expect(bulkRunRepository.quotaBucket).toMatchObject({
      consumedCount: 2000,
      reservedCount: 0,
    });
    expect((await service.getSmsBulkSendRun({ actorUserId: 'user_1', runId: run.id })).state).toBe('completed');
  });

  it('creates and updates SMS bulk ledger request rows by stable batch client ids', async () => {
    const bulkRunRepository = createBulkRunRepository({ quotaLimit: 10_000 });
    const ledgerRepository = createMemoryLedgerRepository();
    const smsClient = createSmsClient({
      sendSms: vi.fn(async () => ({
        body: {
          data: {
            requestId: 'sms-bulk-provider-1',
            sendResultList: [{ recipientSeq: 1, resultCode: 0, resultMessage: 'SUCCESS' }],
            statusCode: '2',
          },
        },
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      })),
    });
    const service = createService({ bulkRunRepository, ledgerRepository, smsClient });

    await service.createSmsBulkSendRun({
      actorUserId: 'user_1',
      payload: {
        body: 'Bulk body',
        managementTitle: 'June bulk',
        recipients: createRecipients(2000),
        senderResourceId: 'sms_resource_1',
      },
    });

    expect(ledgerRepository.groups[0]).toMatchObject({
      channel: CHANNELS.SMS,
      managementTitle: 'June bulk',
      pendingCount: 0,
      providerRequestCount: 2,
      providerState: 'queued',
      sendKind: 'bulk',
      totalRecipientCount: 2000,
    });
    expect(ledgerRepository.providerRequests).toHaveLength(2);
    expect(ledgerRepository.providerRequests[0].clientRequestId).toBe(bulkRunRepository.batches[0].clientRequestId);
    expect(ledgerRepository.providerRequests[0].resultSnapshotJson).toBeUndefined();
    expect(ledgerRepository.providerRequests[1].resultSnapshotJson).toBeUndefined();

    await service.processNextSmsBulkSendBatch();

    expect(ledgerRepository.providerRequests[0]).toMatchObject({
      pendingCount: 1000,
      providerRequestId: 'sms-bulk-provider-1',
      providerState: 'accepted',
      resultSnapshotJson: {
        states: new Array(1000).fill('P'),
        resultCodes: new Array(1000).fill(null),
      },
      resultSnapshotVersion: 0,
      resultState: 'not_synced',
    });
    expect(ledgerRepository.providerRequests[0].nextSyncAt).toBeNull();
    expect(ledgerRepository.providerRequests[1]).toMatchObject({
      pendingCount: 0,
      providerRequestId: null,
      providerState: 'queued',
      resultState: 'not_synced',
    });
    expect(ledgerRepository.providerRequests[1].resultSnapshotJson).toBeUndefined();
    expect(ledgerRepository.groups[0]).toMatchObject({
      acceptedRequestCount: 1,
      pendingCount: 1000,
      providerState: 'partial',
      resultState: 'not_synced',
    });
    expect(JSON.stringify(ledgerRepository)).not.toContain('01000000000');
    expect(JSON.stringify(ledgerRepository)).not.toContain('Bulk body');
  });


  it('keeps scheduled bulk runs linked to reservations after batch payloads are purged', async () => {
    const bulkRunRepository = createBulkRunRepository({ quotaLimit: 10_000 });
    const smsClient = createSmsClient();
    const service = createService({ bulkRunRepository, smsClient });

    const run = await service.createSmsBulkSendRun({
      actorUserId: 'user_1',
      payload: {
        body: 'Scheduled bulk body',
        recipients: createRecipients(2000),
        requestDate: '2026-06-07 10:00',
        senderResourceId: 'sms_resource_1',
      },
    });

    expect(run).toMatchObject({
      actions: {
        logsHref: '/logs?channel=sms',
        reservationsHref: '/reservations?channel=sms',
        resultHref: '/reservations?channel=sms',
      },
      isReservation: true,
      requestDate: '2026-06-07 10:00',
    });

    await service.processNextSmsBulkSendBatch();
    const completed = await service.processNextSmsBulkSendBatch();

    expect(bulkRunRepository.batches.map((batch) => batch.payloadJson)).toEqual([null, null]);
    expect(completed.run).toMatchObject({
      actions: {
        reservationsHref: '/reservations?channel=sms',
        resultHref: '/reservations?channel=sms',
      },
      isReservation: true,
      requestDate: '2026-06-07 10:00',
      state: 'completed',
    });
  });

  it('stops later batches when provider result is unknown and releases remaining quota', async () => {
    const bulkRunRepository = createBulkRunRepository({ quotaLimit: 10_000 });
    const smsClient = createSmsClient({
      sendSms: vi.fn(async () => {
        throw new DOMException('Timeout', 'TimeoutError');
      }),
    });
    const service = createService({ bulkRunRepository, smsClient });

    await service.createSmsBulkSendRun({
      actorUserId: 'user_1',
      payload: {
        body: 'Unknown body',
        recipients: createRecipients(2000),
        senderResourceId: 'sms_resource_1',
      },
    });

    const result = await service.processNextSmsBulkSendBatch();

    expect(result).toMatchObject({
      processed: true,
      status: 'unknown',
      run: {
        state: 'blocked',
        unknownRecipientCount: 1000,
      },
    });
    expect(smsClient.sendSms).toHaveBeenCalledTimes(1);
    expect(bulkRunRepository.batches.map((batch) => batch.status)).toEqual(['unknown', 'pending']);
    expect(bulkRunRepository.quotaBucket).toMatchObject({
      consumedCount: 0,
      reservedCount: 0,
    });
  });

  it('marks provider rejected batches as failed without retrying later batches', async () => {
    const bulkRunRepository = createBulkRunRepository({ quotaLimit: 10_000 });
    const smsClient = createSmsClient({
      sendSms: vi.fn(async () => {
        throw new Error('Provider rejected the request.');
      }),
    });
    const service = createService({ bulkRunRepository, smsClient });

    await service.createSmsBulkSendRun({
      actorUserId: 'user_1',
      payload: {
        body: 'Rejected body',
        recipients: createRecipients(2000),
        senderResourceId: 'sms_resource_1',
      },
    });

    const result = await service.processNextSmsBulkSendBatch();

    expect(result).toMatchObject({
      processed: true,
      status: 'rejected',
      run: {
        rejectedRecipientCount: 1000,
        state: 'failed',
      },
    });
    expect(smsClient.sendSms).toHaveBeenCalledTimes(1);
    expect(bulkRunRepository.batches.map((batch) => batch.status)).toEqual(['rejected', 'pending']);
    expect(bulkRunRepository.quotaBucket).toMatchObject({
      consumedCount: 0,
      reservedCount: 0,
    });
  });
});

function createService({
  bulkRunRepository = createBulkRunRepository({ quotaLimit: 10_000 }),
  ledgerRepository,
  repository,
  smsClient,
} = {}) {
  return createMessageSendService({
    bulkRunRepository,
    kakaoClient: {},
    ledgerRepository,
    now: () => FIXED_NOW,
    repository: repository ?? createMessageRepository({ quotaLimit: bulkRunRepository.quotaBucket.quotaLimit }),
    smsClient: smsClient ?? createSmsClient(),
    workerId: 'test-worker',
  });
}

function createSmsClient(overrides = {}) {
  return {
    sendMms: overrides.sendMms ?? vi.fn(),
    sendSms: overrides.sendSms ?? vi.fn(async () => ({
      body: {
        data: {
          requestId: `sms-request-${Math.random()}`,
          sendResultList: [{ recipientSeq: 1, resultCode: 0, resultMessage: 'SUCCESS' }],
          statusCode: '2',
        },
      },
      header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
    })),
  };
}

function createMessageRepository({ quotaLimit = 10_000 } = {}) {
  return {
    auditLogs: [],
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
    ],
    resources: [
      {
        displayName: '1544-6859',
        id: 'sms_resource_1',
        provider: 'nhn',
        providerStatus: 'approved',
        quotaLimit,
        resourceRef: 'smsref1',
        status: 'active',
        type: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
        value: '15446859',
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
    async createAuditLog(values) {
      const auditLog = { id: `audit_${this.auditLogs.length + 1}`, ...values };
      this.auditLogs.push(auditLog);
      return auditLog;
    },
    async findBillingAccountForUser(userId) {
      return this.billingAccounts.find((item) => item.ownerType === 'user' && item.ownerId === userId) ?? null;
    },
    async getBillingAccountById(billingAccountId) {
      return this.billingAccounts.find((item) => item.id === billingAccountId) ?? null;
    },
    async getUserById(userId) {
      return this.users.find((user) => user.id === userId) ?? null;
    },
    async getUserSenderResource({ userId, senderResourceId }) {
      const link = this.links.find((item) => item.userId === userId && item.senderResourceId === senderResourceId);
      return link
        ? { link, resource: this.resources.find((resource) => resource.id === senderResourceId) }
        : null;
    },
  };
}

function createBulkRunRepository({ quotaLimit }) {
  return {
    batches: [],
    quotaBucket: {
      channel: CHANNELS.SMS,
      consumedCount: 0,
      id: 'quota_bucket_1',
      periodEndAt: new Date('2026-07-01T00:00:00.000Z'),
      periodStartAt: new Date('2026-06-01T00:00:00.000Z'),
      quotaLimit,
      quotaScope: 'sender_resource_period',
      reservedCount: 0,
      senderResourceId: 'sms_resource_1',
      userId: 'user_1',
    },
    quotaReservation: null,
    runs: [],
    async claimNextPendingBatch({ workerId, leaseExpiresAt, now }) {
      const run = this.runs.find((item) => item.status === 'queued' || item.status === 'running');
      const batch = run
        ? this.batches.find((item) => item.runId === run.id && item.status === 'pending')
        : null;

      if (!run || !batch) return null;

      run.status = 'running';
      run.startedAt = run.startedAt ?? now;
      batch.status = 'sending';
      batch.attempts += 1;
      batch.lockedBy = workerId;
      batch.leaseExpiresAt = leaseExpiresAt;
      batch.claimedAt = now;
      return { batch, run };
    },
    async createRunWithBatchesAndReservation({ batches, quotaBucket, quotaReservation = {}, run, now }) {
      const availableCount = this.quotaBucket.quotaLimit - this.quotaBucket.reservedCount - this.quotaBucket.consumedCount;

      if (
        availableCount < run.totalRecipients
        || quotaBucket.senderResourceId !== this.quotaBucket.senderResourceId
      ) {
        throw new SmsBulkSendQuotaError('SMS quota is not available for this bulk send run.');
      }

      Object.assign(this.quotaBucket, quotaBucket, { id: this.quotaBucket.id });

      const createdRun = {
        acceptedCount: 0,
        createdAt: now,
        failedCount: 0,
        finishedAt: null,
        id: `bulk_run_${this.runs.length + 1}`,
        rejectedCount: 0,
        startedAt: null,
        status: 'queued',
        unknownCount: 0,
        updatedAt: now,
        ...run,
      };
      const batchOffset = this.batches.length;
      const createdBatches = batches.map((batch, index) => ({
        attempts: 0,
        createdAt: now,
        errorCode: null,
        errorMessage: null,
        errorState: null,
        finishedAt: null,
        id: `bulk_batch_${batchOffset + index + 1}`,
        leaseExpiresAt: null,
        lockedBy: null,
        providerRequestId: null,
        runId: createdRun.id,
        sentAt: null,
        status: 'pending',
        updatedAt: now,
        ...batch,
      }));

      this.quotaBucket.reservedCount += run.totalRecipients;
      this.quotaReservation = {
        bucketId: this.quotaBucket.id,
        consumedCount: 0,
        id: 'quota_reservation_1',
        releasedCount: 0,
        reservedCount: run.totalRecipients,
        runId: createdRun.id,
        status: 'reserved',
        ...quotaReservation,
      };
      this.runs.push(createdRun);
      this.batches.push(...createdBatches);

      return {
        batches: createdBatches,
        quotaBucket: this.quotaBucket,
        quotaReservation: this.quotaReservation,
        run: createdRun,
      };
    },
    async consumeQuotaReservation({ recipientCount }) {
      const count = Math.min(
        recipientCount,
        this.quotaReservation.reservedCount - this.quotaReservation.consumedCount - this.quotaReservation.releasedCount
      );
      this.quotaBucket.reservedCount -= count;
      this.quotaBucket.consumedCount += count;
      this.quotaReservation.consumedCount += count;
      return { consumedCount: count, quotaBucket: this.quotaBucket, quotaReservation: this.quotaReservation };
    },
    async getRunForActor({ actorUserId, runId }) {
      return this.runs.find((run) => run.id === runId && run.userId === actorUserId) ?? null;
    },
    async listBatchesForRun(runId) {
      return this.batches.filter((batch) => batch.runId === runId).sort((a, b) => a.sequence - b.sequence);
    },
    async listRunsForActor({ actorUserId, activeOnly }) {
      return this.runs.filter((run) => (
        run.userId === actorUserId && (!activeOnly || ['queued', 'running', 'blocked', 'failed'].includes(run.status))
      ));
    },
    async markBatchAccepted({ batchId, providerRequestId, now }) {
      return this.markBatchTerminal({ batchId, now, providerRequestId, status: 'accepted' });
    },
    async markBatchFailed({ batchId, errorCode, errorMessage, errorState, now }) {
      return this.markBatchTerminal({ batchId, errorCode, errorMessage, errorState, now, status: 'failed' });
    },
    async markBatchRejected({ batchId, errorCode, errorMessage, errorState, now }) {
      return this.markBatchTerminal({ batchId, errorCode, errorMessage, errorState, now, status: 'rejected' });
    },
    async markBatchTerminal({ batchId, errorCode = null, errorMessage = null, errorState = null, now, providerRequestId = null, status }) {
      const batch = this.batches.find((item) => item.id === batchId);
      Object.assign(batch, {
        errorCode,
        errorMessage,
        errorState,
        finishedAt: now,
        leaseExpiresAt: null,
        lockedBy: null,
        payloadJson: null,
        payloadPurgedAt: now,
        providerRequestId,
        status,
        updatedAt: now,
      });
      return batch;
    },
    async markBatchUnknown({ batchId, errorCode, errorMessage, errorState, now }) {
      return this.markBatchTerminal({ batchId, errorCode, errorMessage, errorState, now, status: 'unknown' });
    },
    async purgeExpiredPayloads() {
      return [];
    },
    async recomputeRunAggregateCounts({ runId, now }) {
      const run = this.runs.find((item) => item.id === runId);
      const batches = this.batches.filter((batch) => batch.runId === runId);
      run.acceptedCount = batches.filter((batch) => batch.status === 'accepted')
        .reduce((total, batch) => total + batch.recipientCount, 0);
      run.unknownCount = batches.filter((batch) => batch.status === 'unknown')
        .reduce((total, batch) => total + batch.recipientCount, 0);
      run.failedCount = batches.filter((batch) => batch.status === 'failed')
        .reduce((total, batch) => total + batch.recipientCount, 0);
      run.rejectedCount = batches.filter((batch) => batch.status === 'rejected')
        .reduce((total, batch) => total + batch.recipientCount, 0);

      if (run.unknownCount > 0) {
        run.status = 'blocked';
      } else if (run.failedCount > 0 || run.rejectedCount > 0) {
        run.status = 'failed';
      } else if (batches.every((batch) => batch.status === 'accepted')) {
        run.status = 'completed';
      } else {
        run.status = 'running';
      }

      if (['blocked', 'completed', 'failed'].includes(run.status)) {
        run.finishedAt = now;
      }

      return run;
    },
    async releaseQuotaReservation() {
      const releaseCount = this.quotaReservation.reservedCount
        - this.quotaReservation.consumedCount
        - this.quotaReservation.releasedCount;
      this.quotaBucket.reservedCount -= releaseCount;
      this.quotaReservation.releasedCount += releaseCount;
      this.quotaReservation.status = this.quotaReservation.consumedCount >= this.quotaReservation.reservedCount
        ? 'consumed'
        : 'released';
      return { quotaBucket: this.quotaBucket, quotaReservation: this.quotaReservation, releasedCount: releaseCount };
    },
  };
}

function createRecipients(count) {
  return Array.from({ length: count }, (_, index) => ({
    recipientNo: `010${String(index).padStart(8, '0')}`,
  }));
}

function createMemoryLedgerRepository() {
  return {
    groups: [],
    providerRequests: [],
    async createGroupWithProviderRequests({ group, providerRequests = [], now }) {
      const createdGroup = {
        id: `ledger_group_${this.groups.length + 1}`,
        acceptedRequestCount: 0,
        canceledCount: 0,
        failedCount: 0,
        pendingCount: 0,
        providerState: 'queued',
        resultState: 'not_synced',
        successCount: 0,
        ...group,
        createdAt: group.createdAt ?? now,
      };
      const createdRequests = providerRequests.map((request) => ({
        id: `ledger_request_${this.providerRequests.length + 1}`,
        canceledCount: 0,
        failedCount: 0,
        groupId: createdGroup.id,
        pendingCount: 0,
        providerRequestId: null,
        providerState: 'queued',
        resultState: 'not_synced',
        successCount: 0,
        syncAttempts: 0,
        ...request,
        createdAt: now,
      }));

      this.groups.push(createdGroup);
      this.providerRequests.push(...createdRequests);

      return {
        group: createdGroup,
        providerRequests: createdRequests,
      };
    },
    async listProviderRequestsForGroup(groupId) {
      return this.providerRequests.filter((request) => request.groupId === groupId);
    },
    async updateGroup({ groupId, values }) {
      const group = this.groups.find((item) => item.id === groupId);
      Object.assign(group, values);
      return group;
    },
    async updateProviderRequestByClientRequestId({ clientRequestId, values }) {
      const request = this.providerRequests.find((item) => item.clientRequestId === clientRequestId);
      Object.assign(request, values);
      return request;
    },
  };
}
