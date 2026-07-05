'use client';

import { forwardRef } from 'react';

import { cx } from '../shared.js';

export const ResendInput = forwardRef(function ResendInput(
  {
    className = '',
    invalid = false,
    onePasswordIgnore = true,
    readOnly = false,
    ...props
  },
  ref
) {
  const dataState = invalid ? 'invalid' : readOnly ? 'read-only' : undefined;

  return (
    <input
      aria-invalid={invalid}
      className={cx('resend-ui-input', className)}
      data-1p-ignore={String(onePasswordIgnore)}
      data-state={dataState}
      readOnly={readOnly}
      ref={ref}
      {...props}
    />
  );
});
