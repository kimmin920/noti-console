import { createHash, randomUUID } from 'node:crypto';

import { getDb } from '../../db/client.js';
import { createNhnKakaoBizmessageClient } from '../nhn/kakaoBizmessageClient.js';
import { resolveNhnKakaoBizmessageConfig, resolveNhnSmsConfig } from '../nhn/config.js';
import { createNhnSmsClient } from '../nhn/smsClient.js';
import {
  CHANNELS,
  PROVIDERS,
  RELAY_ERROR_CODES,
  SENDER_RESOURCE_TYPES,
} from '../relay/constants.js';
import { RelayError, RelayValidationError } from '../relay/errors.js';
import {
  buildAlimtalkIdempotencyKey,
  buildRecipientGroupingKey,
  buildSenderGroupingKey,
  deriveRequestRef,
  resolveGroupingFromKeys,
  validateClientRequestId,
} from '../relay/groupingKeys.js';
import { createSmsBulkSendRunRepository } from '../messages/repository.js';
import { createDefaultMessageSendService } from '../messages/service.js';
import {
  getMessageLogDemoCaseDetail,
  getMessageLogDemoCaseRecipientDetail,
  getMessageLogDemoCaseRequestRecipientDetail,
  getMessageLogDemoCaseResendResult,
  getMessageLogDemoCaseSyncResult,
  isMessageLogDemoCasesQuery,
  isMessageLogDemoGroupId,
  isMessageLogDemoProviderRequestId,
  isMessageLogDemoRequestLocalId,
  listMessageLogDemoCaseGroups,
  listMessageLogDemoCaseRequestFailures,
  listMessageLogDemoCaseRequestRecipients,
} from './devFixtures.js';
import {
  getKakaoFailureResultLabel,
  isKakaoFailureResult,
  isKakaoSuccessResult,
} from '../../features/console/messageResults/kakaoResultCodes.js';
import {
  createMessageLogRepository,
  createMessageSendLedgerRepository,
  getLedgerRequestResultCounts,
  listFailedResultSnapshotEntries,
} from './repository.js';
import {
  getSmsResultCodeLabel,
  getSmsResultState,
  isSmsFailureResult,
  isSmsSuccessResult,
} from '../../features/console/messageResults/smsResultCodes.js';

const USER_STATUS_ACTIVE = 'active';
const BILLING_ACCOUNT_STATUS_ACTIVE = 'active';
const LINK_STATUS_ACTIVE = 'active';
const RESOURCE_STATUS_ACTIVE = 'active';
const READ_ROLES = new Set(['owner', 'sender', 'viewer', 'auditor']);
const RESEND_ROLES = new Set(['owner', 'sender']);
const MAX_LOG_RANGE_DAYS = 30;
const DEFAULT_STATUS_LOOKBACK_HOURS = 24;
const DEFAULT_PROVIDER_PAGE_SIZE = 1000;
const DEFAULT_MESSAGE_RESULT_PAGE_SIZE = 1000;
const MAX_PROVIDER_LOG_PAGES_PER_RESOURCE = 100;
const MAX_MESSAGE_RESULT_PAGES_PER_WINDOW = 100;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 100;
const MAX_RECIPIENT_PAGE_SIZE = 1000;
const LEDGER_RETENTION_EXPIRED_MESSAGE = '보관 기간이 지난 발송입니다.';
const LEDGER_SYNC_LEASE_MS = 5 * 60 * 1000;
const LEDGER_SECOND_SYNC_DELAY_MS = 15 * 60 * 1000;
const MESSAGE_RESULT_FIRST_CORRECTION_DELAY_MS = 30 * 60 * 1000;
const MESSAGE_RESULT_FINAL_CORRECTION_DELAY_MS = 2 * 60 * 60 * 1000;
const MESSAGE_RESULT_WINDOW_OVERLAP_MS = 5 * 60 * 1000;
const MESSAGE_RESULT_MAX_QUERY_RANGE_MS = 24 * 60 * 60 * 1000;
const LEDGER_ARCHIVE_PURGE_DELAY_DAYS = 30;
const SMS_LEDGER_CHANNELS = [CHANNELS.SMS, CHANNELS.LMS, CHANNELS.MMS];
const KAKAO_LEDGER_CHANNELS = [CHANNELS.ALIMTALK, CHANNELS.BRAND_MESSAGE];
const RESULT_SNAPSHOT_LEDGER_CHANNELS = [...SMS_LEDGER_CHANNELS, ...KAKAO_LEDGER_CHANNELS];
const MULTIPLE_TEMPLATE_LABEL = '여러 템플릿';
const CSV_COLUMNS = [
  'id',
  'channel',
  'requestId',
  'recipientSeq',
  'senderLabel',
  'recipientNo',
  'contentPreview',
  'templateCode',
  'requestDate',
  'receiveDate',
  'status',
  'resultCode',
  'resultMessage',
];

export function createDefaultMessageLogService() {
  const db = getDb();

  return createMessageLogService({
    repository: {
      ...createMessageLogRepository(db),
      ...createMessageSendLedgerRepository(db),
      ...createSmsBulkSendRunRepository(db),
    },
    messageSendService: createDefaultMessageSendService(),
    smsClient: createLazyNhnSmsClient(),
    kakaoClient: createLazyNhnKakaoBizmessageClient(),
  });
}

export function createMessageLogService({
  repository,
  smsClient,
  kakaoClient,
  messageSendService = null,
  now = () => new Date(),
}) {
  return {
    async getStatus({ actorUserId, query = {} }) {
      const user = await requireActiveUser(repository, actorUserId);
      const channel = normalizeChannel(query.channel);
      const senderResourceId = normalizeRequiredString(query.senderResourceId, 'senderResourceId');
      const clientRequestId = validateClientRequestId(query.clientRequestId);
      const context = await requireActiveLogResource({
        repository,
        user,
        senderResourceId,
        channel,
        allowedRoles: READ_ROLES,
      });
      const requestRef = deriveRequestRef(clientRequestId);
      const senderGroupingKey = buildSenderGroupingKey({
        userRef: user.userRef,
        billingRef: context.billingAccount.billingRef,
        resourceRef: context.resource.resourceRef,
        requestRef,
      });
      const to = now();
      const from = addHours(to, -DEFAULT_STATUS_LOOKBACK_HOURS);
      const providerResult = await fetchProviderLogs({
        channel,
        resources: [context],
        from,
        to,
        pageSize: DEFAULT_PROVIDER_PAGE_SIZE,
        extraQuery: { senderGroupingKey },
        smsClient,
        kakaoClient,
      });
      const logs = providerResult.rows
        .map((row) => authorizeAndNormalizeLog({ row, user, resources: [context] }))
        .filter(Boolean)
        .filter((log) => log.grouping?.requestRef === requestRef);

      await mergeStatusLogsIntoLedger({
        channel,
        logs,
        now: to,
        repository,
      });

      return {
        channel,
        senderResourceId,
        clientRequestId,
        state: logs.length ? 'found' : 'unknown',
        logs: logs.map(toPublicLogDto),
      };
    },

    async listLogs({ actorUserId, query = {} }) {
      const user = await requireActiveUser(repository, actorUserId);
      const channel = normalizeChannel(query.channel);
      const { from, to } = normalizeDateRange(query, { requireRange: true });
      const page = normalizePositiveInteger(query.page, 'page', 1);
      const pageSize = normalizePageSize(query.pageSize);
      const { logs: normalizedLogs } = await fetchAuthorizedLogRows({
        channel,
        from,
        kakaoClient,
        repository,
        smsClient,
        to,
        user,
      });
      const authorizedLogs = normalizedLogs
        .map(toPublicLogDto)
        .sort(compareLogsDesc);
      const startIndex = (page - 1) * pageSize;
      const logs = authorizedLogs.slice(startIndex, startIndex + pageSize);

      return {
        channel,
        from: from.toISOString(),
        to: to.toISOString(),
        page,
        pageSize,
        hasNextPage: startIndex + pageSize < authorizedLogs.length,
        total: authorizedLogs.length,
        logs,
      };
    },

    async listLogGroups({ actorUserId, query = {} }) {
      const user = await requireActiveUser(repository, actorUserId);
      if (isMessageLogDemoCasesQuery(query)) {
        const channel = normalizeLedgerListChannel(query.channel);
        const messageType = channel === CHANNELS.SMS ? normalizeLedgerSmsMessageType(query.messageType) : null;
        const { from, to } = normalizeDateRange(query, { requireRange: false });
        const page = normalizePositiveInteger(query.page, 'page', 1);
        const pageSize = normalizePageSize(query.pageSize);

        return listMessageLogDemoCaseGroups({
          channel,
          from,
          messageType,
          now: now(),
          page,
          pageSize,
          to,
        });
      }

      if (hasLedgerGroupList(repository)) {
        return listLedgerLogGroups({ currentTime: now(), repository, query, user });
      }

      const channel = normalizeChannel(query.channel);
      const { from, to } = normalizeDateRange(query, { requireRange: true });
      const page = normalizePositiveInteger(query.page, 'page', 1);
      const pageSize = normalizePageSize(query.pageSize);
      const { logs } = await fetchAuthorizedLogRows({
        channel,
        from,
        kakaoClient,
        repository,
        smsClient,
        to,
        user,
      });
      const groups = await buildLogGroups({ actorUserId: user.id, logs, repository });
      const startIndex = (page - 1) * pageSize;

      return {
        channel,
        from: from.toISOString(),
        to: to.toISOString(),
        page,
        pageSize,
        hasNextPage: startIndex + pageSize < groups.length,
        total: groups.length,
        groups: groups.slice(startIndex, startIndex + pageSize),
      };
    },

    async getLogGroupDetail({ actorUserId, groupId, query = {} }) {
      const user = await requireActiveUser(repository, actorUserId);
      if (isMessageLogDemoGroupId(groupId)) {
        const demoDetail = getMessageLogDemoCaseDetail({
          channel: query.channel ? normalizeLedgerListChannel(query.channel) : null,
          groupId,
          now: now(),
        });

        if (!demoDetail) {
          throw forbidden('Message log group was not found or is not available.');
        }

        return demoDetail;
      }

      if (hasLedgerGroupDetail(repository)) {
        return getLedgerLogGroupDetail({ actorUserId: user.id, groupId, query, repository, user });
      }

      const normalizedGroupId = normalizeRequiredString(groupId, 'groupId');
      const channel = normalizeChannel(query.channel);
      const { from, to } = normalizeDateRange(query, { requireRange: true });
      const { logs } = await fetchAuthorizedLogRows({
        channel,
        from,
        kakaoClient,
        repository,
        smsClient,
        to,
        user,
      });
      const groups = await buildInternalLogGroupsForRows({ actorUserId: user.id, logs, repository });
      const group = groups.find((item) => item.id === normalizedGroupId);

      if (!group) {
        throw forbidden('Message log group was not found or is not available.');
      }

      return {
        group: toPublicLogGroupDto(group),
        recipients: group.logs
          .sort(compareGroupRecipientsAsc)
          .map(toPublicLogDto),
      };
    },

    async listLogGroupRequestRecipients({ actorUserId, groupId, requestLocalId, query = {} }) {
      const user = await requireActiveUser(repository, actorUserId);
      if (isMessageLogDemoGroupId(groupId) || isMessageLogDemoRequestLocalId(requestLocalId)) {
        const page = normalizePositiveInteger(query.page, 'page', 1);
        const pageSize = normalizeRecipientPageSize(query.pageSize);
        const demoRecipients = listMessageLogDemoCaseRequestRecipients({
          groupId,
          now: now(),
          page,
          pageSize,
          requestLocalId,
        });

        if (!demoRecipients) {
          throw forbidden('Message log request was not found or is not available.');
        }

        return demoRecipients;
      }

      return listLedgerRequestRecipients({
        groupId,
        kakaoClient,
        now,
        query,
        repository,
        requestLocalId,
        smsClient,
        user,
      });
    },

    async listLogGroupRequestFailures({ actorUserId, groupId, requestLocalId, query = {} }) {
      const user = await requireActiveUser(repository, actorUserId);
      if (isMessageLogDemoGroupId(groupId) || isMessageLogDemoRequestLocalId(requestLocalId)) {
        const page = normalizePositiveInteger(query.page, 'page', 1);
        const pageSize = normalizeRecipientPageSize(query.pageSize);
        const demoFailures = listMessageLogDemoCaseRequestFailures({
          groupId,
          now: now(),
          page,
          pageSize,
          requestLocalId,
        });

        if (!demoFailures) {
          throw forbidden('Message log request was not found or is not available.');
        }

        return demoFailures;
      }

      return listLedgerRequestFailures({
        groupId,
        query,
        repository,
        requestLocalId,
        user,
      });
    },

    async getLogGroupRequestRecipientDetail({ actorUserId, groupId, requestLocalId, recipientSeq }) {
      const user = await requireActiveUser(repository, actorUserId);
      if (isMessageLogDemoGroupId(groupId) || isMessageLogDemoRequestLocalId(requestLocalId)) {
        const demoDetail = getMessageLogDemoCaseRequestRecipientDetail({
          groupId,
          now: now(),
          recipientSeq,
          requestLocalId,
        });

        if (!demoDetail) {
          throw forbidden('Message log was not found or is not available.');
        }

        return demoDetail;
      }

      return getLedgerRequestRecipientDetail({
        groupId,
        kakaoClient,
        repository,
        requestLocalId,
        recipientSeq,
        smsClient,
        user,
      });
    },

    async syncDueBulkResults({ limit = 10, workerId = 'message-log-sync-worker' } = {}) {
      return correctDueLedgerMessageResults({
        kakaoClient,
        limit,
        now: now(),
        repository,
        smsClient,
        workerId,
      });
    },

    async syncDailyBulkResultCorrection({ limit = 50, workerId = 'message-log-daily-sync-worker' } = {}) {
      const result = await correctDueLedgerMessageResults({
        kakaoClient,
        limit,
        now: now(),
        repository,
        smsClient,
        workerId,
      });

      return {
        selectedCount: result.processedCount,
        syncedGroupCount: result.correctedCount,
        errorCount: result.errorCount,
      };
    },

    async correctDueMessageResults({ limit = 10, workerId = 'message-result-correction-worker' } = {}) {
      return correctDueLedgerMessageResults({
        kakaoClient,
        limit,
        now: now(),
        repository,
        smsClient,
        workerId,
      });
    },

    async syncLogGroupResults({ actorUserId, groupId }) {
      const user = await requireActiveUser(repository, actorUserId);
      if (isMessageLogDemoGroupId(groupId)) {
        const demoResult = getMessageLogDemoCaseSyncResult({ groupId, now: now() });

        if (!demoResult) {
          throw forbidden('Message log group was not found or is not available.');
        }

        return demoResult;
      }

      return syncLedgerLogGroupForActor({
        groupId,
        kakaoClient,
        now: now(),
        repository,
        smsClient,
        user,
      });
    },

    async cleanupMessageLogLedgerRetention({ archiveLimit = 100, purgeLimit = 100 } = {}) {
      return cleanupLedgerRetention({
        archiveLimit,
        now: now(),
        purgeLimit,
        repository,
      });
    },

    async getDetail({ actorUserId, channel, requestId, recipientSeq }) {
      const user = await requireActiveUser(repository, actorUserId);
      const normalizedChannel = normalizeChannel(channel);
      const normalizedRequestId = normalizeRequiredString(requestId, 'requestId');
      if (isMessageLogDemoProviderRequestId(normalizedRequestId)) {
        const demoDetail = getMessageLogDemoCaseRecipientDetail({
          channel: normalizedChannel,
          now: now(),
          providerRequestId: normalizedRequestId,
          recipientSeq,
        });

        if (!demoDetail) {
          throw forbidden('Message log was not found or is not available.');
        }

        return demoDetail;
      }

      const ledgerRequest = await requireLedgerRequestByProviderRequestIdIfAvailable({
        actorUserId: user.id,
        channel: normalizedChannel,
        providerRequestId: normalizedRequestId,
        repository,
      });
      const resources = ledgerRequest
        ? [await requireLedgerGroupContext({ group: ledgerRequest.group, repository, user, allowedRoles: READ_ROLES })]
        : await listActiveLogResources({
            repository,
            user,
            channel: normalizedChannel,
            allowedRoles: READ_ROLES,
          });
      const detail = await fetchProviderDetail({
        channel: normalizedChannel,
        requestId: normalizedRequestId,
        recipientSeq: normalizeRecipientSeq(recipientSeq),
        smsClient,
        kakaoClient,
      });
      const normalized = authorizeAndNormalizeLog({ row: detail, user, resources, includeDetail: true });

      if (!normalized) {
        throw forbidden('Message log was not found or is not available.');
      }

      return toPublicLogDto(normalized);
    },

    async resend({ actorUserId, channel, requestId, recipientSeq }) {
      const user = await requireActiveUser(repository, actorUserId);
      const normalizedChannel = normalizeChannel(channel);
      const normalizedRequestId = normalizeRequiredString(requestId, 'requestId');
      const demoResendResult = getMessageLogDemoCaseResendResult({ providerRequestId: normalizedRequestId });

      if (demoResendResult) {
        return demoResendResult;
      }

      if (normalizedChannel === CHANNELS.BRAND_MESSAGE) {
        throw new RelayValidationError('Brand message resend is not supported.');
      }

      const ledgerRequest = await requireLedgerRequestByProviderRequestIdIfAvailable({
        actorUserId: user.id,
        channel: normalizedChannel,
        providerRequestId: normalizedRequestId,
        repository,
      });
      const resources = ledgerRequest
        ? [await requireLedgerGroupContext({ group: ledgerRequest.group, repository, user, allowedRoles: RESEND_ROLES })]
        : await listActiveLogResources({
            repository,
            user,
            channel: normalizedChannel,
            allowedRoles: RESEND_ROLES,
          });
      const detail = await fetchProviderDetail({
        channel: normalizedChannel,
        requestId: normalizedRequestId,
        recipientSeq: normalizeRecipientSeq(recipientSeq),
        smsClient,
        kakaoClient,
      });
      const normalized = authorizeAndNormalizeLog({ row: detail, user, resources, includeDetail: true });

      if (!normalized) {
        throw forbidden('Message log was not found or is not available for resend.');
      }

      if (!isFailedForResend(normalized.raw)) {
        throw new RelayValidationError('Only failed message rows can be resent.');
      }

      const context = normalized.context;
      const identity = buildNewResendIdentity({ user, context });
      const original = {
        requestId: normalized.requestId,
        recipientSeq: normalized.recipientSeq,
      };

      if (messageSendService) {
        const sendResult = normalizedChannel === CHANNELS.ALIMTALK
          ? await messageSendService.resendRawAlimtalk({
              actorUserId: user.id,
              payload: buildRawAlimtalkResendPayload({
                detail: normalized.raw,
                identity,
                senderResourceId: context.resource.id,
              }),
            })
          : await messageSendService.sendSms({
              actorUserId: user.id,
              payload: buildSmsResendPayload({
                channel: normalizedChannel,
                detail: normalized.raw,
                identity,
                senderResourceId: context.resource.id,
              }),
            });

        return { ...sendResult, original };
      }

      const providerResponse =
        normalizedChannel === CHANNELS.ALIMTALK
          ? await resendAlimtalk({ detail: normalized.raw, context, identity, kakaoClient })
          : await resendSms({ detail: normalized.raw, channel: normalizedChannel, context, identity, smsClient });

      return {
        state: 'accepted_by_provider',
        channel: normalizedChannel,
        original,
        clientRequestId: identity.clientRequestId,
        requestRef: identity.requestRef,
        senderResourceId: context.resource.id,
        provider: normalizeProviderSendResponse(providerResponse),
      };
    },

    async exportLogs({ actorUserId, query = {} }) {
      const user = await requireActiveUser(repository, actorUserId);
      const channel = normalizeExportChannel(query);
      const { from, to } = normalizeDateRange(query, { requireRange: true });
      if (isMessageLogDemoCasesQuery(query)) {
        return {
          channel,
          demo: true,
          from,
          to,
          filename: 'message-log-demo-cases.csv',
          rowCount: 0,
          stream: createCsvStream([]),
        };
      }

      const resources = await listActiveLogResources({ repository, user, channel, allowedRoles: READ_ROLES });
      const providerResult = await fetchProviderLogs({
        channel,
        resources,
        from,
        to,
        pageSize: DEFAULT_PROVIDER_PAGE_SIZE,
        smsClient,
        kakaoClient,
      });
      const logs = providerResult.rows
        .map((row) => authorizeAndNormalizeLog({ row, user, resources }))
        .filter(Boolean)
        .map(({ grouping: _grouping, context: _context, raw: _raw, ...log }) => log)
        .sort(compareLogsAsc);

      await repository.createAuditLog({
        actorUserId: user.id,
        action: 'message_logs.exported',
        targetType: 'message_logs',
        targetId: null,
        metadataJson: {
          channel,
          from: from.toISOString(),
          to: to.toISOString(),
          exportedCount: logs.length,
          senderResourceIds: resources.map(({ resource }) => resource.id),
          providerPagesFetched: providerResult.providerPagesFetched,
          ...(providerResult.providerTotalCount === null
            ? {}
            : { providerTotalCount: providerResult.providerTotalCount }),
        },
      });

      return {
        channel,
        from,
        to,
        filename: buildExportFilename({ channel, from, to }),
        rowCount: logs.length,
        stream: createCsvStream(logs),
      };
    },
  };
}

async function fetchAuthorizedLogRows({ repository, user, channel, from, to, smsClient, kakaoClient }) {
  const resources = await listActiveLogResources({ repository, user, channel, allowedRoles: READ_ROLES });
  const providerResult = await fetchProviderLogs({
    channel,
    resources,
    from,
    to,
    pageSize: DEFAULT_PROVIDER_PAGE_SIZE,
    smsClient,
    kakaoClient,
  });

  return {
    providerResult,
    logs: providerResult.rows
      .map((row) => authorizeAndNormalizeLog({ row, user, resources }))
      .filter(Boolean),
    resources,
  };
}

function hasLedgerGroupList(repository) {
  return typeof repository.listGroupsForActor === 'function'
    && typeof repository.countGroupsForActor === 'function';
}

function hasLedgerGroupDetail(repository) {
  return typeof repository.getGroupForActor === 'function'
    && typeof repository.listProviderRequestsForGroup === 'function';
}

async function listLedgerLogGroups({ currentTime, repository, query, user }) {
  const channel = normalizeLedgerListChannel(query.channel);
  const messageType = channel === CHANNELS.SMS ? normalizeLedgerSmsMessageType(query.messageType) : null;
  const { from, to } = normalizeDateRange(query, { requireRange: false });
  const page = normalizePositiveInteger(query.page, 'page', 1);
  const pageSize = normalizePageSize(query.pageSize);
  const channels = channel === CHANNELS.SMS ? [messageType].filter(Boolean) : [channel];
  const listChannels = channels.length ? channels : SMS_LEDGER_CHANNELS;
  const contexts = await listActiveLogResources({
    repository,
    user,
    channel: channel === CHANNELS.SMS ? CHANNELS.SMS : channel,
    allowedRoles: READ_ROLES,
  });
  const senderResourceIds = contexts.map(({ resource }) => resource.id);

  if (!senderResourceIds.length) {
    return {
      channel,
      from: from?.toISOString() ?? null,
      to: to?.toISOString() ?? null,
      page,
      pageSize,
      hasNextPage: false,
      total: 0,
      groups: [],
    };
  }

  const offset = (page - 1) * pageSize;
  const [total, groups] = await Promise.all([
    repository.countGroupsForActor({
      actorUserId: user.id,
      channels: listChannels,
      senderResourceIds,
      sentAtFrom: from,
      sentAtTo: to,
      sentAtUntil: currentTime,
    }),
    repository.listGroupsForActor({
      actorUserId: user.id,
      channels: listChannels,
      limit: pageSize,
      offset,
      senderResourceIds,
      sentAtFrom: from,
      sentAtTo: to,
      sentAtUntil: currentTime,
    }),
  ]);
  const contextsByResourceId = new Map(contexts.map((context) => [context.resource.id, context]));

  return {
    channel,
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
    page,
    pageSize,
    hasNextPage: offset + groups.length < total,
    total,
    groups: groups.map((group) => toPublicLedgerLogGroupDto({
      group,
      context: contextsByResourceId.get(group.senderResourceId),
    })),
  };
}

async function getLedgerLogGroupDetail({ actorUserId, groupId, query, repository, user }) {
  const normalizedGroupId = normalizeRequiredString(groupId, 'groupId');
  const group = await repository.getGroupForActor({ actorUserId, groupId: normalizedGroupId });
  const archivedGroup = group
    ? null
    : await repository.getGroupForActor({ actorUserId, groupId: normalizedGroupId, includeArchived: true });

  if (archivedGroup?.archivedAt) {
    return {
      archived: true,
      message: LEDGER_RETENTION_EXPIRED_MESSAGE,
      group: toPublicLedgerLogGroupDto({ group: archivedGroup }),
      requests: [],
      recipients: [],
    };
  }

  if (!group) {
    throw forbidden('Message log group was not found or is not available.');
  }

  const requestedChannel = query.channel ? normalizeLedgerListChannel(query.channel) : null;
  if (requestedChannel && !isLedgerGroupInListChannel(group, requestedChannel)) {
    throw forbidden('Message log group was not found or is not available.');
  }

  const context = await requireLedgerGroupContext({
    allowedRoles: READ_ROLES,
    group,
    repository,
    user,
  });
  const providerRequests = await repository.listProviderRequestsForGroup(group.id);

  return {
    group: toPublicLedgerLogGroupDto({ group, context }),
    requests: providerRequests.map(toPublicLedgerProviderRequestDto),
    recipients: [],
  };
}

async function listLedgerRequestRecipients({
  groupId,
  kakaoClient,
  now,
  query,
  repository,
  requestLocalId,
  smsClient,
  user,
}) {
  if (typeof repository.getProviderRequestForActor !== 'function') {
    throw forbidden('Message log request was not found or is not available.');
  }

  const page = normalizePositiveInteger(query.page, 'page', 1);
  const pageSize = normalizeRecipientPageSize(query.pageSize);
  const normalizedGroupId = normalizeRequiredString(groupId, 'groupId');
  const normalizedRequestLocalId = normalizeRequiredString(requestLocalId, 'requestLocalId');
  const row = await repository.getProviderRequestForActor({
    actorUserId: user.id,
    includeArchived: true,
    requestId: normalizedRequestLocalId,
  });

  if (!row || row.group.id !== normalizedGroupId) {
    throw forbidden('Message log request was not found or is not available.');
  }

  if (row.group.archivedAt) {
    return {
      archived: true,
      message: LEDGER_RETENTION_EXPIRED_MESSAGE,
      page,
      pageSize,
      total: 0,
      hasNextPage: false,
      request: toPublicLedgerProviderRequestDto(row.providerRequest),
      recipients: [],
    };
  }

  const context = await requireLedgerGroupContext({
    allowedRoles: READ_ROLES,
    group: row.group,
    repository,
    user,
  });

  if (!row.providerRequest.providerRequestId || row.providerRequest.providerState !== 'accepted') {
    return {
      state: 'not_ready',
      page,
      pageSize,
      total: 0,
      hasNextPage: false,
      request: toPublicLedgerProviderRequestDto(row.providerRequest),
      recipients: [],
    };
  }

  const from = getLedgerGroupEffectiveAt(row.group) ?? addHours(now(), -DEFAULT_STATUS_LOOKBACK_HOURS);
  const response = await listProviderLogPage({
    channel: row.group.channel,
    context,
    from,
    to: now(),
    pageNum: page,
    pageSize,
    extraQuery: { requestId: row.providerRequest.providerRequestId },
    smsClient,
    kakaoClient,
  });
  const providerPage = extractProviderLogPage(response, row.group.channel);
  const recipients = providerPage.items
    .map((item) => ({ ...item, _channel: row.group.channel, _contextHint: context }))
    .map((item) => authorizeAndNormalizeLog({ row: item, user, resources: [context] }))
    .filter(Boolean)
    .filter((item) => item.requestId === row.providerRequest.providerRequestId)
    .sort(compareGroupRecipientsAsc)
    .map(toPublicLogDto);

  return {
    page,
    pageSize,
    total: providerPage.totalCount ?? recipients.length,
    hasNextPage: hasNextPage({
      pageNum: page,
      pageSize: providerPage.pageSize,
      totalCount: providerPage.totalCount,
      receivedCount: providerPage.items.length,
    }),
    request: toPublicLedgerProviderRequestDto(row.providerRequest),
    recipients,
  };
}

async function listLedgerRequestFailures({
  groupId,
  query,
  repository,
  requestLocalId,
  user,
}) {
  const page = normalizePositiveInteger(query.page, 'page', 1);
  const pageSize = normalizeRecipientPageSize(query.pageSize);
  const row = await requireLedgerRequestRowForActor({
    groupId,
    repository,
    requestLocalId,
    user,
  });

  if (row.group.archivedAt) {
    return {
      archived: true,
      message: LEDGER_RETENTION_EXPIRED_MESSAGE,
      page,
      pageSize,
      total: 0,
      hasNextPage: false,
      group: toPublicLedgerGroupReferenceDto(row.group),
      request: toPublicLedgerRequestReferenceDto(row.providerRequest),
      failures: [],
    };
  }

  await requireLedgerGroupContext({
    allowedRoles: READ_ROLES,
    group: row.group,
    repository,
    user,
  });

  const failures = listFailedResultSnapshotEntries(
    row.providerRequest.resultSnapshotJson,
    row.providerRequest.recipientCount
  ).map((failure) => toPublicLedgerFailureDto({
    failure,
    group: row.group,
    request: row.providerRequest,
  }));
  const startIndex = (page - 1) * pageSize;
  const pageFailures = failures.slice(startIndex, startIndex + pageSize);

  return {
    page,
    pageSize,
    total: failures.length,
    hasNextPage: startIndex + pageSize < failures.length,
    group: toPublicLedgerGroupReferenceDto(row.group),
    request: toPublicLedgerRequestReferenceDto(row.providerRequest),
    failures: pageFailures,
  };
}

async function getLedgerRequestRecipientDetail({
  groupId,
  kakaoClient,
  repository,
  requestLocalId,
  recipientSeq,
  smsClient,
  user,
}) {
  const normalizedRecipientSeq = normalizePositiveInteger(recipientSeq, 'recipientSeq');
  const row = await requireLedgerRequestRowForActor({
    groupId,
    repository,
    requestLocalId,
    user,
  });

  if (row.group.archivedAt) {
    return {
      archived: true,
      message: LEDGER_RETENTION_EXPIRED_MESSAGE,
      group: toPublicLedgerGroupReferenceDto(row.group),
      request: toPublicLedgerRequestReferenceDto(row.providerRequest),
      recipient: null,
    };
  }

  const context = await requireLedgerGroupContext({
    allowedRoles: READ_ROLES,
    group: row.group,
    repository,
    user,
  });

  if (!row.providerRequest.providerRequestId || row.providerRequest.providerState !== 'accepted') {
    return {
      state: 'not_ready',
      group: toPublicLedgerGroupReferenceDto(row.group),
      request: toPublicLedgerRequestReferenceDto(row.providerRequest),
      recipient: null,
    };
  }

  const detail = await fetchProviderDetail({
    channel: row.group.channel,
    requestId: row.providerRequest.providerRequestId,
    recipientSeq: normalizedRecipientSeq,
    smsClient,
    kakaoClient,
  });
  const normalized = authorizeAndNormalizeLog({
    row: detail,
    user,
    resources: [context],
    includeDetail: true,
  });

  if (
    !normalized
    || normalized.requestId !== row.providerRequest.providerRequestId
    || normalized.recipientSeq !== normalizedRecipientSeq
  ) {
    throw forbidden('Message log was not found or is not available.');
  }

  return {
    group: toPublicLedgerGroupReferenceDto(row.group),
    request: toPublicLedgerRequestReferenceDto(row.providerRequest),
    recipient: toPublicLocalRecipientDetailDto({
      group: row.group,
      log: toPublicLogDto(normalized),
      request: row.providerRequest,
    }),
  };
}

async function requireLedgerRequestRowForActor({
  groupId,
  repository,
  requestLocalId,
  user,
}) {
  if (typeof repository.getProviderRequestForActor !== 'function') {
    throw forbidden('Message log request was not found or is not available.');
  }

  const normalizedGroupId = normalizeRequiredString(groupId, 'groupId');
  const normalizedRequestLocalId = normalizeRequiredString(requestLocalId, 'requestLocalId');
  const row = await repository.getProviderRequestForActor({
    actorUserId: user.id,
    includeArchived: true,
    requestId: normalizedRequestLocalId,
  });

  if (!row || row.group.id !== normalizedGroupId) {
    throw forbidden('Message log request was not found or is not available.');
  }

  return row;
}

async function requireLedgerRequestByProviderRequestIdIfAvailable({
  actorUserId,
  channel,
  providerRequestId,
  repository,
}) {
  if (typeof repository.getProviderRequestForActorByProviderRequestId !== 'function') {
    return null;
  }

  const row = await repository.getProviderRequestForActorByProviderRequestId({
    actorUserId,
    channel,
    providerRequestId,
  });

  if (!row) {
    throw forbidden('Message log was not found or is not available.');
  }

  return row;
}

async function requireLedgerGroupContext({ allowedRoles, group, repository, user }) {
  const contexts = await listActiveLogResources({
    repository,
    user,
    channel: group.channel,
    allowedRoles,
  });
  const context = contexts.find((item) => item.resource.id === group.senderResourceId);

  if (!context) {
    throw forbidden('Message log group was not found or is not available.');
  }

  return context;
}

function toPublicLedgerLogGroupDto({ group, context } = {}) {
  const createdAt = toIsoStringOrNull(group?.createdAt);
  const scheduledAt = toIsoStringOrNull(group?.scheduledAt);
  const resultSyncedAt = toIsoStringOrNull(group?.resultSyncedAt);
  const resultFinalizedAt = toIsoStringOrNull(group?.resultFinalizedAt);
  const totalRecipientCount = Number(group?.totalRecipientCount ?? 0);

  return {
    id: group?.id,
    channel: group?.channel,
    sendKind: group?.sendKind,
    sendTiming: group?.sendTiming,
    managementTitle: group?.managementTitle ?? null,
    senderLabel: context?.resource?.displayName || context?.resource?.value || null,
    source: toPublicMessageLogSourceDto(group),
    totalRecipientCount,
    recipientCount: totalRecipientCount,
    providerRequestCount: Number(group?.providerRequestCount ?? 0),
    acceptedRequestCount: Number(group?.acceptedRequestCount ?? 0),
    providerState: group?.providerState,
    resultState: group?.resultState,
    successCount: Number(group?.successCount ?? 0),
    failedCount: Number(group?.failedCount ?? 0),
    pendingCount: Number(group?.pendingCount ?? 0),
    canceledCount: Number(group?.canceledCount ?? 0),
    resultSyncedAt,
    resultFinalizedAt,
    scheduledAt,
    createdAt,
    expiresAt: toIsoStringOrNull(group?.expiresAt),
    requestDate: scheduledAt ?? createdAt,
    receiveDate: resultSyncedAt ?? resultFinalizedAt,
    aggregateState: getLedgerAggregateState(group),
  };
}

function toPublicMessageLogSourceDto(group) {
  if (isAutomationMessageLogSource(group)) {
    return {
      type: 'automation',
      label: '자동화',
      eventKey: normalizeOptionalString(group?.sourceEventKey),
      externalEventId: normalizeOptionalString(group?.sourceExternalEventId),
      channelCode: normalizeOptionalString(group?.sourceChannelCode),
      automationRuleId: normalizeOptionalString(group?.sourceAutomationRuleId),
      automationRuleName: null,
      automationDeliveryId: normalizeOptionalString(group?.sourceAutomationDeliveryId),
    };
  }

  return {
    type: 'manual',
    label: '직접 발송',
  };
}

function isAutomationMessageLogSource(group) {
  return normalizeOptionalString(group?.sourceType) === 'automation'
    || Boolean(normalizeOptionalString(group?.sourceAutomationDeliveryId))
    || Boolean(normalizeOptionalString(group?.sourceAutomationRuleId));
}

function toPublicLedgerProviderRequestDto(request) {
  return {
    id: request.id,
    sequence: Number(request.sequence ?? 0),
    recipientCount: Number(request.recipientCount ?? 0),
    providerState: request.providerState,
    resultState: request.resultState,
    successCount: Number(request.successCount ?? 0),
    failedCount: Number(request.failedCount ?? 0),
    pendingCount: Number(request.pendingCount ?? 0),
    canceledCount: Number(request.canceledCount ?? 0),
    resultSyncedAt: toIsoStringOrNull(request.resultSyncedAt),
    resultFinalizedAt: toIsoStringOrNull(request.resultFinalizedAt),
    nextSyncAt: toIsoStringOrNull(request.nextSyncAt),
    createdAt: toIsoStringOrNull(request.createdAt),
    canFetchRecipients: Boolean(request.providerRequestId && request.providerState === 'accepted'),
  };
}

function toPublicLedgerGroupReferenceDto(group) {
  return {
    id: group?.id,
  };
}

function toPublicLedgerRequestReferenceDto(request) {
  const sequence = Number(request?.sequence ?? 0);

  return {
    id: request?.id,
    sequence,
    label: getLedgerRequestLabel(sequence),
  };
}

function toPublicLedgerFailureDto({ failure, group, request }) {
  const requestSequence = Number(request?.sequence ?? 0);

  return {
    groupId: group.id,
    requestLocalId: request.id,
    requestSequence,
    requestLabel: getLedgerRequestLabel(requestSequence),
    channel: group.channel,
    recipientSeq: failure.recipientSeq,
    recipientNo: failure.recipientNo ?? null,
    resultCode: failure.resultCode,
    resultCodeLabel: getProviderFailureResultCodeLabel({
      channel: group.channel,
      resultCode: failure.resultCode,
    }),
  };
}

function toPublicLocalRecipientDetailDto({ group, log, request }) {
  const { id: _id, requestId: _requestId, ...safeLog } = log;

  return {
    id: ['local', group.id, request.id, safeLog.recipientSeq].join(':'),
    groupId: group.id,
    requestLocalId: request.id,
    ...safeLog,
  };
}

function getLedgerRequestLabel(sequence) {
  return sequence > 0 ? `요청 ${sequence}` : '요청';
}

function getSmsFailureResultCodeLabel(resultCode) {
  const resultCodeLabel = getSmsResultCodeLabel(resultCode);

  return resultCodeLabel ? `실패 · ${resultCodeLabel}` : '실패';
}

function getProviderFailureResultCodeLabel({ channel, resultCode }) {
  if (channel === CHANNELS.ALIMTALK || channel === CHANNELS.BRAND_MESSAGE) {
    return getKakaoFailureResultLabel({ resultCode });
  }

  return getSmsFailureResultCodeLabel(resultCode);
}

function getLedgerAggregateState(group) {
  if (!group) return 'pending';
  if (group.providerState === 'canceled') return 'failed';
  if (group.providerState === 'rejected' || group.providerState === 'failed') return 'failed';
  if (group.providerState === 'unknown' || group.resultState === 'stale' || group.resultState === 'error') {
    return 'partial';
  }
  if (group.resultState === 'not_synced' || group.resultState === 'syncing') return 'pending';

  return getAggregateState({
    failedCount: Number(group.failedCount ?? 0) + Number(group.canceledCount ?? 0),
    pendingCount: Number(group.pendingCount ?? 0),
    recipientCount: Number(group.totalRecipientCount ?? 0),
    successCount: Number(group.successCount ?? 0),
  });
}

function normalizeLedgerListChannel(value) {
  const channel = normalizeOptionalString(value)?.toLowerCase();

  if (channel === CHANNELS.SMS) return CHANNELS.SMS;
  if (channel === CHANNELS.ALIMTALK) return CHANNELS.ALIMTALK;
  if (channel === CHANNELS.BRAND_MESSAGE) return CHANNELS.BRAND_MESSAGE;

  throw new RelayValidationError('channel must be sms, alimtalk, or brand-message.');
}

function normalizeLedgerSmsMessageType(value) {
  const messageType = normalizeOptionalString(value)?.toLowerCase();
  if (!messageType || messageType === 'all') return null;
  if (SMS_LEDGER_CHANNELS.includes(messageType)) return messageType;

  throw new RelayValidationError('messageType must be sms, lms, or mms.');
}

function isLedgerGroupInListChannel(group, listChannel) {
  if (listChannel === CHANNELS.SMS) return SMS_LEDGER_CHANNELS.includes(group.channel);
  return group.channel === listChannel;
}

function getLedgerGroupEffectiveAt(group) {
  return parseDateValue(group?.scheduledAt) ?? parseDateValue(group?.createdAt);
}

function parseDateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoStringOrNull(value) {
  const date = parseDateValue(value);
  return date ? date.toISOString() : null;
}

async function correctDueLedgerMessageResults({ kakaoClient, limit, now, repository, smsClient, workerId }) {
  if (typeof repository.leaseMessageResultCorrectionRequests !== 'function') {
    return { processedCount: 0, correctedCount: 0, finalizedCount: 0, staleCount: 0, errorCount: 0 };
  }

  const leasedRows = await repository.leaseMessageResultCorrectionRequests({
    finalCorrectionDueBefore: new Date(now.getTime() - MESSAGE_RESULT_FINAL_CORRECTION_DELAY_MS),
    firstCorrectionDueBefore: new Date(now.getTime() - MESSAGE_RESULT_FIRST_CORRECTION_DELAY_MS),
    leaseExpiresAt: new Date(now.getTime() + LEDGER_SYNC_LEASE_MS),
    limit,
    now,
    workerId,
  });
  let correctedCount = 0;
  let finalizedCount = 0;
  let staleCount = 0;
  let errorCount = 0;

  for (const row of leasedRows) {
    const group = row.group;
    const request = row.providerRequest ?? row;
    const correction = getMessageResultCorrectionStage({
      fallbackReservation: row.fallbackReservation,
      group,
      now,
      request,
    });

    if (!correction) {
      await clearCorrectionLease({ now, repository, request });
      continue;
    }

    try {
      const results = isKakaoBizmessageChannel(group.channel)
        ? await fetchKakaoMessageResultCorrectionEntries({
            correction,
            group,
            kakaoClient,
            repository,
            request,
          })
        : await fetchSmsMessageResultCorrectionEntries({
            correction,
            group,
            request,
            smsClient,
          });
      const merge = await repository.mergeProviderRequestResultSnapshotByProviderRequestId({
        authoritative: true,
        channel: group.channel,
        clearSyncLease: true,
        fallbackResults: results.fallbackResults ?? [],
        finalize: correction.finalizePrimary,
        finalizeFallback: correction.finalizeFallback,
        nextSyncAtWhenPending: correction.finalizePrimary ? null : correction.primaryFinalAt,
        now,
        providerRequestId: request.providerRequestId,
        results,
        updateNextSyncAt: true,
      });
      const updatedRequest = merge?.providerRequest;

      correctedCount += 1;
      if (updatedRequest?.resultFinalizedAt) finalizedCount += 1;
      if (updatedRequest?.resultState === 'stale') staleCount += 1;
    } catch {
      if (correction.fallbackDue) {
        await repository.mergeProviderRequestResultSnapshotByProviderRequestId({
          authoritative: true,
          channel: group.channel,
          clearSyncLease: true,
          fallbackResults: [],
          finalizeFallback: correction.finalizeFallback,
          now,
          providerRequestId: request.providerRequestId,
          results: [],
        });
      }
      await markLedgerProviderRequestCorrectionError({
        finalCorrection: correction.finalizePrimary,
        nextCorrectionAt: correction.finalizePrimary ? null : correction.primaryFinalAt,
        now,
        repository,
        request,
      });
      errorCount += 1;
    }
  }

  return {
    processedCount: leasedRows.length,
    correctedCount,
    finalizedCount,
    staleCount,
    errorCount,
  };
}

async function fetchSmsMessageResultCorrectionEntries({ correction, group, request, smsClient }) {
  const results = [];
  const seen = new Set();
  const messageType = getSmsMessageResultType(group.channel);

  for (const range of splitMessageResultCorrectionWindows(correction.windowStart, correction.windowEnd)) {
    let pageNum = 1;

    while (true) {
      if (pageNum > MAX_MESSAGE_RESULT_PAGES_PER_WINDOW) {
        throw new RelayValidationError('Result correction scan is too large. Try again later.');
      }

      const response = await smsClient.listMessageResults({
        startUpdateDate: formatNhnDateTime(range.start, { seconds: true }),
        endUpdateDate: formatNhnDateTime(range.end, { seconds: true }),
        messageType,
        pageNum,
        pageSize: DEFAULT_MESSAGE_RESULT_PAGE_SIZE,
      });
      const page = extractSmsMessageResultPage(response);

      for (const row of page.items) {
        const entry = toMessageResultSnapshotEntry(row, request);
        if (!entry) continue;

        const key = `${entry.recipientSeq}:${entry.state}:${entry.resultCode ?? ''}`;
        if (seen.has(key)) continue;

        seen.add(key);
        results.push(entry);
      }

      if (
        !hasNextPage({
          pageNum,
          pageSize: page.pageSize,
          totalCount: page.totalCount,
          receivedCount: page.items.length,
        })
      ) {
        break;
      }

      pageNum += 1;
    }
  }

  return results;
}

function getMessageResultCorrectionStage({ fallbackReservation, group, now, request }) {
  const primary = getPrimaryResultCorrectionStage({ group, now, request });
  const fallback = getFallbackResultCorrectionStage({ fallbackReservation, group, now, request });

  if (!primary && !fallback) return null;

  const cursorCandidates = [primary?.cursor, fallback?.cursor].filter(Boolean);
  const cursor = new Date(Math.min(...cursorCandidates.map((value) => value.getTime())));

  return {
    fallbackDue: Boolean(fallback),
    finalizeFallback: Boolean(fallback?.final),
    finalizePrimary: Boolean(primary?.final),
    primaryFinalAt: primary?.finalAt ?? null,
    windowEnd: now,
    windowStart: new Date(Math.max(0, cursor.getTime() - MESSAGE_RESULT_WINDOW_OVERLAP_MS)),
  };
}

function getPrimaryResultCorrectionStage({ group, now, request }) {
  if (!isMessageResultCorrectionCandidate({ group, request })) return null;

  const effectiveAt = getLedgerRequestEffectiveAt({ group, request });
  if (!effectiveAt || effectiveAt > now) return null;

  const firstAt = new Date(effectiveAt.getTime() + MESSAGE_RESULT_FIRST_CORRECTION_DELAY_MS);
  const finalAt = new Date(effectiveAt.getTime() + MESSAGE_RESULT_FINAL_CORRECTION_DELAY_MS);
  const final = now >= finalAt;
  if (!final && now < firstAt) return null;

  return {
    cursor: parseDateValue(request.resultSyncedAt) ?? effectiveAt,
    final,
    finalAt,
  };
}

function getFallbackResultCorrectionStage({ fallbackReservation, group, now, request }) {
  if (!fallbackReservation || !isKakaoBizmessageChannel(group?.channel)) return null;
  if (request?.providerState !== 'accepted' || !request?.providerRequestId) return null;
  if (fallbackReservation.resultFinalizedAt || !fallbackReservation.fallbackOpenedAt) return null;

  const remaining = Number(fallbackReservation.reservedCount ?? 0)
    - Number(fallbackReservation.consumedCount ?? 0)
    - Number(fallbackReservation.releasedCount ?? 0);
  if (remaining <= 0) return null;

  const openedAt = parseDateValue(fallbackReservation.fallbackOpenedAt);
  if (!openedAt || openedAt > now) return null;

  const firstAt = new Date(openedAt.getTime() + MESSAGE_RESULT_FIRST_CORRECTION_DELAY_MS);
  const finalAt = new Date(openedAt.getTime() + MESSAGE_RESULT_FINAL_CORRECTION_DELAY_MS);
  const final = now >= finalAt;
  if (!final && (fallbackReservation.resultSyncedAt || now < firstAt)) return null;

  return {
    cursor: parseDateValue(fallbackReservation.resultSyncedAt) ?? openedAt,
    final,
    finalAt,
  };
}

function isMessageResultCorrectionCandidate({ group, request }) {
  if (!group || !request) return false;
  if (!RESULT_SNAPSHOT_LEDGER_CHANNELS.includes(group.channel)) return false;
  if (group.archivedAt || group.resultFinalizedAt) return false;
  if (!['accepted', 'partial'].includes(group.providerState)) return false;
  if (request.providerState !== 'accepted' || !request.providerRequestId) return false;
  if (request.resultFinalizedAt) return false;
  if (getLedgerRequestResultCounts(request).pendingCount <= 0) return false;

  return Boolean(request.resultSnapshotJson);
}

async function fetchKakaoMessageResultCorrectionEntries({
  correction,
  group,
  kakaoClient,
  repository,
  request,
}) {
  const user = await repository.getUserById(group.userId);
  if (!user) {
    throw forbidden('Message log group was not found or is not available.');
  }

  const context = await requireLedgerGroupContext({
    allowedRoles: READ_ROLES,
    group,
    repository,
    user,
  });

  return fetchProviderRequestResultEntries({
    channel: group.channel,
    context,
    from: correction.windowStart,
    kakaoClient,
    providerRequestId: request.providerRequestId,
    smsClient: null,
    to: correction.windowEnd,
    user,
  });
}

function getLedgerRequestEffectiveAt({ group, request }) {
  return parseDateValue(group?.scheduledAt) ?? parseDateValue(request?.createdAt) ?? parseDateValue(group?.createdAt);
}

function getSmsMessageResultType(channel) {
  if (channel === CHANNELS.LMS) return 'LMS';
  if (channel === CHANNELS.MMS) return 'MMS';
  return 'SMS';
}

function extractSmsMessageResultPage(response) {
  const body = response?.body ?? {};
  const bodyData = body.data ?? response?.data ?? [];
  const items = Array.isArray(bodyData)
    ? bodyData
    : Array.isArray(bodyData?.resultUpdateList)
      ? bodyData.resultUpdateList
      : Array.isArray(body.resultUpdateList)
        ? body.resultUpdateList
        : [];

  return {
    items,
    pageSize: normalizeOptionalInteger(body.pageSize ?? bodyData?.pageSize) ?? DEFAULT_MESSAGE_RESULT_PAGE_SIZE,
    totalCount: normalizeOptionalInteger(body.totalCount ?? bodyData?.totalCount),
  };
}

function toMessageResultSnapshotEntry(row, request) {
  if (!row || typeof row !== 'object') return null;
  if (normalizeOptionalString(row.requestId) !== request.providerRequestId) return null;

  const recipientSeq = normalizeOptionalInteger(row.recipientSeq);
  if (!recipientSeq || recipientSeq < 1 || recipientSeq > Number(request.recipientCount ?? 0)) return null;

  const resultCode = normalizeOptionalString(row.resultCode);
  if (!resultCode) return null;
  const resultState = getSmsResultState({ resultCode });
  if (resultState === 'pending') return null;

  return {
    recipientGroupingKey: normalizeOptionalString(row.recipientGroupingKey),
    ...(resultState === 'failed'
      ? optionalRecipientNo(row.recipientNo ?? row.phoneNo ?? row.internationalRecipientNo)
      : {}),
    recipientSeq,
    resultCode,
    state: resultState === 'success' ? 'S' : 'F',
  };
}

function splitMessageResultCorrectionWindows(start, end) {
  const ranges = [];
  let cursor = new Date(start);

  while (cursor <= end) {
    const rangeEnd = new Date(Math.min(end.getTime(), cursor.getTime() + MESSAGE_RESULT_MAX_QUERY_RANGE_MS - 1000));
    ranges.push({ start: new Date(cursor), end: rangeEnd });
    cursor = new Date(rangeEnd.getTime() + 1000);
  }

  return ranges;
}

async function clearCorrectionLease({ now, repository, request }) {
  if (typeof repository.updateProviderRequest !== 'function') return null;

  return repository.updateProviderRequest({
    requestId: request.id,
    values: {
      syncLeaseExpiresAt: null,
      syncLockedBy: null,
    },
    now,
  });
}

async function syncLedgerLogGroupForActor({ groupId, kakaoClient, now, repository, smsClient, user }) {
  if (!hasLedgerGroupDetail(repository)) {
    throw forbidden('Message log group was not found or is not available.');
  }

  const normalizedGroupId = normalizeRequiredString(groupId, 'groupId');
  const group = await repository.getGroupForActor({ actorUserId: user.id, groupId: normalizedGroupId });
  const archivedGroup = group
    ? null
    : await repository.getGroupForActor({ actorUserId: user.id, groupId: normalizedGroupId, includeArchived: true });

  if (archivedGroup?.archivedAt) {
    return {
      archived: true,
      message: LEDGER_RETENTION_EXPIRED_MESSAGE,
      group: toPublicLedgerLogGroupDto({ group: archivedGroup }),
      syncedRequestCount: 0,
    };
  }

  if (!group) {
    throw forbidden('Message log group was not found or is not available.');
  }

  await requireLedgerGroupContext({ allowedRoles: READ_ROLES, group, repository, user });

  const requests = await repository.listProviderRequestsForGroup(group.id);
  const activeLease = requests.find((request) => {
    const leaseExpiresAt = parseDateValue(request.syncLeaseExpiresAt);
    return leaseExpiresAt && leaseExpiresAt > now;
  });

  if (activeLease) {
    return {
      state: 'syncing',
      message: '결과 확인 중입니다.',
      group: toPublicLedgerLogGroupDto({ group }),
      syncedRequestCount: 0,
    };
  }

  const result = await syncLedgerGroupRequests({
    finalCorrection: false,
    group,
    kakaoClient,
    manual: true,
    now,
    repository,
    smsClient,
  });

  return {
    state: 'completed',
    syncedRequestCount: result.syncedCount,
    errorCount: result.errorCount,
    group: toPublicLedgerLogGroupDto({ group: result.group ?? group }),
  };
}

async function cleanupLedgerRetention({ archiveLimit, now, purgeLimit, repository }) {
  if (typeof repository.archiveExpiredGroups !== 'function' || typeof repository.purgeArchivedGroups !== 'function') {
    return { archivedCount: 0, purgedCount: 0, purgedRequestCount: 0 };
  }

  const archivedGroups = await repository.archiveExpiredGroups({
    archiveReason: 'retention_expired',
    now,
    limit: archiveLimit,
    purgeAfter: addDays(now, LEDGER_ARCHIVE_PURGE_DELAY_DAYS),
  });
  const purgedGroups = await repository.purgeArchivedGroups({
    now,
    limit: purgeLimit,
  });
  const purgedRequestCount = purgedGroups.reduce(
    (total, group) => total + Number(group?.providerRequestCount ?? 0),
    0
  );

  return {
    archivedCount: archivedGroups.length,
    purgedCount: purgedGroups.length,
    purgedRequestCount,
  };
}

async function syncLedgerProviderRequest({ finalCorrection, kakaoClient, manual = false, now, repository, request, smsClient }) {
  const group = await repository.getGroupById?.({ groupId: request.groupId });

  if (!isLedgerRequestSyncEligible({ finalCorrection, group, manual, now, request })) {
    await repository.updateProviderRequest({
      requestId: request.id,
      values: {
        resultState: 'stale',
        syncLeaseExpiresAt: null,
        syncLockedBy: null,
        nextSyncAt: null,
      },
      now,
    });
    if (group) await rollupLedgerResultGroup({ groupId: group.id, now, repository });
    return null;
  }

  const user = await repository.getUserById(group.userId);
  if (!user) {
    throw forbidden('Message log group was not found or is not available.');
  }

  const context = await requireLedgerGroupContext({ allowedRoles: READ_ROLES, group, repository, user });
  const results = await fetchProviderRequestResultEntries({
    channel: group.channel,
    context,
    from: getLedgerGroupEffectiveAt(group) ?? group.createdAt,
    kakaoClient,
    providerRequestId: request.providerRequestId,
    smsClient,
    to: now,
    user,
  });

  const merge = await repository.mergeProviderRequestResultSnapshotByProviderRequestId({
    authoritative: true,
    clearSyncLease: true,
    fallbackResults: results.fallbackResults ?? [],
    finalize: finalCorrection,
    finalizeFallback: finalCorrection,
    nextSyncAtWhenPending: getNextEarlySyncAt({ group, request }),
    now,
    providerRequestId: request.providerRequestId,
    results,
    updateNextSyncAt: true,
  });

  return merge?.group ?? null;
}

async function syncLedgerGroupRequests({ finalCorrection, group, kakaoClient, manual = false, now, repository, smsClient }) {
  const requests = (await repository.listProviderRequestsForGroup(group.id))
    .filter((request) => request.providerState === 'accepted' && request.providerRequestId);
  let syncedCount = 0;
  let errorCount = 0;

  for (const request of requests) {
    try {
      await syncLedgerProviderRequest({
        finalCorrection,
        kakaoClient,
        manual,
        now,
        repository,
        request,
        smsClient,
      });
      syncedCount += 1;
    } catch {
      await markLedgerProviderRequestSyncError({ finalCorrection, now, repository, request });
      errorCount += 1;
    }
  }

  const updatedGroup = await rollupLedgerResultGroup({ groupId: group.id, now, repository });

  if (finalCorrection && updatedGroup && !updatedGroup.resultFinalizedAt) {
    await repository.updateGroup({
      groupId: updatedGroup.id,
      values: { resultFinalizedAt: now },
      now,
    });
  }

  return { syncedCount, errorCount, group: updatedGroup };
}

async function fetchProviderRequestResultEntries({
  channel,
  context,
  from,
  kakaoClient,
  providerRequestId,
  smsClient,
  to,
  user,
}) {
  const results = [];
  const fallbackResults = [];
  let pageNum = 1;

  while (true) {
    if (pageNum > MAX_PROVIDER_LOG_PAGES_PER_RESOURCE) {
      throw new RelayValidationError('Result check is too large. Try again later.');
    }

    const response = await listProviderLogPage({
      channel,
      context,
      from,
      to,
      pageNum,
      pageSize: DEFAULT_PROVIDER_PAGE_SIZE,
      extraQuery: { requestId: providerRequestId },
      smsClient,
      kakaoClient,
    });
    const page = extractProviderLogPage(response, channel);
    const logs = page.items
      .map((item) => ({ ...item, _channel: channel, _contextHint: context }))
      .map((item) => authorizeAndNormalizeLog({ row: item, user, resources: [context] }))
      .filter(Boolean)
      .filter((log) => log.requestId === providerRequestId);

    results.push(...logs.map(toSnapshotMergeResult).filter(Boolean));
    fallbackResults.push(...logs.map(toFallbackQuotaResult).filter(Boolean));

    if (!hasNextPage({ pageNum, pageSize: page.pageSize, totalCount: page.totalCount, receivedCount: page.items.length })) {
      break;
    }

    pageNum += 1;
  }

  Object.defineProperty(results, 'fallbackResults', {
    configurable: false,
    enumerable: false,
    value: fallbackResults,
  });
  return results;
}

async function rollupLedgerResultGroup({ groupId, now, repository }) {
  const requests = await repository.listProviderRequestsForGroup(groupId);
  if (!requests.length) return null;

  const resultFinalizedAt = requests.every((request) => request.resultFinalizedAt)
    ? getLatestDate(requests.map((request) => request.resultFinalizedAt)) ?? now
    : null;
  const values = {
    acceptedRequestCount: requests.filter((request) => request.providerState === 'accepted').length,
    canceledCount: sumLedgerRequestResultCount(requests, 'canceledCount'),
    failedCount: sumLedgerRequestResultCount(requests, 'failedCount'),
    pendingCount: sumLedgerRequestResultCount(requests, 'pendingCount'),
    providerRequestCount: requests.length,
    providerState: getLedgerGroupProviderState(requests),
    resultFinalizedAt,
    resultState: getLedgerGroupResultState(requests),
    resultSyncedAt: getLatestDate(requests.map((request) => request.resultSyncedAt)),
    successCount: sumLedgerRequestResultCount(requests, 'successCount'),
  };

  return repository.updateGroup({ groupId, values, now });
}

async function markLedgerProviderRequestSyncError({ finalCorrection = false, now, repository, request }) {
  if (typeof repository.updateProviderRequest !== 'function') return null;

  await repository.updateProviderRequest({
    requestId: request.id,
    values: {
      nextSyncAt: null,
      resultFinalizedAt: finalCorrection ? now : null,
      resultState: finalCorrection ? 'error' : 'stale',
      syncLeaseExpiresAt: null,
      syncLockedBy: null,
    },
    now,
  });

  return request.groupId ? rollupLedgerResultGroup({ groupId: request.groupId, now, repository }) : null;
}

async function markLedgerProviderRequestCorrectionError({
  finalCorrection,
  nextCorrectionAt,
  now,
  repository,
  request,
}) {
  if (typeof repository.updateProviderRequest !== 'function') return null;

  await repository.updateProviderRequest({
    requestId: request.id,
    values: {
      nextSyncAt: nextCorrectionAt,
      resultFinalizedAt: finalCorrection ? now : null,
      resultState: 'error',
      syncLeaseExpiresAt: null,
      syncLockedBy: null,
    },
    now,
  });

  return request.groupId ? rollupLedgerResultGroup({ groupId: request.groupId, now, repository }) : null;
}

function isAutoSyncEligibleBulk({ group, request, now, finalCorrection = false }) {
  if (!group || !request) return false;
  if (group.sendKind !== 'bulk') return false;
  if (!SMS_LEDGER_CHANNELS.includes(group.channel)) return false;
  if (!['accepted', 'partial'].includes(group.providerState)) return false;
  if (group.archivedAt || group.resultFinalizedAt) return false;
  if (request.providerState !== 'accepted' || !request.providerRequestId) return false;

  const effectiveAt = getLedgerGroupEffectiveAt(group);
  if (!effectiveAt || effectiveAt > now) return false;

  if (finalCorrection) {
    return isDailyCorrectionEligibleBulk({ group, now });
  }

  return true;
}

function isLedgerRequestSyncEligible({ finalCorrection, group, manual, now, request }) {
  if (!manual) {
    return isAutoSyncEligibleBulk({ group, request, now, finalCorrection });
  }

  if (!group || !request) return false;
  if (group.archivedAt) return false;
  if (!['accepted', 'partial'].includes(group.providerState)) return false;
  if (request.providerState !== 'accepted' || !request.providerRequestId) return false;

  const effectiveAt = getLedgerGroupEffectiveAt(group);
  return Boolean(effectiveAt && effectiveAt <= now);
}

function isDailyCorrectionEligibleBulk({ group, now }) {
  if (!group || group.archivedAt || group.resultFinalizedAt) return false;
  if (group.sendKind !== 'bulk') return false;
  if (!SMS_LEDGER_CHANNELS.includes(group.channel)) return false;
  if (!['accepted', 'partial'].includes(group.providerState)) return false;
  const expiresAt = parseDateValue(group.expiresAt);
  if (expiresAt && expiresAt <= now) return false;

  const effectiveAt = getLedgerGroupEffectiveAt(group);
  if (!effectiveAt || effectiveAt > now) return false;

  return now.getTime() - effectiveAt.getTime() >= MESSAGE_RESULT_FINAL_CORRECTION_DELAY_MS;
}

function getNextEarlySyncAt({ group, request }) {
  const effectiveAt = getLedgerGroupEffectiveAt(group);
  if (!effectiveAt) return null;
  if (Number(request.syncAttempts ?? 0) > 1) return null;

  return new Date(effectiveAt.getTime() + LEDGER_SECOND_SYNC_DELAY_MS);
}

function toSnapshotMergeResult(log) {
  const recipientSeq = normalizeOptionalInteger(log?.recipientSeq);

  if (!recipientSeq || !isLogRecipientGroupingIndexConsistent(log, recipientSeq)) return null;

  const state = classifyMessageLogSnapshotState(log);
  if (!state) return null;

  return {
    ...(state === 'F' ? optionalRecipientNo(log.recipientNo) : {}),
    recipientSeq,
    resultCode: normalizeOptionalString(log.resultCode),
    state,
  };
}

function toFallbackQuotaResult(log) {
  const row = log?.raw ?? log;
  const recipientSeq = normalizeOptionalInteger(log?.recipientSeq ?? row?.recipientSeq);
  const resendStatus = normalizeOptionalString(row?.resendStatus);

  if (!recipientSeq || !resendStatus) return null;

  return {
    recipientSeq,
    resendStatus,
    resendResultCode: normalizeOptionalString(row?.resendResultCode ?? row?.resendResult?.resultCode),
  };
}

function optionalRecipientNo(value) {
  const recipientNo = normalizeOptionalString(value);
  return recipientNo ? { recipientNo } : {};
}

async function mergeStatusLogsIntoLedger({ channel, logs, now, repository }) {
  if (!logs.length || typeof repository.mergeProviderRequestResultSnapshotByProviderRequestId !== 'function') {
    return;
  }

  const entriesByRequestId = new Map();

  for (const log of logs) {
    const providerRequestId = normalizeOptionalString(log.requestId);
    const entry = toSnapshotMergeResult(log);
    const fallbackEntry = toFallbackQuotaResult(log);

    if (!providerRequestId || (!entry && !fallbackEntry)) continue;

    const bundle = entriesByRequestId.get(providerRequestId) ?? { fallbackResults: [], results: [] };
    if (entry) bundle.results.push(entry);
    if (fallbackEntry) bundle.fallbackResults.push(fallbackEntry);
    entriesByRequestId.set(providerRequestId, bundle);
  }

  for (const [providerRequestId, bundle] of entriesByRequestId.entries()) {
    try {
      await repository.mergeProviderRequestResultSnapshotByProviderRequestId({
        authoritative: false,
        channel,
        fallbackResults: bundle.fallbackResults,
        now,
        providerRequestId,
        results: bundle.results,
      });
    } catch {
      // Status polling is a UX fast path; webhook/correction remain the durable update paths.
    }
  }
}

function isLogRecipientGroupingIndexConsistent(log, recipientSeq) {
  const recipientIndex = log?.grouping?.recipientIndex;

  return !Number.isSafeInteger(recipientIndex) || recipientIndex === recipientSeq - 1;
}

function classifyMessageLogSnapshotState(log) {
  const status = normalizeOptionalString(log?.status)?.toUpperCase();

  if (status && ['CANCELED', 'CANCELLED', 'CANCEL'].includes(status)) return 'C';
  if (isSuccessMessageLog(log)) return 'S';
  if (isFailedMessageLog(log)) return 'F';
  return null;
}

function getLedgerGroupProviderState(requests) {
  const acceptedCount = requests.filter((request) => request.providerState === 'accepted').length;
  if (acceptedCount === requests.length) return 'accepted';
  if (acceptedCount > 0) return 'partial';
  if (requests.some((request) => request.providerState === 'unknown')) return 'unknown';
  if (requests.some((request) => request.providerState === 'failed' || request.providerState === 'rejected')) return 'failed';
  if (requests.some((request) => request.providerState === 'sending')) return 'sending';
  return 'queued';
}

function getLedgerGroupResultState(requests) {
  if (requests.every((request) => request.resultState === 'synced')) return 'synced';
  if (requests.some((request) => request.resultState === 'syncing')) return 'syncing';
  if (requests.some((request) => request.resultState === 'stale')) return 'stale';
  if (requests.some((request) => request.resultState === 'partially_synced')) return 'partially_synced';
  if (requests.some((request) => request.resultState === 'synced')) return 'partially_synced';
  if (requests.some((request) => request.resultState === 'error')) return 'error';
  return 'not_synced';
}

function getLatestDate(values) {
  const dates = values.map(parseDateValue).filter(Boolean);
  if (!dates.length) return null;

  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function sumLedgerRequestResultCount(requests, key) {
  return requests.reduce((total, request) => total + getLedgerRequestResultCounts(request)[key], 0);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
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

async function listActiveLogResources({ repository, user, channel, allowedRoles }) {
  const resourceType = getResourceTypeForChannel(channel);
  const rows = await repository.listUserSenderResources(user.id);
  const contexts = [];

  for (const row of rows) {
    if (!isActiveResourceRow(row)) continue;
    if (!allowedRoles.has(row.link.role)) continue;
    if (row.resource.provider !== PROVIDERS.NHN || row.resource.type !== resourceType) continue;

    const billingAccount = await resolveBillingAccount({ repository, user, link: row.link });
    if (!billingAccount) continue;

    contexts.push({ user, link: row.link, resource: row.resource, billingAccount });
  }

  return contexts;
}

async function requireActiveLogResource({ repository, user, senderResourceId, channel, allowedRoles }) {
  const contexts = await listActiveLogResources({ repository, user, channel, allowedRoles });
  const context = contexts.find((item) => item.resource.id === senderResourceId);

  if (!context) {
    throw forbidden('An active sender resource is required.');
  }

  return context;
}

async function resolveBillingAccount({ repository, user, link }) {
  const billingAccount = link.billingAccountId
    ? await repository.getBillingAccountById(link.billingAccountId)
    : await repository.findBillingAccountForUser(user.id);

  if (!billingAccount || billingAccount.status !== BILLING_ACCOUNT_STATUS_ACTIVE) {
    return null;
  }

  return billingAccount;
}

function isActiveResourceRow({ link, resource }) {
  return link.status === LINK_STATUS_ACTIVE && resource?.status === RESOURCE_STATUS_ACTIVE;
}

async function fetchProviderLogs({
  channel,
  resources,
  from,
  to,
  pageSize,
  extraQuery = {},
  smsClient,
  kakaoClient,
}) {
  const rows = [];
  let providerPagesFetched = 0;
  let providerTotalCount = 0;
  let hasCompleteTotalCount = true;

  for (const context of resources) {
    let pageNum = 1;
    let resourceTotalCount = null;

    while (true) {
      if (pageNum > MAX_PROVIDER_LOG_PAGES_PER_RESOURCE) {
        throw new RelayValidationError(
          `Provider log scan exceeded ${MAX_PROVIDER_LOG_PAGES_PER_RESOURCE} pages. Narrow the date range and try again.`
        );
      }

      const response = await listProviderLogPage({
        channel,
        context,
        from,
        to,
        pageNum,
        pageSize,
        extraQuery,
        smsClient,
        kakaoClient,
      });
      const page = extractProviderLogPage(response, channel);
      providerPagesFetched += 1;
      if (pageNum === 1) {
        resourceTotalCount = page.totalCount;
      }
      rows.push(...page.items.map((item) => ({ ...item, _channel: channel, _contextHint: context })));

      if (!hasNextPage({ pageNum, pageSize: page.pageSize, totalCount: page.totalCount, receivedCount: page.items.length })) {
        break;
      }

      pageNum += 1;
    }

    if (resourceTotalCount === null) {
      hasCompleteTotalCount = false;
    } else {
      providerTotalCount += resourceTotalCount;
    }
  }

  return {
    rows,
    providerPagesFetched,
    providerTotalCount: hasCompleteTotalCount ? providerTotalCount : null,
  };
}

function listProviderLogPage({
  channel,
  context,
  from,
  to,
  pageNum,
  pageSize,
  extraQuery,
  smsClient,
  kakaoClient,
}) {
  const commonQuery = {
    ...buildDateQuery({ channel, from, to }),
    pageNum,
    pageSize,
    ...extraQuery,
  };

  if (channel === CHANNELS.ALIMTALK) {
    return kakaoClient.listAlimtalkMessages({
      senderKey: context.resource.value,
      ...commonQuery,
    });
  }

  if (channel === CHANNELS.BRAND_MESSAGE) {
    return kakaoClient.listBrandMessages({
      senderKey: context.resource.value,
      ...commonQuery,
    });
  }

  const query = {
    sendNo: context.resource.value,
    ...commonQuery,
  };

  return channel === CHANNELS.SMS ? smsClient.listSmsMessages(query) : smsClient.listMmsMessages(query);
}

function extractProviderLogPage(response, channel) {
  if (isKakaoBizmessageChannel(channel)) {
    const body = response?.messageSearchResultResponse ?? response?.body?.messageSearchResultResponse ?? response?.body ?? {};
    const items = body.messages ?? body.data ?? response?.messages ?? [];

    return {
      items: Array.isArray(items) ? items : [],
      pageSize: normalizeOptionalInteger(body.pageSize) ?? DEFAULT_PROVIDER_PAGE_SIZE,
      totalCount: normalizeOptionalInteger(body.totalCount),
    };
  }

  const body = response?.body ?? {};
  const items = body.data ?? body.resultList ?? response?.data ?? [];

  return {
    items: Array.isArray(items) ? items : [],
    pageSize: normalizeOptionalInteger(body.pageSize) ?? DEFAULT_PROVIDER_PAGE_SIZE,
    totalCount: normalizeOptionalInteger(body.totalCount),
  };
}

async function fetchProviderDetail({ channel, requestId, recipientSeq, smsClient, kakaoClient }) {
  const response =
    channel === CHANNELS.ALIMTALK
      ? await kakaoClient.getAlimtalkMessage({ requestId, recipientSeq })
      : channel === CHANNELS.BRAND_MESSAGE
        ? await kakaoClient.getBrandMessage({ requestId, recipientSeq })
        : channel === CHANNELS.SMS
          ? await smsClient.getSmsMessage({ requestId, recipientSeq })
          : await smsClient.getMmsMessage({ requestId, recipientSeq });

  return { ...extractProviderDetail(response, channel), _channel: channel };
}

function extractProviderDetail(response, channel) {
  if (isKakaoBizmessageChannel(channel)) {
    return (
      response?.message ??
      response?.messageResponse ??
      response?.body?.message ??
      response?.body?.messageResponse ??
      response?.body?.data ??
      response?.data ??
      response
    );
  }

  return response?.body?.data ?? response?.data ?? response?.message ?? response;
}

function authorizeAndNormalizeLog({ row, user, resources, includeDetail = false }) {
  if (!row || typeof row !== 'object') return null;

  const senderGroupingKey = normalizeOptionalString(
    row.senderGroupingKey ?? row.groupingKey ?? row.sendGroupingKey ?? row._senderGroupingKey
  );
  const recipientGroupingKey = normalizeOptionalString(row.recipientGroupingKey ?? row.receiveGroupingKey);
  const grouping = resolveGrouping({ senderGroupingKey, recipientGroupingKey });

  if (!grouping || grouping.userRef !== user.userRef) {
    return null;
  }

  const context = resources.find(
    (item) =>
      item.resource.resourceRef === grouping.resourceRef &&
      item.billingAccount.billingRef === grouping.billingRef
  );

  if (!context) {
    return null;
  }

  const normalized = normalizeLogDto({ row, channel: row._channel, context, grouping, includeDetail });
  if (!normalized.requestId || normalized.recipientSeq === null) {
    return null;
  }

  return normalized;
}

function resolveGrouping({ senderGroupingKey, recipientGroupingKey }) {
  return resolveGroupingFromKeys({ senderGroupingKey, recipientGroupingKey });
}

function normalizeLogDto({ row, channel, context, grouping, includeDetail }) {
  const requestId = normalizeOptionalString(row.requestId ?? row.requestID);
  const recipientSeq = normalizeOptionalInteger(row.recipientSeq);
  const body = normalizeOptionalString(row.body ?? row.content ?? row.messageContent ?? row.templateContent);

  return {
    id: `${channel}:${requestId ?? 'unknown'}:${recipientSeq ?? 'unknown'}`,
    channel,
    requestId,
    recipientSeq,
    senderLabel: context.resource.displayName || context.resource.value,
    recipientNo: normalizeOptionalString(row.recipientNo ?? row.phoneNo ?? row.internationalRecipientNo),
    contentPreview: truncatePreview(body),
    templateCode: normalizeOptionalString(row.templateCode ?? row.templateId),
    requestDate: normalizeOptionalString(row.requestDate ?? row.createDate ?? row.requestedDate),
    receiveDate: normalizeOptionalString(row.receiveDate ?? row.resultDate ?? row.updateDate),
    status: normalizeOptionalString(row.messageStatus ?? row.msgStatus ?? row.status ?? row.statusCode),
    resultCode: row.resultCode ?? null,
    resultMessage: normalizeOptionalString(row.resultMessage ?? row.resultMessageName ?? row.messageStatusName),
    grouping,
    context,
    raw: row,
    ...(includeDetail ? { detail: normalizeDetailPayload(row, channel) } : {}),
  };
}

function normalizeDetailPayload(row, channel) {
  const detail = {
    recipientNo: normalizeOptionalString(row.recipientNo ?? row.phoneNo ?? row.internationalRecipientNo),
    content: normalizeOptionalString(row.content ?? row.body ?? row.messageContent),
    buttons: sanitizeObjectArray(row.buttons),
    quickReplies: sanitizeObjectArray(row.quickReplies),
    templateItem: sanitizeObject(row.templateItem),
    templateItemHighlight: sanitizeObject(row.templateItemHighlight),
    templateRepresentLink: sanitizeObject(row.templateRepresentLink),
    messageOption: sanitizeObject(row.messageOption),
  };

  if (!isKakaoBizmessageChannel(channel)) {
    detail.title = normalizeOptionalString(row.title);
  }

  return detail;
}

function toPublicLogDto(log) {
  const { grouping: _grouping, context: _context, raw: _raw, ...publicLog } = log;
  return publicLog;
}

async function buildLogGroups({ actorUserId, logs, repository }) {
  const groups = await buildInternalLogGroupsForRows({ actorUserId, logs, repository });
  return groups.map(toPublicLogGroupDto);
}

async function buildInternalLogGroupsForRows({ actorUserId, logs, repository }) {
  const bulkMappings = await findSmsBulkMappingsForLogs({ actorUserId, logs, repository });
  return buildInternalLogGroups(logs, bulkMappings);
}

async function findSmsBulkMappingsForLogs({ actorUserId, logs, repository }) {
  if (typeof repository.findSmsBulkRunMappingsByProviderRequestIds !== 'function') {
    return new Map();
  }

  const lookupGroups = groupSmsLogRequestIdsByContext(logs);
  if (!lookupGroups.length) return new Map();

  const mappings = new Map();
  const fallbackMappings = new Map();

  for (const group of lookupGroups) {
    const groupMappings = await repository.findSmsBulkRunMappingsByProviderRequestIds({
      actorUserId,
      channel: group.channel,
      providerRequestIds: group.providerRequestIds,
      senderResourceId: group.senderResourceId,
    });

    for (const providerRequestId of group.providerRequestIds) {
      const mapping = groupMappings.get(providerRequestId);
      if (!mapping) continue;

      mappings.set(getLogBulkMappingKey({
        channel: group.channel,
        providerRequestId,
        senderResourceId: group.senderResourceId,
      }), mapping);
      collectFallbackBulkMapping(fallbackMappings, providerRequestId, mapping);
    }
  }

  for (const [providerRequestId, mapping] of fallbackMappings) {
    if (mapping) {
      mappings.set(providerRequestId, mapping);
    }
  }

  return mappings;
}

function groupSmsLogRequestIdsByContext(logs) {
  const groupsByContext = new Map();

  for (const log of logs) {
    if (!isSmsLogChannel(log.channel) || !log.requestId) continue;

    const channel = normalizeOptionalString(log.channel);
    const senderResourceId = normalizeOptionalString(log.context?.resource?.id);
    const key = [channel ?? 'unknown', senderResourceId ?? 'unknown'].join('|');
    const group = groupsByContext.get(key) ?? {
      channel,
      senderResourceId,
      providerRequestIds: new Set(),
    };
    group.providerRequestIds.add(log.requestId);
    groupsByContext.set(key, group);
  }

  return Array.from(groupsByContext.values())
    .map((group) => ({
      channel: group.channel,
      senderResourceId: group.senderResourceId,
      providerRequestIds: Array.from(group.providerRequestIds),
    }))
    .filter((group) => group.providerRequestIds.length > 0);
}

function buildInternalLogGroups(logs, bulkMappings = new Map()) {
  const groupsById = new Map();

  for (const log of logs) {
    const bulkMapping = getBulkMappingForLog(log, bulkMappings);
    const id = bulkMapping ? getBulkLogGroupId({ channel: log.channel, runId: bulkMapping.run.id }) : getLogGroupId(log);
    if (!id) continue;

    const group = groupsById.get(id) ?? {
      id,
      channel: log.channel,
      bulkRunId: bulkMapping?.run?.id ?? null,
      groupType: bulkMapping ? 'bulk_run' : 'provider_request',
      logs: [],
      managementTitle: bulkMapping?.run?.managementSendName ?? null,
      providerRequestIds: new Set(),
      senderLabel: log.senderLabel,
    };

    if (log.requestId) {
      group.providerRequestIds.add(log.requestId);
    }
    group.logs.push(log);
    groupsById.set(id, group);
  }

  return Array.from(groupsById.values())
    .sort(compareInternalLogGroupsDesc);
}

function toPublicLogGroupDto(group) {
  const logs = group.logs.slice().sort(compareGroupRecipientsAsc);
  const states = logs.map(classifyMessageLog);
  const successCount = states.filter((state) => state === 'success').length;
  const failedCount = states.filter((state) => state === 'failed').length;
  const pendingCount = states.filter((state) => state === 'pending').length;
  const providerRequestIds = Array.from(group.providerRequestIds ?? uniqueNonEmpty(logs.map((log) => log.requestId)));
  const templateCodes = uniqueNonEmpty(logs.map((log) => log.templateCode));
  const contentLog = logs.find((log) => log.contentPreview);
  const representativeRecipientNo = logs.length === 1 ? normalizeOptionalString(logs[0]?.recipientNo) : null;

  return {
    id: group.id,
    channel: group.channel,
    senderLabel: group.senderLabel,
    groupType: group.groupType ?? 'provider_request',
    ...(group.bulkRunId ? { bulkRunId: group.bulkRunId } : {}),
    managementTitle: group.managementTitle ?? null,
    templateCode: templateCodes.length > 1 ? MULTIPLE_TEMPLATE_LABEL : templateCodes[0] ?? null,
    contentPreview: contentLog?.contentPreview ?? null,
    requestDate: pickExtremeLogDate(logs, 'requestDate', compareLogDateValuesAsc),
    receiveDate: pickExtremeLogDate(logs, 'receiveDate', compareLogDateValuesDesc),
    recipientCount: logs.length,
    ...(representativeRecipientNo ? { representativeRecipientNo } : {}),
    successCount,
    failedCount,
    pendingCount,
    aggregateState: getAggregateState({ failedCount, pendingCount, recipientCount: logs.length, successCount }),
    representativeRequestId: providerRequestIds[0] ?? null,
    providerRequestCount: providerRequestIds.length,
  };
}

function getBulkMappingForLog(log, bulkMappings) {
  if (!isSmsLogChannel(log?.channel) || !log.requestId) return null;

  const mapping = bulkMappings.get(getLogBulkMappingKey({
    channel: log.channel,
    providerRequestId: log.requestId,
    senderResourceId: log.context?.resource?.id,
  })) ?? bulkMappings.get(log.requestId);
  if (!mapping?.run?.id) return null;
  if (mapping.run.senderResourceId && log.context?.resource?.id && mapping.run.senderResourceId !== log.context.resource.id) {
    return null;
  }

  return mapping;
}

function getLogBulkMappingKey({ channel, providerRequestId, senderResourceId }) {
  return [
    normalizeOptionalString(channel) ?? 'unknown',
    normalizeOptionalString(senderResourceId) ?? 'unknown',
    normalizeOptionalString(providerRequestId) ?? 'unknown',
  ].join('|');
}

function collectFallbackBulkMapping(fallbackMappings, providerRequestId, mapping) {
  if (!fallbackMappings.has(providerRequestId)) {
    fallbackMappings.set(providerRequestId, mapping);
    return;
  }

  if (fallbackMappings.get(providerRequestId)?.run?.id !== mapping.run?.id) {
    fallbackMappings.set(providerRequestId, null);
  }
}

function getBulkLogGroupId({ channel, runId }) {
  return createHash('sha256')
    .update(['message_log', 'bulk_run', channel, runId].join('|'))
    .digest('base64url');
}

function isSmsLogChannel(channel) {
  return channel === CHANNELS.SMS || channel === CHANNELS.LMS || channel === CHANNELS.MMS;
}

function getLogGroupId(log) {
  const grouping = log?.grouping;

  if (!grouping?.userRef || !grouping.billingRef || !grouping.resourceRef || !grouping.requestRef || !log?.channel) {
    return null;
  }

  return createHash('sha256')
    .update([log.channel, grouping.userRef, grouping.billingRef, grouping.resourceRef, grouping.requestRef].join('|'))
    .digest('base64url');
}

function classifyMessageLog(log) {
  if (isSuccessMessageLog(log)) return 'success';
  if (isFailedMessageLog(log)) return 'failed';
  return 'pending';
}

function isSuccessMessageLog(log) {
  const channel = normalizeOptionalString(log?.channel)?.toLowerCase();
  const resultCode = normalizeOptionalString(log?.resultCode)?.toUpperCase();
  const status = normalizeOptionalString(log?.status)?.toUpperCase();

  if (channel === CHANNELS.ALIMTALK || channel === CHANNELS.BRAND_MESSAGE) {
    return isKakaoSuccessResult({ resultCode, status });
  }

  return isSmsSuccessResult({ resultCode, status });
}

function isFailedMessageLog(log) {
  const channel = normalizeOptionalString(log?.channel)?.toLowerCase();
  const resultCode = normalizeOptionalString(log?.resultCode)?.toUpperCase();
  const status = normalizeOptionalString(log?.status)?.toUpperCase();

  if (channel === CHANNELS.ALIMTALK || channel === CHANNELS.BRAND_MESSAGE) {
    return isKakaoFailureResult({ resultCode, status });
  }

  return isSmsFailureResult({ resultCode, status });
}

function getAggregateState({ failedCount, pendingCount, recipientCount, successCount }) {
  if (recipientCount > 0 && successCount === recipientCount) return 'success';
  if (recipientCount > 0 && failedCount === recipientCount) return 'failed';

  const representedStateCount = [successCount, failedCount, pendingCount].filter((count) => count > 0).length;
  return representedStateCount > 1 ? 'partial' : 'pending';
}

function uniqueNonEmpty(values) {
  const seen = new Set();

  for (const value of values) {
    const normalized = normalizeOptionalString(value);
    if (normalized) {
      seen.add(normalized);
    }
  }

  return Array.from(seen);
}

function pickExtremeLogDate(logs, property, compareFn) {
  const values = logs
    .map((log) => log[property])
    .filter((value) => normalizeOptionalString(value));

  if (!values.length) return null;

  return values.sort(compareFn)[0];
}

function compareInternalLogGroupsDesc(left, right) {
  const leftRequestDate = pickExtremeLogDate(left.logs, 'requestDate', compareLogDateValuesDesc);
  const rightRequestDate = pickExtremeLogDate(right.logs, 'requestDate', compareLogDateValuesDesc);
  const dateComparison = compareLogDateValuesDesc(leftRequestDate, rightRequestDate);
  return dateComparison === 0 ? left.id.localeCompare(right.id) : dateComparison;
}

function compareGroupRecipientsAsc(left, right) {
  const dateComparison = compareLogDateValuesAsc(left.requestDate, right.requestDate);
  if (dateComparison !== 0) return dateComparison;

  return Number(left.recipientSeq ?? 0) - Number(right.recipientSeq ?? 0);
}

function compareLogDateValuesDesc(left, right) {
  return compareLogDateValuesAsc(right, left);
}

function compareLogDateValuesAsc(left, right) {
  const leftValue = toLogDateTime(left);
  const rightValue = toLogDateTime(right);

  if (leftValue !== null && rightValue !== null && leftValue !== rightValue) {
    return leftValue - rightValue;
  }

  return String(left ?? '').localeCompare(String(right ?? ''));
}

function toLogDateTime(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  const date = new Date(normalized.includes('T') ? normalized : normalized.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function buildNewResendIdentity({ user, context }) {
  const clientRequestId = randomUUID();
  const requestRef = deriveRequestRef(clientRequestId);
  const senderGroupingKey = buildSenderGroupingKey({
    userRef: user.userRef,
    billingRef: context.billingAccount.billingRef,
    resourceRef: context.resource.resourceRef,
    requestRef,
  });

  return {
    clientRequestId,
    requestRef,
    senderGroupingKey,
    recipientGroupingKey: buildRecipientGroupingKey(senderGroupingKey, 0),
  };
}

function buildSmsResendPayload({ channel, detail, identity, senderResourceId }) {
  const title = normalizeOptionalString(detail.title);
  const templateCode = normalizeOptionalString(detail.templateId ?? detail.templateCode);

  return {
    body: normalizeRequiredString(detail.body ?? detail.content ?? detail.messageContent, 'body'),
    channel,
    clientRequestId: identity.clientRequestId,
    recipients: [{
      recipientNo: normalizeRequiredString(
        detail.recipientNo ?? detail.phoneNo ?? detail.internationalRecipientNo,
        'recipientNo'
      ),
    }],
    senderResourceId,
    ...(channel !== CHANNELS.SMS || title ? { title: title || 'Resend' } : {}),
    ...(templateCode ? { templateCode } : {}),
  };
}

function buildRawAlimtalkResendPayload({ detail, identity, senderResourceId }) {
  return {
    clientRequestId: identity.clientRequestId,
    senderResourceId,
    ...optionalStringProperty('templateCode', detail.templateCode),
    ...optionalObjectProperty('messageOption', detail.messageOption),
    recipient: {
      recipientNo: normalizeRequiredString(detail.recipientNo, 'recipientNo'),
      content: normalizeRequiredString(detail.content ?? detail.body ?? detail.messageContent, 'content'),
      ...optionalStringProperty('templateTitle', detail.templateTitle),
      ...optionalStringProperty('templateSubtitle', detail.templateSubtitle),
      ...optionalStringProperty('templateHeader', detail.templateHeader),
      ...optionalObjectProperty('templateItem', detail.templateItem),
      ...optionalObjectProperty('templateItemHighlight', detail.templateItemHighlight),
      ...optionalObjectProperty('templateRepresentLink', detail.templateRepresentLink),
      ...optionalObjectArrayProperty('buttons', detail.buttons),
      ...optionalObjectArrayProperty('quickReplies', detail.quickReplies),
    },
  };
}

async function resendSms({ detail, channel, context, identity, smsClient }) {
  const recipientNo = normalizeRequiredString(
    detail.recipientNo ?? detail.phoneNo ?? detail.internationalRecipientNo,
    'recipientNo'
  );
  const body = normalizeRequiredString(detail.body ?? detail.content ?? detail.messageContent, 'body');
  const requestBody = {
    sendNo: context.resource.value,
    body,
    senderGroupingKey: identity.senderGroupingKey,
    recipientList: [
      {
        recipientNo,
        recipientGroupingKey: identity.recipientGroupingKey,
      },
    ],
  };
  const title = normalizeOptionalString(detail.title);

  if (channel !== CHANNELS.SMS || title) {
    requestBody.title = title || 'Resend';
  }

  const templateId = normalizeOptionalString(detail.templateId ?? detail.templateCode);
  if (templateId) {
    requestBody.templateId = templateId;
  }

  return channel === CHANNELS.SMS ? smsClient.sendSms(requestBody) : smsClient.sendMms(requestBody);
}

async function resendAlimtalk({ detail, context, identity, kakaoClient }) {
  const recipientNo = normalizeRequiredString(detail.recipientNo, 'recipientNo');
  const content = normalizeRequiredString(detail.content ?? detail.body ?? detail.messageContent, 'content');
  const idempotencyKey = buildAlimtalkIdempotencyKey({
    userRef: context.user.userRef,
    resourceRef: context.resource.resourceRef,
    requestRef: identity.requestRef,
  });
  const recipient = {
    recipientNo,
    content,
    recipientGroupingKey: identity.recipientGroupingKey,
    ...optionalStringProperty('templateTitle', detail.templateTitle),
    ...optionalStringProperty('templateSubtitle', detail.templateSubtitle),
    ...optionalStringProperty('templateHeader', detail.templateHeader),
    ...optionalObjectProperty('templateItem', detail.templateItem),
    ...optionalObjectProperty('templateItemHighlight', detail.templateItemHighlight),
    ...optionalObjectProperty('templateRepresentLink', detail.templateRepresentLink),
    ...optionalObjectArrayProperty('buttons', detail.buttons),
    ...optionalObjectArrayProperty('quickReplies', detail.quickReplies),
  };
  const body = {
    senderKey: context.resource.value,
    senderGroupingKey: identity.senderGroupingKey,
    createUser: context.user.userRef,
    recipientList: [recipient],
  };
  const templateCode = normalizeOptionalString(detail.templateCode);
  if (templateCode) {
    body.templateCode = templateCode;
  }

  const messageOption = sanitizeObject(detail.messageOption);
  if (messageOption) {
    body.messageOption = messageOption;
  }

  return kakaoClient.sendRawAlimtalkMessage(body, { idempotencyKey });
}

function normalizeProviderSendResponse(response) {
  if (!response || typeof response !== 'object') return null;

  const data = response.body?.data ?? response.message ?? response.body?.message ?? response.body ?? {};

  return {
    header: {
      resultCode: response.header?.resultCode ?? null,
      resultMessage: normalizeOptionalString(response.header?.resultMessage),
    },
    requestId: normalizeOptionalString(data.requestId),
  };
}

function isFailedForResend(row) {
  const resultCode = normalizeOptionalString(row.resultCode)?.toUpperCase();
  const status = normalizeOptionalString(row.messageStatus ?? row.msgStatus ?? row.status ?? row.statusCode)?.toUpperCase();

  if (resultCode && !['MRC01', '1000', '0'].includes(resultCode)) return true;
  if (['FAILED', 'FAIL', 'CANCELED', 'CANCELLED', 'ERROR'].includes(status)) return true;
  if (status && /^[45]/.test(status)) return true;

  return false;
}

function buildDateQuery({ channel, from, to }) {
  if (isKakaoBizmessageChannel(channel)) {
    return {
      startRequestDate: formatNhnDateTime(from, { seconds: false }),
      endRequestDate: formatNhnDateTime(to, { seconds: false }),
    };
  }

  return {
    startRequestDate: formatNhnDateTime(from, { seconds: true }),
    endRequestDate: formatNhnDateTime(to, { seconds: true }),
  };
}

function normalizeDateRange(query, { requireRange }) {
  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to');

  if (requireRange && (!from || !to)) {
    throw new RelayValidationError('from and to are required.');
  }

  if (from && to && from > to) {
    throw new RelayValidationError('from must be before to.');
  }

  if (from && to && differenceInDays(from, to) > MAX_LOG_RANGE_DAYS) {
    throw new RelayValidationError(`Log date range cannot exceed ${MAX_LOG_RANGE_DAYS} days.`);
  }

  return { from, to };
}

function parseDate(value, name) {
  const input = normalizeOptionalString(value);
  if (!input) return null;

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new RelayValidationError(`${name} must be a valid date.`);
  }

  return date;
}

function formatNhnDateTime(date, { seconds }) {
  const pad = (value) => String(value).padStart(2, '0');
  const value = new Date(date.getTime() + 9 * 60 * 60000);
  const base = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ${pad(
    value.getUTCHours()
  )}:${pad(value.getUTCMinutes())}`;

  return seconds ? `${base}:${pad(value.getUTCSeconds())}` : base;
}

function differenceInDays(from, to) {
  return (to.getTime() - from.getTime()) / 86400000;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600000);
}

function normalizeChannel(value) {
  const channel = normalizeOptionalString(value)?.toLowerCase();

  if (channel === CHANNELS.ALIMTALK) return CHANNELS.ALIMTALK;
  if (channel === CHANNELS.BRAND_MESSAGE) return CHANNELS.BRAND_MESSAGE;
  if (channel === CHANNELS.SMS) return CHANNELS.SMS;
  if (channel === CHANNELS.LMS) return CHANNELS.LMS;
  if (channel === CHANNELS.MMS) return CHANNELS.MMS;

  throw new RelayValidationError('channel must be alimtalk, brand-message, sms, lms, or mms.');
}

function normalizeExportChannel(query) {
  const channel = normalizeChannel(query.channel);
  if (channel !== CHANNELS.SMS) return channel;

  const messageType = normalizeOptionalString(query.messageType)?.toLowerCase();
  if (!messageType || messageType === 'all') return channel;
  if (SMS_LEDGER_CHANNELS.includes(messageType)) return messageType;

  throw new RelayValidationError('messageType must be sms, lms, or mms.');
}

function getResourceTypeForChannel(channel) {
  return isKakaoBizmessageChannel(channel)
    ? SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY
    : SENDER_RESOURCE_TYPES.SMS_SEND_NO;
}

function isKakaoBizmessageChannel(channel) {
  return channel === CHANNELS.ALIMTALK || channel === CHANNELS.BRAND_MESSAGE;
}

function normalizeRecipientSeq(value) {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 0) {
    throw new RelayValidationError('recipientSeq must be a non-negative integer.');
  }

  return number;
}

function normalizePageSize(value) {
  const pageSize = normalizePositiveInteger(value, 'pageSize', 20);

  if (pageSize < MIN_PAGE_SIZE || pageSize > MAX_PAGE_SIZE) {
    throw new RelayValidationError(`pageSize must be between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE}.`);
  }

  return pageSize;
}

function normalizeRecipientPageSize(value) {
  const pageSize = normalizePositiveInteger(value, 'pageSize', 100);

  if (pageSize < MIN_PAGE_SIZE || pageSize > MAX_RECIPIENT_PAGE_SIZE) {
    throw new RelayValidationError(`pageSize must be between ${MIN_PAGE_SIZE} and ${MAX_RECIPIENT_PAGE_SIZE}.`);
  }

  return pageSize;
}

function normalizePositiveInteger(value, name, fallback) {
  if (value === undefined || value === null || value === '') return fallback;

  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new RelayValidationError(`${name} must be a positive integer.`);
  }

  return number;
}

function normalizeOptionalInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
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

function optionalStringProperty(name, value) {
  const normalized = normalizeOptionalString(value);
  return normalized ? { [name]: normalized } : {};
}

function optionalObjectProperty(name, value) {
  const object = sanitizeObject(value);
  return object ? { [name]: object } : {};
}

function optionalObjectArrayProperty(name, value) {
  const array = sanitizeObjectArray(value);
  return array.length ? { [name]: array } : {};
}

function sanitizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return { ...value };
}

function sanitizeObjectArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)).map((item) => ({ ...item }));
}

function truncatePreview(value) {
  const text = normalizeOptionalString(value);
  if (!text) return null;

  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}

function hasNextPage({ pageNum, pageSize, totalCount, receivedCount }) {
  if (!receivedCount) return false;
  if (Number.isInteger(totalCount)) {
    return pageNum * pageSize < totalCount;
  }

  return receivedCount >= pageSize;
}

function compareLogsDesc(left, right) {
  return compareLogsAsc(right, left);
}

function compareLogsAsc(left, right) {
  return String(left.requestDate ?? '').localeCompare(String(right.requestDate ?? ''));
}

function createCsvStream(logs) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`${CSV_COLUMNS.join(',')}\n`));

      for (const log of logs) {
        controller.enqueue(encoder.encode(`${CSV_COLUMNS.map((column) => csvCell(log[column])).join(',')}\n`));
      }

      controller.close();
    },
  });
}

function csvCell(value) {
  let text = value === undefined || value === null ? '' : String(value);

  if (/^[=+\-@\t\r\n]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function buildExportFilename({ channel, from, to }) {
  const toDate = (value) => value.toISOString().slice(0, 10);
  return `message-logs-${channel}-${toDate(from)}-${toDate(to)}.csv`;
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
    sendSms: (...args) => getClient().sendSms(...args),
    sendMms: (...args) => getClient().sendMms(...args),
    listSmsMessages: (...args) => getClient().listSmsMessages(...args),
    getSmsMessage: (...args) => getClient().getSmsMessage(...args),
    listMmsMessages: (...args) => getClient().listMmsMessages(...args),
    getMmsMessage: (...args) => getClient().getMmsMessage(...args),
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
    sendRawAlimtalkMessage: (...args) => getClient().sendRawAlimtalkMessage(...args),
    listAlimtalkMessages: (...args) => getClient().listAlimtalkMessages(...args),
    getAlimtalkMessage: (...args) => getClient().getAlimtalkMessage(...args),
    listAlimtalkMessageResults: (...args) => getClient().listAlimtalkMessageResults(...args),
    listBrandMessages: (...args) => getClient().listBrandMessages(...args),
    getBrandMessage: (...args) => getClient().getBrandMessage(...args),
  };
}
