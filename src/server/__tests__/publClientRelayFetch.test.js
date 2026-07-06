import { afterEach, describe, expect, it, vi } from 'vitest';

import { relayGet } from '../../features/console/messageSend/api.js';
import { PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY } from '../../features/publClient/authToken.js';

describe('Publ client relay fetch auth header', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches the Publ bearer token to local API calls when session storage has one', async () => {
    const fetchMock = stubRelayFetch();
    vi.stubGlobal('sessionStorage', createSessionStorage({
      [PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY]: ' local-access-token ',
    }));

    await relayGet('/api/me');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe('no-store');
    expect(init.headers).toBeInstanceOf(Headers);
    expect(init.headers.get('authorization')).toBe('Bearer local-access-token');
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
    vi.stubGlobal('sessionStorage', createSessionStorage({
      [PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY]: 'local-access-token',
    }));

    await relayGet('/integrations/exchange-token');

    const [, init] = fetchMock.mock.calls[0];
    expect(init).toEqual({ cache: 'no-store' });
  });
});

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
