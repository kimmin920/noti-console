'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import lottie from 'lottie-web';
import { X } from 'lucide-react';
import checkAnimation from '../../toast-lotties/system-solid-31-check.json';
import crossAnimation from '../../toast-lotties/system-solid-29-cross.json';
import spinnerAnimation from '../../toast-lotties/system-regular-719-spinner-circle.json';
import { IconButton } from './IconButton.jsx';

const ToastContext = createContext(null);
const toastVariantAliases = {
  critical: 'red',
  default: 'gray',
  error: 'red',
  info: 'gray',
  success: 'green',
  warning: 'yellow',
};
const toastAnimations = {
  green: checkAnimation,
  red: crossAnimation,
  spinner: spinnerAnimation,
};

function getToastVariant(variant, appearance) {
  const requestedVariant = appearance ?? variant;
  const resolvedVariant = toastVariantAliases[requestedVariant] ?? requestedVariant;

  return ['gray', 'green', 'red', 'yellow'].includes(resolvedVariant)
    ? resolvedVariant
    : 'gray';
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismissTimeoutsRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    const timeoutId = dismissTimeoutsRef.current.get(id);

    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      dismissTimeoutsRef.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast) => {
    const id = toast.id ?? crypto.randomUUID();
    const variant = getToastVariant(toast.variant, toast.appearance);
    const duration = toast.duration ?? (variant === 'red' ? 10000 : 3000);
    const nextToast = {
      ...toast,
      id,
      variant,
    };
    const existingTimeoutId = dismissTimeoutsRef.current.get(id);

    if (existingTimeoutId !== undefined) {
      window.clearTimeout(existingTimeoutId);
      dismissTimeoutsRef.current.delete(id);
    }

    setToasts((current) => [...current.filter((item) => item.id !== id), nextToast]);

    if (duration > 0) {
      const timeoutId = window.setTimeout(() => dismissToast(id), duration);
      dismissTimeoutsRef.current.set(id, timeoutId);
    }

    return id;
  }, [dismissToast]);

  useEffect(() => () => {
    dismissTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    dismissTimeoutsRef.current.clear();
  }, []);

  const value = useMemo(() => ({ dismissToast, showToast }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport dismissToast={dismissToast} toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }

  return context;
}

function ToastViewport({ dismissToast, toasts }) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <section aria-label="Notifications" className="toast-viewport">
      {toasts.map((toast) => {
        const isCritical = toast.variant === 'red';
        const hasToastAction = Boolean(toast.action?.label && typeof toast.action?.onClick === 'function');
        const hasAction = isCritical || hasToastAction;
        const animationData = toastAnimations[toast.animation] ?? toastAnimations[toast.variant];

        return (
          <article
            aria-live={isCritical ? 'assertive' : 'polite'}
            className={['toast', `toast-${toast.variant}`].join(' ')}
            key={toast.id}
            role={isCritical ? 'alert' : 'status'}
          >
            <div className="toast-content">
              {animationData ? <ToastAnimation animationData={animationData} /> : null}
              <div
                className={[
                  'toast-copy',
                  hasAction && 'has-action',
                  hasToastAction && 'has-text-action',
                ].filter(Boolean).join(' ')}
              >
                <p data-sonner-toast-title>{toast.title}</p>
                {toast.description ? <span data-sonner-toast-description>{toast.description}</span> : null}
              </div>
              {hasAction ? (
                <div className="toast-action">
                  {hasToastAction ? (
                    <button
                      className="toast-action-button"
                      onClick={() => {
                        dismissToast(toast.id);
                        toast.action.onClick();
                      }}
                      type="button"
                    >
                      {toast.action.label}
                    </button>
                  ) : null}
                  {isCritical ? (
                    <IconButton icon={X} label="알림 닫기" onClick={() => dismissToast(toast.id)} title="" />
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ToastAnimation({ animationData }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const animation = lottie.loadAnimation({
      animationData,
      autoplay: true,
      container: containerRef.current,
      loop: true,
      renderer: 'svg',
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet',
        progressiveLoad: true,
      },
    });

    return () => {
      animation.destroy();
    };
  }, [animationData]);

  return <span aria-hidden="true" className="toast-lottie" ref={containerRef} />;
}
