import { useId } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartContainer, ChartLegendContent, ChartTooltipContent } from '../../../components/ui/index.js';
import { ConsoleLink } from '../ConsoleNavigationContext.jsx';
import { formatMetricNumber } from './metricsFormatters.js';

const TREND_BUCKETS = [
  { color: '#1f7a3b', id: 'success', label: '성공' },
  { color: '#b42318', id: 'failed', label: '실패' },
  { color: '#b7791f', id: 'pending', label: '결과 대기' },
  { color: '#77736c', id: 'canceled', label: '취소' },
];

const TREND_CHART_CONFIG = Object.fromEntries(
  TREND_BUCKETS.map((bucket) => [bucket.id, { color: bucket.color, label: bucket.label }])
);

export function MetricsTrendChart({ data = [], loading = false }) {
  const chartTitleId = useId();
  const chartRows = data.map((item) => ({ ...item, counts: getTrendCounts(item) }));
  const accessibleRows = chartRows.filter((item) => item.counts.totalCount > 0);
  const chartData = chartRows.map((item) => ({
    canceled: item.counts.canceled,
    failed: item.counts.failed,
    fullLabel: formatTrendBucket(item.bucket),
    label: formatTrendBucketShort(item.bucket),
    pending: item.counts.pending,
    success: item.counts.success,
    total: item.counts.totalCount,
  }));
  const xAxisTicks = getTrendXAxisTicks(chartData);

  if (loading) {
    return (
      <div aria-label="일자별 발송 결과를 확인하는 중입니다." className="metrics-trend-chart is-loading" role="status">
        <div className="metrics-trend-skeleton-plot">
          {Array.from({ length: 12 }, (_, index) => (
            <span className="metrics-trend-skeleton is-column" key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (!chartRows.length || chartRows.every((item) => item.counts.totalCount === 0)) {
    return (
      <div className="metrics-chart-empty">
        <span>선택한 기간에 집계할 발송이 없습니다.</span>
        <ConsoleLink className="button secondary metrics-empty-action" href="/message-send">첫 발송 만들기</ConsoleLink>
      </div>
    );
  }

  return (
    <div className="metrics-trend-chart" role="group" aria-labelledby={chartTitleId}>
      <span className="visually-hidden" id={chartTitleId}>
        일자별 발송 성공, 실패, 결과 대기, 취소 추이
      </span>
      <ul className="visually-hidden">
        {accessibleRows.map((item) => (
          <li key={item.bucket}>
            {item.bucket}: 성공 {formatMetricNumber(item.counts.success)}명, 실패{' '}
            {formatMetricNumber(item.counts.failed)}명, 결과 대기 {formatMetricNumber(item.counts.pending)}명,
            취소 {formatMetricNumber(item.counts.canceled)}명
          </li>
        ))}
      </ul>
      <ChartContainer className="metrics-trend-chart-container" config={TREND_CHART_CONFIG}>
        <BarChart
          accessibilityLayer
          data={chartData}
          margin={{ bottom: 0, left: 0, right: 6, top: 8 }}
        >
          <CartesianGrid stroke="var(--line-soft)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            interval={0}
            minTickGap={0}
            tickLine={false}
            tickMargin={8}
            ticks={xAxisTicks}
          />
          <YAxis
            axisLine={false}
            tickFormatter={(value) => formatMetricNumber(value)}
            tickLine={false}
            tickMargin={6}
            width={42}
          />
          <RechartsTooltip
            content={(
              <ChartTooltipContent
                config={TREND_CHART_CONFIG}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel}
                valueFormatter={(value) => `${formatMetricNumber(value)}명`}
              />
            )}
            cursor={{ fill: 'var(--control)' }}
          />
          <Legend content={<ChartLegendContent config={TREND_CHART_CONFIG} />} verticalAlign="top" />
          <Bar
            dataKey="success"
            fill={TREND_CHART_CONFIG.success.color}
            isAnimationActive={false}
            name="성공"
            stackId="result"
          />
          <Bar
            dataKey="failed"
            fill={TREND_CHART_CONFIG.failed.color}
            isAnimationActive={false}
            name="실패"
            stackId="result"
          />
          <Bar
            dataKey="pending"
            fill={TREND_CHART_CONFIG.pending.color}
            isAnimationActive={false}
            name="결과 대기"
            stackId="result"
          />
          <Bar
            dataKey="canceled"
            fill={TREND_CHART_CONFIG.canceled.color}
            isAnimationActive={false}
            name="취소"
            radius={[4, 4, 0, 0]}
            stackId="result"
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function getTrendCounts(item) {
  const success = toCount(item.successCount);
  const failed = toCount(item.failedCount);
  const pending = toCount(item.pendingCount);
  const canceled = toCount(item.canceledCount);
  const recipientTotal = toCount(item.recipientCount);
  const resultTotal = success + failed + pending + canceled;

  return {
    canceled,
    failed,
    pending,
    success,
    totalCount: Math.max(recipientTotal, resultTotal),
  };
}

function formatTrendBucket(bucket) {
  if (typeof bucket !== 'string') return '';

  const [, year, month, day] = bucket.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  if (year && month && day) return `${year}. ${month}. ${day}.`;

  return bucket;
}

function formatTrendBucketShort(bucket) {
  if (typeof bucket !== 'string') return '';

  const [, , month, day] = bucket.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  if (month && day) return `${Number(month)}/${Number(day)}`;

  return bucket.slice(5).replace('-', '.');
}

function getTrendXAxisTicks(chartData) {
  if (chartData.length <= 8) return chartData.map((item) => item.label);
  if (chartData.length <= 16) return getSteppedLabels(chartData, 2);
  if (chartData.length <= 31) return getSteppedLabels(chartData, 7, { includeLast: false });

  return getSteppedLabels(chartData, Math.ceil(chartData.length / 6));
}

function getSteppedLabels(chartData, step, { includeLast = true } = {}) {
  const labels = chartData
    .filter((_, index) => index % step === 0)
    .map((item) => item.label);
  const lastLabel = chartData.at(-1)?.label;

  if (includeLast && lastLabel && labels.at(-1) !== lastLabel) {
    labels.push(lastLabel);
  }

  return labels;
}

function toCount(value) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}
