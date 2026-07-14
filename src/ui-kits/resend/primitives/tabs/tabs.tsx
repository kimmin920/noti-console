import { Tabs as RadixTabs } from 'radix-ui';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { useControllableValue } from '../../utils/use-controllable-value';

type TabsItem = {
  readonly href?: string;
  readonly label: ReactNode;
  readonly value: string;
};

type NavigationTabsProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  readonly items: readonly TabsItem[];
  readonly value?: string;
};

type TabsProps = Omit<ComponentPropsWithoutRef<typeof RadixTabs.Root>, 'children' | 'defaultValue' | 'onValueChange' | 'value'> & {
  readonly defaultValue?: string;
  readonly items: readonly TabsItem[];
  readonly onValueChange?: (value: string) => void;
  readonly value?: string;
};

type TabsRootProps = ComponentPropsWithoutRef<'div'>;
type TabsListProps = ComponentPropsWithoutRef<'div'>;
type TabsLinkProps = ComponentPropsWithoutRef<'a'> & {
  readonly active?: boolean;
};
type TabsButtonProps = ComponentPropsWithoutRef<'button'> & {
  readonly active?: boolean;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

function getFirstValue(items: readonly TabsItem[]) {
  return items[0]?.value ?? '';
}

function getResolvedValue(items: readonly TabsItem[], requestedValue?: string) {
  if (requestedValue !== undefined && items.some((item) => item.value === requestedValue)) {
    return requestedValue;
  }
  return getFirstValue(items);
}

function TabsRoot({ className, ...props }: TabsRootProps) {
  return (
    <div
      className={cx('resend-ui-tabs', className)}
      data-activation-direction="none"
      data-orientation="horizontal"
      {...props}
    />
  );
}

function TabsList({ className, ...props }: TabsListProps) {
  return (
    <div
      className={cx('resend-ui-tabs__list', className)}
      data-activation-direction="none"
      data-orientation="horizontal"
      role="tablist"
      {...props}
    />
  );
}

function TabsLink({
  active = false,
  className,
  tabIndex = -1,
  ...props
}: TabsLinkProps) {
  return (
    <a
      aria-selected={active}
      className={cx('resend-ui-tabs__tab', className)}
      data-active={active ? '' : undefined}
      data-composite-item-active={active ? '' : undefined}
      data-orientation="horizontal"
      role="tab"
      tabIndex={tabIndex}
      {...props}
    />
  );
}

function TabsButton({
  active = false,
  className,
  tabIndex = -1,
  type = 'button',
  ...props
}: TabsButtonProps) {
  return (
    <button
      aria-disabled="false"
      aria-selected={active}
      className={cx('resend-ui-tabs__tab', className)}
      data-active={active ? '' : undefined}
      data-composite-item-active={active ? '' : undefined}
      data-orientation="horizontal"
      role="tab"
      tabIndex={tabIndex}
      type={type}
      {...props}
    />
  );
}

function NavigationTabs({ items, value, ...props }: NavigationTabsProps) {
  const selectedValue = getResolvedValue(items, value);
  return (
    <TabsRoot {...props}>
      <TabsList>
        {items.map((item) => {
          const active = item.value === selectedValue;
          return item.href === undefined ? (
            <TabsButton active={active} key={item.value}>{item.label}</TabsButton>
          ) : (
            <TabsLink active={active} href={item.href} key={item.value}>{item.label}</TabsLink>
          );
        })}
      </TabsList>
    </TabsRoot>
  );
}

function Tabs({ defaultValue, items, onValueChange, value, ...props }: TabsProps) {
  const fallbackValue = getResolvedValue(items, defaultValue);
  const controlledValue = value === undefined ? undefined : getResolvedValue(items, value);
  const [selectedValue, setSelectedValue] = useControllableValue({
    controlledValue,
    defaultValue: fallbackValue,
    onValueChange,
  });

  return (
    <RadixTabs.Root
      {...props}
      className={cx('resend-ui-tabs', props.className)}
      data-activation-direction="none"
      onValueChange={setSelectedValue}
      orientation="horizontal"
      value={selectedValue}
    >
      <RadixTabs.List
        className="resend-ui-tabs__list"
        data-activation-direction="none"
      >
        {items.map((item) => {
          const active = item.value === selectedValue;
          return (
            <RadixTabs.Trigger
              aria-disabled="false"
              className="resend-ui-tabs__tab"
              data-active={active ? '' : undefined}
              data-composite-item-active={active ? '' : undefined}
              key={item.value}
              value={item.value}
            >
              {item.label}
            </RadixTabs.Trigger>
          );
        })}
      </RadixTabs.List>
    </RadixTabs.Root>
  );
}

export {
  NavigationTabs,
  Tabs,
  TabsButton,
  TabsLink,
  TabsList,
  TabsRoot,
};
export type {
  NavigationTabsProps,
  TabsButtonProps,
  TabsItem,
  TabsLinkProps,
  TabsListProps,
  TabsProps,
  TabsRootProps,
};
