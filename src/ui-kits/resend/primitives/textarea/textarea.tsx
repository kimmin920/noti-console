import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from 'react';
import { useFormFieldContext } from '../form-field/form-field';

type TextareaProps = ComponentPropsWithoutRef<'textarea'> & {
  readonly invalid?: boolean;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

const Textarea = forwardRef<ComponentRef<'textarea'>, TextareaProps>(function Textarea(
  {
    className,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    id,
    invalid,
    rows = 4,
    ...props
  },
  ref
) {
  const field = useFormFieldContext();
  const resolvedInvalid = invalid ?? field?.invalid ?? false;
  return (
    <textarea
      aria-describedby={ariaDescribedBy ?? (resolvedInvalid ? field?.messageId : undefined)}
      aria-invalid={ariaInvalid ?? resolvedInvalid}
      className={cx('resend-ui-textarea', className)}
      data-state={resolvedInvalid ? 'invalid' : undefined}
      id={id ?? field?.controlId}
      ref={ref}
      rows={rows}
      {...props}
    />
  );
});

export { Textarea };
export type { TextareaProps };
