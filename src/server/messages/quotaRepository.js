import { and, eq, inArray, sql } from 'drizzle-orm';

import {
  senderResourceQuotaBuckets,
  senderResourceQuotaReservations,
  senderResources,
} from '../../db/schema.js';
import {
  SenderResourceQuotaExceededError,
  countQuotaSnapshotStates,
  getQuotaSettlementTargets,
} from './quota.js';

const PRIMARY_SUCCESS_RESULT_CODE = 'PRIMARY_SUCCESS';
const PRIMARY_CANCELED_RESULT_CODE = 'PRIMARY_CANCELED';
const PRIMARY_REJECTED_RESULT_CODE = 'PRIMARY_REJECTED';

export async function reserveSenderResourceQuotasTx(tx, {
  now = new Date(),
  providerRequests = [],
  reservations = [],
}) {
  if (!reservations.length) return [];

  const requestsByClientId = new Map(providerRequests.map((request) => [request.clientRequestId, request]));
  const resourceIds = [...new Set(reservations.map((reservation) => reservation.quota.senderResourceId))].sort();
  const resources = await tx
    .select()
    .from(senderResources)
    .where(inArray(senderResources.id, resourceIds))
    .orderBy(senderResources.id)
    .for('update');
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));

  if (resourcesById.size !== resourceIds.length) {
    throw new Error('Sender resource was not found while reserving quota.');
  }

  const orderedReservations = [...reservations].sort(compareQuotaReservations);
  const created = [];

  for (const reservation of orderedReservations) {
    const request = requestsByClientId.get(reservation.clientRequestId);
    const resource = resourcesById.get(reservation.quota.senderResourceId);
    const reserveCount = normalizePositiveInteger(reservation.reservedCount, 'reservedCount');

    if (!request) {
      throw new Error('Provider request was not created before quota reservation.');
    }
    if (!Number.isInteger(resource.quotaLimit) || resource.quotaLimit <= 0) {
      throw new Error('Sender resource quota limit is invalid.');
    }

    const [bucket] = await tx
      .insert(senderResourceQuotaBuckets)
      .values({
        senderResourceId: reservation.quota.senderResourceId,
        quotaChannel: reservation.quota.quotaChannel,
        periodStartAt: reservation.quota.periodStartAt,
        periodEndAt: reservation.quota.periodEndAt,
        quotaLimit: resource.quotaLimit,
        reservedCount: 0,
        consumedCount: 0,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          senderResourceQuotaBuckets.senderResourceId,
          senderResourceQuotaBuckets.quotaChannel,
          senderResourceQuotaBuckets.periodStartAt,
          senderResourceQuotaBuckets.periodEndAt,
        ],
        set: {
          quotaLimit: sql`greatest(${senderResourceQuotaBuckets.quotaLimit}, excluded.quota_limit)`,
          updatedAt: now,
        },
      })
      .returning();

    const [reservedBucket] = await tx
      .update(senderResourceQuotaBuckets)
      .set({
        reservedCount: sql`${senderResourceQuotaBuckets.reservedCount} + ${reserveCount}`,
        updatedAt: now,
      })
      .where(
        and(
          eq(senderResourceQuotaBuckets.id, bucket.id),
          sql`${senderResourceQuotaBuckets.reservedCount} + ${senderResourceQuotaBuckets.consumedCount} + ${reserveCount} <= ${senderResourceQuotaBuckets.quotaLimit}`
        )
      )
      .returning();

    if (!reservedBucket) {
      throw new SenderResourceQuotaExceededError({
        quotaChannel: reservation.quota.quotaChannel,
        requestedCount: reserveCount,
        senderResourceId: reservation.quota.senderResourceId,
      });
    }

    const [createdReservation] = await tx
      .insert(senderResourceQuotaReservations)
      .values({
        bucketId: reservedBucket.id,
        providerRequestId: request.id,
        kind: reservation.kind,
        reservedCount: reserveCount,
        settlementSnapshotJson: reservation.settlementSnapshotJson ?? null,
        updatedAt: now,
      })
      .returning();

    created.push({ bucket: reservedBucket, reservation: createdReservation });
  }

  return created;
}

export async function settlePrimaryQuotaForProviderRequestTx(tx, {
  now = new Date(),
  providerRequestId,
  resultCounts,
}) {
  const reservation = await getQuotaReservationForUpdate(tx, { kind: 'primary', providerRequestId });
  if (!reservation) return null;

  return settleQuotaReservationRowTx(tx, {
    now,
    reservation,
    ...getQuotaSettlementTargets(resultCounts),
  });
}

export async function releaseProviderRequestQuotaReservationsTx(tx, {
  now = new Date(),
  providerRequestId,
}) {
  const reservations = await tx
    .select()
    .from(senderResourceQuotaReservations)
    .where(eq(senderResourceQuotaReservations.providerRequestId, providerRequestId))
    .orderBy(senderResourceQuotaReservations.bucketId, senderResourceQuotaReservations.id)
    .for('update');
  const settled = [];

  for (const reservation of reservations) {
    settled.push(await settleQuotaReservationRowTx(tx, {
      now,
      reservation,
      targetConsumedCount: reservation.consumedCount,
      targetReleasedCount: reservation.reservedCount - reservation.consumedCount,
    }));
  }

  return settled;
}

export async function syncFallbackQuotaFromPrimarySnapshotTx(tx, {
  now = new Date(),
  primarySnapshot,
  providerRequestId,
  recipientCount,
}) {
  const reservation = await getQuotaReservationForUpdate(tx, { kind: 'fallback', providerRequestId });
  if (!reservation) return null;

  const fallbackSnapshot = normalizeQuotaSnapshot(reservation.settlementSnapshotJson, recipientCount);
  const primary = normalizeQuotaSnapshot(primarySnapshot, recipientCount);
  let fallbackOpenedAt = reservation.fallbackOpenedAt;

  for (let index = 0; index < recipientCount; index += 1) {
    const primaryState = primary.states[index];
    const fallbackState = fallbackSnapshot.states[index];
    const fallbackResultCode = fallbackSnapshot.resultCodes[index];
    const fallbackTerminal = fallbackState === 'S' || fallbackState === 'F';
    const providerCanceled = fallbackState === 'C' && fallbackResultCode !== PRIMARY_SUCCESS_RESULT_CODE;

    if (fallbackTerminal || providerCanceled) continue;

    if (primaryState === 'S') {
      fallbackSnapshot.states[index] = 'C';
      fallbackSnapshot.resultCodes[index] = PRIMARY_SUCCESS_RESULT_CODE;
    } else if (primaryState === 'F') {
      fallbackSnapshot.states[index] = 'P';
      fallbackSnapshot.resultCodes[index] = null;
      fallbackOpenedAt ??= now;
    } else if (primaryState === 'C') {
      fallbackSnapshot.states[index] = 'C';
      fallbackSnapshot.resultCodes[index] = PRIMARY_CANCELED_RESULT_CODE;
    }
  }

  const counts = countQuotaSnapshotStates(fallbackSnapshot, recipientCount);
  const [updatedReservation] = await tx
    .update(senderResourceQuotaReservations)
    .set({
      settlementSnapshotJson: fallbackSnapshot,
      fallbackOpenedAt,
      updatedAt: now,
    })
    .where(eq(senderResourceQuotaReservations.id, reservation.id))
    .returning();

  return settleQuotaReservationRowTx(tx, {
    now,
    reservation: updatedReservation,
    targetConsumedCount: counts.successCount,
    targetReleasedCount: counts.failedCount + counts.canceledCount,
  });
}

export async function releaseFallbackQuotaForPrimaryRejectionsTx(tx, {
  now = new Date(),
  providerRequestId,
  recipientCount,
  recipientSequences = [],
}) {
  if (!recipientSequences.length) return null;

  const reservation = await getQuotaReservationForUpdate(tx, { kind: 'fallback', providerRequestId });
  if (!reservation) return null;

  const snapshot = normalizeQuotaSnapshot(reservation.settlementSnapshotJson, recipientCount);

  for (const value of recipientSequences) {
    const recipientSeq = Number(value);
    if (!Number.isInteger(recipientSeq) || recipientSeq < 1 || recipientSeq > recipientCount) continue;

    const index = recipientSeq - 1;
    const state = snapshot.states[index];
    const resultCode = snapshot.resultCodes[index];
    const providerTerminal = state === 'S' || state === 'F' || (state === 'C' && resultCode !== PRIMARY_SUCCESS_RESULT_CODE);

    if (providerTerminal) continue;

    snapshot.states[index] = 'C';
    snapshot.resultCodes[index] = PRIMARY_REJECTED_RESULT_CODE;
  }

  const counts = countQuotaSnapshotStates(snapshot, recipientCount);
  const [updatedReservation] = await tx
    .update(senderResourceQuotaReservations)
    .set({
      settlementSnapshotJson: snapshot,
      updatedAt: now,
    })
    .where(eq(senderResourceQuotaReservations.id, reservation.id))
    .returning();

  return settleQuotaReservationRowTx(tx, {
    now,
    reservation: updatedReservation,
    targetConsumedCount: counts.successCount,
    targetReleasedCount: counts.failedCount + counts.canceledCount,
  });
}

export async function mergeFallbackQuotaResultsTx(tx, {
  entries = [],
  finalize = false,
  now = new Date(),
  providerRequestId,
  recipientCount,
}) {
  const reservation = await getQuotaReservationForUpdate(tx, { kind: 'fallback', providerRequestId });
  if (!reservation) return null;

  const snapshot = normalizeQuotaSnapshot(reservation.settlementSnapshotJson, recipientCount);

  for (const entry of entries) {
    const recipientSeq = Number(entry?.recipientSeq);
    if (!Number.isInteger(recipientSeq) || recipientSeq < 1 || recipientSeq > recipientCount) continue;

    const mapped = mapFallbackResult(entry);
    if (!mapped) continue;

    const index = recipientSeq - 1;
    snapshot.states[index] = mapped.state;
    snapshot.resultCodes[index] = mapped.resultCode;
  }

  const counts = countQuotaSnapshotStates(snapshot, recipientCount);
  const [updatedReservation] = await tx
    .update(senderResourceQuotaReservations)
    .set({
      settlementSnapshotJson: snapshot,
      resultFinalizedAt: finalize ? (reservation.resultFinalizedAt ?? now) : reservation.resultFinalizedAt,
      resultSyncedAt: now,
      updatedAt: now,
    })
    .where(eq(senderResourceQuotaReservations.id, reservation.id))
    .returning();

  return settleQuotaReservationRowTx(tx, {
    now,
    reservation: updatedReservation,
    targetConsumedCount: counts.successCount,
    targetReleasedCount: counts.failedCount + counts.canceledCount,
  });
}

export async function settleQuotaReservationRowTx(tx, {
  now = new Date(),
  reservation,
  targetConsumedCount,
  targetReleasedCount,
}) {
  const consumed = normalizeNonNegativeInteger(targetConsumedCount, 'targetConsumedCount');
  const released = normalizeNonNegativeInteger(targetReleasedCount, 'targetReleasedCount');

  if (consumed + released > reservation.reservedCount) {
    throw new Error('Quota settlement exceeds the reserved count.');
  }

  const oldRemaining = reservation.reservedCount - reservation.consumedCount - reservation.releasedCount;
  const newRemaining = reservation.reservedCount - consumed - released;
  const consumedDelta = consumed - reservation.consumedCount;
  const remainingDelta = newRemaining - oldRemaining;

  const [bucket] = await tx
    .update(senderResourceQuotaBuckets)
    .set({
      consumedCount: sql`${senderResourceQuotaBuckets.consumedCount} + ${consumedDelta}`,
      reservedCount: sql`${senderResourceQuotaBuckets.reservedCount} + ${remainingDelta}`,
      updatedAt: now,
    })
    .where(eq(senderResourceQuotaBuckets.id, reservation.bucketId))
    .returning();

  if (!bucket) {
    throw new Error('Quota bucket was not found during settlement.');
  }

  const [updatedReservation] = await tx
    .update(senderResourceQuotaReservations)
    .set({
      consumedCount: consumed,
      releasedCount: released,
      settledAt: newRemaining === 0 ? (reservation.settledAt ?? now) : null,
      updatedAt: now,
    })
    .where(eq(senderResourceQuotaReservations.id, reservation.id))
    .returning();

  return { bucket, reservation: updatedReservation };
}

async function getQuotaReservationForUpdate(tx, { kind, providerRequestId }) {
  const [reservation] = await tx
    .select()
    .from(senderResourceQuotaReservations)
    .where(
      and(
        eq(senderResourceQuotaReservations.providerRequestId, providerRequestId),
        eq(senderResourceQuotaReservations.kind, kind)
      )
    )
    .limit(1)
    .for('update');

  return reservation ?? null;
}

function compareQuotaReservations(left, right) {
  const leftKey = [
    left.quota.senderResourceId,
    left.quota.quotaChannel,
    left.quota.periodStartAt.toISOString(),
    left.kind,
  ].join('|');
  const rightKey = [
    right.quota.senderResourceId,
    right.quota.quotaChannel,
    right.quota.periodStartAt.toISOString(),
    right.kind,
  ].join('|');

  return leftKey.localeCompare(rightKey);
}

function normalizeQuotaSnapshot(snapshot, recipientCount) {
  const length = Number.isInteger(recipientCount) && recipientCount >= 0 ? recipientCount : 0;

  return {
    states: Array.from({ length }, (_, index) => {
      const state = snapshot?.states?.[index];
      return state === 'S' || state === 'F' || state === 'C' ? state : 'P';
    }),
    resultCodes: Array.from({ length }, (_, index) => {
      const value = snapshot?.resultCodes?.[index];
      return typeof value === 'string' && value ? value.slice(0, 32) : null;
    }),
  };
}

function mapFallbackResult(entry) {
  const status = typeof entry?.resendStatus === 'string' ? entry.resendStatus.trim().toUpperCase() : '';
  const providerResultCode = typeof entry?.resendResultCode === 'string'
    ? entry.resendResultCode.trim().slice(0, 32)
    : null;
  const resultCode = providerResultCode || status || null;

  if (status === 'RSC01') return { state: 'C', resultCode };
  if (status === 'RSC02' || status === 'RSC03') return { state: 'P', resultCode };
  if (status === 'RSC04') return { state: 'S', resultCode };
  if (status === 'RSC05') return { state: 'F', resultCode };

  return null;
}

function normalizePositiveInteger(value, name) {
  const normalized = normalizeNonNegativeInteger(value, name);
  if (normalized === 0) throw new TypeError(`${name} must be positive.`);
  return normalized;
}

function normalizeNonNegativeInteger(value, name) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 0) {
    throw new TypeError(`${name} must be a nonnegative integer.`);
  }
  return normalized;
}
