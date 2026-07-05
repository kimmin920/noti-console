'use client';

import { createElement, isValidElement, useId, useState } from 'react';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function getChoiceValue(item) {
  if (typeof item === 'object' && item !== null) {
    return String(item.value ?? item.id ?? item.label);
  }

  return String(item);
}

function getChoiceLabel(item) {
  if (typeof item === 'object' && item !== null) {
    return item.label ?? getChoiceValue(item);
  }

  return String(item);
}

function getChoiceProp(item, prop) {
  return typeof item === 'object' && item !== null ? item[prop] : undefined;
}

function renderChoiceIcon(icon) {
  if (!icon) {
    return null;
  }

  if (isValidElement(icon)) {
    return icon;
  }

  return createElement(icon, { 'aria-hidden': 'true', size: 16, strokeWidth: 1.8 });
}

export function ChoiceCardGroup({
  'aria-describedby': ariaDescribedBy,
  className = '',
  compact = false,
  defaultValue,
  description,
  disabled = false,
  error,
  id,
  invalid = false,
  items = [],
  label,
  layout = 'grid',
  name,
  onValueChange,
  value,
  ...props
}) {
  const generatedId = useId();
  const groupId = id ?? generatedId;
  const groupLabelId = `${groupId}-label`;
  const groupDescriptionId = `${groupId}-description`;
  const groupErrorId = `${groupId}-error`;
  const generatedName = `${groupId}-choice`;
  const radioName = name ?? generatedName;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const activeValue = value ?? uncontrolledValue;
  const describedBy = [
    ariaDescribedBy,
    description ? groupDescriptionId : null,
    error ? groupErrorId : null,
  ].filter(Boolean).join(' ') || undefined;

  function selectValue(nextValue) {
    if (disabled) {
      return;
    }

    if (value === undefined) {
      setUncontrolledValue(nextValue);
    }

    onValueChange?.(nextValue);
  }

  return (
    <div
      aria-describedby={describedBy}
      aria-invalid={invalid || error ? 'true' : undefined}
      aria-labelledby={label ? groupLabelId : undefined}
      className={cx(
        'choice-card-group',
        `choice-card-group-${layout}`,
        compact && 'is-compact',
        disabled && 'is-disabled',
        invalid && 'is-invalid',
        error && 'has-error',
        className
      )}
      data-layout={layout}
      role="radiogroup"
      {...props}
    >
      {label || description ? (
        <div className="choice-card-group-header">
          {label ? <span className="choice-card-group-label" id={groupLabelId}>{label}</span> : null}
          {description ? <p id={groupDescriptionId}>{description}</p> : null}
        </div>
      ) : null}
      <div className="choice-card-list">
        {items.map((item) => {
          const itemValue = getChoiceValue(item);
          const itemDisabled = disabled || Boolean(getChoiceProp(item, 'disabled'));
          const selected = activeValue === itemValue;
          const itemId = getChoiceProp(item, 'id') ?? `${groupId}-${itemValue}`;

          return (
            <label
              aria-checked={selected}
              className={cx(
                'choice-card',
                selected && 'is-selected',
                itemDisabled && 'is-disabled',
                (invalid || error) && 'is-invalid',
                getChoiceProp(item, 'className')
              )}
              data-disabled={itemDisabled ? 'true' : 'false'}
              data-invalid={invalid || error ? 'true' : 'false'}
              data-selected={selected ? 'true' : 'false'}
              htmlFor={itemId}
              key={itemValue}
            >
              <input
                aria-checked={selected}
                className="choice-card-input"
                checked={selected}
                disabled={itemDisabled}
                id={itemId}
                name={radioName}
                onChange={() => selectValue(itemValue)}
                type="radio"
                value={itemValue}
              />
              {getChoiceProp(item, 'icon') ? <span className="choice-card-icon">{renderChoiceIcon(getChoiceProp(item, 'icon'))}</span> : null}
              <span className="choice-card-copy">
                <span className="choice-card-label">{getChoiceLabel(item)}</span>
                {getChoiceProp(item, 'description') ? <span className="choice-card-description">{getChoiceProp(item, 'description')}</span> : null}
              </span>
              {getChoiceProp(item, 'meta') ? <span className="choice-card-meta">{getChoiceProp(item, 'meta')}</span> : null}
            </label>
          );
        })}
      </div>
      {error ? (
        <p className="choice-card-error" id={groupErrorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
