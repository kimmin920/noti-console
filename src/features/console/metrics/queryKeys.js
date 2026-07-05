export const metricsQueryKeys = {
  summary: (filters) => [...metricsQueryKeys.summaryRoot, filters],
  summaryRoot: ['metrics', 'summary'],
};
