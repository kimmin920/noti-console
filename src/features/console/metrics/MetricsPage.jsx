'use client';

import { useMemo, useState } from 'react';
import {
  Button,
  MetricsDashboard,
  metricsEventOrder,
} from '../../../ui-kits/resend/index.ts';
import { useConsoleNavigation } from '../ConsoleNavigationContext.jsx';
import { useMetricsSummaryQuery } from './queries.js';
import { getMetricsChannelLabel, METRICS_CHANNEL_OPTIONS } from './metricsFormatters.js';

const EMPTY_COUNTS = Object.freeze({
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
});

const METRICS_CHANNELS = METRICS_CHANNEL_OPTIONS
  .filter((option) => option.value !== 'all')
  .map((option) => ({ id: option.value, name: option.label }));

export function MetricsPage() {
  const navigation = useConsoleNavigation();
  const [dashboardFilters, setDashboardFilters] = useState(createInitialDashboardFilters);
  const queryFilters = useMemo(() => createQueryFilters(dashboardFilters), [dashboardFilters]);
  const summaryQuery = useMetricsSummaryQuery(queryFilters);
  const summary = summaryQuery.data;
  const overview = useMemo(() => toMetricsCounts(summary?.totals), [summary?.totals]);
  const channelBreakdown = useMemo(
    () => (summary?.channelBreakdown ?? []).map((row) => ({
      counts: toMetricsCounts(row),
      id: row.channel,
      name: getMetricsChannelLabel(row.channel),
    })),
    [summary?.channelBreakdown]
  );
  const timeSeries = useMemo(
    () => (summary?.timeSeries ?? []).map((point) => ({
      counts: toMetricsCounts(point),
      label: formatChartDate(point.bucket),
    })),
    [summary?.timeSeries]
  );

  function openLogs() {
    navigation.push('/logs');
  }

  return (
    <div className="page-frame">
      {summaryQuery.isError ? (
        <p className="metrics-state-panel" role="alert">
          발송 현황을 불러오지 못했습니다.
          <Button onClick={() => summaryQuery.refetch()}>다시 시도</Button>
        </p>
      ) : null}
      <MetricsDashboard
        aria-busy={summaryQuery.isPending}
        domainBreakdown={channelBreakdown}
        domains={METRICS_CHANNELS}
        filters={dashboardFilters}
        isClickTrackingEnabled={false}
        isOpenTrackingEnabled={false}
        lastUpdatedLabel={formatUpdatedAt(summary?.generatedAt)}
        onFiltersChange={setDashboardFilters}
        onRatePointSelect={openLogs}
        onTimePointSelect={openLogs}
        overview={overview}
        state={summaryQuery.isPending ? 'loading' : 'loaded'}
        timeSeries={timeSeries}
      />
    </div>
  );
}

function createInitialDashboardFilters() {
  const to = startOfDay(new Date());
  const from = new Date(to);
  from.setDate(from.getDate() - 14);
  return {
    dateRange: { from, to },
    domainIds: [],
    events: metricsEventOrder,
  };
}

function createQueryFilters(filters) {
  const from = filters.dateRange?.from;
  const to = filters.dateRange?.to ?? from;
  return {
    channel: filters.domainIds.length > 0 ? filters.domainIds.join(',') : 'all',
    from: formatQueryDate(from),
    to: formatQueryDate(to),
  };
}

function toMetricsCounts(value) {
  if (!value) return EMPTY_COUNTS;
  return {
    ...EMPTY_COUNTS,
    bounced: Number(value.failedCount ?? 0),
    delivered: Number(value.successCount ?? 0),
    delivery_delayed: Number(value.pendingCount ?? 0),
    failed: Number(value.failedCount ?? 0),
    sent: Number(value.recipientCount ?? 0),
    suppressed: Number(value.canceledCount ?? 0),
  };
}

function formatQueryDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return undefined;
  const year = String(value.getFullYear());
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatChartDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Seoul',
  }).format(new Date(`${value}T00:00:00+09:00`));
}

function formatUpdatedAt(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).format(new Date(value));
}

function startOfDay(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
