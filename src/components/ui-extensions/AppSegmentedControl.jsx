'use client';

import { Children } from 'react';

import { Tabs } from '../../ui-kits/resend/primitives/tabs';

export function AppSegmentedControl({ items, ...props }) {
  const normalizedItems = items.map((item) => {
    const normalized = typeof item === 'object' && item !== null
      ? item
      : { label: item, value: item };
    return {
      ...normalized,
      label: Array.isArray(normalized.label)
        ? Children.toArray(normalized.label)
        : normalized.label,
    };
  });

  return <Tabs items={normalizedItems} {...props} />;
}
