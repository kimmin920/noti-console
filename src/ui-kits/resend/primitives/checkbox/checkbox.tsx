import { Checkbox as RadixCheckbox } from 'radix-ui';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from 'react';
import { useFormFieldContext } from '../form-field/form-field';

type CheckboxProps = ComponentPropsWithoutRef<typeof RadixCheckbox.Root> & {
  readonly indeterminate?: boolean | undefined;
};
type CheckboxIndicatorProps = ComponentPropsWithoutRef<typeof RadixCheckbox.Indicator> & {
  readonly indeterminate?: boolean | undefined;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

const CheckboxIndicator = forwardRef<
  ComponentRef<typeof RadixCheckbox.Indicator>,
  CheckboxIndicatorProps
>(function CheckboxIndicator({ children, className, indeterminate = false, ...props }, ref) {
  return (
    <RadixCheckbox.Indicator
      className={cx('resend-ui-checkbox__indicator', className)}
      ref={ref}
      {...props}
    >
      {children ?? (
        <CheckboxStateIcon forceIndeterminate={indeterminate} />
      )}
    </RadixCheckbox.Indicator>
  );
});

const Checkbox = forwardRef<ComponentRef<typeof RadixCheckbox.Root>, CheckboxProps>(
  function Checkbox({
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    checked,
    children,
    className,
    id,
    indeterminate = false,
    ...props
  }, ref) {
    const field = useFormFieldContext();
    const checkedState = checked ?? (indeterminate ? 'indeterminate' : undefined);
    const checkedProps = checkedState === undefined ? {} : { checked: checkedState };

    return (
      <RadixCheckbox.Root
        {...checkedProps}
        aria-describedby={ariaDescribedBy ?? (field?.invalid ? field.messageId : undefined)}
        aria-invalid={ariaInvalid ?? field?.invalid}
        className={cx('resend-ui-checkbox', className)}
        id={id ?? field?.controlId}
        ref={ref}
        {...props}
      >
        {children ?? <CheckboxIndicator />}
      </RadixCheckbox.Root>
    );
  }
);

function CheckboxStateIcon({ forceIndeterminate = false }: { readonly forceIndeterminate?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      data-force-indeterminate={forceIndeterminate ? '' : undefined}
      fill="none"
      height={19}
      viewBox="0 0 24 24"
      width={19}
      xmlns="http://www.w3.org/2000/svg"
    >
      {!forceIndeterminate ? (
        <path
          className="resend-ui-checkbox__check-path"
          d="M20 6 9 17l-5-5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      ) : null}
      <path
        className="resend-ui-checkbox__minus-path"
        d="M8 12 L16 12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

export { Checkbox, CheckboxIndicator };
export type { CheckboxIndicatorProps, CheckboxProps };
