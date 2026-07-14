import { createElement, forwardRef, isValidElement } from 'react';

import { Button as ResendButton } from '../../ui-kits/resend/primitives/button';

export const AppIconButton = forwardRef(function AppIconButton(
  { className = '', icon, label, title = label, ...props },
  ref
) {
  const iconNode = isValidElement(icon)
    ? icon
    : icon
      ? createElement(icon, { size: 16, strokeWidth: 1.8 })
      : null;

  return (
    <ResendButton
      aria-label={label}
      className={['app-rui-icon-button', className].filter(Boolean).join(' ')}
      ref={ref}
      title={title}
      variant="interactive"
      {...props}
    >
      <span aria-hidden="true" className="app-rui-icon-button__icon">{iconNode}</span>
    </ResendButton>
  );
});
