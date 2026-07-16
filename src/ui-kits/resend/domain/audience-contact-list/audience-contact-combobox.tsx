import { Popover as RadixPopover } from 'radix-ui';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type { AudienceSegment } from './types';

type AudienceContactComboboxOption = {
  readonly badge?: string;
  readonly disabled?: boolean;
  readonly id: string;
  readonly label: string;
};

type AudienceContactComboboxProps = {
  readonly ariaLabel: string;
  readonly createError?: ((query: string) => string | null) | undefined;
  readonly createLabel?: ((query: string) => ReactNode) | undefined;
  readonly emptyLabel: string;
  readonly invalid?: boolean;
  readonly onCreate?: ((query: string) => void) | undefined;
  readonly onSelect: (option: AudienceContactComboboxOption) => void;
  readonly options: readonly AudienceContactComboboxOption[];
  readonly placeholder: string;
  readonly selectedBadge?: string | undefined;
  readonly selectedId?: string | undefined;
  readonly selectedLabel?: string | undefined;
};

function AudienceContactCombobox({
  ariaLabel,
  createError,
  createLabel,
  emptyLabel,
  invalid = false,
  onCreate,
  onSelect,
  options,
  placeholder,
  selectedBadge,
  selectedId,
  selectedLabel,
}: AudienceContactComboboxProps) {
  const listId = useId();
  const createOptionId = `${listId}-create`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = useMemo(() => options.filter((option) => (
    option.label.toLowerCase().includes(normalizedQuery)
  )), [normalizedQuery, options]);
  const hasExactMatch = options.some((option) => option.label.toLowerCase() === normalizedQuery);
  const nextCreateError = normalizedQuery.length > 0 ? createError?.(query.trim()) ?? null : null;
  const showCreate = normalizedQuery.length > 0 && !hasExactMatch && createLabel !== undefined && onCreate !== undefined;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery('');
      setActiveId(null);
    }
  }

  function selectOption(option: AudienceContactComboboxOption) {
    if (option.disabled) return;
    onSelect(option);
    handleOpenChange(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const enabledOptions = visibleOptions.filter((option) => !option.disabled);
    if (event.key === 'Escape') {
      handleOpenChange(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      if (enabledOptions.length === 0) return;
      const currentIndex = enabledOptions.findIndex((option) => option.id === activeId);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = currentIndex === -1
        ? direction === 1 ? 0 : enabledOptions.length - 1
        : (currentIndex + direction + enabledOptions.length) % enabledOptions.length;
      setActiveId(enabledOptions[nextIndex]?.id ?? null);
      return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const activeOption = enabledOptions.find((option) => option.id === activeId)
      ?? enabledOptions.find((option) => option.label.toLowerCase() === normalizedQuery);
    if (activeOption) {
      selectOption(activeOption);
      return;
    }
    if (showCreate && nextCreateError === null) {
      onCreate?.(query.trim());
      handleOpenChange(false);
    }
  }

  return (
    <RadixPopover.Root onOpenChange={handleOpenChange} open={open}>
      <RadixPopover.Trigger asChild>
        <div
          className="resend-ui-audience-contact-combobox__trigger"
          data-invalid={invalid ? '' : undefined}
          data-open={open ? '' : undefined}
        >
          <input
            aria-activedescendant={activeId === createOptionId
              ? createOptionId
              : activeId ? `${listId}-option-${activeId}` : undefined}
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={open}
            aria-label={ariaLabel}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setActiveId(null);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={open ? 'Search' : placeholder}
            role="combobox"
            value={open ? query : selectedLabel ?? ''}
          />
          {!open && selectedBadge ? <small>{selectedBadge}</small> : null}
          <ChevronDown aria-hidden="true" size={16} />
        </div>
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align="start"
          className="resend-ui-audience-contact-combobox__content"
          onOpenAutoFocus={(event) => event.preventDefault()}
          sideOffset={8}
        >
          <div className="resend-ui-audience-contact-combobox__list" id={listId} role="listbox">
            {visibleOptions.map((option) => (
              <button
                aria-disabled={option.disabled || undefined}
                aria-selected={option.id === selectedId}
                className="resend-ui-audience-contact-combobox__option"
                data-active={option.id === activeId ? '' : undefined}
                disabled={option.disabled}
                id={`${listId}-option-${option.id}`}
                key={option.id}
                onClick={() => selectOption(option)}
                onMouseEnter={() => setActiveId(option.disabled ? null : option.id)}
                role="option"
                type="button"
              >
                <span>{option.label}</span>
                {option.badge ? <small>{option.badge}</small> : null}
                {option.id === selectedId ? <Check aria-hidden="true" size={14} /> : null}
              </button>
            ))}
            {showCreate && nextCreateError === null ? (
              <button
                aria-selected="false"
                className="resend-ui-audience-contact-combobox__option"
                data-active={activeId === createOptionId ? '' : undefined}
                id={createOptionId}
                onClick={() => {
                  onCreate(query.trim());
                  handleOpenChange(false);
                }}
                onMouseEnter={() => setActiveId(createOptionId)}
                role="option"
                type="button"
              >
                <Plus aria-hidden="true" size={14} />
                <span>{createLabel(query.trim())}</span>
              </button>
            ) : null}
            {showCreate && nextCreateError !== null ? (
              <button
                aria-disabled="true"
                aria-selected="false"
                className="resend-ui-audience-contact-combobox__option resend-ui-audience-contact-combobox__option--create-invalid"
                disabled
                role="option"
                type="button"
              >
                <Plus aria-hidden="true" size={14} />
                <span>{createLabel(query.trim())}</span>
                <em>{nextCreateError}</em>
              </button>
            ) : null}
            {visibleOptions.length === 0 && !showCreate ? (
              <p className="resend-ui-audience-contact-combobox__message">{emptyLabel}</p>
            ) : null}
          </div>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

type AudienceContactTagOption = {
  readonly id: string;
  readonly name: string;
};

type AudienceContactTagSelectorProps = {
  readonly ariaLabel: string;
  readonly onChange: (value: readonly string[]) => void;
  readonly options: readonly AudienceContactTagOption[];
  readonly placeholder: string;
  readonly value: readonly string[];
};

function AudienceContactTagSelector({
  ariaLabel,
  onChange,
  options,
  placeholder,
  value,
}: AudienceContactTagSelectorProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const selectedOptions = value
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is AudienceContactTagOption => option !== undefined);
  const visibleOptions = options.filter((option) => (
    !value.includes(option.id)
    && option.name.toLowerCase().includes(query.trim().toLowerCase())
  ));

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery('');
      setActiveId(null);
    }
  }

  function remove(optionId: string) {
    onChange(value.filter((id) => id !== optionId));
  }

  function select(optionId: string) {
    if (value.includes(optionId)) return;
    onChange([...value, optionId]);
    setQuery('');
    setActiveId(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      handleOpenChange(false);
      return;
    }
    if (event.key === 'Backspace' && query.length === 0 && value.length > 0) {
      onChange(value.slice(0, -1));
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      if (visibleOptions.length === 0) return;
      const currentIndex = visibleOptions.findIndex((option) => option.id === activeId);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = currentIndex === -1
        ? direction === 1 ? 0 : visibleOptions.length - 1
        : (currentIndex + direction + visibleOptions.length) % visibleOptions.length;
      setActiveId(visibleOptions[nextIndex]?.id ?? null);
      return;
    }
    if ((event.key !== 'Enter' && event.key !== 'Tab') || visibleOptions.length === 0) return;
    event.preventDefault();
    select(activeId ?? visibleOptions[0]?.id ?? '');
  }

  return (
    <RadixPopover.Root onOpenChange={handleOpenChange} open={open}>
      <RadixPopover.Anchor asChild>
        <div
          aria-controls={listId}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="resend-ui-audience-contact-tag-selector__trigger"
          onClick={() => {
            inputRef.current?.focus();
            setOpen(true);
          }}
          role="combobox"
          tabIndex={-1}
        >
          {selectedOptions.map((option) => (
            <span className="resend-ui-audience-contact-tag-selector__tag" key={option.id}>
              <span>{option.name}</span>
              <button
                aria-label={`Remove ${option.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  remove(option.id);
                }}
                type="button"
              >
                <X aria-hidden="true" size={12} />
              </button>
            </span>
          ))}
          <input
            aria-activedescendant={activeId ? `${listId}-option-${activeId}` : undefined}
            aria-autocomplete="list"
            aria-label={ariaLabel}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setActiveId(null);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedOptions.length === 0 ? placeholder : ''}
            ref={inputRef}
            role="searchbox"
            value={query}
          />
        </div>
      </RadixPopover.Anchor>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align="start"
          className="resend-ui-audience-contact-combobox__content resend-ui-audience-contact-tag-selector__content"
          onOpenAutoFocus={(event) => event.preventDefault()}
          sideOffset={8}
        >
          <div className="resend-ui-audience-contact-combobox__list" id={listId} role="listbox">
            {visibleOptions.length === 0 ? (
              <p className="resend-ui-audience-contact-combobox__message">
                <strong>No results found</strong>
                <span>Try changing your search</span>
              </p>
            ) : null}
            {visibleOptions.map((option) => (
              <button
                aria-selected="false"
                className="resend-ui-audience-contact-combobox__option"
                data-active={option.id === activeId ? '' : undefined}
                id={`${listId}-option-${option.id}`}
                key={option.id}
                onClick={() => select(option.id)}
                onMouseEnter={() => setActiveId(option.id)}
                role="option"
                type="button"
              >
                <span>{option.name}</span>
              </button>
            ))}
          </div>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

function AudienceSegmentTagSelector({
  onChange,
  segments,
  value,
}: {
  readonly onChange: (value: readonly string[]) => void;
  readonly segments: readonly AudienceSegment[];
  readonly value: readonly string[];
}) {
  return (
    <AudienceContactTagSelector
      ariaLabel="Segments"
      onChange={onChange}
      options={segments}
      placeholder="Optionally add to existing segments..."
      value={value}
    />
  );
}

export { AudienceContactCombobox, AudienceContactTagSelector, AudienceSegmentTagSelector };
export type {
  AudienceContactComboboxOption,
  AudienceContactTagOption,
  AudienceContactTagSelectorProps,
};
