import { beforeEach, describe, expect, it, vi } from 'vitest';

const useQueryMock = vi.hoisted(() => vi.fn((options) => options));

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
}));

import { useActiveSmsBulkSendRunsQuery } from '../../features/console/messageSend/queries.js';

describe('SMS bulk send run polling', () => {
  beforeEach(() => {
    useQueryMock.mockClear();
  });

  it('polls active bulk runs only while queued or running runs are visible', () => {
    const queryOptions = useActiveSmsBulkSendRunsQuery();

    expect(queryOptions).toMatchObject({
      enabled: true,
      staleTime: 0,
    });
    expect(typeof queryOptions.refetchInterval).toBe('function');
    expect(queryOptions.refetchInterval({
      state: {
        data: {
          runs: [{ status: 'queued' }],
        },
      },
    })).toBe(1000);
    expect(queryOptions.refetchInterval({
      state: {
        data: {
          runs: [{ status: 'completed', finishedAt: '2026-06-05T12:00:00.000Z' }],
        },
      },
    })).toBe(false);
    expect(queryOptions.refetchInterval({
      state: {
        data: {
          runs: [],
        },
      },
    })).toBe(false);
  });
});
