import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { closeDb, getDb } from '../src/db/client.js';
import {
  billingAccounts,
  messageSendGroups,
  messageSendProviderRequests,
  senderResourceQuotaBuckets,
  senderResources,
  users,
} from '../src/db/schema.js';
import { buildSenderResourceQuotaDescriptor, SenderResourceQuotaExceededError } from '../src/server/messages/quota.js';
import {
  reserveSenderResourceQuotasTx,
  settlePrimaryQuotaForProviderRequestTx,
} from '../src/server/messages/quotaRepository.js';

const db = getDb();
const now = new Date('2026-07-17T05:00:00.000Z');
const rollbackSignal = new Error('quota verification rollback');

try {
  await db.transaction(async (tx) => {
    const suffix = randomUUID().replaceAll('-', '');
    const [user] = await tx
      .insert(users)
      .values({
        email: `quota-verify-${suffix}@example.invalid`,
        userRef: `qv_${suffix.slice(0, 16)}`,
      })
      .returning();
    const [billingAccount] = await tx
      .insert(billingAccounts)
      .values({
        billingRef: `qvb_${suffix.slice(0, 16)}`,
        ownerId: user.id,
      })
      .returning();
    const [senderResource] = await tx
      .insert(senderResources)
      .values({
        quotaLimit: 2,
        resourceRef: `qvr_${suffix.slice(0, 16)}`,
        type: 'sms_send_no',
        value: `verify-${suffix}`,
      })
      .returning();
    const [group] = await tx
      .insert(messageSendGroups)
      .values({
        billingAccountId: billingAccount.id,
        channel: 'sms',
        expiresAt: new Date('2026-10-17T05:00:00.000Z'),
        managementTitle: 'Quota verification',
        pendingCount: 2,
        providerRequestCount: 2,
        providerState: 'accepted',
        senderResourceId: senderResource.id,
        totalRecipientCount: 3,
        userId: user.id,
      })
      .returning();
    const [firstRequest] = await tx
      .insert(messageSendProviderRequests)
      .values({
        clientRequestId: randomUUID(),
        groupId: group.id,
        pendingCount: 2,
        providerRequestId: `verify-primary-${suffix}`,
        providerState: 'accepted',
        recipientCount: 2,
        resultSnapshotJson: { states: ['P', 'P'], resultCodes: [null, null] },
        sequence: 1,
      })
      .returning();
    const quota = buildSenderResourceQuotaDescriptor({
      channel: 'sms',
      effectiveAt: now,
      senderResourceId: senderResource.id,
    });

    const [created] = await reserveSenderResourceQuotasTx(tx, {
      now,
      providerRequests: [firstRequest],
      reservations: [{
        clientRequestId: firstRequest.clientRequestId,
        kind: 'primary',
        quota,
        reservedCount: 2,
      }],
    });
    assert.equal(created.bucket.quotaLimit, 2);
    assert.equal(created.bucket.reservedCount, 2);
    assert.equal(created.bucket.consumedCount, 0);

    const [secondRequest] = await tx
      .insert(messageSendProviderRequests)
      .values({
        clientRequestId: randomUUID(),
        groupId: group.id,
        pendingCount: 1,
        providerState: 'sending',
        recipientCount: 1,
        resultSnapshotJson: { states: ['P'], resultCodes: [null] },
        sequence: 2,
      })
      .returning();
    await assert.rejects(
      reserveSenderResourceQuotasTx(tx, {
        now,
        providerRequests: [secondRequest],
        reservations: [{
          clientRequestId: secondRequest.clientRequestId,
          kind: 'primary',
          quota,
          reservedCount: 1,
        }],
      }),
      SenderResourceQuotaExceededError
    );

    await settlePrimaryQuotaForProviderRequestTx(tx, {
      now,
      providerRequestId: firstRequest.id,
      resultCounts: { canceledCount: 0, failedCount: 1, pendingCount: 0, successCount: 1 },
    });
    let [bucket] = await tx
      .select()
      .from(senderResourceQuotaBuckets)
      .where(eq(senderResourceQuotaBuckets.id, created.bucket.id));
    assert.equal(bucket.reservedCount, 0);
    assert.equal(bucket.consumedCount, 1);

    await settlePrimaryQuotaForProviderRequestTx(tx, {
      now,
      providerRequestId: firstRequest.id,
      resultCounts: { canceledCount: 0, failedCount: 0, pendingCount: 0, successCount: 2 },
    });
    [bucket] = await tx
      .select()
      .from(senderResourceQuotaBuckets)
      .where(eq(senderResourceQuotaBuckets.id, created.bucket.id));
    assert.equal(bucket.reservedCount, 0);
    assert.equal(bucket.consumedCount, 2);

    throw rollbackSignal;
  });
} catch (error) {
  if (error !== rollbackSignal) throw error;
} finally {
  await closeDb();
}

console.log('[quota-db-verify] reservation, limit guard, settlement, and correction passed (rolled back)');
