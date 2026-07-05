import { and, desc, eq } from 'drizzle-orm';

import {
  auditLogs,
  billingAccounts,
  senderResources,
  settlementRuns,
  settlementUsageSummaries,
  userSenderResources,
  users,
} from '../../db/schema.js';
import { sanitizeAuditMetadata } from '../audit/service.js';

export function createSettlementRepository(db) {
  return {
    async getUserById(userId) {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      return user ?? null;
    },

    async listUsers() {
      return db.select().from(users);
    },

    async listBillingAccounts() {
      return db.select().from(billingAccounts);
    },

    async listSenderResources() {
      return db.select().from(senderResources);
    },

    async listUserSenderResources() {
      return db.select().from(userSenderResources);
    },

    async createSettlementRun(values) {
      const [run] = await db.insert(settlementRuns).values(values).returning();
      return run;
    },

    async updateSettlementRun(runId, values) {
      const [run] = await db.update(settlementRuns).set(values).where(eq(settlementRuns.id, runId)).returning();
      return run ?? null;
    },

    async listSettlementRuns({ status } = {}) {
      const query = db.select().from(settlementRuns);
      const runs = await (status ? query.where(eq(settlementRuns.status, status)) : query).orderBy(
        desc(settlementRuns.createdAt)
      );

      return runs;
    },

    async getSettlementRun(runId) {
      const [run] = await db.select().from(settlementRuns).where(eq(settlementRuns.id, runId)).limit(1);
      return run ?? null;
    },

    async listUsageSummaries(runId) {
      return db
        .select()
        .from(settlementUsageSummaries)
        .where(eq(settlementUsageSummaries.runId, runId));
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
      if (!records.length) return [];
      return db.insert(settlementUsageSummaries).values(records).returning();
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

    async findUserSenderResourceLink({ userId, senderResourceId }) {
      const [link] = await db
        .select()
        .from(userSenderResources)
        .where(and(eq(userSenderResources.userId, userId), eq(userSenderResources.senderResourceId, senderResourceId)))
        .limit(1);

      return link ?? null;
    },
  };
}
