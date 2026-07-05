import { getDb } from '../../db/client.js';
import { sanitizeAuditMetadata } from '../audit/service.js';
import { RELAY_ERROR_CODES, SENDER_RESOURCE_TYPES } from '../relay/constants.js';
import { RelayError, RelayValidationError } from '../relay/errors.js';
import { KAKAO_DAILY_DEFAULT_LIMIT, getLimitScope, toLimitRequestDto } from './model.js';
import { createLimitIncreaseRequestRepository } from './repository.js';

const ACTIVE_USER_STATUS = 'active';
const ACTIVE_RESOURCE_STATUS = 'active';
const ACTIVE_LINK_STATUS = 'active';
const LIMIT_REQUEST_STATUS = Object.freeze({
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUBMITTED: 'submitted',
});
const REQUEST_CHANNELS = new Set(['sms', 'alimtalk', 'brand-message']);
const STATUS_FILTERS = new Set(['submitted', 'approved', 'rejected', 'canceled']);
const CHANNEL_ALIASES = Object.freeze({
  alimtalk: 'alimtalk',
  brand: 'brand-message',
  'brand-message': 'brand-message',
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
      const senderResourceRecord = input.channel === 'sms'
        ? null
        : await requireActiveKakaoSenderResource(repository, user.id, input.senderResourceId);
      const senderResourceId = senderResourceRecord?.resource?.id ?? null;
      const existing = await repository.findSubmittedUserRequest({
        channel: input.channel,
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
        currentLimit: input.currentLimit,
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
        request: toLimitRequestDto({ request, senderResource: senderResourceRecord?.resource ?? null }),
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

      const reviewedAt = now();
      const request = await repository.updateRequest(record.request.id, {
        status: LIMIT_REQUEST_STATUS.APPROVED,
        reviewedBy: operator.id,
        reviewedAt,
        reviewMemo: normalizeOptionalString(payload.reviewMemo),
        rejectReason: null,
      });

      await writeAuditLog(repository, {
        actorUserId: operator.id,
        action: 'limit_increase_request.approved',
        targetId: request.id,
        metadataJson: { channel: request.channel, requestedLimit: request.requestedLimit },
      });

      return { request: toLimitRequestDto({ ...record, request }) };
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
  const defaultCurrentLimit = channel === 'sms' ? null : KAKAO_DAILY_DEFAULT_LIMIT;
  const currentLimit = normalizeOptionalPositiveInteger(payload.currentLimit, 'currentLimit') ?? defaultCurrentLimit;
  const requestedLimit = normalizeRequiredPositiveInteger(payload.requestedLimit, 'requestedLimit');

  if (currentLimit !== null && requestedLimit <= currentLimit) {
    throw new RelayValidationError('requestedLimit must be greater than currentLimit.');
  }

  return {
    channel,
    currentLimit,
    reason: normalizeRequiredString(payload.reason, 'reason'),
    requestedLimit,
    senderResourceId: channel === 'sms' ? null : normalizeRequiredString(payload.senderResourceId, 'senderResourceId'),
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

async function requireActiveKakaoSenderResource(repository, userId, senderResourceId) {
  const record = await repository.getUserSenderResource({ userId, senderResourceId });
  if (
    !record
    || record.link.status !== ACTIVE_LINK_STATUS
    || record.resource.status !== ACTIVE_RESOURCE_STATUS
    || record.resource.type !== SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY
  ) {
    throw new RelayValidationError('senderResourceId must reference an active Kakao business channel.');
  }
  return record;
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
    throw new RelayValidationError('channel must be sms, alimtalk, or brand-message.');
  }
  return channel;
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

function normalizeOptionalPositiveInteger(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > MAX_LIMIT) {
    throw new RelayValidationError(`${fieldName} must be a non-negative integer up to ${MAX_LIMIT}.`);
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
