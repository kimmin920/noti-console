import { NextResponse } from 'next/server';

import {
  auditRelayFailure,
  createDefaultAuditRepository,
  isAuditableRelayFailure,
} from '../audit/service.js';
import {
  NhnProviderError,
  RelayError,
  RelayValidationError,
  providerErrorEnvelope,
  relayError,
  relaySuccess,
} from '../relay/errors.js';
import { RELAY_ERROR_CODES } from '../relay/constants.js';

export async function parseRelayRequest(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    return parseMultipartRequest(await parseRelayFormData(request));
  }

  if (contentType.includes('application/json')) {
    let payload;

    try {
      payload = await request.json();
    } catch {
      throw new RelayValidationError('Request body must be valid JSON.');
    }

    return { payload: payload && typeof payload === 'object' ? payload : {}, files: [] };
  }

  return { payload: {}, files: [] };
}

export async function parseRelayFormData(request) {
  try {
    return await request.formData();
  } catch {
    throw new RelayValidationError('Request body must be valid multipart form data.');
  }
}

export async function relayRoute(handler) {
  try {
    const result = await handler();
    const status = result?.status ?? 200;
    const data = result?.data ?? result;
    const headers = result?.headers;

    return NextResponse.json(relaySuccess(data), { status, ...(headers ? { headers } : {}) });
  } catch (error) {
    await auditRouteFailure(error);
    return relayErrorResponse(error);
  }
}

export function relayErrorResponse(error) {
  const { status, body } = toErrorResponse(error);
  return NextResponse.json(body, { status });
}

async function auditRouteFailure(error) {
  if (!isAuditableRelayFailure(error)) {
    return;
  }

  try {
    await auditRelayFailure({
      repository: createDefaultAuditRepository(),
      error,
      operation: 'api.route',
      targetType: 'api_route',
    });
  } catch {
    // Preserve the user-facing error response even if the audit store is temporarily unavailable.
  }
}

function parseMultipartRequest(formData) {
  const payload = {};
  const files = [];

  for (const [key, value] of formData.entries()) {
    if (isFileLike(value)) {
      files.push({ fieldName: key, file: value });
      continue;
    }

    if (key === 'payload') {
      Object.assign(payload, parseJsonField(value, key));
    } else if (key === 'evidenceFiles') {
      payload.evidenceFiles = parseJsonField(value, key);
    } else {
      payload[key] = value;
    }
  }

  return { payload, files };
}

function parseJsonField(value, key) {
  try {
    return JSON.parse(String(value));
  } catch {
    throw new RelayError({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      message: `${key} must be valid JSON.`,
      retryable: false,
      status: 400,
    });
  }
}

function toErrorResponse(error) {
  if (error instanceof NhnProviderError) {
    return {
      status: normalizeStatus(error.status, 502),
      body: providerErrorEnvelope(error),
    };
  }

  if (error instanceof RelayError) {
    return {
      status: normalizeStatus(error.status, 500),
      body: relayError({
        source: error.source,
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        state: error.state,
      }),
    };
  }

  return {
    status: 500,
    body: relayError({
      code: RELAY_ERROR_CODES.PROVIDER_UNAVAILABLE,
      message: '요청을 처리할 수 없습니다.',
      retryable: false,
    }),
  };
}

function normalizeStatus(value, fallback) {
  const status = Number(value);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : fallback;
}

function isFileLike(value) {
  return value && typeof value === 'object' && typeof value.arrayBuffer === 'function';
}
