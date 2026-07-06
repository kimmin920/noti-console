import {
  PublPappEndpointError,
  createDefaultPublPappTokenExchangeService,
  toPublPappEndpointError,
} from './tokenExchangeService.js';

export async function handlePublPappExchangeTokenRequest({
  createService = createDefaultPublPappTokenExchangeService,
  request,
  service = null,
} = {}) {
  try {
    const tokenService = service ?? createService();
    const data = await tokenService.exchangeToken({
      apiKey: getRequestApiKey(request),
      authorization: request?.headers?.get('authorization'),
    });

    return jsonPublPappResponse({ data });
  } catch (error) {
    return jsonPublPappError(error);
  }
}

export async function handlePublPappRefreshTokenRequest({
  createService = createDefaultPublPappTokenExchangeService,
  request,
  service = null,
} = {}) {
  try {
    const body = await parseJsonBody(request);
    const refreshToken = normalizeRequiredBodyString(body.refreshToken, 'refreshToken');
    const previousAccessToken = normalizeRequiredBodyString(
      body.previousAccessToken,
      'previousAccessToken'
    );
    const tokenService = service ?? createService();
    const data = await tokenService.refreshToken({
      apiKey: getRequestApiKey(request),
      authorization: request?.headers?.get('authorization'),
      previousAccessToken,
      refreshToken,
    });

    return jsonPublPappResponse({ data });
  } catch (error) {
    return jsonPublPappError(error);
  }
}

function getRequestApiKey(request) {
  try {
    return new URL(request.url).searchParams.get('apiKey');
  } catch {
    return null;
  }
}

async function parseJsonBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch (error) {
    throw createBadRequestError(error);
  }
}

function normalizeRequiredBodyString(value, fieldName) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  throw createBadRequestError(new Error(`${fieldName} is required.`));
}

function createBadRequestError(cause) {
  return new PublPappEndpointError({
    code: 'BAD_REQUEST',
    message: 'Request body is invalid',
    status: 400,
    cause,
  });
}

function jsonPublPappError(error) {
  const endpointError = toPublPappEndpointError(error);

  return jsonPublPappResponse({
    error: {
      code: endpointError.code,
      message: endpointError.message,
    },
  }, endpointError.status);
}

function jsonPublPappResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
