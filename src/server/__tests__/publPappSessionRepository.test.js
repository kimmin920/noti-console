import { describe, expect, it } from 'vitest';

import {
  createPublPappSessionRepository,
  createPublSyntheticEmail,
} from '../publPapp/repository.js';

const FIXED_NOW = new Date('2026-07-06T00:00:00.000Z');
const REFRESH_EXPIRES_AT = new Date('2026-08-05T00:00:00.000Z');
const ACCESS_EXPIRES_AT = new Date('2026-07-06T00:15:00.000Z');

describe('Publ PApp session repository', () => {
  it('provisions one local user, billing account, external Publ account, session, and channel mapping', async () => {
    const store = createMemoryPublPappStore();
    const repository = createTestRepository(store);

    const result = await repository.provisionSessionForExchange(createProvisionInput());

    expect(result.user).toMatchObject({
      id: 'user_1',
      userRef: 'u_publ_test',
      email: createPublSyntheticEmail('consumer_1'),
      status: 'active',
      isOperator: false,
    });
    expect(result.billingAccount).toMatchObject({
      id: 'billing_1',
      billingRef: 'b_publ_test',
      ownerId: 'user_1',
      ownerType: 'user',
      status: 'active',
    });
    expect(result.externalAuthAccount).toMatchObject({
      provider: 'publ',
      providerAccountId: 'consumer_1',
      userId: 'user_1',
    });
    expect(result.session).toMatchObject({
      userId: 'user_1',
      consumerId: 'consumer_1',
      pAppCode: '3RD_A00003_TEST',
      channelId: 123,
      channelCode: 'STORE_1',
      installedPAppId: 456,
      sellerProfileDistinctId: 'seller_profile_1',
      sellerRole: 'OWNER',
      refreshTokenHash: 'refresh_hash_1',
      refreshTokenExpiresAt: REFRESH_EXPIRES_AT,
      accessTokenJti: 'access_jti_1',
      accessTokenExpiresAt: ACCESS_EXPIRES_AT,
      revokedAt: null,
    });
    expect(result.channelMapping).toMatchObject({
      userId: 'user_1',
      channelCode: 'STORE_1',
      status: 'active',
      externalBusinessRef: 'consumer_1',
    });
    expect(store.users).toHaveLength(1);
    expect(store.billingAccounts).toHaveLength(1);
    expect(store.externalAuthAccounts).toHaveLength(1);
    expect(store.sessions).toHaveLength(1);
    expect(store.channelMappings).toHaveLength(1);
  });

  it('reuses the same Publ user and session for repeated provisioning of one consumerId', async () => {
    const store = createMemoryPublPappStore();
    const repository = createTestRepository(store);

    const first = await repository.provisionSessionForExchange(createProvisionInput());
    const second = await repository.provisionSessionForExchange(createProvisionInput({
      refreshTokenHash: 'refresh_hash_2',
      accessTokenJti: 'access_jti_2',
      claim: {
        role: 'ADMIN',
      },
    }));

    expect(second.user.id).toBe(first.user.id);
    expect(second.session.id).toBe(first.session.id);
    expect(second.session).toMatchObject({
      refreshTokenHash: 'refresh_hash_2',
      accessTokenJti: 'access_jti_2',
      sellerRole: 'ADMIN',
    });
    expect(store.users).toHaveLength(1);
    expect(store.billingAccounts).toHaveLength(1);
    expect(store.externalAuthAccounts).toHaveLength(1);
    expect(store.sessions).toHaveLength(1);
    expect(store.channelMappings).toHaveLength(1);
  });

  it('updates the existing channel mapping for repeated channelCode provisioning without duplicates', async () => {
    const store = createMemoryPublPappStore();
    const repository = createTestRepository(store);

    await repository.provisionSessionForExchange(createProvisionInput({
      claim: {
        consumerId: 'consumer_1',
        channelCode: 'SHARED_CHANNEL',
      },
    }));
    await repository.provisionSessionForExchange(createProvisionInput({
      claim: {
        consumerId: 'consumer_2',
        channelCode: 'SHARED_CHANNEL',
      },
      refreshTokenHash: 'refresh_hash_2',
      accessTokenJti: 'access_jti_2',
    }));

    expect(store.users).toHaveLength(2);
    expect(store.sessions).toHaveLength(2);
    expect(store.channelMappings).toHaveLength(1);
    expect(store.channelMappings[0]).toMatchObject({
      userId: 'user_2',
      channelCode: 'SHARED_CHANNEL',
      status: 'active',
      externalBusinessRef: 'consumer_2',
    });
  });

  it('finds only non-revoked refresh sessions by consumerId and refresh token hash', async () => {
    const store = createMemoryPublPappStore();
    const repository = createTestRepository(store);
    await repository.provisionSessionForExchange(createProvisionInput());

    await expect(repository.findActiveSessionByRefreshToken({
      consumerId: 'consumer_1',
      refreshTokenHash: 'refresh_hash_1',
      now: FIXED_NOW,
    })).resolves.toMatchObject({
      session: {
        consumerId: 'consumer_1',
      },
      user: {
        id: 'user_1',
      },
    });
    await expect(repository.findActiveSessionByRefreshToken({
      consumerId: 'consumer_1',
      refreshTokenHash: 'wrong_hash',
      now: FIXED_NOW,
    })).resolves.toBeNull();

    await repository.revokeSessionByConsumerId({
      consumerId: 'consumer_1',
      now: FIXED_NOW,
    });

    await expect(repository.findActiveSessionByRefreshToken({
      consumerId: 'consumer_1',
      refreshTokenHash: 'refresh_hash_1',
      now: FIXED_NOW,
    })).resolves.toBeNull();
  });

  it('expires a refresh token hash without storing a raw refresh token', async () => {
    const store = createMemoryPublPappStore();
    const repository = createTestRepository(store);
    const rawRefreshToken = 'THIRD_PARTY_REFRESH_TOKEN_SHOULD_NOT_BE_STORED';
    const refreshTokenHash = 'hash_of_third_party_refresh_token';

    await repository.provisionSessionForExchange(createProvisionInput({ refreshTokenHash }));
    expect(JSON.stringify(store)).not.toContain(rawRefreshToken);

    await repository.expireSessionRefreshToken({
      consumerId: 'consumer_1',
      refreshTokenHash,
      now: FIXED_NOW,
    });

    await expect(repository.findActiveSessionByRefreshToken({
      consumerId: 'consumer_1',
      refreshTokenHash,
      now: FIXED_NOW,
    })).resolves.toBeNull();
    expect(JSON.stringify(store)).not.toContain(rawRefreshToken);
  });
});

function createTestRepository(store) {
  return createPublPappSessionRepository(null, {
    store,
    makeUserRef: () => 'u_publ_test',
    makeBillingRef: () => 'b_publ_test',
  });
}

function createProvisionInput(overrides = {}) {
  return {
    claim: {
      consumerId: 'consumer_1',
      channelCode: 'STORE_1',
      channelId: 123,
      pAppCode: '3RD_A00003_TEST',
      installedPAppId: 456,
      distinctId: 'seller_profile_1',
      role: 'OWNER',
      ...(overrides.claim ?? {}),
    },
    refreshTokenHash: overrides.refreshTokenHash ?? 'refresh_hash_1',
    refreshTokenExpiresAt: overrides.refreshTokenExpiresAt ?? REFRESH_EXPIRES_AT,
    accessTokenJti: overrides.accessTokenJti ?? 'access_jti_1',
    accessTokenExpiresAt: overrides.accessTokenExpiresAt ?? ACCESS_EXPIRES_AT,
    now: overrides.now ?? FIXED_NOW,
  };
}

function createMemoryPublPappStore() {
  return {
    users: [],
    billingAccounts: [],
    externalAuthAccounts: [],
    sessions: [],
    channelMappings: [],

    async transaction(callback) {
      return callback(this);
    },

    async findPublExternalAuthAccount(consumerId) {
      const account = this.externalAuthAccounts.find((candidate) => (
        candidate.provider === 'publ' &&
        candidate.providerAccountId === consumerId
      ));
      if (!account) return null;

      return {
        account,
        user: this.users.find((user) => user.id === account.userId) ?? null,
      };
    },

    async createPublUserWithBillingAndAccount({ user, billingAccount, externalAuthAccount }) {
      const createdUser = {
        id: `user_${this.users.length + 1}`,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
        ...user,
      };
      const createdBillingAccount = {
        id: `billing_${this.billingAccounts.length + 1}`,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
        ...billingAccount,
        ownerId: createdUser.id,
      };
      const createdExternalAuthAccount = {
        id: `external_${this.externalAuthAccounts.length + 1}`,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
        ...externalAuthAccount,
        userId: createdUser.id,
      };

      this.users.push(createdUser);
      this.billingAccounts.push(createdBillingAccount);
      this.externalAuthAccounts.push(createdExternalAuthAccount);

      return {
        user: createdUser,
        billingAccount: createdBillingAccount,
        externalAuthAccount: createdExternalAuthAccount,
      };
    },

    async upsertSession(values) {
      const existing = this.sessions.find((session) => session.consumerId === values.consumerId);
      if (existing) {
        Object.assign(existing, values);
        return existing;
      }

      const created = {
        id: `session_${this.sessions.length + 1}`,
        createdAt: FIXED_NOW,
        ...values,
      };
      this.sessions.push(created);
      return created;
    },

    async upsertChannelMapping(values) {
      const existing = this.channelMappings.find((mapping) => mapping.channelCode === values.channelCode);
      if (existing) {
        Object.assign(existing, values);
        return existing;
      }

      const created = {
        id: `mapping_${this.channelMappings.length + 1}`,
        createdAt: FIXED_NOW,
        ...values,
      };
      this.channelMappings.push(created);
      return created;
    },

    async findActiveSessionByRefreshToken({ consumerId, refreshTokenHash, now }) {
      const session = this.sessions.find((candidate) => (
        candidate.consumerId === consumerId &&
        candidate.refreshTokenHash === refreshTokenHash &&
        !candidate.revokedAt &&
        candidate.refreshTokenExpiresAt.getTime() > now.getTime()
      ));
      if (!session) return null;

      return {
        session,
        user: this.users.find((user) => user.id === session.userId) ?? null,
      };
    },

    async revokeSessionByConsumerId({ consumerId, now }) {
      const session = this.sessions.find((candidate) => candidate.consumerId === consumerId);
      if (!session) return null;
      Object.assign(session, { revokedAt: now, updatedAt: now });
      return session;
    },

    async expireSessionRefreshToken({ consumerId, refreshTokenHash, now }) {
      const session = this.sessions.find((candidate) => (
        candidate.consumerId === consumerId &&
        candidate.refreshTokenHash === refreshTokenHash &&
        !candidate.revokedAt
      ));
      if (!session) return null;
      Object.assign(session, { refreshTokenExpiresAt: now, updatedAt: now });
      return session;
    },
  };
}
