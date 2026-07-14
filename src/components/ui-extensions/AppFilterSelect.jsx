'use client';

import { MultiSelect } from '../../ui-kits/resend/primitives/multi-select';
import { Select } from '../../ui-kits/resend/primitives/select';

const toneColors = {
  green: '#12b76a',
  neutral: '#98a2b3',
  red: '#f04438',
  yellow: '#f79009',
};

function normalizeOptions(options = []) {
  return options.map((option) => {
    const normalized = typeof option === 'string' ? { label: option, value: option } : option;
    return { ...normalized, color: normalized.color ?? toneColors[normalized.tone] };
  });
}

export function AppFilterSelect({
  allValue = 'all',
  className = '',
  defaultValue,
  label = 'Filters',
  multiple = false,
  onValueChange,
  options,
  value,
}) {
  const items = normalizeOptions(options);
  const fallbackValue = defaultValue ?? items[0]?.value ?? allValue;

  if (multiple) {
    const defaultValues = Array.isArray(fallbackValue) ? fallbackValue : [fallbackValue];
    const controlledValues = value === undefined ? undefined : Array.isArray(value) ? value : [value];
    const allLabel = items.find((item) => item.value === allValue)?.label ?? `All ${label}`;
    const concreteCount = items.filter((item) => item.value !== allValue).length;

    return (
      <MultiSelect.Root
        allValue={allValue}
        defaultValue={defaultValues}
        onChange={(nextValue) => onValueChange?.([...nextValue])}
        options={items}
        value={controlledValues}
      >
        <MultiSelect.Trigger
          className={className}
          label={label}
          selectedLabel={(selected) => selected.length === concreteCount
            ? allLabel
            : selected.length === 1
              ? selected[0]?.label ?? label
              : `${selected.length} ${label}`}
        />
        <MultiSelect.Content />
      </MultiSelect.Root>
    );
  }

  return (
    <Select.Root defaultValue={fallbackValue} onValueChange={onValueChange} value={value}>
      <Select.Trigger className={className}>
        <Select.Value />
      </Select.Trigger>
      <Select.Content align="start">
        {items.map((item) => (
          <Select.Item disabled={item.disabled} key={item.value} value={item.value}>
            {item.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}
