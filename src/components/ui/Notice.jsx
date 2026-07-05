import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Info,
  MinusCircle,
} from 'lucide-react';

const noticeMeta = {
  critical: { icon: CircleAlert },
  info: { icon: Info },
  neutral: { icon: MinusCircle },
  success: { icon: CheckCircle2 },
  warning: { icon: AlertTriangle },
};

export function Notice({
  action,
  children,
  className = '',
  icon: IconProp,
  role: roleProp,
  title,
  urgent,
  variant = 'info',
  ...props
}) {
  const resolvedVariant = noticeMeta[variant] ? variant : 'info';
  const Icon = IconProp ?? noticeMeta[resolvedVariant].icon;
  const shouldAlert = urgent ?? (resolvedVariant === 'critical' || resolvedVariant === 'warning');
  const role = roleProp ?? (shouldAlert ? 'alert' : 'note');

  return (
    <aside
      className={['notice', `notice-${resolvedVariant}`, className].filter(Boolean).join(' ')}
      data-variant={resolvedVariant}
      role={role}
      {...props}
    >
      {Icon ? (
        <span className="notice-icon" aria-hidden="true">
          <Icon size={17} strokeWidth={1.9} />
        </span>
      ) : null}
      <div className="notice-body">
        {title ? <strong className="notice-title">{title}</strong> : null}
        {children ? <div className="notice-content">{children}</div> : null}
      </div>
      {action ? <div className="notice-action">{action}</div> : null}
    </aside>
  );
}
