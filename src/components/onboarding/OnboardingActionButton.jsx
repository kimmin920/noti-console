'use client';

import { forwardRef } from 'react';

import styles from './onboarding.module.css';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export const OnboardingActionButton = forwardRef(function OnboardingActionButton(
  {
    children,
    className = '',
    disabled = false,
    href,
    icon: Icon,
    trailingIcon: TrailingIcon,
    type = 'button',
    variant = 'secondary',
    ...props
  },
  ref
) {
  const variantClass = variant === 'primary' ? 'resend-ui-button--accent' : 'resend-ui-button--interactive';
  const classNames = cx(
    'resend-ui-button',
    variantClass,
    Icon && 'resend-ui-button--has-leading-icon',
    styles.actionButton,
    variant === 'primary' && styles.actionButtonPrimary,
    className
  );
  const content = (
    <>
      {Icon ? <Icon aria-hidden="true" size={16} strokeWidth={1.8} /> : null}
      <span className={styles.actionButtonLabel}>{children}</span>
      {TrailingIcon ? <TrailingIcon aria-hidden="true" size={16} strokeWidth={1.8} /> : null}
    </>
  );

  if (href && !disabled) {
    return (
      <a className={classNames} data-variant={variant} href={href} ref={ref} {...props}>
        {content}
      </a>
    );
  }

  return (
    <button className={classNames} data-disabled={disabled ? true : undefined} data-variant={variant} disabled={disabled} ref={ref} type={type} {...props}>
      {content}
    </button>
  );
});
