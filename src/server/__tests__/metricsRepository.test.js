import { describe, expect, it } from 'vitest';

import { createMetricsRepository } from '../metrics/repository.js';

describe('metrics repository', () => {
  it('binds message group date filters through timestamp column encoders', async () => {
    const captured = {};
    const repository = createMetricsRepository(createCapturingDb(captured));

    await repository.listMessageSendGroupsForMetrics({
      channel: null,
      from: new Date('2026-06-10T00:00:00+09:00'),
      sourceType: null,
      to: new Date('2026-06-24T17:00:00+09:00'),
      userId: '27145c7d-3fe2-4e75-847c-be550bb547ca',
    });

    expect(collectBareDateChunks(captured.where)).toEqual([]);
  });
});

function createCapturingDb(captured) {
  const query = {
    from() {
      return this;
    },
    leftJoin() {
      return this;
    },
    where(value) {
      captured.where = value;
      return Promise.resolve([]);
    },
  };

  return {
    select() {
      return query;
    },
  };
}

function collectBareDateChunks(value, dates = []) {
  if (!value || typeof value !== 'object') return dates;
  if (value instanceof Date) {
    dates.push(value);
    return dates;
  }
  if (value.constructor?.name === 'Param') return dates;
  if (!Array.isArray(value.queryChunks)) return dates;

  for (const chunk of value.queryChunks) {
    collectBareDateChunks(chunk, dates);
  }

  return dates;
}
