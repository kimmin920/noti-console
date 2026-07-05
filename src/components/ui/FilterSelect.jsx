'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './DropdownMenu.jsx';

function normalizeOptions(options = []) {
  return options.map((option) => {
    if (typeof option === 'string') {
      return { label: option, value: option };
    }

    return option;
  });
}

function getOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function getSummary({ allValue, label, multiple, options, values }) {
  if (multiple) {
    if (values.includes(allValue)) {
      return getOptionLabel(options, allValue);
    }

    if (values.length === 1) {
      return getOptionLabel(options, values[0]);
    }

    return `${values.length} ${label}`;
  }

  return getOptionLabel(options, values[0]);
}

export function FilterSelect({
  allValue = 'all',
  className = '',
  defaultValue,
  label = 'Filters',
  multiple = false,
  onValueChange,
  options,
  value,
}) {
  const items = useMemo(() => normalizeOptions(options), [options]);
  const fallbackValue = defaultValue ?? items[0]?.value ?? allValue;
  const controlledValues = Array.isArray(value) ? value : value === undefined ? undefined : [value];
  const [uncontrolledValues, setUncontrolledValues] = useState(
    Array.isArray(fallbackValue) ? fallbackValue : [fallbackValue]
  );
  const selectedValues = controlledValues ?? uncontrolledValues;
  const summary = getSummary({
    allValue,
    label,
    multiple,
    options: items,
    values: selectedValues,
  });

  function commit(nextValues) {
    if (controlledValues === undefined) {
      setUncontrolledValues(nextValues);
    }

    onValueChange?.(multiple ? nextValues : nextValues[0]);
  }

  function toggleValue(nextValue) {
    if (!multiple) {
      commit([nextValue]);
      return;
    }

    if (nextValue === allValue) {
      commit([allValue]);
      return;
    }

    const current = selectedValues.filter((item) => item !== allValue);
    const nextValues = current.includes(nextValue)
      ? current.filter((item) => item !== nextValue)
      : [...current, nextValue];

    commit(nextValues.length > 0 ? nextValues : [allValue]);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={['select-pill filter-select-trigger', className].filter(Boolean).join(' ')} type="button">
          <span className="select-pill-label">{summary}</span>
          <ChevronDown className="select-pill-chevron" size={15} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="filter-select-menu" align="start">
        {items.map((item) => {
          const checked = selectedValues.includes(item.value);
          const Item = multiple ? DropdownMenuCheckboxItem : DropdownMenuItem;

          return (
            <Item
              checked={multiple ? checked : undefined}
              className="filter-select-item"
              disabled={item.disabled}
              key={item.value}
              onSelect={(event) => {
                if (multiple) {
                  event.preventDefault();
                }

                toggleValue(item.value);
              }}
            >
              <span className="select-pill-menu-label">
                {item.tone ? <span aria-hidden="true" className={`select-pill-menu-dot ${item.tone}`} /> : null}
                {item.label}
              </span>
              {checked ? <Check aria-hidden="true" className="select-pill-check visible" size={14} /> : null}
            </Item>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
