import { MultiSelect, type MultiSelectOption } from '../../primitives/multi-select';
import { Heading } from '../../primitives/typography';
import { DatePickerPresets, type DatePickerRange } from '../date-picker-presets';
import {
  metricsEventOrder,
  metricsStatusColors,
  metricsStatusLabels,
} from './data';
import type { MetricsDomain } from './types';

type MetricsHeaderProps = {
  readonly dateRange?: DatePickerRange | undefined;
  readonly domainIds: readonly string[];
  readonly domains: readonly MetricsDomain[];
  readonly onDateRangeChange: (range: DatePickerRange) => void;
  readonly onDomainIdsChange: (domainIds: readonly string[]) => void;
};

type MetricsEventFilterProps = {
  readonly onChange: (events: readonly (typeof metricsEventOrder)[number][]) => void;
  readonly value: readonly (typeof metricsEventOrder)[number][];
};

function MetricsDomainFilter({ domainIds, domains, onDomainIdsChange }: Pick<MetricsHeaderProps, 'domainIds' | 'domains' | 'onDomainIdsChange'>) {
  const options: readonly MultiSelectOption[] = [
    { label: '모든 채널', value: 'all' },
    ...domains.map((domain) => ({ label: domain.name, value: domain.id })),
  ];
  return (
    <MultiSelect.Root
      onChange={(value) => onDomainIdsChange(value.includes('all') ? [] : value)}
      options={options}
      value={domainIds.length === 0 ? ['all'] : domainIds}
    >
      <MultiSelect.Trigger
        className="resend-ui-metrics-dashboard__filter"
        label="모든 채널"
        selectedLabel={(selected) => selected.length === domains.length ? '모든 채널' : selected.length === 1 ? selected[0]?.label ?? '모든 채널' : `${selected.length}개 채널`}
      />
      <MultiSelect.Content align="end" className="resend-ui-metrics-dashboard__menu-content" searchable={domains.length > 7} searchPlaceholder="채널 검색..." />
    </MultiSelect.Root>
  );
}

function MetricsDatePresetFilter({ onChange, value }: { readonly onChange: (range: DatePickerRange) => void; readonly value?: DatePickerRange | undefined }) {
  return (
    <DatePickerPresets
      align="end"
      className="resend-ui-metrics-dashboard__filter"
      initialPresetIndex={4}
      onChange={onChange}
      value={value}
    />
  );
}

function MetricsEventFilter({ onChange, value }: MetricsEventFilterProps) {
  const options: readonly MultiSelectOption[] = [
    { label: '모든 상태', value: 'all' },
    ...metricsEventOrder.map((event) => ({ color: metricsStatusColors[event], label: metricsStatusLabels[event], value: event })),
  ];
  return (
    <MultiSelect.Root
      onChange={(nextValue) => onChange(nextValue.includes('all') ? metricsEventOrder : nextValue.filter((event): event is (typeof metricsEventOrder)[number] => metricsEventOrder.includes(event as (typeof metricsEventOrder)[number])))}
      options={options}
      value={value.length === metricsEventOrder.length ? ['all'] : value}
    >
      <MultiSelect.Trigger
        className="resend-ui-metrics-dashboard__event-filter"
        label="상태"
        selectedLabel={(selected) => selected.length === metricsEventOrder.length
          ? '모든 상태'
          : selected.length === 1
            ? selected[0]?.label ?? '상태'
            : `${selected.length}개 상태`}
      />
      <MultiSelect.Content align="end" className="resend-ui-metrics-dashboard__event-menu" />
    </MultiSelect.Root>
  );
}

function MetricsHeader({ dateRange, domainIds, domains, onDateRangeChange, onDomainIdsChange }: MetricsHeaderProps) {
  return (
    <header className="resend-ui-metrics-dashboard__header">
      <Heading as="h1" className="resend-ui-metrics-dashboard__title" size="7" weight="medium">발송 현황</Heading>
      <div className="resend-ui-metrics-dashboard__filters">
        <MetricsDomainFilter domainIds={domainIds} domains={domains} onDomainIdsChange={onDomainIdsChange} />
        <MetricsDatePresetFilter onChange={onDateRangeChange} value={dateRange} />
      </div>
    </header>
  );
}

export {
  MetricsDatePresetFilter,
  MetricsDomainFilter,
  MetricsEventFilter,
  MetricsHeader,
};
