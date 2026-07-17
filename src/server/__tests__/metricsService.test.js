import { describe, expect, it } from 'vitest';

import { createMetricsService } from '../metrics/service.js';

const FIXED_NOW = new Date('2026-06-24T05:30:00.000Z');

describe('metrics service', () => {
  it('summarizes local message ledger counts without treating pending results as success', async () => {
    const service = createMetricsService({
      now: () => FIXED_NOW,
      repository: createFakeMetricsRepository({
        messageSendGroups: [
          createGroup({
            channel: 'sms',
            createdAt: '2026-06-23T02:00:00.000Z',
            failedCount: 5,
            pendingCount: 10,
            successCount: 85,
            totalRecipientCount: 100,
          }),
          createGroup({
            channel: 'alimtalk',
            createdAt: '2026-06-24T01:00:00.000Z',
            failedCount: 10,
            pendingCount: 0,
            sourceType: 'automation',
            successCount: 30,
            totalRecipientCount: 40,
          }),
        ],
      }),
    });

    const summary = await service.getSummary({
      actorUserId: 'user_1',
      query: { range: '15d' },
    });

    expect(summary.totals).toMatchObject({
      canceledCount: 0,
      failedCount: 15,
      pendingCount: 10,
      recipientCount: 140,
      sendGroupCount: 2,
      successCount: 115,
      successRate: 115 / 140,
    });
    expect(summary.channelBreakdown).toEqual([
      expect.objectContaining({ channel: 'sms', failedCount: 5, pendingCount: 10, recipientCount: 100 }),
      expect.objectContaining({ channel: 'alimtalk', failedCount: 10, pendingCount: 0, recipientCount: 40 }),
    ]);
    expect(summary.sourceBreakdown).toEqual([
      expect.objectContaining({ sourceType: 'manual', recipientCount: 100 }),
      expect.objectContaining({ sourceType: 'automation', recipientCount: 40 }),
    ]);
    expect(summary.timeSeries.find((bucket) => bucket.bucket === '2026-06-23')).toMatchObject({
      failedCount: 5,
      pendingCount: 10,
      recipientCount: 100,
      successCount: 85,
    });
  });

  it('surfaces automation, bulk, quota, and sync alerts from safe local fields', async () => {
    const service = createMetricsService({
      now: () => FIXED_NOW,
      repository: createFakeMetricsRepository({
        automationDeliveries: [
          createDelivery({ reasonCode: 'missing_recipient', status: 'unsent' }),
          createDelivery({ reasonCode: 'missing_recipient', status: 'unsent' }),
          createDelivery({ reasonCode: 'provider_rejected', status: 'failed' }),
          createDelivery({ status: 'sent' }),
        ],
        bulkRuns: [
          { acceptedCount: 10, failedCount: 0, rejectedCount: 0, status: 'blocked', totalRecipients: 10, unknownCount: 0 },
        ],
        messageSendGroups: [
          createGroup({
            failedCount: 0,
            pendingCount: 1,
            resultState: 'stale',
            successCount: 0,
            totalRecipientCount: 1,
          }),
        ],
        quotaBuckets: [
          { channel: 'sms', consumedCount: 400, quotaLimit: 500, reservedCount: 50 },
          { channel: 'sms', consumedCount: 450, quotaLimit: 500, reservedCount: 50 },
        ],
      }),
    });

    const summary = await service.getSummary({
      actorUserId: 'user_1',
      query: { range: '7d', source: 'all' },
    });

    expect(summary.automation).toMatchObject({
      failedCount: 1,
      receivedCount: 4,
      sentCount: 1,
      unsentCount: 2,
    });
    expect(summary.automation.topUnsentReasons).toEqual([
      { count: 2, reasonCode: 'missing_recipient' },
    ]);
    expect(summary.bulk).toMatchObject({
      acceptedCount: 10,
      blockedRuns: 1,
      runningRuns: 0,
      unknownRuns: 0,
    });
    expect(summary.quota.sms).toMatchObject({
      limit: 1000,
      remaining: 50,
      used: 950,
      usedRate: 0.95,
    });
    expect(summary.quota.sms).not.toHaveProperty('reserved');
    expect(summary.alerts.map((alert) => alert.code)).toEqual(
      expect.arrayContaining([
        'result_sync_attention',
        'automation_attention',
        'sms_bulk_attention',
        'sms_quota_low',
      ])
    );
  });

  it('skips sms-only metrics when a non-sms channel is selected', async () => {
    let bulkRunsQueried = false;
    let quotaQueried = false;
    const service = createMetricsService({
      now: () => FIXED_NOW,
      repository: createFakeMetricsRepository({
        messageSendGroups: [
          createGroup({
            channel: 'alimtalk',
            failedCount: 2,
            pendingCount: 0,
            sourceType: 'automation',
            successCount: 18,
            totalRecipientCount: 20,
          }),
        ],
        onListSmsBulkRunsForMetrics(filters) {
          bulkRunsQueried = true;
          throw new Error(`sms bulk query should not receive ${filters.channel}`);
        },
        onListSmsQuotaBucketsForMetrics() {
          quotaQueried = true;
          return [
            { channel: 'sms', consumedCount: 900, quotaLimit: 1000, reservedCount: 50 },
          ];
        },
      }),
    });

    const summary = await service.getSummary({
      actorUserId: 'user_1',
      query: { channel: 'alimtalk', range: '7d' },
    });

    expect(bulkRunsQueried).toBe(false);
    expect(quotaQueried).toBe(false);
    expect(summary.channelBreakdown).toEqual([
      expect.objectContaining({ channel: 'alimtalk', failedCount: 2, recipientCount: 20 }),
    ]);
    expect(summary.bulk).toMatchObject({
      acceptedCount: 0,
      blockedRuns: 0,
      totalRecipients: 0,
    });
    expect(summary.quota.sms).toBeNull();
  });

  it('skips sms-only bulk and quota metrics for brand message filters', async () => {
    let bulkRunsQueried = false;
    let quotaQueried = false;
    const service = createMetricsService({
      now: () => FIXED_NOW,
      repository: createFakeMetricsRepository({
        messageSendGroups: [
          createGroup({
            channel: 'brand-message',
            failedCount: 1,
            pendingCount: 2,
            sourceType: 'manual',
            successCount: 7,
            totalRecipientCount: 10,
          }),
        ],
        onListSmsBulkRunsForMetrics(filters) {
          bulkRunsQueried = true;
          throw new Error(`sms bulk query should not receive ${filters.channel}`);
        },
        onListSmsQuotaBucketsForMetrics() {
          quotaQueried = true;
          return [
            { channel: 'sms', consumedCount: 900, quotaLimit: 1000, reservedCount: 50 },
          ];
        },
      }),
    });

    const summary = await service.getSummary({
      actorUserId: 'user_1',
      query: { channel: 'brand-message', range: '7d' },
    });

    expect(bulkRunsQueried).toBe(false);
    expect(quotaQueried).toBe(false);
    expect(summary.channelBreakdown).toEqual([
      expect.objectContaining({
        channel: 'brand-message',
        failedCount: 1,
        pendingCount: 2,
        recipientCount: 10,
        successCount: 7,
      }),
    ]);
    expect(summary.quota.sms).toBeNull();
  });
});

function createFakeMetricsRepository({
  automationDeliveries = [],
  bulkRuns = [],
  messageSendGroups = [],
  onListSmsBulkRunsForMetrics,
  onListSmsQuotaBucketsForMetrics,
  quotaBuckets = [],
} = {}) {
  return {
    async getUserById(userId) {
      return { id: userId, status: 'active' };
    },
    async listAutomationDeliveriesForMetrics() {
      return automationDeliveries;
    },
    async listMessageSendGroupsForMetrics() {
      return messageSendGroups;
    },
    async listSmsBulkRunsForMetrics(filters) {
      if (onListSmsBulkRunsForMetrics) return onListSmsBulkRunsForMetrics(filters);
      return bulkRuns;
    },
    async listSmsQuotaBucketsForMetrics(filters) {
      if (onListSmsQuotaBucketsForMetrics) return onListSmsQuotaBucketsForMetrics(filters);
      return quotaBuckets;
    },
  };
}

function createGroup(values = {}) {
  return {
    canceledCount: 0,
    channel: 'sms',
    createdAt: new Date(values.createdAt ?? '2026-06-24T00:00:00.000Z'),
    failedCount: 0,
    id: values.id ?? crypto.randomUUID(),
    pendingCount: 0,
    providerState: 'accepted',
    resultState: 'synced',
    scheduledAt: null,
    sendKind: 'basic',
    sendTiming: 'immediate',
    senderResourceId: 'sender_1',
    senderResourceLabel: '대표 발신번호',
    sourceType: 'manual',
    successCount: 0,
    totalRecipientCount: 0,
    ...values,
    createdAt: new Date(values.createdAt ?? '2026-06-24T00:00:00.000Z'),
    scheduledAt: values.scheduledAt ? new Date(values.scheduledAt) : null,
  };
}

function createDelivery(values = {}) {
  return {
    createdAt: new Date('2026-06-24T01:00:00.000Z'),
    reasonCode: null,
    sendChannel: 'sms',
    status: 'sent',
    ...values,
  };
}
