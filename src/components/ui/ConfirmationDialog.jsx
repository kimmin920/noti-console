'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { AppButton as Button } from '../ui-extensions/AppButton.jsx';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './Dialog.jsx';

export function ConfirmationDialog({
  cancelLabel = 'Cancel',
  children,
  confirmLabel = 'Confirm',
  description,
  destructive = false,
  onConfirm,
  onOpenChange,
  open,
  title,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  function setOpen(nextOpen) {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  }

  async function confirm() {
    setPending(true);

    try {
      await onConfirm?.();
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {children ? (
        <DialogTrigger asChild>{children}</DialogTrigger>
      ) : null}
      <DialogContent className={destructive ? 'confirmation-dialog destructive' : 'confirmation-dialog'} size="small">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="confirmation-dialog-message">
            {destructive ? <AlertTriangle aria-hidden="true" size={18} /> : null}
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>{cancelLabel}</Button>
          <Button
            disabled={pending}
            onClick={confirm}
            variant={destructive ? 'danger' : 'primary'}
          >
            {pending ? 'Working...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
