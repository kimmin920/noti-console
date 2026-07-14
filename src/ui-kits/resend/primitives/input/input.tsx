import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from 'react';
import { useFormFieldContext } from '../form-field/form-field';

type InputProps = ComponentPropsWithoutRef<'input'> & {
  readonly invalid?: boolean;
  readonly onePasswordIgnore?: boolean;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

const Input = forwardRef<ComponentRef<'input'>, InputProps>(function Input(
  {
    className,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    id,
    invalid,
    onePasswordIgnore = true,
    readOnly = false,
    ...props
  },
  ref
) {
  const field = useFormFieldContext();
  const resolvedInvalid = invalid ?? field?.invalid ?? false;
  const dataState = resolvedInvalid ? 'invalid' : readOnly ? 'read-only' : undefined;

  return (
    <input
      aria-describedby={ariaDescribedBy ?? (resolvedInvalid ? field?.messageId : undefined)}
      aria-invalid={ariaInvalid ?? resolvedInvalid}
      className={cx('resend-ui-input', className)}
      data-1p-ignore={String(onePasswordIgnore)}
      data-state={dataState}
      id={id ?? field?.controlId}
      readOnly={readOnly}
      ref={ref}
      {...props}
    />
  );
});

export { Input };
export type { InputProps };
