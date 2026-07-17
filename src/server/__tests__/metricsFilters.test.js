import { describe, expect, it } from 'vitest';

import { normalizeMetricsQuery } from '../metrics/filters.js';

const FIXED_NOW = new Date('2026-07-17T04:30:00.000Z');

describe('metrics filters', () => {
  it('normalizes custom Korean date ranges and multiple channels', () => {
    const filters = normalizeMetricsQuery({
      channel: 'sms,alimtalk',
      from: '2026-07-01',
      to: '2026-07-03',
    }, FIXED_NOW);

    expect(filters.channels).toEqual(['sms', 'alimtalk']);
    expect(filters.period).toMatchObject({
      from: new Date('2026-06-30T15:00:00.000Z'),
      range: 'custom',
      to: new Date('2026-07-03T14:59:59.999Z'),
    });
  });

  it('clamps a current-day range to the generated time', () => {
    const filters = normalizeMetricsQuery({
      from: '2026-07-17',
      to: '2026-07-17',
    }, FIXED_NOW);

    expect(filters.period.to).toEqual(FIXED_NOW);
  });

  it('rejects invalid dates and ranges longer than 30 days', () => {
    expect(() => normalizeMetricsQuery({ from: '2026-02-30' }, FIXED_NOW))
      .toThrow('날짜 형식이 올바르지 않습니다');
    expect(() => normalizeMetricsQuery({ from: '2026-06-01', to: '2026-07-01' }, FIXED_NOW))
      .toThrow('조회 기간은 최대 30일입니다');
  });
});
