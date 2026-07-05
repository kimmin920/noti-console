import { ChevronDown } from 'lucide-react';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from 'react';

type FilterButtonPopupType = 'dialog' | 'menu';

type FilterButtonProps = ComponentPropsWithoutRef<'button'> & {
  readonly expanded?: boolean;
  readonly popupType?: FilterButtonPopupType;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

const FilterButton = forwardRef<ComponentRef<'button'>, FilterButtonProps>(function FilterButton(
  {
    children,
    className,
    disabled = false,
    expanded = false,
    popupType = 'menu',
    type = 'button',
    ...props
  },
  ref
) {
  return (
    <button
      aria-expanded={expanded}
      aria-haspopup={popupType}
      className={cx('resend-ui-filter-button', className)}
      data-state={expanded ? 'open' : 'normal'}
      disabled={disabled}
      ref={ref}
      type={type}
      {...props}
    >
      <span className="resend-ui-filter-button__loading" aria-hidden="true">
        <span className="resend-ui-filter-button__loading-dots">
          <span />
          <span />
          <span />
        </span>
      </span>
      <span className="resend-ui-filter-button__content">{children}</span>
      <span className="resend-ui-filter-button__icon">
        <ChevronDown aria-hidden="true" size={16} />
      </span>
    </button>
  );
});

export { FilterButton };
export type { FilterButtonPopupType, FilterButtonProps };
