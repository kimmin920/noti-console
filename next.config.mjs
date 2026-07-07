import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const appVersion = readOptionalEnv('NEXT_PUBLIC_APP_VERSION') ?? packageJson.version ?? '0.0.0';
const buildSha = readOptionalEnv('NEXT_PUBLIC_BUILD_SHA') ?? readBuildShaEnv() ?? readGitSha() ?? 'local';
const buildSubject = readSubjectEnv() ?? readGitSubject() ?? '';
const buildTime = readOptionalEnv('NEXT_PUBLIC_BUILD_TIME') ?? new Date().toISOString();

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_BUILD_SHA: buildSha,
    NEXT_PUBLIC_BUILD_SUBJECT: buildSubject,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
  pageExtensions: isProduction
    ? ['js', 'jsx', 'ts', 'tsx']
    : ['dev.js', 'dev.jsx', 'dev.ts', 'dev.tsx', 'js', 'jsx', 'ts', 'tsx'],
  turbopack: {
    root: rootDir,
  },
};

export default nextConfig;

function readOptionalEnv(name) {
  const value = process.env[name];

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}

function readBuildShaEnv() {
  return readFirstOptionalEnv([
    'VERCEL_GIT_COMMIT_SHA',
    'GITHUB_SHA',
    'CF_PAGES_COMMIT_SHA',
    'RENDER_GIT_COMMIT',
  ]);
}

function readSubjectEnv() {
  return readSubjectFromEnv('NEXT_PUBLIC_BUILD_SUBJECT')
    ?? readSubjectFromEnv('VERCEL_GIT_COMMIT_MESSAGE')
    ?? readSubjectFromEnv('GITHUB_COMMIT_MESSAGE')
    ?? readSubjectFromEnv('COMMIT_MESSAGE')
    ?? readSubjectFromEnv('SOURCE_COMMIT_MESSAGE');
}

function readFirstOptionalEnv(names) {
  for (const name of names) {
    const value = readOptionalEnv(name);

    if (value) {
      return value;
    }
  }

  return null;
}

function readSubjectFromEnv(name) {
  const value = readOptionalEnv(name);

  if (!value) {
    return null;
  }

  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

function readGitSha() {
  return readGitShaFromCommand() ?? readGitShaFromHead();
}

function readGitSubject() {
  const ref = readGitChangeRef();

  try {
    const subject = execFileSync('git', ['log', '-1', '--pretty=%s', ref], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    return subject || null;
  } catch {
    return null;
  }
}

function readGitChangeRef() {
  try {
    const line = execFileSync('git', ['rev-list', '--parents', '-n', '1', 'HEAD'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const [, , secondParent] = line.split(/\s+/);

    return secondParent ?? 'HEAD';
  } catch {
    return 'HEAD';
  }
}

function readGitShaFromCommand() {
  try {
    const sha = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    return sha || null;
  } catch {
    return null;
  }
}

function readGitShaFromHead() {
  const gitDir = resolveGitDir();

  if (!gitDir) {
    return null;
  }

  const headPath = path.join(gitDir, 'HEAD');

  if (!existsSync(headPath)) {
    return null;
  }

  const head = readOptionalFile(headPath);

  if (!head) {
    return null;
  }

  if (!head.startsWith('ref:')) {
    return head.slice(0, 8);
  }

  const ref = head.slice('ref:'.length).trim();
  const refSha = readOptionalFile(path.join(gitDir, ref)) ?? readPackedRef(gitDir, ref);

  return refSha ? refSha.slice(0, 8) : null;
}

function readPackedRef(gitDir, ref) {
  const packedRefs = readOptionalFile(path.join(gitDir, 'packed-refs'));

  if (!packedRefs) {
    return null;
  }

  for (const line of packedRefs.split('\n')) {
    const normalized = line.trim();

    if (!normalized || normalized.startsWith('#') || normalized.startsWith('^')) {
      continue;
    }

    const [sha, name] = normalized.split(/\s+/);

    if (name === ref) {
      return sha;
    }
  }

  return null;
}

function resolveGitDir() {
  const gitPath = path.join(rootDir, '.git');

  if (!existsSync(gitPath)) {
    return null;
  }

  const gitFile = readOptionalFile(gitPath);

  if (gitFile?.startsWith('gitdir:')) {
    const gitDir = gitFile.slice('gitdir:'.length).trim();

    return path.isAbsolute(gitDir) ? gitDir : path.join(rootDir, gitDir);
  }

  return gitPath;
}

function readOptionalFile(filePath) {
  try {
    const value = readFileSync(filePath, 'utf8').trim();

    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}
