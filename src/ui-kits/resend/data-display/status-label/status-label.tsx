import type { ComponentPropsWithoutRef } from 'react';

type StatusLabelProps = ComponentPropsWithoutRef<'span'> & {
  readonly tooltipTrigger?: boolean;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

export function StatusLabel({
  className,
  tooltipTrigger = true,
  ...props
}: StatusLabelProps) {
  return (
    <span
      className={cx('resend-ui-status-label', className)}
      data-base-ui-tooltip-trigger={tooltipTrigger ? '' : undefined}
      {...props}
    />
  );
}

export type { StatusLabelProps };
