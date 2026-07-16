import { Dialog as RadixDialog } from 'radix-ui';
import { X } from 'lucide-react';
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Button } from '../../primitives/button';
import { IconButton } from '../../primitives/icon-button';
import { Input } from '../../primitives/input';
import { showToast } from '../../feedback/toast';
import { getDeleteConfirmationCopy } from './copy';
import { DeleteCopyButton } from './delete-copy-button';
import type { DeleteConfirmationModalProps } from './types';

type ShortcutToken = 'CMD' | 'ENTER' | 'ESC';

export function DeleteConfirmationModal({
  children,
  defaultOpen = false,
  entity = 'domain',
  ids = ['domain-id'],
  loading = false,
  name,
  onConfirm,
  onOpenChange,
  open,
}: DeleteConfirmationModalProps) {
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const modalOpen = open ?? internalOpen;
  const copy = getDeleteConfirmationCopy(entity, ids.length, name);
  const busy = loading || submitting;
  const canDelete = confirmation === copy.confirmation && !busy;

  useEffect(() => {
    if (modalOpen) return;
    setConfirmation('');
    setSubmitting(false);
  }, [modalOpen]);

  function handleOpenChange(nextOpen: boolean) {
    if (open === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  async function submitDelete() {
    if (!canDelete) return;
    setSubmitting(true);
    try {
      await onConfirm?.({ confirmation, entity, ids });
      showToast({ appearance: 'green', title: copy.successTitle });
      handleOpenChange(false);
    } catch (error) {
      showToast({
        appearance: 'red',
        title: error instanceof Error ? error.message : 'Unable to delete. Try again later.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitDelete();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return;
    event.preventDefault();
    void submitDelete();
  }

  return (
    <RadixDialog.Root onOpenChange={handleOpenChange} open={modalOpen}>
      <div data-resend-delete-confirmation-modal>
        <RadixDialog.Trigger asChild>
          {children ?? (
            <Button data-resend-delete-confirmation-trigger variant="interactive">
              {copy.submitLabel}
            </Button>
          )}
        </RadixDialog.Trigger>
      </div>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="resend-ui-delete-confirmation-modal__overlay">
          <RadixDialog.Content
            aria-labelledby={titleId}
            aria-modal="true"
            className="resend-ui-delete-confirmation-modal__content"
            data-resend-delete-confirmation-modal-content
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              inputRef.current?.focus();
            }}
          >
            <RadixDialog.Title asChild>
              <h2
                className="resend-ui-delete-confirmation-modal__title"
                data-resend-delete-confirmation-title
                id={titleId}
              >
                {copy.title}
              </h2>
            </RadixDialog.Title>
            <p className="resend-ui-delete-confirmation-modal__description">
              {copy.description}
            </p>
            <p
              className="resend-ui-delete-confirmation-modal__warning"
              data-resend-delete-confirmation-warning
            >
              This can not be undone.
            </p>
            <p className="resend-ui-delete-confirmation-modal__instruction">
              Type{' '}
              <span className="resend-ui-delete-confirmation-modal__tag">
                <span
                  className="resend-ui-delete-confirmation-modal__confirmation"
                  data-resend-delete-confirmation-confirmation
                >
                  {copy.confirmation}
                </span>
                <DeleteCopyButton value={copy.confirmation} />
              </span>{' '}
              to confirm.
            </p>
            <form
              data-resend-delete-confirmation-form
              onKeyDown={handleKeyDown}
              onSubmit={handleSubmit}
            >
              <div className="resend-ui-delete-confirmation-modal__field">
                <Input
                  autoComplete="off"
                  data-resend-delete-confirmation-input
                  id={inputId}
                  onChange={(event) => setConfirmation(event.currentTarget.value)}
                  placeholder={copy.placeholder}
                  ref={inputRef}
                  value={confirmation}
                />
              </div>
              <div className="resend-ui-delete-confirmation-modal__actions">
                <Button
                  className="resend-ui-delete-confirmation-modal__destructive resend-ui-delete-confirmation-modal__action--shortcut"
                  data-loading={busy ? '' : undefined}
                  data-resend-delete-confirmation-action="submit"
                  disabled={!canDelete}
                  type="submit"
                  variant="accent"
                >
                  <span data-resend-delete-confirmation-action-label>{copy.submitLabel}</span>
                  <ShortcutGroup tokens={['CMD', 'ENTER']} />
                </Button>
                <RadixDialog.Close asChild>
                  <Button
                    className="resend-ui-delete-confirmation-modal__action--shortcut"
                    data-resend-delete-confirmation-action="cancel"
                    disabled={busy}
                    variant="interactive"
                  >
                    <span data-resend-delete-confirmation-action-label>Cancel</span>
                    <ShortcutGroup tokens={['ESC']} />
                  </Button>
                </RadixDialog.Close>
              </div>
            </form>
            <RadixDialog.Close asChild>
              <IconButton
                className="resend-ui-delete-confirmation-modal__close"
                icon={<X aria-hidden="true" size={18} />}
                label="Close dialog"
              />
            </RadixDialog.Close>
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

function ShortcutGroup({ tokens }: { readonly tokens: readonly ShortcutToken[] }) {
  return (
    <span className="resend-ui-delete-confirmation-modal__shortcuts">
      {tokens.map((token) => (
        <kbd className="resend-ui-delete-confirmation-modal__kbd" data-resend-delete-confirmation-kbd key={token}>
          {getShortcutLabel(token)}
        </kbd>
      ))}
    </span>
  );
}

function getShortcutLabel(token: ShortcutToken) {
  if (token === 'ENTER') return '↩';
  if (token === 'ESC') return 'Esc';
  const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  return isApple ? '⌘' : 'Ctrl';
}
