'use client';

import { createContext, useContext, useMemo } from 'react';

import {
  Toaster,
  dismissToast as dismissResendToast,
  showToast as showResendToast,
} from '../../ui-kits/resend/feedback/toast';

const ToastContext = createContext(null);

const appearanceMap = {
  critical: 'red',
  default: 'gray',
  error: 'red',
  info: 'gray',
  success: 'green',
  warning: 'yellow',
};

function resolveAppearance(variant, appearance) {
  const requested = appearance ?? variant ?? 'default';
  return appearanceMap[requested] ?? requested;
}

function showAppToast(toast) {
  let toastId = toast.id ?? null;
  const hasAction = Boolean(toast.action?.label && typeof toast.action?.onClick === 'function');
  const description = hasAction ? (
    <span className="app-rui-toast-description">
      {toast.description ? <span>{toast.description}</span> : null}
      <button
        className="app-rui-toast-action"
        onClick={() => {
          if (toastId !== null) dismissResendToast(toastId);
          toast.action.onClick();
        }}
        type="button"
      >
        {toast.action.label}
      </button>
    </span>
  ) : toast.description;

  toastId = showResendToast({
    appearance: resolveAppearance(toast.variant, toast.appearance),
    description,
    dismissible: toast.dismissible,
    duration: toast.duration,
    id: toast.id,
    title: toast.title,
  });

  return toastId;
}

export function AppToastProvider({ children }) {
  const value = useMemo(() => ({
    dismissToast: dismissResendToast,
    showToast: showAppToast,
  }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  );
}

export function useAppToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
