import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from 'react';

type ChevronDownIconProps = ComponentPropsWithoutRef<'svg'>;

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

const ChevronDownIcon = forwardRef<ComponentRef<'svg'>, ChevronDownIconProps>(
  function ChevronDownIcon({ className, ...props }, ref) {
    return (
      <svg
        {...props}
        aria-hidden="true"
        className={cx(
          'lucide lucide-chevron-down size-4! text-gray-10',
          'resend-ui-chevron-down-icon',
          className
        )}
        fill="none"
        height="24"
        ref={ref}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        viewBox="0 0 24 24"
        width="24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    );
  }
);

export { ChevronDownIcon };
export type { ChevronDownIconProps };
