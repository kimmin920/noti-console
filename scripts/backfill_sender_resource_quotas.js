import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';

import { closeDb, getDb } from '../src/db/client.js';
import {
  messageSendGroups,
  messageSendProviderRequests,
  senderResourceQuotaBuckets,
  senderResourceQuotaReservations,
  senderResources,
} from '../src/db/schema.js';
import {
  buildSenderResourceQuotaDescriptor,
  getKstMonthlyQuotaPeriod,
} from '../src/server/messages/quota.js';

const BATCH_SIZE = 500;
const db = getDb();
const startedAt = new Date();
const earliestEffectiveAt = getKstMonthlyQuotaPeriod(startedAt).periodStartAt;
let cursor = null;
let scannedCount = 0;
let insertedCount = 0;

while (true) {
  const result = await db.transaction(async (tx) => {
    const cursorPredicate = cursor ? gt(messageSendProviderRequests.id, cursor) : undefined;
    const effectiveAt = sql`coalesce(${messageSendGroups.scheduledAt}, ${messageSendProviderRequests.createdAt}, ${messageSendGroups.createdAt})`;
    const rows = await tx
      .select({
        group: messageSendGroups,
        providerRequest: messageSendProviderRequests,
        senderResource: senderResources,
      })
      .from(messageSendProviderRequests)
      .innerJoin(messageSendGroups, eq(messageSendProviderRequests.groupId, messageSendGroups.id))
      .innerJoin(senderResources, eq(messageSendGroups.senderResourceId, senderResources.id))
      .where(and(
        isNull(messageSendGroups.archivedAt),
        inArray(messageSendGroups.channel, ['sms', 'lms', 'mms', 'alimtalk', 'brand-message']),
        sql`${effectiveAt} >= ${earliestEffectiveAt.toISOString()}::timestamp with time zone`,
        cursorPredicate
      ))
      .orderBy(asc(messageSendProviderRequests.id))
      .limit(BATCH_SIZE)
      .for('update');

    if (!rows.length) return { done: true, inserted: 0, lastId: cursor, scanned: 0 };

    const touchedBucketIds = new Set();
    let inserted = 0;

    for (const row of rows) {
      const effectiveDate = row.group.scheduledAt ?? row.providerRequest.createdAt ?? row.group.createdAt;
      const quota = buildSenderResourceQuotaDescriptor({
        channel: row.group.channel,
        effectiveAt: effectiveDate,
        senderResourceId: row.group.senderResourceId,
      });

      if (!isOpenOrFuturePeriod(quota, startedAt)) continue;

      const [bucket] = await tx
        .insert(senderResourceQuotaBuckets)
        .values({
          ...quota,
          quotaLimit: row.senderResource.quotaLimit,
          reservedCount: 0,
          consumedCount: 0,
          updatedAt: startedAt,
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
            updatedAt: startedAt,
          },
        })
        .returning();
      const reservedCount = Math.max(0, Number(row.providerRequest.recipientCount ?? 0));
      const consumedCount = Math.min(reservedCount, Math.max(0, Number(row.providerRequest.successCount ?? 0)));
      const releasedCount = Math.min(
        reservedCount - consumedCount,
        Math.max(0, Number(row.providerRequest.failedCount ?? 0))
          + Math.max(0, Number(row.providerRequest.canceledCount ?? 0))
      );
      const remainingCount = reservedCount - consumedCount - releasedCount;

      if (reservedCount === 0) continue;

      const created = await tx
        .insert(senderResourceQuotaReservations)
        .values({
          bucketId: bucket.id,
          providerRequestId: row.providerRequest.id,
          kind: 'primary',
          reservedCount,
          consumedCount,
          releasedCount,
          settledAt: remainingCount === 0 ? (row.providerRequest.resultFinalizedAt ?? startedAt) : null,
          createdAt: row.providerRequest.createdAt,
          updatedAt: startedAt,
        })
        .onConflictDoNothing()
        .returning({ id: senderResourceQuotaReservations.id });

      inserted += created.length;
      touchedBucketIds.add(bucket.id);
    }

    for (const bucketId of touchedBucketIds) {
      const [aggregate] = await tx
        .select({
          consumedCount: sql`coalesce(sum(${senderResourceQuotaReservations.consumedCount}), 0)`,
          reservedCount: sql`coalesce(sum(${senderResourceQuotaReservations.reservedCount} - ${senderResourceQuotaReservations.consumedCount} - ${senderResourceQuotaReservations.releasedCount}), 0)`,
        })
        .from(senderResourceQuotaReservations)
        .where(eq(senderResourceQuotaReservations.bucketId, bucketId));

      await tx
        .update(senderResourceQuotaBuckets)
        .set({
          consumedCount: Number(aggregate?.consumedCount ?? 0),
          reservedCount: Number(aggregate?.reservedCount ?? 0),
          updatedAt: startedAt,
        })
        .where(eq(senderResourceQuotaBuckets.id, bucketId));
    }

    return {
      done: rows.length < BATCH_SIZE,
      inserted,
      lastId: rows.at(-1).providerRequest.id,
      scanned: rows.length,
    };
  });

  scannedCount += result.scanned;
  insertedCount += result.inserted;
  cursor = result.lastId;

  if (result.done) break;
}

console.log(`[quota-backfill] scanned=${scannedCount} inserted=${insertedCount}`);
await closeDb();

function isOpenOrFuturePeriod(quota, now) {
  return quota.periodEndAt > now;
}
