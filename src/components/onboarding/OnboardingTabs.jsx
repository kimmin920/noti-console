'use client';

import { useRef, useState } from 'react';

import styles from './onboarding.module.css';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function toSafeId(value, index = 0) {
  const safeValue = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return safeValue || `tab-${index + 1}`;
}

function resolveActiveValue({ fallbackValue, items, requestedValue }) {
  const firstEnabledItem = items.find((item) => !item.disabled) ?? items[0];
  const requestedItem = items.find((item) => item.value === requestedValue && !item.disabled);

  return requestedItem?.value ?? fallbackValue ?? firstEnabledItem?.value;
}

export function OnboardingTabs({
  className = '',
  defaultValue,
  getPanelId,
  getTabId,
  idPrefix = 'onboarding-tabs',
  items = [],
  label = 'Onboarding options',
  onValueChange,
  selectedValue,
}) {
  const firstEnabledItem = items.find((item) => !item.disabled) ?? items[0];
  const [internalValue, setInternalValue] = useState(defaultValue ?? firstEnabledItem?.value);
  const tabRefs = useRef(new Map());
  const activeValue = resolveActiveValue({
    fallbackValue: firstEnabledItem?.value,
    items,
    requestedValue: selectedValue ?? internalValue,
  });
  const enabledItems = items.filter((item) => !item.disabled);

  function selectValue(nextValue) {
    const nextItem = items.find((item) => item.value === nextValue);
    if (!nextItem || nextItem.disabled) return;

    if (selectedValue === undefined) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue);
  }

  function focusValue(nextValue) {
    requestAnimationFrame(() => {
      tabRefs.current.get(nextValue)?.focus();
    });
  }

  function handleKeyDown(event, item) {
    if (!enabledItems.length) return;

    const currentIndex = enabledItems.findIndex((enabledItem) => enabledItem.value === item.value);
    if (currentIndex === -1) return;

    let nextItem = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextItem = enabledItems[(currentIndex + 1) % enabledItems.length];
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextItem = enabledItems[(currentIndex - 1 + enabledItems.length) % enabledItems.length];
    } else if (event.key === 'Home') {
      nextItem = enabledItems[0];
    } else if (event.key === 'End') {
      nextItem = enabledItems[enabledItems.length - 1];
    }

    if (!nextItem) return;
    event.preventDefault();
    selectValue(nextItem.value);
    focusValue(nextItem.value);
  }

  return (
    <div className={cx('resend-ui-tabs', styles.tabs, className)}>
      <div aria-label={label} className={cx('resend-ui-tabs__list', styles.tabsList)} role="tablist">
        {items.map((item, index) => {
          const safeId = toSafeId(item.value, index);
          const isSelected = item.value === activeValue;
          const tabId = getTabId?.(item, index) ?? `${idPrefix}-${safeId}-tab`;
          const panelId = getPanelId?.(item, index) ?? `${idPrefix}-${safeId}-panel`;

          return (
            <button
              aria-controls={panelId}
              aria-disabled={item.disabled || undefined}
              aria-selected={isSelected}
              className={cx('resend-ui-tabs__tab', styles.tab)}
              data-active={isSelected ? true : undefined}
              disabled={item.disabled}
              id={tabId}
              key={item.value}
              onClick={() => selectValue(item.value)}
              onKeyDown={(event) => handleKeyDown(event, item)}
              ref={(node) => {
                if (node) {
                  tabRefs.current.set(item.value, node);
                } else {
                  tabRefs.current.delete(item.value);
                }
              }}
              role="tab"
              tabIndex={isSelected ? 0 : -1}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
