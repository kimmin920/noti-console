import { getDb } from '../../db/client.js';
import { isKakaoSuccessResult } from '../../features/console/messageResults/kakaoResultCodes.js';
import { isSmsSuccessResult } from '../../features/console/messageResults/smsResultCodes.js';
import { auditRelayFailure } from '../audit/service.js';
import { resolveNhnKakaoBizmessageConfig, resolveNhnSmsConfig } from '../nhn/config.js';
import { createNhnKakaoBizmessageClient } from '../nhn/kakaoBizmessageClient.js';
import { createNhnSmsClient } from '../nhn/smsClient.js';
import { CHANNELS, PROVIDERS, RELAY_ERROR_CODES } from '../relay/constants.js';
import {
  NhnProviderError,
  RelayError,
  RelayValidationError,
  isProviderRateLimit,
  isProviderTimeout,
} from '../relay/errors.js';
import { resolveGroupingFromProviderRow } from '../relay/groupingKeys.js';
import { createSettlementRepository } from './repository.js';

const USER_STATUS_ACTIVE = 'active';
const RUN_STATUS = Object.freeze({
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  FINALIZED: 'finalized',
});
const SETTLEMENT_USAGE_TYPE = 'all';
const SMS_RESULT_MESSAGE_TYPES = Object.freeze([
  { messageType: 'SMS', channel: CHANNELS.SMS },
  { messageType: 'LMS', channel: CHANNELS.LMS },
  { messageType: 'MMS', channel: CHANNELS.MMS },
]);
const DEFAULT_PAGE_SIZE = 1000;
const MAX_QUERY_RANGE_DAYS = 1;
const MAX_RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BACKOFF_MS = 100;
const NHN_TIMEZONE_OFFSET_MINUTES = 9 * 60;

export function createDefaultSettlementService() {
  return createSettlementService({
    repository: createSettlementRepository(getDb()),
    smsClient: createLazyNhnSmsClient(),
    kakaoClient: createLazyNhnKakaoBizmessageClient(),
  });
}

export function createSettlementService({
  repository,
  smsClient,
  kakaoClient,
  now = () => new Date(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  return {
    async createRun({ actorUserId, payload = {} }) {
      const operator = await requireOperator(repository, actorUserId);
      let period;

      try {
        period = normalizeSettlementPeriod(payload);
      } catch (error) {
        await auditRelayFailure({
          repository,
          error,
          actorUserId: operator.id,
          operation: 'settlement_run.create',
          targetType: 'settlement_run',
          metadataJson: {
            hasStartReceiveDate: Boolean(normalizeOptionalString(payload?.startReceiveDate)),
            hasEndReceiveDate: Boolean(normalizeOptionalString(payload?.endReceiveDate)),
          },
        });
        throw error;
      }

      let run = await repository.createSettlementRun({
        startReceiveDate: period.startReceiveDate,
        endReceiveDate: period.endReceiveDate,
        status: RUN_STATUS.RUNNING,
        requestedBy: operator.id,
        startedAt: now(),
      });

      await repository.createAuditLog({
        actorUserId: operator.id,
        action: 'settlement_run.created',
        targetType: 'settlement_run',
        targetId: run.id,
        metadataJson: {
          startReceiveDate: period.startReceiveDate.toISOString(),
          endReceiveDate: period.endReceiveDate.toISOString(),
        },
      });

      try {
        const summaries = await aggregateSettlement({
          repository,
          smsClient,
          kakaoClient,
          period,
          sleep,
        });
        const insertedSummaries = await repository.createUsageSummaries(
          summaries.map((summary) => ({
            runId: run.id,
            billingAccountId: summary.billingAccountId,
            userId: summary.userId,
            channel: summary.channel,
            usageType: SETTLEMENT_USAGE_TYPE,
            deliveredCount: summary.deliveredCount,
          }))
        );
        run = await repository.updateSettlementRun(run.id, {
          status: RUN_STATUS.SUCCEEDED,
          finishedAt: now(),
          errorMessage: null,
        });

        return toRunDetailDto({ run, summaries: insertedSummaries });
      } catch (error) {
        run = await repository.updateSettlementRun(run.id, {
          status: RUN_STATUS.FAILED,
          finishedAt: now(),
          errorMessage: toSafeRunErrorMessage(error),
        });
        await auditSettlementProviderFailure({
          repository,
          operator,
          run,
          period,
          error,
        });

        return toRunDetailDto({ run, summaries: [] });
      }
    },

    async listRuns({ actorUserId, query = {} }) {
      const operator = await requireOperator(repository, actorUserId);
      const runs = await repository.listSettlementRuns({
        status: normalizeRunStatusFilter(query.status),
      });

      return {
        operatorUserId: operator.id,
        runs: runs.map(toRunDto),
      };
    },

    async getRun({ actorUserId, runId }) {
      await requireOperator(repository, actorUserId);
      const record = await requireRun(repository, runId);

      return toRunDetailDto(record);
    },

    async finalizeRun({ actorUserId, runId }) {
      const operator = await requireOperator(repository, actorUserId);
      const record = await requireRun(repository, runId);

      if (record.run.status === RUN_STATUS.FINALIZED) {
        const error = new RelayValidationError('Settlement run is already finalized.');
        await auditRelayFailure({
          repository,
          error,
          actorUserId: operator.id,
          operation: 'settlement_run.finalize',
          targetType: 'settlement_run',
          targetId: record.run.id,
        });
        throw error;
      }

      if (record.run.status !== RUN_STATUS.SUCCEEDED) {
        const error = new RelayValidationError('Only succeeded settlement runs can be finalized.');
        await auditRelayFailure({
          repository,
          error,
          actorUserId: operator.id,
          operation: 'settlement_run.finalize',
          targetType: 'settlement_run',
          targetId: record.run.id,
          metadataJson: {
            runStatus: record.run.status,
          },
        });
        throw error;
      }

      const finalizedAt = now();
      const run = await repository.updateSettlementRun(record.run.id, {
        status: RUN_STATUS.FINALIZED,
        finalizedBy: operator.id,
        finalizedAt,
      });

      await repository.createAuditLog({
        actorUserId: operator.id,
        action: 'settlement_run.finalized',
        targetType: 'settlement_run',
        targetId: run.id,
        metadataJson: {
          startReceiveDate: run.startReceiveDate.toISOString(),
          endReceiveDate: run.endReceiveDate.toISOString(),
          summaryCount: record.summaries.length,
        },
      });

      return toRunDetailDto({ run, summaries: record.summaries });
    },
  };
}

async function auditSettlementProviderFailure({ repository, operator, run, period, error }) {
  if (!isProviderRateLimit(error) && !isProviderTimeout(error)) {
    return null;
  }

  return auditRelayFailure({
    repository,
    error,
    actorUserId: operator.id,
    operation: 'settlement.aggregate',
    targetType: 'settlement_run',
    targetId: run.id,
    metadataJson: {
      startReceiveDate: period.startReceiveDate.toISOString(),
      endReceiveDate: period.endReceiveDate.toISOString(),
      runStatus: run.status,
      retryAttempts: isProviderRateLimit(error) ? MAX_RATE_LIMIT_RETRIES : 0,
    },
  });
}

async function aggregateSettlement({ repository, smsClient, kakaoClient, period, sleep }) {
  const contextResolver = await createContextResolver(repository);
  const aggregation = createUsageAggregation();

  for (const { messageType, channel } of SMS_RESULT_MESSAGE_TYPES) {
    const rows = await fetchAllResultPages({
      period,
      pageSize: DEFAULT_PAGE_SIZE,
      sleep,
      listPage: ({ range, pageNum, pageSize }) =>
        smsClient.listMessageResults({
          startUpdateDate: formatNhnDateTime(range.start, { seconds: true }),
          endUpdateDate: formatNhnDateTime(range.end, { seconds: true }),
          messageType,
          pageNum,
          pageSize,
        }),
      extractPage: extractSmsResultPage,
    });

    for (const row of rows) {
      if (!isWithinSettlementPeriod(row.resultDate ?? row.receiveDate ?? row.updateDate, period)) continue;
      if (!isSuccessfulSmsResult(row)) continue;

      const grouping = resolveGroupingFromProviderRow(row);
      const context = contextResolver.resolve(grouping);
      if (!context) continue;

      aggregation.add({
        context,
        channel: normalizeSmsResultChannel(row, channel),
        providerKey: buildProviderRecipientKey(CHANNELS.SMS, row),
      });
    }
  }

  const alimtalkRows = await fetchAllResultPages({
    period,
    pageSize: DEFAULT_PAGE_SIZE,
    sleep,
    listPage: ({ range, pageNum, pageSize }) =>
      kakaoClient.listAlimtalkMessageResults({
        startUpdateDate: formatNhnDateTime(range.start, { seconds: false }),
        endUpdateDate: formatNhnDateTime(range.end, { seconds: false }),
        pageNum,
        pageSize,
      }),
    extractPage: extractAlimtalkResultPage,
  });

  for (const row of alimtalkRows) {
    if (!isWithinSettlementPeriod(row.receiveDate ?? row.resultDate ?? row.updateDate, period)) continue;

    const isAlimtalkDelivered = isSuccessfulAlimtalkResult(row);
    const isFallbackDelivered = !isAlimtalkDelivered && isSuccessfulAlimtalkFallback(row);
    if (!isAlimtalkDelivered && !isFallbackDelivered) continue;

    const rowWithGrouping = await ensureAlimtalkGrouping({
      row,
      kakaoClient,
      sleep,
    });
    const grouping = resolveGroupingFromProviderRow(rowWithGrouping);
    const context = contextResolver.resolve(grouping);
    if (!context) continue;

    if (isAlimtalkDelivered) {
      aggregation.add({
        context,
        channel: CHANNELS.ALIMTALK,
        providerKey: buildProviderRecipientKey(CHANNELS.ALIMTALK, row),
      });
    } else {
      const fallbackKey = buildFallbackProviderRecipientKey(row);
      aggregation.add({
        context,
        channel: CHANNELS.SMS,
        providerKey: fallbackKey,
        aliases: fallbackKey.startsWith(`${CHANNELS.SMS}:`) ? [fallbackKey] : [],
      });
    }
  }

  return aggregation.toSummaries();
}

async function fetchAllResultPages({ period, pageSize, sleep, listPage, extractPage }) {
  const rows = [];

  for (const range of splitDateRange(period.startReceiveDate, period.endReceiveDate, MAX_QUERY_RANGE_DAYS)) {
    let pageNum = 1;

    while (true) {
      const response = await callProviderWithRateLimitRetry({
        sleep,
        operation: () => listPage({ range, pageNum, pageSize }),
      });
      const page = extractPage(response);
      rows.push(...page.items);

      if (
        !hasNextPage({
          pageNum,
          pageSize: page.pageSize ?? pageSize,
          totalCount: page.totalCount,
          receivedCount: page.items.length,
        })
      ) {
        break;
      }

      pageNum += 1;
    }
  }

  return rows;
}

async function ensureAlimtalkGrouping({ row, kakaoClient, sleep }) {
  if (resolveGroupingFromProviderRow(row)) return row;

  const requestId = normalizeOptionalString(row.requestId);
  const recipientSeq = normalizeOptionalInteger(row.recipientSeq);
  if (!requestId || recipientSeq === null) return row;

  const detail = await callProviderWithRateLimitRetry({
    sleep,
    operation: () => kakaoClient.getAlimtalkMessage({ requestId, recipientSeq }),
  });
  const detailRow = extractAlimtalkDetail(detail);

  return {
    ...detailRow,
    ...row,
    senderGroupingKey: row.senderGroupingKey ?? detailRow.senderGroupingKey,
    recipientGroupingKey: row.recipientGroupingKey ?? detailRow.recipientGroupingKey,
  };
}

async function callProviderWithRateLimitRetry({ sleep, operation }) {
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (!isProviderRateLimit(error) || attempt >= MAX_RATE_LIMIT_RETRIES) {
        throw error;
      }

      await sleep(RATE_LIMIT_BACKOFF_MS * 2 ** attempt);
      attempt += 1;
    }
  }
}

async function createContextResolver(repository) {
  const [userRows, billingRows, resourceRows, linkRows] = await Promise.all([
    repository.listUsers(),
    repository.listBillingAccounts(),
    repository.listSenderResources(),
    repository.listUserSenderResources(),
  ]);
  const usersByRef = new Map(userRows.map((user) => [user.userRef, user]));
  const billingAccountsByRef = new Map(billingRows.map((billingAccount) => [billingAccount.billingRef, billingAccount]));
  const senderResourcesByRef = new Map(resourceRows.map((resource) => [resource.resourceRef, resource]));
  const linksByUserResource = new Map();

  for (const link of linkRows) {
    const key = `${link.userId}:${link.senderResourceId}`;
    const links = linksByUserResource.get(key) ?? [];
    links.push(link);
    linksByUserResource.set(key, links);
  }

  return {
    resolve(grouping) {
      if (!grouping) return null;

      const user = usersByRef.get(grouping.userRef);
      const billingAccount = billingAccountsByRef.get(grouping.billingRef);
      const resource = senderResourcesByRef.get(grouping.resourceRef);

      if (!user || !billingAccount || !resource || resource.provider !== PROVIDERS.NHN) {
        return null;
      }

      const links = linksByUserResource.get(`${user.id}:${resource.id}`) ?? [];
      const hasMatchingLink = links.some((link) =>
        link.billingAccountId
          ? link.billingAccountId === billingAccount.id
          : billingAccount.ownerType === 'user' && billingAccount.ownerId === user.id
      );

      if (!hasMatchingLink) {
        return null;
      }

      return { user, billingAccount, resource };
    },
  };
}

function createUsageAggregation() {
  const summaryCounts = new Map();
  const countedProviderRows = new Set();

  return {
    add({ context, channel, providerKey, aliases = [] }) {
      const normalizedProviderKey = normalizeOptionalString(providerKey);
      if (normalizedProviderKey && countedProviderRows.has(normalizedProviderKey)) return;

      const key = [context.user.id, context.billingAccount.id, channel].join(':');
      summaryCounts.set(key, {
        userId: context.user.id,
        billingAccountId: context.billingAccount.id,
        channel,
        deliveredCount: (summaryCounts.get(key)?.deliveredCount ?? 0) + 1,
      });

      if (normalizedProviderKey) {
        countedProviderRows.add(normalizedProviderKey);
      }

      for (const alias of aliases) {
        if (alias) countedProviderRows.add(alias);
      }
    },
    toSummaries() {
      return [...summaryCounts.values()].sort(compareSummaries);
    },
  };
}

function extractSmsResultPage(response) {
  const body = response?.body ?? {};
  const data = body.data;
  const items = Array.isArray(data?.resultUpdateList)
    ? data.resultUpdateList
    : Array.isArray(data)
      ? data
      : Array.isArray(response?.resultUpdateList)
        ? response.resultUpdateList
        : [];

  return {
    items,
    pageSize: normalizeOptionalInteger(body.pageSize),
    totalCount: normalizeOptionalInteger(body.totalCount),
  };
}

function extractAlimtalkResultPage(response) {
  const body = response?.body ?? {};
  const items = body.messages ?? response?.messages ?? body.data ?? [];

  return {
    items: Array.isArray(items) ? items : [],
    pageSize: normalizeOptionalInteger(body.pageSize),
    totalCount: normalizeOptionalInteger(body.totalCount),
  };
}

function extractAlimtalkDetail(response) {
  if (!response || typeof response !== 'object') return {};

  return (
    response.message ??
    response.messageResponse ??
    response.body?.message ??
    response.body?.messageResponse ??
    response.body?.data ??
    response.data ??
    response
  );
}

function isSuccessfulSmsResult(row) {
  const msgStatus = normalizeOptionalString(row.msgStatus ?? row.status ?? row.statusCode);
  const resultCode = normalizeOptionalString(row.resultCode);

  return isSmsSuccessResult({ resultCode, status: msgStatus });
}

function isSuccessfulAlimtalkResult(row) {
  return isKakaoSuccessResult({
    resultCode: row.resultCode,
    status: row.messageStatus,
  });
}

function isSuccessfulAlimtalkFallback(row) {
  const resendResultCode = normalizeOptionalString(row.resendResultCode ?? row.resendResult?.resultCode);

  return isSmsSuccessResult({
    resultCode: resendResultCode,
    status: row.resendStatus,
  });
}

function normalizeSmsResultChannel(row, fallback) {
  const messageType = normalizeOptionalString(row.messageType ?? row.sendType)?.toUpperCase();

  if (messageType === 'SMS' || messageType === '0') return CHANNELS.SMS;
  if (messageType === 'LMS') return CHANNELS.LMS;
  if (messageType === 'MMS' || messageType === '1') return CHANNELS.MMS;

  return fallback;
}

function buildProviderRecipientKey(channel, row) {
  const requestId = normalizeOptionalString(row.requestId);
  const recipientSeq = normalizeOptionalInteger(row.recipientSeq);

  return requestId && recipientSeq !== null ? `${channel}:${requestId}:${recipientSeq}` : null;
}

function buildFallbackProviderRecipientKey(row) {
  const resendRequestId = normalizeOptionalString(row.resendRequestId);
  const recipientSeq = normalizeOptionalInteger(row.recipientSeq);

  if (resendRequestId && recipientSeq !== null) {
    return `${CHANNELS.SMS}:${resendRequestId}:${recipientSeq}`;
  }

  return buildProviderRecipientKey(`${CHANNELS.ALIMTALK}:fallback`, row);
}

function splitDateRange(start, end, maxDays) {
  const ranges = [];
  const maxMs = maxDays * 86400000;
  let cursor = new Date(start);

  while (cursor <= end) {
    const rangeEnd = new Date(Math.min(end.getTime(), cursor.getTime() + maxMs - 1000));
    ranges.push({ start: new Date(cursor), end: rangeEnd });
    cursor = new Date(rangeEnd.getTime() + 1000);
  }

  return ranges;
}

function isWithinSettlementPeriod(value, period) {
  const date = parseNhnDateTime(value);
  if (!date) return false;

  return date >= period.startReceiveDate && date <= period.endReceiveDate;
}

function normalizeSettlementPeriod(payload) {
  const input = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const startReceiveDate = parseDate(input.startReceiveDate, 'startReceiveDate');
  const endReceiveDate = parseDate(input.endReceiveDate, 'endReceiveDate');

  if (startReceiveDate > endReceiveDate) {
    throw new RelayValidationError('startReceiveDate must be before endReceiveDate.');
  }

  return { startReceiveDate, endReceiveDate };
}

function parseDate(value, name) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new RelayValidationError(`${name} is required.`);
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new RelayValidationError(`${name} must be a valid date.`);
  }

  return date;
}

function parseNhnDateTime(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  if (/[zZ]|[+-][0-9]{2}:[0-9]{2}$/.test(normalized)) {
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const withoutFraction = normalized.replace(/\.[0-9]+$/, '');
  const date = new Date(`${withoutFraction.replace(' ', 'T')}+09:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatNhnDateTime(date, { seconds }) {
  const value = new Date(date.getTime() + NHN_TIMEZONE_OFFSET_MINUTES * 60000);
  const pad = (number) => String(number).padStart(2, '0');
  const base = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ${pad(
    value.getUTCHours()
  )}:${pad(value.getUTCMinutes())}`;

  return seconds ? `${base}:${pad(value.getUTCSeconds())}` : base;
}

function hasNextPage({ pageNum, pageSize, totalCount, receivedCount }) {
  if (!receivedCount) return false;
  if (Number.isInteger(totalCount)) {
    return pageNum * pageSize < totalCount;
  }

  return receivedCount >= pageSize;
}

async function requireOperator(repository, actorUserId) {
  const user = await requireActiveUser(repository, actorUserId);

  if (!user.isOperator) {
    throw forbidden('Operator access is required.');
  }

  return user;
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

async function requireRun(repository, runId) {
  const normalizedRunId = normalizeRequiredString(runId, 'runId');
  const run = await repository.getSettlementRunWithSummaries(normalizedRunId);

  if (!run) {
    throw new RelayError({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      message: 'Settlement run was not found.',
      retryable: false,
      status: 404,
    });
  }

  return run;
}

function normalizeRunStatusFilter(value) {
  const status = normalizeOptionalString(value);
  if (!status) return null;

  if (Object.values(RUN_STATUS).includes(status)) {
    return status;
  }

  throw new RelayValidationError('status must be running, succeeded, failed, or finalized.');
}

function toRunDetailDto({ run, summaries }) {
  return {
    run: toRunDto(run),
    summaries: summaries.map(toSummaryDto).sort(compareSummaryDtos),
  };
}

function toRunDto(run) {
  return {
    id: run.id,
    startReceiveDate: toIsoString(run.startReceiveDate),
    endReceiveDate: toIsoString(run.endReceiveDate),
    status: run.status,
    requestedBy: run.requestedBy,
    startedAt: toIsoString(run.startedAt),
    finishedAt: toIsoString(run.finishedAt),
    finalizedBy: run.finalizedBy,
    finalizedAt: toIsoString(run.finalizedAt),
    errorMessage: run.errorMessage,
    createdAt: toIsoString(run.createdAt),
  };
}

function toSummaryDto(summary) {
  return {
    id: summary.id,
    runId: summary.runId,
    billingAccountId: summary.billingAccountId,
    userId: summary.userId,
    channel: summary.channel,
    usageType: summary.usageType,
    deliveredCount: summary.deliveredCount,
    createdAt: toIsoString(summary.createdAt),
  };
}

function compareSummaries(left, right) {
  return (
    String(left.userId).localeCompare(String(right.userId)) ||
    String(left.billingAccountId).localeCompare(String(right.billingAccountId)) ||
    String(left.channel).localeCompare(String(right.channel))
  );
}

function compareSummaryDtos(left, right) {
  return compareSummaries(left, right);
}

function toSafeRunErrorMessage(error) {
  if (error instanceof NhnProviderError) {
    const message = normalizeOptionalString(error.providerMessage ?? error.message);
    return message ? `NHN settlement aggregation failed: ${message}` : 'NHN settlement aggregation failed.';
  }

  return normalizeOptionalString(error?.message) || 'Settlement aggregation failed.';
}

function toIsoString(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeRequiredString(value, name) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new RelayValidationError(`${name} is required.`);
  }

  return normalized;
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function normalizeOptionalInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function forbidden(message) {
  return new RelayError({
    code: RELAY_ERROR_CODES.FORBIDDEN,
    message,
    retryable: false,
    status: 403,
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

function createLazyNhnSmsClient() {
  let client;

  function getClient() {
    if (!client) {
      client = createNhnSmsClient({ config: resolveNhnSmsConfig() });
    }

    return client;
  }

  return {
    listMessageResults: (...args) => getClient().listMessageResults(...args),
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
    listAlimtalkMessageResults: (...args) => getClient().listAlimtalkMessageResults(...args),
    getAlimtalkMessage: (...args) => getClient().getAlimtalkMessage(...args),
  };
}
