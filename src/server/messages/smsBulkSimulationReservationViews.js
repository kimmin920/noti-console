import {
  SIMULATION_PROVIDER_REQUEST_PREFIX,
  SIMULATION_RESERVATION_GROUP_PREFIX,
  SIMULATION_SENDER_LABEL,
  emptyReservationCounts,
  getBatchRecipientCount,
  getReservationAggregateState,
  getSimulationProviderRequestId,
  getSimulationRecipientNo,
  getSimulationRunById,
  getSuccessRate,
  isDateInRange,
  listRunBatchSequences,
  listSimulationRuns,
  normalizePositiveInteger,
  paginateItems,
  parseDate,
  sortByCreatedAtDesc,
  sumReservationCounts,
} from './smsBulkSimulationViewShared.js';

export function listDevSmsBulkSimulationReservationGroups({
  actorUserId,
  env = process.env,
  now = new Date(),
  query = {},
} = {}) {
  if (!isSmsReservationChannel(query.channel)) return [];
  const from = parseDate(query.from);
  const to = parseDate(query.to);

  return listSimulationRuns({ actorUserId, env, now })
    .filter((run) => run.isReservation)
    .map((run) => toSimulationReservationGroup(run))
    .filter((group) => isDateInRange(group.requestDate, { from, to }))
    .sort(sortByCreatedAtDesc);
}

export function getDevSmsBulkSimulationReservationDetail({
  actorUserId,
  env = process.env,
  groupId,
  now = new Date(),
} = {}) {
  const run = getSimulationRunById({ actorUserId, env, groupId, now, prefix: SIMULATION_RESERVATION_GROUP_PREFIX });
  if (!run || !run.isReservation) return null;
  const group = toSimulationReservationGroup(run);

  return {
    batches: listSimulationReservationBatches(run, group),
    group,
    recipients: [],
  };
}

export function getDevSmsBulkSimulationReservationBatchRecipients({
  actorUserId,
  env = process.env,
  groupId,
  now = new Date(),
  providerRequestId,
  query = {},
} = {}) {
  const run = getSimulationRunById({ actorUserId, env, groupId, now, prefix: SIMULATION_RESERVATION_GROUP_PREFIX });
  if (!run || !run.isReservation || !providerRequestId?.startsWith(SIMULATION_PROVIDER_REQUEST_PREFIX)) return null;
  const sequence = Number(providerRequestId.split('-').at(-1));
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > run.totalBatches) return null;

  const group = toSimulationReservationGroup(run);
  const batch = listSimulationReservationBatches(run, group)
    .find((item) => item.providerRequestId === providerRequestId);
  if (!batch) return null;

  const page = normalizePositiveInteger(query.page, 1);
  const pageSize = normalizePositiveInteger(query.pageSize, 50, 100);
  const total = getBatchRecipientCount(run, sequence);
  const rows = Array.from({ length: total }, (_, index) =>
    createSimulationReservationRecipient({ run, sequence, recipientIndex: index + 1 })
  );
  const pageResult = paginateItems(rows, { page, pageSize });

  return {
    batch,
    group,
    page,
    pageSize,
    hasNextPage: pageResult.hasNextPage,
    recipients: pageResult.items,
    total: pageResult.total,
  };
}

function isSmsReservationChannel(channel) {
  const normalized = String(channel ?? 'all').trim().toLowerCase();
  return normalized === 'all' || normalized === 'sms' || !normalized;
}

function toSimulationReservationGroup(run) {
  const batches = listRunBatchSequences(run).map((sequence) => {
    const recipientCount = getBatchRecipientCount(run, sequence);
    return {
      providerRequestId: getSimulationProviderRequestId(run, sequence),
      sequence,
      recipientCount,
      counts: getReservationCounts({ recipientCount, run, sequence }),
    };
  });
  const counts = sumReservationCounts(batches.map((batch) => batch.counts));

  return {
    id: `${SIMULATION_RESERVATION_GROUP_PREFIX}${run.id}`,
    aggregateState: getReservationAggregateState(counts),
    canceledCount: counts.canceledCount,
    channel: run.channel ?? 'sms',
    completedCount: counts.completedCount,
    contentPreview: run.managementSendName,
    createDate: run.createdAt,
    failedCount: counts.failedCount,
    groupType: 'bulk_run',
    bulkRunId: run.id,
    managementTitle: run.managementSendName,
    pendingCount: counts.pendingCount,
    providerRequestCount: run.totalBatches,
    recipientCount: run.totalRecipients,
    representativeRequestId: batches[0]?.providerRequestId ?? null,
    requestDate: run.requestDate,
    reservedCount: counts.reservedCount,
    senderResourceId: run.senderResourceId,
    senderLabel: SIMULATION_SENDER_LABEL,
    sendingCount: counts.sendingCount,
    templateCode: null,
  };
}

function listSimulationReservationBatches(run, group) {
  return listRunBatchSequences(run).map((sequence) => {
    const providerRequestId = getSimulationProviderRequestId(run, sequence);
    const recipientCount = getBatchRecipientCount(run, sequence);
    const counts = getReservationCounts({ recipientCount, run, sequence });

    return {
      aggregateState: getReservationAggregateState(counts),
      batchStatus: sequence <= Number(run.acceptedBatchCount ?? 0) || run.status === 'completed' ? 'accepted' : 'pending',
      canceledCount: counts.canceledCount,
      completedCount: counts.completedCount,
      errorCode: null,
      errorMessage: null,
      errorState: null,
      failedCount: counts.failedCount,
      id: `dev-sim-reservation-batch-${run.id}-${sequence}`,
      observedRecipientCount: recipientCount,
      pendingCount: counts.pendingCount,
      providerRequestId,
      recipientCount,
      requestDate: group.requestDate,
      reservedCount: counts.reservedCount,
      sendingCount: counts.sendingCount,
      sequence,
      successRate: getSuccessRate(counts),
      totalBatches: run.totalBatches,
    };
  });
}

function createSimulationReservationRecipient({ recipientIndex, run, sequence }) {
  const status = getReservationStatus({ run, sequence, recipientIndex });
  const globalIndex = (sequence - 1) * run.batchSize + recipientIndex;

  return {
    id: `sms:${getSimulationProviderRequestId(run, sequence)}:${recipientIndex}`,
    channel: run.channel ?? 'sms',
    requestId: getSimulationProviderRequestId(run, sequence),
    recipientSeq: recipientIndex,
    senderResourceId: run.senderResourceId,
    senderLabel: SIMULATION_SENDER_LABEL,
    recipientNo: getSimulationRecipientNo(globalIndex),
    contentPreview: run.managementSendName,
    templateCode: null,
    requestDate: run.requestDate,
    createDate: run.createdAt,
    status,
    resultCode: status === 'FAILED' ? '2001' : status === 'COMPLETED' ? '1000' : null,
    resultMessage: getReservationResultMessage(status),
  };
}

function getReservationCounts({ recipientCount, run, sequence }) {
  const counts = emptyReservationCounts(recipientCount);

  for (let index = 1; index <= recipientCount; index += 1) {
    const status = getReservationStatus({ run, sequence, recipientIndex: index });
    if (status === 'CANCEL') counts.canceledCount += 1;
    else if (status === 'COMPLETED') counts.completedCount += 1;
    else if (status === 'FAILED') counts.failedCount += 1;
    else if (status === 'SENDING') counts.sendingCount += 1;
    else counts.reservedCount += 1;
  }

  counts.pendingCount = Math.max(
    counts.recipientCount
      - counts.canceledCount
      - counts.completedCount
      - counts.failedCount
      - counts.reservedCount
      - counts.sendingCount,
    0
  );
  return counts;
}

function getReservationStatus({ recipientIndex, run, sequence }) {
  if (run.status !== 'completed' && sequence > Number(run.acceptedBatchCount ?? 0)) return 'READY';
  if (run.status === 'running' && sequence === Number(run.acceptedBatchCount ?? 0)) return 'SENDING';
  if (recipientIndex % 25 === 0) return 'CANCEL';
  if (recipientIndex % 10 === 0) return 'FAILED';
  if (recipientIndex % 8 === 0) return 'COMPLETED';
  return 'RESERVED';
}

function getReservationResultMessage(status) {
  if (status === 'COMPLETED') return '성공';
  if (status === 'FAILED') return '실패 예시';
  if (status === 'CANCEL') return '취소됨';
  if (status === 'SENDING') return '발송 중';
  return '예약됨';
}
