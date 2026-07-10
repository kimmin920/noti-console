import { afterEach, describe, expect, it, vi } from 'vitest';

import { relayGet } from '../../features/console/messageSend/api.js';
import {
  activatePublClientRuntime,
  resetPublClientRuntime,
} from '../../features/publClient/runtimeSession.js';
import {
  clearPublClientRefreshTokenHandler,
  PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY,
  PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY,
  registerPublClientRefreshTokenHandler,
  setPublClientTokens,
} from '../../features/publClient/authToken.js';

describe('Publ client relay fetch auth header', () => {
  afterEach(() => {
    clearPublClientRefreshTokenHandler();
    resetPublClientRuntime();
    vi.unstubAllGlobals();
  });

  it('attaches Publ auth headers only when the Publ runtime is active for the current path', async () => {
    const fetchMock = stubRelayFetch();
    stubPublIframeWindow('/publ-client');
    vi.stubGlobal('sessionStorage', createSessionStorage({
      [PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY]: ' local-access-token ',
      [PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY]: 'refresh-token',
    }));
    registerPublClientRefreshTokenHandler(async () => 'new-token');
    activatePublClientRuntime({ originPolicyConfigured: true });

    await relayGet('/api/me');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe('no-store');
    expect(init.headers).toBeInstanceOf(Headers);
    expect(init.headers.get('authorization')).toBe('Bearer local-access-token');
    expect(init.headers.get('x-noti-auth-context')).toBe('publ-client');
  });

  it('does not attach Authorization when no Publ token is available', async () => {
    const fetchMock = stubRelayFetch();
    vi.stubGlobal('sessionStorage', createSessionStorage());

    await relayGet('/api/me');

    const [, init] = fetchMock.mock.calls[0];
    expect(init).toEqual({ cache: 'no-store' });
  });

  it('does not attach Publ Authorization to non-API requests', async () => {
    const fetchMock = stubRelayFetch();
    stubPublIframeWindow('/publ-client');
    vi.stubGlobal('sessionStorage', createSessionStorage({
      [PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY]: 'local-access-token',
    }));

    await relayGet('/integrations/exchange-token');

    const [, init] = fetchMock.mock.calls[0];
    expect(init).toEqual({ cache: 'no-store' });
  });

  it('uses the Publ SDK refresh handler and retries one expired local API request', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token expired.',
          source: 'relay',
        },
      }), {
        headers: { 'content-type': 'application/json' },
        status: 401,
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        data: { user: { id: 'user_1' } },
      }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }));
    vi.stubGlobal('fetch', fetchMock);
    stubPublIframeWindow('/publ-client');
    vi.stubGlobal('sessionStorage', createSessionStorage({
      [PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY]: 'old-access-token',
      [PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY]: 'refresh-token',
    }));
    registerPublClientRefreshTokenHandler(async ({ previousAccessToken, refreshToken }) => {
      expect(previousAccessToken).toBe('old-access-token');
      expect(refreshToken).toBe('refresh-token');
      setPublClientTokens({ accessToken: 'new-access-token' });
      return 'new-access-token';
    });
    activatePublClientRuntime({ originPolicyConfigured: true });

    await expect(relayGet('/api/me')).resolves.toEqual({ user: { id: 'user_1' } });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers.get('authorization')).toBe('Bearer old-access-token');
    expect(fetchMock.mock.calls[1][1].headers.get('authorization')).toBe('Bearer new-access-token');
    expect(fetchMock.mock.calls[1][1].headers.get('x-noti-auth-context')).toBe('publ-client');
  });

  it('does not attach stale Publ tokens from a framed standalone route', async () => {
    const fetchMock = stubRelayFetch();
    stubPublIframeWindow('/message-send');
    vi.stubGlobal('sessionStorage', createSessionStorage({
      [PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY]: 'stale-publ-token',
      [PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY]: 'stale-refresh-token',
    }));

    await relayGet('/api/me');

    const [, init] = fetchMock.mock.calls[0];
    expect(init).toEqual({ cache: 'no-store' });
  });

  it('stops attaching and refreshing when an active document leaves the Publ path', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized.', source: 'relay' },
    }), {
      headers: { 'content-type': 'application/json' },
      status: 401,
    }));
    vi.stubGlobal('fetch', fetchMock);
    const iframeWindow = stubPublIframeWindow('/publ-client');
    vi.stubGlobal('sessionStorage', createSessionStorage({
      [PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY]: 'old-access-token',
      [PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY]: 'refresh-token',
    }));
    const refreshHandler = vi.fn(async () => 'new-access-token');
    registerPublClientRefreshTokenHandler(refreshHandler);
    activatePublClientRuntime({ originPolicyConfigured: true });
    iframeWindow.location.pathname = '/message-send';

    await expect(relayGet('/api/me')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toEqual({ cache: 'no-store' });
    expect(refreshHandler).not.toHaveBeenCalled();
  });

  it('does not attach a stored Publ token from a top-level standalone window', async () => {
    const fetchMock = stubRelayFetch();
    const topLevelWindow = {};
    topLevelWindow.self = topLevelWindow;
    topLevelWindow.top = topLevelWindow;
    vi.stubGlobal('window', topLevelWindow);
    vi.stubGlobal('sessionStorage', createSessionStorage({
      [PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY]: 'stale-publ-token',
    }));

    await relayGet('/api/me');

    const [, init] = fetchMock.mock.calls[0];
    expect(init).toEqual({ cache: 'no-store' });
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

function stubRelayFetch() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    ok: true,
    data: { ok: true },
  }), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
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
