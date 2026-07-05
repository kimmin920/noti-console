import { forwardRef } from 'react';

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

export const FormFieldRoot = forwardRef(function FormFieldRoot(
  { action, children, className = '', ...props },
  ref
) {
  return (
    <div
      className={classNames('form-field-root', action ? 'has-action' : '', className)}
      ref={ref}
      {...props}
    >
      {children}
      {action ? <div className="form-field-action">{action}</div> : null}
    </div>
  );
});

export function FormFieldLabel({
  children,
  className = '',
  error,
  muted = false,
  required = false,
  requiredLabel = 'Required',
  warning,
  ...props
}) {
  const LabelElement = props.htmlFor ? 'label' : 'span';
  const message = error || warning;
  const severity = error ? 'error' : warning ? 'warning' : undefined;

  return (
    <LabelElement
      className={classNames('form-field-label', className)}
      data-muted={muted ? 'true' : undefined}
      data-severity={severity}
      {...props}
    >
      <span className="form-field-label-text">{children}</span>
      {required ? (
        <span aria-label={requiredLabel} className="form-field-required" title={requiredLabel}>
          *
        </span>
      ) : null}
      {message ? (
        <span
          aria-label={message}
          className="form-field-affordance"
          data-severity={severity}
          role="img"
        >
          !
        </span>
      ) : null}
    </LabelElement>
  );
}

export const FormFieldControl = forwardRef(function FormFieldControl(
  { children, className = '', ...props },
  ref
) {
  return (
    <div className={classNames('form-field-control', className)} ref={ref} {...props}>
      {children}
    </div>
  );
});

export const FormFieldInput = forwardRef(function FormFieldInput(
  { className = '', ...props },
  ref
) {
  return <input className={classNames('form-field-input', className)} ref={ref} {...props} />;
});

export const FormFieldTextarea = forwardRef(function FormFieldTextarea(
  { className = '', ...props },
  ref
) {
  return <textarea className={classNames('form-field-textarea', className)} ref={ref} {...props} />;
});

export const FormFieldSelect = forwardRef(function FormFieldSelect(
  { className = '', children, ...props },
  ref
) {
  return (
    <select className={classNames('form-field-select', className)} ref={ref} {...props}>
      {children}
    </select>
  );
});

export function FormFieldHelp({ children, className = '', ...props }) {
  return (
    <p className={classNames('form-field-help', className)} {...props}>
      {children}
    </p>
  );
}

export function FormFieldError({ children, className = '', role = 'alert', ...props }) {
  return (
    <p className={classNames('form-field-error', className)} role={role} {...props}>
      {children}
    </p>
  );
}

export function FormFieldCounter({
  children,
  className = '',
  current,
  invalid = false,
  max,
  ...props
}) {
  const content = children ?? [current, max].filter((value) => value !== undefined).join(' / ');

  return (
    <span
      className={classNames('form-field-counter', className)}
      data-invalid={invalid ? 'true' : 'false'}
      {...props}
    >
      {content}
    </span>
  );
}

export const FormField = {
  Control: FormFieldControl,
  Counter: FormFieldCounter,
  Error: FormFieldError,
  FormFieldControl,
  FormFieldCounter,
  FormFieldError,
  FormFieldHelp,
  FormFieldInput,
  FormFieldLabel,
  FormFieldRoot,
  FormFieldSelect,
  FormFieldTextarea,
  Help: FormFieldHelp,
  Input: FormFieldInput,
  Label: FormFieldLabel,
  Root: FormFieldRoot,
  Select: FormFieldSelect,
  Textarea: FormFieldTextarea,
};
