import { Dialog as RadixDialog } from 'radix-ui';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '../../primitives/icon-button';

type AudienceContactModalShellProps = {
  readonly children: ReactNode;
  readonly onCloseAutoFocus?: ((event: Event) => void) | undefined;
  readonly onOpenAutoFocus?: ((event: Event) => void) | undefined;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly size?: 'default' | 'mapping';
  readonly title: string;
};

function AudienceContactModalShell({
  children,
  onCloseAutoFocus,
  onOpenAutoFocus,
  onOpenChange,
  open,
  size = 'default',
  title,
}: AudienceContactModalShellProps) {
  return (
    <RadixDialog.Root onOpenChange={onOpenChange} open={open}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="resend-ui-audience-contact-modal__overlay">
          <RadixDialog.Content
            className="resend-ui-audience-contact-modal__content"
            data-resend-audience-contact-modal
            data-size={size}
            onCloseAutoFocus={onCloseAutoFocus}
            onOpenAutoFocus={onOpenAutoFocus}
          >
            <RadixDialog.Title className="resend-ui-audience-contact-modal__title">
              {title}
            </RadixDialog.Title>
            {children}
            <RadixDialog.Close asChild>
              <IconButton
                className="resend-ui-audience-contact-modal__close"
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

function AudienceContactModalShortcut({ tokens }: { readonly tokens: readonly string[] }) {
  return (
    <span aria-hidden="true" className="resend-ui-audience-contact-modal__shortcut">
      {tokens.map((token) => (
        <kbd className="resend-ui-audience-contact-modal__kbd" key={token}>{token}</kbd>
      ))}
    </span>
  );
}

export { AudienceContactModalShell, AudienceContactModalShortcut };
