import { NhnProviderError } from '../relay/errors.js';

const DEFAULT_TIMEOUT_MS = 15000;

export async function requestNhnJson({
  baseUrl,
  path,
  method = 'GET',
  secretKey,
  query,
  body,
  headers,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch implementation is required.');
  }

  const url = buildUrl(baseUrl, path, query);
  const controller = new AbortController();
  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => controller.abort(new DOMException('NHN request timed out.', 'TimeoutError')), timeoutMs)
      : null;

  if (timeoutId?.unref) {
    timeoutId.unref();
  }

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    }
  }

  try {
    const response = await fetchImpl(url, {
      method,
      headers: buildHeaders(secretKey, headers, body),
      body: serializeBody(body),
      signal: controller.signal,
    });

    return await parseNhnResponse(response);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function buildUrl(baseUrl, path, query) {
  const url = new URL(path, `${baseUrl.replace(/\/+$/, '')}/`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url;
}

function buildHeaders(secretKey, headers = {}, body) {
  return {
    Accept: 'application/json',
    ...(body === undefined || isFormDataBody(body) ? {} : { 'Content-Type': 'application/json;charset=UTF-8' }),
    ...headers,
    'X-Secret-Key': secretKey,
  };
}

function serializeBody(body) {
  if (body === undefined) return undefined;
  if (isFormDataBody(body)) return body;

  return JSON.stringify(body);
}

function isFormDataBody(body) {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

async function parseNhnResponse(response) {
  const responseBody = await readJsonBody(response);
  const header = responseBody && typeof responseBody === 'object' ? responseBody.header : null;

  if (!response.ok) {
    throw new NhnProviderError({
      status: response.status,
      providerCode: header?.resultCode ?? response.status,
      providerMessage: header?.resultMessage ?? response.statusText,
      responseBody,
      retryable: response.status >= 500,
    });
  }

  if (header?.isSuccessful === false) {
    throw new NhnProviderError({
      status: response.status,
      providerCode: header.resultCode ?? null,
      providerMessage: header.resultMessage ?? 'NHN rejected the request.',
      responseBody,
      retryable: false,
    });
  }

  return responseBody;
}

async function readJsonBody(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
