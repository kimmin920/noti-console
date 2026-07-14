'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui-extensions/AppDropdownMenu.jsx';
import { AppButton as Button } from '../ui-extensions/AppButton.jsx';

const dayMs = 24 * 60 * 60 * 1000;

const defaultPresets = [
  { daysBack: 0, label: '오늘', value: 'today' },
  { daysBack: 1, label: '어제', value: 'yesterday', yesterdayOnly: true },
  { daysBack: 2, label: '최근 3일', value: 'last-3-days' },
  { daysBack: 6, label: '최근 7일', value: 'last-7-days' },
  { daysBack: 14, label: '최근 15일', value: 'last-15-days' },
  { daysBack: 29, label: '최근 30일', value: 'last-30-days' },
];

function toDateInputValue(date) {
  const nextDate = new Date(date);
  const offsetDate = new Date(nextDate.getTime() - nextDate.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function fromDateInputValue(value) {
  return value ? new Date(`${value}T00:00:00`) : null;
}

function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function addDays(date, days) {
  return new Date(startOfDay(date).getTime() + days * dayMs);
}

function getPresetRange(preset, today = new Date()) {
  if (Number.isFinite(preset.daysForward)) {
    const from = startOfDay(today);

    return {
      from,
      to: addDays(from, preset.daysForward),
    };
  }

  const to = preset.yesterdayOnly ? addDays(today, -1) : startOfDay(today);
  return {
    from: addDays(to, -preset.daysBack),
    to,
  };
}

function formatDate(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function rangesMatch(first, second) {
  return (
    startOfDay(first.from).getTime() === startOfDay(second.from).getTime()
    && startOfDay(first.to).getTime() === startOfDay(second.to).getTime()
  );
}

function getRangeLabel(range, presets, locale, today) {
  const preset = presets.find((item) => rangesMatch(range, getPresetRange(item, today)));

  if (preset) {
    return preset.label;
  }

  return `${formatDate(range.from, locale)} - ${formatDate(range.to, locale)}`;
}

function getMonthDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const startDate = addDays(firstDay, -startOffset);

  return Array.from({ length: 42 }, (_, index) => addDays(startDate, index));
}

function CalendarGrid({ draftRange, maxDate, minDate, onSelectDate, viewMonth, setViewMonth }) {
  const days = useMemo(() => getMonthDays(viewMonth), [viewMonth]);
  const monthLabel = new Intl.DateTimeFormat('ko-KR', { month: 'long', year: 'numeric' }).format(viewMonth);

  return (
    <div className="date-picker-calendar">
      <div className="date-picker-calendar-header">
        <button aria-label="이전 달" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} type="button">
          <ChevronLeft size={15} />
        </button>
        <strong>{monthLabel}</strong>
        <button aria-label="다음 달" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} type="button">
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="date-picker-weekdays" aria-hidden="true">
        {['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="date-picker-days">
        {days.map((day) => {
          const time = startOfDay(day).getTime();
          const outsideMonth = day.getMonth() !== viewMonth.getMonth();
          const disabled = time < startOfDay(minDate).getTime() || time > startOfDay(maxDate).getTime();
          const draftFromTime = startOfDay(draftRange.from).getTime();
          const draftToTime = startOfDay(draftRange.to).getTime();
          const rangeStart = Math.min(draftFromTime, draftToTime);
          const rangeEnd = Math.max(draftFromTime, draftToTime);
          const selected = time === draftFromTime || time === draftToTime;
          const inRange = time > rangeStart && time < rangeEnd;

          return (
            <button
              aria-pressed={selected}
              className={[
                outsideMonth ? 'outside-month' : '',
                selected ? 'selected' : '',
                inRange ? 'in-range' : '',
              ].filter(Boolean).join(' ')}
              disabled={disabled}
              key={toDateInputValue(day)}
              onClick={() => onSelectDate(day)}
              type="button"
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatePickerPresets({
  className = '',
  defaultRange,
  maxDate = new Date(),
  minDate,
  onRangeChange,
  presets = defaultPresets,
  referenceDate,
}) {
  const presetReferenceDate = referenceDate ?? maxDate;
  const initialRange = defaultRange ?? getPresetRange(presets[4] ?? presets[0], presetReferenceDate);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState(initialRange);
  const [draftRange, setDraftRange] = useState(initialRange);
  const [pendingFrom, setPendingFrom] = useState(null);
  const [viewMonth, setViewMonth] = useState(new Date(initialRange.to.getFullYear(), initialRange.to.getMonth(), 1));
  const resolvedMinDate = minDate ?? addDays(maxDate, -89);
  const label = getRangeLabel(range, presets, 'ko-KR', presetReferenceDate);

  function commit(nextRange) {
    const orderedRange = nextRange.from <= nextRange.to
      ? nextRange
      : { from: nextRange.to, to: nextRange.from };

    setRange(orderedRange);
    setDraftRange(orderedRange);
    onRangeChange?.(orderedRange);
  }

  function selectCalendarDate(date) {
    const selectedDate = startOfDay(date);

    if (!pendingFrom) {
      setPendingFrom(selectedDate);
      setDraftRange({ from: selectedDate, to: selectedDate });
      return;
    }

    const nextRange = pendingFrom <= selectedDate
      ? { from: pendingFrom, to: selectedDate }
      : { from: selectedDate, to: pendingFrom };

    setDraftRange(nextRange);
    setPendingFrom(null);
  }

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger aria-haspopup="dialog" asChild>
        <button className={['select-pill date-picker-trigger', className].filter(Boolean).join(' ')} type="button">
          <span className="select-pill-label">{label}</span>
          <ChevronDown className="select-pill-chevron" size={15} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label="날짜 범위 선택" className="date-picker-content" role="dialog">
        <div className="date-picker-presets" aria-label="빠른 날짜 범위">
          {presets.map((preset) => {
            const nextRange = getPresetRange(preset, presetReferenceDate);
            const selected = rangesMatch(range, nextRange);

            return (
              <button
                className={selected ? 'selected' : ''}
                key={preset.value ?? preset.label}
                onClick={() => {
                  commit(nextRange);
                  setOpen(false);
                }}
                type="button"
              >
                <span>{preset.label}</span>
                {selected ? <CalendarDays aria-hidden="true" size={14} /> : null}
              </button>
            );
          })}
        </div>
        <div className="date-picker-custom">
          <div className="date-picker-fields">
            <label>
              시작
              <input
                max={toDateInputValue(maxDate)}
                min={toDateInputValue(resolvedMinDate)}
                onChange={(event) => {
                  const nextDate = fromDateInputValue(event.target.value);
                  if (nextDate) setDraftRange((current) => ({ ...current, from: nextDate }));
                }}
                type="date"
                value={toDateInputValue(draftRange.from)}
              />
            </label>
            <label>
              종료
              <input
                max={toDateInputValue(maxDate)}
                min={toDateInputValue(resolvedMinDate)}
                onChange={(event) => {
                  const nextDate = fromDateInputValue(event.target.value);
                  if (nextDate) setDraftRange((current) => ({ ...current, to: nextDate }));
                }}
                type="date"
                value={toDateInputValue(draftRange.to)}
              />
            </label>
          </div>
          <CalendarGrid
            draftRange={draftRange}
            maxDate={maxDate}
            minDate={resolvedMinDate}
            onSelectDate={selectCalendarDate}
            setViewMonth={setViewMonth}
            viewMonth={viewMonth}
          />
          <div className="date-picker-actions">
            <Button onClick={() => {
              setDraftRange(range);
              setPendingFrom(null);
              setOpen(false);
            }}>
              취소
            </Button>
            <Button onClick={() => {
              commit(draftRange);
              setPendingFrom(null);
              setOpen(false);
            }} variant="primary">
              적용
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
