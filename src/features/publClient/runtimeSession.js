'use client';

import {
  getPublClientAccessToken,
  getPublClientRefreshToken,
  hasPublClientRefreshTokenHandler,
} from './authToken.js';
import { isPublIframeContext } from './frameContext.js';

const PUBL_CLIENT_PATH_PREFIX = '/publ-client';

let runtimeIdentity = null;
let runtimeGeneration = 0;
const capabilityStates = new Map();

export function activatePublClientRuntime({
  originPolicyConfigured,
  windowRef = getWindow(),
} = {}) {
  if (
    !originPolicyConfigured
    || !isPublClientPath(windowRef?.location?.pathname)
    || !isPublIframeContext(windowRef)
    || !hasPublClientRefreshTokenHandler()
  ) {
    resetPublClientRuntime();
    return false;
  }

  const accessToken = getPublClientAccessToken();
  const refreshToken = getPublClientRefreshToken();
  if (!accessToken || !refreshToken) {
    resetPublClientRuntime();
    return false;
  }

  const tokenIdentity = decodePublClientAccessTokenIdentity(accessToken);
  if (!tokenIdentity) {
    resetPublClientRuntime();
    return false;
  }

  runtimeGeneration += 1;
  runtimeIdentity = Object.freeze({
    ...tokenIdentity,
    accessToken,
    activatedPathname: windowRef.location.pathname,
    generation: runtimeGeneration,
    identityKey: createIdentityKey(tokenIdentity),
  });
  return true;
}

export function resetPublClientRuntime() {
  runtimeIdentity = null;
  capabilityStates.clear();
}

export function isActiveForPath(pathname = getWindow()?.location?.pathname) {
  if (!runtimeIdentity) {
    return false;
  }

  if (!isPublClientPath(pathname)) {
    resetPublClientRuntime();
    return false;
  }

  return true;
}

export function getIdentity() {
  if (!isActiveForPath()) {
    return null;
  }

  const accessToken = getPublClientAccessToken();
  if (!accessToken) {
    resetPublClientRuntime();
    return null;
  }

  if (runtimeIdentity.accessToken !== accessToken) {
    const tokenIdentity = decodePublClientAccessTokenIdentity(accessToken);
    if (!tokenIdentity || createIdentityKey(tokenIdentity) !== runtimeIdentity.identityKey) {
      resetPublClientRuntime();
      return null;
    }

    runtimeIdentity = Object.freeze({
      ...runtimeIdentity,
      accessToken,
    });
  }

  return runtimeIdentity;
}

export function getPublClientRuntimeGeneration() {
  return runtimeIdentity?.generation ?? null;
}

export function getPublClientCapabilityState({ identity = getIdentity(), permissionId }) {
  if (!identity || !permissionId) return null;
  return capabilityStates.get(createCapabilityKey(identity, permissionId)) ?? null;
}

export function setPublClientCapabilityState({ identity = getIdentity(), permissionId, state }) {
  if (!identity || !permissionId || !state) return null;
  const key = createCapabilityKey(identity, permissionId);
  capabilityStates.set(key, state);
  return state;
}

export function isPublClientRuntimeGenerationActive(generation) {
  return Boolean(runtimeIdentity && runtimeIdentity.generation === generation && isActiveForPath());
}

function isPublClientPath(pathname) {
  return pathname === PUBL_CLIENT_PATH_PREFIX || pathname?.startsWith(`${PUBL_CLIENT_PATH_PREFIX}/`);
}

function getWindow() {
  return typeof window === 'object' ? window : null;
}

function decodePublClientAccessTokenIdentity(accessToken) {
  const payload = decodeJwtPayload(accessToken);
  const consumerId = normalizeIdentityField(payload?.consumerId);
  const sessionId = normalizeIdentityField(payload?.sessionId);
  const userId = normalizeIdentityField(payload?.userId);

  if (!consumerId || !sessionId || !userId) {
    return null;
  }

  return { consumerId, sessionId, userId };
}

function createIdentityKey(identity) {
  return `${identity.consumerId}:${identity.sessionId}:${identity.userId}`;
}

function createCapabilityKey(identity, permissionId) {
  return `${identity.identityKey ?? createIdentityKey(identity)}:${permissionId}`;
}

function decodeJwtPayload(token) {
  try {
    const payload = String(token).split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const decoded = typeof atob === 'function'
      ? atob(padded)
      : globalThis.Buffer?.from?.(padded, 'base64')?.toString('utf8');
    if (!decoded) return null;
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function normalizeIdentityField(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}
