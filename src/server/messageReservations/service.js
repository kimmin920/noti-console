import { createHash } from 'node:crypto';

import { getDb } from '../../db/client.js';
import { resolveNhnKakaoBizmessageConfig, resolveNhnSmsConfig } from '../nhn/config.js';
import { createNhnKakaoBizmessageClient } from '../nhn/kakaoBizmessageClient.js';
import { createNhnSmsClient } from '../nhn/smsClient.js';
import {
  CHANNELS,
  PROVIDERS,
  RELAY_ERROR_CODES,
  SENDER_RESOURCE_TYPES,
} from '../relay/constants.js';
import { RelayError, RelayValidationError } from '../relay/errors.js';
import { resolveGroupingFromKeys } from '../relay/groupingKeys.js';
import { createMessageLogRepository, createMessageSendLedgerRepository } from '../messageLogs/repository.js';
import { createSmsBulkSendRunRepository } from '../messages/repository.js';

const ALL_RESERVATION_CHANNEL = 'all';
const USER_STATUS_ACTIVE = 'active';
const BILLING_ACCOUNT_STATUS_ACTIVE = 'active';
const LINK_STATUS_ACTIVE = 'active';
const RESOURCE_STATUS_ACTIVE = 'active';
const READ_ROLES = new Set(['owner', 'sender', 'viewer', 'auditor']);
const CANCEL_ROLES = new Set(['owner', 'sender']);
const MAX_RESERVATION_RANGE_DAYS = 60;
const DEFAULT_PROVIDER_PAGE_SIZE = 1000;
const MAX_PROVIDER_RESERVATION_PAGES_PER_RESOURCE = 100;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 100;
const MULTIPLE_TEMPLATE_LABEL = '여러 템플릿';

const CANCELED_RESERVATION_STATUSES = new Set([
  'CANCEL',
  'CANCELED',
  'CANCELLED',
  'CANCEL_REQUEST',
  'CANCEL_REQUESTED',
]);
const COMPLETED_RESERVATION_STATUSES = new Set(['3', 'COMPLETE', 'COMPLETED', 'SUCCESS', 'SUCCEEDED']);
const FAILED_RESERVATION_STATUSES = new Set(['4', '5', 'ERROR', 'FAIL', 'FAILED']);
const RESERVED_RESERVATION_STATUSES = new Set(['0', '1', 'READY', 'RESERVE', 'RESERVED', 'SCHEDULED', 'WAIT', 'WAITING']);
const SENDING_RESERVATION_STATUSES = new Set(['2', 'IN_PROGRESS', 'PROCESS', 'PROCESSING', 'SEND', 'SENDING']);
const RESERVATION_CHANNELS = [CHANNELS.SMS, CHANNELS.ALIMTALK, CHANNELS.BRAND_MESSAGE];

export function createDefaultMessageReservationRepository() {
  const db = getDb();

  return {
    ...createMessageLogRepository(db),
    ...createMessageSendLedgerRepository(db),
    ...createSmsBulkSendRunRepository(db),
  };
}

export function createDefaultMessageReservationService() {
  return createMessageReservationService({
    repository: createDefaultMessageReservationRepository(),
    kakaoClient: createLazyNhnKakaoBizmessageClient(),
    smsClient: createLazyNhnSmsClient(),
  });
}

export function createMessageReservationService({
  repository,
  smsClient,
  kakaoClient = createLazyNhnKakaoBizmessageClient(),
  now = () => new Date(),
}) {
  return {
    async listReservationGroups({ actorUserId, query = {} }) {
      const user = await requireActiveUser(repository, actorUserId);
      const channel = normalizeReservationChannel(query.channel);
      const { from, to } = normalizeDateRange(query, { requireRange: true, now });
      const page = normalizePositiveInteger(query.page, 'page', 1);
      const pageSize = normalizePageSize(query.pageSize);
      const { reservations } = await fetchAuthorizedReservationRows({
        channel,
        from,
        kakaoClient,
        repository,
        smsClient,
        to,
        user,
      });
      const groups = await buildReservationGroups({ actorUserId: user.id, repository, reservations });
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

    async getReservationGroupDetail({ actorUserId, requestId, query = {} }) {
      const user = await requireActiveUser(repository, actorUserId);
      const channel = normalizeConcreteReservationChannel(query.channel);
      const normalizedRequestId = normalizeRequiredString(requestId, 'requestId');
      const senderResourceId = normalizeRequiredString(query.senderResourceId, 'senderResourceId');
      const { reservations } = await fetchAuthorizedReservationRows({
        channel,
        kakaoClient,
        repository,
        requestId: normalizedRequestId,
        senderResourceId,
        smsClient,
        user,
      });
      const groups = await buildInternalReservationGroupsForRows({ actorUserId: user.id, repository, reservations });
      const group = groups.find(
        (item) =>
          item.groupType === 'provider_request'
          && item.requestId === normalizedRequestId
          && item.senderResourceId === senderResourceId
      );

      if (!group) {
        throw forbidden('Reservation group was not found or is not available.');
      }

      return createPublicReservationGroupDetailDto({ actorUserId: user.id, group, repository });
    },

    async getReservationGroupDetailById({ actorUserId, groupId, query = {} }) {
      const user = await requireActiveUser(repository, actorUserId);
      const normalizedGroupId = normalizeRequiredString(groupId, 'groupId');
      const channel = normalizeReservationChannel(query.channel);
      const { from, to } = normalizeDateRange(query, { requireRange: true, now });
      const { reservations } = await fetchAuthorizedReservationRows({
        channel,
        from,
        kakaoClient,
        repository,
        smsClient,
        to,
        user,
      });
      const group = (await buildInternalReservationGroupsForRows({
        actorUserId: user.id,
        repository,
        reservations,
      })).find((item) => item.id === normalizedGroupId);

      if (!group) {
        throw forbidden('Reservation group was not found or is not available.');
      }

      return createPublicReservationGroupDetailDto({ actorUserId: user.id, group, repository });
    },

    async getReservationBatchRecipients({ actorUserId, groupId, providerRequestId, query = {} }) {
      const user = await requireActiveUser(repository, actorUserId);
      const normalizedGroupId = normalizeRequiredString(groupId, 'groupId');
      const normalizedProviderRequestId = normalizeRequiredString(providerRequestId, 'providerRequestId');
      const channel = normalizeReservationChannel(query.channel);
      const { from, to } = normalizeDateRange(query, { requireRange: true, now });
      const page = normalizePositiveInteger(query.page, 'page', 1);
      const pageSize = normalizePageSize(query.pageSize, 50);
      const { reservations } = await fetchAuthorizedReservationRows({
        channel,
        from,
        kakaoClient,
        repository,
        smsClient,
        to,
        user,
      });
      const group = (await buildInternalReservationGroupsForRows({
        actorUserId: user.id,
        repository,
        reservations,
      })).find((item) => item.id === normalizedGroupId);

      if (!group || group.groupType !== 'bulk_run' || !group.providerRequestIds.has(normalizedProviderRequestId)) {
        throw forbidden('Reservation batch was not found or is not available.');
      }

      const batch = (await buildPublicReservationBatchDtos({
        actorUserId: user.id,
        group,
        repository,
      })).find((item) => item.providerRequestId === normalizedProviderRequestId) ?? null;
      const batchRecipients = group.reservations
        .filter((reservation) => reservation.requestId === normalizedProviderRequestId)
        .sort(compareReservationRecipientsAsc)
        .map(toPublicReservationRecipientDto);
      const startIndex = (page - 1) * pageSize;

      return {
        batch,
        group: toPublicReservationGroupDto(group),
        hasNextPage: startIndex + pageSize < batchRecipients.length,
        page,
        pageSize,
        recipients: batchRecipients.slice(startIndex, startIndex + pageSize),
        total: batchRecipients.length,
      };
    },

    async cancelReservationGroup({ actorUserId, requestId, query = {} }) {
      const user = await requireActiveUser(repository, actorUserId);
      const channel = normalizeConcreteReservationChannel(query.channel);
      assertSmsReservationCancelChannel(channel);
      const normalizedRequestId = normalizeRequiredString(requestId, 'requestId');
      const senderResourceId = normalizeRequiredString(query.senderResourceId, 'senderResourceId');
      const { reservations } = await fetchAuthorizedReservationRows({
        allowedRoles: CANCEL_ROLES,
        channel,
        kakaoClient,
        repository,
        requestId: normalizedRequestId,
        senderResourceId,
        smsClient,
        user,
      });
      const groups = await buildInternalReservationGroupsForRows({ actorUserId: user.id, repository, reservations });
      const group = groups.find(
        (item) =>
          item.groupType === 'provider_request'
          && item.requestId === normalizedRequestId
          && item.senderResourceId === senderResourceId
      );
      const groupReservations = group?.reservations.slice().sort(compareReservationRecipientsAsc) ?? [];

      if (!groupReservations.length) {
        throw forbidden('Reservation group was not found or is not available.');
      }

      const cancelableReservations = groupReservations.filter(isCancelableReservation);

      if (!cancelableReservations.length) {
        throw new RelayValidationError('No cancelable reserved recipients were found.');
      }

      const providerResponse = await cancelProviderReservations({
        cancelableReservations,
        channel,
        kakaoClient,
        smsClient,
        user,
      });
      const providerData = normalizeReservationCancelResponse(providerResponse, cancelableReservations.length);
      await mergeConfirmedReservationCancellation({
        cancelableReservations,
        now: now(),
        providerData,
        repository,
      });

      return {
        canceledCount: providerData.canceledCount,
        channel,
        provider: providerData,
        requestId: normalizedRequestId,
        requestedCount: providerData.requestedCount,
        skippedCount: groupReservations.length - cancelableReservations.length,
        state: providerData.canceledCount === cancelableReservations.length ? 'canceled' : 'partial',
        targetCount: cancelableReservations.length,
        totalCount: groupReservations.length,
      };
    },

    async cancelReservationGroupById({ actorUserId, groupId, query = {} }) {
      const user = await requireActiveUser(repository, actorUserId);
      const normalizedGroupId = normalizeRequiredString(groupId, 'groupId');
      const channel = normalizeReservationChannel(query.channel);
      const { from, to } = normalizeDateRange(query, { requireRange: true, now });
      const { reservations } = await fetchAuthorizedReservationRows({
        allowedRoles: CANCEL_ROLES,
        channel,
        from,
        kakaoClient,
        repository,
        smsClient,
        to,
        user,
      });
      const group = (await buildInternalReservationGroupsForRows({
        actorUserId: user.id,
        repository,
        reservations,
      })).find((item) => item.id === normalizedGroupId);

      if (!group) {
        throw forbidden('Reservation group was not found or is not available.');
      }

      assertSmsReservationCancelChannel(group.channel);

      const groupReservations = group.reservations.slice().sort(compareReservationRecipientsAsc);
      const cancelableReservations = groupReservations.filter(isCancelableReservation);

      if (!cancelableReservations.length) {
        throw new RelayValidationError('No cancelable reserved recipients were found.');
      }

      const providerResponse = await cancelProviderReservations({
        cancelableReservations,
        channel: group.channel,
        kakaoClient,
        smsClient,
        user,
      });
      const providerData = normalizeReservationCancelResponse(providerResponse, cancelableReservations.length);
      await mergeConfirmedReservationCancellation({
        cancelableReservations,
        now: now(),
        providerData,
        repository,
      });

      return {
        canceledCount: providerData.canceledCount,
        channel: group.channel,
        groupId: normalizedGroupId,
        provider: providerData,
        requestedCount: providerData.requestedCount,
        skippedCount: groupReservations.length - cancelableReservations.length,
        state: providerData.canceledCount === cancelableReservations.length ? 'canceled' : 'partial',
        targetCount: cancelableReservations.length,
        totalCount: groupReservations.length,
      };
    },
  };
}

async function fetchAuthorizedReservationRows({
  allowedRoles = READ_ROLES,
  channel,
  kakaoClient,
  repository,
  requestId,
  senderResourceId,
  from,
  to,
  smsClient,
  user,
}) {
  if (channel === ALL_RESERVATION_CHANNEL) {
    const results = await Promise.all(
      RESERVATION_CHANNELS.map((reservationChannel) =>
        fetchAuthorizedReservationRows({
          allowedRoles,
          channel: reservationChannel,
          from,
          kakaoClient,
          repository,
          requestId,
          senderResourceId,
          smsClient,
          to,
          user,
        })
      )
    );

    return {
      providerResult: {
        providerPagesFetched: results.reduce((total, result) => total + result.providerResult.providerPagesFetched, 0),
        providerTotalCount: null,
      },
      reservations: results.flatMap((result) => result.reservations),
      resources: results.flatMap((result) => result.resources),
    };
  }

  const resources = await listActiveReservationResources({ repository, user, allowedRoles, channel });
  const providerResult = await fetchProviderReservations({
    channel,
    kakaoClient,
    requestId,
    resources,
    from,
    pageSize: DEFAULT_PROVIDER_PAGE_SIZE,
    smsClient,
    to,
  });

  return {
    providerResult,
    reservations: providerResult.rows
      .map((row) => authorizeAndNormalizeReservation({ row, fallbackChannel: channel, resources, user }))
      .filter((reservation) => {
        if (!reservation?.requestId || reservation.recipientSeq === null) return false;
        if (senderResourceId && reservation.senderResourceId !== senderResourceId) return false;
        return reservation.channel === channel;
      }),
    resources,
  };
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

async function listActiveReservationResources({ repository, user, allowedRoles, channel }) {
  const resourceType = getReservationResourceType(channel);
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

async function fetchProviderReservations({
  channel,
  kakaoClient,
  requestId,
  resources,
  from,
  to,
  pageSize,
  smsClient,
}) {
  const rows = [];
  let providerPagesFetched = 0;
  let providerTotalCount = 0;
  let hasCompleteTotalCount = true;

  for (const context of resources) {
    let pageNum = 1;
    let resourceTotalCount = null;

    while (true) {
      if (pageNum > MAX_PROVIDER_RESERVATION_PAGES_PER_RESOURCE) {
        throw new RelayValidationError(
          `Provider reservation scan exceeded ${MAX_PROVIDER_RESERVATION_PAGES_PER_RESOURCE} pages. Narrow the date range and try again.`
        );
      }

      const response = await listProviderReservationPage({
        channel,
        context,
        from,
        kakaoClient,
        pageNum,
        pageSize,
        requestId,
        smsClient,
        to,
      });
      const page = extractProviderReservationPage(response, channel);
      providerPagesFetched += 1;
      if (pageNum === 1) {
        resourceTotalCount = page.totalCount;
      }
      rows.push(
        ...page.items.map((item) => ({
          ...item,
          _channel: channel,
          _contextHint: context,
        }))
      );

      if (!hasNextPage({
        pageNum,
        pageSize: page.pageSize,
        receivedCount: page.items.length,
        totalCount: page.totalCount,
      })) {
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

function listProviderReservationPage({
  channel,
  context,
  from,
  kakaoClient,
  pageNum,
  pageSize,
  requestId,
  smsClient,
  to,
}) {
  const query = {
    ...buildProviderReservationQuery({ channel, context, from, requestId, to }),
    pageNum,
    pageSize,
  };

  if (channel === CHANNELS.ALIMTALK) {
    return kakaoClient.listAlimtalkMessages(query);
  }

  if (channel === CHANNELS.BRAND_MESSAGE) {
    return kakaoClient.listBrandMessages(query);
  }

  return smsClient.listReservations(query);
}

function buildProviderReservationQuery({ channel, context, from, requestId, to }) {
  const resourceQuery = isKakaoReservationChannel(channel)
    ? { senderKey: context.resource.value }
    : { sendNo: context.resource.value };

  return {
    ...resourceQuery,
    ...(from && to
      ? {
          startRequestDate: formatNhnDateTime(from, { seconds: !isKakaoReservationChannel(channel) }),
          endRequestDate: formatNhnDateTime(to, { seconds: !isKakaoReservationChannel(channel) }),
        }
      : {}),
    ...(requestId ? { requestId } : {}),
  };
}

function extractProviderReservationPage(response, channel) {
  if (isKakaoReservationChannel(channel)) {
    const body = response?.messageSearchResultResponse ?? response?.body?.messageSearchResultResponse ?? response?.body ?? {};
    const items = body.messages ?? body.data ?? response?.messages ?? [];

    return {
      items: Array.isArray(items) ? items : [],
      pageSize: normalizeOptionalInteger(body.pageSize) ?? DEFAULT_PROVIDER_PAGE_SIZE,
      totalCount: normalizeOptionalInteger(body.totalCount),
    };
  }

  const body = response?.body ?? response ?? {};
  const items = body.data ?? body.reservationList ?? body.resultList ?? response?.data ?? [];

  return {
    items: Array.isArray(items) ? items : [],
    pageSize: normalizeOptionalInteger(body.pageSize) ?? DEFAULT_PROVIDER_PAGE_SIZE,
    totalCount: normalizeOptionalInteger(body.totalCount),
  };
}

function authorizeAndNormalizeReservation({ row, fallbackChannel, resources, user }) {
  if (!row || typeof row !== 'object') return null;

  const senderGroupingKey = normalizeOptionalString(
    row.senderGroupingKey ?? row.groupingKey ?? row.sendGroupingKey ?? row._senderGroupingKey
  );
  const recipientGroupingKey = normalizeOptionalString(row.recipientGroupingKey ?? row.receiveGroupingKey);
  const hasGroupingKey = Boolean(senderGroupingKey || recipientGroupingKey);

  if (!hasGroupingKey) {
    const context = row._contextHint;

    if (!isProviderContextFallbackAuthorized({ row, fallbackChannel, context })) {
      return null;
    }

    return normalizeReservationDto({ row, fallbackChannel, context, grouping: null });
  }

  const grouping = resolveGroupingFromKeys({ senderGroupingKey, recipientGroupingKey });

  if (!grouping || grouping.userRef !== user.userRef) {
    return null;
  }

  const context = resources.find(
    (item) =>
      item.resource.resourceRef === grouping.resourceRef
      && item.billingAccount.billingRef === grouping.billingRef
  );

  if (!context) {
    return null;
  }

  return normalizeReservationDto({ row, fallbackChannel, context, grouping });
}

function isProviderContextFallbackAuthorized({ row, fallbackChannel, context }) {
  const contextSenderValue = normalizeOptionalString(context?.resource?.value);
  const rowSenderValue = getReservationRowSenderValue(row, fallbackChannel);

  return Boolean(contextSenderValue && rowSenderValue && contextSenderValue === rowSenderValue);
}

function getReservationRowSenderValue(row, channel) {
  if (isKakaoReservationChannel(channel)) {
    return normalizeOptionalString(row.senderKey ?? row.sender_key);
  }

  return normalizeOptionalString(row.sendNo ?? row.senderNo);
}

function normalizeReservationDto({ row, fallbackChannel, context, grouping }) {
  if (!row || typeof row !== 'object') return null;

  const resolvedContext = context ?? row._contextHint;
  const channel = normalizeReservationDisplayChannel(fallbackChannel);
  const requestId = normalizeOptionalString(row.requestId ?? row.requestID);
  const recipientSeq = normalizeOptionalInteger(row.recipientSeq);
  const body = normalizeOptionalString(row.body ?? row.content ?? row.messageContent ?? row.templateContent);

  return {
    id: `${channel}:${resolvedContext?.resource?.id ?? 'unknown'}:${requestId ?? 'unknown'}:${recipientSeq ?? 'unknown'}`,
    channel,
    grouping,
    requestId,
    recipientSeq,
    senderResourceId: resolvedContext?.resource?.id ?? null,
    senderLabel: resolvedContext?.resource?.displayName || resolvedContext?.resource?.value || normalizeOptionalString(row.sendNo),
    recipientNo: normalizeOptionalString(row.recipientNo ?? row.phoneNo ?? row.internationalRecipientNo),
    contentPreview: truncatePreview(body),
    templateCode: normalizeOptionalString(row.templateCode ?? row.templateId),
    requestDate: normalizeOptionalString(row.requestDate ?? row.reservationDate ?? row.reservedDate),
    createDate: normalizeOptionalString(row.createDate ?? row.createdDate ?? row.registerDate),
    status: normalizeOptionalString(row.messageStatus ?? row.msgStatus ?? row.status ?? row.statusCode),
    resultCode: row.resultCode ?? null,
    resultMessage: normalizeOptionalString(row.resultMessage ?? row.resultMessageName ?? row.messageStatusName),
    raw: row,
  };
}

async function buildReservationGroups({ actorUserId, repository, reservations }) {
  const groups = await buildInternalReservationGroupsForRows({ actorUserId, repository, reservations });
  return groups.map(toPublicReservationGroupDto);
}

async function buildInternalReservationGroupsForRows({ actorUserId, repository, reservations }) {
  const bulkMappings = await findSmsBulkMappingsForReservations({ actorUserId, repository, reservations });
  return buildInternalReservationGroups(reservations, bulkMappings);
}

async function findSmsBulkMappingsForReservations({ actorUserId, repository, reservations }) {
  if (typeof repository.findSmsBulkRunMappingsByProviderRequestIds !== 'function') {
    return new Map();
  }

  const lookupGroups = groupSmsReservationRequestIdsBySender(reservations);
  if (!lookupGroups.length) return new Map();

  const mappings = new Map();
  const fallbackMappings = new Map();

  for (const group of lookupGroups) {
    const groupMappings = await repository.findSmsBulkRunMappingsByProviderRequestIds({
      actorUserId,
      providerRequestIds: group.providerRequestIds,
      senderResourceId: group.senderResourceId,
    });

    for (const providerRequestId of group.providerRequestIds) {
      const mapping = groupMappings.get(providerRequestId);
      if (!mapping) continue;

      mappings.set(getReservationBulkMappingKey({
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

function groupSmsReservationRequestIdsBySender(reservations) {
  const groupsBySender = new Map();

  for (const reservation of reservations) {
    if (reservation.channel !== CHANNELS.SMS || !reservation.requestId) continue;

    const senderResourceId = normalizeOptionalString(reservation.senderResourceId);
    const key = senderResourceId ?? 'unknown';
    const group = groupsBySender.get(key) ?? {
      senderResourceId,
      providerRequestIds: new Set(),
    };
    group.providerRequestIds.add(reservation.requestId);
    groupsBySender.set(key, group);
  }

  return Array.from(groupsBySender.values())
    .map((group) => ({
      senderResourceId: group.senderResourceId,
      providerRequestIds: Array.from(group.providerRequestIds),
    }))
    .filter((group) => group.providerRequestIds.length > 0);
}

function buildInternalReservationGroups(reservations, bulkMappings = new Map()) {
  const groupsById = new Map();

  for (const reservation of reservations) {
    if (!reservation.requestId) continue;
    const bulkMapping = getBulkMappingForReservation(reservation, bulkMappings);
    const groupType = bulkMapping ? 'bulk_run' : 'provider_request';
    const groupId = bulkMapping
      ? getBulkReservationGroupId({ channel: reservation.channel, runId: bulkMapping.run.id })
      : getProviderReservationGroupId(reservation);

    const group = groupsById.get(groupId) ?? {
      id: groupId,
      channel: reservation.channel,
      bulkRunId: bulkMapping?.run?.id ?? null,
      groupType,
      managementTitle: bulkMapping?.run?.managementSendName ?? null,
      providerRequestIds: new Set(),
      reservations: [],
      requestId: groupType === 'provider_request' ? reservation.requestId : null,
      representativeRequestId: reservation.requestId,
      senderResourceId: reservation.senderResourceId,
      senderLabel: reservation.senderLabel,
    };

    group.providerRequestIds.add(reservation.requestId);
    group.reservations.push(reservation);
    groupsById.set(groupId, group);
  }

  return Array.from(groupsById.values())
    .sort(compareInternalReservationGroupsAsc);
}

function toPublicReservationGroupDto(group) {
  const reservations = group.reservations.slice().sort(compareReservationRecipientsAsc);
  const states = reservations.map(classifyReservation);
  const canceledCount = states.filter((state) => state === 'canceled').length;
  const completedCount = states.filter((state) => state === 'completed').length;
  const failedCount = states.filter((state) => state === 'failed').length;
  const pendingCount = states.filter((state) => state === 'pending').length;
  const reservedCount = states.filter((state) => state === 'reserved').length;
  const sendingCount = states.filter((state) => state === 'sending').length;
  const templateCodes = uniqueNonEmpty(reservations.map((reservation) => reservation.templateCode));
  const contentReservation = reservations.find((reservation) => reservation.contentPreview);
  const providerRequestIds = Array.from(group.providerRequestIds ?? uniqueNonEmpty(reservations.map((reservation) => reservation.requestId)));

  return {
    id: group.id,
    aggregateState: getReservationAggregateState({
      canceledCount,
      completedCount,
      failedCount,
      pendingCount,
      recipientCount: reservations.length,
      reservedCount,
      sendingCount,
    }),
    canceledCount,
    channel: group.channel,
    completedCount,
    contentPreview: contentReservation?.contentPreview ?? null,
    createDate: pickExtremeReservationDate(reservations, 'createDate', compareReservationDateValuesAsc),
    failedCount,
    groupType: group.groupType ?? 'provider_request',
    ...(group.bulkRunId ? { bulkRunId: group.bulkRunId } : {}),
    managementTitle: group.managementTitle ?? null,
    pendingCount,
    providerRequestCount: providerRequestIds.length,
    recipientCount: reservations.length,
    representativeRequestId: group.representativeRequestId ?? providerRequestIds[0] ?? null,
    requestDate: pickExtremeReservationDate(reservations, 'requestDate', compareReservationDateValuesAsc),
    ...(group.requestId ? { requestId: group.requestId } : {}),
    reservedCount,
    senderResourceId: group.senderResourceId,
    senderLabel: group.senderLabel,
    sendingCount,
    templateCode: templateCodes.length > 1 ? MULTIPLE_TEMPLATE_LABEL : templateCodes[0] ?? null,
  };
}

function toPublicReservationRecipientDto(reservation) {
  const { grouping: _grouping, raw: _raw, ...publicReservation } = reservation;
  return publicReservation;
}

async function createPublicReservationGroupDetailDto({ actorUserId, group, repository }) {
  if (group.groupType === 'bulk_run') {
    return {
      batches: await buildPublicReservationBatchDtos({ actorUserId, group, repository }),
      group: toPublicReservationGroupDto(group),
      recipients: [],
    };
  }

  return {
    batches: [],
    group: toPublicReservationGroupDto(group),
    recipients: group.reservations
      .sort(compareReservationRecipientsAsc)
      .map(toPublicReservationRecipientDto),
  };
}

async function buildPublicReservationBatchDtos({ actorUserId, group, repository }) {
  const batches = await listSmsBulkBatchesForReservationGroup({ actorUserId, group, repository });
  const reservationsByRequestId = groupReservationsByRequestId(group.reservations);
  const totalBatches = normalizeOptionalInteger(group.providerRequestIds?.size) ?? batches.length;
  const batchRows = batches.length
    ? batches
    : Array.from(group.providerRequestIds ?? []).map((providerRequestId, index) => ({
        id: null,
        providerRequestId,
        recipientCount: reservationsByRequestId.get(providerRequestId)?.length ?? 0,
        requestDate: null,
        sequence: index + 1,
        status: null,
        totalBatches,
      }));
  const seenProviderRequestIds = new Set(batchRows
    .map((batch) => normalizeOptionalString(batch.providerRequestId))
    .filter(Boolean));

  for (const providerRequestId of group.providerRequestIds ?? []) {
    if (seenProviderRequestIds.has(providerRequestId)) continue;

    batchRows.push({
      id: null,
      providerRequestId,
      recipientCount: reservationsByRequestId.get(providerRequestId)?.length ?? 0,
      requestDate: null,
      sequence: batchRows.length + 1,
      status: null,
      totalBatches,
    });
  }

  return batchRows
    .map((batch) => toPublicReservationBatchDto({
      batch,
      group,
      reservations: reservationsByRequestId.get(normalizeOptionalString(batch.providerRequestId)) ?? [],
    }))
    .sort(compareReservationBatchesAsc);
}

async function listSmsBulkBatchesForReservationGroup({ actorUserId, group, repository }) {
  if (!group.bulkRunId || typeof repository.listSmsBulkBatchesForActor !== 'function') {
    return [];
  }

  return repository.listSmsBulkBatchesForActor({
    actorUserId,
    runId: group.bulkRunId,
    senderResourceId: group.senderResourceId,
  });
}

function toPublicReservationBatchDto({ batch, group, reservations }) {
  const recipientCount = normalizeOptionalInteger(batch.recipientCount) ?? reservations.length;
  const counts = reservations.length
    ? getReservationStateCounts(reservations)
    : getFallbackBatchStateCounts({ recipientCount, status: batch.status });
  const requestDate = pickExtremeReservationDate(reservations, 'requestDate', compareReservationDateValuesAsc)
    ?? normalizeOptionalString(batch.requestDate)
    ?? pickExtremeReservationDate(group.reservations, 'requestDate', compareReservationDateValuesAsc);

  return {
    aggregateState: getReservationAggregateState(counts),
    batchStatus: normalizeOptionalString(batch.status),
    canceledCount: counts.canceledCount,
    completedCount: counts.completedCount,
    errorCode: batch.errorCode ?? null,
    errorMessage: normalizeOptionalString(batch.errorMessage),
    errorState: normalizeOptionalString(batch.errorState),
    failedCount: counts.failedCount,
    id: normalizeOptionalString(batch.id) ?? getReservationBatchFallbackId({ batch, group }),
    observedRecipientCount: reservations.length,
    pendingCount: counts.pendingCount,
    providerRequestId: normalizeOptionalString(batch.providerRequestId),
    recipientCount,
    requestDate,
    reservedCount: counts.reservedCount,
    sendingCount: counts.sendingCount,
    sequence: normalizeOptionalInteger(batch.sequence),
    successRate: getReservationSuccessRate(counts),
    totalBatches: normalizeOptionalInteger(batch.totalBatches) ?? normalizeOptionalInteger(group.providerRequestIds?.size) ?? null,
  };
}

function getReservationStateCounts(reservations) {
  const states = reservations.map(classifyReservation);

  return {
    canceledCount: states.filter((state) => state === 'canceled').length,
    completedCount: states.filter((state) => state === 'completed').length,
    failedCount: states.filter((state) => state === 'failed').length,
    pendingCount: states.filter((state) => state === 'pending').length,
    recipientCount: reservations.length,
    reservedCount: states.filter((state) => state === 'reserved').length,
    sendingCount: states.filter((state) => state === 'sending').length,
  };
}

function getFallbackBatchStateCounts({ recipientCount, status }) {
  const counts = {
    canceledCount: 0,
    completedCount: 0,
    failedCount: 0,
    pendingCount: 0,
    recipientCount,
    reservedCount: 0,
    sendingCount: 0,
  };

  switch (normalizeOptionalString(status)) {
    case 'accepted':
      counts.reservedCount = recipientCount;
      break;
    case 'canceled':
      counts.canceledCount = recipientCount;
      break;
    case 'failed':
    case 'rejected':
      counts.failedCount = recipientCount;
      break;
    case 'pending':
    case 'running':
      counts.sendingCount = recipientCount;
      break;
    default:
      counts.pendingCount = recipientCount;
      break;
  }

  return counts;
}

function getReservationSuccessRate({ canceledCount, completedCount, failedCount, pendingCount, recipientCount, reservedCount, sendingCount }) {
  const aggregateState = getReservationAggregateState({
    canceledCount,
    completedCount,
    failedCount,
    pendingCount,
    recipientCount,
    reservedCount,
    sendingCount,
  });

  if (!['completed', 'failed'].includes(aggregateState)) {
    return null;
  }

  const denominator = completedCount + failedCount;
  return denominator > 0 ? Math.round((completedCount / denominator) * 100) : null;
}

function groupReservationsByRequestId(reservations) {
  const groups = new Map();

  for (const reservation of reservations) {
    if (!reservation.requestId) continue;

    const group = groups.get(reservation.requestId) ?? [];
    group.push(reservation);
    groups.set(reservation.requestId, group);
  }

  return groups;
}

function getReservationBatchFallbackId({ batch, group }) {
  return [
    group.bulkRunId,
    normalizeOptionalString(batch.providerRequestId) ?? 'unknown',
    normalizeOptionalString(batch.sequence) ?? 'unknown',
  ].join(':');
}

function compareReservationBatchesAsc(left, right) {
  const leftSequence = normalizeOptionalInteger(left.sequence) ?? Number.MAX_SAFE_INTEGER;
  const rightSequence = normalizeOptionalInteger(right.sequence) ?? Number.MAX_SAFE_INTEGER;

  if (leftSequence !== rightSequence) {
    return leftSequence - rightSequence;
  }

  return String(left.providerRequestId ?? left.id ?? '').localeCompare(String(right.providerRequestId ?? right.id ?? ''));
}

function getBulkMappingForReservation(reservation, bulkMappings) {
  if (reservation?.channel !== CHANNELS.SMS || !reservation.requestId) return null;

  const mapping = bulkMappings.get(getReservationBulkMappingKey({
    providerRequestId: reservation.requestId,
    senderResourceId: reservation.senderResourceId,
  })) ?? bulkMappings.get(reservation.requestId);
  if (!mapping?.run?.id) return null;
  if (mapping.run.senderResourceId && reservation.senderResourceId && mapping.run.senderResourceId !== reservation.senderResourceId) {
    return null;
  }

  return mapping;
}

function getReservationBulkMappingKey({ providerRequestId, senderResourceId }) {
  return [
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

function getBulkReservationGroupId({ channel, runId }) {
  return hashReservationGroupId(['reservation', 'bulk_run', channel, runId]);
}

function getProviderReservationGroupId(reservation) {
  return hashReservationGroupId([
    'reservation',
    'provider_request',
    reservation.channel,
    reservation.senderResourceId,
    reservation.requestId,
  ]);
}

function hashReservationGroupId(parts) {
  return createHash('sha256')
    .update(parts.map((value) => normalizeOptionalString(value) ?? 'unknown').join('|'))
    .digest('base64url');
}

function classifyReservation(reservation) {
  const status = normalizeOptionalString(reservation?.status)?.toUpperCase();

  if (CANCELED_RESERVATION_STATUSES.has(status)) return 'canceled';
  if (FAILED_RESERVATION_STATUSES.has(status)) return 'failed';
  if (COMPLETED_RESERVATION_STATUSES.has(status)) return 'completed';
  if (SENDING_RESERVATION_STATUSES.has(status)) return 'sending';
  if (RESERVED_RESERVATION_STATUSES.has(status)) return 'reserved';

  return 'pending';
}

function isCancelableReservation(reservation) {
  return classifyReservation(reservation) === 'reserved';
}

function assertSmsReservationCancelChannel(channel) {
  if (channel !== CHANNELS.SMS) {
    throw new RelayValidationError('Only SMS reservation cancellation is supported.');
  }
}

function cancelProviderReservations({ cancelableReservations, channel, kakaoClient, smsClient, user }) {
  if (isKakaoReservationChannel(channel)) {
    const requestId = cancelableReservations[0]?.requestId;
    const recipientSeq = cancelableReservations
      .map((reservation) => reservation.recipientSeq)
      .filter((value) => value !== null && value !== undefined)
      .join(',');

    if (channel === CHANNELS.ALIMTALK) {
      return kakaoClient.cancelAlimtalkMessages({ recipientSeq, requestId });
    }

    return kakaoClient.cancelBrandMessages({ recipientSeq, requestId });
  }

  return smsClient.cancelReservations({
    reservationList: cancelableReservations.map((reservation) => ({
      recipientSeq: reservation.recipientSeq,
      requestId: reservation.requestId,
    })),
    updateUser: getReservationUpdateUser(user),
  });
}

function normalizeReservationCancelResponse(response, requestedCount = 0) {
  const data = response?.body?.data ?? response?.data ?? {};
  const providerCanceledCount = normalizeOptionalInteger(data.canceledCount);
  const providerRequestedCount = normalizeOptionalInteger(data.requestedCount);

  return {
    canceledCount: providerCanceledCount ?? requestedCount,
    requestedCount: providerRequestedCount ?? requestedCount,
  };
}

async function mergeConfirmedReservationCancellation({
  cancelableReservations,
  now,
  providerData,
  repository,
}) {
  if (providerData.canceledCount !== cancelableReservations.length) return null;
  if (typeof repository.mergeProviderRequestResultSnapshotByProviderRequestId !== 'function') return null;

  const requestId = cancelableReservations[0]?.requestId;
  if (!requestId) return null;

  return repository.mergeProviderRequestResultSnapshotByProviderRequestId({
    authoritative: true,
    now,
    providerRequestId: requestId,
    results: cancelableReservations.map((reservation) => ({
      recipientSeq: reservation.recipientSeq,
      resultCode: 'RESERVATION_CANCELED',
      state: 'C',
    })),
  });
}

function getReservationUpdateUser(user) {
  return truncateRequiredString(user.userRef ?? user.email ?? user.id, 100);
}

function getReservationAggregateState({
  canceledCount,
  completedCount,
  failedCount,
  pendingCount,
  recipientCount,
  reservedCount,
  sendingCount,
}) {
  if (recipientCount > 0 && canceledCount === recipientCount) return 'canceled';
  if (sendingCount > 0) return 'sending';
  if (reservedCount > 0) return 'reserved';
  if (recipientCount > 0 && failedCount === recipientCount) return 'failed';
  if (recipientCount > 0 && completedCount > 0 && completedCount + failedCount + canceledCount === recipientCount) {
    return 'completed';
  }
  if (pendingCount > 0) return 'unknown';

  return 'unknown';
}

function normalizeReservationChannel(value) {
  const channel = normalizeOptionalString(value)?.toLowerCase() ?? ALL_RESERVATION_CHANNEL;

  if (channel === ALL_RESERVATION_CHANNEL) return ALL_RESERVATION_CHANNEL;
  return normalizeConcreteReservationChannel(channel);
}

function normalizeConcreteReservationChannel(value) {
  const channel = normalizeOptionalString(value)?.toLowerCase();

  if (channel === CHANNELS.SMS) return CHANNELS.SMS;
  if (channel === CHANNELS.LMS) return CHANNELS.SMS;
  if (channel === CHANNELS.MMS) return CHANNELS.SMS;
  if (channel === CHANNELS.ALIMTALK) return CHANNELS.ALIMTALK;
  if (channel === CHANNELS.BRAND_MESSAGE) return CHANNELS.BRAND_MESSAGE;

  throw new RelayValidationError('channel must be all, sms, alimtalk, or brand-message.');
}

function normalizeReservationDisplayChannel(channel) {
  return [CHANNELS.SMS, CHANNELS.LMS, CHANNELS.MMS].includes(channel) ? CHANNELS.SMS : channel;
}

function getReservationResourceType(channel) {
  return isKakaoReservationChannel(channel)
    ? SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY
    : SENDER_RESOURCE_TYPES.SMS_SEND_NO;
}

function isKakaoReservationChannel(channel) {
  return channel === CHANNELS.ALIMTALK || channel === CHANNELS.BRAND_MESSAGE;
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

  if (from && to && differenceInDays(from, to) > MAX_RESERVATION_RANGE_DAYS) {
    throw new RelayValidationError(`Reservation date range cannot exceed ${MAX_RESERVATION_RANGE_DAYS} days.`);
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

function formatNhnDateTime(date, { seconds = true } = {}) {
  const pad = (value) => String(value).padStart(2, '0');
  const value = new Date(date.getTime() + 9 * 60 * 60000);
  const dateTime = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ${pad(
    value.getUTCHours()
  )}:${pad(value.getUTCMinutes())}`;

  return seconds ? `${dateTime}:${pad(value.getUTCSeconds())}` : dateTime;
}

function differenceInDays(from, to) {
  return (to.getTime() - from.getTime()) / 86400000;
}

function normalizePageSize(value, fallback = 20) {
  const pageSize = normalizePositiveInteger(value, 'pageSize', fallback);

  if (pageSize < MIN_PAGE_SIZE || pageSize > MAX_PAGE_SIZE) {
    throw new RelayValidationError(`pageSize must be between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE}.`);
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

function truncateRequiredString(value, maxLength) {
  return normalizeRequiredString(value, 'updateUser').slice(0, maxLength);
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim();
  return trimmed || null;
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

function pickExtremeReservationDate(reservations, property, compareFn) {
  const values = reservations
    .map((reservation) => reservation[property])
    .filter((value) => normalizeOptionalString(value));

  if (!values.length) return null;

  return values.sort(compareFn)[0];
}

function compareInternalReservationGroupsAsc(left, right) {
  const leftRequestDate = pickExtremeReservationDate(left.reservations, 'requestDate', compareReservationDateValuesAsc);
  const rightRequestDate = pickExtremeReservationDate(right.reservations, 'requestDate', compareReservationDateValuesAsc);
  const dateComparison = compareReservationDateValuesAsc(leftRequestDate, rightRequestDate);
  return dateComparison === 0 ? left.id.localeCompare(right.id) : dateComparison;
}

function compareReservationRecipientsAsc(left, right) {
  const dateComparison = compareReservationDateValuesAsc(left.requestDate, right.requestDate);
  if (dateComparison !== 0) return dateComparison;

  return Number(left.recipientSeq ?? 0) - Number(right.recipientSeq ?? 0);
}

function compareReservationDateValuesAsc(left, right) {
  const leftValue = toReservationDateTime(left);
  const rightValue = toReservationDateTime(right);

  if (leftValue !== null && rightValue !== null && leftValue !== rightValue) {
    return leftValue - rightValue;
  }

  return String(left ?? '').localeCompare(String(right ?? ''));
}

function toReservationDateTime(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  const date = new Date(normalized.includes('T') ? normalized : normalized.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
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
    cancelReservations: (...args) => getClient().cancelReservations(...args),
    getReservation: (...args) => getClient().getReservation(...args),
    listReservations: (...args) => getClient().listReservations(...args),
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
    cancelAlimtalkMessages: (...args) => getClient().cancelAlimtalkMessages(...args),
    cancelBrandMessages: (...args) => getClient().cancelBrandMessages(...args),
    listAlimtalkMessages: (...args) => getClient().listAlimtalkMessages(...args),
    listBrandMessages: (...args) => getClient().listBrandMessages(...args),
  };
}
