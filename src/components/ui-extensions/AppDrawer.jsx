'use client';

import {
  DrawerContent as ResendDrawerContent,
  DrawerRoot,
  DrawerTrigger,
} from '../../ui-kits/resend/primitives/drawer';

export const AppDrawer = DrawerRoot;
export const AppDrawerTrigger = DrawerTrigger;

export function AppDrawerContent({ children, className = '', side = 'right', title = '패널', ...props }) {
  return (
    <ResendDrawerContent
      className={['app-rui-drawer-content', `app-rui-drawer-content--${side}`, className].filter(Boolean).join(' ')}
      closeLabel="닫기"
      title={<span className="app-rui-visually-hidden">{title}</span>}
      {...props}
    >
      {children}
    </ResendDrawerContent>
  );
}

export function AppDrawerHeader({ children, className = '', ...props }) {
  return <header className={['app-rui-drawer-header', className].filter(Boolean).join(' ')} {...props}>{children}</header>;
}

export function AppDrawerTitle({ children, className = '', ...props }) {
  return <h2 className={['app-rui-drawer-title', className].filter(Boolean).join(' ')} {...props}>{children}</h2>;
}

export function AppDrawerDescription({ children, className = '', ...props }) {
  return <p className={['app-rui-drawer-description', className].filter(Boolean).join(' ')} {...props}>{children}</p>;
}

export function AppDrawerBody({ children, className = '', ...props }) {
  return <div className={['app-rui-drawer-body', className].filter(Boolean).join(' ')} {...props}>{children}</div>;
}

export function AppDrawerFooter({ children, className = '', ...props }) {
  return <footer className={['app-rui-drawer-footer', className].filter(Boolean).join(' ')} {...props}>{children}</footer>;
}
