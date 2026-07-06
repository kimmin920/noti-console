'use client';

export const PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY = 'vizuo:publPapp:accessToken';
export const PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY = 'vizuo:publPapp:refreshToken';

let refreshTokenHandler = null;

export function getPublClientAccessToken({ storage = getPublClientSessionStorage() } = {}) {
  return normalizeToken(storage?.getItem?.(PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY));
}

export function getPublClientRefreshToken({ storage = getPublClientSessionStorage() } = {}) {
  return normalizeToken(storage?.getItem?.(PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY));
}

export function setPublClientTokens({ accessToken, refreshToken }, { storage = getPublClientSessionStorage() } = {}) {
  const normalizedAccessToken = normalizeToken(accessToken);
  const normalizedRefreshToken = normalizeToken(refreshToken);

  if (!storage) return;

  if (normalizedAccessToken) {
    storage.setItem(PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY, normalizedAccessToken);
  }

  if (normalizedRefreshToken) {
    storage.setItem(PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY, normalizedRefreshToken);
  }
}

export function clearPublClientTokens({ storage = getPublClientSessionStorage() } = {}) {
  storage?.removeItem?.(PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY);
  storage?.removeItem?.(PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY);
}

export function registerPublClientRefreshTokenHandler(handler) {
  refreshTokenHandler = typeof handler === 'function' ? handler : null;

  return () => {
    if (refreshTokenHandler === handler) {
      refreshTokenHandler = null;
    }
  };
}

export function clearPublClientRefreshTokenHandler() {
  refreshTokenHandler = null;
}

export function hasPublClientRefreshTokenHandler() {
  return typeof refreshTokenHandler === 'function';
}

export async function refreshPublClientAccessToken({ storage = getPublClientSessionStorage() } = {}) {
  if (!hasPublClientRefreshTokenHandler()) {
    return null;
  }

  const previousAccessToken = getPublClientAccessToken({ storage });
  const refreshToken = getPublClientRefreshToken({ storage });

  if (!previousAccessToken || !refreshToken) {
    return null;
  }

  try {
    const nextAccessToken = normalizeToken(await refreshTokenHandler({
      previousAccessToken,
      refreshToken,
    }));

    if (!nextAccessToken) {
      throw new Error('Publ refresh did not return an access token.');
    }

    setPublClientTokens({ accessToken: nextAccessToken }, { storage });
    return nextAccessToken;
  } catch (error) {
    clearPublClientTokens({ storage });
    throw error;
  }
}

function getPublClientSessionStorage() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function normalizeToken(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
