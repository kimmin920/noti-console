import { AlertCircle, Check, Circle } from 'lucide-react';

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

export function ValidationChecklist({
  'aria-live': ariaLive = 'polite',
  className = '',
  items = [],
  ...props
}) {
  return (
    <ul
      aria-live={ariaLive}
      className={classNames('validation-checklist', className)}
      {...props}
    >
      {items.map((item) => {
        const checked = Boolean(item.checked);
        const hasError = Boolean(item.error);
        const errorLabel = item.errorLabel ?? (typeof item.error === 'string' ? item.error : '');
        const Icon = hasError ? AlertCircle : checked ? Check : Circle;
        const state = hasError ? 'error' : checked ? 'checked' : 'neutral';
        const errorId = hasError && errorLabel ? `${item.id}-error` : undefined;

        return (
          <li
            aria-describedby={errorId}
            data-checked={checked ? 'true' : 'false'}
            data-error={hasError ? 'true' : 'false'}
            data-state={state}
            key={item.id}
          >
            <span className="validation-checklist-icon" aria-hidden="true">
              <Icon size={14} strokeWidth={2} />
            </span>
            <span className="validation-checklist-copy">
              <span className="validation-checklist-label">{item.label}</span>
              {hasError && errorLabel ? (
                <span className="validation-checklist-error" id={errorId}>
                  {errorLabel}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
