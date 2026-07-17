import { describe, expect, it } from 'vitest';

import {
  formatLimitCount,
  getLimitRequestChannelLabel,
} from '../../features/console/settings/limitIncreaseRequestLabels.js';

describe('limit increase request labels', () => {
  it('formats known limits and leaves an unset current limit empty', () => {
    expect(formatLimitCount(1000)).toBe('1,000건');
    expect(formatLimitCount(5000, { cadence: '월' })).toBe('월 5,000건');
    expect(formatLimitCount(null)).toBe('-');
  });

  it('labels every Kakao request shape as a channel-wide request', () => {
    expect(getLimitRequestChannelLabel('kakao')).toBe('카카오 채널');
    expect(getLimitRequestChannelLabel('alimtalk')).toBe('카카오 채널');
    expect(getLimitRequestChannelLabel('brand-message')).toBe('카카오 채널');
  });
});
