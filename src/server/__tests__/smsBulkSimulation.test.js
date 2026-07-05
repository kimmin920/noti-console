import { describe, expect, it } from 'vitest';

import {
  DEV_SMS_BULK_SIMULATION_SENDER_ID,
  getDevSmsBulkSimulationConfig,
  getSmsBulkSimulationBatches,
  getSmsBulkSimulationPayloadMessage,
  mockSendSmsBulkSimulationBatch,
  toSmsBulkSimulationRunPayload,
} from '../../features/console/messageSend/bulkSimulation.js';
import {
  clearDevSmsBulkSimulationRunsForTest,
  createDevSmsBulkSimulationRun,
  getDevSmsBulkSimulationRun,
  listDevSmsBulkSimulationRuns,
} from '../messages/smsBulkSimulation.js';

describe('SMS bulk simulation helpers', () => {
  it('enables the default 50,000 recipient simulation outside production', () => {
    const config = getDevSmsBulkSimulationConfig(
      new URLSearchParams('devSmsBulkSimulation'),
      { NODE_ENV: 'development' }
    );

    expect(config).toMatchObject({
      batchSize: 1000,
      delayMs: 1500,
      recipientCount: 50000,
      totalBatches: 50,
    });
  });

  it('caps requested recipient counts at 50,000 and disables production simulation', () => {
    expect(getDevSmsBulkSimulationConfig(
      new URLSearchParams('devSmsBulkSimulation=100000'),
      { NODE_ENV: 'development' }
    )).toMatchObject({
      recipientCount: 50000,
      totalBatches: 50,
    });

    expect(getDevSmsBulkSimulationConfig(
      new URLSearchParams('devSmsBulkSimulation=50000'),
      { NODE_ENV: 'production' }
    )).toBeNull();
  });

  it('allows visual QA overrides but caps batch delay at 2 seconds', () => {
    expect(getDevSmsBulkSimulationConfig(
      new URLSearchParams('devSmsBulkSimulation=50000&devSmsBulkSimulationDelayMs=20'),
      { NODE_ENV: 'development' }
    )).toMatchObject({
      delayMs: 20,
    });

    expect(getDevSmsBulkSimulationConfig(
      new URLSearchParams('devSmsBulkSimulation=50000&devSmsBulkSimulationDelayMs=5000'),
      { NODE_ENV: 'development' }
    )).toMatchObject({
      delayMs: 2000,
    });
  });

  it('splits recipients into sequential 1,000-recipient batches', () => {
    const batches = getSmsBulkSimulationBatches({
      batchSize: 1000,
      recipientCount: 2501,
    });

    expect(batches).toEqual([
      { endRecipient: 1000, recipientCount: 1000, sequence: 1, startRecipient: 1 },
      { endRecipient: 2000, recipientCount: 1000, sequence: 2, startRecipient: 1001 },
      { endRecipient: 2501, recipientCount: 501, sequence: 3, startRecipient: 2001 },
    ]);
  });

  it('uses virtual sender and recipient values for the dev-only payload path', () => {
    const message = getSmsBulkSimulationPayloadMessage({
      body: '테스트',
      recipient: [],
      senderNumber: '',
    });

    expect(message.senderNumber).toBe(DEV_SMS_BULK_SIMULATION_SENDER_ID);
    expect(message.recipient).toEqual([{ type: 'manual', value: '01000000000' }]);
  });

  it('builds a bulk-run simulation payload instead of a client-only loop payload', () => {
    const payload = toSmsBulkSimulationRunPayload(
      {
        body: '테스트',
        channel: 'sms',
        clientRequestId: '12345678-abcd-4000-9000-123456789abc',
        recipients: [{ recipientNo: '01000000000' }],
        senderResourceId: DEV_SMS_BULK_SIMULATION_SENDER_ID,
      },
      {
        batchSize: 1000,
        delayMs: 1500,
        recipientCount: 50000,
        runKey: '50000:1000:1500',
      }
    );

    expect(payload.clientRequestId).toBeUndefined();
    expect(payload).toMatchObject({
      devSimulation: {
        batchSize: 1000,
        delayMs: 1500,
        enabled: true,
        recipientCount: 50000,
        runKey: '50000:1000:1500',
      },
      managementTitle: '개발 시뮬레이션 50,000명',
    });
  });

  it('resolves each simulated SMS batch as a mock provider response', async () => {
    const nowValues = [1000, 1137];
    const result = await mockSendSmsBulkSimulationBatch({
      batch: {
        endRecipient: 2000,
        recipientCount: 1000,
        sequence: 2,
        startRecipient: 1001,
      },
      delayMs: 120,
      now: () => nowValues.shift(),
      payload: {
        channel: 'sms',
        clientRequestId: '12345678-abcd-4000-9000-123456789abc',
      },
      sleep: () => Promise.resolve(),
    });

    expect(result).toEqual({
      channel: 'sms',
      endRecipient: 2000,
      recipientCount: 1000,
      requestId: 'sim-12345678-002',
      responseMs: 137,
      sequence: 2,
      startRecipient: 1001,
      state: 'accepted',
    });
  });

  it('stores a dev-only simulation run with bulk-run status semantics', () => {
    clearDevSmsBulkSimulationRunsForTest();

    const created = createDevSmsBulkSimulationRun({
      actorUserId: 'user_1',
      env: { NODE_ENV: 'development' },
      now: new Date('2026-06-05T00:00:00.000Z'),
      payload: {
        channel: 'sms',
        devSimulation: {
          batchSize: 1000,
          delayMs: 1500,
          enabled: true,
          recipientCount: 50000,
        },
        managementTitle: '개발 대량 테스트',
        senderResourceId: DEV_SMS_BULK_SIMULATION_SENDER_ID,
      },
    });

    expect(created).toMatchObject({
      acceptedRecipientCount: 0,
      managementSendName: '개발 대량 테스트',
      simulation: true,
      state: 'queued',
      totalBatchCount: 50,
      totalRecipientCount: 50000,
    });

    const running = getDevSmsBulkSimulationRun({
      actorUserId: 'user_1',
      env: { NODE_ENV: 'development' },
      now: new Date('2026-06-05T00:00:04.500Z'),
      runId: created.id,
    });

    expect(running).toMatchObject({
      acceptedBatchCount: 3,
      acceptedRecipientCount: 3000,
      activeBatchSequence: 4,
      state: 'running',
    });
    expect(JSON.stringify(running)).not.toContain('01000000000');

    const completed = listDevSmsBulkSimulationRuns({
      activeOnly: true,
      actorUserId: 'user_1',
      env: { NODE_ENV: 'development' },
      now: new Date('2026-06-05T00:01:15.000Z'),
    });

    expect(completed.runs[0]).toMatchObject({
      acceptedRecipientCount: 50000,
      state: 'completed',
    });
  });

  it('does not create dev simulation runs in production', () => {
    clearDevSmsBulkSimulationRunsForTest();

    expect(createDevSmsBulkSimulationRun({
      actorUserId: 'user_1',
      env: { NODE_ENV: 'production' },
      payload: {
        devSimulation: { enabled: true },
      },
    })).toBeNull();
  });
});
