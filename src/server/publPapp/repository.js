import { createHash, randomBytes } from 'node:crypto';

import { and, eq, gt, isNull } from 'drizzle-orm';

import {
  billingAccounts,
  externalAuthAccounts,
  publChannelMappings,
  publPappSessions,
  users,
} from '../../db/schema.js';

const PUBL_PROVIDER = 'publ';
const USER_STATUS_ACTIVE = 'active';
const BILLING_ACCOUNT_STATUS_ACTIVE = 'active';
const PUBL_INTERNAL_EMAIL_DOMAIN = 'publ.internal.vizuo.invalid';

export function createPublPappSessionRepository(db, options = {}) {
  const store = options.store ?? createDrizzlePublPappSessionStore(db);
  const makeUserRef = options.makeUserRef ?? (() => createShortRef('u'));
  const makeBillingRef = options.makeBillingRef ?? (() => createShortRef('b'));

  return {
    async provisionSessionForExchange(values) {
      const input = normalizeProvisionInput(values);
      const now = values?.now ?? new Date();

      return store.transaction(async (tx) => {
        let mappedAccount = await tx.findPublExternalAuthAccount(input.consumerId);
        let createdBillingAccount = null;

        if (!mappedAccount?.user) {
          const created = await tx.createPublUserWithBillingAndAccount({
            user: {
              userRef: makeUserRef(),
              email: createPublSyntheticEmail(input.consumerId),
              name: createPublUserDisplayName(input.consumerId),
              status: USER_STATUS_ACTIVE,
              isOperator: false,
            },
            billingAccount: {
              billingRef: makeBillingRef(),
              ownerType: 'user',
              status: BILLING_ACCOUNT_STATUS_ACTIVE,
            },
            externalAuthAccount: {
              provider: PUBL_PROVIDER,
              providerAccountId: input.consumerId,
              email: createPublSyntheticEmail(input.consumerId),
              displayName: createPublUserDisplayName(input.consumerId),
            },
          });

          mappedAccount = {
            user: created.user,
            account: created.externalAuthAccount,
          };
          createdBillingAccount = created.billingAccount;
        }

        const session = await tx.upsertSession({
          userId: mappedAccount.user.id,
          consumerId: input.consumerId,
          pAppCode: input.pAppCode,
          channelId: input.channelId,
          channelCode: input.channelCode,
          installedPAppId: input.installedPAppId,
          sellerProfileDistinctId: input.sellerProfileDistinctId,
          sellerRole: input.sellerRole,
          refreshTokenHash: input.refreshTokenHash,
          refreshTokenExpiresAt: input.refreshTokenExpiresAt,
          accessTokenJti: input.accessTokenJti,
          accessTokenExpiresAt: input.accessTokenExpiresAt,
          revokedAt: null,
          updatedAt: now,
        });

        const channelMapping = await tx.upsertChannelMapping({
          userId: mappedAccount.user.id,
          channelCode: input.channelCode,
          displayName: createChannelDisplayName(input.channelCode),
          status: 'active',
          externalBusinessRef: input.consumerId,
          updatedAt: now,
        });

        return {
          user: mappedAccount.user,
          billingAccount: createdBillingAccount,
          externalAuthAccount: mappedAccount.account,
          session,
          channelMapping,
        };
      });
    },

    async findActiveSessionByRefreshToken(values) {
      const consumerId = normalizeRequiredString(values?.consumerId, 'consumerId');
      const refreshTokenHash = normalizeRequiredString(values?.refreshTokenHash, 'refreshTokenHash');
      return store.findActiveSessionByRefreshToken({
        consumerId,
        refreshTokenHash,
        now: values?.now ?? new Date(),
      });
    },

    async revokeSessionByConsumerId(values) {
      const consumerId = normalizeRequiredString(values?.consumerId, 'consumerId');
      return store.revokeSessionByConsumerId({
        consumerId,
        now: values?.now ?? new Date(),
      });
    },

    async expireSessionRefreshToken(values) {
      const consumerId = normalizeRequiredString(values?.consumerId, 'consumerId');
      const refreshTokenHash = normalizeRequiredString(values?.refreshTokenHash, 'refreshTokenHash');
      return store.expireSessionRefreshToken({
        consumerId,
        refreshTokenHash,
        now: values?.now ?? new Date(),
      });
    },
  };
}

export function createPublSyntheticEmail(consumerId) {
  const normalizedConsumerId = normalizeRequiredString(consumerId, 'consumerId');
  const digest = createHash('sha256')
    .update(normalizedConsumerId)
    .digest('hex')
    .slice(0, 40);

  return `publ-${digest}@${PUBL_INTERNAL_EMAIL_DOMAIN}`;
}

export function createDrizzlePublPappSessionStore(db) {
  return {
    async transaction(callback) {
      return db.transaction((tx) => callback(createDrizzlePublPappSessionStore(tx)));
    },

    async findPublExternalAuthAccount(consumerId) {
      const [row] = await db
        .select({
          account: externalAuthAccounts,
          user: users,
        })
        .from(externalAuthAccounts)
        .innerJoin(users, eq(externalAuthAccounts.userId, users.id))
        .where(
          and(
            eq(externalAuthAccounts.provider, PUBL_PROVIDER),
            eq(externalAuthAccounts.providerAccountId, consumerId)
          )
        )
        .limit(1);

      return row ?? null;
    },

    async createPublUserWithBillingAndAccount({ user, billingAccount, externalAuthAccount }) {
      const [createdUser] = await db.insert(users).values(user).returning();
      const [createdBillingAccount] = await db
        .insert(billingAccounts)
        .values({
          ...billingAccount,
          ownerId: createdUser.id,
        })
        .returning();
      const [createdExternalAuthAccount] = await db
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
    },

    async upsertSession(values) {
      const [session] = await db
        .insert(publPappSessions)
        .values(values)
        .onConflictDoUpdate({
          target: publPappSessions.consumerId,
          set: {
            userId: values.userId,
            pAppCode: values.pAppCode,
            channelId: values.channelId,
            channelCode: values.channelCode,
            installedPAppId: values.installedPAppId,
            sellerProfileDistinctId: values.sellerProfileDistinctId,
            sellerRole: values.sellerRole,
            refreshTokenHash: values.refreshTokenHash,
            refreshTokenExpiresAt: values.refreshTokenExpiresAt,
            accessTokenJti: values.accessTokenJti,
            accessTokenExpiresAt: values.accessTokenExpiresAt,
            revokedAt: values.revokedAt,
            updatedAt: values.updatedAt,
          },
        })
        .returning();

      return session;
    },

    async upsertChannelMapping(values) {
      const [mapping] = await db
        .insert(publChannelMappings)
        .values(values)
        .onConflictDoUpdate({
          target: publChannelMappings.channelCode,
          set: {
            userId: values.userId,
            displayName: values.displayName,
            status: values.status,
            externalBusinessRef: values.externalBusinessRef,
            updatedAt: values.updatedAt,
          },
        })
        .returning();

      return mapping;
    },

    async findActiveSessionByRefreshToken({ consumerId, refreshTokenHash, now }) {
      const [row] = await db
        .select({
          session: publPappSessions,
          user: users,
        })
        .from(publPappSessions)
        .innerJoin(users, eq(publPappSessions.userId, users.id))
        .where(
          and(
            eq(publPappSessions.consumerId, consumerId),
            eq(publPappSessions.refreshTokenHash, refreshTokenHash),
            isNull(publPappSessions.revokedAt),
            gt(publPappSessions.refreshTokenExpiresAt, now)
          )
        )
        .limit(1);

      return row ?? null;
    },

    async revokeSessionByConsumerId({ consumerId, now }) {
      const [session] = await db
        .update(publPappSessions)
        .set({
          revokedAt: now,
          updatedAt: now,
        })
        .where(eq(publPappSessions.consumerId, consumerId))
        .returning();

      return session ?? null;
    },

    async expireSessionRefreshToken({ consumerId, refreshTokenHash, now }) {
      const [session] = await db
        .update(publPappSessions)
        .set({
          refreshTokenExpiresAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(publPappSessions.consumerId, consumerId),
            eq(publPappSessions.refreshTokenHash, refreshTokenHash),
            isNull(publPappSessions.revokedAt)
          )
        )
        .returning();

      return session ?? null;
    },
  };
}

function normalizeProvisionInput(values = {}) {
  const claim = values.claim ?? {};

  return {
    consumerId: normalizeRequiredString(claim.consumerId, 'claim.consumerId'),
    pAppCode: normalizeRequiredString(claim.pAppCode, 'claim.pAppCode'),
    channelId: normalizeOptionalInteger(claim.channelId, 'claim.channelId'),
    channelCode: normalizeRequiredString(claim.channelCode, 'claim.channelCode'),
    installedPAppId: normalizeOptionalInteger(claim.installedPAppId, 'claim.installedPAppId'),
    sellerProfileDistinctId: normalizeOptionalString(claim.distinctId),
    sellerRole: normalizeOptionalString(claim.role),
    refreshTokenHash: normalizeRequiredString(values.refreshTokenHash, 'refreshTokenHash'),
    refreshTokenExpiresAt: normalizeRequiredDate(values.refreshTokenExpiresAt, 'refreshTokenExpiresAt'),
    accessTokenJti: normalizeRequiredString(values.accessTokenJti, 'accessTokenJti'),
    accessTokenExpiresAt: normalizeRequiredDate(values.accessTokenExpiresAt, 'accessTokenExpiresAt'),
  };
}

function normalizeRequiredString(value, fieldName) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeOptionalInteger(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`${fieldName} must be a non-negative safe integer.`);
  }

  return number;
}

function normalizeRequiredDate(value, fieldName) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return date;
}

function createPublUserDisplayName(consumerId) {
  const digest = createHash('sha256')
    .update(consumerId)
    .digest('hex')
    .slice(0, 12);

  return `PApp user ${digest}`;
}

function createChannelDisplayName(channelCode) {
  return `Channel ${channelCode}`;
}

function createShortRef(prefix) {
  return `${prefix}_${randomBytes(8).toString('hex')}`;
}
