import { DataTable } from '../../data-display/data-table';
import { Card } from '../../primitives/card';
import { Text } from '../../primitives/typography';
import { Tooltip as RadixTooltip } from 'radix-ui';
import {
  metricsEventOrder,
  metricsStatusColors,
  metricsStatusLabels,
} from './data';
import { formatMetricNumber, formatMetricRate } from './metrics-format';
import { MetricsAreaChart, MetricsBarChart } from './metrics-charts';
import { MetricsEventFilter } from './metrics-controls';
import { MetricsInfoDrawer } from './metrics-info-drawer';
import type { MetricsDashboardProps, MetricsDomainBreakdown, MetricsEvent, MetricsEventCounts, MetricsRatePoint, MetricsTimePoint, MetricsVisibleEvent } from './types';

type RateCardProps = {
  readonly colorEvent: MetricsVisibleEvent;
  readonly dangerLine?: number | undefined;
  readonly loading: boolean;
  readonly maxDomain: number;
  readonly points: readonly MetricsRatePoint[];
  readonly onPointSelect?: MetricsDashboardProps['onRatePointSelect'];
  readonly title: string;
  readonly total: number;
  readonly value: string;
};

function MetricsOverviewCard({ counts, domainBreakdown, events, loading, onEventsChange, onTimePointSelect, timeSeries }: {
  readonly counts: MetricsEventCounts;
  readonly domainBreakdown: readonly MetricsDomainBreakdown[];
  readonly events: readonly MetricsVisibleEvent[];
  readonly loading: boolean;
  readonly onEventsChange: (events: readonly MetricsVisibleEvent[]) => void;
  readonly onTimePointSelect?: MetricsDashboardProps['onTimePointSelect'];
  readonly timeSeries: readonly MetricsTimePoint[];
}) {
  return (
    <article className="resend-ui-metrics-dashboard__overview-card">
      <header className="resend-ui-metrics-dashboard__overview-header">
        <div className="resend-ui-metrics-dashboard__overview-stats">
          <MetricStat label="메시지" loading={loading} value={formatMetricNumber(counts.sent + counts.received)} />
          <MetricStat label="발송 성공률" loading={loading} value={formatMetricRate(counts.delivered, counts.sent, true)} />
        </div>
        <MetricsEventFilter onChange={onEventsChange} value={events} />
      </header>
      <div className="resend-ui-metrics-dashboard__chart-wrap">
        <MetricsAreaChart events={events} loading={loading} onPointSelect={onTimePointSelect} points={timeSeries} />
      </div>
      <DomainBreakdownTable domainBreakdown={domainBreakdown} events={events} loading={loading} />
    </article>
  );
}

function MetricStat({ label, loading, value }: { readonly label: string; readonly loading: boolean; readonly value: string }) {
  return (
    <div className="resend-ui-metrics-dashboard__metric-stat">
      <p className="resend-ui-metrics-dashboard__eyebrow">{label}</p>
      {loading ? <Skeleton className="resend-ui-metrics-dashboard__stat-skeleton" /> : (
        <MetricValue value={value} />
      )}
    </div>
  );
}

function MetricsRateCards({ counts, loading, onRatePointSelect, timeSeries }: { readonly counts: MetricsEventCounts; readonly loading: boolean; readonly onRatePointSelect?: MetricsDashboardProps['onRatePointSelect']; readonly timeSeries: readonly MetricsTimePoint[] }) {
  return (
    <div className="resend-ui-metrics-dashboard__rate-grid">
      <RateCard
        colorEvent="bounced"
        dangerLine={4}
        loading={loading}
        maxDomain={10}
        points={toRateSeries(timeSeries, 'bounced')}
        onPointSelect={onRatePointSelect}
        title="실패율"
        value={formatMetricRate(counts.bounced, counts.sent)}
        total={counts.bounced}
      />
      <RateCard
        colorEvent="complained"
        dangerLine={0.08}
        loading={loading}
        maxDomain={0.2}
        points={toRateSeries(timeSeries, 'complained')}
        onPointSelect={onRatePointSelect}
        title="신고율"
        value={formatMetricRate(counts.complained, counts.sent)}
        total={counts.complained}
      />
    </div>
  );
}

function MetricsTrackingCards({ counts, isClickTrackingEnabled, isOpenTrackingEnabled, loading, onRatePointSelect, timeSeries }: {
  readonly counts: MetricsEventCounts;
  readonly isClickTrackingEnabled: boolean;
  readonly isOpenTrackingEnabled: boolean;
  readonly loading: boolean;
  readonly onRatePointSelect?: MetricsDashboardProps['onRatePointSelect'];
  readonly timeSeries: readonly MetricsTimePoint[];
}) {
  if (!isOpenTrackingEnabled && !isClickTrackingEnabled) return null;

  return (
    <div className="resend-ui-metrics-dashboard__rate-grid">
      {isOpenTrackingEnabled ? <RateCard
        colorEvent="opened"
        loading={loading}
        maxDomain={100}
        onPointSelect={onRatePointSelect}
        points={toRateSeries(timeSeries, 'opened')}
        title="열림율"
        value={formatMetricRate(counts.opened, counts.delivered, true)}
        total={counts.opened}
      /> : null}
      {isClickTrackingEnabled ? <RateCard
        colorEvent="clicked"
        loading={loading}
        maxDomain={20}
        onPointSelect={onRatePointSelect}
        points={toRateSeries(timeSeries, 'clicked')}
        title="클릭률"
        value={formatMetricRate(counts.clicked, counts.delivered, true)}
        total={counts.clicked}
      /> : null}
    </div>
  );
}

function RateCard({ colorEvent, dangerLine, loading, maxDomain, onPointSelect, points, title, total, value }: RateCardProps) {
  return (
    <Card.Root as="article" className="resend-ui-metrics-dashboard__rate-card" radius="3xl">
      <Card.Body className="resend-ui-metrics-dashboard__card-body">
      <MetricsInfoDrawer kind={colorEvent === 'bounced' ? 'bounce' : colorEvent === 'complained' ? 'complaint' : colorEvent === 'opened' ? 'open' : 'click'} />
      <div>
        <p className="resend-ui-metrics-dashboard__eyebrow">{title}</p>
        {loading ? <Skeleton className="resend-ui-metrics-dashboard__stat-skeleton" /> : (
          <MetricValue value={value} />
        )}
      </div>
      <MetricsBarChart colorEvent={colorEvent} dangerLine={dangerLine} maxDomain={maxDomain} onPointSelect={onPointSelect} points={points} />
      <RateBreakdown event={colorEvent} total={total} value={value} />
      </Card.Body>
    </Card.Root>
  );
}

function DomainBreakdownTable({ domainBreakdown, events, loading }: {
  readonly domainBreakdown: readonly MetricsDomainBreakdown[];
  readonly events: readonly MetricsVisibleEvent[];
  readonly loading: boolean;
}) {
  const rows = loading ? domainBreakdown.slice(0, 3) : domainBreakdown;
  return (
    <div className="resend-ui-metrics-dashboard__breakdown">
      <DataTable.Root className="resend-ui-metrics-dashboard__breakdown-table">
        <DataTable.Body>
          {rows.map((domain) => (
            <DataTable.Row className="resend-ui-metrics-dashboard__domain-row" key={domain.id}>
              <DataTable.Cell className="resend-ui-metrics-dashboard__domain-cell">
                {loading ? <Skeleton className="resend-ui-metrics-dashboard__domain-skeleton" /> : (
                  <>{domain.name} <span>({formatMetricNumber(domain.counts.sent + domain.counts.received)})</span></>
                )}
              </DataTable.Cell>
              <DataTable.Cell className="resend-ui-metrics-dashboard__domain-events">
                {loading ? <Skeleton className="resend-ui-metrics-dashboard__event-skeleton" /> : (
                  <DomainEventPercentages counts={domain.counts} domainName={domain.name} events={events} />
                )}
              </DataTable.Cell>
            </DataTable.Row>
          ))}
        </DataTable.Body>
      </DataTable.Root>
    </div>
  );
}

function DomainEventPercentages({ counts, domainName, events }: { readonly counts: MetricsEventCounts; readonly domainName: string; readonly events: readonly MetricsVisibleEvent[] }) {
  return (
    <RadixTooltip.Provider delayDuration={150}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>
          <button aria-label={`${domainName} 상태별 현황`} className="resend-ui-metrics-dashboard__domain-event-trigger" type="button">
            <span className="resend-ui-metrics-dashboard__domain-event-list">
              {events.map((event) => (
                <span className="resend-ui-metrics-dashboard__domain-event" key={event}>
                  <EventDot event={event} />
                  {formatMetricRate(counts[event], counts.sent, true)}
                </span>
              ))}
            </span>
          </button>
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content className="resend-ui-metrics-dashboard__domain-tooltip" side="top" sideOffset={8}>
            <Text as="p" color="white" weight="semibold">{domainName}</Text>
            {events.map((event) => counts[event] <= 0 ? null : (
              <div className="resend-ui-metrics-dashboard__tooltip-entry" key={event} style={{ borderColor: metricsStatusColors[event] }}>
                <Text as="p" color="white" weight="semibold">{metricsStatusLabels[event]}</Text>
                <Text>{formatMetricNumber(counts[event])}건</Text>
              </div>
            ))}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

function RateBreakdown({ event, total, value }: { readonly event: MetricsVisibleEvent; readonly total: number; readonly value: string }) {
  return (
    <div className="resend-ui-metrics-dashboard__rate-breakdown">
      <span><EventDot event={event} />{metricsStatusLabels[event]}</span>
      <span>{formatMetricNumber(total)} <strong>{value}</strong></span>
    </div>
  );
}

function EventDot({ event }: { readonly event: MetricsEvent }) {
  return <span aria-hidden="true" className="resend-ui-metrics-dashboard__dot" style={{ backgroundColor: metricsStatusColors[event] }} />;
}

function Skeleton({ className }: { readonly className: string }) {
  return <span aria-hidden="true" className={`resend-ui-metrics-dashboard__skeleton ${className}`} />;
}

function MetricValue({ value }: { readonly value: string }) {
  return <Text as="p" className="resend-ui-metrics-dashboard__stat-value" color="white" size="8">{value}</Text>;
}

function toRateSeries(timeSeries: readonly MetricsTimePoint[], event: MetricsVisibleEvent): readonly MetricsRatePoint[] {
  return timeSeries.map((point) => ({
    count: point.counts[event],
    label: point.label,
    sent: point.counts.sent,
  }));
}

export {
  MetricsOverviewCard,
  MetricsRateCards,
  MetricsTrackingCards,
};
