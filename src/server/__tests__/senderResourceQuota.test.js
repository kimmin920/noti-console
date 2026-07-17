import { describe, expect, it } from 'vitest';

import {
  buildSenderResourceQuotaDescriptor,
  countQuotaSnapshotStates,
  createInitialFallbackQuotaSnapshot,
  getKstDailyQuotaPeriod,
  getKstMonthlyQuotaPeriod,
  getQuotaAvailableCount,
  getQuotaSettlementTargets,
} from '../messages/quota.js';

describe('sender resource quota rules', () => {
  it('shares one monthly SMS bucket across SMS, LMS, and MMS', () => {
    const effectiveAt = new Date('2026-07-31T15:00:00.000Z');
    const descriptors = ['sms', 'lms', 'mms'].map((channel) =>
      buildSenderResourceQuotaDescriptor({
        channel,
        effectiveAt,
        senderResourceId: 'sms_resource_1',
      })
    );

    expect(descriptors.map((descriptor) => descriptor.quotaChannel)).toEqual(['sms', 'sms', 'sms']);
    expect(descriptors[0]).toMatchObject({
      periodStartAt: new Date('2026-07-31T15:00:00.000Z'),
      periodEndAt: new Date('2026-08-31T15:00:00.000Z'),
    });
    expect(descriptors[1]).toEqual(descriptors[0]);
    expect(descriptors[2]).toEqual(descriptors[0]);
  });

  it('keeps AlimTalk and Brand Message in separate daily buckets', () => {
    const effectiveAt = new Date('2026-07-17T14:59:59.999Z');
    const alimtalk = buildSenderResourceQuotaDescriptor({
      channel: 'alimtalk',
      effectiveAt,
      senderResourceId: 'kakao_resource_1',
    });
    const brand = buildSenderResourceQuotaDescriptor({
      channel: 'brand-message',
      effectiveAt,
      senderResourceId: 'kakao_resource_1',
    });

    expect(alimtalk.quotaChannel).toBe('alimtalk');
    expect(brand.quotaChannel).toBe('brand-message');
    expect(alimtalk.periodStartAt).toEqual(new Date('2026-07-16T15:00:00.000Z'));
    expect(alimtalk.periodEndAt).toEqual(new Date('2026-07-17T15:00:00.000Z'));
    expect(brand.periodStartAt).toEqual(alimtalk.periodStartAt);
  });

  it('uses half-open KST month and day boundaries', () => {
    expect(getKstMonthlyQuotaPeriod(new Date('2026-01-15T00:00:00.000Z'))).toEqual({
      periodStartAt: new Date('2025-12-31T15:00:00.000Z'),
      periodEndAt: new Date('2026-01-31T15:00:00.000Z'),
    });
    expect(getKstDailyQuotaPeriod(new Date('2026-01-15T14:59:59.999Z'))).toEqual({
      periodStartAt: new Date('2026-01-14T15:00:00.000Z'),
      periodEndAt: new Date('2026-01-15T15:00:00.000Z'),
    });
  });

  it('derives available and success-only settlement counts', () => {
    expect(getQuotaAvailableCount({ quotaLimit: 1000, reservedCount: 100, consumedCount: 850 })).toBe(50);
    expect(getQuotaAvailableCount({ quotaLimit: 1000, reservedCount: 100, consumedCount: 950 })).toBe(0);
    expect(getQuotaSettlementTargets({
      successCount: 7,
      failedCount: 2,
      canceledCount: 1,
      pendingCount: 3,
    })).toEqual({
      targetConsumedCount: 7,
      targetReleasedCount: 3,
    });
  });

  it('creates and counts a P/S/F/C fallback snapshot without recipient data', () => {
    const snapshot = createInitialFallbackQuotaSnapshot(4);
    snapshot.states = ['P', 'S', 'F', 'C'];
    snapshot.resultCodes = [null, 'RSC04', 'RSC05', 'PRIMARY_SUCCESS'];

    expect(countQuotaSnapshotStates(snapshot, 4)).toEqual({
      canceledCount: 1,
      failedCount: 1,
      pendingCount: 1,
      successCount: 1,
    });
    expect(JSON.stringify(snapshot)).not.toContain('recipient');
  });
});
