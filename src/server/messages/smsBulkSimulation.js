import { randomUUID } from 'node:crypto';

const STORE_KEY = Symbol.for('messaging-app.sms-bulk-simulation-runs');
const MAX_RECIPIENTS = 50_000;
const DEFAULT_BATCH_SIZE = 1000;
const MAX_DELAY_MS = 2000;
const RECENT_TERMINAL_MS = 30 * 60 * 1000;
const STALE_RUN_MS = 2 * 60 * 60 * 1000;

export function isDevSmsBulkSimulationPayload(payload, env = process.env) {
  return env?.NODE_ENV !== 'production' && payload?.devSimulation?.enabled === true;
}

export function createDevSmsBulkSimulationRun({
  actorUserId,
  payload,
  now = new Date(),
  env = process.env,
}) {
  if (!isDevSmsBulkSimulationPayload(payload, env)) {
    return null;
  }

  const store = getStore();
  const config = normalizeSimulationConfig(payload.devSimulation);
  const run = {
    id: `dev_sms_bulk_run_${randomUUID()}`,
    runRef: `dev_run_${randomUUID().replaceAll('-', '').slice(0, 12)}`,
    userId: actorUserId,
    managementSendName: normalizeOptionalString(payload.managementSendName ?? payload.managementTitle)
      ?? `개발 시뮬레이션 ${config.recipientCount.toLocaleString('ko-KR')}명`,
    channel: normalizeChannel(payload.channel),
    requestDate: normalizeOptionalString(payload.requestDate),
    senderResourceId: normalizeOptionalString(payload.senderResourceId) ?? 'dev_sms_bulk_simulation_sender',
    totalRecipients: config.recipientCount,
    batchSize: config.batchSize,
    totalBatches: Math.ceil(config.recipientCount / config.batchSize),
    delayMs: config.delayMs,
    createdAtMs: now.getTime(),
  };

  const runs = store.get(actorUserId) ?? [];
  runs.unshift(run);
  store.set(actorUserId, cleanupRuns(runs, now).slice(0, 20));

  return toDevSmsBulkSimulationRunDto(run, now);
}

export function listDevSmsBulkSimulationRuns({
  actorUserId,
  activeOnly = false,
  now = new Date(),
  env = process.env,
}) {
  if (env?.NODE_ENV === 'production') {
    return { runs: [] };
  }

  const store = getStore();
  const runs = cleanupRuns(store.get(actorUserId) ?? [], now);
  store.set(actorUserId, runs);

  return {
    runs: runs
      .map((run) => toDevSmsBulkSimulationRunDto(run, now))
      .filter((run) => !activeOnly || isActiveOrRecentTerminalRun(run, now)),
  };
}

export function getDevSmsBulkSimulationRun({
  actorUserId,
  runId,
  now = new Date(),
  env = process.env,
}) {
  if (env?.NODE_ENV === 'production') {
    return null;
  }

  const run = (getStore().get(actorUserId) ?? []).find((item) => item.id === runId);
  return run ? toDevSmsBulkSimulationRunDto(run, now) : null;
}

export function clearDevSmsBulkSimulationRunsForTest() {
  getStore().clear();
}

function getStore() {
  if (!globalThis[STORE_KEY]) {
    globalThis[STORE_KEY] = new Map();
  }

  return globalThis[STORE_KEY];
}

function normalizeSimulationConfig(value) {
  const input = value && typeof value === 'object' ? value : {};
  const recipientCount = parseBoundedInteger(input.recipientCount, {
    defaultValue: MAX_RECIPIENTS,
    maxValue: MAX_RECIPIENTS,
    minValue: 1,
  });
  const batchSize = parseBoundedInteger(input.batchSize, {
    defaultValue: DEFAULT_BATCH_SIZE,
    maxValue: DEFAULT_BATCH_SIZE,
    minValue: 1,
  });
  const delayMs = parseBoundedInteger(input.delayMs, {
    defaultValue: 1500,
    maxValue: MAX_DELAY_MS,
    minValue: 0,
  });

  return { batchSize, delayMs, recipientCount };
}

function parseBoundedInteger(value, {
  defaultValue,
  maxValue,
  minValue,
}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  const number = Number.isFinite(parsed) ? parsed : defaultValue;

  return Math.min(Math.max(number, minValue), maxValue);
}

function normalizeChannel(value) {
  return ['sms', 'lms', 'mms'].includes(value) ? value : 'sms';
}

function normalizeOptionalString(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';

  return normalized || null;
}

function cleanupRuns(runs, now) {
  return runs.filter((run) => now.getTime() - run.createdAtMs < STALE_RUN_MS);
}

function toDevSmsBulkSimulationRunDto(run, now) {
  const acceptedBatchCount = getAcceptedBatchCount(run, now);
  const acceptedRecipientCount = Math.min(acceptedBatchCount * run.batchSize, run.totalRecipients);
  const status = acceptedBatchCount >= run.totalBatches
    ? 'completed'
    : acceptedBatchCount > 0
      ? 'running'
      : 'queued';
  const completedAtMs = status === 'completed'
    ? run.createdAtMs + run.delayMs * run.totalBatches
    : null;
  const isReservation = Boolean(run.requestDate);
  const logsHref = `/logs?channel=${encodeURIComponent(run.channel ?? 'sms')}`;
  const reservationsHref = `/reservations?channel=${encodeURIComponent(getReservationTabChannel(run.channel))}`;

  return {
    id: run.id,
    runRef: run.runRef,
    managementSendName: run.managementSendName,
    sendName: run.managementSendName,
    channel: run.channel,
    isReservation,
    requestDate: run.requestDate,
    senderResourceId: run.senderResourceId,
    state: status,
    status,
    simulation: true,
    totalRecipients: run.totalRecipients,
    totalRecipientCount: run.totalRecipients,
    acceptedRecipients: acceptedRecipientCount,
    acceptedRecipientCount,
    rejectedRecipientCount: 0,
    unknownRecipientCount: 0,
    failedRecipientCount: 0,
    batchSize: run.batchSize,
    totalBatches: run.totalBatches,
    totalBatchCount: run.totalBatches,
    completedBatches: acceptedBatchCount,
    completedBatchCount: acceptedBatchCount,
    acceptedBatchCount,
    failedBatches: 0,
    attentionBatches: 0,
    activeBatchSequence: status === 'completed' ? null : acceptedBatchCount + 1,
    attentionReason: null,
    error: null,
    createdAt: new Date(run.createdAtMs).toISOString(),
    startedAt: new Date(run.createdAtMs).toISOString(),
    completedAt: completedAtMs ? new Date(completedAtMs).toISOString() : null,
    finishedAt: completedAtMs ? new Date(completedAtMs).toISOString() : null,
    actions: {
      logsHref,
      ...(isReservation ? { reservationsHref } : {}),
      resultHref: isReservation ? reservationsHref : logsHref,
    },
  };
}

function getReservationTabChannel(channel) {
  return channel === 'alimtalk' || channel === 'brand-message' ? channel : 'sms';
}

function getAcceptedBatchCount(run, now) {
  if (run.delayMs === 0) {
    return run.totalBatches;
  }

  return Math.min(run.totalBatches, Math.floor((now.getTime() - run.createdAtMs) / run.delayMs));
}

function isActiveOrRecentTerminalRun(run, now) {
  if (run.status === 'queued' || run.status === 'running') {
    return true;
  }

  const timestamp = Date.parse(run.completedAt ?? run.finishedAt ?? run.createdAt ?? '');

  return Number.isFinite(timestamp) && now.getTime() - timestamp < RECENT_TERMINAL_MS;
}
