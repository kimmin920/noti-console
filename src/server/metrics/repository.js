import { and, eq, gte, isNotNull, isNull, lte, or } from 'drizzle-orm';

import {
  automationEventDeliveries,
  messageSendGroups,
  senderResources,
  smsBulkSendRuns,
  smsQuotaBuckets,
  users,
} from '../../db/schema.js';

export function createMetricsRepository(db) {
  return {
    async getUserById(userId) {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      return user ?? null;
    },

    async listMessageSendGroupsForMetrics({ channel, from, sourceType, to, userId }) {
      const predicates = [
        eq(messageSendGroups.userId, userId),
        isNull(messageSendGroups.archivedAt),
        or(
          and(
            isNotNull(messageSendGroups.scheduledAt),
            gte(messageSendGroups.scheduledAt, from),
            lte(messageSendGroups.scheduledAt, to)
          ),
          and(
            isNull(messageSendGroups.scheduledAt),
            gte(messageSendGroups.createdAt, from),
            lte(messageSendGroups.createdAt, to)
          )
        ),
      ];

      if (channel) {
        predicates.push(eq(messageSendGroups.channel, channel));
      }

      if (sourceType) {
        predicates.push(eq(messageSendGroups.sourceType, sourceType));
      }

      return db
        .select({
          canceledCount: messageSendGroups.canceledCount,
          channel: messageSendGroups.channel,
          createdAt: messageSendGroups.createdAt,
          failedCount: messageSendGroups.failedCount,
          id: messageSendGroups.id,
          pendingCount: messageSendGroups.pendingCount,
          providerState: messageSendGroups.providerState,
          resultState: messageSendGroups.resultState,
          scheduledAt: messageSendGroups.scheduledAt,
          sendKind: messageSendGroups.sendKind,
          sendTiming: messageSendGroups.sendTiming,
          senderResourceId: messageSendGroups.senderResourceId,
          senderResourceLabel: senderResources.displayName,
          sourceType: messageSendGroups.sourceType,
          successCount: messageSendGroups.successCount,
          totalRecipientCount: messageSendGroups.totalRecipientCount,
        })
        .from(messageSendGroups)
        .leftJoin(senderResources, eq(messageSendGroups.senderResourceId, senderResources.id))
        .where(and(...predicates));
    },

    async listAutomationDeliveriesForMetrics({ channel, from, to, userId }) {
      const predicates = [
        eq(automationEventDeliveries.userId, userId),
        gte(automationEventDeliveries.receivedAt, from),
        lte(automationEventDeliveries.receivedAt, to),
      ];

      if (channel) {
        predicates.push(eq(automationEventDeliveries.sendChannel, channel));
      }

      return db
        .select({
          createdAt: automationEventDeliveries.createdAt,
          reasonCode: automationEventDeliveries.reasonCode,
          receivedAt: automationEventDeliveries.receivedAt,
          sendChannel: automationEventDeliveries.sendChannel,
          status: automationEventDeliveries.status,
        })
        .from(automationEventDeliveries)
        .where(and(...predicates));
    },

    async listSmsBulkRunsForMetrics({ channel, from, to, userId }) {
      const predicates = [
        eq(smsBulkSendRuns.userId, userId),
        gte(smsBulkSendRuns.createdAt, from),
        lte(smsBulkSendRuns.createdAt, to),
      ];

      if (channel) {
        predicates.push(eq(smsBulkSendRuns.channel, channel));
      }

      return db
        .select({
          acceptedCount: smsBulkSendRuns.acceptedCount,
          channel: smsBulkSendRuns.channel,
          failedCount: smsBulkSendRuns.failedCount,
          rejectedCount: smsBulkSendRuns.rejectedCount,
          status: smsBulkSendRuns.status,
          totalRecipients: smsBulkSendRuns.totalRecipients,
          unknownCount: smsBulkSendRuns.unknownCount,
        })
        .from(smsBulkSendRuns)
        .where(and(...predicates));
    },

    async listSmsQuotaBucketsForMetrics({ now, userId }) {
      return db
        .select({
          channel: smsQuotaBuckets.channel,
          consumedCount: smsQuotaBuckets.consumedCount,
          periodEndAt: smsQuotaBuckets.periodEndAt,
          periodStartAt: smsQuotaBuckets.periodStartAt,
          quotaLimit: smsQuotaBuckets.quotaLimit,
          reservedCount: smsQuotaBuckets.reservedCount,
        })
        .from(smsQuotaBuckets)
        .where(
          and(
            eq(smsQuotaBuckets.userId, userId),
            lte(smsQuotaBuckets.periodStartAt, now),
            gte(smsQuotaBuckets.periodEndAt, now)
          )
        );
    },
  };
}
