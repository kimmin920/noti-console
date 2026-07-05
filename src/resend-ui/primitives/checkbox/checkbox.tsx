import { Checkbox as RadixCheckbox } from 'radix-ui';
import { Check } from 'lucide-react';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from 'react';

type CheckboxProps = ComponentPropsWithoutRef<typeof RadixCheckbox.Root>;
type CheckboxIndicatorProps = ComponentPropsWithoutRef<typeof RadixCheckbox.Indicator>;

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

const CheckboxIndicator = forwardRef<
  ComponentRef<typeof RadixCheckbox.Indicator>,
  CheckboxIndicatorProps
>(function CheckboxIndicator({ children, className, ...props }, ref) {
  return (
    <RadixCheckbox.Indicator
      className={cx('resend-ui-checkbox__indicator', className)}
      ref={ref}
      {...props}
    >
      {children ?? <Check aria-hidden="true" size={12} strokeWidth={2} />}
    </RadixCheckbox.Indicator>
  );
});

const Checkbox = forwardRef<ComponentRef<typeof RadixCheckbox.Root>, CheckboxProps>(
  function Checkbox({ children, className, ...props }, ref) {
    return (
      <RadixCheckbox.Root
        className={cx('resend-ui-checkbox', className)}
        ref={ref}
        {...props}
      >
        {children ?? <CheckboxIndicator />}
      </RadixCheckbox.Root>
    );
  }
);

export { Checkbox, CheckboxIndicator };
export type { CheckboxIndicatorProps, CheckboxProps };
