'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu.jsx';

export function ActionMenu(props) {
  return <DropdownMenu {...props} />;
}

export function ActionMenuTrigger(props) {
  return <DropdownMenuTrigger {...props} />;
}

export function ActionMenuContent({ className = '', ...props }) {
  return (
    <DropdownMenuContent
      className={['action-menu-content', className].filter(Boolean).join(' ')}
      {...props}
      matchTriggerWidth={false}
    />
  );
}

export function ActionMenuItem({
  children,
  className = '',
  description,
  leadingVisual,
  trailingVisual,
  variant = 'default',
  ...props
}) {
  return (
    <DropdownMenuItem
      className={['action-menu-item', variant, className].filter(Boolean).join(' ')}
      {...props}
    >
      {leadingVisual ? <span className="action-menu-leading" aria-hidden="true">{leadingVisual}</span> : null}
      <span className="action-menu-copy">
        <span>{children}</span>
        {description ? <small>{description}</small> : null}
      </span>
      {trailingVisual ? <span className="action-menu-trailing">{trailingVisual}</span> : null}
    </DropdownMenuItem>
  );
}

export function ActionMenuLabel(props) {
  return <DropdownMenuLabel {...props} />;
}

export function ActionMenuSeparator(props) {
  return <DropdownMenuSeparator {...props} />;
}
