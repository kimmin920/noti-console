import type { MetricsEventCounts } from './types';

function formatMetricNumber(value: number) {
  return value.toLocaleString('ko-KR');
}

function formatMetricRate(numerator: number, denominator: number, clampToHundred = false) {
  const raw = denominator === 0 ? 0 : (numerator / denominator) * 100;
  const clamped = clampToHundred && raw > 100 ? 100 : Math.max(raw, 0);
  return `${Number.parseFloat(clamped.toFixed(2))}%`;
}

function getTotalEmails(counts: MetricsEventCounts) {
  return counts.sent + counts.received;
}

function getBouncedTotal(counts: MetricsEventCounts) {
  return counts.bounced;
}

function getDeliverabilityRating(sent: number, delivered: number) {
  const rate = sent === 0 ? 0 : Math.min((delivered / sent) * 100, 100);
  if (sent === 0) return '데이터 없음';
  if (rate >= 99) return '매우 좋음';
  if (rate >= 97) return '좋음';
  if (rate >= 95) return '보통';
  return '주의';
}

function getReputationRating(sent: number, bounced: number, complained: number) {
  const bounceRate = sent === 0 ? 0 : Math.min((bounced / sent) * 100, 100);
  const complaintRate = sent === 0 ? 0 : Math.min((complained / sent) * 100, 100);
  if (sent === 0) return '데이터 없음';
  if (bounceRate < 1 && complaintRate < 0.01) return '매우 좋음';
  if (bounceRate < 2 && complaintRate < 0.03) return '좋음';
  if (bounceRate < 4 && complaintRate < 0.08) return '보통';
  return '주의';
}

function getEngagementRating(sent: number, opened: number) {
  const openRate = sent === 0 ? 0 : Math.min((opened / sent) * 100, 100);
  if (sent === 0) return '데이터 없음';
  if (openRate > 60) return '매우 좋음';
  if (openRate > 40) return '좋음';
  if (openRate > 25) return '보통';
  return '주의';
}

export {
  formatMetricNumber,
  formatMetricRate,
  getBouncedTotal,
  getDeliverabilityRating,
  getEngagementRating,
  getReputationRating,
  getTotalEmails,
};
