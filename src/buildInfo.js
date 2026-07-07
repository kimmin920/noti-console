const DEFAULT_APP_VERSION = '0.0.0';
const LOCAL_BUILD_SHA = 'local';
const UNKNOWN_BUILD_SUBJECT = '작업 설명 없음';
const UNKNOWN_BUILD_SHA_VALUES = new Set(['', 'unknown', 'undefined', 'null', 'local']);
const KST_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'Asia/Seoul',
});

const defaultBuildEnv = {
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_BUILD_SHA: process.env.NEXT_PUBLIC_BUILD_SHA,
  NEXT_PUBLIC_BUILD_SUBJECT: process.env.NEXT_PUBLIC_BUILD_SUBJECT,
  NEXT_PUBLIC_BUILD_TIME: process.env.NEXT_PUBLIC_BUILD_TIME,
};

export function resolveBuildInfo(env = defaultBuildEnv) {
  const version = readOptionalEnv(env, 'NEXT_PUBLIC_APP_VERSION') ?? DEFAULT_APP_VERSION;
  const buildSha = readOptionalEnv(env, 'NEXT_PUBLIC_BUILD_SHA') ?? LOCAL_BUILD_SHA;
  const buildSubject = readOptionalEnv(env, 'NEXT_PUBLIC_BUILD_SUBJECT');
  const buildTime = readOptionalEnv(env, 'NEXT_PUBLIC_BUILD_TIME');

  return Object.freeze({
    buildSha,
    buildSubject,
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
  const buildSubject = formatBuildSubjectDisplay(info.buildSubject);
  const buildTime = formatBuildTime(info.buildTime);

  parts.push(`commit ${buildSubject}`);

  if (buildTime) {
    parts.push(`built ${buildTime}`);
  }

  return parts.join(', ');
}

export function formatBuildSubject(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  return normalized.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

export function formatBuildSubjectDisplay(value) {
  return formatBuildSubject(value) ?? UNKNOWN_BUILD_SUBJECT;
}

export function formatBuildTime(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  return `${formatKstTime(date)} KST`;
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

function formatKstTime(date) {
  const parts = KST_TIME_FORMATTER.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.hour}:${values.minute}:${values.second}`;
}
