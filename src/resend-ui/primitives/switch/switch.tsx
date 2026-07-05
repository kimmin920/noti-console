import { Switch as RadixSwitch } from 'radix-ui';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from 'react';

type SwitchProps = ComponentPropsWithoutRef<typeof RadixSwitch.Root>;
type SwitchThumbProps = ComponentPropsWithoutRef<typeof RadixSwitch.Thumb>;

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

const SwitchThumb = forwardRef<ComponentRef<typeof RadixSwitch.Thumb>, SwitchThumbProps>(
  function SwitchThumb({ className, ...props }, ref) {
    return (
      <RadixSwitch.Thumb
        className={cx('resend-ui-switch__thumb', className)}
        ref={ref}
        {...props}
      />
    );
  }
);

const Switch = forwardRef<ComponentRef<typeof RadixSwitch.Root>, SwitchProps>(
  function Switch({ children, className, ...props }, ref) {
    return (
      <RadixSwitch.Root
        className={cx('resend-ui-switch', className)}
        ref={ref}
        {...props}
      >
        {children ?? <SwitchThumb />}
      </RadixSwitch.Root>
    );
  }
);

export { Switch, SwitchThumb };
export type { SwitchProps, SwitchThumbProps };
