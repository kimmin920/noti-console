import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  activatePublClientRuntime,
  getIdentity,
  resetPublClientRuntime,
} from '../../features/publClient/runtimeSession.js';
import {
  clearPublClientRefreshTokenHandler,
  PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY,
  PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY,
  registerPublClientRefreshTokenHandler,
  setPublClientTokens,
} from '../../features/publClient/authToken.js';
import { publClientQueryKeys } from '../../features/publClient/queries.js';

describe('Publ client fresh document session identity', () => {
  afterEach(() => {
    clearPublClientRefreshTokenHandler();
    resetPublClientRuntime();
    vi.unstubAllGlobals();
  });

  it('rejects malformed local access tokens as runtime identity', () => {
    stubPublIframeWindow('/publ-client');
    vi.stubGlobal('sessionStorage', createSessionStorage({
      [PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY]: 'not-a-jwt',
      [PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY]: 'refresh-token',
    }));
    registerPublClientRefreshTokenHandler(async () => 'unused');

    expect(activatePublClientRuntime({ originPolicyConfigured: true })).toBe(false);
    expect(getIdentity()).toBeNull();
  });

  it('creates a new generation when merchant identity changes in the same document', () => {
    stubPublIframeWindow('/publ-client');
    vi.stubGlobal('sessionStorage', createSessionStorage({
      [PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY]: createAccessToken({ consumerId: 'merchant_a' }),
      [PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY]: 'refresh-token-a',
    }));
    registerPublClientRefreshTokenHandler(async () => 'unused');

    expect(activatePublClientRuntime({ originPolicyConfigured: true })).toBe(true);
    const merchantA = getIdentity();

    setPublClientTokens({
      accessToken: createAccessToken({
        consumerId: 'merchant_b',
        sessionId: 'session_b',
        userId: 'user_b',
      }),
      refreshToken: 'refresh-token-b',
    });
    expect(activatePublClientRuntime({ originPolicyConfigured: true })).toBe(true);
    const merchantB = getIdentity();

    expect(merchantA).toMatchObject({
      consumerId: 'merchant_a',
      sessionId: 'session_1',
      userId: 'user_1',
    });
    expect(merchantB).toMatchObject({
      consumerId: 'merchant_b',
      sessionId: 'session_b',
      userId: 'user_b',
    });
    expect(merchantB.generation).toBeGreaterThan(merchantA.generation);
    expect(publClientQueryKeys.memberContacts(merchantA)).not.toEqual(
      publClientQueryKeys.memberContacts(merchantB)
    );
  });

  it('keeps the Publ session boundary in layout rather than the search-param page', () => {
    const layoutSource = readFileSync(
      new URL('../../app/publ-client/layout.jsx', import.meta.url),
      'utf8'
    );
    const pageSource = readFileSync(
      new URL('../../app/publ-client/page.jsx', import.meta.url),
      'utf8'
    );

    expect(layoutSource).toContain('PublClientBootstrap');
    expect(pageSource).toContain('PublClientConsole');
    expect(pageSource).not.toContain('resolvePublPappClientConfigResult');
  });
});

function stubPublIframeWindow(pathname = '/publ-client') {
  const iframeWindow = {};
  iframeWindow.self = iframeWindow;
  iframeWindow.top = {};
  iframeWindow.location = { pathname };
  vi.stubGlobal('window', iframeWindow);
  return iframeWindow;
}

function createSessionStorage(initialValues = {}) {
  const store = new Map(Object.entries(initialValues));

  return {
    getItem: vi.fn((key) => store.get(key) ?? null),
    removeItem: vi.fn((key) => {
      store.delete(key);
    }),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value));
    }),
  };
}

function createAccessToken({
  consumerId = 'consumer_1',
  jti = 'access_jti_1',
  sessionId = 'session_1',
  userId = 'user_1',
} = {}) {
  return [
    encodeBase64Url({ alg: 'none', typ: 'JWT' }),
    encodeBase64Url({
      consumerId,
      jti,
      sessionId,
      userId,
    }),
    'signature',
  ].join('.');
}

function encodeBase64Url(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}
