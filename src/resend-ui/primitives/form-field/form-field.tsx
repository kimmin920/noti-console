import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type ReactNode,
} from 'react';

type FormFieldProps = ComponentPropsWithoutRef<'div'>;
type FormLabelProps = ComponentPropsWithoutRef<'label'> & {
  readonly description?: ReactNode;
};
type FormMessageProps = Omit<ComponentPropsWithoutRef<'p'>, 'children'> & {
  readonly children?: ReactNode;
  readonly message?: ReactNode;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

const FormField = forwardRef<ComponentRef<'div'>, FormFieldProps>(function FormField(
  { className, ...props },
  ref
) {
  return (
    <div
      className={cx('resend-ui-form-field', className)}
      ref={ref}
      {...props}
    />
  );
});

const FormLabel = forwardRef<ComponentRef<'label'>, FormLabelProps>(function FormLabel(
  {
    children,
    className,
    description,
    ...props
  },
  ref
) {
  return (
    <label
      className={cx('resend-ui-form-label', className)}
      ref={ref}
      {...props}
    >
      <span className="resend-ui-form-label__text">{children}</span>
      {description ? (
        <span className="resend-ui-form-label__description">{description}</span>
      ) : null}
    </label>
  );
});

const FormMessage = forwardRef<ComponentRef<'p'>, FormMessageProps>(function FormMessage(
  {
    className,
    children,
    message,
    role = 'alert',
    ...props
  },
  ref
) {
  const content = message ?? children;
  if (!content) return null;

  return (
    <p
      className={cx('resend-ui-form-message', className)}
      ref={ref}
      role={role}
      {...props}
    >
      {content}
    </p>
  );
});

export { FormField, FormLabel, FormMessage };
export type { FormFieldProps, FormLabelProps, FormMessageProps };
