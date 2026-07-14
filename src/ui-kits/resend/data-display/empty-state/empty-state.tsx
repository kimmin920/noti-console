import { ExternalLink } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Button } from '../../primitives/button';
import darkFallbackSrc from './assets/emails-fallback.webp';
import lightFallbackSrc from './assets/emails-light-fallback.webp';

type EmptyStateRootProps = ComponentPropsWithoutRef<'div'>;
type EmptyStateContentProps = ComponentPropsWithoutRef<'div'>;
type EmptyStateTitleProps = ComponentPropsWithoutRef<'h2'>;
type EmptyStateDescriptionProps = ComponentPropsWithoutRef<'span'>;
type EmptyStateActionsProps = ComponentPropsWithoutRef<'div'>;

type EmptyStateMediaProps = ComponentPropsWithoutRef<'div'> & {
  readonly darkSrc?: string;
  readonly lightSrc?: string;
};

type EmptyStateDocsActionProps = Omit<ComponentPropsWithoutRef<'a'>, 'children' | 'href'> & {
  readonly children?: ReactNode;
  readonly href?: string;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

export function EmptyStateRoot({ className, ...props }: EmptyStateRootProps) {
  return <div className={cx('resend-ui-empty-state', className)} {...props} />;
}

export function EmptyStateContent({ className, ...props }: EmptyStateContentProps) {
  return <div className={cx('resend-ui-empty-state__content', className)} {...props} />;
}

export function EmptyStateMedia({
  className,
  darkSrc = darkFallbackSrc,
  lightSrc = lightFallbackSrc,
  ...props
}: EmptyStateMediaProps) {
  return (
    <div {...props} aria-hidden="true" className={cx('resend-ui-empty-state__media', className)}>
      <div className="resend-ui-empty-state__glow" />
      <div className="resend-ui-empty-state__media-frame">
        <img
          alt=""
          className="resend-ui-empty-state__media-image resend-ui-empty-state__media-image--light"
          draggable={false}
          height={120}
          src={lightSrc}
          width={120}
        />
        <img
          alt=""
          className="resend-ui-empty-state__media-image resend-ui-empty-state__media-image--dark"
          draggable={false}
          height={120}
          src={darkSrc}
          width={120}
        />
      </div>
    </div>
  );
}

export function EmptyStateTitle({ className, ...props }: EmptyStateTitleProps) {
  return <h2 className={cx('resend-ui-empty-state__title', className)} {...props} />;
}

export function EmptyStateDescription({ className, ...props }: EmptyStateDescriptionProps) {
  return <span className={cx('resend-ui-empty-state__description', className)} {...props} />;
}

export function EmptyStateActions({ className, ...props }: EmptyStateActionsProps) {
  return <div className={cx('resend-ui-empty-state__actions', className)} {...props} />;
}

export function EmptyStateDocsAction({
  children = 'Go to docs',
  className,
  href = 'https://resend.com/docs/introduction',
  target = '_blank',
  ...props
}: EmptyStateDocsActionProps) {
  return (
    <Button asChild hasLeadingIcon variant="accent">
      <a
        {...props}
        className={cx('resend-ui-empty-state__action', className)}
        href={href}
        target={target}
      >
        <span className="resend-ui-empty-state__action-icon">
          <ExternalLink aria-hidden="true" size={24} />
        </span>
        {children}
      </a>
    </Button>
  );
}

export function EmailEmptyState(props: EmptyStateRootProps) {
  return (
    <EmptyStateRoot {...props}>
      <EmptyStateContent>
        <EmptyStateMedia />
        <EmptyStateTitle>No sent emails yet</EmptyStateTitle>
        <EmptyStateDescription>
          Start sending emails to see insights and previews for every message.
        </EmptyStateDescription>
        <EmptyStateActions>
          <EmptyStateDocsAction />
        </EmptyStateActions>
      </EmptyStateContent>
    </EmptyStateRoot>
  );
}

export const EmptyState = Object.assign(EmptyStateRoot, {
  Actions: EmptyStateActions,
  Content: EmptyStateContent,
  Description: EmptyStateDescription,
  DocsAction: EmptyStateDocsAction,
  Email: EmailEmptyState,
  Media: EmptyStateMedia,
  Root: EmptyStateRoot,
  Title: EmptyStateTitle,
});

export type {
  EmptyStateActionsProps,
  EmptyStateContentProps,
  EmptyStateDescriptionProps,
  EmptyStateDocsActionProps,
  EmptyStateMediaProps,
  EmptyStateRootProps,
  EmptyStateTitleProps,
};
