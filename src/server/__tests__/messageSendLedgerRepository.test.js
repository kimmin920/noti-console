import { describe, expect, it } from 'vitest';

import {
  buildGeneratedManagementTitle,
  createMessageSendLedgerRepository,
  createInitialResultSnapshot,
  getLedgerRequestResultCounts,
  LEDGER_MANAGEMENT_TITLE_MAX_LENGTH,
  listFailedResultSnapshotEntries,
  mergeResultSnapshotEntries,
  sanitizeManagementTitle,
} from '../messageLogs/repository.js';

const FIXED_NOW = new Date('2026-06-09T06:00:00.000Z');
const EXPIRES_AT = new Date('2026-09-07T06:00:00.000Z');
const NEXT_SYNC_AT = new Date('2026-06-09T06:03:00.000Z');

describe('message send ledger repository contract', () => {
  it('exposes provider-request-id snapshot merge for webhook and correction callers', () => {
    const repository = createMessageSendLedgerRepository({});

    expect(repository.mergeProviderRequestResultSnapshotByProviderRequestId).toEqual(expect.any(Function));
  });

  it('creates safe group and provider-request rows without copying sensitive send fields', async () => {
    const repository = createMemoryLedgerRepository();

    const result = await repository.createGroupWithProviderRequests({
      group: {
        userId: 'user_1',
        senderResourceId: 'sender_resource_1',
        billingAccountId: 'billing_1',
        channel: 'sms',
        sendKind: 'bulk',
        sendTiming: 'immediate',
        totalRecipientCount: 2000,
        expiresAt: EXPIRES_AT,
        title: 'Private SMS title',
        body: 'Private SMS body',
        contentPreview: 'Rendered content',
        templateParameters: { code: '123456' },
        recipients: [{ recipientNo: '01012345678' }],
      },
      providerRequests: [
        createProviderRequestInput({ sequence: 1 }),
        createProviderRequestInput({ sequence: 2 }),
      ],
      now: FIXED_NOW,
    });

    expect(result.group).toMatchObject({
      id: 'ledger_group_1',
      channel: 'sms',
      sendKind: 'bulk',
      managementTitle: 'SMS send batch',
      totalRecipientCount: 2000,
      providerRequestCount: 2,
      providerState: 'queued',
      resultState: 'not_synced',
    });
    expect(result.providerRequests).toHaveLength(2);
    expect(result.providerRequests[0]).toMatchObject({
      groupId: 'ledger_group_1',
      sequence: 1,
      recipientCount: 1000,
      resultState: 'not_synced',
    });

    const persisted = JSON.stringify({
      groups: repository.groups,
      providerRequests: repository.providerRequests,
    });
    expect(persisted).not.toContain('Private SMS title');
    expect(persisted).not.toContain('Private SMS body');
    expect(persisted).not.toContain('Rendered content');
    expect(persisted).not.toContain('123456');
    expect(persisted).not.toContain('01012345678');
    expect(persisted).not.toContain('recipientNo');
  });

  it('sanitizes explicit management titles and keeps generated labels content-independent', () => {
    const longTitle = `  June operation\u0000notice\n${'x'.repeat(220)}  `;
    const sanitized = sanitizeManagementTitle(longTitle);

    expect(sanitized).toMatch(/^June operation notice/);
    expect(sanitized).toHaveLength(LEDGER_MANAGEMENT_TITLE_MAX_LENGTH);
    expect(sanitized).not.toContain('\u0000');
    expect(sanitized).not.toContain('\n');

    const generated = buildGeneratedManagementTitle({
      body: 'Private SMS body',
      channel: 'sms',
      recipients: [{ recipientNo: '01012345678' }],
      sendKind: 'basic',
      title: 'Private SMS title',
    });

    expect(generated).toBe('SMS send');
    expect(generated).not.toContain('Private SMS title');
    expect(generated).not.toContain('Private SMS body');
    expect(generated).not.toContain('01012345678');
  });

  it('lists active actor rows separately from archived rows', async () => {
    const repository = createMemoryLedgerRepository();
    await repository.createGroupWithProviderRequests({
      group: createGroupInput({ id: 'ledger_group_old', createdAt: new Date('2026-06-09T05:00:00.000Z') }),
      providerRequests: [createProviderRequestInput()],
      now: FIXED_NOW,
    });
    await repository.createGroupWithProviderRequests({
      group: createGroupInput({ id: 'ledger_group_new', createdAt: new Date('2026-06-09T07:00:00.000Z') }),
      providerRequests: [createProviderRequestInput()],
      now: FIXED_NOW,
    });
    await repository.createGroupWithProviderRequests({
      group: createGroupInput({
        archivedAt: FIXED_NOW,
        channel: 'sms',
        id: 'ledger_group_archived',
      }),
      providerRequests: [createProviderRequestInput()],
      now: FIXED_NOW,
    });
    await repository.createGroupWithProviderRequests({
      group: createGroupInput({ channel: 'alimtalk', id: 'ledger_group_alimtalk' }),
      providerRequests: [createProviderRequestInput()],
      now: FIXED_NOW,
    });

    const activeSmsGroups = await repository.listGroupsForActor({
      actorUserId: 'user_1',
      channel: 'sms',
    });
    const allSmsGroups = await repository.listGroupsForActor({
      actorUserId: 'user_1',
      channel: 'sms',
      includeArchived: true,
    });

    expect(activeSmsGroups.map((group) => group.id)).toEqual(['ledger_group_new', 'ledger_group_old']);
    expect(allSmsGroups.map((group) => group.id)).toEqual([
      'ledger_group_new',
      'ledger_group_archived',
      'ledger_group_old',
    ]);
    await expect(repository.getGroupForActor({
      actorUserId: 'user_1',
      groupId: 'ledger_group_archived',
    })).resolves.toBeNull();
  });

  it('archives expired groups, purges archived groups, and cascades child request removal', async () => {
    const repository = createMemoryLedgerRepository();
    await repository.createGroupWithProviderRequests({
      group: createGroupInput({
        expiresAt: new Date('2026-06-08T06:00:00.000Z'),
        id: 'ledger_group_expired',
      }),
      providerRequests: [
        createProviderRequestInput({ id: 'ledger_request_expired_1', sequence: 1 }),
        createProviderRequestInput({ id: 'ledger_request_expired_2', sequence: 2 }),
      ],
      now: FIXED_NOW,
    });
    await repository.createGroupWithProviderRequests({
      group: createGroupInput({ id: 'ledger_group_active' }),
      providerRequests: [createProviderRequestInput({ id: 'ledger_request_active' })],
      now: FIXED_NOW,
    });

    const archived = await repository.archiveExpiredGroups({
      archiveReason: 'expired',
      now: FIXED_NOW,
      purgeAfter: new Date('2026-07-09T06:00:00.000Z'),
    });
    const purged = await repository.purgeArchivedGroups({
      now: new Date('2026-07-10T06:00:00.000Z'),
    });

    expect(archived.map((group) => group.id)).toEqual(['ledger_group_expired']);
    expect(purged.map((group) => group.id)).toEqual(['ledger_group_expired']);
    expect(repository.groups.map((group) => group.id)).toEqual(['ledger_group_active']);
    expect(repository.providerRequests.map((request) => request.id)).toEqual(['ledger_request_active']);
  });

  it('leases syncable provider requests without duplicating active leases', async () => {
    const repository = createMemoryLedgerRepository();
    await repository.createGroupWithProviderRequests({
      group: createGroupInput({
        channel: 'sms',
        id: 'ledger_group_syncable',
        sendKind: 'bulk',
      }),
      providerRequests: [
        createProviderRequestInput({ id: 'ledger_request_due', nextSyncAt: NEXT_SYNC_AT }),
        createProviderRequestInput({
          id: 'ledger_request_future',
          nextSyncAt: new Date('2026-06-09T07:00:00.000Z'),
          sequence: 2,
        }),
        createProviderRequestInput({
          id: 'ledger_request_leased',
          nextSyncAt: NEXT_SYNC_AT,
          sequence: 3,
          syncLeaseExpiresAt: new Date('2026-06-09T06:10:00.000Z'),
          syncLockedBy: 'worker-existing',
        }),
      ],
      now: FIXED_NOW,
    });
    await repository.createGroupWithProviderRequests({
      group: createGroupInput({
        channel: 'alimtalk',
        id: 'ledger_group_wrong_channel',
        sendKind: 'basic',
      }),
      providerRequests: [createProviderRequestInput({ id: 'ledger_request_wrong_channel' })],
      now: FIXED_NOW,
    });

    const leased = await repository.leaseSyncableProviderRequests({
      leaseExpiresAt: new Date('2026-06-09T06:20:00.000Z'),
      now: new Date('2026-06-09T06:04:00.000Z'),
      workerId: 'worker-a',
    });
    const secondLeaseAttempt = await repository.leaseSyncableProviderRequests({
      leaseExpiresAt: new Date('2026-06-09T06:25:00.000Z'),
      now: new Date('2026-06-09T06:05:00.000Z'),
      workerId: 'worker-b',
    });

    expect(leased.map((request) => request.id)).toEqual(['ledger_request_due']);
    expect(leased[0]).toMatchObject({
      resultState: 'syncing',
      syncAttempts: 1,
      syncLockedBy: 'worker-a',
    });
    expect(secondLeaseAttempt).toEqual([]);
  });

  it('initializes provider request snapshots with pending states and null result codes', async () => {
    const repository = createMemoryLedgerRepository();
    await repository.createGroupWithProviderRequests({
      group: createGroupInput({
        id: 'ledger_group_snapshot',
        providerState: 'accepted',
        totalRecipientCount: 4,
      }),
      providerRequests: [
        createProviderRequestInput({
          id: 'ledger_request_snapshot',
          providerRequestId: 'sms-request-1',
          providerState: 'accepted',
          recipientCount: 4,
        }),
      ],
      now: FIXED_NOW,
    });

    const initialized = await repository.initializeProviderRequestSnapshot({
      requestId: 'ledger_request_snapshot',
      now: FIXED_NOW,
    });

    expect(initialized.resultSnapshotJson).toEqual({
      states: ['P', 'P', 'P', 'P'],
      resultCodes: [null, null, null, null],
    });
    expect(initialized).toMatchObject({
      pendingCount: 4,
      resultSnapshotVersion: 0,
      resultState: 'not_synced',
      successCount: 0,
    });
    expect(repository.groups[0]).toMatchObject({
      pendingCount: 4,
      resultState: 'not_synced',
    });
  });

  it('loads provider requests by provider request id for webhook processing', async () => {
    const repository = createMemoryLedgerRepository();
    await repository.createGroupWithProviderRequests({
      group: createGroupInput({ channel: 'sms', id: 'ledger_group_sms' }),
      providerRequests: [
        createProviderRequestInput({
          id: 'ledger_request_sms',
          providerRequestId: 'sms-request-1',
        }),
      ],
      now: FIXED_NOW,
    });
    await repository.createGroupWithProviderRequests({
      group: createGroupInput({ channel: 'alimtalk', id: 'ledger_group_alimtalk' }),
      providerRequests: [
        createProviderRequestInput({
          id: 'ledger_request_alimtalk',
          providerRequestId: 'sms-request-1',
        }),
      ],
      now: FIXED_NOW,
    });

    const rows = await repository.listProviderRequestsByProviderRequestId({
      channel: 'sms',
      providerRequestId: 'sms-request-1',
    });

    expect(rows.map((row) => [row.group.id, row.providerRequest.id])).toEqual([
      ['ledger_group_sms', 'ledger_request_sms'],
    ]);
  });

  it('merges result snapshots idempotently and rolls group counts from snapshots', async () => {
    const repository = createMemoryLedgerRepository();
    await repository.createGroupWithProviderRequests({
      group: createGroupInput({
        id: 'ledger_group_merge',
        providerState: 'accepted',
        totalRecipientCount: 6,
      }),
      providerRequests: [
        createProviderRequestInput({
          id: 'ledger_request_merge_1',
          initializeResultSnapshot: true,
          providerRequestId: 'sms-request-1',
          providerState: 'accepted',
          recipientCount: 4,
        }),
        createProviderRequestInput({
          id: 'ledger_request_merge_2',
          initializeResultSnapshot: true,
          providerRequestId: 'sms-request-2',
          providerState: 'accepted',
          recipientCount: 2,
          sequence: 2,
        }),
      ],
      now: FIXED_NOW,
    });

    const merged = await repository.mergeProviderRequestResultSnapshot({
      entries: [
        { recipientSeq: 1, state: 'S', resultCode: '1000' },
        { recipientSeq: 2, state: 'F', resultCode: '3003' },
        { recipientSeq: 4, state: 'C', resultCode: null },
      ],
      now: new Date('2026-06-09T06:05:00.000Z'),
      requestId: 'ledger_request_merge_1',
    });
    const mergedRequest = { ...merged.providerRequest };
    const repeated = await repository.mergeProviderRequestResultSnapshot({
      entries: [{ recipientSeq: 1, state: 'S', resultCode: '1000' }],
      now: new Date('2026-06-09T06:06:00.000Z'),
      requestId: 'ledger_request_merge_1',
    });
    const repeatedVersion = repeated.providerRequest.resultSnapshotVersion;
    const authoritative = await repository.mergeProviderRequestResultSnapshot({
      authoritative: true,
      entries: [{ recipientSeq: 1, state: 'F', resultCode: '3003' }],
      now: new Date('2026-06-09T06:07:00.000Z'),
      requestId: 'ledger_request_merge_1',
    });
    const webhookConflict = await repository.mergeProviderRequestResultSnapshot({
      entries: [{ recipientSeq: 2, state: 'S', resultCode: '1000' }],
      now: new Date('2026-06-09T06:08:00.000Z'),
      requestId: 'ledger_request_merge_1',
    });

    expect(mergedRequest).toMatchObject({
      canceledCount: 1,
      failedCount: 1,
      pendingCount: 1,
      resultSnapshotVersion: 1,
      resultState: 'partially_synced',
      successCount: 1,
    });
    expect(mergedRequest.firstResultReceivedAt).toEqual(new Date('2026-06-09T06:05:00.000Z'));
    expect(repeated).toMatchObject({ changedCount: 0 });
    expect(repeatedVersion).toBe(1);
    expect(authoritative.providerRequest).toMatchObject({
      canceledCount: 1,
      failedCount: 2,
      pendingCount: 1,
      resultSnapshotVersion: 2,
      successCount: 0,
    });
    expect(webhookConflict).toMatchObject({ changedCount: 0 });
    expect(webhookConflict.providerRequest).toMatchObject({
      failedCount: 2,
      resultSnapshotVersion: 2,
      successCount: 0,
    });
    expect(repository.groups.find((group) => group.id === 'ledger_group_merge')).toMatchObject({
      canceledCount: 1,
      failedCount: 2,
      pendingCount: 3,
      resultState: 'partially_synced',
      successCount: 0,
    });
  });

  it('merges by provider request id, ignores unsafe entries, and initializes missing snapshots', async () => {
    const repository = createMemoryLedgerRepository();
    await repository.createGroupWithProviderRequests({
      group: createGroupInput({
        id: 'ledger_group_provider_id_merge',
        providerState: 'accepted',
        totalRecipientCount: 3,
      }),
      providerRequests: [
        createProviderRequestInput({
          id: 'ledger_request_provider_id_merge',
          providerRequestId: 'sms-request-provider-id',
          providerState: 'accepted',
          recipientCount: 3,
        }),
      ],
      now: FIXED_NOW,
    });

    const merged = await repository.mergeProviderRequestResultSnapshotByProviderRequestId({
      authoritative: false,
      providerRequestId: 'sms-request-provider-id',
      results: [
        { recipientSeq: 1, state: 'S', resultCode: '1000' },
        { recipientSeq: 2, state: 'INVALID', resultCode: '9999' },
        { recipientSeq: 4, state: 'F', resultCode: '3003' },
      ],
      now: new Date('2026-06-09T06:05:00.000Z'),
    });

    expect(merged).toMatchObject({
      changedCount: 1,
      providerRequest: {
        pendingCount: 2,
        resultSnapshotJson: {
          states: ['S', 'P', 'P'],
          resultCodes: ['1000', null, null],
        },
        resultSnapshotVersion: 1,
        successCount: 1,
      },
    });
    expect(repository.groups[0]).toMatchObject({
      pendingCount: 2,
      resultState: 'partially_synced',
      successCount: 1,
    });
  });

  it('serializes concurrent webhook-style merges without losing snapshot counts', async () => {
    const repository = createMemoryLedgerRepository();
    await repository.createGroupWithProviderRequests({
      group: createGroupInput({
        id: 'ledger_group_concurrent_merge',
        providerState: 'accepted',
        totalRecipientCount: 3,
      }),
      providerRequests: [
        createProviderRequestInput({
          id: 'ledger_request_concurrent_merge',
          initializeResultSnapshot: true,
          providerRequestId: 'sms-request-concurrent',
          providerState: 'accepted',
          recipientCount: 3,
        }),
      ],
      now: FIXED_NOW,
    });

    await Promise.all([
      repository.mergeProviderRequestResultSnapshotByProviderRequestId({
        providerRequestId: 'sms-request-concurrent',
        results: [{ recipientSeq: 1, state: 'S', resultCode: '1000' }],
        now: new Date('2026-06-09T06:05:00.000Z'),
      }),
      repository.mergeProviderRequestResultSnapshotByProviderRequestId({
        providerRequestId: 'sms-request-concurrent',
        results: [{ recipientSeq: 2, state: 'F', resultCode: '3003' }],
        now: new Date('2026-06-09T06:05:01.000Z'),
      }),
      repository.mergeProviderRequestResultSnapshotByProviderRequestId({
        providerRequestId: 'sms-request-concurrent',
        results: [{ recipientSeq: 3, state: 'C', resultCode: null }],
        now: new Date('2026-06-09T06:05:02.000Z'),
      }),
    ]);

    expect(repository.providerRequests[0]).toMatchObject({
      canceledCount: 1,
      failedCount: 1,
      pendingCount: 0,
      resultSnapshotVersion: 3,
      resultState: 'synced',
      successCount: 1,
    });
    expect(repository.groups[0]).toMatchObject({
      canceledCount: 1,
      failedCount: 1,
      pendingCount: 0,
      resultState: 'synced',
      successCount: 1,
    });
  });

  it('rolls up snapshot counts across fifty child provider requests', async () => {
    const repository = createMemoryLedgerRepository();
    await repository.createGroupWithProviderRequests({
      group: createGroupInput({
        id: 'ledger_group_fifty_requests',
        providerState: 'accepted',
        sendKind: 'bulk',
        totalRecipientCount: 100,
      }),
      providerRequests: Array.from({ length: 50 }, (_, index) => createProviderRequestInput({
        id: `ledger_request_fifty_${index + 1}`,
        initializeResultSnapshot: true,
        providerRequestId: `sms-request-fifty-${index + 1}`,
        providerState: 'accepted',
        recipientCount: 2,
        sequence: index + 1,
      })),
      now: FIXED_NOW,
    });

    await Promise.all(Array.from({ length: 50 }, (_, index) => (
      repository.mergeProviderRequestResultSnapshotByProviderRequestId({
        authoritative: true,
        finalize: true,
        providerRequestId: `sms-request-fifty-${index + 1}`,
        results: [
          { recipientSeq: 1, state: 'S', resultCode: '1000' },
          { recipientSeq: 2, state: index % 2 === 0 ? 'S' : 'F', resultCode: index % 2 === 0 ? '1000' : '3003' },
        ],
        now: new Date('2026-06-09T06:05:00.000Z'),
      })
    )));

    expect(repository.groups[0]).toMatchObject({
      failedCount: 25,
      pendingCount: 0,
      providerRequestCount: 50,
      resultState: 'synced',
      successCount: 75,
    });
  });

  it('keeps snapshot and fallback count calculations non-negative', () => {
    const snapshot = createInitialResultSnapshot(3);
    const merge = mergeResultSnapshotEntries({
      entries: [
        { recipientSeq: 0, state: 'S', resultCode: '1000' },
        { recipientSeq: 4, state: 'F', resultCode: '3003' },
      ],
      recipientCount: 3,
      snapshot,
    });

    expect(merge).toMatchObject({
      changedCount: 0,
      counts: {
        canceledCount: 0,
        failedCount: 0,
        pendingCount: 3,
        successCount: 0,
      },
    });
    expect(getLedgerRequestResultCounts({
      canceledCount: -1,
      failedCount: -1,
      pendingCount: -1,
      successCount: -1,
    })).toEqual({
      canceledCount: 0,
      failedCount: 0,
      pendingCount: 0,
      successCount: 0,
    });
  });

  it('stores failed recipient numbers only for effective failed snapshot entries', () => {
    const failedMerge = mergeResultSnapshotEntries({
      entries: [
        { recipientSeq: 1, state: 'S', resultCode: '1000', recipientNo: '01011112222' },
        { recipientSeq: 2, state: 'F', resultCode: '3003', recipientNo: ' \u0000010-2222-3333\n' },
      ],
      recipientCount: 3,
      snapshot: createInitialResultSnapshot(3),
    });
    const authoritativeSuccess = mergeResultSnapshotEntries({
      authoritative: true,
      entries: [{ recipientSeq: 2, state: 'S', resultCode: '1000' }],
      recipientCount: 3,
      snapshot: failedMerge.snapshot,
    });
    const authoritativeCanceled = mergeResultSnapshotEntries({
      authoritative: true,
      entries: [{ recipientSeq: 2, state: 'C', resultCode: null }],
      recipientCount: 3,
      snapshot: failedMerge.snapshot,
    });

    expect(failedMerge.snapshot).toEqual({
      states: ['S', 'F', 'P'],
      resultCodes: ['1000', '3003', null],
      failedRecipientNos: {
        2: '010-2222-3333',
      },
    });
    expect(authoritativeSuccess.snapshot).toEqual({
      states: ['S', 'S', 'P'],
      resultCodes: ['1000', '1000', null],
    });
    expect(authoritativeCanceled.snapshot).toEqual({
      states: ['S', 'C', 'P'],
      resultCodes: ['1000', null, null],
    });
  });

  it('fills failed terminal recipient numbers without changing aggregate counts', () => {
    const merge = mergeResultSnapshotEntries({
      entries: [{ recipientSeq: 1, state: 'F', resultCode: '3003', recipientNo: '01099998888' }],
      recipientCount: 1,
      snapshot: {
        states: ['F'],
        resultCodes: ['3003'],
      },
    });

    expect(merge).toMatchObject({
      changedCount: 1,
      counts: {
        canceledCount: 0,
        failedCount: 1,
        pendingCount: 0,
        successCount: 0,
      },
      firstTerminalChanged: false,
      snapshot: {
        states: ['F'],
        resultCodes: ['3003'],
        failedRecipientNos: {
          1: '01099998888',
        },
      },
    });
  });

  it('normalizes failedRecipientNos and ignores obsolete recipientNos arrays', () => {
    const merge = mergeResultSnapshotEntries({
      entries: [],
      recipientCount: 2,
      snapshot: {
        states: ['F', 'S'],
        resultCodes: ['3003', '1000'],
        recipientNos: ['01000000000', '01022223333'],
        failedRecipientNos: {
          0: '01000000000',
          1: ' \n01012345678\u0007 ',
          2: '01022223333',
          3: '01033334444',
          bad: '01044445555',
        },
      },
    });

    expect(merge.snapshot).toEqual({
      states: ['F', 'S'],
      resultCodes: ['3003', '1000'],
      failedRecipientNos: {
        1: '01012345678',
      },
    });
    expect(listFailedResultSnapshotEntries({
      states: ['F'],
      resultCodes: ['3003'],
      recipientNos: ['01000000000'],
    }, 1)).toEqual([{
      recipientNo: null,
      recipientSeq: 1,
      resultCode: '3003',
    }]);
  });
});

function createGroupInput(overrides = {}) {
  return {
    billingAccountId: 'billing_1',
    channel: 'sms',
    expiresAt: EXPIRES_AT,
    id: 'ledger_group_1',
    managementTitle: 'June operation notice',
    sendKind: 'basic',
    sendTiming: 'immediate',
    senderResourceId: 'sender_resource_1',
    totalRecipientCount: 1000,
    userId: 'user_1',
    ...overrides,
  };
}

function createProviderRequestInput(overrides = {}) {
  return {
    clientRequestId: `00000000-0000-4000-8000-${String(overrides.sequence ?? 1).padStart(12, '0')}`,
    id: `ledger_request_${overrides.sequence ?? 1}`,
    nextSyncAt: NEXT_SYNC_AT,
    recipientCount: 1000,
    sequence: 1,
    ...overrides,
  };
}

function createMemoryLedgerRepository() {
  return {
    groupCounter: 0,
    groups: [],
    providerRequestCounter: 0,
    providerRequests: [],

    async createGroupWithProviderRequests({ group, providerRequests = [], now = new Date() }) {
      const createdGroup = this.toGroup({
        providerRequestCount: providerRequests.length,
        ...group,
      }, now);
      this.groups.push(createdGroup);

      const createdProviderRequests = providerRequests.map((request) => this.toProviderRequest({
        ...request,
        groupId: createdGroup.id,
      }, now));
      this.providerRequests.push(...createdProviderRequests);

      return {
        group: createdGroup,
        providerRequests: createdProviderRequests,
      };
    },

    async listGroupsForActor({ actorUserId, channel, includeArchived = false, limit = 20, offset = 0 }) {
      return this.groups
        .filter((group) => group.userId === actorUserId)
        .filter((group) => !channel || group.channel === channel)
        .filter((group) => includeArchived || !group.archivedAt)
        .sort((left, right) => Number(right.createdAt) - Number(left.createdAt) || left.id.localeCompare(right.id))
        .slice(offset, offset + limit);
    },

    async getGroupForActor({ actorUserId, groupId, includeArchived = false }) {
      return this.groups.find((group) => (
        group.id === groupId
        && group.userId === actorUserId
        && (includeArchived || !group.archivedAt)
      )) ?? null;
    },

    async archiveExpiredGroups({
      archiveReason = 'expired',
      now = new Date(),
      purgeAfter = addDays(now, 30),
    } = {}) {
      const candidates = this.groups
        .filter((group) => !group.archivedAt && group.expiresAt <= now)
        .sort((left, right) => Number(left.expiresAt) - Number(right.expiresAt) || left.id.localeCompare(right.id));

      for (const group of candidates) {
        group.archivedAt = now;
        group.archiveReason = archiveReason;
        group.purgeAfter = purgeAfter;
        group.updatedAt = now;
      }

      return candidates;
    },

    async purgeArchivedGroups({ now = new Date() } = {}) {
      const purgedGroups = this.groups
        .filter((group) => group.archivedAt && group.purgeAfter && group.purgeAfter <= now);
      const purgedGroupIds = new Set(purgedGroups.map((group) => group.id));
      this.groups = this.groups.filter((group) => !purgedGroupIds.has(group.id));
      this.providerRequests = this.providerRequests.filter((request) => !purgedGroupIds.has(request.groupId));
      return purgedGroups;
    },

    async leaseSyncableProviderRequests({
      channels = ['sms', 'lms', 'mms'],
      leaseExpiresAt,
      limit = 10,
      now = new Date(),
      resultStates = ['not_synced', 'stale', 'error', 'partially_synced'],
      sendKinds = ['bulk'],
      workerId,
    }) {
      const candidates = this.providerRequests
        .filter((request) => {
          const group = this.groups.find((item) => item.id === request.groupId);
          return group
            && sendKinds.includes(group.sendKind)
            && channels.includes(group.channel)
            && !group.archivedAt
            && !group.resultFinalizedAt
            && resultStates.includes(request.resultState)
            && !request.resultFinalizedAt
            && request.nextSyncAt
            && request.nextSyncAt <= now
            && (!request.syncLeaseExpiresAt || request.syncLeaseExpiresAt <= now);
        })
        .sort((left, right) => Number(left.nextSyncAt) - Number(right.nextSyncAt) || left.id.localeCompare(right.id))
        .slice(0, limit);

      for (const request of candidates) {
        request.resultState = 'syncing';
        request.syncAttempts += 1;
        request.syncLeaseExpiresAt = leaseExpiresAt;
        request.syncLockedBy = workerId;
        request.updatedAt = now;
      }

      return candidates;
    },

    async initializeProviderRequestSnapshot({ requestId, now = new Date() }) {
      const request = this.providerRequests.find((item) => item.id === requestId);
      if (!request) return null;

      request.resultSnapshotJson = createInitialResultSnapshot(request.recipientCount);
      request.resultSnapshotVersion = 0;
      request.firstResultReceivedAt = null;
      Object.assign(request, getLedgerRequestResultCounts(request), {
        resultState: getMemoryResultStateFromCounts(getLedgerRequestResultCounts(request)),
        updatedAt: now,
      });
      this.rollupGroupFromRequests(request.groupId, now);

      return request;
    },

    async listProviderRequestsByProviderRequestId({ providerRequestId, channel, includeArchived = false }) {
      return this.providerRequests
        .map((providerRequest) => ({
          group: this.groups.find((group) => group.id === providerRequest.groupId),
          providerRequest,
        }))
        .filter((row) => row.group)
        .filter((row) => row.providerRequest.providerRequestId === providerRequestId)
        .filter((row) => !channel || row.group.channel === channel)
        .filter((row) => includeArchived || !row.group.archivedAt)
        .sort((left, right) => (
          Number(right.providerRequest.createdAt) - Number(left.providerRequest.createdAt)
          || left.providerRequest.id.localeCompare(right.providerRequest.id)
        ));
    },

    async mergeProviderRequestResultSnapshot({
      authoritative = false,
      entries = [],
      finalize = false,
      now = new Date(),
      requestId,
    }) {
      const request = this.providerRequests.find((item) => item.id === requestId);
      if (!request) return null;

      const merge = mergeResultSnapshotEntries({
        authoritative,
        entries,
        recipientCount: request.recipientCount,
        snapshot: request.resultSnapshotJson,
      });
      const shouldFinalize = finalize || merge.counts.pendingCount === 0;
      const nextResultState = getMemoryResultStateFromCounts(merge.counts, { finalized: shouldFinalize });

      if (merge.changedCount === 0) {
        if (finalize) {
          Object.assign(request, merge.counts, {
            resultFinalizedAt: now,
            resultSnapshotJson: request.resultSnapshotJson ?? merge.snapshot,
            resultState: nextResultState,
            resultSyncedAt: now,
            updatedAt: now,
          });
          const group = this.rollupGroupFromRequests(request.groupId, now);
          return {
            changedCount: 0,
            group,
            groupId: request.groupId,
            providerRequest: request,
          };
        }

        return {
          changedCount: 0,
          group: null,
          groupId: request.groupId,
          providerRequest: request,
        };
      }

      Object.assign(request, merge.counts, {
        firstResultReceivedAt: request.firstResultReceivedAt ?? (merge.firstTerminalChanged ? now : null),
        resultFinalizedAt: shouldFinalize ? now : null,
        resultSnapshotJson: merge.snapshot,
        resultSnapshotVersion: request.resultSnapshotVersion + 1,
        resultState: nextResultState,
        resultSyncedAt: now,
        updatedAt: now,
      });
      const group = this.rollupGroupFromRequests(request.groupId, now);

      return {
        changedCount: merge.changedCount,
        group,
        groupId: request.groupId,
        providerRequest: request,
      };
    },

    async mergeProviderRequestResultSnapshotByProviderRequestId({
      authoritative = false,
      finalize = false,
      now = new Date(),
      providerRequestId,
      results = [],
    }) {
      const request = this.providerRequests
        .filter((item) => item.providerRequestId === providerRequestId)
        .sort((left, right) => Number(right.createdAt) - Number(left.createdAt) || left.id.localeCompare(right.id))[0];

      if (!request) return null;

      return this.mergeProviderRequestResultSnapshot({
        authoritative,
        entries: results,
        finalize,
        now,
        requestId: request.id,
      });
    },

    rollupGroupFromRequests(groupId, now) {
      const group = this.groups.find((item) => item.id === groupId);
      const requests = this.providerRequests.filter((request) => request.groupId === groupId);
      if (!group || !requests.length) return null;

      Object.assign(group, {
        acceptedRequestCount: requests.filter((request) => request.providerState === 'accepted').length,
        canceledCount: sumMemoryRequestResultCount(requests, 'canceledCount'),
        failedCount: sumMemoryRequestResultCount(requests, 'failedCount'),
        pendingCount: sumMemoryRequestResultCount(requests, 'pendingCount'),
        providerRequestCount: requests.length,
        providerState: getMemoryGroupProviderState(requests),
        resultFinalizedAt: requests.every((request) => request.resultFinalizedAt)
          ? getLatestDate(requests.map((request) => request.resultFinalizedAt))
          : null,
        resultState: getMemoryGroupResultState(requests),
        resultSyncedAt: getLatestDate(requests.map((request) => request.resultSyncedAt)),
        successCount: sumMemoryRequestResultCount(requests, 'successCount'),
        updatedAt: now,
      });

      return group;
    },

    toGroup(values, now) {
      this.groupCounter += 1;
      const id = values.id ?? `ledger_group_${this.groupCounter}`;
      return {
        acceptedRequestCount: values.acceptedRequestCount ?? 0,
        archiveReason: values.archiveReason ?? null,
        archivedAt: values.archivedAt ?? null,
        billingAccountId: values.billingAccountId,
        canceledCount: values.canceledCount ?? 0,
        channel: values.channel,
        createdAt: values.createdAt ?? now,
        expiresAt: values.expiresAt,
        failedCount: values.failedCount ?? 0,
        id,
        managementTitle: sanitizeManagementTitle(
          values.managementTitle,
          buildGeneratedManagementTitle(values)
        ),
        pendingCount: values.pendingCount ?? 0,
        providerRequestCount: values.providerRequestCount ?? 0,
        providerState: values.providerState ?? 'queued',
        purgeAfter: values.purgeAfter ?? null,
        resultFinalizedAt: values.resultFinalizedAt ?? null,
        resultState: values.resultState ?? 'not_synced',
        resultSyncedAt: values.resultSyncedAt ?? null,
        scheduledAt: values.scheduledAt ?? null,
        sendKind: values.sendKind ?? 'basic',
        sendTiming: values.sendTiming ?? 'immediate',
        senderResourceId: values.senderResourceId,
        successCount: values.successCount ?? 0,
        totalRecipientCount: values.totalRecipientCount,
        updatedAt: values.updatedAt ?? now,
        userId: values.userId,
      };
    },

    toProviderRequest(values, now) {
      this.providerRequestCounter += 1;
      const id = values.id ?? `ledger_request_${this.providerRequestCounter}`;
      const resultSnapshotJson = values.resultSnapshotJson ?? (
        values.initializeResultSnapshot ? createInitialResultSnapshot(values.recipientCount) : null
      );
      const counts = resultSnapshotJson
        ? getLedgerRequestResultCounts({ recipientCount: values.recipientCount, resultSnapshotJson })
        : {
            canceledCount: values.canceledCount ?? 0,
            failedCount: values.failedCount ?? 0,
            pendingCount: values.pendingCount ?? 0,
            successCount: values.successCount ?? 0,
          };

      return {
        canceledCount: counts.canceledCount,
        clientRequestId: values.clientRequestId,
        createdAt: values.createdAt ?? now,
        failedCount: counts.failedCount,
        firstResultReceivedAt: values.firstResultReceivedAt ?? null,
        groupId: values.groupId,
        id,
        nextSyncAt: values.nextSyncAt ?? null,
        pendingCount: counts.pendingCount,
        providerRequestId: values.providerRequestId ?? null,
        providerState: values.providerState ?? 'queued',
        recipientCount: values.recipientCount,
        resultFinalizedAt: values.resultFinalizedAt ?? null,
        resultSnapshotJson,
        resultSnapshotVersion: values.resultSnapshotVersion ?? 0,
        resultState: values.resultState ?? 'not_synced',
        resultSyncedAt: values.resultSyncedAt ?? null,
        sequence: values.sequence,
        successCount: counts.successCount,
        syncAttempts: values.syncAttempts ?? 0,
        syncLeaseExpiresAt: values.syncLeaseExpiresAt ?? null,
        syncLockedBy: values.syncLockedBy ?? null,
        updatedAt: values.updatedAt ?? now,
      };
    },
  };
}

function getMemoryResultStateFromCounts(counts, { finalized = false } = {}) {
  const totalCount = counts.successCount + counts.failedCount + counts.pendingCount + counts.canceledCount;

  if (finalized && counts.pendingCount > 0) return 'stale';
  if (totalCount === 0 || counts.pendingCount === totalCount) return 'not_synced';
  if (counts.pendingCount > 0) return 'partially_synced';
  return 'synced';
}

function getMemoryGroupProviderState(requests) {
  const acceptedCount = requests.filter((request) => request.providerState === 'accepted').length;
  if (acceptedCount === requests.length) return 'accepted';
  if (acceptedCount > 0) return 'partial';
  if (requests.some((request) => request.providerState === 'unknown')) return 'unknown';
  if (requests.some((request) => request.providerState === 'failed' || request.providerState === 'rejected')) {
    return 'failed';
  }
  if (requests.some((request) => request.providerState === 'sending')) return 'sending';
  return 'queued';
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

function sumMemoryRequestResultCount(requests, key) {
  return requests.reduce((total, request) => total + getLedgerRequestResultCounts(request)[key], 0);
}

function getLatestDate(values) {
  const dates = values.filter((value) => value instanceof Date && Number.isFinite(value.getTime()));
  if (!dates.length) return null;

  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}
