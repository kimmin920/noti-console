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
import { isPublIframeContext } from '../../features/publClient/frameContext.js';

describe('Publ iframe client SDK adapter', () => {
  it('adapts the official PAppClientSDK seller-side pipeline', async () => {
    const sdkClient = {
      mount: vi.fn(async () => ({ data: { mounted: true } })),
      pipeline: {
        authorize: vi.fn(async () => ({ data: { authorized: true } })),
        request: vi.fn(async () => ({
          status: 'OK',
          data: {
            accessToken: 'official-access-token',
            refreshToken: 'official-refresh-token',
          },
        })),
      },
    };
    const source = {
      PAppClientSDK: {
        create: vi.fn(() => sdkClient),
      },
    };
    const clientConfig = createClientConfig();
    const adapter = resolvePublSdkAdapter({ clientConfig, source });

    await expect(adapter.mount()).resolves.toEqual({ data: { mounted: true } });
    await expect(adapter.authorize()).resolves.toEqual({ data: { authorized: true } });
    await expect(adapter.exchangeToken()).resolves.toMatchObject({
      data: {
        accessToken: 'official-access-token',
        refreshToken: 'official-refresh-token',
      },
    });
    await adapter.refreshToken({
      previousAccessToken: 'official-access-token',
      refreshToken: 'official-refresh-token',
    });
    await adapter.request('PM_CONTACTS', { limit: 2 });

    expect(source.PAppClientSDK.create).toHaveBeenCalledTimes(1);
    expect(source.PAppClientSDK.create).toHaveBeenCalledWith('SELLER_SIDE');
    expect(sdkClient.mount).toHaveBeenCalledWith({
      clientHash: 'client-hash',
      pAppCode: '3RD_A00003_TEST',
    });
    expect(sdkClient.pipeline.authorize).toHaveBeenCalledWith([
      'PM_00000_EXCHANGE_TOKEN',
      'PM_00000_REFRESH_TOKEN',
      'PM_SELLER_INFO',
      'PM_CONTACTS',
    ]);
    expect(sdkClient.pipeline.request).toHaveBeenNthCalledWith(1, 'PM_00000_EXCHANGE_TOKEN');
    expect(sdkClient.pipeline.request).toHaveBeenNthCalledWith(2, 'PM_00000_REFRESH_TOKEN');
    expect(sdkClient.pipeline.request).toHaveBeenNthCalledWith(3, 'PM_CONTACTS', { limit: 2 });
  });

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

  it('reuses a complete iframe session without exchanging another token', async () => {
    const storage = createSessionStorage({
      [PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY]: 'access-token',
      [PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY]: 'refresh-token',
    });
    const adapter = {
      authorize: vi.fn(),
      exchangeToken: vi.fn(),
      mount: vi.fn(async () => undefined),
      refreshToken: vi.fn(),
    };

    await expect(bootstrapPublClientSession({ adapter, storage })).resolves.toMatchObject({
      ok: true,
      resumed: true,
      status: 'ready',
    });

    expect(adapter.mount).toHaveBeenCalledTimes(1);
    expect(adapter.authorize).toHaveBeenCalledTimes(1);
    expect(adapter.exchangeToken).not.toHaveBeenCalled();
  });

  it('distinguishes iframe and top-level browser contexts', () => {
    const topLevelWindow = {};
    topLevelWindow.self = topLevelWindow;
    topLevelWindow.top = topLevelWindow;
    const parentWindow = {};
    const iframeWindow = { self: null, top: parentWindow };
    iframeWindow.self = iframeWindow;

    expect(isPublIframeContext(topLevelWindow)).toBe(false);
    expect(isPublIframeContext(iframeWindow)).toBe(true);
    expect(isPublIframeContext(null)).toBe(false);
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
        request: vi.fn(async (permissionId, payload) => ({
          data: {
            payload,
            permissionId,
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
    await expect(adapter.request('PM_CONTACTS', { limit: 2 })).resolves.toEqual({
      data: {
        payload: { limit: 2 },
        permissionId: 'PM_CONTACTS',
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

function createClientConfig() {
  return {
    authorizationPermissionIds: [
      'PM_00000_EXCHANGE_TOKEN',
      'PM_00000_REFRESH_TOKEN',
      'PM_SELLER_INFO',
      'PM_CONTACTS',
    ],
    clientHash: 'client-hash',
    pAppCode: '3RD_A00003_TEST',
    permissions: {
      exchangeToken: 'PM_00000_EXCHANGE_TOKEN',
      memberContacts: 'PM_CONTACTS',
      refreshToken: 'PM_00000_REFRESH_TOKEN',
      sellerBusinessInformation: 'PM_SELLER_INFO',
    },
  };
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

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
