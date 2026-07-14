import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from 'react';
import { ChevronDownIcon } from '../chevron-down-icon';

type SelectTriggerMaxWidth = '200' | 'none';

type SelectTriggerProps = ComponentPropsWithoutRef<'button'> & {
  readonly maxWidth?: SelectTriggerMaxWidth;
  readonly open?: boolean;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

const SelectTrigger = forwardRef<ComponentRef<'button'>, SelectTriggerProps>(function SelectTrigger({
  children,
  className,
  disabled = false,
  maxWidth = '200',
  open = false,
  type = 'button',
  ...props
}, ref) {
  return (
    <button
      aria-autocomplete="none"
      aria-expanded={open}
      aria-haspopup="dialog"
      className={cx(
        'resend-ui-select-trigger',
        maxWidth === 'none' && 'resend-ui-select-trigger--max-none',
        className
      )}
      data-state={open ? 'open' : 'closed'}
      disabled={disabled}
      role="combobox"
      ref={ref}
      type={type}
      {...props}
    >
      <span className="resend-ui-select-trigger__label">{children}</span>
      <span className="resend-ui-select-trigger__icon">
        <ChevronDownIcon />
      </span>
    </button>
  );
});

export { SelectTrigger };

export type { SelectTriggerMaxWidth, SelectTriggerProps };
