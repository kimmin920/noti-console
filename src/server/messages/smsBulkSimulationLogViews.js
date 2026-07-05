import {
  SIMULATION_LOG_GROUP_PREFIX,
  SIMULATION_SENDER_LABEL,
  getBatchRecipientCount,
  getMessageAggregateState,
  getMessageResultState,
  getSimulationLogRequestId,
  getSimulationProviderRequestId,
  getSimulationRequestDate,
  getSimulationRunById,
  isDateInRange,
  isSmsListChannel,
  listRunBatchSequences,
  listSimulationRuns,
  parseDate,
  sortByCreatedAtDesc,
  sumMessageCounts,
  toIsoOrNull,
} from './smsBulkSimulationViewShared.js';

export function listDevSmsBulkSimulationLogGroups({
  actorUserId,
  env = process.env,
  now = new Date(),
  query = {},
} = {}) {
  if (!isSmsListChannel(query)) return [];
  const from = parseDate(query.from);
  const to = parseDate(query.to);

  return listSimulationRuns({ actorUserId, env, now })
    .filter((run) => isLogVisibleForRun(run, now))
    .map((run) => toSimulationLogGroup(run, now))
    .filter((group) => isDateInRange(group.requestDate, { from, to }))
    .sort(sortByCreatedAtDesc);
}

export function getDevSmsBulkSimulationLogGroupDetail({
  actorUserId,
  env = process.env,
  groupId,
  now = new Date(),
} = {}) {
  const run = getSimulationRunById({ actorUserId, env, groupId, now, prefix: SIMULATION_LOG_GROUP_PREFIX });
  if (!run || !isLogVisibleForRun(run, now)) return null;

  return {
    group: toSimulationLogGroup(run, now),
    recipients: [],
    requests: listSimulationLogRequests(run, now).map(({ providerRequestId: _providerRequestId, ...request }) => request),
  };
}

function isLogVisibleForRun(run, now) {
  if (!run.isReservation) return true;
  const requestDate = parseDate(run.requestDate);
  return Boolean(requestDate && requestDate <= now);
}

function toSimulationLogGroup(run, now) {
  const requests = listSimulationLogRequests(run, now);
  const counts = sumMessageCounts(requests);
  const resultState = getMessageResultState(counts, run.totalRecipients);
  const resultSyncedAt = resultState === 'not_synced' ? null : toIsoOrNull(now);

  return {
    id: `${SIMULATION_LOG_GROUP_PREFIX}${run.id}`,
    aggregateState: getMessageAggregateState(counts, run.totalRecipients),
    acceptedRequestCount: requests.filter((request) => request.providerState === 'accepted').length,
    canceledCount: counts.canceledCount,
    channel: run.channel ?? 'sms',
    createdAt: run.createdAt,
    expiresAt: toIsoOrNull(new Date(Date.parse(run.createdAt) + 90 * 86400000)),
    failedCount: counts.failedCount,
    managementTitle: run.managementSendName,
    pendingCount: counts.pendingCount,
    providerRequestCount: run.totalBatches,
    providerState: run.status === 'queued' ? 'queued' : 'accepted',
    receiveDate: resultSyncedAt,
    recipientCount: run.totalRecipients,
    requestDate: toIsoOrNull(getSimulationRequestDate(run)),
    resultFinalizedAt: resultState === 'synced' ? resultSyncedAt : null,
    resultState,
    resultSyncedAt,
    scheduledAt: run.isReservation ? toIsoOrNull(run.requestDate) : null,
    sendKind: 'bulk',
    sendTiming: run.isReservation ? 'scheduled' : 'immediate',
    senderLabel: SIMULATION_SENDER_LABEL,
    successCount: counts.successCount,
    totalRecipientCount: run.totalRecipients,
  };
}

export function listSimulationLogRequests(run, now) {
  return listRunBatchSequences(run).map((sequence) => {
    const recipientCount = getBatchRecipientCount(run, sequence);
    const counts = getBatchLogCounts({ now, recipientCount, run, sequence });
    const resultState = getMessageResultState(counts, recipientCount);

    return {
      id: getSimulationLogRequestId(run, sequence),
      providerRequestId: getSimulationProviderRequestId(run, sequence),
      sequence,
      recipientCount,
      providerState: resultState === 'not_synced' ? 'queued' : 'accepted',
      resultState,
      ...counts,
      resultSyncedAt: resultState === 'not_synced' ? null : toIsoOrNull(now),
      resultFinalizedAt: resultState === 'synced' ? toIsoOrNull(now) : null,
      createdAt: run.createdAt,
      canFetchRecipients: true,
    };
  });
}

function getBatchLogCounts({ recipientCount, run, sequence }) {
  if (run.status !== 'completed' && sequence > Number(run.acceptedBatchCount ?? 0)) {
    return { successCount: 0, failedCount: 0, pendingCount: recipientCount, canceledCount: 0 };
  }

  const failedCount = recipientCount >= 20 ? Math.max(1, Math.floor(recipientCount * 0.02)) : 0;
  const canceledCount = recipientCount >= 100 ? Math.max(1, Math.floor(recipientCount * 0.01)) : 0;
  const pendingCount = run.status === 'running' && sequence === Number(run.acceptedBatchCount ?? 0)
    ? Math.max(1, Math.floor(recipientCount * 0.05))
    : 0;
  const successCount = Math.max(recipientCount - failedCount - canceledCount - pendingCount, 0);
  return { successCount, failedCount, pendingCount, canceledCount };
}

export function findSimulationLogRequest(run, requestLocalId, now) {
  return listSimulationLogRequests(run, now).find((request) => request.id === requestLocalId) ?? null;
}

export function publicLogRequest(request) {
  const { providerRequestId: _providerRequestId, ...publicRequest } = request;
  return publicRequest;
}
