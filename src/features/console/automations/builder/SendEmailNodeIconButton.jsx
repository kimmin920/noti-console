'use client';

import { cx } from './shared.js';

export function SendEmailNodeIconButton({
  className = '',
  icon,
  label,
  type = 'button',
  ...props
}) {
  return (
    <button
      aria-label={label}
      className={cx('resend-ui-domain-automation-send-email-node__icon-button', className)}
      type={type}
      {...props}
    >
      <span className="resend-ui-domain-automation-send-email-node__icon-button-content">
        {icon}
      </span>
    </button>
  );
}
