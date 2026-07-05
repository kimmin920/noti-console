'use client';

import { createPortal } from 'react-dom';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';

const defaultRecipientSelectContactNames = [
  '김민준',
  '이서연',
  '박지훈',
  '최하윤',
  '정도윤',
  '강서아',
  '조하준',
  '윤지우',
  '장시우',
  '임하린',
];

const defaultRecipientSelectContacts = Array.from({ length: 100 }, (_, index) => {
  const sequence = index + 1;

  return {
    detail: `010-${String(2000 + index).padStart(4, '0')}-${String(3000 + index).padStart(4, '0')}`,
    label: `${defaultRecipientSelectContactNames[index % defaultRecipientSelectContactNames.length]} ${String(sequence).padStart(2, '0')}`,
    type: 'contact',
    value: `contact:recipient-${String(sequence).padStart(3, '0')}`,
  };
});

const recipientGroupLabels = {
  all: '전체',
  contact: '연락처',
  direct: '직접 추가',
  manual: '직접 추가',
  segment: '세그먼트',
};

const recipientGroupOrder = ['direct', 'all', 'segment', 'contact'];
const recipientContactSearchMinLength = 2;
const recipientContactResultLimit = 50;

function getOptionType(option, fallbackType = 'segment') {
  return option.type ?? option.kind ?? fallbackType;
}

function getRecipientKey(option) {
  const type = getOptionType(option);
  const rawValue = typeof option === 'string' ? option : option.value;

  return String(rawValue).includes(':') ? String(rawValue) : `${type}:${rawValue}`;
}

function formatRecipientPhoneNumber(value) {
  const input = String(value ?? '').trim();

  if (!input || !/^[\d\s-]+$/.test(input)) {
    return input;
  }

  const digits = input.replace(/\D/g, '');

  if (digits.startsWith('02')) {
    if (digits.length === 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }

    if (digits.length === 10) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
  }

  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return input;
}

function normalizeOption(option, fallbackType = 'segment') {
  const type = getOptionType(option, fallbackType);
  const rawValue = String(option.value ?? option.label ?? '');
  const rawLabel = option.label ?? rawValue;
  const value = type === 'manual' ? formatRecipientPhoneNumber(rawValue) : rawValue;
  const label = type === 'manual' ? formatRecipientPhoneNumber(rawLabel) : rawLabel;
  const detail = type === 'manual' ? '' : option.detail ?? option.description ?? option.phone ?? option.email ?? '';

  return {
    ...option,
    detail,
    key: getRecipientKey({ ...option, type, value }),
    label,
    type,
    value,
  };
}

function getManualOption(query) {
  const value = query.trim();
  const formattedValue = formatRecipientPhoneNumber(value);
  const digits = value.replace(/\D/g, '');

  if (!value || !/^[\d\s-]+$/.test(value) || digits.length < 8) {
    return null;
  }

  return {
    detail: '',
    key: `manual:${formattedValue}`,
    label: formattedValue,
    type: 'manual',
    value: formattedValue,
  };
}

function getLimitedRecipientMatches(options, normalizedQuery, selectedKeySet, limit) {
  const matches = [];

  for (const option of options) {
    if (selectedKeySet.has(option.key) || !getRecipientSearchValue(option).includes(normalizedQuery)) {
      continue;
    }

    matches.push(option);

    if (matches.length >= limit) {
      break;
    }
  }

  return matches;
}

function isMatchingManualRecipient(option, manualOption) {
  if (!manualOption) {
    return false;
  }

  return [
    option.label,
    option.value,
    option.detail,
  ].some((item) => formatRecipientPhoneNumber(item) === manualOption.value);
}

function getRecipientGroups(options, groupOrder = recipientGroupOrder) {
  const groups = options.reduce((groupMap, option) => {
    const groupId = getRecipientGroupId(option);
    const existingGroup = groupMap.get(groupId);

    if (existingGroup) {
      existingGroup.options.push(option);
    } else {
      groupMap.set(groupId, { id: groupId, options: [option] });
    }

    return groupMap;
  }, new Map());

  return Array.from(groups.values()).sort((a, b) => (
    getRecipientGroupIndex(a.id, groupOrder) - getRecipientGroupIndex(b.id, groupOrder)
  ));
}

function getRecipientGroupId(option) {
  if (option.type === 'manual') {
    return 'direct';
  }

  if (option.type === 'all' || option.value === 'all') {
    return 'all';
  }

  return option.type;
}

function getRecipientGroupIndex(groupId, groupOrder = recipientGroupOrder) {
  const resolvedGroupOrder = Array.isArray(groupOrder) ? groupOrder : recipientGroupOrder;
  const index = resolvedGroupOrder.indexOf(groupId);

  if (index === -1) {
    return resolvedGroupOrder.length;
  }

  return index;
}

function getRecipientGroupLabel(groupId, groupLabels = recipientGroupLabels) {
  return groupLabels[groupId] ?? groupId.replace(/[-_]/g, ' ');
}

function getRecipientSearchValue(option) {
  return [
    option.label,
    option.value,
    option.detail,
  ].filter((item) => item !== undefined && item !== null).join(' ').toLowerCase();
}

function getRecipientOptionMeta(option) {
  if (option.type === 'manual') {
    return '';
  }

  if (option.count !== undefined) {
    return `${option.count.toLocaleString()}명`;
  }

  return option.detail;
}

function getRecipientTagMeta(option) {
  if (option.type === 'manual') {
    return '';
  }

  if (option.count !== undefined) {
    return `(${option.count.toLocaleString()})`;
  }

  return option.detail;
}

function normalizeSelectedItem(item, options) {
  if (!item) {
    return null;
  }

  if (typeof item === 'string') {
    const matchingOption = options.find((option) => option.value === item || option.key === item);

    if (matchingOption) {
      return matchingOption;
    }

    return normalizeOption({ label: item.replace(/^manual:/, ''), type: 'manual', value: item.replace(/^manual:/, '') }, 'manual');
  }

  const normalizedItem = normalizeOption(item, getOptionType(item, 'manual'));
  return options.find((option) => option.key === normalizedItem.key || option.value === normalizedItem.value) ?? normalizedItem;
}

function serializeRecipient(option) {
  return {
    ...(option.count !== undefined ? { count: option.count } : {}),
    ...(option.detail ? { detail: option.detail } : {}),
    label: option.label,
    type: option.type,
    value: option.value,
  };
}

export function RecipientSelect({
  ariaLabel,
  className = '',
  contacts = defaultRecipientSelectContacts,
  contactSearchMinLength = recipientContactSearchMinLength,
  contactResultLimit = recipientContactResultLimit,
  emptyActionLabel,
  emptyDescription = '저장된 수신자가 없습니다. 번호를 직접 입력해 발송하거나 수신자 화면에서 추가할 수 있습니다.',
  emptyNoResultsDescription = '다른 이름, 번호, 세그먼트를 입력하세요.',
  emptyNoResultsTitle = '결과 없음',
  emptyShortDescription = '2글자 이상 입력하면 연락처를 검색합니다.',
  emptyShortTitle = '검색어를 더 입력하세요',
  groupLabels,
  groupOrder = recipientGroupOrder,
  manualOptionFactory = getManualOption,
  menuPortal = false,
  multiple = true,
  onEmptyAction,
  onValueChange,
  options = [],
  placeholder = '수신자 추가...',
  searchPromptEmpty = '이름 또는 번호로 연락처를 검색하세요.',
  searchPromptShort = '2글자 이상 입력하면 연락처를 검색합니다.',
  value,
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState(null);
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const controlRef = useRef(null);
  const menuId = useId();
  const contactOptions = useMemo(() => contacts.map((option) => normalizeOption(option, 'contact')), [contacts]);
  const recipientOptions = useMemo(() => options.map((option) => normalizeOption(option, 'segment')), [options]);
  const resolvedGroupLabels = useMemo(() => ({
    ...recipientGroupLabels,
    ...groupLabels,
  }), [groupLabels]);
  const allOptions = useMemo(() => [
    ...recipientOptions,
    ...contactOptions,
  ], [contactOptions, recipientOptions]);
  const selectedRecipients = useMemo(() => {
    const selectedItems = Array.isArray(value) ? value : [value];

    return selectedItems.map((item) => normalizeSelectedItem(item, allOptions)).filter(Boolean);
  }, [allOptions, value]);
  const selectedKeySet = useMemo(() => new Set(selectedRecipients.map((item) => item.key)), [selectedRecipients]);
  const trimmedQuery = query.trim();
  const contactSearchReady = trimmedQuery.length >= contactSearchMinLength;
  const visibleOptions = useMemo(() => {
    const normalizedQuery = trimmedQuery.toLowerCase();
    const matchedRecipientOptions = recipientOptions.filter((option) => {
      if (selectedKeySet.has(option.key) && getRecipientGroupId(option) !== 'all') {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return getRecipientSearchValue(option).includes(normalizedQuery);
    });
    const contactMatches = contactSearchReady
      ? getLimitedRecipientMatches(contactOptions, normalizedQuery, selectedKeySet, contactResultLimit)
      : [];
    const rawManualOption = manualOptionFactory?.(query) ?? null;
    const manualOption = rawManualOption ? normalizeOption(rawManualOption, 'manual') : null;
    const nextOptions = [...matchedRecipientOptions, ...contactMatches];

    if (!manualOption || selectedKeySet.has(manualOption.key) || contactMatches.some((option) => isMatchingManualRecipient(option, manualOption))) {
      return nextOptions;
    }

    return [
      manualOption,
      ...nextOptions,
    ];
  }, [contactOptions, contactResultLimit, contactSearchReady, manualOptionFactory, query, recipientOptions, selectedKeySet, trimmedQuery]);
  const groups = useMemo(() => getRecipientGroups(visibleOptions, groupOrder), [groupOrder, visibleOptions]);
  const hasSelection = selectedRecipients.length > 0;
  const hasSavedRecipients = recipientOptions.length > 0 || contactOptions.length > 0;
  const showEmptyRecipientAction = !hasSavedRecipients && !trimmedQuery && !hasSelection && emptyActionLabel;
  const searchPrompt = !trimmedQuery
    ? searchPromptEmpty
    : !contactSearchReady
      ? searchPromptShort
      : '';
  const shouldPortalMenu = menuPortal && typeof document !== 'undefined';

  useEffect(() => {
    if (!open || !shouldPortalMenu) {
      return undefined;
    }

    let frame = 0;

    function updateMenuPosition() {
      const rect = controlRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportWidth = window.innerWidth;
      const width = Math.min(360, rect.width, Math.max(0, viewportWidth - 24));
      const left = Math.min(
        Math.max(12, rect.left),
        Math.max(12, viewportWidth - width - 12)
      );

      setMenuStyle({
        left,
        top: rect.bottom + 6,
        width,
      });
    }

    function scheduleMenuPositionUpdate() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateMenuPosition);
    }

    scheduleMenuPositionUpdate();
    window.addEventListener('resize', scheduleMenuPositionUpdate);
    window.addEventListener('scroll', scheduleMenuPositionUpdate, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleMenuPositionUpdate);
      window.removeEventListener('scroll', scheduleMenuPositionUpdate, true);
    };
  }, [open, shouldPortalMenu]);

  function focusInput() {
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function emitChange(nextRecipients) {
    if (multiple) {
      onValueChange?.(nextRecipients.map(serializeRecipient));
      return;
    }

    onValueChange?.(nextRecipients[0] ? serializeRecipient(nextRecipients[0]) : '');
  }

  function selectOption(option) {
    if (selectedKeySet.has(option.key)) {
      setQuery('');
      setOpen(true);
      setActiveIndex(0);
      focusInput();
      return;
    }

    const nextRecipients = multiple
      ? [...selectedRecipients, option]
      : [option];

    emitChange(nextRecipients);
    setQuery('');
    setOpen(multiple);
    setActiveIndex(0);
    focusInput();
  }

  function removeRecipient(option) {
    emitChange(selectedRecipients.filter((item) => item.key !== option.key));
    setQuery('');
    setOpen(true);
    setActiveIndex(0);
    focusInput();
  }

  function removeLastRecipient() {
    if (!selectedRecipients.length) {
      return;
    }

    emitChange(selectedRecipients.slice(0, -1));
    setOpen(true);
    setActiveIndex(0);
    focusInput();
  }

  function moveActive(delta) {
    if (!visibleOptions.length) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((current) => {
      const nextIndex = current + delta;

      if (nextIndex < 0) {
        return visibleOptions.length - 1;
      }

      if (nextIndex >= visibleOptions.length) {
        return 0;
      }

      return nextIndex;
    });
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      moveActive(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      moveActive(-1);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if ((event.key === 'Enter' || event.key === 'Tab') && open && visibleOptions[activeIndex]) {
      event.preventDefault();
      selectOption(visibleOptions[activeIndex]);
      return;
    }

    if (event.key === 'Backspace' && !query && selectedRecipients.length) {
      event.preventDefault();
      removeLastRecipient();
    }
  }

  const menu = open ? (
    <div
      className={[
        'email-send-form-recipient-menu',
        shouldPortalMenu ? 'is-portaled' : '',
        showEmptyRecipientAction && !visibleOptions.length ? 'sms-fallback-menu' : '',
      ].filter(Boolean).join(' ')}
      id={menuId}
      role="listbox"
      style={shouldPortalMenu && menuStyle ? {
        left: `${menuStyle.left}px`,
        top: `${menuStyle.top}px`,
        width: `${menuStyle.width}px`,
      } : undefined}
    >
      {visibleOptions.length ? (
        <>
          {groups.map((group, groupIndex) => (
            <div className="email-send-form-recipient-group" key={group.id}>
              {groupIndex > 0 ? <div className="email-send-form-recipient-separator" /> : null}
              {group.id === 'all' ? null : (
                <div className="email-send-form-recipient-group-label">
                  {getRecipientGroupLabel(group.id, resolvedGroupLabels)}
                </div>
              )}
              {group.options.map((option) => {
                const optionIndex = visibleOptions.findIndex((item) => item.key === option.key);
                const meta = getRecipientOptionMeta(option);

                return (
                  <button
                    aria-label={`${option.label} 선택`}
                    aria-selected={optionIndex === activeIndex}
                    className="email-send-form-recipient-option"
                    data-recipient-type={option.type}
                    id={`${menuId}-${option.key}`}
                    key={option.key}
                    onClick={() => selectOption(option)}
                    onMouseDown={(event) => event.preventDefault()}
                    role="option"
                    type="button"
                  >
                    <span className="email-send-form-recipient-option-main">
                      <span>{option.label}</span>
                      {meta && option.count === undefined ? (
                        <small>{meta}</small>
                      ) : null}
                    </span>
                    {option.count !== undefined ? (
                      <small className="email-send-form-recipient-option-count">{meta}</small>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
          {searchPrompt ? (
            <div className="email-send-form-recipient-search-note">{searchPrompt}</div>
          ) : null}
        </>
      ) : showEmptyRecipientAction ? (
        <>
          {emptyDescription ? <p className="sms-fallback-help">{emptyDescription}</p> : null}
          <button
            aria-label={emptyActionLabel}
            aria-selected="false"
            className="dropdown-menu-item sms-fallback-create"
            onClick={onEmptyAction}
            onMouseDown={(event) => event.preventDefault()}
            role="option"
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
            <span>{emptyActionLabel}</span>
          </button>
        </>
      ) : (
        <div className="email-send-form-recipient-empty">
          <strong>{contactSearchReady ? emptyNoResultsTitle : emptyShortTitle}</strong>
          <span>{contactSearchReady ? emptyNoResultsDescription : emptyShortDescription}</span>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div
      className={['email-send-form-recipient-field', className].filter(Boolean).join(' ')}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setQuery('');
          setActiveIndex(0);
        }
      }}
      ref={rootRef}
    >
      <div
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="email-send-form-recipient-control"
        data-state={open ? 'open' : 'closed'}
        onClick={() => {
          setOpen(true);
          focusInput();
        }}
        onKeyDown={handleKeyDown}
        ref={controlRef}
        role="combobox"
      >
        {selectedRecipients.map((recipient) => {
          const meta = getRecipientTagMeta(recipient);

          return (
            <span className="email-send-form-recipient-tag" data-recipient-type={recipient.type} key={recipient.key}>
              <span className="email-send-form-recipient-tag-label">
                <span>{recipient.label}</span>
                {meta ? <small>{meta}</small> : null}
              </span>
              <button
                aria-label={`${recipient.label} 제거`}
                className="email-send-form-recipient-remove"
                onClick={(event) => {
                  event.stopPropagation();
                  removeRecipient(recipient);
                }}
                type="button"
              >
                <X aria-hidden="true" size={14} />
              </button>
            </span>
          );
        })}
        <input
          aria-activedescendant={open && visibleOptions[activeIndex] ? `${menuId}-${visibleOptions[activeIndex].key}` : undefined}
          aria-autocomplete="list"
          aria-controls={open ? menuId : undefined}
          aria-label={ariaLabel}
          className="email-send-form-recipient-input"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          placeholder={hasSelection ? '' : placeholder}
          ref={inputRef}
          type="text"
          value={query}
        />
      </div>

      {shouldPortalMenu ? (menu && menuStyle ? createPortal(menu, document.body) : null) : menu}
    </div>
  );
}
