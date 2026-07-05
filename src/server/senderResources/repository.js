import { and, desc, eq, lte } from 'drizzle-orm';

import {
  auditLogs,
  billingAccounts,
  senderResourceApplicationEvidenceFiles,
  senderResourceApplications,
  senderResources,
  userSenderResources,
  users,
} from '../../db/schema.js';
import { sanitizeAuditMetadata } from '../audit/service.js';

export function createSenderResourceRepository(db) {
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
        .where(eq(userSenderResources.userId, userId))
        .orderBy(desc(userSenderResources.updatedAt));
    },

    async listUserApplications(userId) {
      const applications = await db
        .select()
        .from(senderResourceApplications)
        .where(eq(senderResourceApplications.userId, userId))
        .orderBy(desc(senderResourceApplications.createdAt));

      return withEvidenceFiles(applications, this.listEvidenceFilesByApplicationId);
    },

    async findSubmittedApplicationByUserValue({ userId, resourceType, requestedValue }) {
      const [application] = await db
        .select()
        .from(senderResourceApplications)
        .where(
          and(
            eq(senderResourceApplications.userId, userId),
            eq(senderResourceApplications.resourceType, resourceType),
            eq(senderResourceApplications.requestedValue, requestedValue),
            eq(senderResourceApplications.status, 'submitted')
          )
        )
        .limit(1);

      return application ?? null;
    },

    async createApplication(values) {
      const [application] = await db.insert(senderResourceApplications).values(values).returning();
      return application;
    },

    async updateApplication(applicationId, values) {
      const [application] = await db
        .update(senderResourceApplications)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(senderResourceApplications.id, applicationId))
        .returning();

      return application ?? null;
    },

    async createEvidenceFiles(records) {
      if (!records.length) return [];
      return db.insert(senderResourceApplicationEvidenceFiles).values(records).returning();
    },

    async updateEvidenceFiles(fileIds, values) {
      const updated = [];

      for (const fileId of fileIds) {
        const [file] = await db
          .update(senderResourceApplicationEvidenceFiles)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(senderResourceApplicationEvidenceFiles.id, fileId))
          .returning();

        if (file) {
          updated.push(file);
        }
      }

      return updated;
    },

    async listEvidenceFilesByApplicationId(applicationId) {
      return db
        .select()
        .from(senderResourceApplicationEvidenceFiles)
        .where(eq(senderResourceApplicationEvidenceFiles.applicationId, applicationId))
        .orderBy(desc(senderResourceApplicationEvidenceFiles.createdAt));
    },

    async listEvidenceFilesReadyForDeletion(cutoffDate, { limit = 100 } = {}) {
      return db
        .select()
        .from(senderResourceApplicationEvidenceFiles)
        .where(
          and(
            eq(senderResourceApplicationEvidenceFiles.status, 'delete_pending'),
            lte(senderResourceApplicationEvidenceFiles.deleteAfter, cutoffDate)
          )
        )
        .orderBy(senderResourceApplicationEvidenceFiles.deleteAfter)
        .limit(limit);
    },

    async listApplications({ status, resourceType } = {}) {
      const filters = [];

      if (status) {
        filters.push(eq(senderResourceApplications.status, status));
      }

      if (resourceType) {
        filters.push(eq(senderResourceApplications.resourceType, resourceType));
      }

      const query = db
        .select({
          application: senderResourceApplications,
          user: users,
        })
        .from(senderResourceApplications)
        .innerJoin(users, eq(senderResourceApplications.userId, users.id));

      const applications = await (filters.length ? query.where(and(...filters)) : query).orderBy(
        desc(senderResourceApplications.createdAt)
      );

      const withEvidence = [];

      for (const row of applications) {
        withEvidence.push({
          ...row,
          evidenceFiles: await this.listEvidenceFilesByApplicationId(row.application.id),
        });
      }

      return withEvidence;
    },

    async getApplicationWithEvidence(applicationId) {
      const [application] = await db
        .select()
        .from(senderResourceApplications)
        .where(eq(senderResourceApplications.id, applicationId))
        .limit(1);

      if (!application) return null;

      return {
        application,
        user: await this.getUserById(application.userId),
        evidenceFiles: await this.listEvidenceFilesByApplicationId(application.id),
      };
    },

    async findSenderResource({ provider, type, value }) {
      const [resource] = await db
        .select()
        .from(senderResources)
        .where(
          and(
            eq(senderResources.provider, provider),
            eq(senderResources.type, type),
            eq(senderResources.value, value)
          )
        )
        .limit(1);

      return resource ?? null;
    },

    async createSenderResource(values) {
      const [resource] = await db.insert(senderResources).values(values).returning();
      return resource;
    },

    async findBillingAccountForUser(userId) {
      const [billingAccount] = await db
        .select()
        .from(billingAccounts)
        .where(and(eq(billingAccounts.ownerType, 'user'), eq(billingAccounts.ownerId, userId)))
        .limit(1);

      return billingAccount ?? null;
    },

    async findUserSenderResourceLink({ userId, senderResourceId }) {
      const [link] = await db
        .select()
        .from(userSenderResources)
        .where(
          and(eq(userSenderResources.userId, userId), eq(userSenderResources.senderResourceId, senderResourceId))
        )
        .limit(1);

      return link ?? null;
    },

    async createUserSenderResourceLink(values) {
      const [link] = await db.insert(userSenderResources).values(values).returning();
      return link;
    },

    async updateUserSenderResourceLink(linkId, values) {
      const [link] = await db
        .update(userSenderResources)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(userSenderResources.id, linkId))
        .returning();

      return link ?? null;
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

async function withEvidenceFiles(applications, listEvidenceFilesByApplicationId) {
  const results = [];

  for (const application of applications) {
    results.push({
      application,
      evidenceFiles: await listEvidenceFilesByApplicationId(application.id),
    });
  }

  return results;
}
