import { Card } from '../../ui-kits/resend/primitives/card';

export function AppPanel({ children, className = '', padded = true, ...props }) {
  return (
    <Card.Root
      as="section"
      className={['panel', padded && 'panel-padded', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </Card.Root>
  );
}
