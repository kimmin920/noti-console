import { CopyButton } from './CopyButton.jsx';

export function CopyableSlot({
  className = '',
  label,
  value,
  ...props
}) {
  return (
    <div className={['copyable-slot', className].filter(Boolean).join(' ')} {...props}>
      {label ? <span className="copyable-slot-label">{label}</span> : null}
      <code>{value}</code>
      <CopyButton value={value} />
    </div>
  );
}
