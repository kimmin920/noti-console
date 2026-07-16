import { Check } from 'lucide-react';
import { Popover as RadixPopover } from 'radix-ui';
import { useEffect, useMemo, useState } from 'react';
import { FilterButton } from '../../primitives/filter-button';
import {
  getDatePickerPresets,
  normalizeRange,
  resolveInitialRange,
  resolveRangeSelection,
  startOfDay,
} from './date-utils';
import { DatePickerCalendar } from './date-picker-calendar';
import type {
  DatePickerPreset,
  DatePickerPresetsProps,
  DatePickerRange,
  DatePickerSelection,
} from './types';

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

function DatePickerPresets({
  align = 'start',
  className,
  containerId,
  disabled = false,
  initialPresetIndex,
  maxDateMessage,
  maxDays = 30,
  onChange,
  presets: customPresets,
  today,
  value,
  ...props
}: DatePickerPresetsProps) {
  const [open, setOpen] = useState(false);
  const resolvedToday = useMemo(() => startOfDay(today ?? new Date()), [today]);
  const presets = useMemo(
    () => customPresets ?? getDatePickerPresets(maxDays, resolvedToday),
    [customPresets, maxDays, resolvedToday]
  );
  const [selectedRange, setSelectedRange] = useState<DatePickerRange>(() =>
    resolveInitialRange(value, presets, initialPresetIndex)
  );
  const selection = resolveRangeSelection(selectedRange, presets, resolvedToday);
  const portalContainer = getPortalContainer(containerId);

  useEffect(() => {
    if (value?.from || value?.to) {
      setSelectedRange(resolveInitialRange(value, presets, initialPresetIndex));
    }
  }, [initialPresetIndex, presets, value]);

  function commitRange(nextRange: DatePickerRange, nextSelection?: DatePickerSelection) {
    const normalizedRange = normalizeRange(nextRange);
    const resolvedSelection = nextSelection ?? resolveRangeSelection(normalizedRange, presets, resolvedToday);
    setSelectedRange(normalizedRange);
    onChange?.(normalizedRange, resolvedSelection);
  }

  function handlePresetClick(preset: DatePickerPreset) {
    if (preset.disabled) return;
    commitRange(preset.value, { mode: 'preset', text: preset.label });
    window.requestAnimationFrame(() => setOpen(false));
  }

  return (
    <RadixPopover.Root open={open} onOpenChange={setOpen}>
      <RadixPopover.Trigger asChild>
        <FilterButton
          className={cx('resend-ui-date-picker-presets__trigger', className)}
          data-resend-date-picker-presets
          data-resend-date-picker-presets-trigger
          disabled={disabled}
          expanded={open}
          popupType="dialog"
          {...props}
        >
          {selection.text}
        </FilterButton>
      </RadixPopover.Trigger>
      <RadixPopover.Portal container={portalContainer}>
        <RadixPopover.Content
          align={align}
          className="resend-ui-date-picker-presets__content"
          data-resend-date-picker-presets-content
          side="top"
          sideOffset={8}
        >
          <div className="resend-ui-date-picker-presets__body">
            <div className="resend-ui-date-picker-presets__preset-list">
              {presets.map((preset) => {
                const selected = preset.label === selection.text;
                return (
                  <button
                    aria-disabled={preset.disabled || undefined}
                    className="resend-ui-date-picker-presets__preset"
                    data-disabled={preset.disabled || undefined}
                    data-resend-date-picker-preset={preset.label}
                    data-selected={selected || undefined}
                    disabled={preset.disabled}
                    key={preset.label}
                    onClick={() => handlePresetClick(preset)}
                    title={preset.disabled && typeof maxDateMessage === 'string' ? maxDateMessage : undefined}
                    type="button"
                  >
                    <span>{preset.label}</span>
                    <span
                      className="resend-ui-date-picker-presets__preset-check"
                      data-resend-date-picker-preset-check
                      data-selected={selected || undefined}
                    >
                      <Check aria-hidden="true" size={14} />
                    </span>
                  </button>
                );
              })}
            </div>
            <DatePickerCalendar
              maxDays={maxDays}
              onSelect={(range) => commitRange(range)}
              selectedRange={selectedRange}
              today={resolvedToday}
            />
          </div>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

function getPortalContainer(containerId: string | undefined) {
  if (!containerId || typeof document === 'undefined') return undefined;
  return document.getElementById(containerId) ?? undefined;
}

export { DatePickerPresets };
