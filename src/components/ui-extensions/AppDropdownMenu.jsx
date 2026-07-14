'use client';

import { DropdownMenu as RadixDropdownMenu } from 'radix-ui';

import {
  DropdownMenu as ResendDropdownMenu,
  DropdownMenuContent as ResendDropdownMenuContent,
  DropdownMenuItem as ResendDropdownMenuItem,
  DropdownMenuRoot as ResendDropdownMenuRoot,
  DropdownMenuSeparator as ResendDropdownMenuSeparator,
} from '../../ui-kits/resend/primitives/dropdown-menu';

export function AppDropdownMenu(props) {
  return <ResendDropdownMenuRoot {...props} />;
}

export function AppDropdownMenuTrigger({ asChild = false, children, ...props }) {
  if (asChild) {
    return <RadixDropdownMenu.Trigger asChild {...props}>{children}</RadixDropdownMenu.Trigger>;
  }

  return <ResendDropdownMenu.Trigger {...props}>{children}</ResendDropdownMenu.Trigger>;
}

export function AppDropdownMenuContent({ matchTriggerWidth = true, style, ...props }) {
  return (
    <ResendDropdownMenuContent
      style={{
        minWidth: matchTriggerWidth ? 'var(--radix-dropdown-menu-trigger-width)' : undefined,
        ...style,
      }}
      {...props}
    />
  );
}

export function AppDropdownMenuItem({ className = '', variant, ...props }) {
  const resolvedVariant = variant ?? (className.split(/\s+/).includes('danger') ? 'red' : 'gray');
  return <ResendDropdownMenuItem className={className} variant={resolvedVariant} {...props} />;
}

export function AppDropdownMenuCheckboxItem({ className = '', ...props }) {
  return <RadixDropdownMenu.CheckboxItem className={['resend-ui-dropdown-menu-item', className].filter(Boolean).join(' ')} {...props} />;
}

export function AppDropdownMenuLabel({ className = '', ...props }) {
  return <RadixDropdownMenu.Label className={['app-rui-dropdown-menu-label', className].filter(Boolean).join(' ')} {...props} />;
}

export const AppDropdownMenuSeparator = ResendDropdownMenuSeparator;

export {
  AppDropdownMenu as DropdownMenu,
  AppDropdownMenuCheckboxItem as DropdownMenuCheckboxItem,
  AppDropdownMenuContent as DropdownMenuContent,
  AppDropdownMenuItem as DropdownMenuItem,
  AppDropdownMenuLabel as DropdownMenuLabel,
  AppDropdownMenuSeparator as DropdownMenuSeparator,
  AppDropdownMenuTrigger as DropdownMenuTrigger,
};
