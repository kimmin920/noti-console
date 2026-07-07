import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const appVersion = readOptionalEnv('NEXT_PUBLIC_APP_VERSION') ?? packageJson.version ?? '0.0.0';
const buildSha = readOptionalEnv('NEXT_PUBLIC_BUILD_SHA') ?? readGitSha() ?? 'local';
const buildTime = readOptionalEnv('NEXT_PUBLIC_BUILD_TIME') ?? new Date().toISOString();

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_BUILD_SHA: buildSha,
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

function readGitSha() {
  return readGitShaFromCommand() ?? readGitShaFromHead();
}

function readGitShaFromCommand() {
  try {
    const sha = execSync('git rev-parse --short=8 HEAD', {
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
