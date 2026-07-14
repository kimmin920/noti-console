import { Slot } from '@radix-ui/react-slot';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type MouseEvent,
} from 'react';

type ButtonVariant = 'accent' | 'interactive';

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  readonly asChild?: boolean;
  readonly hasLeadingIcon?: boolean;
  readonly helpKeySpacing?: boolean;
  readonly variant?: ButtonVariant;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

const Button = forwardRef<ComponentRef<'button'>, ButtonProps>(function Button({
  asChild = false,
  className,
  disabled = false,
  hasLeadingIcon = false,
  helpKeySpacing = false,
  onClick,
  tabIndex,
  type = 'button',
  variant = 'interactive',
  ...props
}, ref) {
  const buttonClassName = cx(
    'resend-ui-button',
    `resend-ui-button--${variant}`,
    hasLeadingIcon && 'resend-ui-button--has-leading-icon',
    helpKeySpacing && 'resend-ui-button--help-key',
    className
  );

  if (asChild) {
    return (
      <Slot
        {...props}
        aria-disabled={disabled || undefined}
        className={buttonClassName}
        data-disabled={disabled ? '' : undefined}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event as MouseEvent<HTMLButtonElement>);
        }}
        ref={ref}
        tabIndex={disabled ? -1 : tabIndex}
      />
    );
  }

  return (
    <button
      className={buttonClassName}
      disabled={disabled}
      onClick={onClick}
      ref={ref}
      type={type}
      {...props}
    />
  );
});

export { Button };

export type { ButtonProps, ButtonVariant };
