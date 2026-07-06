import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { PublClientStatusView } from '../../features/publClient/PublClientBootstrap.jsx';
import {
  bootstrapPublClientSession,
  PUBL_CLIENT_ADAPTER_GLOBAL,
  refreshPublClientSession,
  resolvePublSdkAdapter,
} from '../../features/publClient/sdkAdapter.js';
import {
  PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY,
  PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY,
} from '../../features/publClient/authToken.js';

describe('Publ iframe client SDK adapter', () => {
  it('stores exchanged tokens through the iframe session token provider', async () => {
    const storage = createSessionStorage();
    const adapter = {
      authorize: vi.fn(async () => undefined),
      exchangeToken: vi.fn(async () => ({
        data: {
          accessToken: ' access-token ',
          refreshToken: ' refresh-token ',
        },
      })),
      mount: vi.fn(async () => undefined),
      refreshToken: vi.fn(),
    };

    await expect(bootstrapPublClientSession({ adapter, storage })).resolves.toMatchObject({
      ok: true,
      status: 'ready',
    });

    expect(adapter.mount).toHaveBeenCalledTimes(1);
    expect(adapter.authorize).toHaveBeenCalledTimes(1);
    expect(adapter.exchangeToken).toHaveBeenCalledTimes(1);
    expect(storage.getItem(PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY)).toBe('access-token');
    expect(storage.getItem(PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY)).toBe('refresh-token');
  });

  it('returns a safe unavailable state when no SDK adapter exists', async () => {
    const storage = createSessionStorage();

    expect(resolvePublSdkAdapter({ source: {} })).toBeNull();
    await expect(bootstrapPublClientSession({ adapter: null, storage })).resolves.toMatchObject({
      ok: false,
      status: 'unavailable',
    });
    expect(storage.getItem(PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY)).toBeNull();
    expect(storage.getItem(PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY)).toBeNull();
  });

  it('renders the missing-SDK state without Clerk login controls', () => {
    const html = renderToStaticMarkup(createElement(PublClientStatusView, {
      onRetry: () => {},
      state: {
        message: 'Publ SDK가 아직 로드되지 않았습니다.',
        status: 'unavailable',
        title: 'iframe 연결을 사용할 수 없습니다',
      },
    }));

    expect(html).toContain('iframe 연결을 사용할 수 없습니다');
    expect(html).toContain('다시 시도');
    expect(html).not.toContain('로그인');
    expect(html).not.toContain('가입');
  });

  it('adapts an injected SDK boundary without relying on postMessage', async () => {
    const source = {
      [PUBL_CLIENT_ADAPTER_GLOBAL]: {
        exchangeToken: vi.fn(async () => ({
          data: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          },
        })),
        refreshToken: vi.fn(async () => ({
          data: {
            accessToken: 'new-access-token',
          },
        })),
      },
    };
    const adapter = resolvePublSdkAdapter({ source });

    await expect(adapter.exchangeToken()).resolves.toEqual({
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    });
    await expect(adapter.refreshToken({
      previousAccessToken: 'access-token',
      refreshToken: 'refresh-token',
    })).resolves.toEqual({
      data: {
        accessToken: 'new-access-token',
      },
    });
  });

  it('clears stored tokens when refresh fails', async () => {
    const storage = createSessionStorage({
      [PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY]: 'old-access-token',
      [PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY]: 'refresh-token',
    });
    const adapter = {
      refreshToken: vi.fn(async () => {
        throw new Error('refresh failed');
      }),
    };

    await expect(refreshPublClientSession({
      adapter,
      previousAccessToken: 'old-access-token',
      refreshToken: 'refresh-token',
      storage,
    })).rejects.toThrow('refresh failed');

    expect(storage.getItem(PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY)).toBeNull();
    expect(storage.getItem(PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY)).toBeNull();
  });

  it('keeps /publ-client on the iframe entry and standalone routes on ConsoleRoute', () => {
    const publRouteSource = readSource('../../app/publ-client/page.jsx');
    const publClientSource = readSource('../../features/publClient/PublClientBootstrap.jsx');
    const sdkAdapterSource = readSource('../../features/publClient/sdkAdapter.js');
    const messageSendRouteSource = readSource('../../app/message-send/page.jsx');

    expect(publRouteSource).toContain('PublClientBootstrap');
    expect(publRouteSource).not.toContain('LandingAuthControls');
    expect(publClientSource).toContain('mode="embed"');
    expect(publClientSource).toContain('hideAccountControl');
    expect(`${publClientSource}\n${sdkAdapterSource}`).not.toContain('postMessage');
    expect(messageSendRouteSource).toContain('<ConsoleRoute pageId="emails"');
    expect(messageSendRouteSource).not.toContain('PublClientBootstrap');
  });
});

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

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
