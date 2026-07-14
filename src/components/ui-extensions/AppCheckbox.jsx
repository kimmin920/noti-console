'use client';

import { forwardRef, useId } from 'react';

import { Checkbox as ResendCheckbox } from '../../ui-kits/resend/primitives/checkbox';

export const AppCheckbox = forwardRef(function AppCheckbox(
  {
    caption,
    className = '',
    id,
    indeterminate = false,
    label,
    'aria-describedby': ariaDescribedBy,
    onChange,
    onCheckedChange,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const captionId = `${controlId}-caption`;
  const describedBy = caption
    ? [ariaDescribedBy, captionId].filter(Boolean).join(' ')
    : ariaDescribedBy;

  const control = (
    <ResendCheckbox
      aria-describedby={describedBy}
      id={controlId}
      indeterminate={indeterminate}
      onCheckedChange={(checked) => {
        const resolvedChecked = checked === true;
        onCheckedChange?.(resolvedChecked);
        onChange?.({ target: { checked: resolvedChecked } });
      }}
      ref={ref}
      {...props}
    />
  );

  if (!label && !caption) return control;

  return (
    <div className={['app-rui-checkbox-field', className].filter(Boolean).join(' ')}>
      {control}
      <div className="app-rui-checkbox-copy">
        {label ? <label htmlFor={controlId}>{label}</label> : null}
        {caption ? <p id={captionId}>{caption}</p> : null}
      </div>
    </div>
  );
});
