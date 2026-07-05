import { forwardRef } from 'react';

export function TextFieldRoot({ children, className = '', ...props }) {
  return (
    <div className={['text-field-root', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}

export function TextFieldSlot({ children, className = '', ...props }) {
  return (
    <span className={['text-field-slot', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </span>
  );
}

export const TextFieldInput = forwardRef(function TextFieldInput(
  { className = '', ...props },
  ref
) {
  return <input className={['text-field-input', className].filter(Boolean).join(' ')} ref={ref} {...props} />;
});

export const TextField = {
  Input: TextFieldInput,
  Root: TextFieldRoot,
  Slot: TextFieldSlot,
};
