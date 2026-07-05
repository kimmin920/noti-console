import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import {
  auditLogs,
  billingAccounts,
  senderResources,
  smsBulkSendBatches,
  smsBulkSendRuns,
  smsQuotaBuckets,
  smsQuotaReservations,
  userSenderResources,
  users,
} from '../../db/schema.js';
import { sanitizeAuditMetadata } from '../audit/service.js';

const CLAIMABLE_RUN_STATUSES = ['queued', 'running'];
const TERMINAL_BATCH_STATUSES = new Set(['accepted', 'rejected', 'unknown', 'failed', 'canceled']);
const TERMINAL_RUN_STATUSES = new Set(['completed', 'blocked', 'failed', 'canceled']);

export function createMessageSendRepository(db) {
  return {
    async getUserById(userId) {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      return user ?? null;
    },

    async getUserSenderResource({ userId, senderResourceId }) {
      const [row] = await db
        .select({
          link: userSenderResources,
          resource: senderResources,
        })
        .from(userSenderResources)
        .innerJoin(senderResources, eq(userSenderResources.senderResourceId, senderResources.id))
        .where(
          and(
            eq(userSenderResources.userId, userId),
            eq(userSenderResources.senderResourceId, senderResourceId)
          )
        )
        .limit(1);

      return row ?? null;
    },

    async getBillingAccountById(billingAccountId) {
      const [billingAccount] = await db
        .select()
        .from(billingAccounts)
        .where(eq(billingAccounts.id, billingAccountId))
        .limit(1);

      return billingAccount ?? null;
    },

    async findBillingAccountForUser(userId) {
      const [billingAccount] = await db
        .select()
        .from(billingAccounts)
        .where(and(eq(billingAccounts.ownerType, 'user'), eq(billingAccounts.ownerId, userId)))
        .limit(1);

      return billingAccount ?? null;
    },

    async createAuditLog(values) {
      const [auditLog] = await db
        .insert(auditLogs)
        .values({
          ...values,
          metadataJson: sanitizeAuditMetadata(values.metadataJson ?? {}),
        })
        .returning();
      return auditLog;
    },
  };
}

export function createSmsBulkSendRunRepository(db) {
  return {
    async createRunWithBatchesAndReservation({
      run,
      batches,
      quotaBucket,
      quotaReservation = {},
      now = new Date(),
    }) {
      return db.transaction(async (tx) => {
        const [bucket] = await tx
          .insert(smsQuotaBuckets)
          .values({
            ...quotaBucket,
            reservedCount: quotaBucket.reservedCount ?? 0,
            consumedCount: quotaBucket.consumedCount ?? 0,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              smsQuotaBuckets.userId,
              smsQuotaBuckets.channel,
              smsQuotaBuckets.quotaScope,
              smsQuotaBuckets.periodStartAt,
              smsQuotaBuckets.periodEndAt,
            ],
            set: {
              quotaLimit: quotaBucket.quotaLimit,
              updatedAt: now,
            },
          })
          .returning();

        const reserveCount = run.totalRecipients;
        const [reservedBucket] = await tx
          .update(smsQuotaBuckets)
          .set({
            reservedCount: sql`${smsQuotaBuckets.reservedCount} + ${reserveCount}`,
            updatedAt: now,
          })
          .where(
            and(
              eq(smsQuotaBuckets.id, bucket.id),
              lte(
                sql`${smsQuotaBuckets.reservedCount} + ${smsQuotaBuckets.consumedCount} + ${reserveCount}`,
                smsQuotaBuckets.quotaLimit
              )
            )
          )
          .returning();

        if (!reservedBucket) {
          throw new SmsBulkSendQuotaError('SMS quota is not available for this bulk send run.');
        }

        const [createdRun] = await tx
          .insert(smsBulkSendRuns)
          .values({
            ...run,
            updatedAt: now,
          })
          .returning();

        const createdBatches = batches.length
          ? await tx
              .insert(smsBulkSendBatches)
              .values(
                batches.map((batch) => ({
                  ...batch,
                  runId: createdRun.id,
                  updatedAt: now,
                }))
              )
              .returning()
          : [];

        const [reservation] = await tx
          .insert(smsQuotaReservations)
          .values({
            ...quotaReservation,
            bucketId: reservedBucket.id,
            runId: createdRun.id,
            userId: createdRun.userId,
            channel: createdRun.channel,
            quotaScope: reservedBucket.quotaScope,
            reservedCount: reserveCount,
            updatedAt: now,
          })
          .returning();

        return {
          run: createdRun,
          batches: createdBatches,
          quotaBucket: reservedBucket,
          quotaReservation: reservation,
        };
      });
    },

    async getRunForActor({ actorUserId, runId }) {
      const [run] = await db
        .select()
        .from(smsBulkSendRuns)
        .where(and(eq(smsBulkSendRuns.id, runId), eq(smsBulkSendRuns.userId, actorUserId)))
        .limit(1);

      return run ?? null;
    },

    async listRunsForActor({ actorUserId, activeOnly = false, limit = 20 }) {
      const statusFilter = activeOnly
        ? inArray(smsBulkSendRuns.status, ['queued', 'running', 'completed', 'blocked', 'failed'])
        : undefined;

      return db
        .select()
        .from(smsBulkSendRuns)
        .where(and(eq(smsBulkSendRuns.userId, actorUserId), statusFilter))
        .orderBy(sql`${smsBulkSendRuns.createdAt} desc`)
        .limit(limit);
    },

    async listBatchesForRun(runId) {
      return db
        .select()
        .from(smsBulkSendBatches)
        .where(eq(smsBulkSendBatches.runId, runId))
        .orderBy(asc(smsBulkSendBatches.sequence));
    },

    async listSmsBulkBatchesForActor({ actorUserId, runId, senderResourceId }) {
      if (!actorUserId || !runId) return [];

      const predicates = [
        eq(smsBulkSendRuns.userId, actorUserId),
        eq(smsBulkSendRuns.id, runId),
      ];

      if (senderResourceId) {
        predicates.push(eq(smsBulkSendRuns.senderResourceId, senderResourceId));
      }

      const rows = await db
        .select({
          batchId: smsBulkSendBatches.id,
          batchRunId: smsBulkSendBatches.runId,
          sequence: smsBulkSendBatches.sequence,
          recipientCount: smsBulkSendBatches.recipientCount,
          batchStatus: smsBulkSendBatches.status,
          providerRequestId: smsBulkSendBatches.providerRequestId,
          batchErrorCode: smsBulkSendBatches.errorCode,
          batchErrorState: smsBulkSendBatches.errorState,
          batchErrorMessage: smsBulkSendBatches.errorMessage,
          requestDate: smsBulkSendRuns.requestDate,
          totalBatches: smsBulkSendRuns.totalBatches,
        })
        .from(smsBulkSendBatches)
        .innerJoin(smsBulkSendRuns, eq(smsBulkSendBatches.runId, smsBulkSendRuns.id))
        .where(and(...predicates))
        .orderBy(asc(smsBulkSendBatches.sequence));

      return rows.map(toSmsBulkBatchSummary);
    },

    async findSmsBulkRunMappingsByProviderRequestIds({
      actorUserId,
      channel,
      providerRequestIds,
      senderResourceId,
    }) {
      const ids = normalizeProviderRequestIds(providerRequestIds);
      if (!actorUserId || !ids.length) return new Map();

      const predicates = [
        eq(smsBulkSendRuns.userId, actorUserId),
        inArray(smsBulkSendBatches.providerRequestId, ids),
      ];

      if (channel) {
        predicates.push(eq(smsBulkSendRuns.channel, channel));
      }

      if (senderResourceId) {
        predicates.push(eq(smsBulkSendRuns.senderResourceId, senderResourceId));
      }

      const rows = await db
        .select({
          batchId: smsBulkSendBatches.id,
          batchRunId: smsBulkSendBatches.runId,
          sequence: smsBulkSendBatches.sequence,
          recipientCount: smsBulkSendBatches.recipientCount,
          batchStatus: smsBulkSendBatches.status,
          providerRequestId: smsBulkSendBatches.providerRequestId,
          batchErrorCode: smsBulkSendBatches.errorCode,
          batchErrorState: smsBulkSendBatches.errorState,
          batchErrorMessage: smsBulkSendBatches.errorMessage,
          runId: smsBulkSendRuns.id,
          runUserId: smsBulkSendRuns.userId,
          runSenderResourceId: smsBulkSendRuns.senderResourceId,
          runBillingAccountId: smsBulkSendRuns.billingAccountId,
          runChannel: smsBulkSendRuns.channel,
          managementSendName: smsBulkSendRuns.managementSendName,
          requestDate: smsBulkSendRuns.requestDate,
          totalRecipients: smsBulkSendRuns.totalRecipients,
          batchSize: smsBulkSendRuns.batchSize,
          totalBatches: smsBulkSendRuns.totalBatches,
          acceptedCount: smsBulkSendRuns.acceptedCount,
          rejectedCount: smsBulkSendRuns.rejectedCount,
          unknownCount: smsBulkSendRuns.unknownCount,
          failedCount: smsBulkSendRuns.failedCount,
          runStatus: smsBulkSendRuns.status,
        })
        .from(smsBulkSendBatches)
        .innerJoin(smsBulkSendRuns, eq(smsBulkSendBatches.runId, smsBulkSendRuns.id))
        .where(and(...predicates));

      const rowsByProviderRequestId = new Map();

      for (const row of rows) {
        if (!row.providerRequestId) continue;

        const providerRows = rowsByProviderRequestId.get(row.providerRequestId) ?? [];
        providerRows.push(row);
        rowsByProviderRequestId.set(row.providerRequestId, providerRows);
      }

      const mappings = new Map();

      for (const [providerRequestId, providerRows] of rowsByProviderRequestId) {
        if (providerRows.length !== 1) continue;
        mappings.set(providerRequestId, toSmsBulkRunMapping(providerRows[0]));
      }

      return mappings;
    },

    async findActiveSmsQuotaBucket({ userId, channel, now = new Date() }) {
      const [bucket] = await db
        .select()
        .from(smsQuotaBuckets)
        .where(
          and(
            eq(smsQuotaBuckets.userId, userId),
            eq(smsQuotaBuckets.channel, channel),
            eq(smsQuotaBuckets.quotaScope, 'user_period'),
            lte(smsQuotaBuckets.periodStartAt, now),
            gte(smsQuotaBuckets.periodEndAt, now)
          )
        )
        .orderBy(sql`${smsQuotaBuckets.periodEndAt} asc`)
        .limit(1);

      return bucket ?? null;
    },

    async updateRunForActor({ actorUserId, runId, values, now = new Date() }) {
      const [run] = await db
        .update(smsBulkSendRuns)
        .set({ ...values, updatedAt: now })
        .where(and(eq(smsBulkSendRuns.id, runId), eq(smsBulkSendRuns.userId, actorUserId)))
        .returning();

      return run ?? null;
    },

    async claimNextPendingBatch({ workerId, leaseExpiresAt, now = new Date() }) {
      return db.transaction(async (tx) => {
        const [candidate] = await tx
          .select({
            batch: smsBulkSendBatches,
            run: smsBulkSendRuns,
          })
          .from(smsBulkSendBatches)
          .innerJoin(smsBulkSendRuns, eq(smsBulkSendBatches.runId, smsBulkSendRuns.id))
          .where(
            and(
              eq(smsBulkSendBatches.status, 'pending'),
              isNull(smsBulkSendBatches.payloadPurgedAt),
              or(isNull(smsBulkSendBatches.leaseExpiresAt), lte(smsBulkSendBatches.leaseExpiresAt, now)),
              inArray(smsBulkSendRuns.status, CLAIMABLE_RUN_STATUSES),
              lte(smsBulkSendRuns.nextBatchAvailableAt, now)
            )
          )
          .orderBy(asc(smsBulkSendRuns.createdAt), asc(smsBulkSendBatches.sequence))
          .limit(1)
          .for('update', { skipLocked: true });

        if (!candidate) return null;

        const [run] = await tx
          .update(smsBulkSendRuns)
          .set({
            status: 'running',
            startedAt: sql`coalesce(${smsBulkSendRuns.startedAt}, ${timestampSql(now)})`,
            updatedAt: now,
          })
          .where(eq(smsBulkSendRuns.id, candidate.run.id))
          .returning();

        const [batch] = await tx
          .update(smsBulkSendBatches)
          .set({
            status: 'sending',
            attempts: sql`${smsBulkSendBatches.attempts} + 1`,
            lockedBy: workerId,
            leaseExpiresAt,
            claimedAt: now,
            updatedAt: now,
          })
          .where(eq(smsBulkSendBatches.id, candidate.batch.id))
          .returning();

        return { run, batch };
      });
    },

    async markBatchAccepted({ batchId, providerRequestId, now = new Date() }) {
      const [batch] = await db
        .update(smsBulkSendBatches)
        .set(terminalBatchValues('accepted', now, { providerRequestId }))
        .where(eq(smsBulkSendBatches.id, batchId))
        .returning();

      return batch ?? null;
    },

    async markBatchRejected({ batchId, errorCode, errorState, errorMessage, now = new Date() }) {
      const [batch] = await db
        .update(smsBulkSendBatches)
        .set(terminalBatchValues('rejected', now, { errorCode, errorState, errorMessage }))
        .where(eq(smsBulkSendBatches.id, batchId))
        .returning();

      return batch ?? null;
    },

    async markBatchFailed({ batchId, errorCode, errorState, errorMessage, now = new Date() }) {
      const [batch] = await db
        .update(smsBulkSendBatches)
        .set(terminalBatchValues('failed', now, { errorCode, errorState, errorMessage }))
        .where(eq(smsBulkSendBatches.id, batchId))
        .returning();

      return batch ?? null;
    },

    async markBatchUnknown({ batchId, errorCode, errorState, errorMessage, now = new Date() }) {
      const [batch] = await db
        .update(smsBulkSendBatches)
        .set(terminalBatchValues('unknown', now, { errorCode, errorState, errorMessage }))
        .where(eq(smsBulkSendBatches.id, batchId))
        .returning();

      return batch ?? null;
    },

    async recomputeRunAggregateCounts({ runId, now = new Date() }) {
      const batches = await db
        .select()
        .from(smsBulkSendBatches)
        .where(eq(smsBulkSendBatches.runId, runId))
        .orderBy(asc(smsBulkSendBatches.sequence));

      const aggregate = aggregateBatchState(batches);
      const values = {
        acceptedCount: aggregate.acceptedCount,
        rejectedCount: aggregate.rejectedCount,
        unknownCount: aggregate.unknownCount,
        failedCount: aggregate.failedCount,
        status: aggregate.status,
        updatedAt: now,
      };

      if (TERMINAL_RUN_STATUSES.has(aggregate.status)) {
        values.finishedAt = now;
      }

      const [run] = await db
        .update(smsBulkSendRuns)
        .set(values)
        .where(eq(smsBulkSendRuns.id, runId))
        .returning();

      return run ?? null;
    },

    async consumeQuotaReservation({ runId, recipientCount, now = new Date() }) {
      return db.transaction(async (tx) => {
        const reservation = await getQuotaReservationByRunId(tx, runId);
        if (!reservation || reservation.status === 'released') return null;

        const consumableCount = Math.max(
          0,
          Math.min(recipientCount, reservation.reservedCount - reservation.consumedCount - reservation.releasedCount)
        );

        if (consumableCount === 0) {
          return {
            quotaBucket: await getQuotaBucketById(tx, reservation.bucketId),
            quotaReservation: reservation,
            consumedCount: 0,
          };
        }

        const nextConsumedCount = reservation.consumedCount + consumableCount;
        const nextStatus =
          nextConsumedCount + reservation.releasedCount >= reservation.reservedCount ? 'consumed' : 'reserved';

        const [bucket] = await tx
          .update(smsQuotaBuckets)
          .set({
            reservedCount: sql`${smsQuotaBuckets.reservedCount} - ${consumableCount}`,
            consumedCount: sql`${smsQuotaBuckets.consumedCount} + ${consumableCount}`,
            updatedAt: now,
          })
          .where(eq(smsQuotaBuckets.id, reservation.bucketId))
          .returning();

        const [updatedReservation] = await tx
          .update(smsQuotaReservations)
          .set({
            consumedCount: nextConsumedCount,
            status: nextStatus,
            consumedAt: nextStatus === 'consumed' ? now : reservation.consumedAt,
            updatedAt: now,
          })
          .where(eq(smsQuotaReservations.id, reservation.id))
          .returning();

        return {
          quotaBucket: bucket,
          quotaReservation: updatedReservation,
          consumedCount: consumableCount,
        };
      });
    },

    async releaseQuotaReservation({ runId, now = new Date() }) {
      return db.transaction(async (tx) => {
        const reservation = await getQuotaReservationByRunId(tx, runId);
        if (!reservation || reservation.status === 'released') return null;

        const releaseCount = Math.max(
          0,
          reservation.reservedCount - reservation.consumedCount - reservation.releasedCount
        );
        const nextReleasedCount = reservation.releasedCount + releaseCount;
        const nextStatus =
          reservation.consumedCount >= reservation.reservedCount ? 'consumed' : 'released';

        const [bucket] = await tx
          .update(smsQuotaBuckets)
          .set({
            reservedCount: sql`${smsQuotaBuckets.reservedCount} - ${releaseCount}`,
            updatedAt: now,
          })
          .where(eq(smsQuotaBuckets.id, reservation.bucketId))
          .returning();

        const [updatedReservation] = await tx
          .update(smsQuotaReservations)
          .set({
            releasedCount: nextReleasedCount,
            status: nextStatus,
            releasedAt: releaseCount > 0 ? now : reservation.releasedAt,
            updatedAt: now,
          })
          .where(eq(smsQuotaReservations.id, reservation.id))
          .returning();

        return {
          quotaBucket: bucket,
          quotaReservation: updatedReservation,
          releasedCount: releaseCount,
        };
      });
    },

    async purgeBatchPayload({ batchId, now = new Date() }) {
      const [batch] = await db
        .update(smsBulkSendBatches)
        .set({
          payloadJson: null,
          payloadPurgedAt: now,
          updatedAt: now,
        })
        .where(and(eq(smsBulkSendBatches.id, batchId), isNull(smsBulkSendBatches.payloadPurgedAt)))
        .returning();

      return batch ?? null;
    },

    async purgeExpiredPayloads({ now = new Date(), limit = 100 } = {}) {
      const expiredBatches = await db
        .select({ id: smsBulkSendBatches.id })
        .from(smsBulkSendBatches)
        .where(and(isNull(smsBulkSendBatches.payloadPurgedAt), lte(smsBulkSendBatches.payloadExpiresAt, now)))
        .orderBy(asc(smsBulkSendBatches.payloadExpiresAt))
        .limit(limit);

      if (!expiredBatches.length) return [];

      return db
        .update(smsBulkSendBatches)
        .set({
          payloadJson: null,
          payloadPurgedAt: now,
          updatedAt: now,
        })
        .where(
          inArray(
            smsBulkSendBatches.id,
            expiredBatches.map((batch) => batch.id)
          )
        )
        .returning();
    },
  };
}

function toSmsBulkRunMapping(row) {
  return {
    batch: {
      id: row.batchId,
      runId: row.batchRunId,
      sequence: row.sequence,
      recipientCount: row.recipientCount,
      status: row.batchStatus,
      providerRequestId: row.providerRequestId,
      errorCode: row.batchErrorCode,
      errorState: row.batchErrorState,
      errorMessage: row.batchErrorMessage,
    },
    run: {
      id: row.runId,
      userId: row.runUserId,
      senderResourceId: row.runSenderResourceId,
      billingAccountId: row.runBillingAccountId,
      channel: row.runChannel,
      managementSendName: row.managementSendName,
      requestDate: row.requestDate,
      totalRecipients: row.totalRecipients,
      batchSize: row.batchSize,
      totalBatches: row.totalBatches,
      acceptedCount: row.acceptedCount,
      rejectedCount: row.rejectedCount,
      unknownCount: row.unknownCount,
      failedCount: row.failedCount,
      status: row.runStatus,
    },
  };
}

function toSmsBulkBatchSummary(row) {
  return {
    errorCode: row.batchErrorCode,
    errorMessage: row.batchErrorMessage,
    errorState: row.batchErrorState,
    id: row.batchId,
    providerRequestId: row.providerRequestId,
    recipientCount: row.recipientCount,
    requestDate: row.requestDate,
    runId: row.batchRunId,
    sequence: row.sequence,
    status: row.batchStatus,
    totalBatches: row.totalBatches,
  };
}

export class SmsBulkSendQuotaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SmsBulkSendQuotaError';
  }
}

function terminalBatchValues(status, now, values = {}) {
  return {
    status,
    ...values,
    lockedBy: null,
    leaseExpiresAt: null,
    finishedAt: now,
    payloadJson: null,
    payloadPurgedAt: now,
    updatedAt: now,
  };
}

function normalizeProviderRequestIds(providerRequestIds) {
  const ids = new Set();

  for (const value of Array.isArray(providerRequestIds) ? providerRequestIds : []) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;

    const normalized = String(value).trim();
    if (normalized) {
      ids.add(normalized);
    }
  }

  return Array.from(ids);
}

function aggregateBatchState(batches) {
  const aggregate = {
    acceptedCount: 0,
    rejectedCount: 0,
    unknownCount: 0,
    failedCount: 0,
    status: 'queued',
  };

  for (const batch of batches) {
    if (batch.status === 'accepted') {
      aggregate.acceptedCount += batch.recipientCount;
    } else if (batch.status === 'rejected') {
      aggregate.rejectedCount += batch.recipientCount;
    } else if (batch.status === 'unknown') {
      aggregate.unknownCount += batch.recipientCount;
    } else if (batch.status === 'failed') {
      aggregate.failedCount += batch.recipientCount;
    }
  }

  if (batches.length === 0) return aggregate;

  const allTerminal = batches.every((batch) => TERMINAL_BATCH_STATUSES.has(batch.status));

  if (batches.some((batch) => batch.status === 'unknown')) {
    aggregate.status = 'blocked';
  } else if (batches.some((batch) => batch.status === 'failed' || batch.status === 'rejected')) {
    aggregate.status = 'failed';
  } else if (batches.every((batch) => batch.status === 'canceled')) {
    aggregate.status = 'canceled';
  } else if (allTerminal) {
    aggregate.status = 'completed';
  } else if (batches.some((batch) => batch.status === 'sending' || batch.status === 'accepted')) {
    aggregate.status = 'running';
  }

  return aggregate;
}

async function getQuotaReservationByRunId(db, runId) {
  const [reservation] = await db
    .select()
    .from(smsQuotaReservations)
    .where(eq(smsQuotaReservations.runId, runId))
    .limit(1)
    .for('update');

  return reservation ?? null;
}

async function getQuotaBucketById(db, bucketId) {
  const [bucket] = await db
    .select()
    .from(smsQuotaBuckets)
    .where(eq(smsQuotaBuckets.id, bucketId))
    .limit(1)
    .for('update');

  return bucket ?? null;
}

function timestampSql(value) {
  return sql`${toPostgresTimestamp(value)}::timestamp with time zone`;
}

function toPostgresTimestamp(value) {
  return value instanceof Date ? value.toISOString() : value;
}
