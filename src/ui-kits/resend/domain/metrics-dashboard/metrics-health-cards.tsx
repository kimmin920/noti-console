import {
  metricsStatusColors,
} from './data';
import {
  formatMetricNumber,
  formatMetricRate,
  getDeliverabilityRating,
  getEngagementRating,
  getReputationRating,
} from './metrics-format';
import type { MetricsEvent, MetricsEventCounts } from './types';
import { MetricsInfoDrawer, type MetricsInfoKind } from './metrics-info-drawer';
import { Card } from '../../primitives/card';
import { Text } from '../../primitives/typography';

type HealthCardProps = {
  readonly infoKind: MetricsInfoKind;
  readonly loading: boolean;
  readonly rating: string;
  readonly rows: readonly HealthRow[];
  readonly title: string;
};

type HealthRow = {
  readonly event: MetricsEvent;
  readonly name: string;
  readonly percentage: string;
  readonly total: string;
};

function MetricsHealthGrid({ counts, isEngagementEnabled, loading }: { readonly counts: MetricsEventCounts; readonly isEngagementEnabled: boolean; readonly loading: boolean }) {
  return (
    <div className="resend-ui-metrics-dashboard__health-grid">
      <HealthCard
        infoKind="deliverability"
        loading={loading}
        rating={loading ? '' : getDeliverabilityRating(counts.sent, counts.delivered)}
        rows={[
          summaryRow('sent', '발송 대상', counts.sent, counts.sent > 0 ? '100%' : '0%'),
          summaryRow('delivered', '성공', counts.delivered, formatMetricRate(counts.delivered, counts.sent, true)),
        ]}
        title="발송 성공"
      />
      <HealthCard
        infoKind="reputation"
        loading={loading}
        rating={loading ? '' : getReputationRating(counts.sent, counts.bounced, counts.complained)}
        rows={[
          summaryRow('bounced', '실패', counts.bounced, formatMetricRate(counts.bounced, counts.sent, true)),
          summaryRow('complained', '신고', counts.complained, formatMetricRate(counts.complained, counts.sent, true)),
        ]}
        title="발송 품질"
      />
      <HealthCard
        infoKind="engagement"
        loading={loading}
        rating={loading ? '' : isEngagementEnabled ? getEngagementRating(counts.sent, counts.opened) : '미집계'}
        rows={[
          summaryRow('opened', '열림', counts.opened, formatMetricRate(counts.opened, counts.sent, true)),
          summaryRow('clicked', '클릭', counts.clicked, formatMetricRate(counts.clicked, counts.sent, true)),
          summaryRow('unsubscribed', '수신 거부', counts.unsubscribed, formatMetricRate(counts.unsubscribed, counts.sent, true)),
        ]}
        title="수신자 반응"
      />
    </div>
  );
}

function HealthCard({ infoKind, loading, rating, rows, title }: HealthCardProps) {
  return (
    <Card.Root as="article" className="resend-ui-metrics-dashboard__health-card" radius="3xl">
      <Card.Body className="resend-ui-metrics-dashboard__card-body">
      <MetricsInfoDrawer kind={infoKind} />
      <div>
        <p className="resend-ui-metrics-dashboard__eyebrow">{title}</p>
        {loading ? <Skeleton className="resend-ui-metrics-dashboard__rating-skeleton" /> : (
          <Text as="p" className="resend-ui-metrics-dashboard__rating" color="white" size="7">{rating}</Text>
        )}
      </div>
      <div className="resend-ui-metrics-dashboard__health-rows">
        {rows.map((row, index) => (
          <div className="resend-ui-metrics-dashboard__health-row" key={row.name}>
            <span className="resend-ui-metrics-dashboard__row-label">
              <EventDot event={row.event} />
              {row.name}
            </span>
            <span className="resend-ui-metrics-dashboard__row-value">
              {loading ? <Skeleton className="resend-ui-metrics-dashboard__mini-skeleton" /> : row.total}
              {loading ? <Skeleton className="resend-ui-metrics-dashboard__mini-skeleton" /> : <strong>{row.percentage}</strong>}
            </span>
            {index < rows.length - 1 ? <span className="resend-ui-metrics-dashboard__row-divider" /> : null}
          </div>
        ))}
      </div>
      </Card.Body>
    </Card.Root>
  );
}

function EventDot({ event }: { readonly event: MetricsEvent }) {
  return <span aria-hidden="true" className="resend-ui-metrics-dashboard__dot" style={{ backgroundColor: metricsStatusColors[event] }} />;
}

function Skeleton({ className }: { readonly className: string }) {
  return <span aria-hidden="true" className={`resend-ui-metrics-dashboard__skeleton ${className}`} />;
}

function summaryRow(event: MetricsEvent, name: string, total: number, percentage: string): HealthRow {
  return { event, name, percentage, total: formatMetricNumber(total) };
}

export { MetricsHealthGrid };
