'use client';

import { Check } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';

export function AutomationSetVariables({
  onVariableMappingChange,
  optionalTemplateVariables = [],
  requiredTemplateVariables = [],
  selectedEvent = null,
  validation = {},
  variableMapping = {},
  variableOptions = [],
}) {
  const variables = useMemo(() => ([
    ...requiredTemplateVariables.map((key) => ({ key, required: true })),
    ...optionalTemplateVariables.map((key) => ({ key, required: false })),
  ]), [optionalTemplateVariables, requiredTemplateVariables]);

  if (variables.length === 0) {
    return (
      <div className="automation-set-variables" data-resend-domain-automation-set-variables>
        <span className="automation-set-variables-title">Set variables</span>
        <p className="automation-message-node-state">템플릿 변수가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="automation-set-variables" data-resend-domain-automation-set-variables>
      <span className="automation-set-variables-title">Set variables</span>
      <div className="automation-set-variables-list">
        {variables.map((variable, index) => {
          const error = validation[variable.key] ?? '';

          return (
            <AutomationSetVariableField
              error={error}
              index={index}
              key={`${variable.required ? 'required' : 'optional'}-${variable.key}`}
              onChange={(alias) => onVariableMappingChange?.(variable.key, alias)}
              selectedEvent={selectedEvent}
              value={variableMapping[variable.key] ?? ''}
              variable={variable}
              variableOptions={variableOptions}
            />
          );
        })}
      </div>
    </div>
  );
}

function AutomationSetVariableField({
  error,
  index,
  onChange,
  selectedEvent,
  value,
  variable,
  variableOptions,
}) {
  const errorId = useId();
  const fieldId = useId();
  const listboxId = useId();
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const displayValue = open ? query : getVariableOptionDisplayValue(value, variableOptions);
  const groups = useMemo(
    () => getVariableOptionGroups({
      query: open ? query : '',
      selectedEvent,
      variableOptions,
    }),
    [open, query, selectedEvent, variableOptions]
  );
  const optionCount = groups.reduce((count, group) => count + group.options.length, 0);
  const expanded = open && optionCount > 0;

  function selectValue(nextValue) {
    onChange?.(nextValue);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleBlur() {
    window.setTimeout(() => {
      if (!document.activeElement?.closest?.('[data-automation-variable-combobox]')) {
        setOpen(false);
        setQuery('');
      }
    }, 0);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }

    if (event.key === 'Enter') event.preventDefault();
  }

  return (
    <div className="automation-set-variable-field">
      {index > 0 ? <div className="automation-set-variable-rule" /> : null}
      <div className="automation-set-variable-row">
        <label className="automation-set-variable-label" htmlFor={fieldId}>
          <code translate="no">{`{{{${variable.key}}}}`}</code>
          {!variable.required ? <span>(optional)</span> : null}
        </label>
        <div className="automation-set-variable-combobox" data-automation-variable-combobox>
          <input
            aria-describedby={error ? errorId : undefined}
            aria-expanded={expanded}
            aria-invalid={error ? 'true' : undefined}
            aria-label={`Variable ${variable.key}`}
            aria-controls={expanded ? listboxId : undefined}
            autoComplete="off"
            className="automation-set-variable-input"
            id={fieldId}
            onBlur={handleBlur}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setOpen(true);
            }}
            onFocus={() => {
              setQuery('');
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type or select a property"
            ref={inputRef}
            role="combobox"
            spellCheck={false}
            value={displayValue}
          />
          {expanded ? (
            <div
              className="automation-set-variable-popover"
              id={listboxId}
              onMouseDown={(event) => event.preventDefault()}
              role="listbox"
            >
              {groups.map((group) => (
                <div className="automation-set-variable-group" key={group.label}>
                  <div className="automation-set-variable-group-heading">{group.label}</div>
                  {group.options.map((option) => (
                    <button
                      aria-selected={option.alias === value}
                      className="automation-set-variable-option"
                      key={option.alias}
                      onClick={() => selectValue(option.alias)}
                      role="option"
                      type="button"
                    >
                      <span>{option.label || option.alias}</span>
                      {option.alias === value ? <Check aria-hidden="true" size={14} /> : null}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {error ? (
        <p className="automation-message-node-state is-error automation-set-variable-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function getVariableOptionGroups({ query, selectedEvent, variableOptions }) {
  const normalizedQuery = query.trim().toLowerCase();
  const options = variableOptions
    .filter((option) => {
      if (!normalizedQuery) return true;

      return [option.alias, option.label]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  const contactOptions = [];
  const eventOptions = [];

  for (const option of options) {
    if (isContactOption(option)) {
      contactOptions.push(option);
    } else {
      eventOptions.push(option);
    }
  }

  const groups = [];

  if (contactOptions.length > 0) {
    groups.push({ label: 'Contact', options: contactOptions });
  }

  if (eventOptions.length > 0) {
    groups.push({
      label: getEventGroupLabel(selectedEvent),
      options: eventOptions,
    });
  }

  return groups;
}

function getVariableOptionDisplayValue(alias, variableOptions) {
  const option = variableOptions.find((item) => item.alias === alias);

  if (!option) return alias;

  return option.label || option.alias;
}

function getEventGroupLabel(selectedEvent) {
  return selectedEvent?.displayName || selectedEvent?.eventKey || 'Event';
}

function isContactOption(option) {
  const alias = String(option?.alias ?? '').toLowerCase();

  return alias.startsWith('contact.') ||
    ['email', 'first_name', 'last_name', 'unsubscribed'].includes(alias);
}
