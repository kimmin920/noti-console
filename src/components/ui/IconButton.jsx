import { forwardRef } from 'react';

export const IconButton = forwardRef(function IconButton(
  { className = '', icon: Icon, label, type = 'button', ...props },
  ref
) {
  return (
    <button
      aria-label={label}
      className={['icon-button', className].filter(Boolean).join(' ')}
      ref={ref}
      title={label}
      type={type}
      {...props}
    >
      {Icon ? <Icon size={16} strokeWidth={1.8} /> : null}
    </button>
  );
});
