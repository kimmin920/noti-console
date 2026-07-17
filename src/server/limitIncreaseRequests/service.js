import { getDb } from '../../db/client.js';
import { sanitizeAuditMetadata } from '../audit/service.js';
import { RELAY_ERROR_CODES, SENDER_RESOURCE_TYPES } from '../relay/constants.js';
import { RelayError, RelayValidationError } from '../relay/errors.js';
import { getLimitScope, toLimitRequestDto } from './model.js';
import { createLimitIncreaseRequestRepository } from './repository.js';

const ACTIVE_USER_STATUS = 'active';
const ACTIVE_RESOURCE_STATUS = 'active';
const ACTIVE_LINK_STATUS = 'active';
const LIMIT_REQUEST_STATUS = Object.freeze({
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUBMITTED: 'submitted',
});
const KAKAO_REQUEST_STORAGE_CHANNEL = 'alimtalk';
const KAKAO_LEGACY_CHANNELS = Object.freeze(['alimtalk', 'brand-message']);
const REQUEST_CHANNELS = new Set(['sms', KAKAO_REQUEST_STORAGE_CHANNEL]);
const STATUS_FILTERS = new Set(['submitted', 'approved', 'rejected', 'canceled']);
const CHANNEL_ALIASES = Object.freeze({
  alimtalk: KAKAO_REQUEST_STORAGE_CHANNEL,
  brand: KAKAO_REQUEST_STORAGE_CHANNEL,
  'brand-message': KAKAO_REQUEST_STORAGE_CHANNEL,
  kakao: KAKAO_REQUEST_STORAGE_CHANNEL,
  sms: 'sms',
});
const MAX_LIMIT = 10_000_000;

export function createDefaultLimitIncreaseRequestService() {
  return createLimitIncreaseRequestService({
    repository: createLimitIncreaseRequestRepository(getDb()),
  });
}

export function createLimitIncreaseRequestService({ repository, now = () => new Date() }) {
  return {
    async listUserRequests({ actorUserId }) {
      const user = await requireActiveUser(repository, actorUserId);
      const requests = await repository.listUserRequests(user.id);

      return {
        requests: requests.map(toLimitRequestDto),
      };
    },

    async createRequest({ actorUserId, payload = {} }) {
      const user = await requireActiveUser(repository, actorUserId);
      const input = normalizeCreateInput(payload);
      const senderResourceRecord = await requireActiveLimitSenderResource(
        repository,
        user.id,
        input.senderResourceId,
        input.channel
      );

      if (input.requestedLimit <= senderResourceRecord.resource.quotaLimit) {
        throw new RelayValidationError('requestedLimit must be greater than the current sender resource quota limit.');
      }

      const senderResourceId = senderResourceRecord.resource.id;
      const existing = await repository.findSubmittedUserRequest({
        channels: getDuplicateRequestChannels(input.channel),
        senderResourceId,
        userId: user.id,
      });

      if (existing) {
        throw new RelayValidationError('이미 검토 중인 한도 상향 신청이 있습니다.');
      }

      const request = await repository.createRequest({
        userId: user.id,
        channel: input.channel,
        limitScope: getLimitScope(input.channel),
        senderResourceId,
        currentLimit: senderResourceRecord.resource.quotaLimit,
        requestedLimit: input.requestedLimit,
        reason: input.reason,
        status: LIMIT_REQUEST_STATUS.SUBMITTED,
      });

      await writeAuditLog(repository, {
        actorUserId: user.id,
        action: 'limit_increase_request.submitted',
        targetId: request.id,
        metadataJson: {
          channel: request.channel,
          limitScope: request.limitScope,
          senderResourceId: request.senderResourceId,
        },
      });

      return {
        request: toLimitRequestDto({ request, senderResource: senderResourceRecord.resource }),
      };
    },

    async listAdminRequests({ actorUserId, query = {} }) {
      const operator = await requireOperator(repository, actorUserId);
      const requests = await repository.listRequests({
        status: normalizeStatusFilter(query.status),
      });

      return {
        operatorUserId: operator.id,
        requests: requests.map(toLimitRequestDto),
      };
    },

    async approveRequest({ actorUserId, requestId, payload = {} }) {
      const operator = await requireOperator(repository, actorUserId);
      const record = await requireRequest(repository, requestId);

      if (record.request.status !== LIMIT_REQUEST_STATUS.SUBMITTED) {
        throw new RelayValidationError('Only submitted limit increase requests can be approved.');
      }

      requireApprovableSenderResource(record);

      const reviewedAt = now();
      const approved = await repository.approveRequestAndUpdateQuota({
        quotaLimit: record.request.requestedLimit,
        requestId: record.request.id,
        requestValues: {
          status: LIMIT_REQUEST_STATUS.APPROVED,
          reviewedBy: operator.id,
          reviewedAt,
          reviewMemo: normalizeOptionalString(payload.reviewMemo),
          rejectReason: null,
        },
        senderResourceId: record.senderResource.id,
      });
      const request = approved.request;

      await writeAuditLog(repository, {
        actorUserId: operator.id,
        action: 'limit_increase_request.approved',
        targetId: request.id,
        metadataJson: { channel: request.channel, requestedLimit: request.requestedLimit },
      });

      return { request: toLimitRequestDto({ ...record, request, senderResource: approved.resource }) };
    },

    async rejectRequest({ actorUserId, requestId, payload = {} }) {
      const operator = await requireOperator(repository, actorUserId);
      const record = await requireRequest(repository, requestId);

      if (record.request.status !== LIMIT_REQUEST_STATUS.SUBMITTED) {
        throw new RelayValidationError('Only submitted limit increase requests can be rejected.');
      }

      const rejectReason = normalizeRequiredString(payload.rejectReason, 'rejectReason');
      const reviewedAt = now();
      const request = await repository.updateRequest(record.request.id, {
        status: LIMIT_REQUEST_STATUS.REJECTED,
        reviewedBy: operator.id,
        reviewedAt,
        reviewMemo: normalizeOptionalString(payload.reviewMemo),
        rejectReason,
      });

      await writeAuditLog(repository, {
        actorUserId: operator.id,
        action: 'limit_increase_request.rejected',
        targetId: request.id,
        metadataJson: { channel: request.channel },
      });

      return { request: toLimitRequestDto({ ...record, request }) };
    },
  };
}

function normalizeCreateInput(payload) {
  const channel = normalizeChannel(payload.channel);
  const requestedLimit = normalizeRequiredPositiveInteger(payload.requestedLimit, 'requestedLimit');

  return {
    channel,
    reason: normalizeRequiredString(payload.reason, 'reason'),
    requestedLimit,
    senderResourceId: normalizeRequiredString(payload.senderResourceId, 'senderResourceId'),
  };
}

async function requireActiveUser(repository, actorUserId) {
  const userId = normalizeOptionalString(actorUserId);
  if (!userId) throw unauthorized();

  const user = await repository.getUserById(userId);
  if (!user || user.status !== ACTIVE_USER_STATUS) throw unauthorized();
  return user;
}

async function requireOperator(repository, actorUserId) {
  const user = await requireActiveUser(repository, actorUserId);
  if (!user.isOperator) throw forbidden('Operator access is required.');
  return user;
}

async function requireActiveLimitSenderResource(repository, userId, senderResourceId, channel) {
  const record = await repository.getUserSenderResource({ userId, senderResourceId });
  const expectedType = getSenderResourceType(channel);
  if (
    !record
    || record.link.status !== ACTIVE_LINK_STATUS
    || record.resource.status !== ACTIVE_RESOURCE_STATUS
    || record.resource.type !== expectedType
  ) {
    throw new RelayValidationError('senderResourceId must reference an active sender resource for the requested channel.');
  }

  if (!Number.isInteger(record.resource.quotaLimit) || record.resource.quotaLimit <= 0) {
    throw new RelayValidationError('The sender resource does not have a valid quota limit.');
  }

  return record;
}

function requireApprovableSenderResource(record) {
  const expectedType = getSenderResourceType(record.request.channel);

  if (
    !record.senderResource
    || record.senderResource.status !== ACTIVE_RESOURCE_STATUS
    || record.senderResource.type !== expectedType
  ) {
    throw new RelayValidationError('The limit increase request must reference an active sender resource.');
  }

  if (record.request.requestedLimit <= record.senderResource.quotaLimit) {
    throw new RelayValidationError('The requested limit is no longer greater than the current sender resource quota.');
  }
}

function getSenderResourceType(channel) {
  return channel === 'sms'
    ? SENDER_RESOURCE_TYPES.SMS_SEND_NO
    : SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY;
}

async function requireRequest(repository, requestId) {
  const id = normalizeRequiredString(requestId, 'requestId');
  const record = await repository.getRequestWithUserAndResource(id);
  if (!record) {
    throw new RelayError({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      message: 'Limit increase request was not found.',
      retryable: false,
      status: 404,
    });
  }
  return record;
}

function normalizeChannel(value) {
  const channel = CHANNEL_ALIASES[normalizeRequiredString(value, 'channel')];
  if (!REQUEST_CHANNELS.has(channel)) {
    throw new RelayValidationError('channel must be sms or kakao.');
  }
  return channel;
}

function getDuplicateRequestChannels(channel) {
  return channel === 'sms' ? ['sms'] : KAKAO_LEGACY_CHANNELS;
}

function normalizeStatusFilter(value) {
  const status = normalizeOptionalString(value);
  return status && STATUS_FILTERS.has(status) ? status : undefined;
}

function normalizeRequiredPositiveInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0 || number > MAX_LIMIT) {
    throw new RelayValidationError(`${fieldName} must be a positive integer up to ${MAX_LIMIT}.`);
  }
  return number;
}

function normalizeRequiredString(value, fieldName) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) throw new RelayValidationError(`${fieldName} is required.`);
  return normalized;
}

function normalizeOptionalString(value) {
  return typeof value === 'string' ? value.trim() : value == null ? null : String(value).trim();
}

async function writeAuditLog(repository, { action, actorUserId, metadataJson, targetId }) {
  await repository.createAuditLog({
    actorUserId,
    action,
    targetId,
    targetType: 'limit_increase_request',
    metadataJson: sanitizeAuditMetadata(metadataJson ?? {}),
  });
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
