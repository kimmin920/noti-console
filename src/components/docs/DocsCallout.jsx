import { AlertTriangle, CheckCircle2, Info, Lightbulb } from 'lucide-react';

const calloutMeta = {
  info: { icon: Info, label: 'Info' },
  note: { icon: CheckCircle2, label: 'Note' },
  tip: { icon: Lightbulb, label: 'Tip' },
  warning: { icon: AlertTriangle, label: 'Warning' },
};

export function DocsCallout({
  children,
  className = '',
  title,
  variant = 'info',
  ...props
}) {
  const meta = calloutMeta[variant] ?? calloutMeta.info;
  const Icon = meta.icon;

  return (
    <aside
      className={['docs-callout', `docs-callout-${variant}`, className].filter(Boolean).join(' ')}
      role={variant === 'warning' ? 'alert' : 'note'}
      {...props}
    >
      <Icon aria-hidden="true" className="docs-callout-icon" size={17} />
      <div className="docs-callout-content">
        {title ? <strong className="docs-callout-title">{title}</strong> : null}
        <div>{children}</div>
      </div>
    </aside>
  );
}
