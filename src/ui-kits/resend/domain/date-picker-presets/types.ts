import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type DatePickerRange = {
  readonly from?: Date | undefined;
  readonly to?: Date | undefined;
};

type DatePickerPreset = {
  readonly disabled: boolean;
  readonly label: string;
  readonly value: DatePickerRange;
};

type DatePickerSelectionMode = 'custom' | 'preset';

type DatePickerSelection = {
  readonly mode: DatePickerSelectionMode;
  readonly text: string;
};

type DatePickerPresetsAlign = 'center' | 'end' | 'start';

type DatePickerPresetsProps = Omit<ComponentPropsWithoutRef<'button'>, 'onChange' | 'value'> & {
  readonly align?: DatePickerPresetsAlign;
  readonly containerId?: string | undefined;
  readonly initialPresetIndex?: number | undefined;
  readonly maxDateMessage?: ReactNode;
  readonly maxDays?: number;
  readonly onChange?: ((range: DatePickerRange, selection: DatePickerSelection) => void) | undefined;
  readonly presets?: readonly DatePickerPreset[] | undefined;
  readonly today?: Date | undefined;
  readonly value?: DatePickerRange | undefined;
};

type CalendarDay = {
  readonly date: Date;
  readonly disabled: boolean;
  readonly hidden: boolean;
  readonly isoDate: string;
  readonly label: number;
  readonly outside: boolean;
  readonly rangeEnd: boolean;
  readonly rangeMiddle: boolean;
  readonly rangeStart: boolean;
  readonly selected: boolean;
  readonly today: boolean;
};

type CalendarWeek = {
  readonly days: readonly CalendarDay[];
  readonly id: string;
};

export type {
  CalendarDay,
  CalendarWeek,
  DatePickerPreset,
  DatePickerPresetsAlign,
  DatePickerPresetsProps,
  DatePickerRange,
  DatePickerSelection,
  DatePickerSelectionMode,
};
