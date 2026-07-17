import type { ComponentPropsWithoutRef } from 'react';
import type { DatePickerRange } from '../date-picker-presets';

type MetricsDashboardState = 'loaded' | 'loading';

type MetricsVisibleEvent =
  | 'bounced'
  | 'clicked'
  | 'complained'
  | 'delivered'
  | 'delivery_delayed'
  | 'failed'
  | 'opened'
  | 'received'
  | 'suppressed'
  | 'unsubscribed';

type MetricsEvent = MetricsVisibleEvent | 'sent';

type MetricsEventCounts = Readonly<Record<MetricsEvent, number>>;

type MetricsDatePreset = {
  readonly daysBack: number;
  readonly isYesterday?: boolean;
  readonly label: string;
};

type MetricsDomain = {
  readonly id: string;
  readonly name: string;
};

type MetricsDomainBreakdown = MetricsDomain & {
  readonly counts: MetricsEventCounts;
};

type MetricsTimePoint = {
  readonly counts: MetricsEventCounts;
  readonly label: string;
};

type MetricsRatePoint = {
  readonly count: number;
  readonly label: string;
  readonly sent: number;
};

type MetricsDashboardFilters = {
  readonly dateRange?: DatePickerRange | undefined;
  readonly domainIds: readonly string[];
  readonly events: readonly MetricsVisibleEvent[];
};

type MetricsTimePointSelection = {
  readonly label: string;
};

type MetricsRatePointSelection = MetricsTimePointSelection & {
  readonly event: MetricsVisibleEvent;
};

type MetricsDashboardProps = ComponentPropsWithoutRef<'section'> & {
  readonly defaultFilters?: Partial<MetricsDashboardFilters> | undefined;
  readonly domainBreakdown?: readonly MetricsDomainBreakdown[];
  readonly domains?: readonly MetricsDomain[];
  readonly filters?: MetricsDashboardFilters | undefined;
  readonly isClickTrackingEnabled?: boolean;
  readonly isOpenTrackingEnabled?: boolean;
  readonly lastUpdatedLabel?: string;
  readonly onFiltersChange?: ((filters: MetricsDashboardFilters) => void) | undefined;
  readonly onRatePointSelect?: ((selection: MetricsRatePointSelection) => void) | undefined;
  readonly onTimePointSelect?: ((selection: MetricsTimePointSelection) => void) | undefined;
  readonly overview?: MetricsEventCounts;
  readonly state?: MetricsDashboardState;
  readonly timeSeries?: readonly MetricsTimePoint[];
};

export type {
  MetricsDashboardProps,
  MetricsDashboardFilters,
  MetricsDashboardState,
  MetricsDatePreset,
  MetricsDomain,
  MetricsDomainBreakdown,
  MetricsEvent,
  MetricsEventCounts,
  MetricsRatePoint,
  MetricsRatePointSelection,
  MetricsTimePoint,
  MetricsTimePointSelection,
  MetricsVisibleEvent,
};
