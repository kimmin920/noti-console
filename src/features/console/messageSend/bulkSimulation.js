export const DEV_SMS_BULK_SIMULATION_PARAM = 'devSmsBulkSimulation';
export const DEV_SMS_BULK_SIMULATION_DELAY_PARAM = 'devSmsBulkSimulationDelayMs';
export const DEV_SMS_BULK_SIMULATION_BATCH_SIZE = 1000;
export const DEV_SMS_BULK_SIMULATION_DEFAULT_RECIPIENTS = 50000;
export const DEV_SMS_BULK_SIMULATION_MAX_RECIPIENTS = 50000;
export const DEV_SMS_BULK_SIMULATION_DEFAULT_DELAY_MS = 1500;
export const DEV_SMS_BULK_SIMULATION_MAX_DELAY_MS = 2000;
export const DEV_SMS_BULK_SIMULATION_SENDER_ID = 'dev_sms_bulk_simulation_sender';
export const DEV_SMS_BULK_SIMULATION_RECIPIENT = '01000000000';

const DEFAULT_ENV = Object.freeze({
  NODE_ENV: process.env.NODE_ENV,
});

export const DEV_SMS_BULK_SIMULATION_SENDER_OPTION = Object.freeze({
  isDefault: true,
  label: '개발 시뮬레이션 발신번호',
  phoneNumber: '010-0000-0000',
  senderResourceId: DEV_SMS_BULK_SIMULATION_SENDER_ID,
  value: DEV_SMS_BULK_SIMULATION_SENDER_ID,
});

export function getDevSmsBulkSimulationConfig(searchParams, env = DEFAULT_ENV) {
  if (env?.NODE_ENV === 'production' || !searchParams?.has?.(DEV_SMS_BULK_SIMULATION_PARAM)) {
    return null;
  }

  const recipientCount = parseBoundedPositiveInteger(
    searchParams.get(DEV_SMS_BULK_SIMULATION_PARAM),
    {
      defaultValue: DEV_SMS_BULK_SIMULATION_DEFAULT_RECIPIENTS,
      maxValue: DEV_SMS_BULK_SIMULATION_MAX_RECIPIENTS,
    }
  );
  const delayMs = parseBoundedPositiveInteger(
    searchParams.get(DEV_SMS_BULK_SIMULATION_DELAY_PARAM),
    {
      defaultValue: DEV_SMS_BULK_SIMULATION_DEFAULT_DELAY_MS,
      maxValue: DEV_SMS_BULK_SIMULATION_MAX_DELAY_MS,
      minValue: 0,
    }
  );
  const totalBatches = Math.ceil(recipientCount / DEV_SMS_BULK_SIMULATION_BATCH_SIZE);

  return {
    batchSize: DEV_SMS_BULK_SIMULATION_BATCH_SIZE,
    delayMs,
    recipientCount,
    runKey: `${recipientCount}:${DEV_SMS_BULK_SIMULATION_BATCH_SIZE}:${delayMs}`,
    totalBatches,
  };
}

export function getSmsBulkSimulationPayloadMessage(message) {
  return {
    ...message,
    recipient: [{ type: 'manual', value: DEV_SMS_BULK_SIMULATION_RECIPIENT }],
    senderNumber: message.senderNumber || DEV_SMS_BULK_SIMULATION_SENDER_ID,
  };
}

export function toSmsBulkSimulationRunPayload(payload, config) {
  const { clientRequestId, ...bulkPayload } = payload;
  const recipientCount = config?.recipientCount ?? DEV_SMS_BULK_SIMULATION_DEFAULT_RECIPIENTS;

  return {
    ...bulkPayload,
    managementTitle: bulkPayload.managementTitle
      ?? `개발 시뮬레이션 ${recipientCount.toLocaleString('ko-KR')}명`,
    devSimulation: {
      batchSize: config?.batchSize ?? DEV_SMS_BULK_SIMULATION_BATCH_SIZE,
      delayMs: config?.delayMs ?? DEV_SMS_BULK_SIMULATION_DEFAULT_DELAY_MS,
      enabled: true,
      recipientCount,
      runKey: config?.runKey,
    },
  };
}

export function getSmsBulkSimulationBatches({ batchSize, recipientCount }) {
  const batches = [];

  for (let startIndex = 0; startIndex < recipientCount; startIndex += batchSize) {
    const endIndex = Math.min(startIndex + batchSize, recipientCount);

    batches.push({
      endRecipient: endIndex,
      recipientCount: endIndex - startIndex,
      sequence: batches.length + 1,
      startRecipient: startIndex + 1,
    });
  }

  return batches;
}

export async function mockSendSmsBulkSimulationBatch({
  batch,
  delayMs,
  now = () => Date.now(),
  payload,
  sleep = wait,
}) {
  const requestedAt = now();

  await sleep(delayMs);

  return {
    ...batch,
    channel: payload.channel,
    requestId: getMockBatchRequestId(payload.clientRequestId, batch.sequence),
    responseMs: Math.max(now() - requestedAt, 0),
    state: 'accepted',
  };
}

function parseBoundedPositiveInteger(value, {
  defaultValue,
  maxValue,
  minValue = 1,
}) {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (!normalized || normalized === 'true') {
    return defaultValue;
  }

  const parsed = Number.parseInt(normalized, 10);

  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(Math.max(parsed, minValue), maxValue);
}

function getMockBatchRequestId(clientRequestId, sequence) {
  return `sim-${String(clientRequestId ?? 'request').slice(0, 8)}-${String(sequence).padStart(3, '0')}`;
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, milliseconds);
  });
}
