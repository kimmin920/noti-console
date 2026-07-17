import { describe, expect, it } from 'vitest';
import { formatSmsPreviewTime } from '../../components/ui/SmsPreview.jsx';

describe('SMS preview time', () => {
  const enteredAt = new Date(2026, 6, 17, 14, 7);

  it('uses the entry time when no reservation is set', () => {
    expect(formatSmsPreviewTime('', enteredAt)).toBe('오늘 오후 2:07');
  });

  it('uses the reserved time when a reservation is set', () => {
    const scheduledAt = new Date(2026, 6, 18, 9, 30).toISOString();

    expect(formatSmsPreviewTime(scheduledAt, enteredAt)).toBe('내일 오전 9:30');
  });
});
