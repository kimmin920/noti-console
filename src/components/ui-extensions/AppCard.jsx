import { Card as ResendCard } from '../../ui-kits/resend/primitives/card';

export function AppCard({ children, className = '', ...props }) {
  return (
    <ResendCard.Root as="section" className={className} {...props}>
      {children}
    </ResendCard.Root>
  );
}

export function AppCardHeader({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}

export function AppCardTitle({ children, className = '', id }) {
  return <h2 className={className} id={id}>{children}</h2>;
}

export function AppCardCopy({ children, className = '' }) {
  return <ResendCard.Body className={className}>{children}</ResendCard.Body>;
}

export function AppCardActions({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}
