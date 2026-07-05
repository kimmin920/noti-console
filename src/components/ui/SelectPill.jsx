'use client';

import { forwardRef, useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
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

export const SelectPill = forwardRef(function SelectPill(
  {
    children,
    className = '',
    defaultValue,
    disabled = false,
    onValueChange,
    options,
    type = 'button',
    value,
    ...props
  },
  ref
) {
  const items = useMemo(() => normalizeOptions(options), [options]);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? items[0]?.value);
  const selectedValue = value ?? uncontrolledValue;
  const selectedOption = items.find((item) => item.value === selectedValue);
  const label = selectedOption?.label ?? children;
  const buttonClassName = ['select-pill', className].filter(Boolean).join(' ');

  if (!items.length) {
    return (
      <button className={buttonClassName} disabled={disabled} ref={ref} type={type} {...props}>
        <span className="select-pill-label">{children}</span>
        <ChevronDown className="select-pill-chevron" size={15} />
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={buttonClassName} disabled={disabled} ref={ref} type={type} {...props}>
          <span className="select-pill-label">{label}</span>
          <ChevronDown className="select-pill-chevron" size={15} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="select-pill-menu" align="start">
        {items.map((item) => {
          const selected = item.value === selectedValue;

          return (
            <DropdownMenuItem
              aria-label={item.ariaLabel ?? item.label}
              className="select-pill-menu-item"
              disabled={item.disabled}
              key={item.value}
              onSelect={() => {
                if (value === undefined) {
                  setUncontrolledValue(item.value);
                }

                onValueChange?.(item.value, item);
              }}
            >
              <span className="select-pill-menu-label">
                {item.tone ? <span className={`select-pill-menu-dot ${item.tone}`} aria-hidden="true" /> : null}
                {item.label}
              </span>
              {selected ? <Check aria-hidden="true" className="select-pill-check visible" size={14} /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
