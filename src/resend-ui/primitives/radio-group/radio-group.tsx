import { RadioGroup as RadixRadioGroup } from 'radix-ui';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from 'react';

type RadioGroupRootProps = ComponentPropsWithoutRef<typeof RadixRadioGroup.Root>;
type RadioGroupItemProps = ComponentPropsWithoutRef<typeof RadixRadioGroup.Item>;
type RadioGroupIndicatorProps = ComponentPropsWithoutRef<typeof RadixRadioGroup.Indicator>;

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

const RadioGroupRoot = forwardRef<ComponentRef<typeof RadixRadioGroup.Root>, RadioGroupRootProps>(
  function RadioGroupRoot({ className, ...props }, ref) {
    return (
      <RadixRadioGroup.Root
        className={cx('resend-ui-radio-group', className)}
        ref={ref}
        {...props}
      />
    );
  }
);

const RadioGroupItem = forwardRef<ComponentRef<typeof RadixRadioGroup.Item>, RadioGroupItemProps>(
  function RadioGroupItem({ className, ...props }, ref) {
    return (
      <RadixRadioGroup.Item
        className={cx('resend-ui-radio-group__item', className)}
        ref={ref}
        {...props}
      />
    );
  }
);

const RadioGroupIndicator = forwardRef<
  ComponentRef<typeof RadixRadioGroup.Indicator>,
  RadioGroupIndicatorProps
>(function RadioGroupIndicator({ className, ...props }, ref) {
  return (
    <RadixRadioGroup.Indicator
      className={cx('resend-ui-radio-group__indicator', className)}
      ref={ref}
      {...props}
    />
  );
});

const RadioGroup = RadioGroupRoot;

export {
  RadioGroup,
  RadioGroupIndicator,
  RadioGroupItem,
  RadioGroupRoot,
};
export type {
  RadioGroupIndicatorProps,
  RadioGroupItemProps,
  RadioGroupRootProps,
};
