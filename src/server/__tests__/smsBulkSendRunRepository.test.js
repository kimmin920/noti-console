import { describe, expect, it } from 'vitest';

import { SmsBulkSendQuotaError } from '../messages/repository.js';

const FIXED_NOW = new Date('2026-06-05T12:00:00.000Z');
const PAYLOAD_EXPIRES_AT = new Date('2026-06-05T13:00:00.000Z');

describe('SMS bulk send run repository contract', () => {
  it('creates a 50000-recipient run as 50 worker batches and reserves quota', async () => {
    const repository = createMemoryBulkSendRepository({ quotaLimit: 60000 });
    const result = await repository.createRunWithBatchesAndReservation(
      createBulkRunInput({
        totalRecipients: 50000,
        totalBatches: 50,
      })
    );

    expect(result.run).toMatchObject({
      id: 'bulk_run_1',
      runRef: 'runref1',
      userId: 'user_1',
      senderResourceId: 'sms_resource_1',
      channel: 'sms',
      managementSendName: 'June operation notice',
      totalRecipients: 50000,
      batchSize: 1000,
      totalBatches: 50,
      status: 'queued',
    });
    expect(result.batches).toHaveLength(50);
    expect(result.batches[0]).toMatchObject({
      runId: 'bulk_run_1',
      sequence: 1,
      recipientCount: 1000,
      status: 'pending',
      payloadJson: expect.objectContaining({ batchSequence: 1 }),
      payloadExpiresAt: PAYLOAD_EXPIRES_AT,
    });
    expect(result.quotaBucket).toMatchObject({
      quotaLimit: 60000,
      reservedCount: 50000,
      consumedCount: 0,
    });
    expect(result.quotaReservation).toMatchObject({
      runId: 'bulk_run_1',
      reservedCount: 50000,
      consumedCount: 0,
      releasedCount: 0,
      status: 'reserved',
    });
    expect(JSON.stringify(result.run)).not.toContain('01012345678');
    expect(JSON.stringify(result.run)).not.toContain('Private SMS body');

    await expect(repository.getRunForActor({ actorUserId: 'other_user', runId: 'bulk_run_1' })).resolves.toBeNull();
    await expect(repository.getRunForActor({ actorUserId: 'user_1', runId: 'bulk_run_1' })).resolves.toMatchObject({
      id: 'bulk_run_1',
    });
  });

  it('claims batches, purges terminal payload, recomputes run counts, and consumes quota', async () => {
    const repository = createMemoryBulkSendRepository({ quotaLimit: 10000 });
    await repository.createRunWithBatchesAndReservation(createBulkRunInput({ totalRecipients: 2000, totalBatches: 2 }));

    const firstClaim = await repository.claimNextPendingBatch({
      workerId: 'worker-a',
      leaseExpiresAt: new Date('2026-06-05T12:05:00.000Z'),
      now: FIXED_NOW,
    });

    expect(firstClaim).toMatchObject({
      run: { id: 'bulk_run_1', status: 'running' },
      batch: {
        sequence: 1,
        status: 'sending',
        attempts: 1,
        lockedBy: 'worker-a',
        payloadJson: expect.objectContaining({ batchSequence: 1 }),
      },
    });

    const acceptedBatch = await repository.markBatchAccepted({
      batchId: firstClaim.batch.id,
      providerRequestId: 'sms-request-1',
      now: FIXED_NOW,
    });
    expect(acceptedBatch).toMatchObject({
      status: 'accepted',
      providerRequestId: 'sms-request-1',
      payloadJson: null,
      payloadPurgedAt: FIXED_NOW,
    });

    const quotaAfterConsume = await repository.consumeQuotaReservation({
      runId: 'bulk_run_1',
      recipientCount: 1000,
      now: FIXED_NOW,
    });
    expect(quotaAfterConsume).toMatchObject({
      consumedCount: 1000,
      quotaBucket: {
        reservedCount: 1000,
        consumedCount: 1000,
      },
      quotaReservation: {
        consumedCount: 1000,
        status: 'reserved',
      },
    });

    const secondClaim = await repository.claimNextPendingBatch({
      workerId: 'worker-a',
      leaseExpiresAt: new Date('2026-06-05T12:05:00.000Z'),
      now: FIXED_NOW,
    });
    await repository.markBatchUnknown({
      batchId: secondClaim.batch.id,
      errorCode: 'PROVIDER_TIMEOUT',
      errorState: 'unknown_after_provider_call',
      errorMessage: 'Provider result is unknown.',
      now: FIXED_NOW,
    });

    const recomputedRun = await repository.recomputeRunAggregateCounts({ runId: 'bulk_run_1', now: FIXED_NOW });
    expect(recomputedRun).toMatchObject({
      acceptedCount: 1000,
      rejectedCount: 0,
      unknownCount: 1000,
      status: 'blocked',
      finishedAt: FIXED_NOW,
    });

    const quotaAfterRelease = await repository.releaseQuotaReservation({ runId: 'bulk_run_1', now: FIXED_NOW });
    expect(quotaAfterRelease).toMatchObject({
      releasedCount: 1000,
      quotaBucket: {
        reservedCount: 0,
        consumedCount: 1000,
      },
      quotaReservation: {
        consumedCount: 1000,
        releasedCount: 1000,
        status: 'released',
      },
    });
  });

  it('rejects run creation when the quota bucket has no available capacity', async () => {
    const repository = createMemoryBulkSendRepository({ quotaLimit: 1000 });

    await expect(
      repository.createRunWithBatchesAndReservation(createBulkRunInput({ totalRecipients: 2000, totalBatches: 2 }))
    ).rejects.toBeInstanceOf(SmsBulkSendQuotaError);

    expect(repository.runs).toEqual([]);
    expect(repository.batches).toEqual([]);
    expect(repository.quotaReservations).toEqual([]);
  });

  it('purges expired payloads without touching unexpired worker payload', async () => {
    const repository = createMemoryBulkSendRepository({ quotaLimit: 10000 });
    await repository.createRunWithBatchesAndReservation(
      createBulkRunInput({
        totalRecipients: 2000,
        totalBatches: 2,
        batches: [
          createBatchInput({
            sequence: 1,
            payloadExpiresAt: new Date('2026-06-05T11:00:00.000Z'),
          }),
          createBatchInput({
            sequence: 2,
            payloadExpiresAt: new Date('2026-06-05T13:00:00.000Z'),
          }),
        ],
      })
    );

    const purged = await repository.purgeExpiredPayloads({ now: FIXED_NOW });

    expect(purged).toEqual([expect.objectContaining({ sequence: 1, payloadJson: null })]);
    expect(repository.batches.find((batch) => batch.sequence === 2)).toMatchObject({
      payloadJson: expect.objectContaining({ batchSequence: 2 }),
      payloadPurgedAt: null,
    });
  });

  it('maps provider request ids back to actor-owned safe bulk run summaries', async () => {
    const repository = createMemoryBulkSendRepository({ quotaLimit: 10000 });
    await repository.createRunWithBatchesAndReservation(createBulkRunInput({
      requestDate: '2026-06-07 10:00',
      totalRecipients: 3000,
      totalBatches: 3,
    }));

    const claims = [];
    for (let index = 0; index < 3; index += 1) {
      claims.push(await repository.claimNextPendingBatch({
        workerId: 'worker-a',
        leaseExpiresAt: new Date('2026-06-05T12:05:00.000Z'),
        now: FIXED_NOW,
      }));
      await repository.markBatchAccepted({
        batchId: claims[index].batch.id,
        providerRequestId: `sms-bulk-request-${index + 1}`,
        now: FIXED_NOW,
      });
    }

    repository.runs.push({
      ...repository.runs[0],
      id: 'bulk_run_other_user',
      runRef: 'otherref',
      userId: 'other_user',
      managementSendName: 'Other user title',
    });
    repository.batches.push({
      ...repository.batches[0],
      id: 'bulk_batch_other_user',
      runId: 'bulk_run_other_user',
      providerRequestId: 'sms-other-user-request',
    });

    const mappings = await repository.findSmsBulkRunMappingsByProviderRequestIds({
      actorUserId: 'user_1',
      providerRequestIds: [
        'sms-bulk-request-1',
        'sms-bulk-request-2',
        'sms-bulk-request-2',
        'sms-bulk-request-3',
        'sms-other-user-request',
        '',
        null,
      ],
    });

    expect([...mappings.keys()]).toEqual([
      'sms-bulk-request-1',
      'sms-bulk-request-2',
      'sms-bulk-request-3',
    ]);
    expect(mappings.get('sms-bulk-request-1')).toMatchObject({
      run: {
        id: 'bulk_run_1',
        managementSendName: 'June operation notice',
        requestDate: '2026-06-07 10:00',
        senderResourceId: 'sms_resource_1',
        totalRecipients: 3000,
      },
      batch: {
        providerRequestId: 'sms-bulk-request-1',
        recipientCount: 1000,
        sequence: 1,
        status: 'accepted',
      },
    });
    expect(mappings.has('sms-other-user-request')).toBe(false);
    expect(mappings.has('missing-request')).toBe(false);
    expect(JSON.stringify([...mappings.values()])).not.toContain('payloadJson');
    expect(JSON.stringify([...mappings.values()])).not.toContain('Private SMS body');
    expect(JSON.stringify([...mappings.values()])).not.toContain('01012345678');
  });

  it('does not guess when a provider request id collides across sender resources', async () => {
    const repository = createMemoryBulkSendRepository({ quotaLimit: 10000 });
    repository.runs.push(
      {
        ...createBulkRunInput({ totalRecipients: 1, totalBatches: 1 }).run,
        id: 'bulk_run_primary',
        createdAt: FIXED_NOW,
        status: 'completed',
        updatedAt: FIXED_NOW,
      },
      {
        ...createBulkRunInput({ totalRecipients: 1, totalBatches: 1 }).run,
        id: 'bulk_run_secondary',
        runRef: 'runref2',
        senderResourceId: 'sms_resource_2',
        createdAt: FIXED_NOW,
        status: 'completed',
        updatedAt: FIXED_NOW,
      }
    );
    repository.batches.push(
      {
        ...createBatchInput({ sequence: 1 }),
        id: 'bulk_batch_primary',
        runId: 'bulk_run_primary',
        providerRequestId: 'shared-provider-request',
        status: 'accepted',
      },
      {
        ...createBatchInput({ sequence: 1 }),
        id: 'bulk_batch_secondary',
        runId: 'bulk_run_secondary',
        providerRequestId: 'shared-provider-request',
        status: 'accepted',
      }
    );

    const ambiguousMappings = await repository.findSmsBulkRunMappingsByProviderRequestIds({
      actorUserId: 'user_1',
      providerRequestIds: ['shared-provider-request'],
    });
    const primaryMappings = await repository.findSmsBulkRunMappingsByProviderRequestIds({
      actorUserId: 'user_1',
      providerRequestIds: ['shared-provider-request'],
      senderResourceId: 'sms_resource_1',
    });
    const secondaryMappings = await repository.findSmsBulkRunMappingsByProviderRequestIds({
      actorUserId: 'user_1',
      providerRequestIds: ['shared-provider-request'],
      senderResourceId: 'sms_resource_2',
    });

    expect(ambiguousMappings.has('shared-provider-request')).toBe(false);
    expect(primaryMappings.get('shared-provider-request')).toMatchObject({
      run: { id: 'bulk_run_primary', senderResourceId: 'sms_resource_1' },
    });
    expect(secondaryMappings.get('shared-provider-request')).toMatchObject({
      run: { id: 'bulk_run_secondary', senderResourceId: 'sms_resource_2' },
    });
  });
});

function createBulkRunInput(overrides = {}) {
  const totalBatches = overrides.totalBatches ?? 2;
  return {
    run: {
      runRef: 'runref1',
      userId: 'user_1',
      senderResourceId: 'sms_resource_1',
      billingAccountId: 'billing_1',
      channel: 'sms',
      managementSendName: 'June operation notice',
      requestDate: overrides.requestDate ?? null,
      totalRecipients: overrides.totalRecipients ?? 2000,
      batchSize: 1000,
      totalBatches,
    },
    batches:
      overrides.batches ??
      Array.from({ length: totalBatches }, (_, index) =>
        createBatchInput({
          sequence: index + 1,
        })
      ),
    quotaBucket: {
      userId: 'user_1',
      channel: 'sms',
      quotaScope: 'user_period',
      periodStartAt: new Date('2026-06-01T00:00:00.000Z'),
      periodEndAt: new Date('2026-06-30T23:59:59.000Z'),
      quotaLimit: 50000,
    },
    now: FIXED_NOW,
  };
}

function createBatchInput(overrides = {}) {
  const sequence = overrides.sequence ?? 1;
  return {
    sequence,
    recipientCount: 1000,
    clientRequestId: `de305d54-75b4-431b-adb2-eb6b9e546${String(sequence).padStart(3, '0')}`,
    payloadJson: {
      batchSequence: sequence,
      title: 'Private SMS title',
      message: 'Private SMS body',
      phones: ['01012345678'],
    },
    payloadExpiresAt: overrides.payloadExpiresAt ?? PAYLOAD_EXPIRES_AT,
  };
}

function createMemoryBulkSendRepository({ quotaLimit }) {
  return {
    runs: [],
    batches: [],
    quotaBuckets: [
      {
        id: 'quota_bucket_1',
        userId: 'user_1',
        channel: 'sms',
        quotaScope: 'user_period',
        periodStartAt: new Date('2026-06-01T00:00:00.000Z'),
        periodEndAt: new Date('2026-06-30T23:59:59.000Z'),
        quotaLimit,
        reservedCount: 0,
        consumedCount: 0,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      },
    ],
    quotaReservations: [],

    async createRunWithBatchesAndReservation({ run, batches, now }) {
      const bucket = this.quotaBuckets[0];
      const availableCount = bucket.quotaLimit - bucket.reservedCount - bucket.consumedCount;

      if (availableCount < run.totalRecipients) {
        throw new SmsBulkSendQuotaError('SMS quota is not available for this bulk send run.');
      }

      const createdRun = {
        id: `bulk_run_${this.runs.length + 1}`,
        acceptedCount: 0,
        rejectedCount: 0,
        unknownCount: 0,
        failedCount: 0,
        status: 'queued',
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
        ...run,
      };
      const createdBatches = batches.map((batch) => ({
        id: `bulk_batch_${this.batches.length + batch.sequence}`,
        runId: createdRun.id,
        status: 'pending',
        attempts: 0,
        lockedBy: null,
        leaseExpiresAt: null,
        payloadPurgedAt: null,
        createdAt: now,
        updatedAt: now,
        ...batch,
      }));
      const reservation = {
        id: `quota_reservation_${this.quotaReservations.length + 1}`,
        bucketId: bucket.id,
        runId: createdRun.id,
        userId: createdRun.userId,
        channel: createdRun.channel,
        quotaScope: bucket.quotaScope,
        reservedCount: createdRun.totalRecipients,
        consumedCount: 0,
        releasedCount: 0,
        status: 'reserved',
        createdAt: now,
        updatedAt: now,
      };

      bucket.reservedCount += createdRun.totalRecipients;
      bucket.updatedAt = now;
      this.runs.push(createdRun);
      this.batches.push(...createdBatches);
      this.quotaReservations.push(reservation);

      return {
        run: createdRun,
        batches: createdBatches,
        quotaBucket: bucket,
        quotaReservation: reservation,
      };
    },

    async getRunForActor({ actorUserId, runId }) {
      return this.runs.find((run) => run.id === runId && run.userId === actorUserId) ?? null;
    },

    async findSmsBulkRunMappingsByProviderRequestIds({ actorUserId, channel, providerRequestIds, senderResourceId }) {
      const ids = [...new Set(providerRequestIds.filter((value) => typeof value === 'string' && value.trim()))];
      const mappings = new Map();

      for (const providerRequestId of ids) {
        const candidates = this.batches
          .filter((item) => item.providerRequestId === providerRequestId)
          .map((batch) => ({
            batch,
            run: this.runs.find((item) => item.id === batch.runId && item.userId === actorUserId),
          }))
          .filter(({ run }) => (
            run
            && (!channel || run.channel === channel)
            && (!senderResourceId || run.senderResourceId === senderResourceId)
          ));

        if (candidates.length !== 1) continue;

        const { batch, run } = candidates[0];
        if (!run) continue;

        mappings.set(providerRequestId, {
          batch: {
            id: batch.id,
            runId: batch.runId,
            sequence: batch.sequence,
            recipientCount: batch.recipientCount,
            status: batch.status,
            providerRequestId: batch.providerRequestId,
            errorCode: batch.errorCode ?? null,
            errorState: batch.errorState ?? null,
            errorMessage: batch.errorMessage ?? null,
          },
          run: {
            id: run.id,
            userId: run.userId,
            senderResourceId: run.senderResourceId,
            billingAccountId: run.billingAccountId,
            channel: run.channel,
            managementSendName: run.managementSendName ?? null,
            requestDate: run.requestDate ?? null,
            totalRecipients: run.totalRecipients,
            batchSize: run.batchSize,
            totalBatches: run.totalBatches,
            acceptedCount: run.acceptedCount,
            rejectedCount: run.rejectedCount,
            unknownCount: run.unknownCount,
            failedCount: run.failedCount,
            status: run.status,
          },
        });
      }

      return mappings;
    },

    async claimNextPendingBatch({ workerId, leaseExpiresAt, now }) {
      const run = this.runs.find((item) => item.status === 'queued' || item.status === 'running');
      if (!run) return null;

      const batch = this.batches
        .filter((item) => item.runId === run.id)
        .sort((left, right) => left.sequence - right.sequence)
        .find(
          (item) =>
            item.status === 'pending' &&
            item.payloadPurgedAt === null &&
            (!item.leaseExpiresAt || item.leaseExpiresAt <= now)
        );
      if (!batch) return null;

      Object.assign(run, {
        status: 'running',
        startedAt: run.startedAt ?? now,
        updatedAt: now,
      });
      Object.assign(batch, {
        status: 'sending',
        attempts: batch.attempts + 1,
        lockedBy: workerId,
        leaseExpiresAt,
        claimedAt: now,
        updatedAt: now,
      });

      return { run, batch };
    },

    async markBatchAccepted({ batchId, providerRequestId, now }) {
      return this.markBatchTerminal(batchId, 'accepted', { providerRequestId }, now);
    },

    async markBatchUnknown({ batchId, errorCode, errorState, errorMessage, now }) {
      return this.markBatchTerminal(batchId, 'unknown', { errorCode, errorState, errorMessage }, now);
    },

    async markBatchTerminal(batchId, status, values, now) {
      const batch = this.batches.find((item) => item.id === batchId);
      Object.assign(batch, {
        status,
        ...values,
        lockedBy: null,
        leaseExpiresAt: null,
        finishedAt: now,
        payloadJson: null,
        payloadPurgedAt: now,
        updatedAt: now,
      });
      return batch;
    },

    async recomputeRunAggregateCounts({ runId, now }) {
      const run = this.runs.find((item) => item.id === runId);
      const runBatches = this.batches.filter((batch) => batch.runId === runId);
      const counts = runBatches.reduce(
        (nextCounts, batch) => {
          if (batch.status === 'accepted') nextCounts.acceptedCount += batch.recipientCount;
          if (batch.status === 'rejected') nextCounts.rejectedCount += batch.recipientCount;
          if (batch.status === 'unknown') nextCounts.unknownCount += batch.recipientCount;
          if (batch.status === 'failed') nextCounts.failedCount += batch.recipientCount;
          return nextCounts;
        },
        { acceptedCount: 0, rejectedCount: 0, unknownCount: 0, failedCount: 0 }
      );
      const status = runBatches.some((batch) => batch.status === 'unknown') ? 'blocked' : 'completed';
      Object.assign(run, {
        ...counts,
        status,
        finishedAt: now,
        updatedAt: now,
      });
      return run;
    },

    async consumeQuotaReservation({ runId, recipientCount, now }) {
      const reservation = this.quotaReservations.find((item) => item.runId === runId);
      const bucket = this.quotaBuckets.find((item) => item.id === reservation.bucketId);
      const consumableCount = Math.min(
        recipientCount,
        reservation.reservedCount - reservation.consumedCount - reservation.releasedCount
      );

      bucket.reservedCount -= consumableCount;
      bucket.consumedCount += consumableCount;
      reservation.consumedCount += consumableCount;
      reservation.status =
        reservation.consumedCount + reservation.releasedCount >= reservation.reservedCount
          ? 'consumed'
          : 'reserved';
      bucket.updatedAt = now;
      reservation.updatedAt = now;

      return { quotaBucket: bucket, quotaReservation: reservation, consumedCount: consumableCount };
    },

    async releaseQuotaReservation({ runId, now }) {
      const reservation = this.quotaReservations.find((item) => item.runId === runId);
      const bucket = this.quotaBuckets.find((item) => item.id === reservation.bucketId);
      const releaseCount = reservation.reservedCount - reservation.consumedCount - reservation.releasedCount;

      bucket.reservedCount -= releaseCount;
      reservation.releasedCount += releaseCount;
      reservation.status = reservation.consumedCount >= reservation.reservedCount ? 'consumed' : 'released';
      bucket.updatedAt = now;
      reservation.updatedAt = now;

      return { quotaBucket: bucket, quotaReservation: reservation, releasedCount: releaseCount };
    },

    async purgeExpiredPayloads({ now }) {
      const purged = [];

      for (const batch of this.batches) {
        if (batch.payloadPurgedAt === null && batch.payloadExpiresAt <= now) {
          Object.assign(batch, {
            payloadJson: null,
            payloadPurgedAt: now,
            updatedAt: now,
          });
          purged.push(batch);
        }
      }

      return purged;
    },
  };
}
