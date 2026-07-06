'use client';

export const PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY = 'vizuo:publPapp:accessToken';
export const PUBL_CLIENT_REFRESH_TOKEN_SESSION_KEY = 'vizuo:publPapp:refreshToken';

export function getPublClientAccessToken({ storage = getPublClientSessionStorage() } = {}) {
  return normalizeToken(storage?.getItem?.(PUBL_CLIENT_ACCESS_TOKEN_SESSION_KEY));
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
