import type {
  CalendarDay,
  CalendarWeek,
  DatePickerPreset,
  DatePickerRange,
  DatePickerSelection,
} from './types';

const sourcePresetDefinitions = [
  { daysBack: 0, label: '오늘' },
  { daysBack: 1, isYesterday: true, label: '어제' },
  { daysBack: 2, label: '최근 3일' },
  { daysBack: 6, label: '최근 7일' },
  { daysBack: 14, label: '최근 15일' },
  { daysBack: 29, label: '최근 30일' },
] as const;

const weekdayInitials = ['일', '월', '화', '수', '목', '금', '토'] as const;

function getEffectiveRetentionDays(maxDays = 30) {
  return Math.max(2, maxDays);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function subDays(date: Date, days: number) {
  return addDays(date, -days);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(left: Date, right: Date) {
  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

function isBeforeDay(left: Date, right: Date) {
  return startOfDay(left).getTime() < startOfDay(right).getTime();
}

function isAfterDay(left: Date, right: Date) {
  return startOfDay(left).getTime() > startOfDay(right).getTime();
}

function isRangeComplete(range: DatePickerRange) {
  return Boolean(range.from && range.to);
}

function normalizeRange(range: DatePickerRange): DatePickerRange {
  if (!range.from || !range.to) return { from: range.from, to: range.to };
  if (isBeforeDay(range.to, range.from)) return { from: range.to, to: range.from };
  return { from: range.from, to: range.to };
}

function getDatePickerPresets(maxDays = 30, today = new Date()): readonly DatePickerPreset[] {
  const effectiveRetentionDays = getEffectiveRetentionDays(maxDays);
  const todayStart = startOfDay(today);
  return sourcePresetDefinitions.map((preset) => {
    const from = subDays(todayStart, preset.daysBack);
    const to = 'isYesterday' in preset ? subDays(todayStart, 1) : todayStart;
    return {
      disabled: preset.daysBack >= effectiveRetentionDays,
      label: preset.label,
      value: { from, to },
    };
  });
}

function clampDateToRetention(date: Date, maxDays?: number, today = new Date()) {
  if (!maxDays) return date;
  const retentionStart = subDays(startOfDay(today), getEffectiveRetentionDays(maxDays) - 1);
  return isBeforeDay(date, retentionStart) ? retentionStart : date;
}

function resolveInitialRange(
  value: DatePickerRange | undefined,
  presets: readonly DatePickerPreset[],
  initialPresetIndex: number | undefined
): DatePickerRange {
  if (value?.from || value?.to) return normalizeRange(value);
  const enabledPresets = presets.filter((preset) => !preset.disabled);
  const fallbackIndex = initialPresetIndex ?? Math.min(3, Math.max(enabledPresets.length - 1, 0));
  const fallbackPreset = enabledPresets[fallbackIndex] ?? enabledPresets[0] ?? presets[0];
  return fallbackPreset ? normalizeRange(fallbackPreset.value) : {};
}

function resolveRangeSelection(
  range: DatePickerRange,
  presets: readonly DatePickerPreset[],
  today = new Date()
): DatePickerSelection {
  const normalizedRange = normalizeRange(range);
  const matchingPreset = presets
    .filter((preset) => !preset.disabled)
    .find((preset) => isMatchingRange(normalizedRange, preset.value));
  if (matchingPreset) return { mode: 'preset', text: matchingPreset.label };
  if (normalizedRange.from && normalizedRange.to) {
    return {
      mode: 'custom',
      text: `${formatShortDate(normalizedRange.from)} - ${formatShortDate(normalizedRange.to)}`,
    };
  }
  return { mode: 'custom', text: formatShortDate(today) };
}

function getCalendarWeeks(
  visibleMonth: Date,
  selectedRange: DatePickerRange,
  today: Date,
  maxDays = 30
): readonly CalendarWeek[] {
  const monthStart = getMonthStart(visibleMonth);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const retentionStart = subDays(startOfDay(today), getEffectiveRetentionDays(maxDays) - 1);
  const normalizedRange = normalizeRange(selectedRange);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    return getCalendarDay(date, monthStart, normalizedRange, retentionStart, today);
  });
  return Array.from({ length: 6 }, (_, weekIndex) => {
    const weekDays = days.slice(weekIndex * 7, weekIndex * 7 + 7);
    const firstDay = weekDays[0];
    return {
      days: weekDays,
      id: firstDay?.isoDate ?? `week-${weekIndex}`,
    };
  });
}

function getCalendarDay(
  date: Date,
  monthStart: Date,
  selectedRange: DatePickerRange,
  retentionStart: Date,
  today: Date
): CalendarDay {
  const dateStart = startOfDay(date);
  const outside = dateStart.getMonth() !== monthStart.getMonth();
  const selected = isDateSelected(dateStart, selectedRange);
  return {
    date: dateStart,
    disabled: isBeforeDay(dateStart, retentionStart) || isAfterDay(dateStart, today),
    hidden: outside,
    isoDate: toIsoDate(dateStart),
    label: dateStart.getDate(),
    outside,
    rangeEnd: Boolean(selectedRange.to && isSameDay(dateStart, selectedRange.to)),
    rangeMiddle: isDateInRangeMiddle(dateStart, selectedRange),
    rangeStart: Boolean(selectedRange.from && isSameDay(dateStart, selectedRange.from)),
    selected,
    today: isSameDay(dateStart, today),
  };
}

function isDateSelected(date: Date, range: DatePickerRange) {
  if (range.from && isSameDay(date, range.from)) return true;
  if (range.to && isSameDay(date, range.to)) return true;
  return isDateInRangeMiddle(date, range);
}

function isDateInRangeMiddle(date: Date, range: DatePickerRange) {
  return Boolean(range.from && range.to && isAfterDay(date, range.from) && isBeforeDay(date, range.to));
}

function isMatchingRange(left: DatePickerRange, right: DatePickerRange) {
  if (!left.from || !left.to || !right.from || !right.to) return false;
  return isSameDay(left.from, right.from) && isSameDay(left.to, right.to);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat('ko-KR', { day: 'numeric', month: 'short' }).format(date);
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', year: 'numeric' }).format(date);
}

function toIsoDate(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function serializeDatePickerRange(range: DatePickerRange, selection: DatePickerSelection) {
  return JSON.stringify({
    from: range.from ? toIsoDate(range.from) : '',
    label: selection.text,
    mode: selection.mode,
    to: range.to ? toIsoDate(range.to) : '',
  });
}

export {
  addMonths,
  clampDateToRetention,
  endOfMonth,
  formatMonthTitle,
  getCalendarWeeks,
  getDatePickerPresets,
  getEffectiveRetentionDays,
  getMonthStart,
  isAfterDay,
  isBeforeDay,
  isRangeComplete,
  normalizeRange,
  resolveInitialRange,
  resolveRangeSelection,
  serializeDatePickerRange,
  startOfDay,
  subDays,
  toIsoDate,
  weekdayInitials,
};
