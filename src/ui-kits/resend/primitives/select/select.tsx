import { Check, ChevronDown } from 'lucide-react';
import { Select as RadixSelect } from 'radix-ui';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from 'react';
import { ChevronDownIcon } from '../chevron-down-icon';
import { useFormFieldContext } from '../form-field/form-field';

type SelectRootProps = ComponentPropsWithoutRef<typeof RadixSelect.Root>;
type SelectTriggerProps = ComponentPropsWithoutRef<typeof RadixSelect.Trigger>;
type SelectValueProps = ComponentPropsWithoutRef<typeof RadixSelect.Value>;
type SelectContentProps = ComponentPropsWithoutRef<typeof RadixSelect.Content>;
type SelectItemProps = ComponentPropsWithoutRef<typeof RadixSelect.Item>;
type SelectSeparatorProps = ComponentPropsWithoutRef<typeof RadixSelect.Separator>;

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

function SelectRoot(props: SelectRootProps) {
  return <RadixSelect.Root {...props} />;
}

const SelectTrigger = forwardRef<ComponentRef<typeof RadixSelect.Trigger>, SelectTriggerProps>(
  function SelectTrigger({
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    children,
    className,
    id,
    ...props
  }, ref) {
    const field = useFormFieldContext();
    return (
      <RadixSelect.Trigger
        aria-describedby={ariaDescribedBy ?? (field?.invalid ? field.messageId : undefined)}
        aria-invalid={ariaInvalid ?? field?.invalid}
        className={cx('resend-ui-select__trigger', className)}
        id={id ?? field?.controlId}
        ref={ref}
        {...props}
      >
        {children}
        <RadixSelect.Icon asChild>
          <ChevronDownIcon />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
    );
  }
);

const SelectValue = forwardRef<ComponentRef<typeof RadixSelect.Value>, SelectValueProps>(
  function SelectValue(props, ref) {
    return <RadixSelect.Value ref={ref} {...props} />;
  }
);

const SelectContent = forwardRef<ComponentRef<typeof RadixSelect.Content>, SelectContentProps>(
  function SelectContent({ children, className, position = 'popper', sideOffset = 8, ...props }, ref) {
    return (
      <RadixSelect.Portal>
        <RadixSelect.Content
          className={cx('resend-ui-select-content', className)}
          position={position}
          ref={ref}
          sideOffset={sideOffset}
          {...props}
        >
          <RadixSelect.ScrollUpButton className="resend-ui-select-content__scroll-button">
            <ChevronDown aria-hidden="true" size={14} />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="resend-ui-select-content__viewport">
            {children}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="resend-ui-select-content__scroll-button">
            <ChevronDown aria-hidden="true" size={14} />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    );
  }
);

const SelectItem = forwardRef<ComponentRef<typeof RadixSelect.Item>, SelectItemProps>(
  function SelectItem({ children, className, ...props }, ref) {
    return (
      <RadixSelect.Item
        className={cx('resend-ui-select-item', className)}
        ref={ref}
        {...props}
      >
        <RadixSelect.ItemText asChild>
          <span className="resend-ui-select-item__text">{children}</span>
        </RadixSelect.ItemText>
        <RadixSelect.ItemIndicator className="resend-ui-select-item__indicator">
          <Check aria-hidden="true" size={14} />
        </RadixSelect.ItemIndicator>
      </RadixSelect.Item>
    );
  }
);

const SelectSeparator = forwardRef<ComponentRef<typeof RadixSelect.Separator>, SelectSeparatorProps>(
  function SelectSeparator({ className, ...props }, ref) {
    return (
      <RadixSelect.Separator
        className={cx('resend-ui-select-separator', className)}
        ref={ref}
        {...props}
      />
    );
  }
);

const Select = {
  Content: SelectContent,
  Item: SelectItem,
  Root: SelectRoot,
  Separator: SelectSeparator,
  Trigger: SelectTrigger,
  Value: SelectValue,
};

export {
  Select,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
export type {
  SelectContentProps,
  SelectItemProps,
  SelectRootProps,
  SelectSeparatorProps,
  SelectTriggerProps,
  SelectValueProps,
};
