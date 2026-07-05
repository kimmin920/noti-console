'use client';

import { createContext, useContext, useId, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const AccordionContext = createContext(null);
const AccordionItemContext = createContext(null);

function toArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function useAccordionContext(component) {
  const context = useContext(AccordionContext);

  if (!context) {
    throw new Error(`${component} must be used inside Accordion`);
  }

  return context;
}

function useAccordionItemContext(component) {
  const context = useContext(AccordionItemContext);

  if (!context) {
    throw new Error(`${component} must be used inside AccordionItem`);
  }

  return context;
}

export function Accordion({
  children,
  className = '',
  collapsible = true,
  defaultValue,
  onValueChange,
  type = 'single',
  value,
  ...props
}) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const isControlled = value !== undefined;
  const openValues = toArray(isControlled ? value : uncontrolledValue);

  function setNextValue(nextValues) {
    const nextValue = type === 'multiple' ? nextValues : nextValues[0];

    if (!isControlled) {
      setUncontrolledValue(nextValue);
    }

    onValueChange?.(nextValue);
  }

  const contextValue = {
    collapsible,
    isOpen(itemValue) {
      return openValues.includes(itemValue);
    },
    toggle(itemValue) {
      const isCurrentOpen = openValues.includes(itemValue);

      if (type === 'multiple') {
        const nextValues = isCurrentOpen
          ? openValues.filter((item) => item !== itemValue)
          : [...openValues, itemValue];
        setNextValue(nextValues);
        return;
      }

      if (isCurrentOpen && collapsible) {
        setNextValue([]);
        return;
      }

      if (!isCurrentOpen) {
        setNextValue([itemValue]);
      }
    },
  };

  return (
    <div className={['accordion-root', className].filter(Boolean).join(' ')} {...props}>
      <AccordionContext.Provider value={contextValue}>
        {children}
      </AccordionContext.Provider>
    </div>
  );
}

export function AccordionItem({
  children,
  className = '',
  value,
  ...props
}) {
  const generatedId = useId();
  const itemValue = value ?? generatedId;
  const triggerId = `${generatedId}-trigger`;
  const contentId = `${generatedId}-content`;
  const contextValue = useMemo(() => ({
    contentId,
    triggerId,
    value: itemValue,
  }), [contentId, itemValue, triggerId]);

  return (
    <div className={['accordion-item', className].filter(Boolean).join(' ')} {...props}>
      <AccordionItemContext.Provider value={contextValue}>
        {children}
      </AccordionItemContext.Provider>
    </div>
  );
}

export function AccordionTrigger({
  children,
  className = '',
  ...props
}) {
  const { isOpen, toggle } = useAccordionContext('AccordionTrigger');
  const { contentId, triggerId, value } = useAccordionItemContext('AccordionTrigger');
  const open = isOpen(value);

  return (
    <button
      aria-controls={contentId}
      aria-expanded={open}
      className={['accordion-trigger', className].filter(Boolean).join(' ')}
      id={triggerId}
      onClick={() => toggle(value)}
      type="button"
      {...props}
    >
      <span>{children}</span>
      <ChevronDown aria-hidden="true" className="accordion-chevron" size={15} />
    </button>
  );
}

export function AccordionContent({
  children,
  className = '',
  ...props
}) {
  const { isOpen } = useAccordionContext('AccordionContent');
  const { contentId, triggerId, value } = useAccordionItemContext('AccordionContent');
  const open = isOpen(value);

  return (
    <div
      aria-labelledby={triggerId}
      className={['accordion-content', className].filter(Boolean).join(' ')}
      hidden={!open}
      id={contentId}
      role="region"
      {...props}
    >
      {children}
    </div>
  );
}
