import {
  SIMULATION_LOG_GROUP_PREFIX,
  SIMULATION_SENDER_LABEL,
  getSimulationRecipientNo,
  getSimulationRequestDate,
  getSimulationRunById,
  normalizePositiveInteger,
  paginateItems,
  toIsoOrNull,
} from './smsBulkSimulationViewShared.js';
import {
  findSimulationLogRequest,
  publicLogRequest,
} from './smsBulkSimulationLogViews.js';

export function listDevSmsBulkSimulationLogRecipients({
  actorUserId,
  env = process.env,
  groupId,
  now = new Date(),
  query = {},
  requestLocalId,
} = {}) {
  const run = getSimulationRunById({ actorUserId, env, groupId, now, prefix: SIMULATION_LOG_GROUP_PREFIX });
  const request = run ? findSimulationLogRequest(run, requestLocalId, now) : null;
  if (!run || !request) return null;

  const page = normalizePositiveInteger(query.page, 1);
  const pageSize = normalizePositiveInteger(query.pageSize, 100);
  const pageRows = createSimulationLogRecipients({ page, pageSize, request, run });

  return {
    page,
    pageSize,
    hasNextPage: page * pageSize < request.recipientCount,
    request: publicLogRequest(request),
    recipients: pageRows,
    total: request.recipientCount,
  };
}

export function listDevSmsBulkSimulationLogFailures({
  actorUserId,
  env = process.env,
  groupId,
  now = new Date(),
  query = {},
  requestLocalId,
} = {}) {
  const run = getSimulationRunById({ actorUserId, env, groupId, now, prefix: SIMULATION_LOG_GROUP_PREFIX });
  const request = run ? findSimulationLogRequest(run, requestLocalId, now) : null;
  if (!run || !request) return null;

  const failures = Array.from({ length: request.failedCount }, (_, index) => ({
    groupId,
    requestLocalId,
    recipientSeq: request.successCount + index + 1,
    recipientNo: getSimulationRecipientNo(request.successCount + index + 1),
    resultCode: '2001',
    resultCodeLabel: '실패 · 실패 예시',
  }));
  const page = normalizePositiveInteger(query.page, 1);
  const pageSize = normalizePositiveInteger(query.pageSize, 100);
  const pageResult = paginateItems(failures, { page, pageSize });

  return {
    page,
    pageSize,
    hasNextPage: pageResult.hasNextPage,
    request: publicLogRequest(request),
    failures: pageResult.items,
    total: pageResult.total,
  };
}

export function getDevSmsBulkSimulationLogRecipientDetail({
  actorUserId,
  env = process.env,
  groupId,
  now = new Date(),
  recipientSeq,
  requestLocalId,
} = {}) {
  const run = getSimulationRunById({ actorUserId, env, groupId, now, prefix: SIMULATION_LOG_GROUP_PREFIX });
  const request = run ? findSimulationLogRequest(run, requestLocalId, now) : null;
  const seq = Number(recipientSeq);
  if (!run || !request || !Number.isSafeInteger(seq) || seq < 1 || seq > request.recipientCount) return null;

  const row = createSimulationLogRecipient({ request, run, sequence: seq });
  return {
    ...row,
    detail: {
      content: row.contentPreview,
      recipientNo: row.recipientNo,
    },
  };
}

function createSimulationLogRecipients({ page, pageSize, request, run }) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(start + pageSize - 1, request.recipientCount);
  return Array.from({ length: Math.max(end - start + 1, 0) }, (_, index) =>
    createSimulationLogRecipient({ request, run, sequence: start + index })
  );
}

function createSimulationLogRecipient({ request, run, sequence }) {
  const state = getRecipientState(request, sequence);
  const result = getLogResult(state);
  return {
    id: `sms:${request.providerRequestId}:${sequence}`,
    channel: run.channel ?? 'sms',
    requestId: request.providerRequestId,
    recipientSeq: sequence,
    senderLabel: SIMULATION_SENDER_LABEL,
    recipientNo: getSimulationRecipientNo(sequence),
    contentPreview: run.managementSendName,
    templateCode: null,
    requestDate: toIsoOrNull(getSimulationRequestDate(run)),
    receiveDate: state === 'pending' ? null : request.resultSyncedAt,
    status: result.status,
    resultCode: result.resultCode,
    resultMessage: result.resultMessage,
  };
}

function getRecipientState(request, sequence) {
  if (sequence <= request.successCount) return 'success';
  if (sequence <= request.successCount + request.failedCount) return 'failed';
  if (sequence <= request.successCount + request.failedCount + request.canceledCount) return 'canceled';
  return 'pending';
}

function getLogResult(state) {
  if (state === 'success') return { status: '3', resultCode: '1000', resultMessage: '성공' };
  if (state === 'failed') return { status: '5', resultCode: '2001', resultMessage: '실패 예시' };
  if (state === 'canceled') return { status: 'CANCELED', resultCode: 'CANCEL', resultMessage: '취소됨' };
  return { status: '2', resultCode: null, resultMessage: '대기 중' };
}
