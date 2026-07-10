import { afterEach, describe, expect, it, vi } from 'vitest';

import PublClientLayout from '../../app/publ-client/layout.jsx';
import PublClientCatchAllPage from '../../app/publ-client/[[...path]]/page.jsx';
import { PublClientBootstrap } from '../../features/publClient/PublClientBootstrap.jsx';
import { PublClientRouteEntry } from '../../features/publClient/PublClientRouteEntry.jsx';
import {
  activatePublClientRuntime,
  getIdentity,
  getPublClientRuntimeGeneration,
  resetPublClientRuntime,
} from '../../features/publClient/runtimeSession.js';
import {
  clearPublClientRefreshTokenHandler,
  getPublClientTokens,
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

  it('renders changing catch-all routes inside one layout-owned session boundary', async () => {
    const messageSendPage = await renderCatchAllPage(['message-send']);
    const logDetailPage = await renderCatchAllPage(['logs', 'group-1']);
    const layout = await PublClientLayout({ children: messageSendPage });

    expect(layout.type).toBe(PublClientBootstrap);
    expect(layout.props.children).toBe(messageSendPage);
    expect(messageSendPage.type).toBe(PublClientRouteEntry);
    expect(logDetailPage.type).toBe(PublClientRouteEntry);
    expect(messageSendPage.props).toEqual({
      routeResult: expect.objectContaining({ ok: true, pageId: 'emails' }),
    });
    expect(logDetailPage.props).toEqual({
      routeResult: expect.objectContaining({
        ok: true,
        pageId: 'log-detail',
        pageProps: { logDetail: { groupId: 'group-1' } },
      }),
    });
  });

  it('retains the runtime generation and exchanged token pair across nested paths', () => {
    const iframeWindow = stubPublIframeWindow('/publ-client/message-send');
    const accessToken = createAccessToken();
    const storage = createSessionStorage({
      [PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY]: accessToken,
      [PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY]: 'refresh-token',
    });
    vi.stubGlobal('sessionStorage', storage);
    registerPublClientRefreshTokenHandler(async () => 'unused');

    expect(activatePublClientRuntime({ originPolicyConfigured: true })).toBe(true);
    const generation = getPublClientRuntimeGeneration();
    const tokens = getPublClientTokens();

    iframeWindow.location.pathname = '/publ-client/logs/group-1';

    expect(getIdentity()).toMatchObject({ generation });
    expect(getPublClientRuntimeGeneration()).toBe(generation);
    expect(getPublClientTokens()).toEqual(tokens);
  });

  it('deactivates an existing runtime when the document is no longer framed', () => {
    const iframeWindow = stubPublIframeWindow('/publ-client/message-send');
    vi.stubGlobal('sessionStorage', createSessionStorage({
      [PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY]: createAccessToken(),
      [PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY]: 'refresh-token',
    }));
    registerPublClientRefreshTokenHandler(async () => 'unused');

    expect(activatePublClientRuntime({ originPolicyConfigured: true })).toBe(true);
    iframeWindow.top = iframeWindow;

    expect(getIdentity()).toBeNull();
    expect(getPublClientRuntimeGeneration()).toBeNull();
  });
});

function renderCatchAllPage(path) {
  return PublClientCatchAllPage({
    params: Promise.resolve({ path }),
    searchParams: Promise.resolve({}),
  });
}

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
