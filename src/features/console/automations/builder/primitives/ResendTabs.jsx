'use client';

import { useState } from 'react';

import { cx } from '../shared.js';

function getFirstValue(items) {
  return items[0]?.value;
}

function getResolvedValue(items, requestedValue) {
  if (requestedValue !== undefined && items.some((item) => item.value === requestedValue)) {
    return requestedValue;
  }

  return getFirstValue(items);
}

export function ResendTabsRoot({ className = '', ...props }) {
  return (
    <div
      className={cx('resend-ui-tabs', className)}
      data-activation-direction="none"
      data-orientation="horizontal"
      {...props}
    />
  );
}

export function ResendTabsList({ className = '', ...props }) {
  return (
    <div
      className={cx('resend-ui-tabs__list', className)}
      data-activation-direction="none"
      data-orientation="horizontal"
      role="tablist"
      {...props}
    />
  );
}

export function ResendTabsLink({
  active = false,
  className = '',
  tabIndex = -1,
  ...props
}) {
  return (
    <a
      aria-selected={active}
      className={cx('resend-ui-tabs__tab', className)}
      data-active={active ? '' : undefined}
      data-composite-item-active={active ? '' : undefined}
      data-orientation="horizontal"
      role="tab"
      tabIndex={tabIndex}
      {...props}
    />
  );
}

export function ResendTabsButton({
  active = false,
  className = '',
  tabIndex = -1,
  type = 'button',
  ...props
}) {
  return (
    <button
      aria-disabled="false"
      aria-selected={active}
      className={cx('resend-ui-tabs__tab', className)}
      data-active={active ? '' : undefined}
      data-composite-item-active={active ? '' : undefined}
      data-orientation="horizontal"
      role="tab"
      tabIndex={tabIndex}
      type={type}
      {...props}
    />
  );
}

export function ResendTabs({
  defaultValue,
  items,
  onValueChange,
  value,
  ...props
}) {
  const [internalValue, setInternalValue] = useState(() => defaultValue ?? getFirstValue(items));
  const selectedValue = getResolvedValue(items, value ?? internalValue);

  function selectValue(nextValue) {
    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
  }

  return (
    <ResendTabsRoot {...props}>
      <ResendTabsList>
        {items.map((item) => {
          const active = item.value === selectedValue;
          if (item.href !== undefined) {
            return (
              <ResendTabsLink active={active} href={item.href} key={item.value}>
                {item.label}
              </ResendTabsLink>
            );
          }

          return (
            <ResendTabsButton
              active={active}
              key={item.value}
              onClick={() => selectValue(item.value)}
            >
              {item.label}
            </ResendTabsButton>
          );
        })}
      </ResendTabsList>
    </ResendTabsRoot>
  );
}
