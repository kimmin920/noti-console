import { DropdownMenu as RadixDropdownMenu } from 'radix-ui';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from 'react';
import { FilterButton, type FilterButtonProps } from '../filter-button';

type DropdownMenuRootProps = ComponentPropsWithoutRef<typeof RadixDropdownMenu.Root>;
type DropdownMenuTriggerProps = Omit<FilterButtonProps, 'popupType'>;
type DropdownMenuContentProps = ComponentPropsWithoutRef<typeof RadixDropdownMenu.Content>;
type DropdownMenuItemVariant = 'gray' | 'red';
type DropdownMenuItemProps = ComponentPropsWithoutRef<typeof RadixDropdownMenu.Item> & {
  readonly variant?: DropdownMenuItemVariant;
};
type DropdownMenuSeparatorProps = ComponentPropsWithoutRef<typeof RadixDropdownMenu.Separator>;

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

function DropdownMenuRoot(props: DropdownMenuRootProps) {
  return <RadixDropdownMenu.Root {...props} />;
}

const DropdownMenuTrigger = forwardRef<ComponentRef<'button'>, DropdownMenuTriggerProps>(
  function DropdownMenuTrigger(props, ref) {
    return <FilterButton popupType="menu" ref={ref} {...props} />;
  }
);

const DropdownMenuRootTrigger = forwardRef<ComponentRef<'button'>, DropdownMenuTriggerProps>(
  function DropdownMenuRootTrigger(props, ref) {
    return (
      <RadixDropdownMenu.Trigger asChild>
        <FilterButton popupType="menu" ref={ref} {...props} />
      </RadixDropdownMenu.Trigger>
    );
  }
);

const DropdownMenuContent = forwardRef<
  ComponentRef<typeof RadixDropdownMenu.Content>,
  DropdownMenuContentProps
>(function DropdownMenuContent({ children, className, sideOffset = 8, ...props }, ref) {
  return (
    <RadixDropdownMenu.Portal>
      <RadixDropdownMenu.Content
        className={cx('resend-ui-dropdown-menu-content', className)}
        ref={ref}
        sideOffset={sideOffset}
        {...props}
      >
        {children}
      </RadixDropdownMenu.Content>
    </RadixDropdownMenu.Portal>
  );
});

const DropdownMenuItem = forwardRef<
  ComponentRef<typeof RadixDropdownMenu.Item>,
  DropdownMenuItemProps
>(function DropdownMenuItem({ className, variant = 'gray', ...props }, ref) {
  return (
    <RadixDropdownMenu.Item
      className={cx('resend-ui-dropdown-menu-item', className)}
      data-variant={variant}
      ref={ref}
      {...props}
    />
  );
});

const DropdownMenuSeparator = forwardRef<
  ComponentRef<typeof RadixDropdownMenu.Separator>,
  DropdownMenuSeparatorProps
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return (
    <RadixDropdownMenu.Separator
      className={cx('resend-ui-dropdown-menu-separator', className)}
      ref={ref}
      {...props}
    />
  );
});

const DropdownMenu = {
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
  Root: DropdownMenuRoot,
  Separator: DropdownMenuSeparator,
  Trigger: DropdownMenuRootTrigger,
};

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
export type {
  DropdownMenuContentProps,
  DropdownMenuItemProps,
  DropdownMenuItemVariant,
  DropdownMenuRootProps,
  DropdownMenuSeparatorProps,
  DropdownMenuTriggerProps,
};
