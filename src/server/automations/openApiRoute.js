import {
  AUTOMATION_PROCESSING_STATUSES,
} from './service.js';
import { verifyPublOpenApiSignature } from './openApiAuth.js';

const OPEN_API_REASON_CODES = Object.freeze({
  INVALID_PAYLOAD: 'invalid_payload',
  INVALID_SIGNATURE: 'invalid_signature',
  SERVER_ERROR: 'server_error',
});

const ACCEPTED_STATUSES = new Set([
  AUTOMATION_PROCESSING_STATUSES.SENT,
  AUTOMATION_PROCESSING_STATUSES.UNSENT,
  AUTOMATION_PROCESSING_STATUSES.IGNORED_NO_RULE,
  AUTOMATION_PROCESSING_STATUSES.DUPLICATE,
  AUTOMATION_PROCESSING_STATUSES.FAILED,
]);

export async function handlePublOpenApiEventRequest({
  automationService = null,
  createAutomationService = null,
  env = process.env,
  now = () => new Date(),
  rawBody,
  request,
} = {}) {
  const signatureResult = verifyPublOpenApiSignature({
    env,
    headers: request?.headers,
    now,
    rawBody,
  });

  if (!signatureResult.ok) {
    if (signatureResult.reason === 'missing_secret') {
      return jsonOpenApiError({
        reasonCode: OPEN_API_REASON_CODES.SERVER_ERROR,
        status: 500,
      });
    }

    return jsonOpenApiError({
      reasonCode: OPEN_API_REASON_CODES.INVALID_SIGNATURE,
      status: 401,
    });
  }

  let envelope;

  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return jsonOpenApiError({
      reasonCode: OPEN_API_REASON_CODES.INVALID_PAYLOAD,
      status: 400,
    });
  }

  try {
    const service = automationService ?? createAutomationService?.();

    if (!service || typeof service.processPublAutomationEvent !== 'function') {
      return jsonOpenApiError({
        reasonCode: OPEN_API_REASON_CODES.SERVER_ERROR,
        status: 500,
      });
    }

    const result = await service.processPublAutomationEvent(envelope);
    return jsonOpenApiResponse(normalizeOpenApiServiceResult(result), serviceResultHttpStatus(result));
  } catch {
    return jsonOpenApiError({
      reasonCode: OPEN_API_REASON_CODES.SERVER_ERROR,
      status: 500,
    });
  }
}

export function normalizeOpenApiServiceResult(result = {}) {
  const deliveries = Array.isArray(result.deliveries) ? result.deliveries : [];
  const maskedRecipients = Array.from(new Set(
    deliveries
      .map((delivery) => normalizeNonEmptyString(delivery.targetPhoneMasked))
      .filter(Boolean)
  ));

  return {
    ok: Boolean(result.ok),
    status: normalizeNonEmptyString(result.status) ?? 'rejected',
    reasonCode: result.reasonCode ?? null,
    ...(normalizeNonEmptyString(result.reasonMessage) ? { reasonMessage: result.reasonMessage } : {}),
    ...(normalizeNonEmptyString(result.eventKey) ? { eventKey: result.eventKey } : {}),
    ...(normalizeNonEmptyString(result.externalEventId) ? { externalEventId: result.externalEventId } : {}),
    ...(normalizeNonEmptyString(result.channelCode) ? { channelCode: result.channelCode } : {}),
    ...(normalizeNonEmptyString(result.acceptedAt) ? { acceptedAt: result.acceptedAt } : {}),
    ...(Number.isSafeInteger(result.deliveryCount) ? { deliveryCount: result.deliveryCount } : {}),
    ...(maskedRecipients.length === 1 ? { maskedRecipient: maskedRecipients[0] } : {}),
  };
}

function serviceResultHttpStatus(result = {}) {
  if (ACCEPTED_STATUSES.has(result.status)) {
    return 202;
  }

  if (result.status === AUTOMATION_PROCESSING_STATUSES.INVALID_PAYLOAD) {
    return 400;
  }

  if (result.status === AUTOMATION_PROCESSING_STATUSES.UNKNOWN_CHANNEL_CODE) {
    return 422;
  }

  return 500;
}

function jsonOpenApiError({ reasonCode, status }) {
  return jsonOpenApiResponse({
    ok: false,
    status: 'rejected',
    reasonCode,
  }, status);
}

function jsonOpenApiResponse(body, status) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

function normalizeNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
