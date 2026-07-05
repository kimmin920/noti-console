import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from 'react';

type TextareaProps = Omit<ComponentPropsWithoutRef<'textarea'>, 'aria-invalid'> & {
  readonly invalid?: boolean;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

const Textarea = forwardRef<ComponentRef<'textarea'>, TextareaProps>(function Textarea(
  {
    className,
    invalid = false,
    rows = 4,
    ...props
  },
  ref
) {
  return (
    <textarea
      aria-invalid={invalid}
      className={cx('resend-ui-textarea', className)}
      data-state={invalid ? 'invalid' : undefined}
      ref={ref}
      rows={rows}
      {...props}
    />
  );
});

export { Textarea };
export type { TextareaProps };
