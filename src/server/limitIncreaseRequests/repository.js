import { and, desc, eq, isNull } from 'drizzle-orm';

import {
  auditLogs,
  limitIncreaseRequests,
  senderResources,
  userSenderResources,
  users,
} from '../../db/schema.js';
import { sanitizeAuditMetadata } from '../audit/service.js';

export function createLimitIncreaseRequestRepository(db) {
  return {
    async getUserById(userId) {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      return user ?? null;
    },

    async getUserSenderResource({ userId, senderResourceId }) {
      const [record] = await db
        .select({
          link: userSenderResources,
          resource: senderResources,
        })
        .from(userSenderResources)
        .innerJoin(senderResources, eq(userSenderResources.senderResourceId, senderResources.id))
        .where(and(
          eq(userSenderResources.userId, userId),
          eq(userSenderResources.senderResourceId, senderResourceId)
        ))
        .limit(1);

      return record ?? null;
    },

    async listUserRequests(userId) {
      return db
        .select({
          request: limitIncreaseRequests,
          senderResource: senderResources,
        })
        .from(limitIncreaseRequests)
        .leftJoin(senderResources, eq(limitIncreaseRequests.senderResourceId, senderResources.id))
        .where(eq(limitIncreaseRequests.userId, userId))
        .orderBy(desc(limitIncreaseRequests.createdAt));
    },

    async findSubmittedUserRequest({ channel, senderResourceId = null, userId }) {
      const senderResourceFilter = senderResourceId
        ? eq(limitIncreaseRequests.senderResourceId, senderResourceId)
        : isNull(limitIncreaseRequests.senderResourceId);
      const [record] = await db
        .select()
        .from(limitIncreaseRequests)
        .where(and(
          eq(limitIncreaseRequests.userId, userId),
          eq(limitIncreaseRequests.channel, channel),
          eq(limitIncreaseRequests.status, 'submitted'),
          senderResourceFilter
        ))
        .limit(1);

      return record ?? null;
    },

    async createRequest(values) {
      const [request] = await db.insert(limitIncreaseRequests).values(values).returning();
      return request;
    },

    async listRequests({ status } = {}) {
      const query = db
        .select({
          request: limitIncreaseRequests,
          senderResource: senderResources,
          user: users,
        })
        .from(limitIncreaseRequests)
        .innerJoin(users, eq(limitIncreaseRequests.userId, users.id))
        .leftJoin(senderResources, eq(limitIncreaseRequests.senderResourceId, senderResources.id));

      return (status ? query.where(eq(limitIncreaseRequests.status, status)) : query)
        .orderBy(desc(limitIncreaseRequests.createdAt));
    },

    async getRequestWithUserAndResource(requestId) {
      const [record] = await db
        .select({
          request: limitIncreaseRequests,
          senderResource: senderResources,
          user: users,
        })
        .from(limitIncreaseRequests)
        .innerJoin(users, eq(limitIncreaseRequests.userId, users.id))
        .leftJoin(senderResources, eq(limitIncreaseRequests.senderResourceId, senderResources.id))
        .where(eq(limitIncreaseRequests.id, requestId))
        .limit(1);

      return record ?? null;
    },

    async updateRequest(requestId, values) {
      const [request] = await db
        .update(limitIncreaseRequests)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(limitIncreaseRequests.id, requestId))
        .returning();

      return request ?? null;
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
