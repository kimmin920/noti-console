import { relayGet, withQuery } from '../messageSend/api.js';

const METRICS_SUMMARY_PATH = '/api/metrics/summary';

export function getMetricsSummary(filters) {
  return relayGet(withQuery(METRICS_SUMMARY_PATH, filters));
}
