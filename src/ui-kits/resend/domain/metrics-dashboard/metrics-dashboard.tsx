import {
  MetricsOverviewCard,
  MetricsRateCards,
  MetricsTrackingCards,
} from './metrics-cards';
import { MetricsHeader } from './metrics-controls';
import { MetricsHealthGrid } from './metrics-health-cards';
import { metricsEventOrder } from './data';
import { useState } from 'react';
import type { MetricsDashboardFilters, MetricsDashboardProps } from './types';

const emptyMetricsOverview = {
  bounced: 0,
  clicked: 0,
  complained: 0,
  delivered: 0,
  delivery_delayed: 0,
  failed: 0,
  opened: 0,
  received: 0,
  sent: 0,
  suppressed: 0,
  unsubscribed: 0,
} as const;

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

function MetricsDashboard({
  className,
  defaultFilters,
  domainBreakdown = [],
  domains = [],
  filters,
  isClickTrackingEnabled = true,
  isOpenTrackingEnabled = true,
  lastUpdatedLabel = '',
  onFiltersChange,
  onRatePointSelect,
  onTimePointSelect,
  overview = emptyMetricsOverview,
  state = 'loaded',
  timeSeries = [],
  ...props
}: MetricsDashboardProps) {
  const loading = state === 'loading';
  const [internalFilters, setInternalFilters] = useState<MetricsDashboardFilters>(() => ({
    dateRange: defaultFilters?.dateRange,
    domainIds: defaultFilters?.domainIds ?? [],
    events: defaultFilters?.events ?? metricsEventOrder,
  }));
  const activeFilters = filters ?? internalFilters;

  function setFilters(nextFilters: MetricsDashboardFilters) {
    if (filters === undefined) setInternalFilters(nextFilters);
    onFiltersChange?.(nextFilters);
  }

  return (
    <section
      className={cx('resend-ui-metrics-dashboard', className)}
      data-resend-domain-metrics-dashboard
      {...props}
    >
      <MetricsHeader
        dateRange={activeFilters.dateRange}
        domainIds={activeFilters.domainIds}
        domains={domains}
        onDateRangeChange={(dateRange) => setFilters({ ...activeFilters, dateRange })}
        onDomainIdsChange={(domainIds) => setFilters({ ...activeFilters, domainIds })}
      />
      <div className="resend-ui-metrics-dashboard__content">
        <div className="resend-ui-metrics-dashboard__overview-stack">
          <MetricsHealthGrid counts={overview} isEngagementEnabled={isOpenTrackingEnabled} loading={loading} />
          <MetricsOverviewCard
            counts={overview}
            domainBreakdown={domainBreakdown}
            events={activeFilters.events}
            loading={loading}
            onEventsChange={(events) => setFilters({ ...activeFilters, events })}
            onTimePointSelect={onTimePointSelect}
            timeSeries={timeSeries}
          />
        </div>
        <MetricsRateCards counts={overview} loading={loading} onRatePointSelect={onRatePointSelect} timeSeries={timeSeries} />
        <MetricsTrackingCards
          counts={overview}
          isClickTrackingEnabled={isClickTrackingEnabled}
          isOpenTrackingEnabled={isOpenTrackingEnabled}
          loading={loading}
          onRatePointSelect={onRatePointSelect}
          timeSeries={timeSeries}
        />
        <p className="resend-ui-metrics-dashboard__updated">
          데이터는 15분마다 업데이트됩니다. 마지막 업데이트 <strong>{lastUpdatedLabel}</strong>
        </p>
      </div>
    </section>
  );
}

export { MetricsDashboard };
