import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from 'react';

type InputProps = Omit<ComponentPropsWithoutRef<'input'>, 'aria-invalid'> & {
  readonly invalid?: boolean;
  readonly onePasswordIgnore?: boolean;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

const Input = forwardRef<ComponentRef<'input'>, InputProps>(function Input(
  {
    className,
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

export { Input };
export type { InputProps };
