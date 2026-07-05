import { listDevSmsBulkSimulationRuns } from './smsBulkSimulation.js';

export const SIMULATION_LOG_GROUP_PREFIX = 'dev-sim-log-';
export const SIMULATION_LOG_REQUEST_PREFIX = 'dev-sim-log-request-';
export const SIMULATION_RESERVATION_GROUP_PREFIX = 'dev-sim-reservation-';
export const SIMULATION_PROVIDER_REQUEST_PREFIX = 'dev-sim-provider-';
export const SIMULATION_SENDER_LABEL = '개발 시뮬레이션 발신번호';

export function listSimulationRuns({ actorUserId, env = process.env, now = new Date() }) {
  if (!actorUserId) return [];
  return listDevSmsBulkSimulationRuns({ actorUserId, env, now }).runs;
}

export function getSimulationProviderRequestId(run, sequence) {
  return `${SIMULATION_PROVIDER_REQUEST_PREFIX}${run.id}-${sequence}`;
}

export function getSimulationLogRequestId(run, sequence) {
  return `${SIMULATION_LOG_REQUEST_PREFIX}${run.id}-${sequence}`;
}

export function getBatchRecipientCount(run, sequence) {
  const before = (sequence - 1) * run.batchSize;
  return Math.max(Math.min(run.totalRecipients - before, run.batchSize), 0);
}

export function listRunBatchSequences(run) {
  return Array.from({ length: run.totalBatches }, (_, index) => index + 1);
}

export function normalizePositiveInteger(value, fallback, max = 1000) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) return fallback;
  return Math.min(number, max);
}

export function paginateItems(items, { page, pageSize }) {
  const startIndex = (page - 1) * pageSize;
  return {
    hasNextPage: startIndex + pageSize < items.length,
    items: items.slice(startIndex, startIndex + pageSize),
    total: items.length,
  };
}

export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const normalized = String(value).trim();
  if (!normalized) return null;
  const isoCandidate = normalized.includes('T') ? normalized : normalized.replace(' ', 'T');
  const date = new Date(isoCandidate);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoOrNull(value) {
  const date = parseDate(value);
  return date ? date.toISOString() : null;
}

export function isDateInRange(value, { from, to }) {
  const date = parseDate(value);
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function isSmsListChannel(query = {}) {
  const channel = String(query.channel ?? 'sms').trim().toLowerCase();
  const messageType = String(query.messageType ?? 'all').trim().toLowerCase();
  return channel === 'sms' && (messageType === 'all' || messageType === 'sms' || !messageType);
}

export function sortByCreatedAtDesc(left, right) {
  return Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? '');
}

export function getSimulationRecipientNo(index) {
  return `010${String(90000000 + index).slice(-8)}`;
}

export function getSimulationRequestDate(run) {
  return run.requestDate || run.createdAt;
}

export function getSimulationRunById({ actorUserId, env, groupId, now, prefix }) {
  if (!groupId?.startsWith(prefix)) return null;
  const runId = groupId.slice(prefix.length);
  return listSimulationRuns({ actorUserId, env, now }).find((run) => run.id === runId) ?? null;
}

export function sumMessageCounts(values) {
  return values.reduce((counts, value) => ({
    successCount: counts.successCount + value.successCount,
    failedCount: counts.failedCount + value.failedCount,
    pendingCount: counts.pendingCount + value.pendingCount,
    canceledCount: counts.canceledCount + value.canceledCount,
  }), { successCount: 0, failedCount: 0, pendingCount: 0, canceledCount: 0 });
}

export function getMessageResultState(counts, recipientCount) {
  if (recipientCount > 0 && counts.pendingCount === recipientCount) return 'not_synced';
  if (counts.pendingCount > 0) return 'partially_synced';
  return 'synced';
}

export function getMessageAggregateState(counts, recipientCount) {
  if (recipientCount > 0 && counts.successCount === recipientCount) return 'success';
  if (recipientCount > 0 && counts.failedCount + counts.canceledCount === recipientCount) return 'failed';
  return [counts.successCount, counts.failedCount + counts.canceledCount, counts.pendingCount]
    .filter((count) => count > 0).length > 1 ? 'partial' : 'pending';
}

export function emptyReservationCounts(recipientCount) {
  return {
    canceledCount: 0,
    completedCount: 0,
    failedCount: 0,
    pendingCount: 0,
    recipientCount,
    reservedCount: 0,
    sendingCount: 0,
  };
}

export function sumReservationCounts(values) {
  return values.reduce((counts, value) => ({
    canceledCount: counts.canceledCount + value.canceledCount,
    completedCount: counts.completedCount + value.completedCount,
    failedCount: counts.failedCount + value.failedCount,
    pendingCount: counts.pendingCount + value.pendingCount,
    recipientCount: counts.recipientCount + value.recipientCount,
    reservedCount: counts.reservedCount + value.reservedCount,
    sendingCount: counts.sendingCount + value.sendingCount,
  }), emptyReservationCounts(0));
}

export function getReservationAggregateState(counts) {
  if (counts.recipientCount > 0 && counts.reservedCount === counts.recipientCount) return 'reserved';
  if (counts.recipientCount > 0 && counts.completedCount === counts.recipientCount) return 'completed';
  if (counts.recipientCount > 0 && counts.canceledCount === counts.recipientCount) return 'canceled';
  if (counts.failedCount > 0) return 'failed';
  if (counts.sendingCount > 0) return 'sending';
  return 'reserved';
}

export function getSuccessRate(counts) {
  if (counts.recipientCount <= 0) return null;
  return Math.round((counts.completedCount / counts.recipientCount) * 1000) / 10;
}
