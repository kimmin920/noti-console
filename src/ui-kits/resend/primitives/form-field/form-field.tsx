import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type ReactNode,
} from 'react';

type FormFieldContextValue = {
  readonly controlId: string;
  readonly invalid: boolean;
  readonly labelId: string;
  readonly messageId: string;
};
type FormFieldProps = ComponentPropsWithoutRef<'div'> & {
  readonly controlId?: string;
  readonly invalid?: boolean;
  readonly labelId?: string;
  readonly messageId?: string;
};
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

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

function useFormFieldContext() {
  return useContext(FormFieldContext);
}

const FormField = forwardRef<ComponentRef<'div'>, FormFieldProps>(function FormField(
  {
    children,
    className,
    controlId,
    invalid = false,
    labelId,
    messageId,
    ...props
  },
  ref
) {
  const generatedId = useId().replaceAll(':', '');
  const context = {
    controlId: controlId ?? `resend-ui-field-${generatedId}-control`,
    invalid,
    labelId: labelId ?? `resend-ui-field-${generatedId}-label`,
    messageId: messageId ?? `resend-ui-field-${generatedId}-message`,
  };

  return (
    <FormFieldContext.Provider value={context}>
      <div
        className={cx('resend-ui-form-field', className)}
        data-invalid={invalid ? '' : undefined}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    </FormFieldContext.Provider>
  );
});

const FormLabel = forwardRef<ComponentRef<'label'>, FormLabelProps>(function FormLabel(
  {
    children,
    className,
    description,
    htmlFor,
    id,
    ...props
  },
  ref
) {
  const field = useFormFieldContext();
  return (
    <label
      className={cx('resend-ui-form-label', className)}
      htmlFor={htmlFor ?? field?.controlId}
      id={id ?? field?.labelId}
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
    id,
    message,
    role = 'alert',
    ...props
  },
  ref
) {
  const field = useFormFieldContext();
  const content = message ?? children;
  if (!content) return null;

  return (
    <p
      className={cx('resend-ui-form-message', className)}
      id={id ?? field?.messageId}
      ref={ref}
      role={role}
      {...props}
    >
      {content}
    </p>
  );
});

export { FormField, FormLabel, FormMessage, useFormFieldContext };
export type { FormFieldProps, FormLabelProps, FormMessageProps };
