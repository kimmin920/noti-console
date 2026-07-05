'use client';

import { forwardRef } from 'react';

import { cx } from '../shared.js';

export const ResendButton = forwardRef(function ResendButton(
  {
    className = '',
    disabled = false,
    hasLeadingIcon = false,
    helpKeySpacing = false,
    type = 'button',
    variant = 'interactive',
    ...props
  },
  ref
) {
  return (
    <button
      className={cx(
        'resend-ui-button',
        `resend-ui-button--${variant}`,
        hasLeadingIcon && 'resend-ui-button--has-leading-icon',
        helpKeySpacing && 'resend-ui-button--help-key',
        className
      )}
      disabled={disabled}
      ref={ref}
      type={type}
      {...props}
    />
  );
});
