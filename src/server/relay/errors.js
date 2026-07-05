import { RELAY_ERROR_CODES, SEND_RESPONSE_STATES } from './constants.js';

const PROVIDER_TIMEOUT_CODES = new Set([
  'ABORT_ERR',
  'ECONNABORTED',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

export class RelayError extends Error {
  constructor({ code, message, source = 'relay', retryable = false, status = 500, state, cause } = {}) {
    super(message || 'Relay error');
    this.name = 'RelayError';
    this.code = code || RELAY_ERROR_CODES.PROVIDER_UNAVAILABLE;
    this.source = source;
    this.retryable = Boolean(retryable);
    this.status = status;
    this.state = state;
    this.cause = cause;
  }
}

export class RelayValidationError extends RelayError {
  constructor(message) {
    super({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      message,
      retryable: false,
      status: 400,
      state: SEND_RESPONSE_STATES.LOCAL_VALIDATION_FAILED,
    });
    this.name = 'RelayValidationError';
  }
}

export class NhnProviderError extends Error {
  constructor({
    message,
    status = 502,
    providerCode = null,
    providerMessage = null,
    responseBody = null,
    retryable = false,
    cause,
  } = {}) {
    super(message || providerMessage || 'NHN provider request failed');
    this.name = 'NhnProviderError';
    this.status = status;
    this.providerCode = providerCode;
    this.providerMessage = providerMessage;
    this.responseBody = responseBody;
    this.retryable = Boolean(retryable);
    this.cause = cause;
  }
}

export function relaySuccess(data, meta) {
  return meta === undefined ? { ok: true, data } : { ok: true, data, meta };
}

export function relayError({
  source = 'relay',
  code = RELAY_ERROR_CODES.PROVIDER_UNAVAILABLE,
  message = '요청을 처리할 수 없습니다.',
  retryable = false,
  state,
  providerCode,
  providerMessage,
} = {}) {
  const error = {
    source,
    code,
    message,
    retryable: Boolean(retryable),
  };

  if (state) {
    error.state = state;
  }

  if (providerCode !== undefined && providerCode !== null) {
    error.providerCode = String(providerCode);
  }

  if (providerMessage) {
    error.providerMessage = String(providerMessage);
  }

  return { ok: false, error };
}

export function isProviderRateLimit(error) {
  return getProviderStatus(error) === 429;
}

export function isProviderTimeout(error) {
  if (!error) return false;
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;
  if (error.code && PROVIDER_TIMEOUT_CODES.has(String(error.code))) return true;
  if (error.cause && isProviderTimeout(error.cause)) return true;
  return false;
}

export function classifyProviderFailure(error) {
  if (isProviderRateLimit(error)) {
    return {
      code: RELAY_ERROR_CODES.PROVIDER_RATE_LIMITED,
      retryable: false,
    };
  }

  if (isProviderTimeout(error)) {
    return {
      code: RELAY_ERROR_CODES.PROVIDER_TIMEOUT,
      retryable: true,
    };
  }

  const status = getProviderStatus(error);

  if (status >= 500) {
    return {
      code: RELAY_ERROR_CODES.PROVIDER_UNAVAILABLE,
      retryable: true,
    };
  }

  return {
    code: RELAY_ERROR_CODES.PROVIDER_REJECTED,
    retryable: false,
  };
}

export function providerErrorEnvelope(error, { unknownAfterProviderCall = false } = {}) {
  const classification = classifyProviderFailure(error);
  const details = extractProviderDetails(error);
  const code =
    unknownAfterProviderCall && classification.code === RELAY_ERROR_CODES.PROVIDER_TIMEOUT
      ? RELAY_ERROR_CODES.UNKNOWN_AFTER_PROVIDER_CALL
      : classification.code;

  return relayError({
    source: 'nhn',
    code,
    message: getProviderFrontendMessage(code, details.providerMessage),
    retryable: classification.retryable,
    providerCode: details.providerCode,
    providerMessage: details.providerMessage,
  });
}

export function extractProviderDetails(error) {
  const responseBody = error?.responseBody ?? error?.response?.data ?? null;
  const header = responseBody && typeof responseBody === 'object' ? responseBody.header : null;
  const providerCode = error?.providerCode ?? header?.resultCode ?? null;
  const providerMessage =
    error?.providerMessage ??
    header?.resultMessage ??
    (error instanceof NhnProviderError ? error.message : null);

  return { providerCode, providerMessage };
}

function getProviderStatus(error) {
  return Number(error?.status ?? error?.response?.status ?? error?.cause?.status ?? 0);
}

function getProviderDefaultMessage(code) {
  switch (code) {
    case RELAY_ERROR_CODES.PROVIDER_RATE_LIMITED:
      return 'NHN 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.';
    case RELAY_ERROR_CODES.PROVIDER_TIMEOUT:
    case RELAY_ERROR_CODES.UNKNOWN_AFTER_PROVIDER_CALL:
      return 'NHN 응답을 확인하지 못했습니다. 중복 발송 가능성을 확인한 뒤 다시 시도하세요.';
    case RELAY_ERROR_CODES.PROVIDER_REJECTED:
      return 'NHN이 요청을 거부했습니다.';
    default:
      return 'NHN 서비스를 사용할 수 없습니다.';
  }
}

function getProviderFrontendMessage(code, providerMessage) {
  if (code === RELAY_ERROR_CODES.PROVIDER_REJECTED && providerMessage) {
    return String(providerMessage);
  }

  return getProviderDefaultMessage(code);
}
