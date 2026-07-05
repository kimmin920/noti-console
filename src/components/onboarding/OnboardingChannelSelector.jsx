'use client';

import { Check, CheckCircle2 } from 'lucide-react';
import { useId, useState } from 'react';

import styles from './onboarding.module.css';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function getOptionValue(option) {
  return option.value ?? option.id ?? option.title;
}

function getSelectedOption(options, value) {
  return options.find((option) => getOptionValue(option) === value) ?? options[0] ?? null;
}

function getOptionId(name, value) {
  return `${name}-${String(value).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

export function OnboardingChannelRequirementList({ items = [] }) {
  if (items.length === 0) return null;

  return (
    <ul className={styles.channelRequirementList}>
      {items.map((item) => (
        <li className={styles.channelRequirementItem} key={item}>
          <span className={styles.channelRequirementBullet} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function OnboardingChannelOptionCard({
  name,
  onDetails,
  onSelect,
  option,
  selected = false,
}) {
  const optionValue = getOptionValue(option);
  const optionId = getOptionId(name, optionValue);
  const state = option.disabled ? 'disabled' : selected ? 'selected' : 'idle';

  function handleDetailsClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (option.disabled) return;
    if (onDetails) {
      onDetails(optionValue, option);
      return;
    }
    onSelect?.(optionValue, option);
  }

  return (
    <div className={cx(styles.channelOptionCard, option.disabled && styles.channelOptionCardDisabled)} data-state={state}>
      <input
        checked={selected}
        className={styles.visuallyHidden}
        disabled={option.disabled}
        id={optionId}
        name={name}
        onChange={() => onSelect?.(optionValue, option)}
        type="radio"
        value={optionValue}
      />
      <label className={styles.channelOptionBody} htmlFor={optionId}>
        <span className={styles.channelOptionHeader}>
          <span className={styles.channelOptionTitleGroup}>
            <strong className={styles.channelOptionTitle}>{option.title}</strong>
          </span>
          <span className={styles.channelOptionControl} aria-hidden="true">
            {selected ? <Check size={12} strokeWidth={2.4} /> : null}
          </span>
        </span>
        <span className={styles.channelOptionDescription}>{option.description}</span>
      </label>
      <button className={styles.channelOptionAction} disabled={option.disabled} onClick={handleDetailsClick} type="button">
        {option.actionLabel ?? '자세히 보기'}
      </button>
    </div>
  );
}

export function OnboardingChannelSelector({
  className = '',
  defaultValue,
  label = '처음 보낼 메시지 채널 선택',
  name,
  onDetails,
  onValueChange,
  options = [],
  value,
}) {
  const generatedName = useId();
  const [localValue, setLocalValue] = useState(defaultValue ?? getOptionValue(options[0] ?? {}));
  const selectedValue = value ?? localValue;
  const selectedOption = getSelectedOption(options, selectedValue);
  const groupName = name ?? `onboarding-channel-${generatedName}`;

  function handleSelect(nextValue, option) {
    if (option?.disabled) return;
    if (value === undefined) {
      setLocalValue(nextValue);
    }
    onValueChange?.(nextValue, option);
  }

  if (options.length === 0) return null;

  return (
    <div className={cx(styles.channelSelector, className)} role="radiogroup" aria-label={label} data-selected-channel={getOptionValue(selectedOption ?? {})}>
      {options.map((option) => {
        const optionValue = getOptionValue(option);

        return (
          <OnboardingChannelOptionCard
            key={optionValue}
            name={groupName}
            onDetails={onDetails}
            onSelect={handleSelect}
            option={option}
            selected={optionValue === getOptionValue(selectedOption ?? {})}
          />
        );
      })}
    </div>
  );
}

export function OnboardingChannelSummary({
  className = '',
  option,
}) {
  if (!option) return null;

  return (
    <div className={cx(styles.channelSummary, className)} aria-live="polite">
      <div className={styles.channelSummaryIcon} aria-hidden="true">
        <CheckCircle2 size={16} strokeWidth={2.1} />
      </div>
      <div className={styles.channelSummaryBody}>
        <p className={styles.channelSummaryTitle}>{option.summaryTitle ?? `${option.title}로 시작합니다`}</p>
        <p className={styles.channelSummaryDescription}>{option.summary}</p>
        {option.nextStep ? <p className={styles.channelSummaryNext}>{option.nextStep}</p> : null}
      </div>
    </div>
  );
}
