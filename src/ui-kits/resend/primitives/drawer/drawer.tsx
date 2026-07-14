import { X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef, type ReactNode } from 'react';

type DrawerRootProps = ComponentPropsWithoutRef<typeof RadixDialog.Root>;
type DrawerTriggerProps = ComponentPropsWithoutRef<typeof RadixDialog.Trigger>;
type DrawerCloseProps = ComponentPropsWithoutRef<typeof RadixDialog.Close>;
type DrawerContentProps = Omit<ComponentPropsWithoutRef<typeof RadixDialog.Content>, 'title'> & {
  readonly children: ReactNode;
  readonly closeLabel?: string;
  readonly title: ReactNode;
};

function DrawerRoot(props: DrawerRootProps) {
  return <RadixDialog.Root {...props} />;
}

const DrawerTrigger = forwardRef<ComponentRef<typeof RadixDialog.Trigger>, DrawerTriggerProps>(function DrawerTrigger({ asChild = true, ...props }, ref) {
  return <RadixDialog.Trigger asChild={asChild} ref={ref} {...props} />;
});

const DrawerClose = forwardRef<ComponentRef<typeof RadixDialog.Close>, DrawerCloseProps>(function DrawerClose({ asChild = true, ...props }, ref) {
  return <RadixDialog.Close asChild={asChild} ref={ref} {...props} />;
});

const DrawerContent = forwardRef<ComponentRef<typeof RadixDialog.Content>, DrawerContentProps>(function DrawerContent({ children, className, closeLabel = 'Close', title, ...props }, ref) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="resend-ui-drawer__overlay" />
      <RadixDialog.Content
        aria-describedby={undefined}
        className={['resend-ui-drawer__content', className].filter(Boolean).join(' ')}
        ref={ref}
        {...props}
      >
        <header className="resend-ui-drawer__header">
          <RadixDialog.Title className="resend-ui-drawer__title">{title}</RadixDialog.Title>
          <RadixDialog.Close aria-label={closeLabel} className="resend-ui-drawer__close">
            <X aria-hidden="true" size={18} />
          </RadixDialog.Close>
        </header>
        <div className="resend-ui-drawer__body">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
});

const Drawer = { Close: DrawerClose, Content: DrawerContent, Root: DrawerRoot, Trigger: DrawerTrigger };

export { Drawer, DrawerClose, DrawerContent, DrawerRoot, DrawerTrigger };
export type { DrawerCloseProps, DrawerContentProps, DrawerRootProps, DrawerTriggerProps };
