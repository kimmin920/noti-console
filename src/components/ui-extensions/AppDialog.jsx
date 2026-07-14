'use client';

import { forwardRef } from 'react';
import { X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';

import { AppIconButton } from './AppIconButton.jsx';

export const APP_DIALOG_SIZES = Object.freeze(['sm', 'md', 'lg', 'workspace']);

export const AppDialog = RadixDialog.Root;

export const AppDialogTrigger = forwardRef(function AppDialogTrigger(
  { asChild = true, ...props },
  ref
) {
  return <RadixDialog.Trigger asChild={asChild} ref={ref} {...props} />;
});

export const AppDialogClose = forwardRef(function AppDialogClose(
  { asChild = true, ...props },
  ref
) {
  return <RadixDialog.Close asChild={asChild} ref={ref} {...props} />;
});

export const AppDialogContent = forwardRef(function AppDialogContent(
  {
    children,
    className = '',
    closeLabel = '닫기',
    showClose = true,
    size = 'md',
    ...props
  },
  ref
) {
  const resolvedSize = APP_DIALOG_SIZES.includes(size) ? size : 'md';

  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="app-rui-dialog-overlay" />
      <RadixDialog.Content
        className={[
          'app-rui-dialog-content',
          `app-rui-dialog-content--${resolvedSize}`,
          className,
        ].filter(Boolean).join(' ')}
        data-size={resolvedSize}
        ref={ref}
        {...props}
      >
        {children}
        {showClose ? (
          <RadixDialog.Close asChild>
            <AppIconButton
              className="app-rui-dialog-close"
              icon={X}
              label={closeLabel}
              title=""
            />
          </RadixDialog.Close>
        ) : null}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
});

export const AppDialogHeader = forwardRef(function AppDialogHeader(
  { className = '', ...props },
  ref
) {
  return <header className={['app-rui-dialog-header', className].filter(Boolean).join(' ')} ref={ref} {...props} />;
});

export const AppDialogTitle = forwardRef(function AppDialogTitle(
  { className = '', ...props },
  ref
) {
  return <RadixDialog.Title className={['app-rui-dialog-title', className].filter(Boolean).join(' ')} ref={ref} {...props} />;
});

export const AppDialogDescription = forwardRef(function AppDialogDescription(
  { className = '', ...props },
  ref
) {
  return <RadixDialog.Description className={['app-rui-dialog-description', className].filter(Boolean).join(' ')} ref={ref} {...props} />;
});

export const AppDialogBody = forwardRef(function AppDialogBody(
  { className = '', ...props },
  ref
) {
  return <div className={['app-rui-dialog-body', className].filter(Boolean).join(' ')} ref={ref} {...props} />;
});

export const AppDialogFooter = forwardRef(function AppDialogFooter(
  { className = '', ...props },
  ref
) {
  return <footer className={['app-rui-dialog-footer', className].filter(Boolean).join(' ')} ref={ref} {...props} />;
});
