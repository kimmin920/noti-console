import { X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createToastRecord, dismissToast, subscribeToToasts } from './toast-store';
import type {
  ToastAppearance,
  ToastCardProps,
  ToastId,
  ToastRecord,
  ToasterProps,
} from './types';

export function Toaster({
  autoDismiss = true,
  className,
  defaultToasts = [],
  onToastsChange,
  position = 'bottom-right',
  toasts,
  visibleToasts = 3,
}: ToasterProps) {
  const [defaultRecords] = useState(() => (
    defaultToasts.map((toast, index) => createToastRecord(toast, `default-${index}`))
  ));
  const [dismissedDefaultIds, setDismissedDefaultIds] = useState<readonly ToastId[]>([]);
  const [storeToasts, setStoreToasts] = useState<readonly ToastRecord[]>([]);
  const renderedToasts = useMemo(() => {
    if (toasts !== undefined) return toasts;
    return [
      ...storeToasts,
      ...defaultRecords.filter((toast) => !dismissedDefaultIds.includes(toast.id)),
    ];
  }, [defaultRecords, dismissedDefaultIds, storeToasts, toasts]);
  const visibleToastRecords = renderedToasts.slice(0, visibleToasts);
  const positionName = position;

  useEffect(() => subscribeToToasts(setStoreToasts), []);

  const handleDismiss = useCallback((id: ToastId) => {
    if (toasts !== undefined) {
      onToastsChange?.(toasts.filter((toast) => toast.id !== id));
      return;
    }

    dismissToast(id);
    setDismissedDefaultIds((current) => (
      current.includes(id) ? current : [...current, id]
    ));
  }, [onToastsChange, toasts]);

  useEffect(() => {
    if (!autoDismiss) return undefined;
    const timeoutIds: number[] = [];
    for (const toast of visibleToastRecords) {
      if (Number.isFinite(toast.duration)) {
        timeoutIds.push(window.setTimeout(() => handleDismiss(toast.id), toast.duration));
      }
    }
    return () => {
      for (const timeoutId of timeoutIds) window.clearTimeout(timeoutId);
    };
  }, [autoDismiss, handleDismiss, visibleToastRecords]);

  return (
    <section
      aria-atomic="false"
      aria-label="Notifications Alt+T"
      aria-live="polite"
      aria-relevant="additions text"
      className="resend-ui-toaster-section"
      data-resend-toast-section=""
      suppressHydrationWarning
      tabIndex={-1}
    >
      {visibleToastRecords.length > 0 ? (
        <ol
          className={cx('resend-ui-toaster', className)}
          data-sonner-theme="light"
          data-sonner-toaster=""
          data-toaster-position={positionName}
          data-x-position="right"
          data-y-position="bottom"
          dir="auto"
          tabIndex={-1}
        >
          {visibleToastRecords.map((toast, index) => (
            <li
              data-dismissible={toast.dismissible ? 'true' : 'false'}
              data-front={index === 0 ? 'true' : 'false'}
              data-index={String(index)}
              data-sonner-toast=""
              data-type={toastAppearanceToType(toast.appearance)}
              data-visible="true"
              data-x-position="right"
              data-y-position="bottom"
              key={toast.id}
              tabIndex={0}
            >
              <ToastCard index={index} onDismiss={handleDismiss} toast={toast} />
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

export function ToastCard({ index = 0, onDismiss, toast }: ToastCardProps) {
  const hasAction = toast.appearance === 'red' && toast.dismissible;

  return (
    <div
      className="resend-ui-toast-card"
      data-appearance={toast.appearance}
      data-duration={String(toast.duration)}
      data-index={String(index)}
      data-resend-toast-card=""
    >
      <div className="resend-ui-toast-card__body">
        <ToastStatusIcon appearance={toast.appearance} />
        <div className={cx('resend-ui-toast-card__content', hasAction && 'resend-ui-toast-card__content--with-action')}>
          <strong className="resend-ui-toast-card__title" data-sonner-toast-title="">
            {toast.title}
          </strong>
          {toast.description ? (
            <span className="resend-ui-toast-card__description" data-sonner-toast-description="">
              {toast.description}
            </span>
          ) : null}
        </div>
        {hasAction ? (
          <div className="resend-ui-toast-card__action">
            <button
              aria-label="Close toast"
              className="resend-ui-toast-card__close"
              data-resend-toast-close=""
              onClick={() => onDismiss?.(toast.id)}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ToastStatusIcon({ appearance }: { readonly appearance: ToastAppearance }) {
  if (appearance !== 'green' && appearance !== 'red') return null;

  return (
    <span className="resend-ui-toast-card__icon" data-appearance={appearance} data-resend-toast-icon="">
      <svg aria-hidden="true" viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="8" />
        {appearance === 'green' ? (
          <path className="resend-ui-toast-card__icon-mark" d="M5 9.35 7.45 11.8 13.1 6.15" />
        ) : (
          <path className="resend-ui-toast-card__icon-mark" d="M6.2 6.2 11.8 11.8M11.8 6.2 6.2 11.8" />
        )}
      </svg>
    </span>
  );
}

function toastAppearanceToType(appearance: ToastAppearance) {
  if (appearance === 'green') return 'success';
  if (appearance === 'red') return 'error';
  if (appearance === 'yellow') return 'warning';
  return 'default';
}

function cx(...classNames: readonly (false | null | string | undefined)[]) {
  return classNames.filter(Boolean).join(' ');
}
