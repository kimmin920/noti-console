import { createHash, randomUUID } from 'node:crypto';

import { getDb } from '../../db/client.js';
import { auditRelayFailure } from '../audit/service.js';
import { resolveNhnKakaoBizmessageConfig, resolveNhnSmsConfig } from '../nhn/config.js';
import { createNhnKakaoBizmessageClient } from '../nhn/kakaoBizmessageClient.js';
import { createNhnSmsClient } from '../nhn/smsClient.js';
import {
  CHANNELS,
  PROVIDERS,
  RELAY_ERROR_CODES,
  SEND_RESPONSE_STATES,
  SENDER_RESOURCE_TYPES,
} from '../relay/constants.js';
import {
  RelayError,
  RelayValidationError,
  isProviderRateLimit,
  isProviderTimeout,
  providerErrorEnvelope,
} from '../relay/errors.js';
import {
  buildAlimtalkIdempotencyKey,
  buildBrandMessageIdempotencyKey,
  buildRecipientGroupingKey,
  buildSenderGroupingKey,
  deriveRequestRef,
  validateClientRequestId,
} from '../relay/groupingKeys.js';
import {
  createInitialResultSnapshot,
  createMessageSendLedgerRepository,
  getLedgerRequestResultCounts,
} from '../messageLogs/repository.js';
import {
  SmsBulkSendQuotaError,
  createMessageSendRepository,
  createSmsBulkSendRunRepository,
} from './repository.js';

const USER_STATUS_ACTIVE = 'active';
const BILLING_ACCOUNT_STATUS_ACTIVE = 'active';
const LINK_STATUS_ACTIVE = 'active';
const RESOURCE_STATUS_ACTIVE = 'active';
const MAX_RECIPIENTS = 1000;
const SMS_BULK_MAX_RECIPIENTS = 50_000;
const SMS_BULK_BATCH_SIZE = 1000;
const SMS_BULK_PAYLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MESSAGE_LOG_VISIBLE_RETENTION_DAYS = 90;
const SMS_LONG_MAX_BYTES = 2000;
const SEND_ROLES = new Set(['owner', 'sender']);
const BRAND_FREESTYLE_MODE = 'freestyle';
const BRAND_TEMPLATE_MODE = 'template';
const BRAND_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const BRAND_IMAGE_TYPES = new Set([
  'IMAGE',
  'WIDE_IMAGE',
  'MAIN_WIDE_ITEMLIST_IMAGE',
  'NORMAL_WIDE_ITEMLIST_IMAGE',
  'CAROUSEL_FEED_IMAGE',
  'CAROUSEL_COMMERCE_IMAGE',
]);
const BRAND_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const BRAND_CONTENT_REQUIRED_CHAT_BUBBLE_TYPES = new Set(['TEXT', 'IMAGE', 'WIDE']);
const BRAND_CONTENT_ALLOWED_CHAT_BUBBLE_TYPES = new Set(['TEXT', 'IMAGE', 'WIDE', 'PREMIUM_VIDEO']);
const BRAND_CONTENT_RULES = {
  IMAGE: { contentMaxLength: 1300, contentMaxLineBreak: 99 },
  PREMIUM_VIDEO: { contentMaxLength: 76, contentMaxLineBreak: 5 },
  TEXT: { contentMaxLength: 1300, contentMaxLineBreak: 99 },
  WIDE: { contentMaxLength: 76, contentMaxLineBreak: 5 },
};
const BRAND_COUPON_PLACEHOLDERS = new Set(['할인금액', '할인율', '상품명']);
const BRAND_COUPON_NUMERIC_PARAMETER_KEYS = new Set(['할인금액', '할인율']);
const BRAND_COUPON_NUMERIC_ERROR_CODE = 'COUPON_VARIABLE_NUMERIC_REQUIRED';
const BRAND_FREESTYLE_COUPON_PLACEHOLDER_UNSUPPORTED = 'BRAND_FREESTYLE_COUPON_PLACEHOLDER_UNSUPPORTED';
const BRAND_HEADER_CHAT_BUBBLE_TYPES = new Set(['WIDE_ITEM_LIST', 'PREMIUM_VIDEO']);
const BRAND_ADDITIONAL_CONTENT_CHAT_BUBBLE_TYPES = new Set(['COMMERCE']);
const BRAND_ADD_CHANNEL_BUTTON_TYPE = 'AC';
const BRAND_ADD_CHANNEL_BUTTON_NAME = '채널 추가';
const BRAND_PROVIDER_IMAGE_CHAT_BUBBLE_TYPES = new Set([
  'IMAGE',
  'WIDE',
  'COMMERCE',
]);

export function createDefaultMessageSendService() {
  const db = getDb();

  return createMessageSendService({
    repository: createMessageSendRepository(db),
    bulkRunRepository: createSmsBulkSendRunRepository(db),
    ledgerRepository: createMessageSendLedgerRepository(db),
    smsClient: createLazyNhnSmsClient(),
    kakaoClient: createLazyNhnKakaoBizmessageClient(),
  });
}

export function createMessageSendService({
  repository,
  bulkRunRepository = repository,
  ledgerRepository = null,
  smsClient,
  kakaoClient,
  now = () => new Date(),
  workerId = 'message-worker',
}) {
  return {
    async sendSms({ actorUserId, payload, sourceMetadata }) {
      const user = await requireActiveUser(repository, actorUserId);

      try {
        const sendPayload = normalizeSmsPayload(payload);
        const context = await resolveSendContext({
          repository,
          user,
          senderResourceId: sendPayload.senderResourceId,
          resourceType: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
        });
        const identity = buildSendIdentity({ context, clientRequestId: sendPayload.clientRequestId });
        const providerRequest = buildSmsProviderRequest({ sendPayload, context, identity });
        const sendMethod = sendPayload.channel === CHANNELS.SMS ? smsClient.sendSms : smsClient.sendMms;

        return executeProviderSend({
          ledgerRepository,
          repository,
          channel: sendPayload.channel,
          context,
          identity,
          ledger: buildBasicLedgerInput({
            channel: sendPayload.channel,
            context,
            createdAt: now(),
            managementTitle: payload?.managementSendName ?? payload?.managementTitle,
            recipientCount: sendPayload.recipients.length,
            requestDate: sendPayload.requestDate,
            sourceMetadata,
          }),
          recipientCount: sendPayload.recipients.length,
          normalizeProviderResponse: normalizeSmsProviderResponse,
          callProvider: () => sendMethod(providerRequest.body),
        });
      } catch (error) {
        await auditLocalValidationRejection({
          repository,
          user,
          operation: 'messages.sms.send',
          payload,
          error,
        });
        throw error;
      }
    },

    async createSmsBulkSendRun({ actorUserId, payload }) {
      const user = await requireActiveUser(repository, actorUserId);

      try {
        const createdAt = now();
        const sendPayload = normalizeSmsPayload(payload, {
          maxRecipients: SMS_BULK_MAX_RECIPIENTS,
          requireClientRequestId: false,
        });
        const context = await resolveSendContext({
          repository,
          user,
          senderResourceId: sendPayload.senderResourceId,
          resourceType: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
        });
        const quotaBucket = await requireActiveSmsQuotaBucket({
          repository: bulkRunRepository,
          userId: user.id,
          channel: sendPayload.channel,
          now: createdAt,
        });
        const runRequestId = randomUUID();
        const runRef = `run_${deriveRequestRef(runRequestId)}`;
        const batches = buildSmsBulkSendBatches({
          runRef,
          sendPayload,
          now: createdAt,
        });
        const result = await bulkRunRepository.createRunWithBatchesAndReservation({
          run: {
            runRef,
            userId: user.id,
            senderResourceId: context.resource.id,
            billingAccountId: context.billingAccount.id,
            channel: sendPayload.channel,
            managementSendName: normalizeManagementSendName(payload?.managementSendName ?? payload?.managementTitle),
            requestDate: sendPayload.requestDate ?? null,
            totalRecipients: sendPayload.recipients.length,
            batchSize: SMS_BULK_BATCH_SIZE,
            totalBatches: batches.length,
            nextBatchAvailableAt: createdAt,
          },
          batches,
          quotaBucket,
          quotaReservation: {
            expiresAt: new Date(createdAt.getTime() + SMS_BULK_PAYLOAD_TTL_MS),
          },
          now: createdAt,
        });
        await createBulkSendLedgerRows({
          batches: result.batches,
          context,
          ledgerRepository,
          managementTitle: payload?.managementSendName ?? payload?.managementTitle,
          scheduledAt: parseProviderRequestDate(sendPayload.requestDate),
          sendPayload,
          now: createdAt,
        });

        await auditSmsBulkRunCreated({
          repository,
          run: result.run,
          user,
        });

        return toSmsBulkSendRunDto(result.run, result.batches);
      } catch (error) {
        await auditLocalValidationRejection({
          repository,
          user,
          operation: 'messages.sms.bulk-run.create',
          payload: sanitizeSmsBulkRunAuditPayload(payload),
          error,
        });
        throw normalizeBulkRunError(error);
      }
    },

    async getSmsBulkSendRun({ actorUserId, runId }) {
      const user = await requireActiveUser(repository, actorUserId);
      const run = await bulkRunRepository.getRunForActor({ actorUserId: user.id, runId });

      if (!run) {
        throw forbidden('SMS bulk send run was not found.');
      }

      return toSmsBulkSendRunDto(run, await bulkRunRepository.listBatchesForRun(run.id));
    },

    async listSmsBulkSendRuns({ actorUserId, activeOnly = false }) {
      const user = await requireActiveUser(repository, actorUserId);
      const runs = await bulkRunRepository.listRunsForActor({
        actorUserId: user.id,
        activeOnly,
        limit: activeOnly ? 10 : 20,
      });
      const dtos = [];

      for (const run of runs) {
        dtos.push(toSmsBulkSendRunDto(run, await bulkRunRepository.listBatchesForRun(run.id)));
      }

      return { runs: dtos };
    },

    async processNextSmsBulkSendBatch({ workerId: nextWorkerId = workerId } = {}) {
      const claimed = await bulkRunRepository.claimNextPendingBatch({
        workerId: nextWorkerId,
        leaseExpiresAt: new Date(now().getTime() + 5 * 60 * 1000),
        now: now(),
      });

      if (!claimed) {
        return { processed: false };
      }

      const { batch, run } = claimed;

      try {
        if (!batch.payloadJson) {
          throw new RelayValidationError('SMS bulk batch payload is missing.');
        }

        const result = await sendSmsBulkProviderBatch({
          actorUserId: run.userId,
          payload: batch.payloadJson,
          repository,
          smsClient,
        });

        if (result.state === SEND_RESPONSE_STATES.ACCEPTED_BY_PROVIDER) {
          await bulkRunRepository.markBatchAccepted({
            batchId: batch.id,
            providerRequestId: result.provider?.requestId ?? null,
            now: now(),
          });
          await mirrorBulkBatchLedgerState({
            batch,
            ledgerRepository,
            providerRequestId: result.provider?.requestId ?? null,
            providerState: 'accepted',
            resultState: 'not_synced',
            now: now(),
            run,
          });
          await bulkRunRepository.consumeQuotaReservation({
            runId: run.id,
            recipientCount: batch.recipientCount,
            now: now(),
          });

          const nextRun = await bulkRunRepository.recomputeRunAggregateCounts({ runId: run.id, now: now() });

          if (nextRun && isTerminalBulkRunStatus(nextRun.status)) {
            await bulkRunRepository.releaseQuotaReservation({ runId: run.id, now: now() });
          }

          return {
            batchId: batch.id,
            processed: true,
            run: toSmsBulkSendRunDto(nextRun ?? run, await bulkRunRepository.listBatchesForRun(run.id)),
            status: 'accepted',
          };
        }

        const providerError = {
          batchId: batch.id,
          errorCode: result.error?.code ?? (
            result.state === SEND_RESPONSE_STATES.REJECTED_BY_PROVIDER
              ? RELAY_ERROR_CODES.PROVIDER_REJECTED
              : RELAY_ERROR_CODES.PROVIDER_UNAVAILABLE
          ),
          errorMessage: result.error?.message ?? (
            result.state === SEND_RESPONSE_STATES.REJECTED_BY_PROVIDER
              ? 'Provider rejected the batch.'
              : 'Provider result is unknown.'
          ),
          errorState: result.state ?? SEND_RESPONSE_STATES.UNKNOWN_AFTER_PROVIDER_CALL,
          now: now(),
        };

        if (result.state === SEND_RESPONSE_STATES.REJECTED_BY_PROVIDER) {
          await bulkRunRepository.markBatchRejected(providerError);
          await mirrorBulkBatchLedgerState({
            batch,
            failedCount: batch.recipientCount,
            ledgerRepository,
            providerState: 'rejected',
            resultFinalizedAt: now(),
            resultState: 'synced',
            now: now(),
            run,
          });
        } else {
          await bulkRunRepository.markBatchUnknown(providerError);
          await mirrorBulkBatchLedgerState({
            batch,
            ledgerRepository,
            pendingCount: batch.recipientCount,
            providerState: 'unknown',
            resultState: 'stale',
            now: now(),
            run,
          });
        }
        await bulkRunRepository.releaseQuotaReservation({ runId: run.id, now: now() });

        const nextRun = await bulkRunRepository.recomputeRunAggregateCounts({ runId: run.id, now: now() });

        return {
          batchId: batch.id,
          processed: true,
          run: toSmsBulkSendRunDto(nextRun ?? run, await bulkRunRepository.listBatchesForRun(run.id)),
          status: result.state === SEND_RESPONSE_STATES.REJECTED_BY_PROVIDER ? 'rejected' : 'unknown',
        };
      } catch (error) {
        const errorPayload = toBulkBatchError(error);
        const unknownProviderState = isProviderTimeout(error) || isProviderRateLimit(error);

        if (unknownProviderState) {
          await bulkRunRepository.markBatchUnknown({ batchId: batch.id, ...errorPayload, now: now() });
          await mirrorBulkBatchLedgerState({
            batch,
            ledgerRepository,
            pendingCount: batch.recipientCount,
            providerState: 'unknown',
            resultState: 'stale',
            now: now(),
            run,
          });
        } else {
          await bulkRunRepository.markBatchFailed({ batchId: batch.id, ...errorPayload, now: now() });
          await mirrorBulkBatchLedgerState({
            batch,
            failedCount: batch.recipientCount,
            ledgerRepository,
            providerState: 'failed',
            resultFinalizedAt: now(),
            resultState: 'synced',
            now: now(),
            run,
          });
        }

        await bulkRunRepository.releaseQuotaReservation({ runId: run.id, now: now() });

        const nextRun = await bulkRunRepository.recomputeRunAggregateCounts({ runId: run.id, now: now() });

        return {
          batchId: batch.id,
          error: errorPayload,
          processed: true,
          run: toSmsBulkSendRunDto(nextRun ?? run, await bulkRunRepository.listBatchesForRun(run.id)),
          status: unknownProviderState ? 'unknown' : 'failed',
        };
      }
    },

    async cleanupSmsBulkSendPayloads({ limit = 100 } = {}) {
      return bulkRunRepository.purgeExpiredPayloads({ now: now(), limit });
    },

    async sendAlimtalk({ actorUserId, payload, sourceMetadata }) {
      const user = await requireActiveUser(repository, actorUserId);

      try {
        const sendPayload = normalizeAlimtalkPayload(payload);
        const context = await resolveSendContext({
          repository,
          user,
          senderResourceId: sendPayload.senderResourceId,
          resourceType: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
        });
        const fallbackResource = sendPayload.fallback.enabled
          ? (
              await requireActiveUserSenderResource({
                repository,
                user: context.user,
                senderResourceId: sendPayload.fallback.smsSenderResourceId,
                resourceType: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
              })
            ).resource
          : null;
        const identity = buildSendIdentity({ context, clientRequestId: sendPayload.clientRequestId });
        const providerRequest = buildAlimtalkProviderRequest({
          sendPayload,
          context,
          identity,
          fallbackResource,
        });
        const idempotencyKey = buildAlimtalkIdempotencyKey({
          userRef: context.user.userRef,
          resourceRef: context.resource.resourceRef,
          requestRef: identity.requestRef,
        });

        return executeProviderSend({
          ledgerRepository,
          repository,
          channel: CHANNELS.ALIMTALK,
          context,
          identity,
          ledger: buildBasicLedgerInput({
            channel: CHANNELS.ALIMTALK,
            context,
            createdAt: now(),
            managementTitle: payload?.managementSendName ?? payload?.managementTitle,
            recipientCount: sendPayload.recipients.length,
            requestDate: sendPayload.requestDate,
            sourceMetadata,
          }),
          recipientCount: sendPayload.recipients.length,
          normalizeProviderResponse: normalizeAlimtalkProviderResponse,
          callProvider: () => kakaoClient.sendAlimtalkMessage(providerRequest.body, { idempotencyKey }),
        });
      } catch (error) {
        await auditLocalValidationRejection({
          repository,
          user,
          operation: 'messages.alimtalk.send',
          payload,
          error,
        });
        throw error;
      }
    },

    async sendBrandMessage({ actorUserId, payload, sourceMetadata }) {
      const user = await requireActiveUser(repository, actorUserId);

      try {
        const sendPayload = normalizeBrandMessagePayload(payload, { now: now() });
        const context = await resolveSendContext({
          repository,
          user,
          senderResourceId: sendPayload.senderResourceId,
          resourceType: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
        });
        const fallbackResource = sendPayload.fallback.enabled
          ? (
              await requireActiveUserSenderResource({
                repository,
                user: context.user,
                senderResourceId: sendPayload.fallback.smsSenderResourceId,
                resourceType: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
              })
            ).resource
          : null;
        const identity = buildSendIdentity({ context, clientRequestId: sendPayload.clientRequestId });
        const providerRequest = buildBrandMessageProviderRequest({
          sendPayload,
          context,
          identity,
          fallbackResource,
        });
        const idempotencyKey = buildBrandMessageIdempotencyKey({
          userRef: context.user.userRef,
          resourceRef: context.resource.resourceRef,
          requestRef: identity.requestRef,
        });
        const sendMethod = sendPayload.mode === BRAND_FREESTYLE_MODE
          ? kakaoClient.sendBrandFreestyleMessage
          : kakaoClient.sendBrandBasicMessage;

        return executeProviderSend({
          ledgerRepository,
          repository,
          channel: CHANNELS.BRAND_MESSAGE,
          context,
          identity,
          ledger: buildBasicLedgerInput({
            channel: CHANNELS.BRAND_MESSAGE,
            context,
            createdAt: now(),
            managementTitle: payload?.managementSendName ?? payload?.managementTitle,
            recipientCount: sendPayload.recipients.length,
            requestDate: sendPayload.requestDate,
            sourceMetadata,
          }),
          recipientCount: sendPayload.recipients.length,
          normalizeProviderResponse: normalizeBrandMessageProviderResponse,
          callProvider: () => sendMethod(providerRequest.body, { idempotencyKey }),
        });
      } catch (error) {
        await auditLocalValidationRejection({
          repository,
          user,
          operation: 'messages.brand-message.send',
          payload,
          error,
        });
        throw error;
      }
    },

    async uploadBrandImage({ actorUserId, formData }) {
      const user = await requireActiveUser(repository, actorUserId);

      try {
        const uploadPayload = normalizeBrandImageUploadPayload(formData);
        await resolveSendContext({
          repository,
          user,
          senderResourceId: uploadPayload.senderResourceId,
          resourceType: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
        });
        const providerFormData = new FormData();

        providerFormData.set('imageType', uploadPayload.imageType);
        providerFormData.set('image', uploadPayload.image, uploadPayload.image.name);

        return normalizeBrandImageUploadResponse(await kakaoClient.uploadBrandImage(providerFormData));
      } catch (error) {
        await auditLocalValidationRejection({
          repository,
          user,
          operation: 'messages.brand-message.image.upload',
          payload: formDataToAuditPayload(formData),
          error,
        });
        throw error;
      }
    },
  };
}

async function executeProviderSend({
  ledgerRepository,
  repository,
  channel,
  context,
  identity,
  ledger,
  recipientCount,
  normalizeProviderResponse,
  callProvider,
}) {
  try {
    const providerResponse = await callProvider();
    const provider = normalizeProviderResponse(providerResponse);
    const ledgerEntry = await createDirectSendLedgerEntry({
      identity,
      ledger,
      ledgerRepository,
      provider,
      providerState: 'accepted',
    });

    return buildSendResult({
      state: SEND_RESPONSE_STATES.ACCEPTED_BY_PROVIDER,
      channel,
      context,
      identity,
      recipientCount,
      provider,
      ledger: ledgerEntry,
    });
  } catch (error) {
    if (error instanceof RelayError) {
      throw error;
    }

    const unknownAfterProviderCall = isProviderTimeout(error);
    const state = unknownAfterProviderCall
      ? SEND_RESPONSE_STATES.UNKNOWN_AFTER_PROVIDER_CALL
      : SEND_RESPONSE_STATES.REJECTED_BY_PROVIDER;
    const envelope = providerErrorEnvelope(error, { unknownAfterProviderCall });

    await auditProviderFailure({
      repository,
      channel,
      context,
      identity,
      recipientCount,
      state,
      error,
      errorCode: envelope.error.code,
    });
    const provider = normalizeProviderResponse(error?.responseBody);
    const ledgerEntry = await createDirectSendLedgerEntry({
      identity,
      ledger,
      ledgerRepository,
      provider: null,
      providerState: unknownAfterProviderCall ? 'unknown' : 'rejected',
    });

    return buildSendResult({
      state,
      channel,
      context,
      identity,
      recipientCount,
      provider,
      error: envelope.error,
      ledger: ledgerEntry,
    });
  }
}

function buildBasicLedgerInput({
  channel,
  context,
  createdAt,
  managementTitle,
  recipientCount,
  requestDate,
  sourceMetadata,
}) {
  const scheduledAt = parseProviderRequestDate(requestDate);

  return {
    billingAccountId: context.billingAccount.id,
    channel,
    createdAt,
    expiresAt: addDays(createdAt, MESSAGE_LOG_VISIBLE_RETENTION_DAYS),
    managementTitle,
    recipientCount,
    scheduledAt,
    senderResourceId: context.resource.id,
    sendKind: 'basic',
    sendTiming: scheduledAt ? 'scheduled' : 'immediate',
    userId: context.user.id,
    ...normalizeMessageSourceMetadata(sourceMetadata),
  };
}

function normalizeMessageSourceMetadata(sourceMetadata) {
  if (!sourceMetadata || typeof sourceMetadata !== 'object' || Array.isArray(sourceMetadata)) {
    return {};
  }

  const sourceType = normalizeOptionalString(sourceMetadata.sourceType);

  if (sourceType !== 'automation') {
    return {};
  }

  return {
    sourceType,
    ...optionalBoundedString('sourceEventKey', sourceMetadata.sourceEventKey, 160),
    ...optionalBoundedString('sourceExternalEventId', sourceMetadata.sourceExternalEventId, 255),
    ...optionalBoundedString('sourceChannelCode', sourceMetadata.sourceChannelCode, 160),
    ...optionalStringProperty('sourceAutomationRuleId', sourceMetadata.sourceAutomationRuleId),
    ...optionalStringProperty('sourceAutomationDeliveryId', sourceMetadata.sourceAutomationDeliveryId),
  };
}

function optionalBoundedString(name, value, maxLength) {
  const normalized = normalizeOptionalString(value);
  return normalized ? { [name]: normalized.slice(0, maxLength) } : {};
}

async function createDirectSendLedgerEntry({
  identity,
  ledger,
  ledgerRepository,
  provider,
  providerState,
}) {
  if (!ledgerRepository?.createGroupWithProviderRequests || !ledger) {
    return null;
  }

  const accepted = providerState === 'accepted';
  const rejected = providerState === 'rejected';
  const unknown = providerState === 'unknown';
  const providerRequestId = accepted ? provider?.requestId ?? null : null;
  const acceptedWithProviderRequestId = Boolean(providerRequestId);
  const resultSnapshotJson = acceptedWithProviderRequestId && isResultSnapshotSupportedChannel(ledger.channel)
    ? createInitialResultSnapshot(ledger.recipientCount)
    : null;
  const pendingCount = resultSnapshotJson || unknown ? ledger.recipientCount : 0;
  const result = await ledgerRepository.createGroupWithProviderRequests({
    group: {
      acceptedRequestCount: accepted ? 1 : 0,
      billingAccountId: ledger.billingAccountId,
      channel: ledger.channel,
      createdAt: ledger.createdAt,
      expiresAt: ledger.expiresAt,
      failedCount: rejected ? ledger.recipientCount : 0,
      managementTitle: ledger.managementTitle,
      pendingCount,
      providerRequestCount: 1,
      providerState,
      resultFinalizedAt: rejected ? ledger.createdAt : null,
      resultState: rejected ? 'synced' : 'not_synced',
      scheduledAt: ledger.scheduledAt,
      sendKind: ledger.sendKind,
      sendTiming: ledger.sendTiming,
      senderResourceId: ledger.senderResourceId,
      sourceAutomationDeliveryId: ledger.sourceAutomationDeliveryId,
      sourceAutomationRuleId: ledger.sourceAutomationRuleId,
      sourceChannelCode: ledger.sourceChannelCode,
      sourceEventKey: ledger.sourceEventKey,
      sourceExternalEventId: ledger.sourceExternalEventId,
      sourceType: ledger.sourceType,
      totalRecipientCount: ledger.recipientCount,
      userId: ledger.userId,
    },
    providerRequests: [
      {
        clientRequestId: identity.clientRequestId,
        failedCount: rejected ? ledger.recipientCount : 0,
        nextSyncAt: null,
        pendingCount,
        providerRequestId,
        providerState,
        recipientCount: ledger.recipientCount,
        resultFinalizedAt: rejected ? ledger.createdAt : null,
        ...(resultSnapshotJson ? { resultSnapshotJson, resultSnapshotVersion: 0 } : {}),
        resultState: rejected ? 'synced' : 'not_synced',
        sequence: 1,
      },
    ],
    now: ledger.createdAt,
  });

  return {
    groupId: result.group.id,
    requestLocalId: result.providerRequests[0]?.id ?? null,
  };
}

async function createBulkSendLedgerRows({
  batches,
  context,
  ledgerRepository,
  managementTitle,
  scheduledAt,
  sendPayload,
  now,
}) {
  if (!ledgerRepository?.createGroupWithProviderRequests) {
    return null;
  }

  return ledgerRepository.createGroupWithProviderRequests({
    group: {
      acceptedRequestCount: 0,
      billingAccountId: context.billingAccount.id,
      channel: sendPayload.channel,
      createdAt: now,
      expiresAt: addDays(now, MESSAGE_LOG_VISIBLE_RETENTION_DAYS),
      managementTitle,
      providerRequestCount: batches.length,
      providerState: 'queued',
      resultState: 'not_synced',
      scheduledAt,
      sendKind: 'bulk',
      sendTiming: scheduledAt ? 'scheduled' : 'immediate',
      senderResourceId: context.resource.id,
      totalRecipientCount: sendPayload.recipients.length,
      userId: context.user.id,
    },
    providerRequests: batches.map((batch) => ({
      clientRequestId: batch.clientRequestId,
      nextSyncAt: null,
      providerRequestId: null,
      providerState: 'queued',
      recipientCount: batch.recipientCount,
      resultState: 'not_synced',
      sequence: batch.sequence,
    })),
    now,
  });
}

async function mirrorBulkBatchLedgerState({
  batch,
  failedCount = 0,
  ledgerRepository,
  now,
  pendingCount = 0,
  providerRequestId = null,
  providerState,
  resultFinalizedAt = null,
  resultState,
  run,
}) {
  if (!ledgerRepository?.updateProviderRequestByClientRequestId || !batch.clientRequestId) {
    return null;
  }

  const effectiveProviderState = providerState === 'accepted' && !providerRequestId ? 'unknown' : providerState;
  const resultSnapshotJson = effectiveProviderState === 'accepted'
    ? createInitialResultSnapshot(batch.recipientCount)
    : null;
  const request = await ledgerRepository.updateProviderRequestByClientRequestId({
    clientRequestId: batch.clientRequestId,
    values: {
      failedCount,
      nextSyncAt: null,
      pendingCount: resultSnapshotJson ? batch.recipientCount : pendingCount,
      providerRequestId: effectiveProviderState === 'accepted' ? providerRequestId : null,
      providerState: effectiveProviderState,
      resultFinalizedAt,
      ...(resultSnapshotJson ? { resultSnapshotJson, resultSnapshotVersion: 0 } : {}),
      resultState: effectiveProviderState === 'unknown' && resultState === 'not_synced' ? 'stale' : resultState,
      successCount: 0,
    },
    now,
  });

  if (request?.groupId) {
    await rollupLedgerGroupFromRequests({ groupId: request.groupId, ledgerRepository, now });
  }

  return request;
}

async function rollupLedgerGroupFromRequests({ groupId, ledgerRepository, now }) {
  if (!ledgerRepository?.listProviderRequestsForGroup || !ledgerRepository?.updateGroup) {
    return null;
  }

  const requests = await ledgerRepository.listProviderRequestsForGroup(groupId);
  if (!requests.length) return null;

  const acceptedRequestCount = requests.filter((request) => request.providerState === 'accepted').length;
  const providerState = getGroupProviderState(requests);
  const resultState = getGroupResultState(requests);
  const resultSyncedAt = getLatestDate(requests.map((request) => request.resultSyncedAt));
  const resultFinalizedAt = requests.every((request) => request.resultFinalizedAt)
    ? getLatestDate(requests.map((request) => request.resultFinalizedAt))
    : null;

  return ledgerRepository.updateGroup({
    groupId,
    values: {
      acceptedRequestCount,
      canceledCount: sumLedgerRequestResultCount(requests, 'canceledCount'),
      failedCount: sumLedgerRequestResultCount(requests, 'failedCount'),
      pendingCount: sumLedgerRequestResultCount(requests, 'pendingCount'),
      providerRequestCount: requests.length,
      providerState,
      resultFinalizedAt,
      resultState,
      resultSyncedAt,
      successCount: sumLedgerRequestResultCount(requests, 'successCount'),
    },
    now,
  });
}

function getGroupProviderState(requests) {
  const acceptedCount = requests.filter((request) => request.providerState === 'accepted').length;
  if (acceptedCount === requests.length) return 'accepted';
  if (acceptedCount > 0) return 'partial';
  if (requests.some((request) => request.providerState === 'unknown')) return 'unknown';
  if (requests.some((request) => request.providerState === 'failed' || request.providerState === 'rejected')) {
    return 'failed';
  }
  if (requests.some((request) => request.providerState === 'sending')) return 'sending';
  return 'queued';
}

function getGroupResultState(requests) {
  if (requests.every((request) => request.resultState === 'synced')) return 'synced';
  if (requests.some((request) => request.resultState === 'syncing')) return 'syncing';
  if (requests.some((request) => request.resultState === 'partially_synced')) return 'partially_synced';
  if (requests.some((request) => request.resultState === 'synced')) return 'partially_synced';
  if (requests.some((request) => request.resultState === 'error')) return 'error';
  if (requests.some((request) => request.resultState === 'stale')) return 'stale';
  return 'not_synced';
}

function sumLedgerRequestResultCount(requests, key) {
  return requests.reduce((total, request) => total + getLedgerRequestResultCounts(request)[key], 0);
}

function isResultSnapshotSupportedChannel(channel) {
  return (
    channel === CHANNELS.SMS
    || channel === CHANNELS.LMS
    || channel === CHANNELS.MMS
    || channel === CHANNELS.ALIMTALK
    || channel === CHANNELS.BRAND_MESSAGE
  );
}

function parseProviderRequestDate(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(normalized);
  const date = match
    ? new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] ?? '00'}+09:00`)
    : new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function getLatestDate(values) {
  const dates = values.map(toDate).filter(Boolean);
  if (!dates.length) return null;

  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function auditProviderFailure({
  repository,
  channel,
  context,
  identity,
  recipientCount,
  state,
  error,
  errorCode,
}) {
  if (!isProviderTimeout(error) && !isProviderRateLimit(error)) {
    return null;
  }

  return auditRelayFailure({
    repository,
    error,
    actorUserId: context.user.id,
    operation: `messages.${channel}.send`,
    targetType: 'sender_resource',
    targetId: context.resource.id,
    metadataJson: {
      channel,
      state,
      errorCode,
      senderResourceId: context.resource.id,
      billingAccountId: context.billingAccount.id,
      requestRef: identity.requestRef,
      recipientCount,
    },
  });
}

async function auditLocalValidationRejection({ repository, user, operation, payload, error }) {
  if (!(error instanceof RelayValidationError)) {
    return null;
  }

  return auditRelayFailure({
    repository,
    error,
    actorUserId: user.id,
    operation,
    targetType: 'message_send',
    targetId: normalizeOptionalString(payload?.senderResourceId),
    metadataJson: {
      channel: normalizeOptionalString(payload?.channel ?? payload?.messageType ?? payload?.sendType),
      senderResourceId: normalizeOptionalString(payload?.senderResourceId),
      hasClientRequestId: Boolean(normalizeOptionalString(payload?.clientRequestId)),
      recipientCount: Array.isArray(payload?.recipients ?? payload?.recipientList)
        ? (payload.recipients ?? payload.recipientList).length
        : null,
    },
  });
}

function buildSendResult({ state, channel, context, identity, ledger, recipientCount, provider, error }) {
  return {
    state,
    channel,
    clientRequestId: identity.clientRequestId,
    senderResourceId: context.resource.id,
    billingAccountId: context.billingAccount.id,
    requestRef: identity.requestRef,
    recipientCount,
    lookup: {
      channel,
      senderResourceId: context.resource.id,
      clientRequestId: identity.clientRequestId,
    },
    ...(provider ? { provider } : {}),
    ...(error ? { error } : {}),
    ...(ledger ? { ledger } : {}),
  };
}

async function resolveSendContext({ repository, user, senderResourceId, resourceType }) {
  const { link, resource } = await requireActiveUserSenderResource({
    repository,
    user,
    senderResourceId,
    resourceType,
  });
  const billingAccount = await resolveBillingAccount({ repository, user, link });

  return { user, link, resource, billingAccount };
}

async function requireActiveUser(repository, actorUserId) {
  const userId = normalizeOptionalString(actorUserId);

  if (!userId) {
    throw unauthorized();
  }

  const user = await repository.getUserById(userId);

  if (!user || user.status !== USER_STATUS_ACTIVE) {
    throw unauthorized();
  }

  return user;
}

async function requireActiveUserSenderResource({ repository, user, senderResourceId, resourceType }) {
  const normalizedSenderResourceId = normalizeRequiredString(senderResourceId, 'senderResourceId');
  const row = await repository.getUserSenderResource({
    userId: user.id,
    senderResourceId: normalizedSenderResourceId,
  });

  if (!row || !isActiveUserResource(row)) {
    throw forbidden('An active sender resource is required.');
  }

  if (!SEND_ROLES.has(row.link.role)) {
    throw forbidden('Sender access is required for this resource.');
  }

  if (row.resource.provider !== PROVIDERS.NHN || row.resource.type !== resourceType) {
    throw forbidden('Sender resource type does not match this send channel.');
  }

  return row;
}

async function resolveBillingAccount({ repository, user, link }) {
  const billingAccount = link.billingAccountId
    ? await repository.getBillingAccountById(link.billingAccountId)
    : await repository.findBillingAccountForUser(user.id);

  if (!billingAccount || billingAccount.status !== BILLING_ACCOUNT_STATUS_ACTIVE) {
    throw forbidden('An active billing account is required.');
  }

  return billingAccount;
}

function isActiveUserResource({ link, resource }) {
  return link.status === LINK_STATUS_ACTIVE && resource?.status === RESOURCE_STATUS_ACTIVE;
}

function buildSendIdentity({ context, clientRequestId }) {
  const normalizedClientRequestId = validateClientRequestId(clientRequestId);
  const requestRef = deriveRequestRef(normalizedClientRequestId);
  const senderGroupingKey = buildSenderGroupingKey({
    userRef: context.user.userRef,
    billingRef: context.billingAccount.billingRef,
    resourceRef: context.resource.resourceRef,
    requestRef,
  });

  return {
    clientRequestId: normalizedClientRequestId,
    requestRef,
    senderGroupingKey,
  };
}

function buildSmsProviderRequest({ sendPayload, context, identity }) {
  const recipientList = sendPayload.recipients.map((recipient, index) => ({
    ...recipient,
    recipientGroupingKey: buildRecipientGroupingKey(identity.senderGroupingKey, index),
  }));
  const body = {
    body: sendPayload.body,
    sendNo: context.resource.value,
    senderGroupingKey: identity.senderGroupingKey,
    recipientList,
  };

  if (sendPayload.channel !== CHANNELS.SMS) {
    body.title = sendPayload.title;
  } else if (sendPayload.title) {
    body.title = sendPayload.title;
  }

  if (sendPayload.templateCode) {
    body.templateId = sendPayload.templateCode;
  }

  if (sendPayload.requestDate) {
    body.requestDate = sendPayload.requestDate;
  }

  if (sendPayload.statsId) {
    body.statsId = sendPayload.statsId;
  }

  if (sendPayload.attachFileIdList.length) {
    body.attachFileIdList = sendPayload.attachFileIdList;
  }

  return { body };
}

function buildAlimtalkProviderRequest({ sendPayload, context, identity, fallbackResource }) {
  const resendParameter = fallbackResource
    ? buildResendParameter(sendPayload.fallback, fallbackResource)
    : null;
  const recipientList = sendPayload.recipients.map((recipient, index) => ({
    ...recipient,
    ...(resendParameter ? { resendParameter: { ...resendParameter } } : {}),
    recipientGroupingKey: buildRecipientGroupingKey(identity.senderGroupingKey, index),
  }));
  const body = {
    senderKey: context.resource.value,
    templateCode: sendPayload.templateCode,
    senderGroupingKey: identity.senderGroupingKey,
    createUser: context.user.userRef,
    recipientList,
  };

  if (sendPayload.requestDate) {
    body.requestDate = sendPayload.requestDate;
  }

  if (sendPayload.statsId) {
    body.statsId = sendPayload.statsId;
  }

  if (sendPayload.messageOption) {
    body.messageOption = sendPayload.messageOption;
  }

  return { body };
}

function buildBrandMessageProviderRequest({ sendPayload, context, identity, fallbackResource }) {
  const resendParameter = fallbackResource
    ? buildResendParameter(sendPayload.fallback, fallbackResource)
    : null;
  const recipientList = sendPayload.recipients.map((recipient, index) => ({
    ...recipient,
    ...(resendParameter ? { resendParameter: { ...resendParameter } } : {}),
    recipientGroupingKey: buildRecipientGroupingKey(identity.senderGroupingKey, index),
  }));
  const body = {
    senderKey: context.resource.value,
    pushAlarm: sendPayload.pushAlarm,
    senderGroupingKey: identity.senderGroupingKey,
    createUser: context.user.userRef,
    recipientList,
  };

  if (sendPayload.requestDate) {
    body.requestDate = sendPayload.requestDate;
  }

  if (sendPayload.statsId) {
    body.statsId = sendPayload.statsId;
  }

  if (sendPayload.resellerCode) {
    body.resellerCode = sendPayload.resellerCode;
  }

  if (sendPayload.unsubscribeNo) {
    body.unsubscribeNo = sendPayload.unsubscribeNo;
  }

  if (sendPayload.unsubscribeAuthNo) {
    body.unsubscribeAuthNo = sendPayload.unsubscribeAuthNo;
  }

  if (sendPayload.mode === BRAND_TEMPLATE_MODE) {
    body.templateCode = sendPayload.templateCode;
    return { body };
  }

  body.chatBubbleType = sendPayload.chatBubbleType;
  body.adult = sendPayload.adult;

  if (sendPayload.content) {
    body.content = sendPayload.content;
  }

  if (sendPayload.header) {
    body.header = sendPayload.header;
  }

  if (sendPayload.additionalContent) {
    body.additionalContent = sendPayload.additionalContent;
  }

  if (sendPayload.image) {
    body.image = sendPayload.image;
  }

  if (sendPayload.item) {
    body.item = sendPayload.item;
  }

  if (sendPayload.video) {
    body.video = sendPayload.video;
  }

  if (sendPayload.commerce) {
    body.commerce = sendPayload.commerce;
  }

  if (sendPayload.carousel) {
    body.carousel = sendPayload.carousel;
  }

  if (sendPayload.buttons.length) {
    body.buttons = sendPayload.buttons;
  }

  if (sendPayload.coupon) {
    body.coupon = sendPayload.coupon;
  }

  if (sendPayload.targeting) {
    body.targeting = sendPayload.targeting;
  }

  return { body };
}

function buildResendParameter(fallback, fallbackResource) {
  return {
    isResend: true,
    resendSendNo: fallbackResource.value,
    ...(fallback.resendType ? { resendType: fallback.resendType } : {}),
    ...(fallback.resendTitle ? { resendTitle: fallback.resendTitle } : {}),
    ...(fallback.resendContent ? { resendContent: fallback.resendContent } : {}),
    ...(fallback.resendUnsubscribeNo ? { resendUnsubscribeNo: fallback.resendUnsubscribeNo } : {}),
  };
}

async function sendSmsBulkProviderBatch({ actorUserId, payload, repository, smsClient }) {
  const user = await requireActiveUser(repository, actorUserId);
  const sendPayload = normalizeSmsPayload(payload);
  const context = await resolveSendContext({
    repository,
    user,
    senderResourceId: sendPayload.senderResourceId,
    resourceType: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
  });
  const identity = buildSendIdentity({ context, clientRequestId: sendPayload.clientRequestId });
  const providerRequest = buildSmsProviderRequest({ sendPayload, context, identity });
  const sendMethod = sendPayload.channel === CHANNELS.SMS ? smsClient.sendSms : smsClient.sendMms;

  return executeProviderSend({
    repository,
    channel: sendPayload.channel,
    context,
    identity,
    recipientCount: sendPayload.recipients.length,
    normalizeProviderResponse: normalizeSmsProviderResponse,
    callProvider: () => sendMethod(providerRequest.body),
  });
}

function normalizeSmsPayload(payload, { maxRecipients = MAX_RECIPIENTS, requireClientRequestId = true } = {}) {
  const input = normalizePayloadObject(payload);
  const channel = normalizeSmsChannel(input.channel ?? input.messageType ?? input.sendType);
  const body = normalizeSmsBody(input.body ?? input.content);

  return {
    channel,
    clientRequestId: requireClientRequestId
      ? validateClientRequestId(input.clientRequestId)
      : normalizeOptionalClientRequestId(input.clientRequestId),
    senderResourceId: normalizeRequiredString(input.senderResourceId, 'senderResourceId'),
    templateCode: normalizeOptionalString(input.templateCode ?? input.templateId),
    title: normalizeSmsTitle(input.title, channel),
    body,
    recipients: normalizeRecipientList(input.recipients ?? input.recipientList, normalizeSmsRecipient, {
      maxRecipients,
    }),
    requestDate: normalizeOptionalString(input.requestDate),
    statsId: normalizeStatsId(input.statsId),
    attachFileIdList: normalizeOptionalIdList(input.attachFileIdList, 'attachFileIdList'),
  };
}

function normalizeManagementSendName(value) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) return null;

  if (normalized.length > 160) {
    throw new RelayValidationError('managementSendName cannot exceed 160 characters.');
  }

  return normalized;
}

function normalizeOptionalClientRequestId(value) {
  const normalized = normalizeOptionalString(value);

  return normalized ? validateClientRequestId(normalized) : null;
}

async function requireActiveSmsQuotaBucket({ repository, userId, channel, now }) {
  if (typeof repository.findActiveSmsQuotaBucket !== 'function') {
    throw new RelayError({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      message: 'SMS quota is not configured.',
      retryable: false,
      status: 403,
    });
  }

  const bucket = await repository.findActiveSmsQuotaBucket({ userId, channel, now });

  if (!bucket) {
    throw new RelayError({
      code: RELAY_ERROR_CODES.FORBIDDEN,
      message: 'SMS quota is not configured.',
      retryable: false,
      status: 403,
    });
  }

  return bucket;
}

function buildSmsBulkSendBatches({ runRef, sendPayload, now }) {
  const payloadExpiresAt = new Date(now.getTime() + SMS_BULK_PAYLOAD_TTL_MS);
  const batches = [];

  for (let index = 0; index < sendPayload.recipients.length; index += SMS_BULK_BATCH_SIZE) {
    const sequence = batches.length + 1;
    const recipients = sendPayload.recipients.slice(index, index + SMS_BULK_BATCH_SIZE);
    const clientRequestId = createDeterministicUuid(`${runRef}:${sequence}`);

    batches.push({
      sequence,
      recipientCount: recipients.length,
      clientRequestId,
      payloadJson: {
        ...sendPayload,
        clientRequestId,
        recipients,
      },
      payloadExpiresAt,
    });
  }

  return batches;
}

export function createDeterministicClientRequestId(seedParts) {
  const parts = Array.isArray(seedParts) ? seedParts : [seedParts];
  const seed = parts
    .map((part) => normalizeOptionalString(String(part ?? '')) ?? '')
    .join(':');

  return createDeterministicUuid(seed);
}

function createDeterministicUuid(seed) {
  const bytes = createHash('sha256').update(seed).digest();

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return [...bytes.subarray(0, 16)].map((byte, index) => {
    const value = byte.toString(16).padStart(2, '0');
    return [4, 6, 8, 10].includes(index) ? `-${value}` : value;
  }).join('');
}

function toSmsBulkSendRunDto(run, batches = []) {
  const acceptedBatchCount = batches.filter((batch) => batch.status === 'accepted').length;
  const terminalBatchCount = batches.filter((batch) => (
    ['accepted', 'rejected', 'unknown', 'failed', 'canceled'].includes(batch.status)
  )).length;
  const activeBatch = batches.find((batch) => batch.status === 'sending')
    ?? batches.find((batch) => batch.status === 'pending')
    ?? null;
  const totalRecipients = run.totalRecipients ?? run.totalRecipientCount ?? 0;
  const acceptedRecipients = run.acceptedCount ?? run.acceptedRecipientCount ?? 0;
  const requestDate = normalizeOptionalString(run.requestDate);
  const channelHref = encodeURIComponent(run.channel ?? 'sms');
  const reservationChannelHref = encodeURIComponent(getReservationTabChannel(run.channel));
  const logsHref = `/logs?channel=${channelHref}`;
  const reservationsHref = `/reservations?channel=${reservationChannelHref}`;
  const resultHref = requestDate ? reservationsHref : logsHref;
  const dto = {
    id: run.id,
    runRef: run.runRef,
    managementSendName: run.managementSendName ?? null,
    sendName: run.managementSendName ?? null,
    channel: run.channel,
    senderResourceId: run.senderResourceId,
    isReservation: Boolean(requestDate),
    requestDate,
    state: run.status,
    status: run.status,
    totalRecipients,
    totalRecipientCount: totalRecipients,
    acceptedRecipients,
    acceptedRecipientCount: acceptedRecipients,
    rejectedRecipientCount: run.rejectedCount ?? 0,
    unknownRecipientCount: run.unknownCount ?? 0,
    failedRecipientCount: run.failedCount ?? 0,
    batchSize: run.batchSize,
    totalBatches: run.totalBatches,
    totalBatchCount: run.totalBatches,
    completedBatches: terminalBatchCount,
    completedBatchCount: terminalBatchCount,
    acceptedBatchCount,
    failedBatches: batches.filter((batch) => batch.status === 'failed' || batch.status === 'rejected').length,
    attentionBatches: batches.filter((batch) => batch.status === 'unknown').length,
    activeBatchSequence: activeBatch?.sequence ?? null,
    attentionReason: run.errorState ?? null,
    error: run.errorCode || run.errorMessage
      ? {
          code: run.errorCode,
          state: run.errorState,
          message: run.errorMessage,
        }
      : null,
    createdAt: toIsoStringOrNull(run.createdAt),
    startedAt: toIsoStringOrNull(run.startedAt),
    completedAt: toIsoStringOrNull(run.finishedAt),
    finishedAt: toIsoStringOrNull(run.finishedAt),
    actions: {
      logsHref,
      ...(requestDate ? { reservationsHref } : {}),
      resultHref,
    },
  };

  return dto;
}

function getReservationTabChannel(channel) {
  if (channel === CHANNELS.ALIMTALK || channel === CHANNELS.BRAND_MESSAGE) {
    return channel;
  }

  return CHANNELS.SMS;
}

function toIsoStringOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isTerminalBulkRunStatus(status) {
  return ['completed', 'blocked', 'failed', 'canceled'].includes(status);
}

function normalizeBulkRunError(error) {
  if (error instanceof SmsBulkSendQuotaError) {
    return new RelayError({
      code: RELAY_ERROR_CODES.FORBIDDEN,
      message: error.message,
      retryable: false,
      status: 403,
    });
  }

  return error;
}

async function auditSmsBulkRunCreated({ repository, run, user }) {
  return repository.createAuditLog({
    action: 'messages.sms.bulk_run.created',
    actorUserId: user.id,
    targetType: 'sms_bulk_send_run',
    targetId: run.id,
    metadataJson: {
      channel: run.channel,
      runRef: run.runRef,
      senderResourceId: run.senderResourceId,
      billingAccountId: run.billingAccountId,
      totalRecipients: run.totalRecipients,
      totalBatches: run.totalBatches,
    },
  });
}

function sanitizeSmsBulkRunAuditPayload(payload) {
  return {
    channel: normalizeOptionalString(payload?.channel ?? payload?.messageType ?? payload?.sendType),
    senderResourceId: normalizeOptionalString(payload?.senderResourceId),
    recipients: Array.isArray(payload?.recipients ?? payload?.recipientList)
      ? new Array((payload.recipients ?? payload.recipientList).length).fill({})
      : null,
  };
}

function toBulkBatchError(error) {
  return {
    errorCode: error instanceof RelayError ? error.code : RELAY_ERROR_CODES.PROVIDER_UNAVAILABLE,
    errorState: error instanceof RelayError ? error.state : null,
    errorMessage: normalizeOptionalString(error?.message)?.slice(0, 500) ?? 'SMS bulk batch failed.',
  };
}

function normalizeAlimtalkPayload(payload) {
  const input = normalizePayloadObject(payload);

  return {
    clientRequestId: validateClientRequestId(input.clientRequestId),
    senderResourceId: normalizeRequiredString(input.senderResourceId, 'senderResourceId'),
    templateCode: normalizeRequiredString(input.templateCode, 'templateCode'),
    recipients: normalizeRecipientList(input.recipients ?? input.recipientList, normalizeAlimtalkRecipient),
    fallback: normalizeFallback(input.fallback),
    requestDate: normalizeOptionalString(input.requestDate),
    statsId: normalizeStatsId(input.statsId),
    messageOption: normalizeMessageOption(input.messageOption),
  };
}

function normalizeBrandMessagePayload(payload, { now }) {
  const input = normalizePayloadObject(payload);
  const mode = normalizeBrandMessageMode(input.mode, input.templateCode);
  const chatBubbleType = normalizeBrandChatBubbleType(input.chatBubbleType ?? input.messageType);
  const image = normalizeBrandImage(chatBubbleType === 'COMMERCE' ? input.image ?? input.commerce : input.image);
  const requestDate = normalizeBrandRequestDate(input.requestDate, now);
  const hasProviderImage = BRAND_PROVIDER_IMAGE_CHAT_BUBBLE_TYPES.has(chatBubbleType);

  if (mode === BRAND_TEMPLATE_MODE) {
    const recipientDefaults = {
      ...optionalObjectProperty('templateParameter', input.templateParameter, 'templateParameter'),
      ...optionalObjectArrayProperty('imageParameters', input.imageParameters, 'imageParameters'),
      ...optionalObjectProperty('videoParameter', input.videoParameter, 'videoParameter'),
      ...optionalStringProperty('targeting', input.targeting),
    };
    const recipients = normalizeRecipientList(
      input.recipients ?? input.recipientList,
      normalizeBrandRecipient
    ).map((recipient) => ({
      ...recipientDefaults,
      ...recipient,
    }));
    validateBrandCouponTemplateParameters(recipients);

    return {
      mode,
      clientRequestId: validateClientRequestId(input.clientRequestId),
      senderResourceId: normalizeRequiredString(input.senderResourceId, 'senderResourceId'),
      templateCode: normalizeRequiredString(input.templateCode, 'templateCode'),
      recipients,
      fallback: normalizeBrandFallback(input.fallback),
      pushAlarm: input.pushAlarm !== false,
      requestDate,
      resellerCode: normalizeOptionalString(input.resellerCode),
      statsId: normalizeStatsId(input.statsId),
      unsubscribeNo: normalizeOptionalPhoneNumber(input.unsubscribeNo, 'unsubscribeNo'),
      unsubscribeAuthNo: normalizeOptionalString(input.unsubscribeAuthNo),
    };
  }

  const content = BRAND_CONTENT_REQUIRED_CHAT_BUBBLE_TYPES.has(chatBubbleType)
    ? normalizeRequiredString(input.content ?? input.body, 'content')
    : BRAND_CONTENT_ALLOWED_CHAT_BUBBLE_TYPES.has(chatBubbleType)
      ? normalizeOptionalString(input.content ?? input.body)
      : null;

  validateBrandContentRules(content, chatBubbleType);

  if (hasProviderImage && !image) {
    throw new RelayValidationError('image is required for this brand message type.');
  }

  const carousel = normalizeBrandCarousel(input.carousel, chatBubbleType);
  const coupon = normalizeBrandCoupon(input.coupon);
  const buttons = normalizeBrandTopLevelButtons(input.buttons, chatBubbleType, Boolean(coupon));

  return {
    mode,
    clientRequestId: validateClientRequestId(input.clientRequestId),
    senderResourceId: normalizeRequiredString(input.senderResourceId, 'senderResourceId'),
    chatBubbleType,
    content,
    header: BRAND_HEADER_CHAT_BUBBLE_TYPES.has(chatBubbleType) ? normalizeOptionalString(input.header) : null,
    additionalContent: BRAND_ADDITIONAL_CONTENT_CHAT_BUBBLE_TYPES.has(chatBubbleType)
      ? normalizeOptionalString(input.additionalContent)
      : null,
    recipients: normalizeRecipientList(input.recipients ?? input.recipientList, normalizeBrandRecipient),
    fallback: normalizeBrandFallback(input.fallback),
    pushAlarm: input.pushAlarm !== false,
    adult: Boolean(input.adult),
    requestDate,
    resellerCode: normalizeOptionalString(input.resellerCode),
    statsId: normalizeStatsId(input.statsId),
    item: chatBubbleType === 'WIDE_ITEM_LIST' ? normalizeBrandWideItemList(input.item) : null,
    video: chatBubbleType === 'PREMIUM_VIDEO' ? normalizeOptionalPlainObject(input.video, 'video') : null,
    commerce: chatBubbleType === 'COMMERCE' ? normalizeBrandCommerce(input.commerce, 'commerce') : null,
    carousel,
    buttons,
    coupon,
    image: hasProviderImage ? image : null,
    targeting: normalizeOptionalString(input.targeting),
    unsubscribeNo: normalizeOptionalPhoneNumber(input.unsubscribeNo, 'unsubscribeNo'),
    unsubscribeAuthNo: normalizeOptionalString(input.unsubscribeAuthNo),
  };
}

function validateBrandContentRules(content, chatBubbleType) {
  if (!content) {
    return;
  }

  const rules = BRAND_CONTENT_RULES[chatBubbleType];

  if (!rules) {
    return;
  }

  if (Array.from(content).length > rules.contentMaxLength) {
    throw new RelayValidationError(`content must contain at most ${rules.contentMaxLength} characters for ${chatBubbleType}.`);
  }

  const lineBreakCount = (content.match(/\r\n|\r|\n/g) ?? []).length;

  if (lineBreakCount > rules.contentMaxLineBreak) {
    throw new RelayValidationError(`content must contain at most ${rules.contentMaxLineBreak} line breaks for ${chatBubbleType}.`);
  }
}

function normalizeBrandMessageMode(value, templateCode) {
  const mode = normalizeOptionalString(value)?.toLowerCase();

  if (!mode) {
    return normalizeOptionalString(templateCode) ? BRAND_TEMPLATE_MODE : BRAND_FREESTYLE_MODE;
  }

  if (mode === BRAND_FREESTYLE_MODE || mode === 'free') return BRAND_FREESTYLE_MODE;
  if (mode === BRAND_TEMPLATE_MODE || mode === 'basic') return BRAND_TEMPLATE_MODE;

  throw new RelayValidationError('mode must be freestyle or template.');
}

function normalizeBrandChatBubbleType(value) {
  const chatBubbleType = normalizeOptionalString(value)?.toUpperCase() || 'TEXT';

  if (
    [
      'TEXT',
      'IMAGE',
      'WIDE',
      'WIDE_ITEM_LIST',
      'PREMIUM_VIDEO',
      'COMMERCE',
      'CAROUSEL_FEED',
      'CAROUSEL_COMMERCE',
    ].includes(chatBubbleType)
  ) {
    return chatBubbleType;
  }

  throw new RelayValidationError('chatBubbleType is not supported.');
}

function normalizeBrandRecipient(recipient, index) {
  const input = normalizeRecipientObject(recipient, index);
  const recipientNo = normalizeOptionalPhoneNumber(input.recipientNo ?? input.phoneNo, 'recipientNo');

  if (!recipientNo) {
    throw new RelayValidationError(`recipients[${index}].recipientNo is required.`);
  }

  return {
    recipientNo,
    ...optionalStringProperty('targeting', input.targeting),
    ...optionalStringProperty('content', input.content),
    ...optionalObjectProperty('templateParameter', input.templateParameter, `recipients[${index}].templateParameter`),
    ...optionalObjectArrayProperty('imageParameters', input.imageParameters, `recipients[${index}].imageParameters`),
    ...optionalObjectProperty('videoParameter', input.videoParameter, `recipients[${index}].videoParameter`),
    ...optionalStringProperty('unsubscribeNo', input.unsubscribeNo),
    ...optionalStringProperty('unsubscribeAuthNo', input.unsubscribeAuthNo),
  };
}

function normalizeBrandImage(value, label = 'image') {
  if (value === undefined || value === null) return null;

  const image = normalizePlainObject(value, label);
  const nestedImage = normalizeNestedPlainObject(image.image);
  const imageUrl = normalizeRequiredString(
    image.imageUrl ?? image.url ?? nestedImage.imageUrl ?? nestedImage.url,
    `${label}.imageUrl`
  );

  return {
    imageUrl,
    ...optionalStringProperty('imageLink', image.imageLink ?? image.link ?? nestedImage.imageLink ?? nestedImage.link),
    ...optionalStringProperty('imageSeq', image.imageSeq ?? nestedImage.imageSeq),
    ...optionalStringProperty('imageName', image.imageName ?? image.name ?? nestedImage.imageName ?? nestedImage.name),
    ...optionalStringProperty('imageType', image.imageType ?? nestedImage.imageType),
  };
}

function normalizeBrandWideItemList(value) {
  const item = normalizeOptionalPlainObject(value, 'item');
  const list = normalizePlainObjectArray(item?.list, 'item.list').map(normalizeBrandWideItem);

  validateBrandCarouselListLength(list, 3, 4, 'WIDE_ITEM_LIST item.list must contain 3-4 items.');
  return { list };
}

function normalizeBrandCommerceDiscountType(value) {
  return value === 'fixed' ? 'fixed' : 'rate';
}

function getNormalizedBrandDiscountRate(regularPrice, discountPrice) {
  if (!regularPrice || !discountPrice || regularPrice <= discountPrice) {
    return 0;
  }

  return Math.floor(((regularPrice - discountPrice) / regularPrice) * 100);
}

function normalizeBrandWideItem(value, index) {
  const item = normalizePlainObject(value, `item.list[${index}]`);
  const imageUrl = normalizeBrandImageUrlFromSource(item, `item.list[${index}].imageUrl`);

  return {
    ...(index === 0
      ? optionalStringProperty('title', item.title)
      : { title: normalizeRequiredString(item.title, `item.list[${index}].title`) }),
    imageUrl,
    linkMo: normalizeRequiredString(item.linkMo, `item.list[${index}].linkMo`),
    ...optionalStringProperty('linkPc', item.linkPc),
    ...optionalStringProperty('schemeAndroid', item.schemeAndroid),
    ...optionalStringProperty('schemeIos', item.schemeIos),
  };
}

function normalizeBrandCommerce(value, label) {
  const commerce = normalizePlainObject(value, label);
  const regularPrice = normalizeRequiredBrandInteger(commerce.regularPrice ?? commerce.price, `${label}.regularPrice`);
  const discountPrice = normalizeOptionalBrandInteger(commerce.discountPrice);
  let discountRate = normalizeOptionalBrandInteger(commerce.discountRate);
  let discountFixed = normalizeOptionalBrandInteger(commerce.discountFixed);

  if (discountPrice !== null && discountRate === null && discountFixed === null) {
    if (regularPrice < discountPrice) {
      throw new RelayValidationError(`${label}.discountPrice must not be greater than regularPrice.`);
    }

    if (normalizeBrandCommerceDiscountType(commerce.discountType) === 'fixed') {
      discountFixed = regularPrice - discountPrice;
    } else {
      discountRate = getNormalizedBrandDiscountRate(regularPrice, discountPrice);
    }
  }

  return {
    title: normalizeRequiredString(commerce.title, `${label}.title`),
    regularPrice,
    ...(discountPrice !== null ? { discountPrice } : {}),
    ...(discountRate !== null ? { discountRate } : {}),
    ...(discountFixed !== null ? { discountFixed } : {}),
  };
}

function normalizeBrandCoupon(value) {
  if (value === undefined || value === null) return null;

  const coupon = normalizePlainObject(value, 'coupon');

  if (Object.keys(coupon).length === 0) {
    return null;
  }

  const title = normalizeBrandCouponTitle(coupon);
  validateBrandFreestyleCouponTitle(title);

  return {
    title,
    description: normalizeRequiredString(coupon.description, 'coupon.description'),
    ...optionalStringProperty('linkMo', coupon.linkMo),
    ...optionalStringProperty('linkPc', coupon.linkPc),
    ...optionalStringProperty('schemeAndroid', coupon.schemeAndroid),
    ...optionalStringProperty('schemeIos', coupon.schemeIos),
  };
}

function normalizeBrandCouponTitle(coupon) {
  const title = normalizeOptionalString(coupon.title);

  if (title) {
    return title;
  }

  if (coupon.type === 'PERCENT') {
    return `${normalizeRequiredBrandInteger(coupon.percent, 'coupon.percent')}% 할인 쿠폰`;
  }

  if (coupon.type === 'SHIPPING') {
    return '배송비 할인 쿠폰';
  }

  if (coupon.type === 'FREE') {
    return `${normalizeRequiredString(coupon.text, 'coupon.text')} 무료 쿠폰`;
  }

  if (coupon.type === 'UP') {
    return `${normalizeRequiredString(coupon.text, 'coupon.text')} UP 쿠폰`;
  }

  return `${normalizeRequiredBrandInteger(coupon.amount, 'coupon.amount')}원 할인 쿠폰`;
}

function validateBrandFreestyleCouponTitle(title) {
  const unresolvedKeys = extractBrandCouponPlaceholderKeys(title);

  if (unresolvedKeys.length > 0) {
    throw new RelayValidationError(
      `${BRAND_FREESTYLE_COUPON_PLACEHOLDER_UNSUPPORTED}: freestyle coupon.title cannot contain unresolved coupon placeholders: ${unresolvedKeys.map(getBrandCouponPlaceholderToken).join(', ')}.`
    );
  }
}

function validateBrandCouponTemplateParameters(recipients) {
  for (const recipient of recipients) {
    const templateParameter = recipient.templateParameter;

    if (!templateParameter || typeof templateParameter !== 'object' || Array.isArray(templateParameter)) {
      continue;
    }

    const invalidNumericKeys = Array.from(BRAND_COUPON_NUMERIC_PARAMETER_KEYS).filter((key) => (
      Object.prototype.hasOwnProperty.call(templateParameter, key)
      && !/^\d+$/.test(String(getTemplateParameterScalarValue(templateParameter[key]) ?? '').trim())
    ));

    if (invalidNumericKeys.length > 0) {
      throw new RelayValidationError(
        `${BRAND_COUPON_NUMERIC_ERROR_CODE}: ${invalidNumericKeys.join(',')} variables must be numeric.`
      );
    }
  }
}

function extractBrandCouponPlaceholderKeys(value) {
  const matches = String(value ?? '').match(/#\{[^}\n]+\}/g) ?? [];

  return matches
    .map((token) => token.slice(2, -1).trim())
    .filter((key) => BRAND_COUPON_PLACEHOLDERS.has(key));
}

function getBrandCouponPlaceholderToken(key) {
  if (key === '할인금액') return '#{할인금액}';
  if (key === '할인율') return '#{할인율}';
  if (key === '상품명') return '#{상품명}';
  return `#{${key}}`;
}

function getTemplateParameterScalarValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value.value ?? value.fallbackValue ?? '';
  }

  return value;
}

function normalizeBrandCarousel(value, chatBubbleType) {
  const carousel = normalizeOptionalPlainObject(value, 'carousel');

  if (!carousel || (chatBubbleType !== 'CAROUSEL_FEED' && chatBubbleType !== 'CAROUSEL_COMMERCE')) {
    return null;
  }

  const list = normalizePlainObjectArray(carousel.list, 'carousel.list').map((item, index) => (
    normalizeBrandCarouselItem(item, index, chatBubbleType)
  ));
  const tail = normalizeBrandCarouselTail(carousel.tail);

  if (chatBubbleType === 'CAROUSEL_FEED') {
    if (carousel.head) {
      throw new RelayValidationError('carousel.head is not allowed for CAROUSEL_FEED.');
    }

    validateBrandCarouselListLength(list, 2, 6, 'CAROUSEL_FEED carousel.list must contain 2-6 items.');
    validateBrandCarouselAddChannelButtonCount(list);
    return {
      list,
      ...(tail ? { tail } : {}),
    };
  }

  const hasIntro = Boolean(carousel.head);
  validateBrandCarouselListLength(
    list,
    hasIntro ? 1 : 2,
    hasIntro ? 5 : 6,
    hasIntro
      ? 'CAROUSEL_COMMERCE carousel.list must contain 1-5 items when carousel.head exists.'
      : 'CAROUSEL_COMMERCE carousel.list must contain 2-6 items when carousel.head is omitted.'
  );
  validateBrandCarouselAddChannelButtonCount(list);

  return {
    ...(hasIntro ? { head: normalizeBrandCarouselHead(carousel.head) } : {}),
    list,
    ...(tail ? { tail } : {}),
  };
}

function validateBrandCarouselListLength(list, min, max, message) {
  if (list.length < min || list.length > max) {
    throw new RelayValidationError(message);
  }
}

function normalizeBrandCarouselHead(value) {
  const head = normalizePlainObject(value, 'carousel.head');
  const imageUrl = normalizeBrandImageUrlFromSource(head, 'carousel.head.imageUrl');
  const linkMo = normalizeOptionalString(head.linkMo);
  const linkPc = normalizeOptionalString(head.linkPc);
  const schemeAndroid = normalizeOptionalString(head.schemeAndroid);
  const schemeIos = normalizeOptionalString(head.schemeIos);

  if ((linkPc || schemeAndroid || schemeIos) && !linkMo) {
    throw new RelayValidationError('carousel.head.linkMo is required when other intro links are provided.');
  }

  return {
    content: normalizeRequiredString(head.content, 'carousel.head.content'),
    header: normalizeRequiredString(head.header, 'carousel.head.header'),
    imageUrl,
    ...optionalStringProperty('linkMo', linkMo),
    ...optionalStringProperty('linkPc', linkPc),
    ...optionalStringProperty('schemeAndroid', schemeAndroid),
    ...optionalStringProperty('schemeIos', schemeIos),
  };
}

function normalizeBrandCarouselItem(value, index, chatBubbleType) {
  const item = normalizePlainObject(value, `carousel.list[${index}]`);
  const imageUrl = normalizeBrandImageUrlFromSource(item, `carousel.list[${index}].imageUrl`);
  const buttons = normalizeBrandButtons(item.buttons, `carousel.list[${index}].buttons`);

  validateBrandCarouselButtonCount(buttons, `carousel.list[${index}].buttons`);
  validateBrandAddChannelButtons(buttons, chatBubbleType, `carousel.list[${index}].buttons`);

  const coupon = normalizeBrandCoupon(item.coupon);

  if (chatBubbleType === 'CAROUSEL_COMMERCE') {
    return {
      ...optionalStringProperty('additionalContent', item.additionalContent),
      imageUrl,
      ...optionalStringProperty('imageLink', item.imageLink),
      buttons,
      ...(coupon ? { coupon } : {}),
      commerce: normalizeBrandCommerce(item.commerce ?? item, `carousel.list[${index}].commerce`),
    };
  }

  return {
    header: normalizeRequiredString(item.header ?? item.title, `carousel.list[${index}].header`),
    message: normalizeRequiredString(
      item.message ?? item.content ?? item.description,
      `carousel.list[${index}].message`
    ),
    imageUrl,
    ...optionalStringProperty('imageLink', item.imageLink),
    buttons,
    ...(coupon ? { coupon } : {}),
  };
}

function normalizeBrandCarouselTail(value) {
  if (value === undefined || value === null) return null;

  const tail = normalizePlainObject(value, 'carousel.tail');

  return {
    linkMo: normalizeRequiredString(tail.linkMo, 'carousel.tail.linkMo'),
    ...optionalStringProperty('linkPc', tail.linkPc),
    ...optionalStringProperty('schemeAndroid', tail.schemeAndroid),
    ...optionalStringProperty('schemeIos', tail.schemeIos),
  };
}

function normalizeBrandTopLevelButtons(value, chatBubbleType, hasCoupon) {
  if (chatBubbleType === 'CAROUSEL_FEED' || chatBubbleType === 'CAROUSEL_COMMERCE') {
    return [];
  }

  const buttons = normalizeBrandButtons(value, 'buttons');
  const min = chatBubbleType === 'COMMERCE' ? 1 : 0;
  const max = getBrandTopLevelButtonMaxCount(chatBubbleType, hasCoupon);

  if (buttons.length < min) {
    throw new RelayValidationError('buttons must contain at least 1 item for COMMERCE.');
  }

  if (buttons.length > max) {
    throw new RelayValidationError(`buttons must contain at most ${max} items for ${chatBubbleType}.`);
  }

  validateBrandAddChannelButtons(buttons, chatBubbleType, 'buttons');

  return buttons;
}

function getBrandTopLevelButtonMaxCount(chatBubbleType, hasCoupon) {
  if (chatBubbleType === 'PREMIUM_VIDEO') return 1;
  if (chatBubbleType === 'WIDE' || chatBubbleType === 'WIDE_ITEM_LIST' || chatBubbleType === 'COMMERCE') return 2;
  if ((chatBubbleType === 'TEXT' || chatBubbleType === 'IMAGE') && hasCoupon) return 4;
  return 5;
}

function normalizeBrandButtons(value, label) {
  return normalizePlainObjectArray(value, label)
    .filter((button) => normalizeOptionalString(button.name))
    .map((button, index) => normalizeBrandButton(button, `${label}[${index}]`));
}

function normalizeBrandButton(button, label) {
  const name = normalizeRequiredString(button.name, `${label}.name`);
  const type = normalizeRequiredString(button.type, `${label}.type`);
  const bizFormId = normalizeOptionalString(button.bizFormId ?? button.bizFormKey);

  if (type === BRAND_ADD_CHANNEL_BUTTON_TYPE && name !== BRAND_ADD_CHANNEL_BUTTON_NAME) {
    throw new RelayValidationError(`${label}.name must be '${BRAND_ADD_CHANNEL_BUTTON_NAME}' for AC type.`);
  }

  validateBrandButtonLinkRules({ ...button, bizFormId, type }, label);

  return {
    name,
    type,
    ...optionalStringProperty('linkMo', button.linkMo),
    ...optionalStringProperty('linkPc', button.linkPc),
    ...optionalStringProperty('schemeAndroid', button.schemeAndroid),
    ...optionalStringProperty('schemeIos', button.schemeIos),
    ...optionalStringProperty('chatExtra', button.chatExtra),
    ...optionalStringProperty('chatEvent', button.chatEvent),
    ...optionalStringProperty('bizFormId', bizFormId),
  };
}

function validateBrandButtonLinkRules(button, label) {
  if (button.type === 'WL' && !isHttpUrl(button.linkMo)) {
    throw new RelayValidationError(`${label}.linkMo is required for WL buttons.`);
  }

  if (button.type === 'AL') {
    const linkCount = [
      isHttpUrl(button.linkMo),
      normalizeOptionalString(button.schemeAndroid),
      normalizeOptionalString(button.schemeIos),
    ].filter(Boolean).length;

    if (linkCount < 2) {
      throw new RelayValidationError(`${label} requires 모바일/Android/iOS 링크 중 2개 이상.`);
    }
  }

  if (button.type === 'BF' && !/^\d+$/.test(String(button.bizFormId ?? '').trim())) {
    throw new RelayValidationError(`${label}.bizFormId must be numeric.`);
  }
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value ?? '').trim());
}

function validateBrandCarouselButtonCount(buttons, label) {
  if (buttons.length < 1 || buttons.length > 2) {
    throw new RelayValidationError(`${label} must contain 1-2 items.`);
  }
}

function validateBrandAddChannelButtons(buttons, chatBubbleType, label) {
  const addChannelIndex = buttons.findIndex((button) => button.type === BRAND_ADD_CHANNEL_BUTTON_TYPE);

  if (addChannelIndex < 0) {
    return;
  }

  const mustBeFirst = chatBubbleType === 'TEXT' || chatBubbleType === 'IMAGE';
  const expectedIndex = mustBeFirst ? 0 : buttons.length - 1;

  if (addChannelIndex !== expectedIndex) {
    throw new RelayValidationError(
      mustBeFirst
        ? `${label} AC button must be the first button for ${chatBubbleType}.`
        : `${label} AC button must be the last button for ${chatBubbleType}.`
    );
  }
}

function validateBrandCarouselAddChannelButtonCount(list) {
  const count = list.reduce((total, item) => (
    total + item.buttons.filter((button) => button.type === BRAND_ADD_CHANNEL_BUTTON_TYPE).length
  ), 0);

  if (count > 1) {
    throw new RelayValidationError('AC button can only be used once across all carousel items.');
  }
}

function normalizeBrandImageUrlFromSource(source, label) {
  const nestedImage = normalizeNestedPlainObject(source.image);
  return normalizeRequiredString(source.imageUrl ?? source.url ?? nestedImage.imageUrl ?? nestedImage.url, label);
}

function normalizeNestedPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeRequiredBrandInteger(value, label) {
  const normalized = normalizeOptionalBrandInteger(value);

  if (normalized === null) {
    throw new RelayValidationError(`${label} is required.`);
  }

  return normalized;
}

function normalizeOptionalBrandInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = Number(String(value).replace(/[^0-9.-]/g, '').trim());
  return Number.isFinite(normalized) ? Math.trunc(normalized) : null;
}

function normalizeBrandFallback(value) {
  const fallback = normalizeFallback(value);

  if (!fallback.enabled) {
    return fallback;
  }

  const input = normalizePlainObject(value, 'fallback');
  const advertisement = input.advertisement && typeof input.advertisement === 'object' && !Array.isArray(input.advertisement)
    ? input.advertisement
    : {};
  const resendUnsubscribeNo = normalizeOptionalPhoneNumber(
    input.resendUnsubscribeNo ?? advertisement.unsubscribeNo ?? advertisement.unsubscribeNumber,
    'fallback.resendUnsubscribeNo'
  );

  if ((input.advertising === true || advertisement.enabled === true) && !resendUnsubscribeNo) {
    throw new RelayValidationError('fallback.resendUnsubscribeNo is required for advertising fallback.');
  }

  return {
    ...fallback,
    resendUnsubscribeNo,
  };
}

function normalizeBrandRequestDate(value, now) {
  const normalized = normalizeOptionalString(value);
  const date = normalized ? parseBrandRequestDate(normalized) : now;

  if (Number.isNaN(date.getTime())) {
    throw new RelayValidationError('requestDate must be a valid date.');
  }

  if (isRestrictedBrandMessageDate(date)) {
    throw new RelayValidationError('Brand messages cannot be sent from 20:50 to 08:00 KST.');
  }

  return normalized ? formatBrandRequestDate(date) : null;
}

function parseBrandRequestDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);

  if (match) {
    const [, year, month, day, hour, minute, second = '00'] = match;
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`);
  }

  return new Date(value);
}

function isRestrictedBrandMessageDate(date) {
  const { hour, minute } = getKstTimeParts(date);
  const minutes = hour * 60 + minute;

  return minutes >= 20 * 60 + 50 || minutes < 8 * 60;
}

function getKstTimeParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0) % 24;
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);

  return { hour, minute };
}

function formatBrandRequestDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${value.year}-${value.month}-${value.day} ${value.hour}:${value.minute}`;
}

function normalizeBrandImageUploadPayload(formData) {
  if (!formData || typeof formData.get !== 'function') {
    throw new RelayValidationError('Request body must be multipart form data.');
  }

  const senderResourceId = normalizeRequiredString(formData.get('senderResourceId'), 'senderResourceId');
  const imageType = normalizeBrandImageType(formData.get('imageType') ?? formData.get('type'));
  const image = formData.get('image') ?? formData.get('file');

  if (!image || typeof image !== 'object' || typeof image.arrayBuffer !== 'function') {
    throw new RelayValidationError('image is required.');
  }

  if (!BRAND_IMAGE_MIME_TYPES.has(image.type)) {
    throw new RelayValidationError('image must be a PNG or JPEG file.');
  }

  if (!Number.isFinite(image.size) || image.size <= 0 || image.size > BRAND_IMAGE_MAX_BYTES) {
    throw new RelayValidationError('image must be between 1 byte and 5 MB.');
  }

  return {
    senderResourceId,
    imageType,
    image,
  };
}

function normalizeBrandImageType(value) {
  const imageType = normalizeOptionalString(value)?.toUpperCase() || 'IMAGE';

  if (!BRAND_IMAGE_TYPES.has(imageType)) {
    throw new RelayValidationError('imageType is not supported.');
  }

  return imageType;
}

function normalizeBrandImageUploadResponse(response) {
  const image = response?.image ?? response?.body?.image ?? response?.body?.data ?? response?.data ?? response ?? {};

  return {
    imageSeq: normalizeOptionalString(image.imageSeq ?? image.imageId ?? image.id),
    imageUrl: normalizeOptionalString(image.imageUrl ?? image.url),
    imageName: normalizeOptionalString(image.imageName ?? image.fileName ?? image.name),
    imageType: normalizeOptionalString(image.imageType ?? image.type),
  };
}

function formDataToAuditPayload(formData) {
  if (!formData || typeof formData.get !== 'function') {
    return null;
  }

  const image = formData.get('image') ?? formData.get('file');

  return {
    senderResourceId: normalizeOptionalString(formData.get('senderResourceId')),
    imageType: normalizeOptionalString(formData.get('imageType') ?? formData.get('type')),
    hasImage: Boolean(image),
    imageSize: Number.isFinite(image?.size) ? image.size : null,
  };
}

function normalizePayloadObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RelayValidationError('Request body must be a JSON object.');
  }

  return payload;
}

function normalizeSmsChannel(value) {
  const channel = normalizeOptionalString(value)?.toLowerCase();

  if (!channel || channel === CHANNELS.SMS || channel === '0') return CHANNELS.SMS;
  if (channel === CHANNELS.LMS || channel === '1') return CHANNELS.LMS;
  if (channel === CHANNELS.MMS) return CHANNELS.MMS;

  throw new RelayValidationError('channel must be sms, lms, or mms.');
}

function normalizeSmsTitle(value, channel) {
  const title = normalizeOptionalString(value);

  if (channel !== CHANNELS.SMS && !title) {
    throw new RelayValidationError('title is required for LMS/MMS sends.');
  }

  return title;
}

function normalizeSmsBody(value) {
  const body = normalizeRequiredString(value, 'body');
  const bodyBytes = getSmsByteLength(body);

  if (bodyBytes > SMS_LONG_MAX_BYTES) {
    throw new RelayValidationError(
      `body cannot exceed ${SMS_LONG_MAX_BYTES} bytes for LMS/MMS.`
    );
  }

  return body;
}

function getSmsByteLength(value) {
  return Array.from(value).reduce((total, character) => (
    total + (character.charCodeAt(0) > 127 ? 2 : 1)
  ), 0);
}

function normalizeRecipientList(value, normalizeRecipient, { maxRecipients = MAX_RECIPIENTS } = {}) {
  if (!Array.isArray(value)) {
    throw new RelayValidationError('recipients must be an array.');
  }

  if (value.length < 1) {
    throw new RelayValidationError('recipients must include at least one recipient.');
  }

  if (value.length > maxRecipients) {
    throw new RelayValidationError(`recipients cannot exceed ${maxRecipients}.`);
  }

  return value.map((recipient, index) => normalizeRecipient(recipient, index));
}

function normalizeSmsRecipient(recipient, index) {
  const input = normalizeRecipientObject(recipient, index);
  const recipientNo = normalizeOptionalPhoneNumber(input.recipientNo ?? input.phoneNo, 'recipientNo');
  const internationalRecipientNo = normalizeOptionalPhoneNumber(
    input.internationalRecipientNo,
    'internationalRecipientNo'
  );
  const countryCode = normalizeCountryCode(input.countryCode, index);

  if (!recipientNo && !internationalRecipientNo) {
    throw new RelayValidationError(`recipients[${index}].recipientNo is required.`);
  }

  return {
    ...(recipientNo ? { recipientNo } : {}),
    ...(internationalRecipientNo ? { internationalRecipientNo } : {}),
    ...(countryCode ? { countryCode } : {}),
    ...optionalObjectProperty(
      'templateParameter',
      input.templateParameter ?? input.templateParameters,
      `recipients[${index}].templateParameter`
    ),
  };
}

function normalizeAlimtalkRecipient(recipient, index) {
  const input = normalizeRecipientObject(recipient, index);
  const recipientNo = normalizeOptionalPhoneNumber(input.recipientNo ?? input.phoneNo, 'recipientNo');

  if (!recipientNo) {
    throw new RelayValidationError(`recipients[${index}].recipientNo is required.`);
  }

  return {
    recipientNo,
    ...optionalStringProperty('content', input.content),
    ...optionalStringProperty('templateTitle', input.templateTitle),
    ...optionalStringProperty('templateSubtitle', input.templateSubtitle),
    ...optionalStringProperty('templateHeader', input.templateHeader),
    ...optionalObjectProperty('templateParameter', input.templateParameter, `recipients[${index}].templateParameter`),
    ...optionalObjectProperty('templateItem', input.templateItem, `recipients[${index}].templateItem`),
    ...optionalObjectProperty(
      'templateItemHighlight',
      input.templateItemHighlight,
      `recipients[${index}].templateItemHighlight`
    ),
    ...optionalObjectProperty(
      'templateRepresentLink',
      input.templateRepresentLink,
      `recipients[${index}].templateRepresentLink`
    ),
    ...optionalObjectArrayProperty('buttons', input.buttons, `recipients[${index}].buttons`),
    ...optionalObjectArrayProperty('quickReplies', input.quickReplies, `recipients[${index}].quickReplies`),
  };
}

function normalizeRecipientObject(recipient, index) {
  if (!recipient || typeof recipient !== 'object' || Array.isArray(recipient)) {
    throw new RelayValidationError(`recipients[${index}] must be an object.`);
  }

  return recipient;
}

function normalizeFallback(value) {
  if (value === undefined || value === null) {
    return { enabled: false };
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new RelayValidationError('fallback must be an object.');
  }

  if (!value.enabled) {
    return { enabled: false };
  }

  return {
    enabled: true,
    smsSenderResourceId: normalizeRequiredString(value.smsSenderResourceId, 'fallback.smsSenderResourceId'),
    resendType: normalizeResendType(value.resendType),
    resendTitle: normalizeOptionalString(value.resendTitle),
    resendContent: normalizeOptionalString(value.resendContent),
  };
}

function normalizeResendType(value) {
  const resendType = normalizeOptionalString(value)?.toUpperCase();

  if (!resendType) return null;
  if (resendType === 'SMS' || resendType === 'LMS') return resendType;

  throw new RelayValidationError('fallback.resendType must be SMS or LMS.');
}

function normalizeMessageOption(value) {
  if (value === undefined || value === null) return null;

  const option = normalizePlainObject(value, 'messageOption');
  const normalized = {};

  if (option.price !== undefined && option.price !== null) {
    const price = Number(option.price);

    if (!Number.isSafeInteger(price) || price < 0) {
      throw new RelayValidationError('messageOption.price must be a non-negative integer.');
    }

    normalized.price = price;
  }

  if (option.currencyType !== undefined && option.currencyType !== null) {
    normalized.currencyType = normalizeRequiredString(option.currencyType, 'messageOption.currencyType');
  }

  return Object.keys(normalized).length ? normalized : null;
}

function normalizeStatsId(value) {
  const statsId = normalizeOptionalString(value);

  if (statsId && statsId.length > 10) {
    throw new RelayValidationError('statsId must be 10 characters or fewer.');
  }

  return statsId;
}

function normalizeOptionalIdList(value, name) {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    throw new RelayValidationError(`${name} must be an array.`);
  }

  return value.map((item, index) => {
    if (typeof item !== 'string' && typeof item !== 'number') {
      throw new RelayValidationError(`${name}[${index}] must be a string or number.`);
    }

    return item;
  });
}

function normalizeCountryCode(value, index) {
  const countryCode = normalizeOptionalString(value);

  if (!countryCode) return null;

  if (!/^[0-9]{1,8}$/.test(countryCode)) {
    throw new RelayValidationError(`recipients[${index}].countryCode must contain 1-8 digits.`);
  }

  return countryCode;
}

function normalizeOptionalPhoneNumber(value, name) {
  if (value === undefined || value === null) return null;

  if (typeof value !== 'string') {
    throw new RelayValidationError(`${name} must be a string.`);
  }

  const phoneNumber = value.replace(/[\s-]/g, '');

  if (!/^\+?[0-9]{7,20}$/.test(phoneNumber)) {
    throw new RelayValidationError(`${name} must be a plausible phone number.`);
  }

  return phoneNumber;
}

function optionalStringProperty(name, value) {
  const normalized = normalizeOptionalString(value);
  return normalized ? { [name]: normalized } : {};
}

function optionalObjectProperty(name, value, label) {
  if (value === undefined || value === null) return {};
  return { [name]: normalizePlainObject(value, label) };
}

function optionalObjectArrayProperty(name, value, label) {
  if (value === undefined || value === null) return {};

  if (!Array.isArray(value)) {
    throw new RelayValidationError(`${label} must be an array.`);
  }

  return {
    [name]: value.map((item, index) => normalizePlainObject(item, `${label}[${index}]`)),
  };
}

function normalizeOptionalPlainObject(value, name) {
  if (value === undefined || value === null) return null;
  return normalizePlainObject(value, name);
}

function normalizePlainObjectArray(value, label) {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    throw new RelayValidationError(`${label} must be an array.`);
  }

  return value.map((item, index) => normalizePlainObject(item, `${label}[${index}]`));
}

function normalizePlainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RelayValidationError(`${name} must be an object.`);
  }

  return { ...value };
}

function normalizeRequiredString(value, name) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    throw new RelayValidationError(`${name} is required.`);
  }

  return normalized;
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeSmsProviderResponse(response) {
  if (!response || typeof response !== 'object') return null;

  const data = response.body?.data ?? response.data ?? {};

  return {
    header: normalizeProviderHeader(response),
    requestId: normalizeOptionalString(data.requestId),
    statusCode: normalizeOptionalString(data.statusCode),
    recipients: normalizeProviderRecipientResults(data.sendResultList),
  };
}

function normalizeAlimtalkProviderResponse(response) {
  if (!response || typeof response !== 'object') return null;

  const message = response.message ?? response.body?.message ?? response.body ?? {};

  return {
    header: normalizeProviderHeader(response),
    requestId: normalizeOptionalString(message.requestId),
    recipients: normalizeProviderRecipientResults(message.sendResults ?? message.sendResultList),
  };
}

function normalizeBrandMessageProviderResponse(response) {
  if (!response || typeof response !== 'object') return null;

  const message = response.message ?? response.body?.message ?? response.body?.data ?? response.body ?? {};

  return {
    header: normalizeProviderHeader(response),
    requestId: normalizeOptionalString(message.requestId),
    recipients: normalizeProviderRecipientResults(message.sendResults ?? message.sendResultList ?? message.recipientList),
  };
}

function normalizeProviderHeader(response) {
  return {
    resultCode: response.header?.resultCode ?? null,
    resultMessage: normalizeOptionalString(response.header?.resultMessage),
  };
}

function normalizeProviderRecipientResults(value) {
  if (!Array.isArray(value)) return [];

  return value.map((result) => {
    const item = result && typeof result === 'object' ? result : {};

    return {
      recipientSeq: normalizeOptionalSafeInteger(item.recipientSeq),
      resultCode: item.resultCode ?? null,
      resultMessage: normalizeOptionalString(item.resultMessage),
    };
  });
}

function normalizeOptionalSafeInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function unauthorized() {
  return new RelayError({
    code: RELAY_ERROR_CODES.UNAUTHORIZED,
    message: 'Authentication is required.',
    retryable: false,
    status: 401,
  });
}

function forbidden(message) {
  return new RelayError({
    code: RELAY_ERROR_CODES.FORBIDDEN,
    message,
    retryable: false,
    status: 403,
  });
}

function createLazyNhnSmsClient() {
  let client;

  function getClient() {
    if (!client) {
      client = createNhnSmsClient({ config: resolveNhnSmsConfig() });
    }

    return client;
  }

  return {
    sendSms: (...args) => getClient().sendSms(...args),
    sendMms: (...args) => getClient().sendMms(...args),
  };
}

function createLazyNhnKakaoBizmessageClient() {
  let client;

  function getClient() {
    if (!client) {
      client = createNhnKakaoBizmessageClient({ config: resolveNhnKakaoBizmessageConfig() });
    }

    return client;
  }

  return {
    sendAlimtalkMessage: (...args) => getClient().sendAlimtalkMessage(...args),
    sendBrandBasicMessage: (...args) => getClient().sendBrandBasicMessage(...args),
    sendBrandFreestyleMessage: (...args) => getClient().sendBrandFreestyleMessage(...args),
    uploadBrandImage: (...args) => getClient().uploadBrandImage(...args),
  };
}
