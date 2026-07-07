const DEFAULT_APP_VERSION = '0.0.0';
const LOCAL_BUILD_SHA = 'local';
const UNKNOWN_BUILD_SHA_VALUES = new Set(['', 'unknown', 'undefined', 'null', 'local']);

const defaultBuildEnv = {
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_BUILD_SHA: process.env.NEXT_PUBLIC_BUILD_SHA,
  NEXT_PUBLIC_BUILD_TIME: process.env.NEXT_PUBLIC_BUILD_TIME,
};

export function resolveBuildInfo(env = defaultBuildEnv) {
  const version = readOptionalEnv(env, 'NEXT_PUBLIC_APP_VERSION') ?? DEFAULT_APP_VERSION;
  const buildSha = readOptionalEnv(env, 'NEXT_PUBLIC_BUILD_SHA') ?? LOCAL_BUILD_SHA;
  const buildTime = readOptionalEnv(env, 'NEXT_PUBLIC_BUILD_TIME');

  return Object.freeze({
    buildSha,
    buildTime,
    shortSha: shortenBuildSha(buildSha),
    version,
  });
}

export function shortenBuildSha(value) {
  const normalized = normalizeText(value);

  if (!normalized || UNKNOWN_BUILD_SHA_VALUES.has(normalized.toLowerCase())) {
    return LOCAL_BUILD_SHA;
  }

  return normalized.slice(0, 8);
}

export function formatBuildInfoTitle(info) {
  const parts = [`Version ${info.version}`, `build ${info.shortSha}`];

  if (info.buildTime) {
    parts.push(`built ${info.buildTime}`);
  }

  return parts.join(', ');
}

function readOptionalEnv(env, key) {
  return normalizeText(env?.[key]);
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}
