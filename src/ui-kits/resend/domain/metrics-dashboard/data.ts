import type {
  MetricsDatePreset,
  MetricsDomain,
  MetricsDomainBreakdown,
  MetricsEvent,
  MetricsEventCounts,
  MetricsRatePoint,
  MetricsTimePoint,
  MetricsVisibleEvent,
} from './types';

const metricsEventOrder = [
  'received',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'complained',
  'unsubscribed',
  'delivery_delayed',
  'failed',
  'suppressed',
] satisfies readonly MetricsVisibleEvent[];

const metricsDatePresets = [
  { daysBack: 0, label: '오늘' },
  { daysBack: 1, isYesterday: true, label: '어제' },
  { daysBack: 2, label: '최근 3일' },
  { daysBack: 6, label: '최근 7일' },
  { daysBack: 14, label: '최근 15일' },
  { daysBack: 29, label: '최근 30일' },
] satisfies readonly MetricsDatePreset[];

const metricsStatusLabels = {
  bounced: '실패',
  clicked: '클릭',
  complained: '신고',
  delivered: '성공',
  delivery_delayed: '결과 대기',
  failed: '처리 실패',
  opened: '열림',
  received: '접수',
  sent: '발송 대상',
  suppressed: '취소',
  unsubscribed: '수신 거부',
} satisfies Record<MetricsEvent, string>;

const metricsStatusColors = {
  bounced: 'var(--rui-red-a11)',
  clicked: 'var(--rui-violet-a11)',
  complained: 'var(--rui-amber-a11)',
  delivered: 'var(--rui-green-a11)',
  delivery_delayed: 'var(--rui-sand-a11)',
  failed: 'var(--rui-red-a9)',
  opened: 'var(--rui-blue-a11)',
  received: 'var(--rui-cyan-a11)',
  sent: 'var(--rui-slate-a11)',
  suppressed: 'var(--rui-slate-a11)',
  unsubscribed: 'var(--rui-orange-a11)',
} satisfies Record<MetricsEvent, string>;

const defaultMetricsDomains = [
  { id: 'domain-acme', name: 'acme.com' },
  { id: 'domain-resend', name: 'updates.acme.com' },
  { id: 'domain-product', name: 'product.acme.com' },
] satisfies readonly MetricsDomain[];

const defaultMetricsOverview = counts({
  bounced: 96,
  clicked: 3948,
  complained: 3,
  delivered: 87290,
  deliveryDelayed: 41,
  failed: 24,
  opened: 49780,
  received: 460,
  sent: 88125,
  suppressed: 18,
  unsubscribed: 91,
});

const defaultMetricsTimeSeries = [
  timePoint('Jun 18', 5290, 5226, 2948, 211, 5, 0, 4),
  timePoint('Jun 19', 6038, 5955, 3290, 284, 8, 0, 5),
  timePoint('Jun 20', 5924, 5851, 3368, 322, 7, 1, 6),
  timePoint('Jun 21', 5596, 5524, 3129, 304, 6, 0, 8),
  timePoint('Jun 22', 6330, 6257, 3528, 355, 8, 0, 7),
  timePoint('Jun 23', 6696, 6622, 3720, 386, 7, 1, 9),
  timePoint('Jun 24', 6942, 6871, 3912, 411, 6, 0, 5),
  timePoint('Jun 25', 7015, 6942, 4028, 452, 7, 0, 7),
  timePoint('Jun 26', 7280, 7203, 4190, 488, 9, 1, 6),
  timePoint('Jun 27', 6314, 6239, 3488, 348, 8, 0, 8),
  timePoint('Jun 28', 5780, 5708, 3229, 302, 6, 0, 6),
  timePoint('Jun 29', 6092, 6015, 3424, 333, 7, 0, 7),
  timePoint('Jun 30', 6564, 6488, 3718, 377, 8, 0, 8),
  timePoint('Jul 1', 6221, 6148, 3465, 356, 8, 0, 7),
  timePoint('Jul 2', 6043, 5983, 3343, 319, 6, 0, 5),
] satisfies readonly MetricsTimePoint[];

const defaultMetricsDomainBreakdown = [
  domainBreakdown('domain-acme', 'acme.com', 48120, 47640, 27012, 2240, 45, 1, 34),
  domainBreakdown('domain-resend', 'updates.acme.com', 26144, 25901, 14678, 1198, 31, 1, 28),
  domainBreakdown('domain-product', 'product.acme.com', 13861, 13749, 8090, 510, 20, 1, 29),
] satisfies readonly MetricsDomainBreakdown[];

const bounceRateSeries = defaultMetricsTimeSeries.map((point) => ratePoint(point, 'bounced'));
const complaintRateSeries = defaultMetricsTimeSeries.map((point) => ratePoint(point, 'complained'));
const openRateSeries = defaultMetricsTimeSeries.map((point) => ratePoint(point, 'opened'));
const clickRateSeries = defaultMetricsTimeSeries.map((point) => ratePoint(point, 'clicked'));

function counts(input: {
  readonly bounced: number;
  readonly clicked: number;
  readonly complained: number;
  readonly delivered: number;
  readonly deliveryDelayed: number;
  readonly failed: number;
  readonly opened: number;
  readonly received: number;
  readonly sent: number;
  readonly suppressed: number;
  readonly unsubscribed: number;
}): MetricsEventCounts {
  return {
    bounced: input.bounced,
    clicked: input.clicked,
    complained: input.complained,
    delivered: input.delivered,
    delivery_delayed: input.deliveryDelayed,
    failed: input.failed,
    opened: input.opened,
    received: input.received,
    sent: input.sent,
    suppressed: input.suppressed,
    unsubscribed: input.unsubscribed,
  };
}

function timePoint(label: string, sent: number, delivered: number, opened: number, clicked: number, bounced: number, complained: number, unsubscribed: number): MetricsTimePoint {
  return {
    counts: counts({
      bounced,
      clicked,
      complained,
      delivered,
      deliveryDelayed: Math.max(1, Math.round(sent * 0.0004)),
      failed: Math.max(1, Math.round(sent * 0.00025)),
      opened,
      received: Math.max(1, Math.round(sent * 0.005)),
      sent,
      suppressed: Math.max(1, Math.round(sent * 0.0002)),
      unsubscribed,
    }),
    label,
  };
}

function domainBreakdown(id: string, name: string, sent: number, delivered: number, opened: number, clicked: number, bounced: number, complained: number, unsubscribed: number): MetricsDomainBreakdown {
  return {
    counts: counts({
      bounced,
      clicked,
      complained,
      delivered,
      deliveryDelayed: Math.max(1, Math.round(sent * 0.0004)),
      failed: Math.max(1, Math.round(sent * 0.0002)),
      opened,
      received: Math.max(1, Math.round(sent * 0.005)),
      sent,
      suppressed: Math.max(1, Math.round(sent * 0.0002)),
      unsubscribed,
    }),
    id,
    name,
  };
}

function ratePoint(point: MetricsTimePoint, event: MetricsVisibleEvent): MetricsRatePoint {
  return {
    count: point.counts[event],
    label: point.label,
    sent: point.counts.sent,
  };
}

export {
  bounceRateSeries,
  clickRateSeries,
  complaintRateSeries,
  defaultMetricsDomainBreakdown,
  defaultMetricsDomains,
  defaultMetricsOverview,
  defaultMetricsTimeSeries,
  metricsDatePresets,
  metricsEventOrder,
  metricsStatusColors,
  metricsStatusLabels,
  openRateSeries,
};
