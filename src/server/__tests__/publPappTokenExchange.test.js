import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { createPublPappSessionRepository } from '../publPapp/repository.js';
import {
  createPublPappTokenExchangeService,
} from '../publPapp/tokenExchangeService.js';
import {
  PUBL_PAPP_TOKEN_CONSTANTS,
  hashPublPappRefreshToken,
  signHmacJwt,
  verifyLocalAccessToken,
} from '../publPapp/tokens.js';
import {
  handlePublPappExchangeTokenRequest,
  handlePublPappRefreshTokenRequest,
} from '../publPapp/tokenExchangeRoute.js';

const EXCHANGE_URL = 'http://localhost/integrations/exchange-token';
const REFRESH_URL = 'http://localhost/integrations/refresh-token';
const FIXED_NOW = new Date('2026-07-06T00:00:00.000Z');
const CONFIG = Object.freeze({
  credentials: Object.freeze([
    Object.freeze({
      outgoingApiKey: 'publ-test-api-key',
      outgoingSecretKey: 'publ-test-outgoing-secret',
      pAppCode: '3RD_A00003_TEST',
      stage: 'test',
    }),
  ]),
  tokenSecrets: Object.freeze({
    accessTokenSecret: 'vizuo-local-access-secret',
    refreshTokenHashSecret: 'vizuo-local-refresh-hash-secret',
  }),
});

describe('Publ PApp token exchange endpoints', () => {
  it('exchanges a valid Publ JWT for local access and refresh tokens', async () => {
    const harness = createExchangeHarness({
      accessTokenJtis: ['access_jti_1'],
      refreshTokens: ['refresh_token_1'],
    });
    const response = await callExchange({
      harness,
      jwt: createPublJwt(),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: {
        accessToken: expect.any(String),
        refreshToken: 'refresh_token_1',
      },
    });

    const accessPayload = verifyLocalAccessToken(body.data.accessToken, {
      now: () => FIXED_NOW,
      secret: CONFIG.tokenSecrets.accessTokenSecret,
    });

    expect(accessPayload).toMatchObject({
      channelCode: 'STORE_1',
      consumerId: 'consumer_1',
      jti: 'access_jti_1',
      pAppCode: '3RD_A00003_TEST',
      sub: 'Consumer:consumer_1',
      userId: 'user_1',
    });
    expect(harness.store.sessions[0]).toMatchObject({
      accessTokenJti: 'access_jti_1',
      channelCode: 'STORE_1',
      consumerId: 'consumer_1',
      refreshTokenHash: hashPublPappRefreshToken(
        'refresh_token_1',
        CONFIG.tokenSecrets.refreshTokenHashSecret
      ),
    });
    expect(JSON.stringify(harness.store)).not.toContain('refresh_token_1');
  });

  it('creates and updates the channelCode mapping used by Publ automation events', async () => {
    const harness = createExchangeHarness({
      accessTokenJtis: ['access_jti_1', 'access_jti_2'],
      refreshTokens: ['refresh_token_1', 'refresh_token_2'],
    });

    await callExchange({
      harness,
      jwt: createPublJwt({
        claim: {
          consumerId: 'consumer_1',
          channelCode: 'SHARED_STORE',
        },
      }),
    });
    await callExchange({
      harness,
      jwt: createPublJwt({
        claim: {
          consumerId: 'consumer_2',
          channelCode: 'SHARED_STORE',
        },
      }),
    });

    expect(harness.store.sessions).toHaveLength(2);
    expect(harness.store.channelMappings).toHaveLength(1);
    expect(harness.store.channelMappings[0]).toMatchObject({
      channelCode: 'SHARED_STORE',
      externalBusinessRef: 'consumer_2',
      status: 'active',
      userId: 'user_2',
    });
  });

  it('rejects invalid api keys', async () => {
    const harness = createExchangeHarness();
    const response = await callExchange({
      apiKey: 'wrong-api-key',
      harness,
      jwt: createPublJwt(),
    });

    await expectSafeError(response, 401, 'UNAUTHORIZED', 'Invalid api key or token');
  });

  it('keeps submitted api keys and Publ JWTs out of exchange error responses', async () => {
    const harness = createExchangeHarness();
    const submittedApiKey = 'wrong-api-key-that-must-not-echo';
    const submittedJwt = createPublJwt();
    const response = await callExchange({
      apiKey: submittedApiKey,
      harness,
      jwt: submittedJwt,
    });
    const bodyText = JSON.stringify(await response.json());

    expect(response.status).toBe(401);
    expect(bodyText).toContain('Invalid api key or token');
    expect(bodyText).not.toContain(submittedApiKey);
    expect(bodyText).not.toContain(submittedJwt);
  });

  it('rejects invalid Publ JWT signatures', async () => {
    const harness = createExchangeHarness();
    const response = await callExchange({
      harness,
      jwt: createPublJwt({ secret: 'wrong-secret' }),
    });

    await expectSafeError(response, 401, 'UNAUTHORIZED', 'Invalid api key or token');
  });

  it('rejects wrong Publ JWT issuer', async () => {
    const harness = createExchangeHarness();
    const response = await callExchange({
      harness,
      jwt: createPublJwt({
        payload: {
          iss: 'wrong-issuer',
        },
      }),
    });

    await expectSafeError(response, 401, 'UNAUTHORIZED', 'Invalid api key or token');
  });

  it('rejects wrong Publ JWT subject', async () => {
    const harness = createExchangeHarness();
    const response = await callExchange({
      harness,
      jwt: createPublJwt({
        payload: {
          sub: 'Consumer:other_consumer',
        },
      }),
    });

    await expectSafeError(response, 401, 'UNAUTHORIZED', 'Invalid api key or token');
  });

  it('rejects expired Publ JWTs', async () => {
    const harness = createExchangeHarness();
    const response = await callExchange({
      harness,
      jwt: createPublJwt({
        payload: {
          exp: Math.floor(FIXED_NOW.getTime() / 1000) - 1,
        },
      }),
    });

    await expectSafeError(response, 401, 'UNAUTHORIZED', 'Invalid api key or token');
  });

  it('rejects Publ JWT claims whose pAppCode does not match the selected api key credential', async () => {
    const harness = createExchangeHarness();
    const response = await callExchange({
      harness,
      jwt: createPublJwt({
        claim: {
          pAppCode: '3RD_A00003',
        },
      }),
    });

    await expectSafeError(response, 403, 'FORBIDDEN', 'Token ownership mismatch');
  });

  it('refreshes a valid session with the previous access token but does not rotate refresh token output', async () => {
    const harness = createExchangeHarness({
      accessTokenJtis: ['access_jti_1', 'access_jti_2'],
      refreshTokens: ['refresh_token_1'],
    });
    const exchangeResponse = await callExchange({
      harness,
      jwt: createPublJwt(),
    });
    const exchangeBody = await exchangeResponse.json();
    const refreshResponse = await callRefresh({
      body: {
        previousAccessToken: exchangeBody.data.accessToken,
        refreshToken: exchangeBody.data.refreshToken,
      },
      harness,
      jwt: createPublJwt(),
    });
    const refreshBody = await refreshResponse.json();

    expect(refreshResponse.status).toBe(200);
    expect(refreshBody).toEqual({
      data: {
        accessToken: expect.any(String),
      },
    });
    expect(refreshBody.data.refreshToken).toBeUndefined();
    expect(verifyLocalAccessToken(refreshBody.data.accessToken, {
      now: () => FIXED_NOW,
      secret: CONFIG.tokenSecrets.accessTokenSecret,
    })).toMatchObject({
      consumerId: 'consumer_1',
      jti: 'access_jti_2',
      sessionId: 'session_1',
    });
    expect(harness.store.sessions[0]).toMatchObject({
      accessTokenJti: 'access_jti_2',
      refreshTokenHash: hashPublPappRefreshToken(
        'refresh_token_1',
        CONFIG.tokenSecrets.refreshTokenHashSecret
      ),
    });
  });

  it('rejects the previous local token pair after the same consumer exchanges again', async () => {
    const harness = createExchangeHarness({
      accessTokenJtis: ['access_jti_1', 'access_jti_2'],
      refreshTokens: ['refresh_token_1', 'refresh_token_2'],
    });
    const firstExchange = await callExchange({
      harness,
      jwt: createPublJwt(),
    });
    const firstBody = await firstExchange.json();
    const secondExchange = await callExchange({
      harness,
      jwt: createPublJwt(),
    });
    const secondBody = await secondExchange.json();

    expect(harness.store.sessions).toHaveLength(1);
    expect(harness.store.sessions[0]).toMatchObject({
      accessTokenJti: 'access_jti_2',
      refreshTokenHash: hashPublPappRefreshToken(
        'refresh_token_2',
        CONFIG.tokenSecrets.refreshTokenHashSecret
      ),
    });
    expect(verifyLocalAccessToken(firstBody.data.accessToken, {
      now: () => FIXED_NOW,
      secret: CONFIG.tokenSecrets.accessTokenSecret,
    })).toMatchObject({ jti: 'access_jti_1' });
    expect(verifyLocalAccessToken(secondBody.data.accessToken, {
      now: () => FIXED_NOW,
      secret: CONFIG.tokenSecrets.accessTokenSecret,
    })).toMatchObject({ jti: 'access_jti_2' });

    const refreshWithOldPair = await callRefresh({
      body: {
        previousAccessToken: firstBody.data.accessToken,
        refreshToken: firstBody.data.refreshToken,
      },
      harness,
      jwt: createPublJwt(),
    });

    await expectSafeError(refreshWithOldPair, 401, 'UNAUTHORIZED', 'Invalid api key or token');
  });

  it('rejects refresh requests with missing refresh body fields', async () => {
    const harness = createExchangeHarness();
    const response = await callRefresh({
      body: {
        refreshToken: 'refresh_token_1',
      },
      harness,
      jwt: createPublJwt(),
    });

    await expectSafeError(response, 400, 'BAD_REQUEST', 'Request body is invalid');
  });

  it('rejects a refresh token that belongs to another Publ consumer', async () => {
    const harness = createExchangeHarness({
      accessTokenJtis: ['access_jti_1', 'access_jti_2'],
      refreshTokens: ['refresh_token_1', 'refresh_token_2'],
    });
    const consumerOne = await callExchange({
      harness,
      jwt: createPublJwt({
        claim: {
          consumerId: 'consumer_1',
          channelCode: 'STORE_1',
        },
      }),
    });
    const consumerTwo = await callExchange({
      harness,
      jwt: createPublJwt({
        claim: {
          consumerId: 'consumer_2',
          channelCode: 'STORE_2',
        },
      }),
    });
    const consumerOneBody = await consumerOne.json();
    const consumerTwoBody = await consumerTwo.json();
    const response = await callRefresh({
      body: {
        previousAccessToken: consumerOneBody.data.accessToken,
        refreshToken: consumerTwoBody.data.refreshToken,
      },
      harness,
      jwt: createPublJwt({
        claim: {
          consumerId: 'consumer_1',
          channelCode: 'STORE_1',
        },
      }),
    });

    await expectSafeError(response, 401, 'UNAUTHORIZED', 'Invalid api key or token');
  });

  it('rejects previous access tokens from another session', async () => {
    const harness = createExchangeHarness({
      accessTokenJtis: ['access_jti_1', 'access_jti_2'],
      refreshTokens: ['refresh_token_1', 'refresh_token_2'],
    });
    const consumerOne = await callExchange({
      harness,
      jwt: createPublJwt({
        claim: {
          consumerId: 'consumer_1',
          channelCode: 'STORE_1',
        },
      }),
    });
    const consumerTwo = await callExchange({
      harness,
      jwt: createPublJwt({
        claim: {
          consumerId: 'consumer_2',
          channelCode: 'STORE_2',
        },
      }),
    });
    const consumerOneBody = await consumerOne.json();
    const consumerTwoBody = await consumerTwo.json();
    const response = await callRefresh({
      body: {
        previousAccessToken: consumerTwoBody.data.accessToken,
        refreshToken: consumerOneBody.data.refreshToken,
      },
      harness,
      jwt: createPublJwt({
        claim: {
          consumerId: 'consumer_1',
          channelCode: 'STORE_1',
        },
      }),
    });

    await expectSafeError(response, 403, 'FORBIDDEN', 'Token ownership mismatch');
  });

  it('keeps local access and refresh tokens out of refresh error responses', async () => {
    const harness = createExchangeHarness({
      accessTokenJtis: ['access_jti_1'],
      refreshTokens: ['refresh_token_1'],
    });
    const exchangeResponse = await callExchange({
      harness,
      jwt: createPublJwt(),
    });
    const exchangeBody = await exchangeResponse.json();
    const submittedPreviousAccessToken = `${exchangeBody.data.accessToken}.tampered`;
    const submittedRefreshToken = exchangeBody.data.refreshToken;
    const response = await callRefresh({
      body: {
        previousAccessToken: submittedPreviousAccessToken,
        refreshToken: submittedRefreshToken,
      },
      harness,
      jwt: createPublJwt(),
    });
    const bodyText = JSON.stringify(await response.json());

    expect(response.status).toBe(403);
    expect(bodyText).toContain('Token ownership mismatch');
    expect(bodyText).not.toContain(submittedPreviousAccessToken);
    expect(bodyText).not.toContain(submittedRefreshToken);
  });

  it('keeps fixed integration route files on node runtime and outside relayRoute envelopes', async () => {
    const exchangeRoute = await readFile(
      new URL('../../app/integrations/exchange-token/route.js', import.meta.url),
      'utf8'
    );
    const refreshRoute = await readFile(
      new URL('../../app/integrations/refresh-token/route.js', import.meta.url),
      'utf8'
    );

    for (const routeSource of [exchangeRoute, refreshRoute]) {
      expect(routeSource).toContain("export const runtime = 'nodejs'");
      expect(routeSource).not.toContain('relayRoute');
      expect(routeSource).not.toContain('relaySuccess');
    }
  });
});

async function callExchange({
  apiKey = 'publ-test-api-key',
  harness,
  jwt,
}) {
  return handlePublPappExchangeTokenRequest({
    request: new Request(`${EXCHANGE_URL}?apiKey=${apiKey}`, {
      body: '{}',
      headers: {
        authorization: `Bearer ${jwt}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    }),
    service: harness.service,
  });
}

async function callRefresh({
  apiKey = 'publ-test-api-key',
  body,
  harness,
  jwt,
}) {
  return handlePublPappRefreshTokenRequest({
    request: new Request(`${REFRESH_URL}?apiKey=${apiKey}`, {
      body: JSON.stringify(body),
      headers: {
        authorization: `Bearer ${jwt}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    }),
    service: harness.service,
  });
}

async function expectSafeError(response, status, code, message) {
  const bodyText = JSON.stringify(await response.json());

  expect(response.status).toBe(status);
  expect(JSON.parse(bodyText)).toEqual({
    error: {
      code,
      message,
    },
  });
  expect(bodyText).not.toContain('publ-test-outgoing-secret');
  expect(bodyText).not.toContain('vizuo-local-access-secret');
  expect(bodyText).not.toContain('vizuo-local-refresh-hash-secret');
  expect(bodyText).not.toContain('refresh_token_');
}

function createPublJwt({
  claim = {},
  payload = {},
  secret = CONFIG.credentials[0].outgoingSecretKey,
} = {}) {
  const resolvedClaim = {
    channelCode: 'STORE_1',
    channelId: 123,
    consumerId: 'consumer_1',
    distinctId: 'seller_profile_1',
    installedPAppId: 456,
    pAppCode: '3RD_A00003_TEST',
    role: 'OWNER',
    ...claim,
  };
  const resolvedPayload = {
    claim: resolvedClaim,
    iss: PUBL_PAPP_TOKEN_CONSTANTS.PUBL_JWT_ISSUER,
    sub: `Consumer:${resolvedClaim.consumerId}`,
    ...payload,
  };
  const options = {
    now: () => FIXED_NOW,
    secret,
  };

  if (!Object.hasOwn(resolvedPayload, 'exp')) {
    options.expiresInSeconds = 900;
  }

  return signHmacJwt(resolvedPayload, options);
}

function createExchangeHarness({
  accessTokenJtis = ['access_jti_1', 'access_jti_2', 'access_jti_3'],
  refreshTokens = ['refresh_token_1', 'refresh_token_2', 'refresh_token_3'],
} = {}) {
  const store = createMemoryPublPappStore();
  const repository = createPublPappSessionRepository(null, {
    makeBillingRef: () => `b_publ_${store.billingAccounts.length + 1}`,
    makeUserRef: () => `u_publ_${store.users.length + 1}`,
    store,
  });
  let accessTokenJtiIndex = 0;
  let refreshTokenIndex = 0;
  const service = createPublPappTokenExchangeService({
    config: CONFIG,
    makeAccessTokenJti: () => accessTokenJtis[accessTokenJtiIndex++] ?? `access_jti_${accessTokenJtiIndex}`,
    makeRefreshToken: () => refreshTokens[refreshTokenIndex++] ?? `refresh_token_${refreshTokenIndex}`,
    now: () => FIXED_NOW,
    repository,
  });

  return {
    service,
    store,
  };
}

function createMemoryPublPappStore() {
  return {
    billingAccounts: [],
    channelMappings: [],
    externalAuthAccounts: [],
    sessions: [],
    users: [],

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

    async createPublUserWithBillingAndAccount({ billingAccount, externalAuthAccount, user }) {
      const createdUser = {
        id: `user_${this.users.length + 1}`,
        ...user,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
      };
      const createdBillingAccount = {
        id: `billing_${this.billingAccounts.length + 1}`,
        ...billingAccount,
        createdAt: FIXED_NOW,
        ownerId: createdUser.id,
        updatedAt: FIXED_NOW,
      };
      const createdExternalAuthAccount = {
        id: `external_${this.externalAuthAccounts.length + 1}`,
        ...externalAuthAccount,
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
        userId: createdUser.id,
      };

      this.users.push(createdUser);
      this.billingAccounts.push(createdBillingAccount);
      this.externalAuthAccounts.push(createdExternalAuthAccount);

      return {
        billingAccount: createdBillingAccount,
        externalAuthAccount: createdExternalAuthAccount,
        user: createdUser,
      };
    },

    async upsertSession(values) {
      const existing = this.sessions.find((session) => session.consumerId === values.consumerId);
      if (existing) {
        Object.assign(existing, values);
        return existing;
      }

      const session = {
        id: `session_${this.sessions.length + 1}`,
        ...values,
        createdAt: FIXED_NOW,
      };
      this.sessions.push(session);
      return session;
    },

    async upsertChannelMapping(values) {
      const existing = this.channelMappings.find((mapping) => mapping.channelCode === values.channelCode);
      if (existing) {
        Object.assign(existing, values);
        return existing;
      }

      const mapping = {
        id: `mapping_${this.channelMappings.length + 1}`,
        ...values,
        createdAt: FIXED_NOW,
      };
      this.channelMappings.push(mapping);
      return mapping;
    },

    async findActiveSessionByRefreshToken({ consumerId, now, refreshTokenHash }) {
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

    async expireSessionRefreshToken({ consumerId, now, refreshTokenHash }) {
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
