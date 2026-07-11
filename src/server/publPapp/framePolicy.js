export const PUBL_PAPP_PARENT_ORIGIN_ENV = Object.freeze({
  RELEASE: 'PUBL_PAPP_RELEASE_PARENT_ORIGINS',
  TEST: 'PUBL_PAPP_TEST_PARENT_ORIGINS',
});

const PUBL_PAPP_CLIENT_STAGE_ENV = 'PUBL_PAPP_CLIENT_STAGE';
const FRAME_ANCESTORS_NONE = "frame-ancestors 'none'";

export function resolvePublClientFramePolicy(env = process.env) {
  try {
    const origins = resolvePublParentOrigins(env);
    return Object.freeze({
      configured: origins.length > 0,
      contentSecurityPolicy: origins.length > 0
        ? `frame-ancestors ${origins.join(' ')}`
        : FRAME_ANCESTORS_NONE,
      origins: Object.freeze(origins),
    });
  } catch {
    return Object.freeze({
      configured: false,
      contentSecurityPolicy: FRAME_ANCESTORS_NONE,
      origins: Object.freeze([]),
    });
  }
}

export function resolvePublParentOrigins(env = process.env) {
  const stage = resolvePublClientStage(env);
  const envName = stage === 'release'
    ? PUBL_PAPP_PARENT_ORIGIN_ENV.RELEASE
    : PUBL_PAPP_PARENT_ORIGIN_ENV.TEST;
  const values = readOptionalEnv(env, envName);

  if (!values) {
    return [];
  }

  return values
    .split(',')
    .map((value) => normalizeParentOrigin(value, env))
    .filter(Boolean);
}

export function resolvePublClientStage(env = process.env) {
  const configuredStage = readOptionalEnv(env, PUBL_PAPP_CLIENT_STAGE_ENV)?.toLowerCase();

  if (configuredStage) {
    if (configuredStage === 'test' || configuredStage === 'test_flight') {
      return 'test';
    }

    if (configuredStage === 'release' || configuredStage === 'production') {
      return 'release';
    }

    throw new Error(`${PUBL_PAPP_CLIENT_STAGE_ENV} must be test or release.`);
  }

  return readOptionalEnv(env, 'APP_ENV') === 'production' ? 'release' : 'test';
}

function normalizeParentOrigin(value, env) {
  const rawValue = typeof value === 'string' ? value.trim() : '';
  if (!rawValue) {
    return null;
  }

  if (rawValue.includes('*')) {
    throw new Error('Publ parent origins must not include wildcards.');
  }

  const parsed = parseOrigin(rawValue);
  if (parsed.username || parsed.password) {
    throw new Error('Publ parent origins must not include credentials.');
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Publ parent origins must not include a path, query, or hash.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Publ parent origins must use HTTP or HTTPS.');
  }
  if (parsed.protocol === 'http:') {
    assertHttpAllowed(parsed, env);
  }

  return parsed.origin;
}

function parseOrigin(value) {
  try {
    return new URL(value);
  } catch {
    throw new Error('Publ parent origins must be absolute origins.');
  }
}

function assertHttpAllowed(parsed, env) {
  if (readOptionalEnv(env, 'NODE_ENV') === 'production') {
    throw new Error('HTTP parent origins are not allowed in production.');
  }

  const isLoopback = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (!isLoopback || !parsed.port) {
    throw new Error('HTTP parent origins must be localhost loopback with an explicit port.');
  }
}

function readOptionalEnv(env, name) {
  const value = typeof env[name] === 'string' ? env[name].trim() : '';
  return value || null;
}
