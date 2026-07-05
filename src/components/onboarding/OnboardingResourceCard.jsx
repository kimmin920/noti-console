'use client';

import { ArrowRight } from 'lucide-react';

import styles from './onboarding.module.css';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function OnboardingResourceCard({
  actionLabel,
  badge,
  className = '',
  description,
  disabled = false,
  href,
  icon: Icon,
  onClick,
  title,
}) {
  const content = (
    <>
      <span className={styles.resourceCardIcon} aria-hidden="true">
        {Icon ? <Icon size={17} strokeWidth={1.8} /> : null}
      </span>
      <span className={styles.resourceCardBody}>
        <span className={styles.resourceCardTitleRow}>
          <span className={styles.resourceCardTitle}>{title}</span>
          {badge ? <span className={styles.resourceCardBadge}>{badge}</span> : null}
        </span>
        {description ? <span className={styles.resourceCardDescription}>{description}</span> : null}
      </span>
      {actionLabel ? <span className={styles.resourceCardAction}>{actionLabel}</span> : null}
      <ArrowRight className={styles.resourceCardArrow} aria-hidden="true" size={16} strokeWidth={1.8} />
    </>
  );
  const classNames = cx(styles.resourceCard, disabled && styles.resourceCardDisabled, className);
  const state = disabled ? 'disabled' : 'idle';

  if (href && !disabled) {
    return (
      <a className={classNames} data-state={state} href={href}>
        {content}
      </a>
    );
  }

  if (onClick && !disabled) {
    return (
      <button className={classNames} data-state={state} onClick={onClick} type="button">
        {content}
      </button>
    );
  }

  return (
    <div aria-disabled={disabled || undefined} className={classNames} data-state={state}>
      {content}
    </div>
  );
}
