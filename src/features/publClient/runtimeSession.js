'use client';

import {
  getPublClientAccessToken,
  getPublClientRefreshToken,
  hasPublClientRefreshTokenHandler,
} from './authToken.js';
import { isPublIframeContext } from './frameContext.js';

const PUBL_CLIENT_PATH_PREFIX = '/publ-client';

let runtimeIdentity = null;

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

  runtimeIdentity = Object.freeze({
    accessToken,
    activatedPathname: windowRef.location.pathname,
  });
  return true;
}

export function resetPublClientRuntime() {
  runtimeIdentity = null;
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
    runtimeIdentity = Object.freeze({
      ...runtimeIdentity,
      accessToken,
    });
  }

  return runtimeIdentity;
}

function isPublClientPath(pathname) {
  return pathname === PUBL_CLIENT_PATH_PREFIX || pathname?.startsWith(`${PUBL_CLIENT_PATH_PREFIX}/`);
}

function getWindow() {
  return typeof window === 'object' ? window : null;
}
