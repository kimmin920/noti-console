import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type MouseHandlerDataParam,
  type TooltipContentProps,
} from 'recharts';
import { Heading, Text } from '../../primitives/typography';
import { metricsStatusColors, metricsStatusLabels } from './data';
import type {
  MetricsRatePoint,
  MetricsRatePointSelection,
  MetricsTimePoint,
  MetricsTimePointSelection,
  MetricsVisibleEvent,
} from './types';

type MetricsAreaChartProps = {
  readonly events: readonly MetricsVisibleEvent[];
  readonly loading?: boolean;
  readonly onPointSelect?: ((selection: MetricsTimePointSelection) => void) | undefined;
  readonly points: readonly MetricsTimePoint[];
};

type MetricsBarChartProps = {
  readonly colorEvent: MetricsVisibleEvent;
  readonly dangerLine?: number | undefined;
  readonly maxDomain: number;
  readonly onPointSelect?: ((selection: MetricsRatePointSelection) => void) | undefined;
  readonly points: readonly MetricsRatePoint[];
};

type MetricsCursorProps = {
  readonly dataLength: number;
  readonly height?: number;
  readonly points?: readonly { readonly x?: number }[];
  readonly width?: number;
};

function getActiveIndex(state: MouseHandlerDataParam) {
  const index = Number(state.activeTooltipIndex);
  return Number.isInteger(index) ? index : -1;
}

function MetricsAreaChart({ events, loading = false, onPointSelect, points }: MetricsAreaChartProps) {
  const data = points.map((point) => ({ label: point.label, ...point.counts }));
  return (
    <div className="resend-ui-metrics-dashboard__chart" data-loading={loading ? '' : undefined} data-metrics-area-chart>
      <ResponsiveContainer height={300} width="100%">
        <AreaChart
          className="resend-ui-metrics-dashboard__rechart resend-ui-metrics-dashboard__rechart--clickable"
          data={data}
          margin={{ bottom: 0, left: 25, top: 0 }}
          onClick={(state) => {
            const point = points[getActiveIndex(state)];
            if (point !== undefined) onPointSelect?.({ label: point.label });
          }}
          stackOffset="none"
        >
          <CartesianGrid horizontal stroke="var(--rui-gray-a2)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine
            dataKey="label"
            interval={points.length > 15 ? 'equidistantPreserveStart' : 'preserveStartEnd'}
            minTickGap={25}
            tick={{ fill: '#A09FA6', fontSize: 11 }}
            tickLine={false}
            tickMargin={12}
          />
          <YAxis
            axisLine
            domain={['auto', 'auto']}
            orientation="right"
            tick={{ fill: '#A09FA6', fontSize: 11 }}
            tickFormatter={(value: number) => value.toLocaleString('ko-KR')}
          />
          <Tooltip
            allowEscapeViewBox={{ x: true, y: true }}
            animationDuration={200}
            content={(props) => <MetricsAreaTooltip {...props} />}
            cursor={<MetricsChartCursor dataLength={data.length} />}
            position={{ y: 0 }}
            wrapperStyle={{ outline: 'none', zIndex: 10 }}
          />
          {events.map((event) => (
            <Area
              activeDot={false}
              animationDuration={800}
              className="resend-ui-metrics-dashboard__area-line"
              dataKey={event}
              data-metrics-event={event}
              fill={`url(#resend-ui-metrics-${event})`}
              key={event}
              stackId={event}
              stroke={metricsStatusColors[event]}
              strokeWidth={2}
              type="linear"
            />
          ))}
          <defs>
            {events.map((event) => (
              <linearGradient id={`resend-ui-metrics-${event}`} key={event} x1="0" x2="0" y1="0" y2="1">
                <stop offset="10%" stopColor={metricsStatusColors[event]} stopOpacity={.2} />
                <stop offset="100%" stopColor={metricsStatusColors[event]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricsBarChart({ colorEvent, dangerLine, maxDomain, onPointSelect, points }: MetricsBarChartProps) {
  const data = points.map((point) => ({
    count: point.sent === 0 ? 0 : Number.parseFloat(((point.count / point.sent) * 100).toFixed(2)),
    label: point.label,
  }));
  return (
    <div className="resend-ui-metrics-dashboard__chart" data-metrics-bar-chart={colorEvent}>
      <ResponsiveContainer height={300} width="100%">
        <BarChart
          className="resend-ui-metrics-dashboard__rechart resend-ui-metrics-dashboard__rechart--clickable"
          data={data}
          margin={{ bottom: 0, left: 20, top: 0 }}
          onClick={(state) => {
            const point = points[getActiveIndex(state)];
            if (point !== undefined) onPointSelect?.({ event: colorEvent, label: point.label });
          }}
        >
          <CartesianGrid horizontal stroke="var(--rui-gray-a2)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine
            dataKey="label"
            interval="equidistantPreserveStart"
            minTickGap={40}
            tick={{ fill: '#A09FA6', fontSize: 11 }}
            tickLine={false}
            tickMargin={12}
          />
          <YAxis
            allowDataOverflow
            axisLine
            domain={[0, maxDomain]}
            orientation="right"
            scale="pow"
            tick={{ fill: '#A09FA6', fontSize: 11 }}
            tickFormatter={(value: number) => `${value.toLocaleString('ko-KR')}%`}
            width={42}
          />
          <Tooltip
            animationDuration={200}
            content={(props) => <MetricsRateTooltip event={colorEvent} {...props} />}
            cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
            position={{ y: 0 }}
            wrapperStyle={{ outline: 'none' }}
          />
          <Bar className="resend-ui-metrics-dashboard__bar" dataKey="count" fill={metricsStatusColors[colorEvent]} maxBarSize={3} />
          {dangerLine === undefined ? null : (
            <ReferenceLine
              className="resend-ui-metrics-dashboard__risk-line"
              label={{ className: 'resend-ui-metrics-dashboard__risk-label', dx: -5, dy: 1, fontSize: 11, letterSpacing: '.03em', position: 'insideTopLeft', value: '주의' }}
              stroke="var(--rui-orange-a9)"
              strokeDasharray="2 2"
              y={dangerLine}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricsAreaTooltip({ active, label, payload }: TooltipContentProps) {
  if (!active || payload.length === 0) return null;
  const entries = payload.filter((entry) => Number(entry.value) > 0);
  return (
    <div className="resend-ui-metrics-dashboard__chart-tooltip">
      {label === undefined ? null : <Heading as="h3" size="2">{String(label)}</Heading>}
      {entries.length === 0 ? <Text as="p">발송 데이터가 없습니다</Text> : entries.map((entry) => {
        const event = String(entry.dataKey) as MetricsVisibleEvent;
        if (!(event in metricsStatusLabels)) return null;
        return (
          <div className="resend-ui-metrics-dashboard__tooltip-entry" key={event} style={{ borderColor: metricsStatusColors[event] }}>
            <Text as="p" color="white" weight="semibold">{metricsStatusLabels[event]}</Text>
            <Text>{Number(entry.value).toLocaleString('ko-KR')}건</Text>
          </div>
        );
      })}
    </div>
  );
}

function MetricsRateTooltip({ active, event, label, payload }: TooltipContentProps & { readonly event: MetricsVisibleEvent }) {
  if (!active || payload.length === 0 || Number(payload[0]?.value) <= 0) return null;
  return (
    <div className="resend-ui-metrics-dashboard__chart-tooltip">
      {label === undefined ? null : <Heading as="h3" size="2">{String(label)}</Heading>}
      <div className="resend-ui-metrics-dashboard__tooltip-entry" style={{ borderColor: metricsStatusColors[event] }}>
        <Text>{Number(payload[0]?.value).toLocaleString('ko-KR')}%</Text>
      </div>
    </div>
  );
}

function MetricsChartCursor({ dataLength, height, points, width }: MetricsCursorProps) {
  const chartWidth = Number(width) || 90;
  const pointX = points?.[0]?.x;
  if (!Number.isFinite(pointX)) return null;
  const cursorWidth = dataLength > 0 ? chartWidth / dataLength : 90;
  return <rect fill="rgba(255, 255, 255, 0.04)" height={height} pointerEvents="none" width={cursorWidth} x={(pointX ?? 0) - cursorWidth / 2} y={0} />;
}

export { MetricsAreaChart, MetricsBarChart };
