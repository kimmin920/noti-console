'use client';

import { useMemo } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu.jsx';

function getOption(options, value) {
  return options.find((option) => option.value === value) ?? null;
}

export function SubscribeTopicSelect({
  ariaLabel = 'Subscribe topic',
  className = '',
  createLabel = 'Create a topic',
  defaultOpen = false,
  description = 'Use Topics with Unsubscribe Page to let users choose the content they want to receive.',
  noneValue = 'none',
  onCreateTopic,
  onValueChange,
  options = [],
  placeholder = 'Select a topic',
  value,
}) {
  const selected = useMemo(() => getOption(options, value), [options, value]);
  const noneOption = useMemo(() => getOption(options, noneValue), [noneValue, options]);
  const topicOptions = useMemo(
    () => options.filter((option) => option.value !== noneValue).sort((a, b) => a.label.localeCompare(b.label)),
    [noneValue, options]
  );
  const isPlaceholder = !selected || selected.value === noneValue;
  const triggerLabel = selected && selected.value !== noneValue ? selected.label : placeholder;

  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={ariaLabel}
          className={['email-send-form-select', className].filter(Boolean).join(' ')}
          type="button"
        >
          <span className={isPlaceholder ? 'email-send-form-placeholder' : ''}>
            {triggerLabel}
          </span>
          <ChevronDown aria-hidden="true" size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="email-send-form-select-menu subscribe-topic-menu">
        <DropdownMenuItem
          className="email-send-form-select-item"
          onSelect={() => onValueChange?.(noneValue)}
        >
          <span>{noneOption?.label ?? 'No topic'}</span>
          {value === noneValue ? <Check aria-hidden="true" size={14} /> : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {topicOptions.length ? (
          <>
            <DropdownMenuLabel>Topics</DropdownMenuLabel>
            {topicOptions.map((option) => (
              <DropdownMenuItem
                className="email-send-form-select-item"
                key={option.value}
                onSelect={() => onValueChange?.(option.value)}
              >
                <span>{option.label}</span>
                {option.value === value ? <Check aria-hidden="true" size={14} /> : null}
              </DropdownMenuItem>
            ))}
          </>
        ) : (
          <>
            {description ? <p className="subscribe-topic-help">{description}</p> : null}
            {createLabel ? (
              <DropdownMenuItem
                className="subscribe-topic-create"
                onSelect={(event) => {
                  if (onCreateTopic) {
                    event.preventDefault();
                    onCreateTopic();
                  }
                }}
              >
                <Plus aria-hidden="true" size={16} />
                <span>{createLabel}</span>
              </DropdownMenuItem>
            ) : null}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
