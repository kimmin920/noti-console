import type { ToastId, ToastInput, ToastListener, ToastRecord, ToastRef } from './types';

let nextToastId = 1;
let toastRecords: readonly ToastRecord[] = [];

const listeners = new Set<ToastListener>();

export function createToastRecord(input: ToastInput, fallbackId?: ToastId): ToastRecord {
  const appearance = input.appearance;
  const base = {
    appearance,
    dismissible: input.dismissible ?? true,
    duration: input.duration ?? (appearance === 'red' ? 10000 : 3000),
    id: input.id ?? fallbackId ?? createToastId(),
    title: input.title,
  };

  return input.description === undefined ? base : { ...base, description: input.description };
}

export function dismissToast(id: ToastId) {
  toastRecords = toastRecords.filter((toast) => toast.id !== id);
  emitToasts();
}

export function getToastHistory() {
  return toastRecords;
}

export function showToast(input: ToastInput, ref?: ToastRef) {
  if (ref !== undefined && ref.current !== null) {
    dismissToast(ref.current);
    ref.current = null;
  }

  const toast = createToastRecord(input);
  toastRecords = [toast, ...toastRecords.filter((record) => record.id !== toast.id)];
  if (ref !== undefined) ref.current = toast.id;
  emitToasts();
  return toast.id;
}

export function subscribeToToasts(listener: ToastListener) {
  listeners.add(listener);
  listener(toastRecords);
  return () => {
    listeners.delete(listener);
  };
}

function createToastId() {
  const id = nextToastId;
  nextToastId += 1;
  return id;
}

function emitToasts() {
  const snapshot = [...toastRecords];
  for (const listener of listeners) listener(snapshot);
}
