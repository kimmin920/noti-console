import {
  clearPublClientTokens,
  setPublClientTokens,
} from './authToken.js';

export const PUBL_CLIENT_ADAPTER_GLOBAL = '__VIZUO_PUBL_SDK_ADAPTER__';

const PUBL_SDK_GLOBAL_CANDIDATES = [
  '__VIZUO_PUBL_SDK__',
  'Publ',
  'PublSDK',
  'PublPApp',
  'publ',
  'publSdk',
];

export function resolvePublSdkAdapter({ source = getGlobalSource() } = {}) {
  const injectedAdapter = normalizeDirectAdapter(source?.[PUBL_CLIENT_ADAPTER_GLOBAL]);

  if (injectedAdapter) {
    return injectedAdapter;
  }

  for (const key of PUBL_SDK_GLOBAL_CANDIDATES) {
    const adapter = createPublSdkAdapter(source?.[key]);

    if (adapter) {
      return adapter;
    }
  }

  return null;
}

export async function bootstrapPublClientSession({ adapter, storage } = {}) {
  if (!adapter) {
    return {
      ok: false,
      status: 'unavailable',
      title: 'iframe 연결을 사용할 수 없습니다',
      message: 'Publ SDK가 아직 로드되지 않았습니다. Seller Console 안에서 다시 열거나 연결을 재시도해 주세요.',
    };
  }

  try {
    await adapter.mount?.();
    await adapter.authorize?.();

    const tokens = getPublExchangeTokens(await adapter.exchangeToken());
    setPublClientTokens(tokens, { storage });

    return {
      ok: true,
      status: 'ready',
      title: '연결되었습니다',
      message: '',
    };
  } catch {
    clearPublClientTokens({ storage });

    return {
      ok: false,
      status: 'error',
      title: '세션을 시작하지 못했습니다',
      message: 'iframe 연결을 확인한 뒤 다시 시도해 주세요.',
    };
  }
}

export async function refreshPublClientSession({
  adapter,
  previousAccessToken,
  refreshToken,
  storage,
} = {}) {
  if (!adapter) {
    clearPublClientTokens({ storage });
    throw new Error('Publ SDK adapter is unavailable.');
  }

  try {
    await adapter.authorize?.();

    const accessToken = getPublRefreshAccessToken(await adapter.refreshToken({
      previousAccessToken,
      refreshToken,
    }));

    setPublClientTokens({ accessToken }, { storage });
    return accessToken;
  } catch (error) {
    clearPublClientTokens({ storage });
    throw error;
  }
}

export function getPublClientPageHref({ pageId }) {
  const normalizedPageId = String(pageId ?? '').trim();

  if (!normalizedPageId || normalizedPageId === 'emails' || normalizedPageId === 'message-send') {
    return '/publ-client';
  }

  const params = new URLSearchParams({ page: normalizedPageId });
  return `/publ-client?${params.toString()}`;
}

function createPublSdkAdapter(sdk) {
  if (!sdk || typeof sdk !== 'object') {
    return null;
  }

  const proxy = sdk.proxy;
  const exchangeToken = proxy?.exchangeToken;
  const refreshToken = proxy?.refreshToken;

  if (typeof exchangeToken !== 'function' || typeof refreshToken !== 'function') {
    return normalizeDirectAdapter(sdk);
  }

  return {
    authorize: typeof sdk.authorize === 'function'
      ? () => sdk.authorize()
      : undefined,
    exchangeToken: () => exchangeToken.call(proxy),
    mount: typeof sdk.mount === 'function'
      ? () => sdk.mount()
      : undefined,
    refreshToken: (payload) => refreshToken.call(proxy, payload),
  };
}

function normalizeDirectAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') {
    return null;
  }

  if (typeof adapter.exchangeToken !== 'function' || typeof adapter.refreshToken !== 'function') {
    return null;
  }

  return {
    authorize: typeof adapter.authorize === 'function'
      ? () => adapter.authorize.call(adapter)
      : undefined,
    exchangeToken: () => adapter.exchangeToken.call(adapter),
    mount: typeof adapter.mount === 'function'
      ? () => adapter.mount.call(adapter)
      : undefined,
    refreshToken: (payload) => adapter.refreshToken.call(adapter, payload),
  };
}

function getPublExchangeTokens(response) {
  const data = getResponseData(response);
  const accessToken = normalizeToken(data?.accessToken);
  const refreshToken = normalizeToken(data?.refreshToken);

  if (!accessToken || !refreshToken) {
    throw new Error('Publ exchange did not return both tokens.');
  }

  return { accessToken, refreshToken };
}

function getPublRefreshAccessToken(response) {
  const accessToken = normalizeToken(getResponseData(response)?.accessToken);

  if (!accessToken) {
    throw new Error('Publ refresh did not return an access token.');
  }

  return accessToken;
}

function getResponseData(response) {
  return response?.data && typeof response.data === 'object' ? response.data : response;
}

function normalizeToken(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getGlobalSource() {
  return typeof globalThis === 'object' ? globalThis : {};
}
