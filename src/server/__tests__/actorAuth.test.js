import { describe, expect, it, vi } from 'vitest';

import {
  AUTH_PROVIDERS,
  DEV_BROWSER_AUTH_USER_ID_COOKIE,
  DEV_RELAY_ACTOR_USER_ID_HEADER,
  RELAY_DEV_AUTH_HEADER_ENABLED_ENV,
  createActorResolver,
} from '../auth/actor.js';
import { RELAY_ERROR_CODES } from '../relay/constants.js';

describe('relay actor resolver', () => {
  it('resolves a Clerk-authenticated request to the mapped local user', async () => {
    const repository = createMemoryAuthRepository();
    const clerkCurrentUser = vi.fn();
    const resolver = createTestResolver({
      repository,
      clerkAuth: async () => ({ isAuthenticated: true, userId: 'clerk_user_1' }),
      clerkCurrentUser,
    });

    const actor = await resolver.resolve(createRequest());

    expect(actor).toMatchObject({
      userId: 'user_1',
      authProvider: AUTH_PROVIDERS.CLERK,
      user: {
        id: 'user_1',
      },
    });
    expect(clerkCurrentUser).not.toHaveBeenCalled();
  });

  it('returns UNAUTHORIZED when no real auth or enabled dev fallback is present', async () => {
    const resolver = createTestResolver({
      clerkAuth: async () => ({ isAuthenticated: false, userId: null }),
    });

    await expect(resolver.resolve(createRequest())).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.UNAUTHORIZED,
      status: 401,
    });
  });

  it('ignores spoofed x-relay-user-id when a real Clerk session is available', async () => {
    const repository = createMemoryAuthRepository({
      users: [
        createUser({ id: 'user_1', email: 'user1@example.com' }),
        createUser({ id: 'user_2', email: 'user2@example.com' }),
      ],
      externalAuthAccounts: [
        createExternalAuthAccount({
          userId: 'user_1',
          providerAccountId: 'clerk_user_1',
          email: 'user1@example.com',
        }),
      ],
    });
    const resolver = createTestResolver({
      repository,
      clerkAuth: async () => ({ isAuthenticated: true, userId: 'clerk_user_1' }),
    });

    const actor = await resolver.resolve(createRequest({ devActorUserId: 'user_2' }));

    expect(actor.user.id).toBe('user_1');
  });

  it('does not accept the dev auth header fallback in production', async () => {
    const resolver = createTestResolver({
      env: {
        NODE_ENV: 'production',
        [RELAY_DEV_AUTH_HEADER_ENABLED_ENV]: 'true',
      },
      clerkAuth: async () => ({ isAuthenticated: false, userId: null }),
    });

    await expect(resolver.resolve(createRequest({ devActorUserId: 'user_1' }))).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.UNAUTHORIZED,
      status: 401,
    });
  });

  it('resolves a dev browser auth cookie in development', async () => {
    const resolver = createTestResolver({
      env: {
        NODE_ENV: 'development',
        [RELAY_DEV_AUTH_HEADER_ENABLED_ENV]: 'false',
      },
      clerkAuth: async () => ({ isAuthenticated: false, userId: null }),
    });

    const actor = await resolver.resolve(createRequest({ devBrowserAuthUserId: 'user_1' }));

    expect(actor).toMatchObject({
      authProvider: 'dev_cookie',
      userId: 'user_1',
      user: {
        id: 'user_1',
      },
    });
  });

  it('lets the dev browser auth cookie override a Clerk session in development', async () => {
    const repository = createMemoryAuthRepository({
      users: [
        createUser({ id: 'user_1', email: 'user1@example.com' }),
        createUser({ id: 'operator_1', email: 'operator@example.com', isOperator: true }),
      ],
      externalAuthAccounts: [
        createExternalAuthAccount({
          userId: 'user_1',
          providerAccountId: 'clerk_user_1',
          email: 'user1@example.com',
        }),
      ],
    });
    const resolver = createTestResolver({
      repository,
      env: {
        NODE_ENV: 'development',
        [RELAY_DEV_AUTH_HEADER_ENABLED_ENV]: 'false',
      },
      clerkAuth: async () => ({ isAuthenticated: true, userId: 'clerk_user_1' }),
    });

    const actor = await resolver.resolve(createRequest({ devBrowserAuthUserId: 'operator_1' }));

    expect(actor).toMatchObject({
      authProvider: 'dev_cookie',
      userId: 'operator_1',
      user: {
        email: 'operator@example.com',
        isOperator: true,
      },
    });
  });


  it('does not accept the dev browser auth cookie in production', async () => {
    const resolver = createTestResolver({
      env: {
        NODE_ENV: 'production',
        [RELAY_DEV_AUTH_HEADER_ENABLED_ENV]: 'true',
      },
      clerkAuth: async () => ({ isAuthenticated: false, userId: null }),
    });

    await expect(resolver.resolve(createRequest({ devBrowserAuthUserId: 'user_1' }))).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.UNAUTHORIZED,
      status: 401,
    });
  });

  it('auto-provisions a Clerk user without persisting OAuth access or refresh tokens', async () => {
    const repository = createMemoryAuthRepository({
      users: [],
      externalAuthAccounts: [],
      billingAccounts: [],
    });
    const resolver = createTestResolver({
      repository,
      clerkAuth: async () => ({ isAuthenticated: true, userId: 'clerk_google_1' }),
      clerkCurrentUser: async () => ({
        id: 'clerk_google_1',
        fullName: 'Google User',
        primaryEmailAddress: {
          emailAddress: 'google-user@example.com',
        },
        externalAccounts: [
          {
            provider: 'oauth_google',
            accessToken: 'google-access-token',
            refreshToken: 'google-refresh-token',
          },
        ],
      }),
    });

    const actor = await resolver.resolve(createRequest());

    expect(actor).toMatchObject({
      user: {
        id: 'user_1',
        email: 'google-user@example.com',
        name: 'Google User',
      },
      externalAuthAccount: {
        provider: AUTH_PROVIDERS.CLERK,
        providerAccountId: 'clerk_google_1',
      },
    });
    expect(repository.users).toHaveLength(1);
    expect(repository.billingAccounts).toHaveLength(1);
    expect(repository.externalAuthAccounts).toHaveLength(1);
    expect(JSON.stringify(repository)).not.toContain('google-access-token');
    expect(JSON.stringify(repository)).not.toContain('google-refresh-token');
  });

  it('resolves concurrent first Clerk login calls to the same auto-provisioned user', async () => {
    const repository = createConcurrentFirstLoginAuthRepository({ participants: 3 });
    const resolver = createTestResolver({
      repository,
      clerkAuth: async () => ({ isAuthenticated: true, userId: 'clerk_race_1' }),
      clerkCurrentUser: async () => ({
        id: 'clerk_race_1',
        fullName: 'Race User',
        primaryEmailAddress: {
          emailAddress: 'race-user@example.com',
        },
      }),
    });

    const actors = await Promise.all([
      resolver.resolve(createRequest()),
      resolver.resolve(createRequest()),
      resolver.resolve(createRequest()),
    ]);

    expect(actors.map((actor) => actor.user.id)).toEqual(['user_1', 'user_1', 'user_1']);
    expect(actors.map((actor) => actor.externalAuthAccount.providerAccountId)).toEqual([
      'clerk_race_1',
      'clerk_race_1',
      'clerk_race_1',
    ]);
    expect(repository.users).toHaveLength(1);
    expect(repository.billingAccounts).toHaveLength(1);
    expect(repository.externalAuthAccounts).toHaveLength(1);
    expect(repository.createAttempts).toBe(3);
    expect(repository.findExternalAuthAccountCalls).toBeGreaterThan(3);
  });

  it('recovers a first-login unique conflict by requerying the provider email mapping', async () => {
    const mappedUser = createUser({ id: 'user_race', email: 'race-user@example.com' });
    const mappedAccount = createExternalAuthAccount({
      id: 'external_race',
      userId: 'user_race',
      providerAccountId: 'clerk_race_1',
      email: 'race-user@example.com',
    });
    const repository = {
      async getUserById(userId) {
        return userId === mappedUser.id ? mappedUser : null;
      },
      findUserByEmail: vi.fn(async () => null),
      findExternalAuthAccount: vi.fn(async () => null),
      findExternalAuthAccountByProviderEmail: vi.fn(async () => ({
        account: mappedAccount,
        user: mappedUser,
      })),
      createUserWithExternalAuthAccount: vi.fn(async () => {
        throw createUniqueConstraintError('users_email_unique');
      }),
    };
    const resolver = createTestResolver({
      repository,
      clerkAuth: async () => ({ isAuthenticated: true, userId: 'clerk_race_1' }),
      clerkCurrentUser: async () => ({
        id: 'clerk_race_1',
        fullName: 'Race User',
        primaryEmailAddress: {
          emailAddress: 'race-user@example.com',
        },
      }),
    });

    const actor = await resolver.resolve(createRequest());

    expect(actor).toMatchObject({
      userId: 'user_race',
      externalAuthAccount: {
        provider: AUTH_PROVIDERS.CLERK,
        providerAccountId: 'clerk_race_1',
        email: 'race-user@example.com',
      },
    });
    expect(repository.findExternalAuthAccountByProviderEmail).toHaveBeenCalledWith({
      provider: AUTH_PROVIDERS.CLERK,
      email: 'race-user@example.com',
    });
  });

  it('returns a deterministic account-linking error when a Clerk email already exists locally', async () => {
    const repository = createMemoryAuthRepository({
      users: [createUser({ id: 'user_existing', email: 'google-user@example.com' })],
      externalAuthAccounts: [],
      billingAccounts: [],
    });
    const resolver = createTestResolver({
      repository,
      clerkAuth: async () => ({ isAuthenticated: true, userId: 'clerk_google_1' }),
      clerkCurrentUser: async () => ({
        id: 'clerk_google_1',
        fullName: 'Google User',
        primaryEmailAddress: {
          emailAddress: 'google-user@example.com',
        },
      }),
    });

    await expect(resolver.resolve(createRequest())).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.UNAUTHORIZED,
      status: 401,
      message: 'Authenticated account needs account linking.',
    });
    expect(repository.users).toHaveLength(1);
    expect(repository.externalAuthAccounts).toEqual([]);
  });
});

function createTestResolver({ repository = createMemoryAuthRepository(), env, clerkAuth, clerkCurrentUser } = {}) {
  return createActorResolver({
    repository,
    env: env ?? {
      NODE_ENV: 'test',
      [RELAY_DEV_AUTH_HEADER_ENABLED_ENV]: 'false',
    },
    clerkAuth: clerkAuth ?? (async () => ({ isAuthenticated: false, userId: null })),
    clerkCurrentUser: clerkCurrentUser ?? vi.fn(),
    makeUserRef: () => 'u_test_ref',
    makeBillingRef: () => 'b_test_ref',
  });
}

function createRequest({ devActorUserId, devBrowserAuthUserId } = {}) {
  const headers = new Headers();

  if (devActorUserId) {
    headers.set(DEV_RELAY_ACTOR_USER_ID_HEADER, devActorUserId);
  }

  if (devBrowserAuthUserId) {
    headers.set('cookie', `${DEV_BROWSER_AUTH_USER_ID_COOKIE}=${encodeURIComponent(devBrowserAuthUserId)}`);
  }

  return new Request('http://127.0.0.1:3000/api/sender-resources', { headers });
}

function createMemoryAuthRepository(overrides = {}) {
  return {
    users: overrides.users ?? [createUser()],
    billingAccounts: overrides.billingAccounts ?? [
      {
        id: 'billing_1',
        billingRef: 'b1ref',
        ownerType: 'user',
        ownerId: 'user_1',
        status: 'active',
      },
    ],
    externalAuthAccounts: overrides.externalAuthAccounts ?? [
      createExternalAuthAccount({
        userId: 'user_1',
        providerAccountId: 'clerk_user_1',
        email: 'user@example.com',
      }),
    ],

    async getUserById(userId) {
      return this.users.find((user) => user.id === userId) ?? null;
    },

    async findUserByEmail(email) {
      return this.users.find((user) => user.email === email) ?? null;
    },

    async findExternalAuthAccount({ provider, providerAccountId }) {
      const account = this.externalAuthAccounts.find(
        (item) => item.provider === provider && item.providerAccountId === providerAccountId
      );

      if (!account) {
        return null;
      }

      return {
        account,
        user: await this.getUserById(account.userId),
      };
    },

    async findExternalAuthAccountByProviderEmail({ provider, email }) {
      const account = this.externalAuthAccounts.find((item) => item.provider === provider && item.email === email);

      if (!account) {
        return null;
      }

      return {
        account,
        user: await this.getUserById(account.userId),
      };
    },

    async createUserWithExternalAuthAccount({ user, billingAccount, externalAuthAccount }) {
      const createdUser = {
        id: `user_${this.users.length + 1}`,
        ...user,
      };
      const createdBillingAccount = {
        id: `billing_${this.billingAccounts.length + 1}`,
        ...billingAccount,
        ownerId: createdUser.id,
      };
      const createdExternalAuthAccount = {
        id: `external_${this.externalAuthAccounts.length + 1}`,
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
  };
}

function createConcurrentFirstLoginAuthRepository({ participants }) {
  const repository = createMemoryAuthRepository({
    users: [],
    billingAccounts: [],
    externalAuthAccounts: [],
  });
  const baseFindExternalAuthAccount = repository.findExternalAuthAccount.bind(repository);
  const baseFindUserByEmail = repository.findUserByEmail.bind(repository);
  const baseCreateUserWithExternalAuthAccount = repository.createUserWithExternalAuthAccount.bind(repository);
  let releaseInitialEmailLookups;
  let initialEmailLookups = 0;
  const allInitialEmailLookups = new Promise((resolve) => {
    releaseInitialEmailLookups = resolve;
  });

  repository.createAttempts = 0;
  repository.findExternalAuthAccountCalls = 0;
  repository.findExternalAuthAccount = async function findExternalAuthAccount(args) {
    this.findExternalAuthAccountCalls += 1;
    return baseFindExternalAuthAccount(args);
  };
  repository.findUserByEmail = async function findUserByEmail(email) {
    const existingUser = await baseFindUserByEmail(email);
    if (existingUser) {
      return existingUser;
    }

    initialEmailLookups += 1;
    if (initialEmailLookups === participants) {
      releaseInitialEmailLookups();
    }
    await allInitialEmailLookups;
    return null;
  };
  repository.createUserWithExternalAuthAccount = async function createUserWithExternalAuthAccount(args) {
    this.createAttempts += 1;

    if (this.users.some((user) => user.email === args.user.email)) {
      throw createUniqueConstraintError('users_email_unique');
    }
    if (
      this.externalAuthAccounts.some(
        (account) =>
          account.provider === args.externalAuthAccount.provider &&
          account.providerAccountId === args.externalAuthAccount.providerAccountId
      )
    ) {
      throw createUniqueConstraintError('external_auth_accounts_provider_account_unique');
    }

    return baseCreateUserWithExternalAuthAccount(args);
  };

  return repository;
}

function createUser(overrides = {}) {
  return {
    id: 'user_1',
    userRef: 'u1ref',
    email: 'user@example.com',
    name: 'User One',
    status: 'active',
    isOperator: false,
    ...overrides,
  };
}

function createUniqueConstraintError(constraint) {
  const error = new Error(`duplicate key violates unique constraint "${constraint}"`);
  error.code = '23505';
  error.constraint = constraint;
  return error;
}

function createExternalAuthAccount(overrides = {}) {
  return {
    id: 'external_1',
    userId: 'user_1',
    provider: AUTH_PROVIDERS.CLERK,
    providerAccountId: 'clerk_user_1',
    email: 'user@example.com',
    displayName: 'User One',
    ...overrides,
  };
}
