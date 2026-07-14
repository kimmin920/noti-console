import { Check, Search } from 'lucide-react';
import { Popover as RadixPopover } from 'radix-ui';
import { createContext, Fragment, useContext, useMemo, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { FilterButton } from '../filter-button';

type MultiSelectOption = {
  readonly color?: string;
  readonly disabled?: boolean;
  readonly label: string;
  readonly value: string;
};

type MultiSelectRootProps = {
  readonly allValue?: string;
  readonly children: ReactNode;
  readonly defaultValue?: readonly string[];
  readonly onChange?: ((value: readonly string[]) => void) | undefined;
  readonly options: readonly MultiSelectOption[];
  readonly value?: readonly string[] | undefined;
};

type MultiSelectTriggerProps = Omit<ComponentPropsWithoutRef<typeof FilterButton>, 'children'> & {
  readonly label: string;
  readonly selectedLabel?: ((selected: readonly MultiSelectOption[]) => string) | undefined;
};

type MultiSelectContentProps = ComponentPropsWithoutRef<typeof RadixPopover.Content> & {
  readonly emptyLabel?: string;
  readonly searchPlaceholder?: string;
  readonly searchable?: boolean;
};

type MultiSelectContextValue = {
  readonly allValue: string;
  readonly allSelected: boolean;
  readonly open: boolean;
  readonly options: readonly MultiSelectOption[];
  readonly selectedOptions: readonly MultiSelectOption[];
  readonly setOpen: (open: boolean) => void;
  readonly toggle: (value: string) => void;
  readonly values: readonly string[];
};

const MultiSelectContext = createContext<MultiSelectContextValue | null>(null);

function useMultiSelect() {
  const context = useContext(MultiSelectContext);
  if (context === null) throw new Error('MultiSelect components must be used inside MultiSelect.Root');
  return context;
}

function MultiSelectRoot({ allValue = 'all', children, defaultValue = [allValue], onChange, options, value }: MultiSelectRootProps) {
  const [internalValue, setInternalValue] = useState<readonly string[]>(defaultValue);
  const [open, setOpen] = useState(false);
  const values = value ?? internalValue;
  const concreteOptions = options.filter((option) => option.value !== allValue);
  const allSelected = values.includes(allValue) || values.length === concreteOptions.length;
  const selectedOptions = allSelected
    ? concreteOptions
    : concreteOptions.filter((option) => values.includes(option.value));

  function commit(nextValue: readonly string[]) {
    if (value === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
  }

  function toggle(optionValue: string) {
    if (optionValue === allValue) {
      commit([allValue]);
      return;
    }

    if (allSelected) {
      commit([optionValue]);
      return;
    }

    const current = [...values];
    const next = current.includes(optionValue)
      ? current.filter((item) => item !== optionValue)
      : [...current, optionValue];
    commit(next.length === concreteOptions.length ? [allValue] : next);
  }

  return (
    <MultiSelectContext.Provider value={{ allSelected, allValue, open, options, selectedOptions, setOpen, toggle, values }}>
      <RadixPopover.Root onOpenChange={setOpen} open={open}>{children}</RadixPopover.Root>
    </MultiSelectContext.Provider>
  );
}

function MultiSelectTrigger({ className, label, selectedLabel, ...props }: MultiSelectTriggerProps) {
  const { allSelected, open, selectedOptions } = useMultiSelect();
  const text = selectedLabel?.(selectedOptions)
    ?? (allSelected
      ? `All ${label}`
      : selectedOptions.length === 0
        ? `No ${label}`
        : selectedOptions.length === 1
          ? selectedOptions[0]?.label ?? label
          : `${selectedOptions.length} ${label}`);
  return (
    <RadixPopover.Trigger asChild>
      <FilterButton
        className={['resend-ui-multi-select__trigger', className].filter(Boolean).join(' ')}
        expanded={open}
        popupType="dialog"
        {...props}
      >
        {text}
      </FilterButton>
    </RadixPopover.Trigger>
  );
}

function MultiSelectContent({ align = 'start', className, emptyLabel = 'No options found.', searchPlaceholder = 'Search...', searchable = false, sideOffset = 8, ...props }: MultiSelectContentProps) {
  const { allSelected, allValue, options, toggle, values } = useMultiSelect();
  const [query, setQuery] = useState('');
  const visibleOptions = useMemo(() => options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase())), [options, query]);

  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        align={align}
        className={['resend-ui-multi-select__content', className].filter(Boolean).join(' ')}
        sideOffset={sideOffset}
        {...props}
      >
        {searchable ? (
          <label className="resend-ui-multi-select__search">
            <Search aria-hidden="true" size={14} />
            <input onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} value={query} />
          </label>
        ) : null}
        <div aria-multiselectable="true" className="resend-ui-multi-select__list" role="listbox">
          {visibleOptions.length === 0 ? <div className="resend-ui-multi-select__empty">{emptyLabel}</div> : null}
          {visibleOptions.map((option) => {
            const isAllOption = option.value === allValue;
            const selected = option.value === allValue ? allSelected : !allSelected && values.includes(option.value);
            return (
              <Fragment key={option.value}>
                <button
                  aria-selected={selected}
                  className="resend-ui-multi-select__option"
                  disabled={option.disabled}
                  onClick={() => toggle(option.value)}
                  role="option"
                  type="button"
                >
                  {isAllOption ? <span aria-hidden="true" className="resend-ui-multi-select__all-dot" /> : option.color ? <span aria-hidden="true" className="resend-ui-multi-select__dot" style={{ backgroundColor: option.color }} /> : null}
                  <span className="resend-ui-multi-select__option-label">{option.label}</span>
                  {selected ? <Check aria-hidden="true" className="resend-ui-multi-select__check" size={14} /> : null}
                </button>
                {isAllOption && visibleOptions.length > 1 ? <div aria-hidden="true" className="resend-ui-multi-select__separator" /> : null}
              </Fragment>
            );
          })}
        </div>
      </RadixPopover.Content>
    </RadixPopover.Portal>
  );
}

const MultiSelect = { Content: MultiSelectContent, Root: MultiSelectRoot, Trigger: MultiSelectTrigger };

export { MultiSelect, MultiSelectContent, MultiSelectRoot, MultiSelectTrigger };
export type { MultiSelectContentProps, MultiSelectOption, MultiSelectRootProps, MultiSelectTriggerProps };
