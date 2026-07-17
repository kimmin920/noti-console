import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';

import {
  auditLogs,
  billingAccounts,
  messageSendGroups,
  messageSendProviderRequests,
  senderResourceQuotaReservations,
  senderResources,
  userSenderResources,
  users,
} from '../../db/schema.js';
import { sanitizeAuditMetadata } from '../audit/service.js';
import {
  releaseProviderRequestQuotaReservationsTx,
  releaseFallbackQuotaForPrimaryRejectionsTx,
  reserveSenderResourceQuotasTx,
  mergeFallbackQuotaResultsTx,
  settlePrimaryQuotaForProviderRequestTx,
  syncFallbackQuotaFromPrimarySnapshotTx,
} from '../messages/quotaRepository.js';
import { parseRecipientGroupingKey } from '../relay/groupingKeys.js';

export const LEDGER_MANAGEMENT_TITLE_MAX_LENGTH = 160;
const DEFAULT_SYNCABLE_RESULT_STATES = ['not_synced', 'stale', 'error', 'partially_synced'];
const DEFAULT_LEDGER_TITLE_BY_CHANNEL = {
  alimtalk: 'AlimTalk send',
  'brand-message': 'Brand message send',
  lms: 'LMS send',
  mms: 'MMS send',
  sms: 'SMS send',
};
const SNAPSHOT_PENDING_STATE = 'P';
const SNAPSHOT_STATE_VALUES = new Set(['P', 'S', 'F', 'C']);
const SNAPSHOT_TERMINAL_STATES = new Set(['S', 'F', 'C']);
const SNAPSHOT_RESULT_CODE_MAX_LENGTH = 32;
const SNAPSHOT_RECIPIENT_NO_MAX_LENGTH = 64;

export function createInitialResultSnapshot(recipientCount) {
  const length = normalizeSnapshotLength(recipientCount);

  return {
    states: Array.from({ length }, () => SNAPSHOT_PENDING_STATE),
    resultCodes: Array.from({ length }, () => null),
  };
}

export function countResultSnapshotStates(snapshot, recipientCount) {
  if (!hasSnapshotShape(snapshot)) return null;

  const normalized = normalizeResultSnapshot(snapshot, recipientCount);
  return countSnapshotStates(normalized.states);
}

export function getLedgerRequestResultCounts(request) {
  const snapshotCounts = countResultSnapshotStates(request?.resultSnapshotJson, request?.recipientCount);

  if (snapshotCounts) return snapshotCounts;

  return {
    canceledCount: normalizeNonNegativeInteger(request?.canceledCount),
    failedCount: normalizeNonNegativeInteger(request?.failedCount),
    pendingCount: normalizeNonNegativeInteger(request?.pendingCount),
    successCount: normalizeNonNegativeInteger(request?.successCount),
  };
}

export function listFailedResultSnapshotEntries(snapshot, recipientCount) {
  if (!hasSnapshotShape(snapshot)) return [];

  const normalized = normalizeResultSnapshot(snapshot, recipientCount);

  return normalized.states.flatMap((state, index) => {
    if (state !== 'F') return [];

    return [{
      recipientSeq: index + 1,
      recipientNo: normalized.failedRecipientNos?.[String(index + 1)] ?? null,
      resultCode: normalized.resultCodes[index],
    }];
  });
}

export function mergeResultSnapshotEntries({
  authoritative = false,
  entries = [],
  recipientCount,
  snapshot,
}) {
  const initialized = !hasSnapshotShape(snapshot);
  const normalizedSnapshot = normalizeResultSnapshot(snapshot ?? createInitialResultSnapshot(recipientCount), recipientCount);
  const nextSnapshot = {
    states: [...normalizedSnapshot.states],
    resultCodes: [...normalizedSnapshot.resultCodes],
  };
  const failedRecipientNos = { ...(normalizedSnapshot.failedRecipientNos ?? {}) };
  let changedCount = 0;
  let firstTerminalChanged = false;

  for (const entry of entries) {
    const index = normalizeRecipientSnapshotIndex(entry, recipientCount);
    const nextState = parseSnapshotState(entry?.state);

    if (index === null || !nextState) continue;

    const currentState = nextSnapshot.states[index];
    const currentTerminal = SNAPSHOT_TERMINAL_STATES.has(currentState);
    const nextTerminal = SNAPSHOT_TERMINAL_STATES.has(nextState);
    const recipientNoKey = String(index + 1);
    const nextRecipientNo = normalizeFailedRecipientNo(entry?.recipientNo);

    if (!authoritative && currentTerminal) {
      if (
        currentState === 'F'
        && nextState === 'F'
        && nextRecipientNo
        && failedRecipientNos[recipientNoKey] !== nextRecipientNo
      ) {
        failedRecipientNos[recipientNoKey] = nextRecipientNo;
        changedCount += 1;
      }
      continue;
    }

    const nextResultCode = normalizeResultCode(entry?.resultCode);
    const currentResultCode = nextSnapshot.resultCodes[index];
    const stateOrCodeChanged = currentState !== nextState || currentResultCode !== nextResultCode;

    if (!stateOrCodeChanged) {
      if (
        nextState === 'F'
        && nextRecipientNo
        && failedRecipientNos[recipientNoKey] !== nextRecipientNo
      ) {
        failedRecipientNos[recipientNoKey] = nextRecipientNo;
        changedCount += 1;
      }
      continue;
    }

    nextSnapshot.states[index] = nextState;
    nextSnapshot.resultCodes[index] = nextResultCode;
    changedCount += 1;

    if (!currentTerminal && nextTerminal) {
      firstTerminalChanged = true;
    }

    if (nextState === 'F') {
      if (nextRecipientNo) {
        failedRecipientNos[recipientNoKey] = nextRecipientNo;
      }
    } else {
      delete failedRecipientNos[recipientNoKey];
    }
  }

  return {
    changedCount,
    counts: countSnapshotStates(nextSnapshot.states),
    firstTerminalChanged,
    initialized,
    snapshot: toResultSnapshot(nextSnapshot.states, nextSnapshot.resultCodes, failedRecipientNos),
  };
}

export function createMessageLogRepository(db) {
  return {
    async getUserById(userId) {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      return user ?? null;
    },

    async listUserSenderResources(userId) {
      return db
        .select({
          link: userSenderResources,
          resource: senderResources,
        })
        .from(userSenderResources)
        .innerJoin(senderResources, eq(userSenderResources.senderResourceId, senderResources.id))
        .where(eq(userSenderResources.userId, userId));
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

export function createMessageSendLedgerRepository(db) {
  return {
    async createGroup(values, { now = new Date() } = {}) {
      const [group] = await db
        .insert(messageSendGroups)
        .values(toLedgerGroupInsert(values, now))
        .returning();

      return group;
    },

    async createProviderRequest(values, { now = new Date() } = {}) {
      const [request] = await db
        .insert(messageSendProviderRequests)
        .values(toLedgerProviderRequestInsert(values, now))
        .returning();

      return request;
    },

    async createGroupWithProviderRequests({ group, providerRequests = [], now = new Date() }) {
      return db.transaction(async (tx) => {
        const [createdGroup] = await tx
          .insert(messageSendGroups)
          .values(toLedgerGroupInsert({
            providerRequestCount: providerRequests.length,
            ...group,
          }, now))
          .returning();

        const createdProviderRequests = providerRequests.length
          ? await tx
              .insert(messageSendProviderRequests)
              .values(
                providerRequests.map((request) => toLedgerProviderRequestInsert({
                  ...request,
                  groupId: createdGroup.id,
                }, now))
              )
              .returning()
          : [];

        return {
          group: createdGroup,
          providerRequests: createdProviderRequests,
        };
      });
    },

    async prepareGroupWithProviderRequestsAndQuota({
      group,
      providerRequests = [],
      quotaReservations = [],
      now = new Date(),
    }) {
      const clientRequestIds = providerRequests.map((request) => request.clientRequestId).filter(Boolean);
      const existing = clientRequestIds.length === 1
        ? await findLedgerRequestByClientRequestId(db, clientRequestIds[0])
        : null;

      if (existing) return { ...existing, deduplicated: true, quotaReservations: [] };

      try {
        return await db.transaction(async (tx) => {
          const [createdGroup] = await tx
            .insert(messageSendGroups)
            .values(toLedgerGroupInsert({
              providerRequestCount: providerRequests.length,
              ...group,
            }, now))
            .returning();
          const createdProviderRequests = await tx
            .insert(messageSendProviderRequests)
            .values(
              providerRequests.map((request) => toLedgerProviderRequestInsert({
                ...request,
                groupId: createdGroup.id,
              }, now))
            )
            .returning();
          const createdQuotaReservations = await reserveSenderResourceQuotasTx(tx, {
            now,
            providerRequests: createdProviderRequests,
            reservations: quotaReservations,
          });

          return {
            deduplicated: false,
            group: createdGroup,
            providerRequests: createdProviderRequests,
            quotaReservations: createdQuotaReservations,
          };
        });
      } catch (error) {
        if (clientRequestIds.length === 1 && isUniqueViolation(error)) {
          const duplicate = await findLedgerRequestByClientRequestId(db, clientRequestIds[0]);
          if (duplicate) return { ...duplicate, deduplicated: true, quotaReservations: [] };
        }
        throw error;
      }
    },

    async updatePreparedProviderRequestOutcome({
      clientRequestId,
      now = new Date(),
      providerRequestId = null,
      providerState,
      recipientResults = [],
    }) {
      return db.transaction(async (tx) => {
        const [request] = await tx
          .select()
          .from(messageSendProviderRequests)
          .where(eq(messageSendProviderRequests.clientRequestId, clientRequestId))
          .limit(1)
          .for('update');

        if (!request) return null;

        const accepted = providerState === 'accepted' && Boolean(providerRequestId);
        const canceled = providerState === 'canceled';
        const rejected = providerState === 'rejected' || providerState === 'failed';
        const terminalWithoutSend = rejected || canceled;
        const effectiveProviderState = accepted
          ? 'accepted'
          : terminalWithoutSend
            ? providerState
            : 'unknown';
        const initialResultMerge = accepted
          ? mergeResultSnapshotEntries({
              entries: recipientResults,
              recipientCount: request.recipientCount,
              snapshot: request.resultSnapshotJson,
            })
          : null;
        const snapshot = terminalWithoutSend
          ? createTerminalResultSnapshot(
              request.recipientCount,
              canceled ? 'C' : 'F',
              canceled ? 'LOCAL_CANCELED' : 'PROVIDER_REJECTED'
            )
          : initialResultMerge?.snapshot
            ?? request.resultSnapshotJson
            ?? createInitialResultSnapshot(request.recipientCount);
        const counts = countResultSnapshotStates(snapshot, request.recipientCount);
        const resultFinalizedAt = terminalWithoutSend || counts.pendingCount === 0
          ? (request.resultFinalizedAt ?? now)
          : null;
        const [updatedRequest] = await tx
          .update(messageSendProviderRequests)
          .set({
            ...counts,
            firstResultReceivedAt: request.firstResultReceivedAt
              ?? (initialResultMerge?.firstTerminalChanged ? now : null),
            providerRequestId: accepted ? providerRequestId : null,
            providerState: effectiveProviderState,
            resultFinalizedAt,
            resultSnapshotJson: snapshot,
            resultSnapshotVersion: terminalWithoutSend
              ? Number(request.resultSnapshotVersion ?? 0) + 1
              : Number(request.resultSnapshotVersion ?? 0) + (initialResultMerge?.changedCount ?? 0),
            resultState: terminalWithoutSend
              ? 'synced'
              : effectiveProviderState === 'unknown'
                ? 'stale'
                : getSnapshotResultState(counts, { finalized: Boolean(resultFinalizedAt) }),
            resultSyncedAt: initialResultMerge?.changedCount ? now : request.resultSyncedAt,
            updatedAt: now,
          })
          .where(eq(messageSendProviderRequests.id, request.id))
          .returning();

        if (terminalWithoutSend) {
          await releaseProviderRequestQuotaReservationsTx(tx, {
            now,
            providerRequestId: request.id,
          });
        } else if (accepted && initialResultMerge?.changedCount) {
          await settlePrimaryQuotaForProviderRequestTx(tx, {
            now,
            providerRequestId: request.id,
            resultCounts: counts,
          });
          await releaseFallbackQuotaForPrimaryRejectionsTx(tx, {
            now,
            providerRequestId: request.id,
            recipientCount: request.recipientCount,
            recipientSequences: recipientResults.map((entry) => entry.recipientSeq),
          });
        }

        const updatedGroup = await rollupLedgerGroupFromRequestsTx(tx, request.groupId, now);

        return { group: updatedGroup, providerRequest: updatedRequest ?? request };
      });
    },

    async listGroupsForActor({
      actorUserId,
      channel,
      channels,
      createdFrom,
      createdTo,
      includeArchived = false,
      limit = 20,
      offset = 0,
      senderResourceIds,
      sentAtFrom,
      sentAtTo,
      sentAtUntil,
    }) {
      const predicates = buildLedgerGroupPredicates({
        actorUserId,
        channel,
        channels,
        createdFrom,
        createdTo,
        includeArchived,
        senderResourceIds,
        sentAtFrom,
        sentAtTo,
        sentAtUntil,
      });

      return db
        .select()
        .from(messageSendGroups)
        .where(and(...predicates))
        .orderBy(desc(sql`coalesce(${messageSendGroups.scheduledAt}, ${messageSendGroups.createdAt})`), asc(messageSendGroups.id))
        .limit(limit)
        .offset(offset);
    },

    async countGroupsForActor({
      actorUserId,
      channel,
      channels,
      createdFrom,
      createdTo,
      includeArchived = false,
      senderResourceIds,
      sentAtFrom,
      sentAtTo,
      sentAtUntil,
    }) {
      const predicates = buildLedgerGroupPredicates({
        actorUserId,
        channel,
        channels,
        createdFrom,
        createdTo,
        includeArchived,
        senderResourceIds,
        sentAtFrom,
        sentAtTo,
        sentAtUntil,
      });
      const [row] = await db
        .select({ count: sql`count(*)` })
        .from(messageSendGroups)
        .where(and(...predicates));

      return Number(row?.count ?? 0);
    },

    async getGroupForActor({ actorUserId, groupId, includeArchived = false }) {
      const predicates = [
        eq(messageSendGroups.id, groupId),
        eq(messageSendGroups.userId, actorUserId),
      ];

      if (!includeArchived) {
        predicates.push(isNull(messageSendGroups.archivedAt));
      }

      const [group] = await db
        .select()
        .from(messageSendGroups)
        .where(and(...predicates))
        .limit(1);

      return group ?? null;
    },

    async getGroupById({ groupId, includeArchived = false }) {
      const predicates = [eq(messageSendGroups.id, groupId)];

      if (!includeArchived) {
        predicates.push(isNull(messageSendGroups.archivedAt));
      }

      const [group] = await db
        .select()
        .from(messageSendGroups)
        .where(and(...predicates))
        .limit(1);

      return group ?? null;
    },

    async listProviderRequestsForGroup(groupId) {
      return db
        .select()
        .from(messageSendProviderRequests)
        .where(eq(messageSendProviderRequests.groupId, groupId))
        .orderBy(asc(messageSendProviderRequests.sequence));
    },

    async initializeProviderRequestSnapshot({ requestId, now = new Date() }) {
      return db.transaction(async (tx) => {
        const [request] = await tx
          .select()
          .from(messageSendProviderRequests)
          .where(eq(messageSendProviderRequests.id, requestId))
          .limit(1)
          .for('update');

        if (!request) return null;

        const snapshot = createInitialResultSnapshot(request.recipientCount);
        const counts = countSnapshotStates(snapshot.states);
        const [updatedRequest] = await tx
          .update(messageSendProviderRequests)
          .set({
            ...counts,
            firstResultReceivedAt: null,
            resultSnapshotJson: snapshot,
            resultSnapshotVersion: 0,
            resultState: getSnapshotResultState(counts),
            updatedAt: now,
          })
          .where(eq(messageSendProviderRequests.id, request.id))
          .returning();

        await rollupLedgerGroupFromRequestsTx(tx, request.groupId, now);

        return updatedRequest ?? null;
      });
    },

    async getProviderRequestForActor({ actorUserId, requestId, includeArchived = false }) {
      const predicates = [
        eq(messageSendProviderRequests.id, requestId),
        eq(messageSendGroups.userId, actorUserId),
      ];

      if (!includeArchived) {
        predicates.push(isNull(messageSendGroups.archivedAt));
      }

      const [row] = await db
        .select({
          group: messageSendGroups,
          providerRequest: messageSendProviderRequests,
        })
        .from(messageSendProviderRequests)
        .innerJoin(messageSendGroups, eq(messageSendProviderRequests.groupId, messageSendGroups.id))
        .where(and(...predicates))
        .limit(1);

      return row ?? null;
    },

    async listProviderRequestsByProviderRequestId({ providerRequestId, channel, includeArchived = false }) {
      if (typeof providerRequestId !== 'string' || !providerRequestId.trim()) return [];

      const predicates = [
        eq(messageSendProviderRequests.providerRequestId, providerRequestId.trim()),
      ];

      if (channel) {
        predicates.push(eq(messageSendGroups.channel, channel));
      }

      if (!includeArchived) {
        predicates.push(isNull(messageSendGroups.archivedAt));
      }

      return db
        .select({
          group: messageSendGroups,
          providerRequest: messageSendProviderRequests,
        })
        .from(messageSendProviderRequests)
        .innerJoin(messageSendGroups, eq(messageSendProviderRequests.groupId, messageSendGroups.id))
        .where(and(...predicates))
        .orderBy(desc(messageSendProviderRequests.createdAt), asc(messageSendProviderRequests.id));
    },

    async getProviderRequestForActorByProviderRequestId({
      actorUserId,
      channel,
      providerRequestId,
      includeArchived = false,
    }) {
      const predicates = [
        eq(messageSendGroups.userId, actorUserId),
        eq(messageSendProviderRequests.providerRequestId, providerRequestId),
      ];

      if (channel) {
        predicates.push(eq(messageSendGroups.channel, channel));
      }

      if (!includeArchived) {
        predicates.push(isNull(messageSendGroups.archivedAt));
      }

      const [row] = await db
        .select({
          group: messageSendGroups,
          providerRequest: messageSendProviderRequests,
        })
        .from(messageSendProviderRequests)
        .innerJoin(messageSendGroups, eq(messageSendProviderRequests.groupId, messageSendGroups.id))
        .where(and(...predicates))
        .orderBy(desc(messageSendProviderRequests.createdAt), asc(messageSendProviderRequests.id))
        .limit(1);

      return row ?? null;
    },

    async getProviderRequestByClientRequestId(clientRequestId) {
      const [row] = await db
        .select({
          group: messageSendGroups,
          providerRequest: messageSendProviderRequests,
        })
        .from(messageSendProviderRequests)
        .innerJoin(messageSendGroups, eq(messageSendProviderRequests.groupId, messageSendGroups.id))
        .where(eq(messageSendProviderRequests.clientRequestId, clientRequestId))
        .limit(1);

      return row ?? null;
    },

    async updateGroup({ groupId, values, now = new Date() }) {
      const [group] = await db
        .update(messageSendGroups)
        .set(toLedgerGroupUpdate(values, now))
        .where(eq(messageSendGroups.id, groupId))
        .returning();

      return group ?? null;
    },

    async updateProviderRequest({ requestId, values, now = new Date() }) {
      const [request] = await db
        .update(messageSendProviderRequests)
        .set({
          ...values,
          updatedAt: now,
        })
        .where(eq(messageSendProviderRequests.id, requestId))
        .returning();

      return request ?? null;
    },

    async updateProviderRequestByClientRequestId({ clientRequestId, values, now = new Date() }) {
      const [request] = await db
        .update(messageSendProviderRequests)
        .set({
          ...values,
          updatedAt: now,
        })
        .where(eq(messageSendProviderRequests.clientRequestId, clientRequestId))
        .returning();

      return request ?? null;
    },

    async mergeProviderRequestResultSnapshot({
      authoritative = false,
      entries = [],
      fallbackResults = [],
      finalize = false,
      finalizeFallback = false,
      now = new Date(),
      requestId,
      clearSyncLease = false,
      nextSyncAtWhenPending,
      updateNextSyncAt = false,
    }) {
      return db.transaction(async (tx) => {
        const [request] = await tx
          .select()
          .from(messageSendProviderRequests)
          .where(eq(messageSendProviderRequests.id, requestId))
          .limit(1)
          .for('update');

        if (!request) return null;

        return mergeProviderRequestSnapshotRowTx(tx, {
          authoritative,
          clearSyncLease,
          entries,
          fallbackResults,
          finalize,
          finalizeFallback,
          nextSyncAtWhenPending,
          now,
          request,
          updateNextSyncAt,
        });
      });
    },

    async mergeProviderRequestResultSnapshotByProviderRequestId({
      authoritative = false,
      channel,
      clearSyncLease = false,
      fallbackResults = [],
      finalize = false,
      finalizeFallback = false,
      includeArchived = false,
      nextSyncAtWhenPending,
      now = new Date(),
      providerRequestId,
      results = [],
      updateNextSyncAt = false,
    }) {
      if (typeof providerRequestId !== 'string' || !providerRequestId.trim()) return null;

      return db.transaction(async (tx) => {
        const predicates = [
          eq(messageSendProviderRequests.providerRequestId, providerRequestId.trim()),
        ];

        if (channel) {
          predicates.push(eq(messageSendGroups.channel, channel));
        }

        if (!includeArchived) {
          predicates.push(isNull(messageSendGroups.archivedAt));
        }

        const [row] = await tx
          .select({
            group: messageSendGroups,
            providerRequest: messageSendProviderRequests,
          })
          .from(messageSendProviderRequests)
          .innerJoin(messageSendGroups, eq(messageSendProviderRequests.groupId, messageSendGroups.id))
          .where(and(...predicates))
          .orderBy(desc(messageSendProviderRequests.createdAt), asc(messageSendProviderRequests.id))
          .limit(1)
          .for('update');

        if (!row) return null;

        return mergeProviderRequestSnapshotRowTx(tx, {
          authoritative,
          clearSyncLease,
          entries: results,
          fallbackResults,
          finalize,
          finalizeFallback,
          nextSyncAtWhenPending,
          now,
          request: row.providerRequest,
          updateNextSyncAt,
        });
      });
    },

    async listUnfinalizedBulkGroups({ limit = 100 } = {}) {
      return db
        .select()
        .from(messageSendGroups)
        .where(
          and(
            eq(messageSendGroups.sendKind, 'bulk'),
            inArray(messageSendGroups.channel, ['sms', 'lms', 'mms']),
            inArray(messageSendGroups.providerState, ['accepted', 'partial']),
            inArray(messageSendGroups.resultState, ['not_synced', 'partially_synced', 'stale', 'error']),
            isNull(messageSendGroups.archivedAt),
            isNull(messageSendGroups.resultFinalizedAt)
          )
        )
        .orderBy(asc(messageSendGroups.createdAt), asc(messageSendGroups.id))
        .limit(limit);
    },

    async archiveExpiredGroups({
      now = new Date(),
      limit = 100,
      archiveReason = 'expired',
      purgeAfter = addDays(now, 30),
    } = {}) {
      const candidates = await db
        .select({ id: messageSendGroups.id })
        .from(messageSendGroups)
        .where(and(isNull(messageSendGroups.archivedAt), lte(messageSendGroups.expiresAt, now)))
        .orderBy(asc(messageSendGroups.expiresAt), asc(messageSendGroups.id))
        .limit(limit);

      if (!candidates.length) return [];

      return db
        .update(messageSendGroups)
        .set({
          archivedAt: now,
          archiveReason,
          purgeAfter,
          updatedAt: now,
        })
        .where(inArray(messageSendGroups.id, candidates.map((candidate) => candidate.id)))
        .returning();
    },

    async purgeArchivedGroups({ now = new Date(), limit = 100 } = {}) {
      const candidates = await db
        .select({ id: messageSendGroups.id })
        .from(messageSendGroups)
        .where(and(isNotNull(messageSendGroups.archivedAt), lte(messageSendGroups.purgeAfter, now)))
        .orderBy(asc(messageSendGroups.purgeAfter), asc(messageSendGroups.id))
        .limit(limit);

      if (!candidates.length) return [];

      return db
        .delete(messageSendGroups)
        .where(inArray(messageSendGroups.id, candidates.map((candidate) => candidate.id)))
        .returning();
    },

    async leaseSyncableProviderRequests({
      workerId,
      leaseExpiresAt,
      now = new Date(),
      limit = 10,
      sendKinds = ['bulk'],
      channels = ['sms', 'lms', 'mms'],
      resultStates = DEFAULT_SYNCABLE_RESULT_STATES,
    }) {
      return db.transaction(async (tx) => {
        const candidates = await tx
          .select({ id: messageSendProviderRequests.id })
          .from(messageSendProviderRequests)
          .innerJoin(messageSendGroups, eq(messageSendProviderRequests.groupId, messageSendGroups.id))
          .where(
            and(
              inArray(messageSendGroups.sendKind, sendKinds),
              inArray(messageSendGroups.channel, channels),
              isNull(messageSendGroups.archivedAt),
              isNull(messageSendGroups.resultFinalizedAt),
              inArray(messageSendGroups.providerState, ['accepted', 'partial']),
              inArray(messageSendProviderRequests.resultState, resultStates),
              isNull(messageSendProviderRequests.resultFinalizedAt),
              isNotNull(messageSendProviderRequests.providerRequestId),
              eq(messageSendProviderRequests.providerState, 'accepted'),
              lte(messageSendProviderRequests.nextSyncAt, now),
              or(
                isNull(messageSendProviderRequests.syncLeaseExpiresAt),
                lte(messageSendProviderRequests.syncLeaseExpiresAt, now)
              )
            )
          )
          .orderBy(asc(messageSendProviderRequests.nextSyncAt), asc(messageSendProviderRequests.id))
          .limit(limit)
          .for('update', { skipLocked: true });

        if (!candidates.length) return [];

        return tx
          .update(messageSendProviderRequests)
          .set({
            resultState: 'syncing',
            syncLockedBy: workerId,
            syncLeaseExpiresAt: leaseExpiresAt,
            syncAttempts: sql`${messageSendProviderRequests.syncAttempts} + 1`,
            updatedAt: now,
          })
          .where(inArray(messageSendProviderRequests.id, candidates.map((candidate) => candidate.id)))
          .returning();
      });
    },

    async leaseMessageResultCorrectionRequests({
      workerId,
      leaseExpiresAt,
      now = new Date(),
      limit = 10,
      firstCorrectionDueBefore,
      finalCorrectionDueBefore,
    }) {
      return db.transaction(async (tx) => {
        const effectiveAt = sql`coalesce(${messageSendGroups.scheduledAt}, ${messageSendProviderRequests.createdAt}, ${messageSendGroups.createdAt})`;
        const firstCorrectionCutoff = timestampSql(firstCorrectionDueBefore);
        const finalCorrectionCutoff = timestampSql(finalCorrectionDueBefore);
        const nowCutoff = timestampSql(now);
        const primaryOpen = and(
          isNull(messageSendProviderRequests.resultFinalizedAt),
          gt(messageSendProviderRequests.pendingCount, 0)
        );
        const fallbackOpen = and(
          isNotNull(senderResourceQuotaReservations.id),
          isNotNull(senderResourceQuotaReservations.fallbackOpenedAt),
          isNull(senderResourceQuotaReservations.resultFinalizedAt),
          sql`${senderResourceQuotaReservations.reservedCount} - ${senderResourceQuotaReservations.consumedCount} - ${senderResourceQuotaReservations.releasedCount} > 0`
        );
        const primaryDue = and(
          primaryOpen,
          or(
            and(
              eq(messageSendProviderRequests.syncAttempts, 0),
              lte(effectiveAt, firstCorrectionCutoff)
            ),
            lte(effectiveAt, finalCorrectionCutoff)
          ),
          lte(effectiveAt, nowCutoff)
        );
        const fallbackDue = and(
          fallbackOpen,
          or(
            and(
              isNull(senderResourceQuotaReservations.resultSyncedAt),
              lte(senderResourceQuotaReservations.fallbackOpenedAt, firstCorrectionCutoff)
            ),
            lte(senderResourceQuotaReservations.fallbackOpenedAt, finalCorrectionCutoff)
          ),
          lte(senderResourceQuotaReservations.fallbackOpenedAt, nowCutoff)
        );
        const candidates = await tx
          .select({
            fallbackReservation: senderResourceQuotaReservations,
            group: messageSendGroups,
            providerRequest: messageSendProviderRequests,
          })
          .from(messageSendProviderRequests)
          .innerJoin(messageSendGroups, eq(messageSendProviderRequests.groupId, messageSendGroups.id))
          .leftJoin(
            senderResourceQuotaReservations,
            and(
              eq(senderResourceQuotaReservations.providerRequestId, messageSendProviderRequests.id),
              eq(senderResourceQuotaReservations.kind, 'fallback')
            )
          )
          .where(
            and(
              inArray(messageSendGroups.channel, ['sms', 'lms', 'mms', 'alimtalk', 'brand-message']),
              isNull(messageSendGroups.archivedAt),
              inArray(messageSendGroups.providerState, ['accepted', 'partial']),
              eq(messageSendProviderRequests.providerState, 'accepted'),
              isNotNull(messageSendProviderRequests.providerRequestId),
              isNotNull(messageSendProviderRequests.resultSnapshotJson),
              or(primaryDue, fallbackDue),
              or(
                isNull(messageSendProviderRequests.syncLeaseExpiresAt),
                lte(messageSendProviderRequests.syncLeaseExpiresAt, now)
              )
            )
          )
          .orderBy(
            asc(sql`coalesce(${senderResourceQuotaReservations.fallbackOpenedAt}, ${effectiveAt})`),
            asc(messageSendProviderRequests.id)
          )
          .limit(limit)
          .for('update', { skipLocked: true });

        if (!candidates.length) return [];

        const requestIds = candidates.map((candidate) => candidate.providerRequest.id);
        const updatedRequests = await tx
          .update(messageSendProviderRequests)
          .set({
            resultState: 'syncing',
            syncAttempts: sql`${messageSendProviderRequests.syncAttempts} + 1`,
            syncLeaseExpiresAt: leaseExpiresAt,
            syncLockedBy: workerId,
            updatedAt: now,
          })
          .where(inArray(messageSendProviderRequests.id, requestIds))
          .returning();
        const updatedById = new Map(updatedRequests.map((request) => [request.id, request]));

        return candidates.map((candidate) => ({
          fallbackReservation: candidate.fallbackReservation,
          group: candidate.group,
          providerRequest: updatedById.get(candidate.providerRequest.id) ?? candidate.providerRequest,
        }));
      });
    },
  };
}

function buildLedgerGroupPredicates({
  actorUserId,
  channel,
  channels,
  createdFrom,
  createdTo,
  includeArchived,
  senderResourceIds,
  sentAtFrom,
  sentAtTo,
  sentAtUntil,
}) {
  const predicates = [eq(messageSendGroups.userId, actorUserId)];
  const normalizedChannels = normalizeStringArray(channels ?? (channel ? [channel] : []));
  const normalizedSenderResourceIds = normalizeStringArray(senderResourceIds);

  if (normalizedChannels.length === 1) {
    predicates.push(eq(messageSendGroups.channel, normalizedChannels[0]));
  } else if (normalizedChannels.length > 1) {
    predicates.push(inArray(messageSendGroups.channel, normalizedChannels));
  }

  if (normalizedSenderResourceIds.length === 1) {
    predicates.push(eq(messageSendGroups.senderResourceId, normalizedSenderResourceIds[0]));
  } else if (normalizedSenderResourceIds.length > 1) {
    predicates.push(inArray(messageSendGroups.senderResourceId, normalizedSenderResourceIds));
  }

  if (createdFrom) {
    predicates.push(gte(messageSendGroups.createdAt, createdFrom));
  }

  if (createdTo) {
    predicates.push(lte(messageSendGroups.createdAt, createdTo));
  }

  if (sentAtFrom) {
    predicates.push(buildSentAtPredicate(gte, sentAtFrom));
  }

  if (sentAtTo) {
    predicates.push(buildSentAtPredicate(lte, sentAtTo));
  }

  if (sentAtUntil) {
    predicates.push(buildSentAtPredicate(lte, sentAtUntil));
  }

  if (!includeArchived) {
    predicates.push(isNull(messageSendGroups.archivedAt));
  }

  return predicates;
}

function buildSentAtPredicate(compare, value) {
  return or(
    and(eq(messageSendGroups.sendTiming, 'scheduled'), isNotNull(messageSendGroups.scheduledAt), compare(messageSendGroups.scheduledAt, value)),
    and(eq(messageSendGroups.sendTiming, 'immediate'), compare(messageSendGroups.createdAt, value))
  );
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];

  return values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim());
}

export function buildGeneratedManagementTitle({ channel, sendKind } = {}) {
  const channelTitle = DEFAULT_LEDGER_TITLE_BY_CHANNEL[channel] ?? 'Message send';
  return sendKind === 'bulk' ? `${channelTitle} batch` : channelTitle;
}

export function sanitizeManagementTitle(value, fallback = 'Message send') {
  const source = typeof value === 'string' && value.trim() ? value : fallback;
  const normalized = source
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const bounded = normalized.slice(0, LEDGER_MANAGEMENT_TITLE_MAX_LENGTH).trim();

  return bounded || fallback;
}

function toLedgerGroupInsert(values, now) {
  const managementTitle = sanitizeManagementTitle(
    values.managementTitle,
    buildGeneratedManagementTitle({
      channel: values.channel,
      sendKind: values.sendKind,
    })
  );
  const sourceFields = toLedgerGroupSourceFields(values);

  return {
    acceptedRequestCount: values.acceptedRequestCount ?? 0,
    archiveReason: values.archiveReason,
    archivedAt: values.archivedAt,
    billingAccountId: values.billingAccountId,
    canceledCount: values.canceledCount ?? 0,
    channel: values.channel,
    createdAt: values.createdAt ?? now,
    expiresAt: values.expiresAt,
    failedCount: values.failedCount ?? 0,
    managementTitle,
    pendingCount: values.pendingCount ?? 0,
    providerRequestCount: values.providerRequestCount ?? 0,
    providerState: values.providerState ?? 'queued',
    purgeAfter: values.purgeAfter,
    resultFinalizedAt: values.resultFinalizedAt,
    resultState: values.resultState ?? 'not_synced',
    resultSyncedAt: values.resultSyncedAt,
    scheduledAt: values.scheduledAt,
    sendKind: values.sendKind ?? 'basic',
    sendTiming: values.sendTiming ?? 'immediate',
    senderResourceId: values.senderResourceId,
    ...sourceFields,
    successCount: values.successCount ?? 0,
    totalRecipientCount: values.totalRecipientCount,
    updatedAt: values.updatedAt ?? now,
    userId: values.userId,
  };
}

function toLedgerGroupUpdate(values, now) {
  const updateValues = { ...values };

  delete updateValues.sourceMetadata;
  delete updateValues.sourceType;
  delete updateValues.sourceEventKey;
  delete updateValues.sourceExternalEventId;
  delete updateValues.sourceChannelCode;
  delete updateValues.sourceAutomationRuleId;
  delete updateValues.sourceAutomationDeliveryId;

  const nextValues = {
    ...updateValues,
    ...toLedgerGroupSourceFields(values),
    updatedAt: now,
  };

  if (Object.hasOwn(nextValues, 'managementTitle')) {
    nextValues.managementTitle = sanitizeManagementTitle(nextValues.managementTitle);
  }

  return nextValues;
}

function toLedgerGroupSourceFields(values = {}) {
  const source = isPlainObject(values.sourceMetadata) ? values.sourceMetadata : values;
  const sourceType = normalizeSourceType(source.sourceType);

  if (!sourceType) return {};

  return {
    sourceType,
    ...(sourceType === 'automation'
      ? {
          ...optionalBoundedSourceString('sourceEventKey', source.sourceEventKey, 160),
          ...optionalBoundedSourceString('sourceExternalEventId', source.sourceExternalEventId, 255),
          ...optionalBoundedSourceString('sourceChannelCode', source.sourceChannelCode, 160),
          ...optionalSourceString('sourceAutomationRuleId', source.sourceAutomationRuleId),
          ...optionalSourceString('sourceAutomationDeliveryId', source.sourceAutomationDeliveryId),
        }
      : {}),
  };
}

function normalizeSourceType(value) {
  const normalized = normalizeSourceString(value);

  if (normalized === 'manual' || normalized === 'automation') {
    return normalized;
  }

  return null;
}

function optionalBoundedSourceString(key, value, maxLength) {
  const normalized = normalizeSourceString(value);
  return normalized ? { [key]: normalized.slice(0, maxLength) } : {};
}

function optionalSourceString(key, value) {
  const normalized = normalizeSourceString(value);
  return normalized ? { [key]: normalized } : {};
}

function normalizeSourceString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toLedgerProviderRequestInsert(values, now) {
  const snapshot = values.resultSnapshotJson ?? (
    values.initializeResultSnapshot ? createInitialResultSnapshot(values.recipientCount) : undefined
  );
  const snapshotCounts = countResultSnapshotStates(snapshot, values.recipientCount);

  return {
    canceledCount: snapshotCounts?.canceledCount ?? values.canceledCount ?? 0,
    clientRequestId: values.clientRequestId,
    createdAt: values.createdAt ?? now,
    failedCount: snapshotCounts?.failedCount ?? values.failedCount ?? 0,
    firstResultReceivedAt: values.firstResultReceivedAt,
    groupId: values.groupId,
    nextSyncAt: values.nextSyncAt,
    pendingCount: snapshotCounts?.pendingCount ?? values.pendingCount ?? 0,
    providerRequestId: values.providerRequestId,
    providerState: values.providerState ?? 'queued',
    recipientCount: values.recipientCount,
    resultFinalizedAt: values.resultFinalizedAt,
    resultSnapshotJson: snapshot,
    resultSnapshotVersion: values.resultSnapshotVersion ?? 0,
    resultState: values.resultState ?? (snapshotCounts ? getSnapshotResultState(snapshotCounts) : 'not_synced'),
    resultSyncedAt: values.resultSyncedAt,
    sequence: values.sequence,
    successCount: snapshotCounts?.successCount ?? values.successCount ?? 0,
    syncAttempts: values.syncAttempts ?? 0,
    syncLeaseExpiresAt: values.syncLeaseExpiresAt,
    syncLockedBy: values.syncLockedBy,
    updatedAt: values.updatedAt ?? now,
  };
}

async function rollupLedgerGroupFromRequestsTx(tx, groupId, now) {
  const requests = await tx
    .select()
    .from(messageSendProviderRequests)
    .where(eq(messageSendProviderRequests.groupId, groupId))
    .orderBy(asc(messageSendProviderRequests.sequence));

  if (!requests.length) return null;

  const resultFinalizedAt = requests.every((request) => request.resultFinalizedAt)
    ? getLatestDate(requests.map((request) => request.resultFinalizedAt))
    : null;
  const [group] = await tx
    .update(messageSendGroups)
    .set({
      acceptedRequestCount: requests.filter((request) => request.providerState === 'accepted').length,
      canceledCount: sumRequestResultCount(requests, 'canceledCount'),
      failedCount: sumRequestResultCount(requests, 'failedCount'),
      pendingCount: sumRequestResultCount(requests, 'pendingCount'),
      providerRequestCount: requests.length,
      providerState: getLedgerGroupProviderState(requests),
      resultFinalizedAt,
      resultState: getLedgerGroupResultState(requests),
      resultSyncedAt: getLatestDate(requests.map((request) => request.resultSyncedAt)),
      successCount: sumRequestResultCount(requests, 'successCount'),
      updatedAt: now,
    })
    .where(eq(messageSendGroups.id, groupId))
    .returning();

  return group ?? null;
}

async function mergeProviderRequestSnapshotRowTx(tx, options) {
  const {
    authoritative,
    clearSyncLease,
    entries,
    fallbackResults,
    finalize,
    finalizeFallback,
    nextSyncAtWhenPending,
    now,
    request,
    updateNextSyncAt,
  } = options;
  const merge = mergeResultSnapshotEntries({
    authoritative,
    entries,
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

  if (!shouldUpdate) {
    return {
      changedCount: 0,
      groupId: request.groupId,
      group: null,
      providerRequest: request,
    };
  }

  const updateValues = {
    ...merge.counts,
    firstResultReceivedAt: request.firstResultReceivedAt ?? (merge.firstTerminalChanged ? now : null),
    resultFinalizedAt: shouldFinalize ? (request.resultFinalizedAt ?? now) : request.resultFinalizedAt,
    resultSnapshotJson: merge.snapshot,
    resultSnapshotVersion: Number(request.resultSnapshotVersion ?? 0) + (merge.changedCount > 0 ? 1 : 0),
    resultState: getSnapshotResultState(merge.counts, { finalized: shouldFinalize }),
    resultSyncedAt: now,
    updatedAt: now,
  };

  if (clearSyncLease) {
    updateValues.syncLeaseExpiresAt = null;
    updateValues.syncLockedBy = null;
  }

  if (updateNextSyncAt) {
    updateValues.nextSyncAt = shouldFinalize ? null : nextSyncAtWhenPending;
  }

  const [updatedRequest] = await tx
    .update(messageSendProviderRequests)
    .set(updateValues)
    .where(eq(messageSendProviderRequests.id, request.id))
    .returning();

  await settlePrimaryQuotaForProviderRequestTx(tx, {
    now,
    providerRequestId: request.id,
    resultCounts: merge.counts,
  });
  await syncFallbackQuotaFromPrimarySnapshotTx(tx, {
    now,
    primarySnapshot: merge.snapshot,
    providerRequestId: request.id,
    recipientCount: request.recipientCount,
  });
  await mergeFallbackQuotaResultsTx(tx, {
    entries: fallbackResults,
    finalize: finalizeFallback,
    now,
    providerRequestId: request.id,
    recipientCount: request.recipientCount,
  });

  const group = await rollupLedgerGroupFromRequestsTx(tx, request.groupId, now);

  return {
    changedCount: merge.changedCount,
    groupId: request.groupId,
    group,
    providerRequest: updatedRequest ?? null,
  };
}

async function findLedgerRequestByClientRequestId(db, clientRequestId) {
  const [row] = await db
    .select({
      group: messageSendGroups,
      providerRequest: messageSendProviderRequests,
    })
    .from(messageSendProviderRequests)
    .innerJoin(messageSendGroups, eq(messageSendProviderRequests.groupId, messageSendGroups.id))
    .where(eq(messageSendProviderRequests.clientRequestId, clientRequestId))
    .limit(1);

  return row
    ? { group: row.group, providerRequests: [row.providerRequest] }
    : null;
}

function createTerminalResultSnapshot(recipientCount, state, resultCode) {
  const length = normalizeSnapshotLength(recipientCount);

  return {
    states: Array.from({ length }, () => state),
    resultCodes: Array.from({ length }, () => resultCode),
  };
}

function isUniqueViolation(error) {
  return error?.code === '23505' || error?.cause?.code === '23505';
}

function normalizeSnapshotLength(value) {
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 ? count : 0;
}

function hasSnapshotShape(snapshot) {
  return Boolean(
    snapshot
      && typeof snapshot === 'object'
      && Array.isArray(snapshot.states)
      && Array.isArray(snapshot.resultCodes)
  );
}

function normalizeResultSnapshot(snapshot, recipientCount) {
  const length = normalizeSnapshotLength(recipientCount);
  const states = Array.from({ length }, (_, index) => (
    parseSnapshotState(snapshot?.states?.[index]) ?? SNAPSHOT_PENDING_STATE
  ));
  const resultCodes = Array.from({ length }, (_, index) => normalizeResultCode(snapshot?.resultCodes?.[index]));

  return toResultSnapshot(
    states,
    resultCodes,
    normalizeFailedRecipientNos(snapshot?.failedRecipientNos, states, recipientCount)
  );
}

function toResultSnapshot(states, resultCodes, failedRecipientNos = {}) {
  if (!Object.keys(failedRecipientNos).length) {
    return { states, resultCodes };
  }

  return { states, resultCodes, failedRecipientNos };
}

function normalizeFailedRecipientNos(value, states, recipientCount) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const length = normalizeSnapshotLength(recipientCount);
  const normalized = {};

  for (const [key, rawRecipientNo] of Object.entries(value)) {
    const recipientSeq = Number(key);
    if (!Number.isInteger(recipientSeq) || recipientSeq < 1 || recipientSeq > length) continue;
    if (states[recipientSeq - 1] !== 'F') continue;

    const recipientNo = normalizeFailedRecipientNo(rawRecipientNo);
    if (!recipientNo) continue;

    normalized[String(recipientSeq)] = recipientNo;
  }

  return normalized;
}

function parseSnapshotState(value) {
  return typeof value === 'string' && SNAPSHOT_STATE_VALUES.has(value) ? value : null;
}

function normalizeResultCode(value) {
  if (value === null || value === undefined) return null;

  const normalized = String(value)
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, SNAPSHOT_RESULT_CODE_MAX_LENGTH);

  return normalized || null;
}

function normalizeFailedRecipientNo(value) {
  if (value === null || value === undefined) return null;

  const normalized = String(value)
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, SNAPSHOT_RECIPIENT_NO_MAX_LENGTH);

  return normalized || null;
}

function normalizeRecipientSnapshotIndex(entry, recipientCount) {
  const sequence = Number(entry?.recipientSeq);
  const length = normalizeSnapshotLength(recipientCount);

  if (!Number.isInteger(sequence) || sequence < 1 || sequence > length) return null;

  const index = sequence - 1;
  const recipientGroupingKey = entry?.recipientGroupingKey;

  if (recipientGroupingKey) {
    const parsedGrouping = parseRecipientGroupingKey(recipientGroupingKey);
    if (!parsedGrouping || parsedGrouping.recipientIndex !== index) return null;
  }

  return index;
}

function countSnapshotStates(states) {
  return states.reduce((counts, state) => {
    if (state === 'S') counts.successCount += 1;
    else if (state === 'F') counts.failedCount += 1;
    else if (state === 'C') counts.canceledCount += 1;
    else counts.pendingCount += 1;

    return counts;
  }, {
    canceledCount: 0,
    failedCount: 0,
    pendingCount: 0,
    successCount: 0,
  });
}

function normalizeNonNegativeInteger(value) {
  const count = Number(value ?? 0);
  return Number.isInteger(count) && count >= 0 ? count : 0;
}

function getSnapshotResultState(counts, { finalized = false } = {}) {
  const totalCount = counts.successCount + counts.failedCount + counts.pendingCount + counts.canceledCount;

  if (finalized && counts.pendingCount > 0) return 'stale';
  if (totalCount === 0 || counts.pendingCount === totalCount) return 'not_synced';
  if (counts.pendingCount > 0) return 'partially_synced';
  return 'synced';
}

function getLedgerGroupProviderState(requests) {
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

function getLedgerGroupResultState(requests) {
  if (requests.every((request) => request.resultState === 'synced')) return 'synced';
  if (requests.some((request) => request.resultState === 'syncing')) return 'syncing';
  if (requests.some((request) => request.resultState === 'stale')) return 'stale';
  if (requests.some((request) => request.resultState === 'partially_synced')) return 'partially_synced';
  if (requests.some((request) => request.resultState === 'synced')) return 'partially_synced';
  if (requests.some((request) => request.resultState === 'error')) return 'error';
  return 'not_synced';
}

function sumRequestResultCount(requests, key) {
  return requests.reduce((total, request) => total + getLedgerRequestResultCounts(request)[key], 0);
}

function getLatestDate(values) {
  const dates = values.map(toDate).filter(Boolean);
  if (!dates.length) return null;

  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function toDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function timestampSql(value) {
  return sql`${toPostgresTimestamp(value)}::timestamp with time zone`;
}

function toPostgresTimestamp(value) {
  return value instanceof Date ? value.toISOString() : value;
}
