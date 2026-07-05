import { and, eq } from 'drizzle-orm';

import {
  senderResources,
  userSenderResources,
  users,
} from '../../db/schema.js';

export function createTemplateCatalogRepository(db) {
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

  };
}
