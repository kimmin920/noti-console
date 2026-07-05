'use client';

import { useQuery } from '@tanstack/react-query';
import { getMetricsSummary } from './api.js';
import { metricsQueryKeys } from './queryKeys.js';

export function useMetricsSummaryQuery(filters, options = {}) {
  return useQuery({
    enabled: options.enabled !== false,
    queryFn: () => getMetricsSummary(filters),
    queryKey: metricsQueryKeys.summary(filters),
    staleTime: 30_000,
  });
}
