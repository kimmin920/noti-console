import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  endOfMonth,
  formatMonthTitle,
  getCalendarWeeks,
  getEffectiveRetentionDays,
  getMonthStart,
  isAfterDay,
  isBeforeDay,
  isRangeComplete,
  normalizeRange,
  startOfDay,
  subDays,
  weekdayInitials,
} from './date-utils';
import type { CalendarDay, DatePickerRange } from './types';

type DatePickerCalendarProps = {
  readonly maxDays?: number;
  readonly onSelect: (range: DatePickerRange) => void;
  readonly selectedRange: DatePickerRange;
  readonly today: Date;
};

function DatePickerCalendar({
  maxDays = 30,
  onSelect,
  selectedRange,
  today,
}: DatePickerCalendarProps) {
  const selectedMonth = selectedRange.to ?? selectedRange.from ?? today;
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(selectedMonth));
  const selectedMonthTime = getMonthStart(selectedMonth).getTime();

  useEffect(() => {
    setVisibleMonth(getMonthStart(selectedMonth));
  }, [selectedMonthTime]);

  const weeks = useMemo(
    () => getCalendarWeeks(visibleMonth, selectedRange, today, maxDays),
    [maxDays, selectedRange.from, selectedRange.to, today, visibleMonth]
  );
  const previousMonth = addMonths(visibleMonth, -1);
  const nextMonth = addMonths(visibleMonth, 1);
  const retentionStart = subDays(startOfDay(today), getEffectiveRetentionDays(maxDays) - 1);
  const previousDisabled = isBeforeDay(endOfMonth(previousMonth), retentionStart);
  const nextDisabled = isAfterDay(nextMonth, today);

  function handleDaySelect(day: CalendarDay) {
    if (day.disabled || day.hidden) return;
    const normalizedRange = normalizeRange(selectedRange);
    if (!normalizedRange.from || isRangeComplete(normalizedRange)) {
      onSelect({ from: day.date, to: undefined });
      return;
    }
    if (isBeforeDay(day.date, normalizedRange.from)) {
      onSelect({ from: day.date, to: normalizedRange.from });
      return;
    }
    onSelect({ from: normalizedRange.from, to: day.date });
  }

  return (
    <div className="resend-ui-date-picker-presets__calendar" data-resend-date-picker-calendar>
      <div className="resend-ui-date-picker-presets__caption">
        <button
          aria-label="Go to the Previous Month"
          className="resend-ui-date-picker-presets__nav-button"
          disabled={previousDisabled}
          onClick={() => setVisibleMonth(previousMonth)}
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={16} />
        </button>
        <span className="resend-ui-date-picker-presets__caption-label">
          {formatMonthTitle(visibleMonth)}
        </span>
        <button
          aria-label="Go to the Next Month"
          className="resend-ui-date-picker-presets__nav-button"
          disabled={nextDisabled}
          onClick={() => setVisibleMonth(nextMonth)}
          type="button"
        >
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      </div>
      <table
        aria-label={formatMonthTitle(visibleMonth)}
        aria-multiselectable="true"
        className="resend-ui-date-picker-presets__month-grid"
        role="grid"
      >
        <thead aria-hidden="true">
          <tr className="resend-ui-date-picker-presets__weekdays">
            {weekdayInitials.map((weekday, index) => (
              <th
                className="resend-ui-date-picker-presets__weekday"
                data-resend-date-picker-weekday
                key={`${weekday}-${index}`}
                scope="col"
              >
                {weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr className="resend-ui-date-picker-presets__week" key={week.id}>
              {week.days.map((day) => (
                <td
                  aria-selected={day.selected || undefined}
                  className="resend-ui-date-picker-presets__day"
                  data-disabled={day.disabled || undefined}
                  data-hidden={day.hidden || undefined}
                  data-outside={day.outside || undefined}
                  data-range-end={day.rangeEnd || undefined}
                  data-range-middle={day.rangeMiddle || undefined}
                  data-range-start={day.rangeStart || undefined}
                  data-resend-date-picker-day
                  data-selected={day.selected || undefined}
                  data-today={day.today || undefined}
                  key={day.isoDate}
                  role="gridcell"
                >
                  {day.hidden ? (
                    <span className="resend-ui-date-picker-presets__day-placeholder" />
                  ) : (
                    <button
                      aria-label={day.today ? `Today, ${day.isoDate}` : day.isoDate}
                      className="resend-ui-date-picker-presets__day-button"
                      disabled={day.disabled}
                      onClick={() => handleDaySelect(day)}
                      type="button"
                    >
                      {day.label}
                    </button>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { DatePickerCalendar };
