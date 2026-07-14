'use client';

import { forwardRef, useMemo } from 'react';

import { Select } from '../../ui-kits/resend/primitives/select';
import { SelectTrigger } from '../../ui-kits/resend/primitives/select-trigger';

function normalizeOptions(options = []) {
  return options.map((option) => typeof option === 'string' ? { label: option, value: option } : option);
}

export const AppSelectPill = forwardRef(function AppSelectPill(
  { children, className = '', defaultValue, disabled = false, onValueChange, options, value, ...props },
  ref
) {
  const items = useMemo(() => normalizeOptions(options), [options]);

  if (items.length === 0) {
    return <SelectTrigger className={className} disabled={disabled} ref={ref} {...props}>{children}</SelectTrigger>;
  }

  const fallbackValue = defaultValue ?? items[0]?.value;
  return (
    <Select.Root
      defaultValue={fallbackValue}
      onValueChange={(nextValue) => onValueChange?.(nextValue, items.find((item) => item.value === nextValue))}
      value={value}
    >
      <Select.Trigger className={className} disabled={disabled} ref={ref} {...props}>
        <Select.Value />
      </Select.Trigger>
      <Select.Content align="start">
        {items.map((item) => (
          <Select.Item disabled={item.disabled} key={item.value} value={item.value}>{item.label}</Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
});
