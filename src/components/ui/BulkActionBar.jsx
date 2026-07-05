'use client';

import { X } from 'lucide-react';
import { IconButton } from './IconButton.jsx';

export function BulkActionBar({
  children,
  className = '',
  count = 0,
  label = 'selected',
  onDismiss,
}) {
  if (count <= 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className={['bulk-action-bar', className].filter(Boolean).join(' ')}
      role="status"
    >
      <p>
        <strong>{count}</strong>
        {' '}
        {label}
      </p>
      <div className="bulk-action-bar-actions">{children}</div>
      {onDismiss ? <IconButton icon={X} label="선택 해제" onClick={onDismiss} title="" /> : null}
    </div>
  );
}
