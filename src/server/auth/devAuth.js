export const DEV_RELAY_ACTOR_USER_ID_HEADER = 'x-relay-user-id';
export const DEV_BROWSER_AUTH_USER_ID_COOKIE = '__dev_auth_user_id';
export const RELAY_DEV_AUTH_HEADER_ENABLED_ENV = 'RELAY_DEV_AUTH_HEADER_ENABLED';

export function isDevAuthHeaderEnabled(env = process.env) {
  return env.NODE_ENV !== 'production' && env[RELAY_DEV_AUTH_HEADER_ENABLED_ENV] === 'true';
}

export function isDevBrowserAuthBypassEnabled(env = process.env) {
  return env.NODE_ENV === 'development' || isDevAuthHeaderEnabled(env);
}

export function hasDevBrowserAuthBypass(request, env = process.env) {
  return isDevBrowserAuthBypassEnabled(env) && Boolean(readDevBrowserAuthUserId(request));
}

export function readDevActorCredential(request, env = process.env) {
  const headerUserId = normalizeOptionalString(request?.headers?.get?.(DEV_RELAY_ACTOR_USER_ID_HEADER));
  if (headerUserId && isDevAuthHeaderEnabled(env)) {
    return {
      authProvider: 'dev_header',
      userId: headerUserId,
    };
  }

  const cookieUserId = readDevBrowserAuthUserId(request);
  if (cookieUserId && isDevBrowserAuthBypassEnabled(env)) {
    return {
      authProvider: 'dev_cookie',
      userId: cookieUserId,
    };
  }

  return null;
}

function readDevBrowserAuthUserId(request) {
  const cookieFromNextRequest = request?.cookies?.get?.(DEV_BROWSER_AUTH_USER_ID_COOKIE);
  if (cookieFromNextRequest) {
    return normalizeOptionalString(cookieFromNextRequest.value ?? cookieFromNextRequest);
  }

  return normalizeOptionalString(readCookieHeaderValue(request?.headers?.get?.('cookie')));
}

function readCookieHeaderValue(cookieHeader) {
  const normalizedCookieHeader = normalizeOptionalString(cookieHeader);
  if (!normalizedCookieHeader) return null;

  for (const entry of normalizedCookieHeader.split(';')) {
    const [name, ...valueParts] = entry.trim().split('=');
    if (name !== DEV_BROWSER_AUTH_USER_ID_COOKIE) continue;

    try {
      return decodeURIComponent(valueParts.join('='));
    } catch {
      return valueParts.join('=');
    }
  }

  return null;
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}
