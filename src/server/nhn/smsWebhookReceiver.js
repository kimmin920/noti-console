import { createHash, timingSafeEqual } from 'node:crypto';

import { getDb } from '../../db/client.js';
import { getSmsResultState } from '../../features/console/messageResults/smsResultCodes.js';
import { createMessageSendLedgerRepository } from '../messageLogs/repository.js';
import { RELAY_ERROR_CODES } from '../relay/constants.js';
import { relayError, relaySuccess } from '../relay/errors.js';
import { parseRecipientGroupingKey } from '../relay/groupingKeys.js';
import { resolveNhnSmsWebhookConfig } from './config.js';

const NHN_SMS_PRODUCT_NAME = 'SMS';
const NHN_SMS_RESULT_UPDATE_EVENT = 'MESSAGE_RESULT_UPDATE';
const NHN_CONSOLE_PLACEHOLDER_APP_KEY = 'String';
const MAX_WEBHOOK_HOOKS = 1000;
const MAX_REQUEST_ID_LENGTH = 128;
const MAX_RESULT_CODE_LENGTH = 32;
const MAX_RECIPIENT_NO_LENGTH = 64;
const MAX_SIGNATURE_LENGTH = 512;
const CANCELED_MESSAGE_STATUSES = new Set(['CANCEL', 'CANCELED', 'CANCELLED']);

export function createDefaultNhnSmsWebhookReceiver() {
  return createNhnSmsWebhookReceiver({
    repository: createMessageSendLedgerRepository(getDb()),
  });
}

export function createNhnSmsWebhookReceiver({
  env = process.env,
  now = () => new Date(),
  repository,
} = {}) {
  return {
    async handleRequest(request) {
      let config;

      try {
        config = resolveNhnSmsWebhookConfig(env);
      } catch (error) {
        return jsonError({
          code: RELAY_ERROR_CODES.RELAY_CONFIG_ERROR,
          message: error.message,
          status: 500,
        });
      }

      if (!hasValidWebhookSignature(request.headers, config.signature)) {
        return jsonError({
          code: RELAY_ERROR_CODES.UNAUTHORIZED,
          message: 'Webhook signature is invalid.',
          status: 401,
        });
      }

      const payloadResult = await readWebhookJson(request);
      if (!payloadResult.ok) {
        return jsonError({
          code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
          message: payloadResult.message,
          status: 400,
        });
      }

      const validationResult = validateWebhookEnvelope(payloadResult.payload, config.appKey);
      if (validationResult.error) {
        return jsonError(validationResult.error);
      }

      if (validationResult.verificationOnly) {
        return jsonResponse(
          relaySuccess(createWebhookStats(payloadResult.payload.hooks.length, {
            ignoredCount: payloadResult.payload.hooks.length,
          })),
          200
        );
      }

      const result = await processNhnSmsWebhookPayload({
        payload: payloadResult.payload,
        repository,
        now: now(),
      });

      return jsonResponse(relaySuccess(result), 200);
    },
  };
}

export async function processNhnSmsWebhookPayload({ now = new Date(), payload, repository }) {
  const stats = createWebhookStats(payload.hooks.length);
  const entriesByRequestId = new Map();

  for (const hook of payload.hooks) {
    const normalized = normalizeWebhookHook(hook);

    if (normalized.status === 'malformed') {
      stats.malformedCount += 1;
      continue;
    }

    if (normalized.status === 'ignored') {
      stats.ignoredCount += 1;
      continue;
    }

    stats.validCount += 1;

    const entries = entriesByRequestId.get(normalized.requestId) ?? [];
    entries.push({
      ...(normalized.state === 'F' && normalized.recipientNo ? { recipientNo: normalized.recipientNo } : {}),
      recipientSeq: normalized.recipientSeq,
      resultCode: normalized.resultCode,
      state: normalized.state,
    });
    entriesByRequestId.set(normalized.requestId, entries);
  }

  for (const [providerRequestId, entries] of entriesByRequestId.entries()) {
    const merge = await repository.mergeProviderRequestResultSnapshotByProviderRequestId({
      authoritative: false,
      now,
      providerRequestId,
      results: entries,
    });

    if (!merge) {
      stats.unmatchedCount += entries.length;
      continue;
    }

    stats.updatedCount += entries.length;
    stats.changedCount += merge.changedCount;
  }

  return stats;
}

export function normalizeWebhookHook(hook) {
  if (!hook || typeof hook !== 'object') {
    return { status: 'malformed' };
  }

  if (!isSupportedSmsSenderType(hook.senderType)) {
    return { status: 'ignored' };
  }

  const requestId = normalizeBoundedString(hook.requestId, MAX_REQUEST_ID_LENGTH);
  const recipientSeq = normalizeRecipientSeq(hook.recipientSeq);
  const resultCode = normalizeResultCode(hook.resultCode);
  const recipientNo = normalizeRecipientNo(hook.recipientNo ?? hook.phoneNo ?? hook.internationalRecipientNo);

  if (!requestId || recipientSeq === null) {
    return { status: 'malformed' };
  }

  const recipientGroupingKey = hook.recipientGroupingKey ?? hook.recipientGropuingKey;
  const parsedGrouping = parseRecipientGroupingKey(recipientGroupingKey);
  if (recipientGroupingKey && (!parsedGrouping || parsedGrouping.recipientIndex !== recipientSeq - 1)) {
    return { status: 'ignored' };
  }

  const state = mapHookSnapshotState({
    messageStatus: hook.messageStatus,
    resultCode,
  });

  if (!state) {
    return { status: 'ignored' };
  }

  return {
    requestId,
    ...(recipientNo ? { recipientNo } : {}),
    recipientSeq,
    resultCode,
    state,
    status: 'valid',
  };
}

export function mapHookSnapshotState({ messageStatus, resultCode } = {}) {
  const normalizedResultCode = normalizeResultCode(resultCode);
  const normalizedStatus = normalizeMessageStatus(messageStatus);
  const resultState = getSmsResultState({ resultCode: normalizedResultCode, status: normalizedStatus });

  if (resultState === 'success') return 'S';
  if (resultState === 'failed') return 'F';
  if (!normalizedResultCode && CANCELED_MESSAGE_STATUSES.has(normalizedStatus)) return 'C';

  return null;
}

function validateWebhookEnvelope(payload, appKey) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: validationError('Webhook body must be a JSON object.') };
  }

  if (payload.productName !== NHN_SMS_PRODUCT_NAME) {
    return { error: validationError('Webhook product is not supported.') };
  }

  if (payload.event !== NHN_SMS_RESULT_UPDATE_EVENT) {
    return { error: validationError('Webhook event is not supported.') };
  }

  if (!Array.isArray(payload.hooks)) {
    return { error: validationError('Webhook hooks must be an array.') };
  }

  if (payload.hooks.length > MAX_WEBHOOK_HOOKS) {
    return { error: validationError(`Webhook hooks must contain ${MAX_WEBHOOK_HOOKS} items or fewer.`) };
  }

  if (payload.appKey === NHN_CONSOLE_PLACEHOLDER_APP_KEY) {
    return { verificationOnly: true };
  }

  if (payload.appKey !== appKey) {
    return {
      error: {
        code: RELAY_ERROR_CODES.FORBIDDEN,
        message: 'Webhook app key is not authorized.',
        status: 403,
      },
    };
  }

  return { verificationOnly: false };
}

function hasValidWebhookSignature(headers, expectedSignature) {
  const configuredSignature = normalizeBoundedString(expectedSignature, MAX_SIGNATURE_LENGTH);
  const providedSignature = normalizeBoundedString(
    headers.get('x-nhn-webhook-signature') ?? headers.get('x-toast-webhook-signature'),
    MAX_SIGNATURE_LENGTH
  );

  if (!configuredSignature || !providedSignature) return false;

  return timingSafeEqual(hashForCompare(configuredSignature), hashForCompare(providedSignature));
}

function hashForCompare(value) {
  return createHash('sha256').update(value).digest();
}

function createWebhookStats(receivedCount, overrides = {}) {
  return {
    receivedCount,
    validCount: 0,
    ignoredCount: 0,
    malformedCount: 0,
    unmatchedCount: 0,
    updatedCount: 0,
    changedCount: 0,
    ...overrides,
  };
}

async function readWebhookJson(request) {
  try {
    const payload = await request.json();
    return { ok: true, payload };
  } catch {
    return { ok: false, message: 'Webhook body must be valid JSON.' };
  }
}

function isSupportedSmsSenderType(value) {
  const senderType = normalizeMessageStatus(value);
  return senderType.includes('SMS') || senderType.includes('LMS') || senderType.includes('MMS');
}

function normalizeRecipientSeq(value) {
  const recipientSeq = Number(value);
  return Number.isSafeInteger(recipientSeq) && recipientSeq >= 1 ? recipientSeq : null;
}

function normalizeMessageStatus(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function normalizeBoundedString(value, maxLength) {
  if (typeof value !== 'string') return null;

  const normalized = value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim();

  if (!normalized || normalized.length > maxLength) return null;

  return normalized;
}

function normalizeResultCode(value) {
  if (value === null || value === undefined) return null;

  return normalizeBoundedString(String(value), MAX_RESULT_CODE_LENGTH);
}

function normalizeRecipientNo(value) {
  if (value === null || value === undefined) return null;

  return normalizeBoundedString(String(value), MAX_RECIPIENT_NO_LENGTH);
}

function validationError(message) {
  return {
    code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
    message,
    status: 400,
  };
}

function jsonError({ code, message, status }) {
  return jsonResponse(
    relayError({
      code,
      message,
      retryable: false,
    }),
    status
  );
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    status,
  });
}
