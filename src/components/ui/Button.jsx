import { forwardRef } from 'react';

export const Button = forwardRef(function Button(
  { children, className = '', variant = 'secondary', type = 'button', ...props },
  ref
) {
  return (
    <button className={['button', variant, className].filter(Boolean).join(' ')} ref={ref} type={type} {...props}>
      {children}
    </button>
  );
});
