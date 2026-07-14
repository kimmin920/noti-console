import type { ComponentPropsWithoutRef } from 'react';

type CardRootProps = ComponentPropsWithoutRef<'div'> & {
  readonly as?: 'article' | 'div' | 'section';
  readonly radius?: '2xl' | '3xl';
};
type CardBodyProps = ComponentPropsWithoutRef<'div'>;

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

function CardRoot({ as: Component = 'div', className, radius = '2xl', ...props }: CardRootProps) {
  return <Component className={cx('resend-ui-card', className)} data-radius={radius} {...props} />;
}

function CardBody({ className, ...props }: CardBodyProps) {
  return <div className={cx('resend-ui-card__body', className)} {...props} />;
}

const Card = { Body: CardBody, Root: CardRoot };

export { Card, CardBody, CardRoot };
export type { CardBodyProps, CardRootProps };
