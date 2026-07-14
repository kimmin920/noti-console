import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type ReactNode,
} from 'react';

type PageHeaderActionsProps = ComponentPropsWithoutRef<'div'>;

type PageHeaderPrimaryLinkProps = Omit<ComponentPropsWithoutRef<'a'>, 'children'> & {
  readonly children: ReactNode;
};

type PageHeaderPrimaryButtonProps = Omit<ComponentPropsWithoutRef<'button'>, 'children'> & {
  readonly children: ReactNode;
};

type PageHeaderApiActionProps = Omit<ComponentPropsWithoutRef<'button'>, 'aria-label' | 'children'> & {
  readonly label?: string;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

function LoadingDots({ variant }: { readonly variant: 'accent' | 'interactive' }) {
  return (
    <span className="resend-ui-page-header-actions__loading-dots">
      <span className={`resend-ui-page-header-actions__loading-dot resend-ui-page-header-actions__loading-dot--${variant}`} />
      <span className={`resend-ui-page-header-actions__loading-dot resend-ui-page-header-actions__loading-dot--${variant}`} />
      <span className={`resend-ui-page-header-actions__loading-dot resend-ui-page-header-actions__loading-dot--${variant}`} />
    </span>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="lucide lucide-plus"
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function ApiPlaceholderIcon() {
  return <div aria-hidden="true" className="resend-ui-page-header-actions__api-icon" />;
}

const PageHeaderActions = forwardRef<ComponentRef<'div'>, PageHeaderActionsProps>(function PageHeaderActions({
  className,
  ...props
}, ref) {
  return (
    <div
      className={cx('resend-ui-page-header-actions', className)}
      data-resend-page-header-actions
      ref={ref}
      {...props}
    />
  );
});

const PageHeaderPrimaryLink = forwardRef<ComponentRef<'a'>, PageHeaderPrimaryLinkProps>(function PageHeaderPrimaryLink({
  children,
  className,
  ...props
}, ref) {
  return (
    <a
      className={cx('resend-ui-page-header-primary-action', className)}
      data-resend-page-header-primary-action
      ref={ref}
      {...props}
    >
      <span aria-hidden="true" className="resend-ui-page-header-primary-action__icon">
        <PlusIcon />
      </span>
      {children}
    </a>
  );
});

const PageHeaderPrimaryButton = forwardRef<ComponentRef<'button'>, PageHeaderPrimaryButtonProps>(function PageHeaderPrimaryButton({
  children,
  className,
  disabled = false,
  type = 'button',
  ...props
}, ref) {
  return (
    <button
      className={cx('resend-ui-page-header-primary-action', 'resend-ui-page-header-primary-action--button', className)}
      data-disabled={disabled ? '' : undefined}
      data-resend-page-header-primary-action
      data-state="normal"
      disabled={disabled}
      ref={ref}
      type={type}
      {...props}
    >
      <span
        aria-hidden="true"
        className="resend-ui-page-header-actions__loading resend-ui-page-header-actions__loading--full"
        data-resend-page-header-primary-loading
      >
        <LoadingDots variant="accent" />
      </span>
      <span aria-hidden="true" className="resend-ui-page-header-primary-action__icon">
        <PlusIcon />
      </span>
      <span className="resend-ui-page-header-primary-action__label">{children}</span>
    </button>
  );
});

const PageHeaderApiAction = forwardRef<ComponentRef<'button'>, PageHeaderApiActionProps>(function PageHeaderApiAction({
  className,
  disabled = false,
  label = 'Open API drawer',
  type = 'button',
  ...props
}, ref) {
  return (
    <button
      aria-label={label}
      className={cx('resend-ui-page-header-api-action', className)}
      data-base-ui-tooltip-trigger=""
      data-disabled={disabled ? '' : undefined}
      data-resend-page-header-api-action
      data-state="normal"
      disabled={disabled}
      ref={ref}
      type={type}
      {...props}
    >
      <span
        aria-hidden="true"
        className="resend-ui-page-header-actions__loading"
        data-resend-page-header-api-loading
      >
        <LoadingDots variant="interactive" />
      </span>
      <span className="resend-ui-page-header-api-action__content">
        <ApiPlaceholderIcon />
      </span>
    </button>
  );
});

export {
  PageHeaderActions,
  PageHeaderApiAction,
  PageHeaderPrimaryButton,
  PageHeaderPrimaryLink,
};

export type {
  PageHeaderActionsProps,
  PageHeaderApiActionProps,
  PageHeaderPrimaryButtonProps,
  PageHeaderPrimaryLinkProps,
};
