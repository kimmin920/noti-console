import { describe, expect, it } from 'vitest';

import { createMessageLogRouteService } from '../messageLogs/routeService.js';
import { createMessageReservationRouteService } from '../messageReservations/routeService.js';
import {
  clearDevSmsBulkSimulationRunsForTest,
  createDevSmsBulkSimulationRun,
} from '../messages/smsBulkSimulation.js';

const ENV = { NODE_ENV: 'development' };
const NOW = new Date('2026-06-11T03:00:00.000Z');

describe('SMS bulk simulation route views', () => {
  it('shows immediate dev bulk simulation runs in message logs with mixed result cases', async () => {
    clearDevSmsBulkSimulationRunsForTest();
    createDevSmsBulkSimulationRun({
      actorUserId: 'user_1',
      env: ENV,
      now: new Date('2026-06-11T02:59:00.000Z'),
      payload: {
        channel: 'sms',
        devSimulation: { batchSize: 1000, delayMs: 0, enabled: true, recipientCount: 2500 },
        managementTitle: '개발 시뮬레이션 2,500명',
        senderResourceId: 'dev_sms_bulk_simulation_sender',
      },
    });
    const service = createMessageLogRouteService({
      env: ENV,
      now: () => NOW,
      service: createEmptyMessageLogService(),
    });

    const list = await service.listLogGroups({
      actorUserId: 'user_1',
      query: {
        channel: 'sms',
        from: '2026-06-11T00:00:00.000Z',
        page: '1',
        pageSize: '20',
        to: '2026-06-12T00:00:00.000Z',
      },
    });
    const detail = await service.getLogGroupDetail({
      actorUserId: 'user_1',
      groupId: list.groups[0].id,
      query: { channel: 'sms' },
    });
    const recipients = await service.listLogGroupRequestRecipients({
      actorUserId: 'user_1',
      groupId: list.groups[0].id,
      requestLocalId: detail.requests[0].id,
      query: { page: '1', pageSize: '5' },
    });
    const failures = await service.listLogGroupRequestFailures({
      actorUserId: 'user_1',
      groupId: list.groups[0].id,
      requestLocalId: detail.requests[0].id,
      query: { page: '1', pageSize: '5' },
    });

    expect(list).toMatchObject({
      total: 1,
      groups: [
        {
          aggregateState: 'partial',
          canceledCount: 25,
          failedCount: 50,
          managementTitle: '개발 시뮬레이션 2,500명',
          providerRequestCount: 3,
          recipientCount: 2500,
          resultState: 'synced',
          sendKind: 'bulk',
          successCount: 2425,
        },
      ],
    });
    expect(detail.requests).toHaveLength(3);
    expect(JSON.stringify(detail.requests)).not.toContain('dev-sim-provider');
    expect(recipients).toMatchObject({
      page: 1,
      pageSize: 5,
      total: 1000,
    });
    expect(recipients.recipients).toHaveLength(5);
    expect(recipients.recipients[0]).toMatchObject({ recipientSeq: 1, resultCode: '1000' });
    expect(recipients.recipients[1]).toMatchObject({ recipientSeq: 2, resultCode: '1000' });
    expect(failures.total).toBeGreaterThan(0);
  });

  it('shows scheduled dev bulk simulation runs in reservations with batch recipients', async () => {
    clearDevSmsBulkSimulationRunsForTest();
    createDevSmsBulkSimulationRun({
      actorUserId: 'user_1',
      env: ENV,
      now: new Date('2026-06-11T02:58:00.000Z'),
      payload: {
        channel: 'sms',
        devSimulation: { batchSize: 1000, delayMs: 0, enabled: true, recipientCount: 2000 },
        managementTitle: '개발 예약 시뮬레이션 2,000명',
        requestDate: '2026-06-12 10:00:00',
        senderResourceId: 'dev_sms_bulk_simulation_sender',
      },
    });
    const service = createMessageReservationRouteService({}, {
      env: ENV,
      now: () => NOW,
      service: createEmptyReservationService(),
    });

    const list = await service.listReservationGroups({
      actorUserId: 'user_1',
      query: {
        channel: 'sms',
        from: '2026-06-11T00:00:00.000Z',
        page: '1',
        pageSize: '20',
        to: '2026-06-13T00:00:00.000Z',
      },
    });
    const detail = await service.getReservationGroupDetailById({
      actorUserId: 'user_1',
      groupId: list.groups[0].id,
      query: { channel: 'sms' },
    });
    const batchRecipients = await service.getReservationBatchRecipients({
      actorUserId: 'user_1',
      groupId: list.groups[0].id,
      providerRequestId: detail.batches[0].providerRequestId,
      query: { page: '1', pageSize: '5' },
    });

    expect(list).toMatchObject({
      total: 1,
      groups: [
        {
          aggregateState: 'failed',
          canceledCount: 80,
          completedCount: 200,
          failedCount: 160,
          groupType: 'bulk_run',
          managementTitle: '개발 예약 시뮬레이션 2,000명',
          providerRequestCount: 2,
          recipientCount: 2000,
          reservedCount: 1560,
        },
      ],
    });
    expect(detail.batches).toHaveLength(2);
    expect(batchRecipients).toMatchObject({
      page: 1,
      pageSize: 5,
      total: 1000,
    });
    expect(batchRecipients.recipients).toHaveLength(5);
    expect(batchRecipients.recipients[0]).toMatchObject({ recipientSeq: 1, status: 'RESERVED' });
    expect(batchRecipients.recipients[1]).toMatchObject({ recipientSeq: 2, status: 'RESERVED' });
  });
});

function createEmptyMessageLogService() {
  return {
    async listLogGroups() {
      return { channel: 'sms', groups: [], hasNextPage: false, page: 1, pageSize: 20, total: 0 };
    },
  };
}

function createEmptyReservationService() {
  return {
    async listReservationGroups() {
      return { channel: 'sms', groups: [], hasNextPage: false, page: 1, pageSize: 20, total: 0 };
    },
  };
}
