'use client';

import { useId, useMemo, useState } from 'react';
import { CodeBlock } from '../ui/CodeBlock.jsx';

export function CodeGroup({
  className = '',
  defaultValue,
  items = [],
  label = 'Code examples',
  ...props
}) {
  const groupId = useId();
  const initialIndex = Math.max(0, items.findIndex((item) => item.value === defaultValue));
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activeItem = items[activeIndex] ?? items[0];
  const panelId = `${groupId}-panel`;
  const activeTabId = `${groupId}-tab-${activeIndex}`;

  const tabs = useMemo(() => items.map((item, index) => ({
    ...item,
    id: `${groupId}-tab-${index}`,
  })), [groupId, items]);

  if (!activeItem) {
    return null;
  }

  return (
    <section className={['code-group', className].filter(Boolean).join(' ')} aria-label={label} {...props}>
      <div className="code-group-tabs" role="tablist">
        {tabs.map((item, index) => (
          <button
            aria-controls={panelId}
            aria-selected={index === activeIndex}
            className="code-group-tab"
            id={item.id}
            key={item.value ?? item.label}
            onClick={() => setActiveIndex(index)}
            role="tab"
            tabIndex={index === activeIndex ? 0 : -1}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div aria-labelledby={activeTabId} id={panelId} role="tabpanel">
        <CodeBlock
          code={activeItem.code}
          language={activeItem.language ?? activeItem.value ?? 'text'}
          showCopy={activeItem.showCopy ?? true}
        />
      </div>
    </section>
  );
}
