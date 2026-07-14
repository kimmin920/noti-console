import { forwardRef } from 'react';

import {
  FormField as ResendFormField,
  FormLabel,
  FormMessage,
} from '../../ui-kits/resend/primitives/form-field';
import { Input } from '../../ui-kits/resend/primitives/input';
import { Textarea } from '../../ui-kits/resend/primitives/textarea';
import { Text } from '../../ui-kits/resend/primitives/typography';

function cx(...values) {
  return values.filter(Boolean).join(' ');
}

export const AppFormFieldRoot = forwardRef(function AppFormFieldRoot(
  { action, children, className = '', ...props },
  ref
) {
  return (
    <ResendFormField className={cx(action && 'app-rui-form-field--has-action', className)} ref={ref} {...props}>
      {children}
      {action ? <div className="app-rui-form-field__action">{action}</div> : null}
    </ResendFormField>
  );
});

export function AppFormFieldLabel({
  children,
  error,
  muted = false,
  required = false,
  requiredLabel = 'Required',
  warning,
  ...props
}) {
  const message = error || warning;
  return (
    <FormLabel data-muted={muted ? '' : undefined} data-severity={error ? 'error' : warning ? 'warning' : undefined} {...props}>
      {children}
      {required ? <span aria-label={requiredLabel} className="app-rui-form-field__required" title={requiredLabel}>*</span> : null}
      {message ? <span aria-label={message} className="app-rui-form-field__affordance" role="img">!</span> : null}
    </FormLabel>
  );
}

export const AppFormFieldControl = forwardRef(function AppFormFieldControl(
  { children, className = '', ...props },
  ref
) {
  return <div className={cx('app-rui-form-field__control', className)} ref={ref} {...props}>{children}</div>;
});

export const AppFormFieldInput = Input;
export const AppFormFieldTextarea = Textarea;

export const AppFormFieldSelect = forwardRef(function AppFormFieldSelect(
  { children, className = '', ...props },
  ref
) {
  return <select className={cx('resend-ui-input', 'app-rui-native-select', className)} ref={ref} {...props}>{children}</select>;
});

export function AppFormFieldHelp({ children, className = '', ...props }) {
  return <Text as="p" className={className} color="gray" size="2" {...props}>{children}</Text>;
}

export function AppFormFieldError({ children, ...props }) {
  return <FormMessage {...props}>{children}</FormMessage>;
}

export function AppFormFieldCounter({ children, current, invalid = false, max, ...props }) {
  const content = children ?? [current, max].filter((value) => value !== undefined).join(' / ');
  return <Text color={invalid ? 'red' : 'gray'} size="1" {...props}>{content}</Text>;
}

export const AppFormField = {
  Control: AppFormFieldControl,
  Counter: AppFormFieldCounter,
  Error: AppFormFieldError,
  Help: AppFormFieldHelp,
  Input: AppFormFieldInput,
  Label: AppFormFieldLabel,
  Root: AppFormFieldRoot,
  Select: AppFormFieldSelect,
  Textarea: AppFormFieldTextarea,
  FormFieldControl: AppFormFieldControl,
  FormFieldCounter: AppFormFieldCounter,
  FormFieldError: AppFormFieldError,
  FormFieldHelp: AppFormFieldHelp,
  FormFieldInput: AppFormFieldInput,
  FormFieldLabel: AppFormFieldLabel,
  FormFieldRoot: AppFormFieldRoot,
  FormFieldSelect: AppFormFieldSelect,
  FormFieldTextarea: AppFormFieldTextarea,
};
