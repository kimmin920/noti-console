import { Switch as RadixSwitch } from 'radix-ui';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from 'react';
import { useFormFieldContext } from '../form-field/form-field';

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
  function Switch({
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    children,
    className,
    id,
    ...props
  }, ref) {
    const field = useFormFieldContext();
    return (
      <RadixSwitch.Root
        aria-describedby={ariaDescribedBy ?? (field?.invalid ? field.messageId : undefined)}
        aria-invalid={ariaInvalid ?? field?.invalid}
        className={cx('resend-ui-switch', className)}
        id={id ?? field?.controlId}
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
