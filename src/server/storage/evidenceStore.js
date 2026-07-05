import { createHash, createHmac, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { RelayValidationError } from '../relay/errors.js';

const DEFAULT_BUCKET = 'local-private-evidence';
const DEFAULT_LOCAL_ROOT = '/private/tmp/messaging-app-evidence';
const OBJECT_KEY_PREFIX = 'sender-resource-evidence';
const STORAGE_DRIVER_R2 = 'r2';
const STORAGE_DRIVER_LOCAL = 'local';
const FORBIDDEN_DESCRIPTOR_FIELDS = new Set([
  'downloadurl',
  'externalurl',
  'objecturl',
  'privateurl',
  'publicurl',
  'signedurl',
  'url',
]);

export const EVIDENCE_STORAGE_ENV = Object.freeze({
  R2_ENDPOINT_URL: 'R2_ENDPOINT_URL',
  R2_ACCESS_KEY_ID: 'R2_ACCESS_KEY_ID',
  R2_SECRET_ACCESS_KEY: 'R2_SECRET_ACCESS_KEY',
  R2_EVIDENCE_BUCKET: 'R2_EVIDENCE_BUCKET',
  STORAGE_DRIVER: 'EVIDENCE_STORAGE_DRIVER',
  LOCAL_ROOT: 'EVIDENCE_STORAGE_LOCAL_DIR',
});

export function createEvidenceStore({
  env = process.env,
  localRoot = env[EVIDENCE_STORAGE_ENV.LOCAL_ROOT],
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
} = {}) {
  const r2Config = resolveR2Config(env);
  const storageDriver = resolveStorageDriver({ env, r2Config, localRoot });
  const bucket = storageDriver === STORAGE_DRIVER_R2 ? r2Config.bucket : DEFAULT_BUCKET;
  const rootDir = localRoot || DEFAULT_LOCAL_ROOT;

  return {
    bucket,
    storageDriver,
    async storeApplicationFiles({ applicationId, userId, files }) {
      const normalizedFiles = Array.isArray(files) ? files : [];
      const records = [];

      for (const file of normalizedFiles) {
        if (isFileLike(file)) {
          if (storageDriver === STORAGE_DRIVER_R2) {
            records.push(
              await storeR2File({
                config: r2Config,
                applicationId,
                userId,
                file,
                fetchImpl,
                now,
              })
            );
          } else {
            records.push(await storeLocalFile({ bucket, rootDir, applicationId, userId, file, now }));
          }
        } else {
          records.push(normalizeStoredDescriptor(file, bucket, applicationId));
        }
      }

      return records;
    },
    async deleteApplicationFiles(evidenceFiles) {
      const results = [];

      for (const file of evidenceFiles) {
        try {
          if (storageDriver === STORAGE_DRIVER_R2) {
            results.push(await deleteR2Object({ config: r2Config, file, fetchImpl, now }));
          } else {
            results.push(await deleteLocalFileIfPresent({ bucket, rootDir, file }));
          }
        } catch (error) {
          results.push({
            objectKey: file.r2ObjectKey,
            deleted: false,
            reason: 'delete-failed',
            errorMessage: error?.message ? String(error.message) : 'Evidence deletion failed.',
          });
        }
      }

      return results;
    },
    async readApplicationFile(file) {
      if (storageDriver === STORAGE_DRIVER_R2) {
        return readR2Object({ config: r2Config, file, fetchImpl, now });
      }

      return readLocalFile({ bucket, rootDir, file });
    },
  };
}

async function storeR2File({ config, applicationId, userId, file, fetchImpl, now }) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch implementation is required for R2 evidence storage.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = createHash('sha256').update(buffer).digest('hex');
  const originalFileName = normalizeFileName(file.name || 'evidence-file');
  const contentType = normalizeOptionalString(file.type) || 'application/octet-stream';
  const objectKey = buildApplicationObjectKey({ applicationId, originalFileName, now: now() });
  const url = buildR2ObjectUrl({
    endpointUrl: config.endpointUrl,
    bucket: config.bucket,
    objectKey,
  });
  const headers = signR2Request({
    method: 'PUT',
    url,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    now: now(),
    payloadHash: sha256(buffer),
    headers: {
      'content-type': contentType,
    },
  });
  const response = await fetchImpl(url, {
    method: 'PUT',
    headers,
    body: buffer,
  });

  if (!response.ok) {
    throw new Error(`R2 evidence object upload failed with status ${response.status}.`);
  }

  return {
    r2Bucket: config.bucket,
    r2ObjectKey: objectKey,
    originalFileName,
    contentType,
    byteSize: buffer.byteLength,
    checksumSha256,
    metadataJson: {
      storageDriver: STORAGE_DRIVER_R2,
      uploadedBy: userId,
    },
  };
}

async function storeLocalFile({ bucket, rootDir, applicationId, userId, file, now }) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = createHash('sha256').update(buffer).digest('hex');
  const originalFileName = normalizeFileName(file.name || 'evidence-file');
  const contentType = normalizeOptionalString(file.type) || 'application/octet-stream';
  const objectKey = buildApplicationObjectKey({ applicationId, originalFileName, now: now() });
  const absolutePath = path.join(rootDir, ...objectKey.split('/'));

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer, { flag: 'wx' });

  return {
    r2Bucket: bucket,
    r2ObjectKey: objectKey,
    originalFileName,
    contentType,
    byteSize: buffer.byteLength,
    checksumSha256,
    metadataJson: {
      storageDriver: 'local-private',
      uploadedBy: userId,
    },
  };
}

function normalizeStoredDescriptor(file, bucket, applicationId) {
  if (!file || typeof file !== 'object') {
    throw new RelayValidationError('Evidence file metadata must be an object.');
  }

  for (const field of Object.keys(file)) {
    if (FORBIDDEN_DESCRIPTOR_FIELDS.has(field.toLowerCase()) && file[field]) {
      throw new RelayValidationError('Evidence file metadata must not include public or signed URLs.');
    }
  }

  if (file.r2Bucket && file.r2Bucket !== bucket) {
    throw new RelayValidationError('Evidence file r2Bucket must match the configured private bucket.');
  }

  const objectKey = normalizeObjectKey(file.r2ObjectKey || file.objectKey, { applicationId });

  return {
    r2Bucket: bucket,
    r2ObjectKey: objectKey,
    originalFileName: normalizeOptionalString(file.originalFileName || file.name),
    contentType: normalizeOptionalString(file.contentType),
    byteSize: normalizeByteSize(file.byteSize || file.size),
    checksumSha256: normalizeChecksum(file.checksumSha256),
  };
}

async function deleteLocalFileIfPresent({ bucket, rootDir, file }) {
  if (file.r2Bucket !== bucket || !isPrivateObjectKey(file.r2ObjectKey)) {
    return { objectKey: file.r2ObjectKey, deleted: false, reason: 'external-object' };
  }

  const absolutePath = path.join(rootDir, ...String(file.r2ObjectKey).split('/'));

  try {
    await unlink(absolutePath);
    return { objectKey: file.r2ObjectKey, deleted: true };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { objectKey: file.r2ObjectKey, deleted: true, reason: 'already-missing' };
    }

    throw error;
  }
}

async function deleteR2Object({ config, file, fetchImpl, now }) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch implementation is required for R2 evidence cleanup.');
  }

  if (file.r2Bucket !== config.bucket || !isPrivateObjectKey(file.r2ObjectKey)) {
    return { objectKey: file.r2ObjectKey, deleted: false, reason: 'external-object' };
  }

  const url = buildR2ObjectUrl({
    endpointUrl: config.endpointUrl,
    bucket: config.bucket,
    objectKey: file.r2ObjectKey,
  });
  const headers = signR2Request({
    method: 'DELETE',
    url,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    now: now(),
  });
  const response = await fetchImpl(url, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error(`R2 evidence object deletion failed with status ${response.status}.`);
  }

  return { objectKey: file.r2ObjectKey, deleted: true, storageDriver: 'r2' };
}

async function readLocalFile({ bucket, rootDir, file }) {
  if (file.r2Bucket !== bucket || !isPrivateObjectKey(file.r2ObjectKey)) {
    throw new Error('Evidence file is not available in configured storage.');
  }

  const body = await readFile(path.join(rootDir, ...String(file.r2ObjectKey).split('/')));

  return {
    body,
    contentType: file.contentType || 'application/octet-stream',
    byteSize: body.byteLength,
  };
}

async function readR2Object({ config, file, fetchImpl, now }) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch implementation is required for R2 evidence download.');
  }

  if (file.r2Bucket !== config.bucket || !isPrivateObjectKey(file.r2ObjectKey)) {
    throw new Error('Evidence file is not available in configured storage.');
  }

  const url = buildR2ObjectUrl({
    endpointUrl: config.endpointUrl,
    bucket: config.bucket,
    objectKey: file.r2ObjectKey,
  });
  const headers = signR2Request({
    method: 'GET',
    url,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    now: now(),
  });
  const response = await fetchImpl(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`R2 evidence object download failed with status ${response.status}.`);
  }

  return {
    body: response.body ?? Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || file.contentType || 'application/octet-stream',
    byteSize: normalizeNullableByteSize(response.headers.get('content-length')) ?? file.byteSize ?? null,
  };
}

function resolveR2Config(env) {
  const endpointUrl = readOptionalEnv(env, EVIDENCE_STORAGE_ENV.R2_ENDPOINT_URL);
  const accessKeyId = readOptionalEnv(env, EVIDENCE_STORAGE_ENV.R2_ACCESS_KEY_ID);
  const secretAccessKey = readOptionalEnv(env, EVIDENCE_STORAGE_ENV.R2_SECRET_ACCESS_KEY);
  const bucket = readOptionalEnv(env, EVIDENCE_STORAGE_ENV.R2_EVIDENCE_BUCKET);

  if (!endpointUrl && !accessKeyId && !secretAccessKey && !bucket) {
    return null;
  }

  if (!endpointUrl || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('R2 evidence storage requires endpoint, access key, secret key, and bucket.');
  }

  return { endpointUrl, accessKeyId, secretAccessKey, bucket };
}

function resolveStorageDriver({ env, r2Config, localRoot }) {
  const explicitDriver = readOptionalEnv(env, EVIDENCE_STORAGE_ENV.STORAGE_DRIVER);

  if (explicitDriver) {
    if (explicitDriver === STORAGE_DRIVER_R2) {
      if (!r2Config) {
        throw new Error('R2 evidence storage requires endpoint, access key, secret key, and bucket.');
      }

      return STORAGE_DRIVER_R2;
    }

    if (explicitDriver === STORAGE_DRIVER_LOCAL) {
      if (env.NODE_ENV === 'production') {
        throw new Error('Local evidence storage is not allowed in production.');
      }

      return STORAGE_DRIVER_LOCAL;
    }

    throw new Error('EVIDENCE_STORAGE_DRIVER must be "r2" or "local".');
  }

  if (r2Config) {
    return STORAGE_DRIVER_R2;
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('R2 evidence storage requires endpoint, access key, secret key, and bucket.');
  }

  if (env.NODE_ENV === 'test' || localRoot || readOptionalEnv(env, EVIDENCE_STORAGE_ENV.LOCAL_ROOT)) {
    return STORAGE_DRIVER_LOCAL;
  }

  throw new Error('Set R2 evidence storage env vars or EVIDENCE_STORAGE_DRIVER=local for development.');
}

function buildR2ObjectUrl({ endpointUrl, bucket, objectKey }) {
  const endpoint = new URL(endpointUrl);
  const basePath = endpoint.pathname.replace(/\/+$/, '');
  const objectPath = String(objectKey).split('/').map(encodeURIComponent).join('/');

  return new URL(`${basePath}/${encodeURIComponent(bucket)}/${objectPath}`, endpoint.origin);
}

function signR2Request({
  method,
  url,
  accessKeyId,
  secretAccessKey,
  now,
  payloadHash = sha256(''),
  headers = {},
}) {
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const requestHeaders = normalizeHeaders({
    ...headers,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  });
  const canonicalHeaderMap = {
    ...requestHeaders,
    host: url.host,
  };
  const signedHeaders = Object.keys(canonicalHeaderMap).sort().join(';');
  const canonicalHeaders = Object.entries(canonicalHeaderMap)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join('\n');
  const canonicalRequest = [
    method,
    url.pathname,
    url.searchParams.toString(),
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join('\n');
  const dateKey = hmacBuffer(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmacBuffer(dateKey, 'auto');
  const serviceKey = hmacBuffer(regionKey, 's3');
  const signingKey = hmacBuffer(serviceKey, 'aws4_request');
  const signature = hmacHex(signingKey, stringToSign);

  return {
    ...requestHeaders,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hmacBuffer(key, value) {
  return createHmac('sha256', key).update(value).digest();
}

function hmacHex(key, value) {
  return createHmac('sha256', key).update(value).digest('hex');
}

function normalizeHeaders(headers) {
  const normalized = {};

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === null) continue;
    normalized[key.toLowerCase()] = String(value).trim().replace(/\s+/g, ' ');
  }

  return normalized;
}

function toAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function isFileLike(file) {
  return file && typeof file === 'object' && typeof file.arrayBuffer === 'function';
}

function normalizeObjectKey(value, { applicationId }) {
  const objectKey = normalizeOptionalString(value);

  if (!objectKey) {
    throw new RelayValidationError('Evidence file objectKey is required.');
  }

  if (!isPrivateObjectKey(objectKey)) {
    throw new RelayValidationError('Evidence file objectKey must be a private object key.');
  }

  const requiredPrefix = `${OBJECT_KEY_PREFIX}/${normalizePathSegment(applicationId)}/`;
  if (!objectKey.startsWith(requiredPrefix)) {
    throw new RelayValidationError('Evidence file objectKey must be scoped to the sender resource application.');
  }

  return objectKey;
}

function isPrivateObjectKey(value) {
  const objectKey = normalizeOptionalString(value);
  return Boolean(
    objectKey &&
      objectKey.startsWith(`${OBJECT_KEY_PREFIX}/`) &&
      !objectKey.includes('..') &&
      !objectKey.startsWith('/') &&
      !/^https?:\/\//i.test(objectKey)
  );
}

function buildApplicationObjectKey({ applicationId, originalFileName, now }) {
  return [
    OBJECT_KEY_PREFIX,
    normalizePathSegment(applicationId),
    `${now.getTime()}-${randomUUID()}-${originalFileName}`,
  ].join('/');
}

function normalizeFileName(value) {
  const normalized = String(value).trim().replace(/[/\\]/g, '-').slice(0, 120);
  return normalized || 'evidence-file';
}

function normalizePathSegment(value) {
  return String(value).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 80);
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeByteSize(value) {
  if (value === undefined || value === null || value === '') return null;
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue) || numberValue < 0) {
    throw new RelayValidationError('Evidence file byteSize must be a non-negative integer.');
  }
  return numberValue;
}

function normalizeNullableByteSize(value) {
  if (value === undefined || value === null || value === '') return null;
  return normalizeByteSize(value);
}

function normalizeChecksum(value) {
  const checksum = normalizeOptionalString(value);
  if (!checksum) return null;
  if (!/^[a-f0-9]{64}$/i.test(checksum)) {
    throw new RelayValidationError('Evidence file checksumSha256 must be a 64-character hex string.');
  }
  return checksum.toLowerCase();
}

function readOptionalEnv(env, name) {
  const value = typeof env[name] === 'string' ? env[name].trim() : '';
  return value || null;
}
