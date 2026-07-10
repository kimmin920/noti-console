import {
  getPublClientAccessToken,
  getPublClientRefreshToken,
  hasPublClientRefreshTokenHandler,
  refreshPublClientAccessToken,
} from '../../publClient/authToken.js';
import {
  getIdentity,
  isActiveForPath,
  isPublClientRuntimeGenerationActive,
} from '../../publClient/runtimeSession.js';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

let publRefreshInFlight = null;

export class RelayClientError extends Error {
  constructor({
    code = 'UNKNOWN_CLIENT_ERROR',
    message = '요청을 처리할 수 없습니다.',
    providerCode = null,
    providerMessage = null,
    retryable = false,
    source = 'client',
    state = null,
    status = 0,
  } = {}) {
    super(message);
    this.name = 'RelayClientError';
    this.code = code;
    this.providerCode = providerCode;
    this.providerMessage = providerMessage;
    this.retryable = Boolean(retryable);
    this.source = source;
    this.state = state;
    this.status = status;
  }
}

export function getRelayErrorMessage(error, fallback = '요청을 처리할 수 없습니다.') {
  return error instanceof RelayClientError && error.message ? error.message : fallback;
}

export async function relayGet(path) {
  return relayFetch(path);
}

export async function relayPost(path, payload) {
  return relayFetch(path, {
    body: JSON.stringify(payload),
    headers: JSON_HEADERS,
    method: 'POST',
  });
}

export async function relayPatch(path, payload) {
  return relayFetch(path, {
    body: JSON.stringify(payload),
    headers: JSON_HEADERS,
    method: 'PATCH',
  });
}

export async function relayDelete(path, payload) {
  return relayFetch(path, {
    body: JSON.stringify(payload),
    headers: JSON_HEADERS,
    method: 'DELETE',
  });
}

export async function relayPostForm(path, formData) {
  return relayFetch(path, {
    body: formData,
    method: 'POST',
  });
}

export function withQuery(path, params) {
  const searchParams = new URLSearchParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  window.__VIZUO_E2E_RELAY_GET__ = relayGet;
}

async function relayFetch(path, init) {
  return relayFetchWithPublRefresh(path, init, { retried: false });
}

async function relayFetchWithPublRefresh(path, init, { retried }) {
  const requestIdentity = snapshotPublRequestIdentity(path);
  const response = await fetch(path, {
    cache: 'no-store',
    ...withPublBearerAuthorization(path, init),
  });
  assertPublRuntimeStillActive(requestIdentity);
  const envelope = await readRelayEnvelope(response);
  assertPublRuntimeStillActive(requestIdentity);

  if (response.ok && envelope?.ok === true) {
    return envelope.data;
  }

  const error = toRelayClientError({ envelope, status: response.status });

  if (!retried && shouldAttemptPublTokenRefresh(path, error)) {
    const currentToken = getPublClientAccessToken();
    const refreshed = currentToken && requestIdentity?.accessToken !== currentToken
      ? currentToken
      : await refreshPublAccessTokenSafely();

    if (refreshed) {
      return relayFetchWithPublRefresh(path, init, { retried: true });
    }
  }

  throw error;
}

function snapshotPublRequestIdentity(path) {
  if (!isLocalApiPath(path) || !isActiveForPath()) {
    return null;
  }

  const identity = getIdentity();
  return identity ? { ...identity } : null;
}

function withPublBearerAuthorization(path, init) {
  if (!isLocalApiPath(path) || !isActiveForPath()) {
    return init;
  }

  const identity = getIdentity();
  if (!identity?.accessToken) {
    return init;
  }

  const headers = new Headers(init?.headers);
  if (!headers.has('authorization')) {
    headers.set('authorization', `Bearer ${identity.accessToken}`);
  }
  headers.set('x-noti-auth-context', 'publ-client');

  return {
    ...init,
    headers,
  };
}

function isLocalApiPath(path) {
  return typeof path === 'string' && (path === '/api' || path.startsWith('/api/'));
}

function shouldAttemptPublTokenRefresh(path, error) {
  return isLocalApiPath(path)
    && isActiveForPath()
    && error?.status === 401
    && Boolean(getPublClientAccessToken())
    && Boolean(getPublClientRefreshToken())
    && hasPublClientRefreshTokenHandler();
}

async function refreshPublAccessTokenSafely() {
  const identity = getIdentity();
  if (!identity) return null;

  if (publRefreshInFlight?.generation === identity.generation) {
    return publRefreshInFlight.promise;
  }

  const promise = refreshPublClientAccessToken()
    .finally(() => {
      setTimeout(() => {
        if (publRefreshInFlight?.promise === promise) {
          publRefreshInFlight = null;
        }
      }, 100);
    });
  publRefreshInFlight = {
    generation: identity.generation,
    promise,
  };

  try {
    return await promise;
  } catch {
    return null;
  }
}

function assertPublRuntimeStillActive(requestIdentity) {
  if (!requestIdentity) return;

  if (!isPublClientRuntimeGenerationActive(requestIdentity.generation)) {
    throw new RelayClientError({
      code: 'STALE_PUBL_RUNTIME',
      message: 'Publ client session changed before the request completed.',
      retryable: false,
      source: 'client',
      status: 0,
    });
  }
}

async function readRelayEnvelope(response) {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toRelayClientError({ envelope, status }) {
  const error = envelope?.error;

  if (error && typeof error === 'object') {
    return new RelayClientError({
      code: error.code,
      message: error.message,
      providerCode: error.providerCode,
      providerMessage: error.providerMessage,
      retryable: error.retryable,
      source: error.source,
      state: error.state,
      status,
    });
  }

  return new RelayClientError({
    code: status ? `HTTP_${status}` : 'NETWORK_ERROR',
    message: status ? '요청을 처리할 수 없습니다.' : '네트워크 연결을 확인해 주세요.',
    retryable: status >= 500 || status === 0,
    source: 'client',
    status,
  });
}
