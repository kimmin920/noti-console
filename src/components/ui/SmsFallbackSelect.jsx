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

export const defaultSmsFallbackSenderNumbers = [
  { label: '1544-0000', value: '1544-0000' },
  { label: '02-1234-5678', value: '02-1234-5678' },
];

function getFallbackSenderNumberOption(options, value) {
  return options.find((option) => option.value === value) ?? null;
}

export function SmsFallbackSelect({
  ariaLabel = 'SMS 대체 발신번호 선택',
  className = '',
  createLabel = '발신번호 추가하기',
  description = '카카오톡 메시지 실패 시 SMS로 대체 발송하려면 승인된 발신번호가 필요합니다.',
  enabled,
  noneLabel = '사용 안함',
  onCreateSenderNumber,
  onValueChange,
  options = defaultSmsFallbackSenderNumbers,
  placeholderLabel = '발신번호 선택',
  value,
}) {
  const selected = useMemo(() => getFallbackSenderNumberOption(options, value), [options, value]);
  const triggerLabel = enabled ? selected?.label ?? placeholderLabel : noneLabel;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={ariaLabel}
          className={['email-send-form-select', className].filter(Boolean).join(' ')}
          type="button"
        >
          <span className={!enabled || !selected ? 'email-send-form-placeholder' : ''}>
            {triggerLabel}
          </span>
          <ChevronDown aria-hidden="true" size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="email-send-form-select-menu sms-fallback-menu">
        <DropdownMenuItem
          className="email-send-form-select-item"
          onSelect={() => onValueChange?.({ enabled: false, value })}
        >
          <span>{noneLabel}</span>
          {!enabled ? <Check aria-hidden="true" size={14} /> : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.length ? (
          <>
            <DropdownMenuLabel>발신번호</DropdownMenuLabel>
            {options.map((option) => (
              <DropdownMenuItem
                className="email-send-form-select-item"
                key={option.value}
                onSelect={() => onValueChange?.({ enabled: true, value: option.value })}
              >
                <span>{option.label}</span>
                {enabled && option.value === value ? <Check aria-hidden="true" size={14} /> : null}
              </DropdownMenuItem>
            ))}
          </>
        ) : (
          <>
            {description ? <p className="sms-fallback-help">{description}</p> : null}
            {createLabel ? (
              <DropdownMenuItem
                className="sms-fallback-create"
                onSelect={(event) => {
                  if (onCreateSenderNumber) {
                    event.preventDefault();
                    onCreateSenderNumber();
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
