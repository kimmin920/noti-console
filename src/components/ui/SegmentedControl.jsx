'use client';

import { useState } from 'react';

export function SegmentedControl({
  className = '',
  defaultValue,
  items,
  onValueChange,
  value,
}) {
  const [uncontrolledActive, setUncontrolledActive] = useState(defaultValue ?? getItemValue(items[0]));
  const active = value ?? uncontrolledActive;

  function selectItem(item) {
    const itemValue = getItemValue(item);

    if (value === undefined) {
      setUncontrolledActive(itemValue);
    }

    onValueChange?.(itemValue);
  }

  return (
    <div className={['segmented', className].filter(Boolean).join(' ')} role="tablist">
      {items.map((item) => {
        const itemValue = getItemValue(item);

        return (
          <button
            aria-selected={active === itemValue}
            className={active === itemValue ? 'selected' : ''}
            key={itemValue}
            onClick={() => selectItem(item)}
            role="tab"
            type="button"
          >
            {getItemLabel(item)}
          </button>
        );
      })}
    </div>
  );
}

function getItemValue(item) {
  return typeof item === 'object' && item !== null ? item.value : item;
}

function getItemLabel(item) {
  return typeof item === 'object' && item !== null ? item.label : item;
}
