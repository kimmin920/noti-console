import { and, eq } from 'drizzle-orm';

import {
  billingAccounts,
  externalAuthAccounts,
  users,
} from '../../db/schema.js';

export function createAuthRepository(db) {
  return {
    async getUserById(userId) {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      return user ?? null;
    },

    async findFirstOperator() {
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.status, 'active'), eq(users.isOperator, true)))
        .limit(1);
      return user ?? null;
    },

    async findUserByEmail(email) {
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return user ?? null;
    },

    async findExternalAuthAccount({ provider, providerAccountId }) {
      const [row] = await db
        .select({
          account: externalAuthAccounts,
          user: users,
        })
        .from(externalAuthAccounts)
        .innerJoin(users, eq(externalAuthAccounts.userId, users.id))
        .where(
          and(
            eq(externalAuthAccounts.provider, provider),
            eq(externalAuthAccounts.providerAccountId, providerAccountId)
          )
        )
        .limit(1);

      return row ?? null;
    },

    async findExternalAuthAccountByProviderEmail({ provider, email }) {
      const [row] = await db
        .select({
          account: externalAuthAccounts,
          user: users,
        })
        .from(externalAuthAccounts)
        .innerJoin(users, eq(externalAuthAccounts.userId, users.id))
        .where(and(eq(externalAuthAccounts.provider, provider), eq(externalAuthAccounts.email, email)))
        .limit(1);

      return row ?? null;
    },

    async createUserWithExternalAuthAccount({ user, billingAccount, externalAuthAccount }) {
      return db.transaction(async (tx) => {
        const [createdUser] = await tx.insert(users).values(user).returning();
        const [createdBillingAccount] = await tx
          .insert(billingAccounts)
          .values({
            ...billingAccount,
            ownerId: createdUser.id,
          })
          .returning();
        const [createdExternalAuthAccount] = await tx
          .insert(externalAuthAccounts)
          .values({
            ...externalAuthAccount,
            userId: createdUser.id,
          })
          .returning();

        return {
          user: createdUser,
          billingAccount: createdBillingAccount,
          externalAuthAccount: createdExternalAuthAccount,
        };
      });
    },
  };
}
