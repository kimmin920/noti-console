'use client';

import { forwardRef, useEffect, useId, useRef } from 'react';

function setRef(ref, value) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }

  if (ref) {
    ref.current = value;
  }
}

export const Checkbox = forwardRef(function Checkbox(
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
  const inputId = id ?? generatedId;
  const captionId = `${inputId}-caption`;
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const input = (
    <input
      aria-checked={indeterminate ? 'mixed' : undefined}
      aria-describedby={caption ? [ariaDescribedBy, captionId].filter(Boolean).join(' ') : ariaDescribedBy}
      className="checkbox-input"
      id={inputId}
      onChange={(event) => {
        onChange?.(event);
        onCheckedChange?.(event.target.checked);
      }}
      ref={(node) => {
        inputRef.current = node;
        setRef(ref, node);
      }}
      type="checkbox"
      {...props}
    />
  );

  if (!label && !caption) {
    return input;
  }

  return (
    <div className={['checkbox-field', className].filter(Boolean).join(' ')}>
      {input}
      <div className="checkbox-copy">
        {label ? <label htmlFor={inputId}>{label}</label> : null}
        {caption ? <p id={captionId}>{caption}</p> : null}
      </div>
    </div>
  );
});
