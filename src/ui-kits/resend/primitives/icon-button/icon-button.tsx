import {
  forwardRef,
  type ComponentRef,
  type ReactNode,
} from 'react';
import { Button, type ButtonProps } from '../button';

type IconButtonProps = Omit<ButtonProps, 'children' | 'hasLeadingIcon' | 'helpKeySpacing' | 'variant'> & {
  readonly icon: ReactNode;
  readonly label: string;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

const IconButton = forwardRef<ComponentRef<'button'>, IconButtonProps>(function IconButton({
  className,
  icon,
  label,
  type = 'button',
  ...props
}, ref) {
  return (
    <Button
      aria-label={label}
      className={cx('resend-ui-icon-button', className)}
      ref={ref}
      type={type}
      variant="interactive"
      {...props}
    >
      <span className="resend-ui-icon-button__content">
        <span aria-hidden="true" className="resend-ui-icon-button__icon">
          {icon}
        </span>
        <span className="resend-ui-icon-button__label">{label}</span>
      </span>
    </Button>
  );
});

export { IconButton };

export type { IconButtonProps };
