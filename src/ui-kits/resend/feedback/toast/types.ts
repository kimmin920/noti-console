import type { ReactNode } from 'react';

export type ToastAppearance = 'gray' | 'green' | 'red' | 'yellow';
export type ToastId = number | string;
export type ToasterPosition = 'bottom-right';

export type ToastInput = {
  readonly appearance: ToastAppearance;
  readonly description?: ReactNode;
  readonly dismissible?: boolean;
  readonly duration?: number;
  readonly id?: ToastId;
  readonly title: ReactNode;
};

export type ToastRecord = {
  readonly appearance: ToastAppearance;
  readonly description?: ReactNode;
  readonly dismissible: boolean;
  readonly duration: number;
  readonly id: ToastId;
  readonly title: ReactNode;
};

export type ToastRef = {
  current: null | ToastId;
};

export type ToastListener = (toasts: readonly ToastRecord[]) => void;

export type ToasterProps = {
  /** Uncontrolled instances intentionally mirror the process-wide showToast store. */
  readonly autoDismiss?: boolean;
  readonly className?: string;
  readonly defaultToasts?: readonly ToastInput[];
  readonly onToastsChange?: (toasts: readonly ToastRecord[]) => void;
  readonly position?: ToasterPosition;
  readonly toasts?: readonly ToastRecord[];
  readonly visibleToasts?: number;
};

export type ToastCardProps = {
  readonly index?: number;
  readonly onDismiss?: (id: ToastId) => void;
  readonly toast: ToastRecord;
};
