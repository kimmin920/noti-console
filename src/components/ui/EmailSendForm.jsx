'use client';

import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Calendar, CalendarX2, Check, ChevronDown, Clock, LoaderCircle, Plus, Search, TriangleAlert } from 'lucide-react';
import lottie from 'lottie-web';
import templatesAnimation from '../../nav-lotties/templates.json';
import {
  parseEmailSendFormScheduleDate,
  parseEmailSendFormScheduleText,
} from './emailSendFormSchedule.js';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './Dialog.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui-extensions/AppDropdownMenu.jsx';
import { RecipientSelect } from './RecipientSelect.jsx';
import { SubscribeTopicSelect } from './SubscribeTopicSelect.jsx';
import { Tooltip } from './Tooltip.jsx';

export const defaultEmailSendFormSegments = [
  { count: 1842, label: '전체 연락처', value: 'all' },
  { count: 408, label: '제품 업데이트 대상', value: 'product-updates' },
  { count: 126, label: '라이프사이클 사용자', value: 'lifecycle-users' },
];

export const defaultEmailSendFormTopics = [
  { label: '주제 없음', value: 'none' },
  { label: '제품 업데이트', value: 'product-updates' },
  { label: '거래성 안내', value: 'transactional-notices' },
];

export const defaultEmailSendFormSchedules = [
  { label: '내일', value: 'Tomorrow' },
  { label: '내일 오후', value: 'Tomorrow Afternoon' },
  { label: '내일 오전', value: 'Tomorrow Morning' },
  { label: '2일 후', value: 'In 2 days' },
];

export const defaultEmailSendFormTemplates = [
  {
    body: 'Hi there,\n\nWe shipped a new product update today. Here are the changes your team can use right away:\n\n- Faster delivery insights\n- Cleaner contact segments\n- Simpler message review\n\nThanks,\nThe team',
    from: '브랜드 <updates@example.com>',
    id: 'product-update',
    name: 'Product update',
    previewText: 'A short update about the latest product changes.',
    subject: 'Product update',
  },
  {
    body: 'Hi there,\n\nWelcome to the workspace. Start by adding your first audience segment, then send a test message to make sure everything looks right.\n\nThanks,\nThe team',
    from: '브랜드 <welcome@example.com>',
    id: 'welcome-email',
    name: 'Welcome email',
    previewText: 'A quick welcome note for new contacts.',
    subject: 'Welcome to the workspace',
  },
  {
    body: 'Hi there,\n\nHere is this week\'s digest:\n\n- New messages sent\n- Contacts added\n- Messages waiting for review\n\nSee you next week,\nThe team',
    from: '브랜드 <digest@example.com>',
    id: 'weekly-digest',
    name: 'Weekly digest',
    previewText: 'A concise weekly recap for your audience.',
    subject: 'Your weekly digest',
  },
];

export const EmailSendFormRecipientSelect = RecipientSelect;
export const EmailSendFormSubscribeTopicSelect = SubscribeTopicSelect;

const defaultEmailSendFormValue = {
  body: '',
  from: '브랜드 <updates@example.com>',
  previewText: '',
  recipient: 'all',
  replyTo: '',
  scheduledAt: '',
  subject: '제목 없는 발송',
  topic: 'none',
};

const EMAIL_FORMAT_MESSAGE = 'Invalid field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.';
const EMAIL_NON_ASCII_MESSAGE = 'Invalid field. The email address contains non-ASCII characters.';
const EMAIL_COLON_MESSAGE = 'Invalid field. The email address contains a colon.';
const EMAIL_MAX_LENGTH_MESSAGE = 'The email address should not be over 320 characters long.';
const FROM_REQUIRED_MESSAGE = 'The `from` field is required';
const PREVIEW_LIMIT_MESSAGE = 'Preview text has reached the 150 character limit.';
const SUBJECT_LENGTH_MESSAGE = 'Subject may be truncated. Most email clients display 70 characters or fewer.';
const SCHEDULE_MAX_DAYS = 50;

function getMessageValue(value) {
  const mergedValue = { ...defaultEmailSendFormValue, ...value };

  return {
    ...mergedValue,
    body: mergedValue.body ?? '',
    from: mergedValue.from ?? '',
    previewText: mergedValue.previewText ?? '',
    recipient: mergedValue.recipient ?? '',
    replyTo: mergedValue.replyTo ?? '',
    scheduledAt: mergedValue.scheduledAt ?? '',
    subject: mergedValue.subject ?? '',
    topic: mergedValue.topic ?? '',
  };
}

function getOption(options, value) {
  return options.find((option) => option.value === value) ?? null;
}

function getTemplateString(...values) {
  return values.find((item) => typeof item === 'string');
}

function formatScheduledAt(value) {
  const date = new Date(value);

  if (date.toString() === 'Invalid Date') {
    return '';
  }

  const currentYear = new Date().getFullYear();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const meridiem = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 || 12;
  const displayDate = year === currentYear
    ? `${month}월 ${day}일`
    : `${year}년 ${month}월 ${day}일`;
  const displayTime = `${meridiem} ${displayHour}시${minute ? ` ${minute}분` : ''}`;

  return `${displayDate} ${displayTime}`;
}

function getScheduleDisplayValue(value) {
  return formatScheduledAt(value) || value || '';
}

function getUserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function getScheduleTimezoneLabel(timeZone) {
  try {
    const date = new Date();
    const locale = typeof navigator === 'undefined' ? 'en-US' : navigator.language;
    const shortOffsetPart = new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: 'numeric',
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(date).find((part) => part.type === 'timeZoneName');
    const shortOffset = shortOffsetPart?.value || '';
    const [area = 'Unknown', city = ''] = timeZone.split('/');
    const cityName = city
      ? city.split('_').map((item) => {
        if (!item) {
          return '';
        }

        return item.toUpperCase() === item
          ? item
          : item.charAt(0).toUpperCase() + item.slice(1).toLowerCase();
      }).filter(Boolean).join(' ')
      : city;

    if (timeZone === 'Asia/Seoul') {
      return `Asia/서울 (${shortOffset})`;
    }

    if (cityName) {
      return `${area}/${cityName} (${shortOffset})`;
    }

    return `${timeZone.replaceAll('_', ' ')} (${shortOffset})`;
  } catch {
    return timeZone;
  }
}

function getParsedScheduleOption(option, timeZone) {
  if (!option.value && !option.label) {
    return null;
  }

  const date = parseEmailSendFormScheduleDate(option.value || option.label, timeZone);

  if (!date) {
    return null;
  }

  return {
    label: option.label,
    originalText: option.originalText,
    value: date.toISOString(),
  };
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function maxScheduledAtAsText() {
  return `${SCHEDULE_MAX_DAYS} days`;
}

function isValidScheduleDate(value) {
  const date = new Date(value);
  const now = new Date();

  return !Number.isNaN(date.getTime())
    && date >= now
    && date <= addHours(now, SCHEDULE_MAX_DAYS * 24);
}

function validateEmail(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const [, afterClosingBracket = ''] = value.split('>');

  if (afterClosingBracket.length > 0) {
    return false;
  }

  if (/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(value)) {
    return true;
  }

  if (value.includes('<') && value.includes('>')) {
    const [name, emailPart = ''] = value.split('<');
    const email = emailPart.substring(0, emailPart.lastIndexOf('>')).trim();

    return name.trim().length > 0 && /^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(email);
  }

  return false;
}

function getEmailAddressForValidation(value) {
  if (!value.includes('<')) {
    return value;
  }

  return value.split('<')[1]?.split('>')[0] ?? value;
}

function getEmailValidationMessage(value, { field = 'from', required = false } = {}) {
  const trimmed = String(value ?? '').trim();

  if (!trimmed) {
    return required ? FROM_REQUIRED_MESSAGE : '';
  }

  const address = getEmailAddressForValidation(trimmed);

  if ([...address].some((character) => character.charCodeAt(0) > 127)) {
    return field === 'reply-to'
      ? 'The reply-to field is invalid. The email address contains non-ASCII characters.'
      : EMAIL_NON_ASCII_MESSAGE;
  }

  if (trimmed.includes(':')) {
    return field === 'reply-to'
      ? 'The reply-to field is invalid. The email address contains a colon.'
      : EMAIL_COLON_MESSAGE;
  }

  if (trimmed.length > 320) {
    return field === 'reply-to'
      ? 'The reply-to field should not be over 320 characters long.'
      : EMAIL_MAX_LENGTH_MESSAGE;
  }

  if (!validateEmail(trimmed)) {
    return field === 'reply-to'
      ? 'The reply-to field is invalid. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.'
      : EMAIL_FORMAT_MESSAGE;
  }

  return '';
}

function getReviewWarnings(message, severity = 'error', id = 'review-warning') {
  return message ? [{ id, message, severity }] : [];
}

function getReplyToWarnings(value) {
  const addresses = String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);

  for (const address of addresses) {
    const message = getEmailValidationMessage(address, { field: 'reply-to' });

    if (message) {
      return getReviewWarnings(message, 'error', `reply-to-${message}`);
    }
  }

  return [];
}

function getScheduleWarnings(value, reviewMessage) {
  const message = reviewMessage || (value && !isValidScheduleDate(value) ? 'Invalid date' : '');

  return getReviewWarnings(
    message ? `${message}. It should be between now and ${maxScheduledAtAsText()}.` : '',
    'error',
    'schedule-error'
  );
}

function getPrimaryWarningMessage(warnings) {
  return warnings.map((warning) => warning.message).filter(Boolean).join('\n');
}

export function EmailSendForm({
  className = '',
  defaultValue,
  onChange,
  onTemplateSelect,
  scheduleOptions = defaultEmailSendFormSchedules,
  segments = defaultEmailSendFormSegments,
  templates = defaultEmailSendFormTemplates,
  topics = defaultEmailSendFormTopics,
  value,
  ...props
}) {
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(() => getMessageValue(defaultValue));
  const message = getMessageValue(isControlled ? value : uncontrolledValue);
  const [visibleFields, setVisibleFields] = useState(() => ({
    previewText: Boolean(message.previewText),
    replyTo: Boolean(message.replyTo),
    schedule: Boolean(message.scheduledAt),
  }));
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [scheduleReviewMessage, setScheduleReviewMessage] = useState('');
  const senderWarnings = getReviewWarnings(
    getEmailValidationMessage(message.from, { required: true }),
    'error',
    'sender-error'
  );
  const replyToWarnings = getReplyToWarnings(message.replyTo);
  const scheduleWarnings = getScheduleWarnings(message.scheduledAt, scheduleReviewMessage);
  const previewTextWarnings = getReviewWarnings(
    message.previewText.length >= 150 ? PREVIEW_LIMIT_MESSAGE : '',
    'error',
    'preview-text-limit'
  );
  const subjectWarnings = getReviewWarnings(
    message.subject.length > 70 ? SUBJECT_LENGTH_MESSAGE : '',
    'warning',
    'subject-length'
  );

  function updateMessage(patch) {
    const nextValue = { ...message, ...patch };

    if (!isControlled) {
      setUncontrolledValue(nextValue);
    }

    onChange?.(nextValue);
  }

  function showField(field) {
    setVisibleFields((current) => ({ ...current, [field]: true }));
  }

  function hideEmptyField(field, prop) {
    if (!message[prop]) {
      setVisibleFields((current) => ({ ...current, [field]: false }));
    }
  }

  function hideOnEmptyBackspace(event, field, prop) {
    if (event.key === 'Backspace' && !event.currentTarget.value) {
      setVisibleFields((current) => ({ ...current, [field]: false }));
    }
  }

  function handleTemplateSelect(template) {
    const templateBody = getTemplateString(template.body, template.html, template.content);
    const templateFrom = getTemplateString(template.from);
    const templatePreviewText = getTemplateString(template.previewText, template.preview_text);
    const templateReplyTo = getTemplateString(template.replyTo, template.reply_to);
    const templateSubject = getTemplateString(template.subject);
    const nextValue = {
      body: templateBody ?? message.body,
      from: templateFrom ?? message.from,
      previewText: templatePreviewText ?? message.previewText,
      replyTo: templateReplyTo ?? message.replyTo,
      scheduledAt: template.scheduledAt ?? message.scheduledAt,
      subject: templateSubject ?? message.subject,
    };

    updateMessage(nextValue);
    setVisibleFields((current) => ({
      ...current,
      previewText: Boolean(nextValue.previewText) || current.previewText,
      replyTo: Boolean(nextValue.replyTo) || current.replyTo,
      schedule: Boolean(nextValue.scheduledAt) || current.schedule,
    }));
    onTemplateSelect?.(template);
  }

  const isBodyEmpty = !message.body.trim();

  return (
    <EmailSendFormRoot className={className} {...props}>
      <EmailSendFormSelection>
        <EmailSendFormRow
          action={!visibleFields.replyTo ? (
            <EmailSendFormGhostButton onClick={() => showField('replyTo')}>
              답장 주소
            </EmailSendFormGhostButton>
          ) : null}
        >
          <EmailSendFormLabel htmlFor="email-send-form-from" warnings={senderWarnings}>
            발신자
          </EmailSendFormLabel>
          <EmailSendFormInput
            aria-invalid={senderWarnings.length ? 'true' : undefined}
            className={senderWarnings.length ? 'review-error' : ''}
            id="email-send-form-from"
            onChange={(event) => updateMessage({ from: event.target.value })}
            placeholder="브랜드 <brand@example.com>"
            spellCheck={false}
            type="text"
            value={message.from}
          />
        </EmailSendFormRow>

        {visibleFields.replyTo ? (
          <EmailSendFormDisclosure>
            <EmailSendFormRow>
              <EmailSendFormLabel htmlFor="email-send-form-reply-to" warnings={replyToWarnings}>
                답장 주소
              </EmailSendFormLabel>
              <EmailSendFormInput
                aria-invalid={replyToWarnings.length ? 'true' : undefined}
                className={replyToWarnings.length ? 'review-error' : ''}
                id="email-send-form-reply-to"
                onBlur={() => hideEmptyField('replyTo', 'replyTo')}
                onChange={(event) => updateMessage({ replyTo: event.target.value })}
                onKeyDown={(event) => hideOnEmptyBackspace(event, 'replyTo', 'replyTo')}
                placeholder="reply@example.com"
                spellCheck={false}
                type="text"
                value={message.replyTo}
              />
            </EmailSendFormRow>
          </EmailSendFormDisclosure>
        ) : null}

        <EmailSendFormRow
          action={!visibleFields.schedule ? (
            <EmailSendFormGhostButton onClick={() => showField('schedule')}>
              언제
            </EmailSendFormGhostButton>
          ) : null}
        >
          <EmailSendFormLabel>수신자</EmailSendFormLabel>
          <EmailSendFormRecipientSelect
            ariaLabel="수신자 선택"
            onValueChange={(recipient) => updateMessage({ recipient })}
            options={segments}
            value={message.recipient}
          />
        </EmailSendFormRow>

        <EmailSendFormRow>
          <EmailSendFormLabel>구독 주제</EmailSendFormLabel>
          <EmailSendFormSubscribeTopicSelect
            ariaLabel="주제 선택"
            createLabel="주제 만들기"
            description="수신거부 페이지의 Topics를 사용하면 사용자가 받고 싶은 콘텐츠를 직접 선택할 수 있습니다."
            onValueChange={(topic) => updateMessage({ topic })}
            options={topics}
            placeholder="주제 선택"
            value={message.topic}
          />
        </EmailSendFormRow>

        {visibleFields.schedule ? (
          <EmailSendFormDisclosure>
            <EmailSendFormRow>
              <EmailSendFormLabel htmlFor="email-send-form-when" warnings={scheduleWarnings}>
                언제
              </EmailSendFormLabel>
              <EmailSendFormScheduleField
                id="email-send-form-when"
                onCollapseEmpty={() => hideEmptyField('schedule', 'scheduledAt')}
                onEmptyBackspace={(event) => hideOnEmptyBackspace(event, 'schedule', 'scheduledAt')}
                onReviewMessageChange={setScheduleReviewMessage}
                onNowSelect={() => {
                  setScheduleReviewMessage('');
                  updateMessage({ scheduledAt: '' });
                  setVisibleFields((current) => ({ ...current, schedule: false }));
                }}
                onValueChange={(scheduledAt) => updateMessage({ scheduledAt })}
                options={scheduleOptions}
                placeholder="Enter a date or time..."
                value={message.scheduledAt}
              />
            </EmailSendFormRow>
          </EmailSendFormDisclosure>
        ) : null}

        {visibleFields.previewText ? (
          <EmailSendFormDisclosure>
            <EmailSendFormRow className="email-send-form-preview-row">
              <EmailSendFormLabel htmlFor="email-send-form-preview" warnings={previewTextWarnings}>
                미리보기 문구
              </EmailSendFormLabel>
              <EmailSendFormInput
                aria-invalid={previewTextWarnings.length ? 'true' : undefined}
                className={previewTextWarnings.length ? 'review-error' : ''}
                id="email-send-form-preview"
                maxLength={150}
                onBlur={() => hideEmptyField('previewText', 'previewText')}
                onChange={(event) => updateMessage({ previewText: event.target.value })}
                onKeyDown={(event) => hideOnEmptyBackspace(event, 'previewText', 'previewText')}
                placeholder="수신함에서 제목 옆에 표시됩니다..."
                type="text"
                value={message.previewText}
              />
            </EmailSendFormRow>
          </EmailSendFormDisclosure>
        ) : null}

        <EmailSendFormRow
          action={!visibleFields.previewText ? (
            <EmailSendFormGhostButton onClick={() => showField('previewText')}>
              미리보기 문구
            </EmailSendFormGhostButton>
          ) : null}
          className="email-send-form-subject-row"
        >
          <EmailSendFormLabel htmlFor="email-send-form-subject" warnings={subjectWarnings}>
            제목
          </EmailSendFormLabel>
          <EmailSendFormInput
            className={subjectWarnings.length ? 'review-warning' : ''}
            id="email-send-form-subject"
            onChange={(event) => updateMessage({ subject: event.target.value })}
            placeholder="제목을 입력하세요"
            type="text"
            value={message.subject}
          />
        </EmailSendFormRow>
      </EmailSendFormSelection>

      <EmailSendFormCanvas aria-label="메시지 본문" data-empty={isBodyEmpty ? 'true' : undefined}>
        {isBodyEmpty ? (
          <EmailSendFormEmptyState
            onOpenTemplateDialog={() => setTemplateDialogOpen(true)}
            onTemplateSelect={handleTemplateSelect}
            onTemplateDialogOpenChange={setTemplateDialogOpen}
            templateDialogOpen={templateDialogOpen}
            templates={templates}
          />
        ) : null}
        <EmailSendFormTextarea
          aria-label="메시지 본문"
          onChange={(event) => updateMessage({ body: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === '/' && isBodyEmpty) {
              event.preventDefault();
              setTemplateDialogOpen(true);
            }
          }}
          placeholder={isBodyEmpty ? '' : 'Start writing your broadcast...'}
          rows={9}
          value={message.body}
        />
      </EmailSendFormCanvas>
    </EmailSendFormRoot>
  );
}

export const EmailSendFormRoot = forwardRef(function EmailSendFormRoot(
  { children, className = '', ...props },
  ref
) {
  return (
    <section className={['email-send-form-root', className].filter(Boolean).join(' ')} ref={ref} {...props}>
      {children}
    </section>
  );
});

export const EmailSendFormSelection = forwardRef(function EmailSendFormSelection(
  { children, className = '', ...props },
  ref
) {
  return (
    <div
      className={[
        'email-send-form-selection',
        'editorSelection',
        'select-none',
        'mx-auto',
        'w-full',
        'max-w-[600px]',
        'sm:px-0',
        className,
      ].filter(Boolean).join(' ')}
      ref={ref}
      {...props}
    >
      {children}
    </div>
  );
});

export const EmailSendFormRow = forwardRef(function EmailSendFormRow(
  { action, children, className = '', ...props },
  ref
) {
  return (
    <div className={['email-send-form-row', action ? 'has-action' : '', className].filter(Boolean).join(' ')} ref={ref} {...props}>
      {children}
      {action ? <div className="email-send-form-row-action">{action}</div> : null}
    </div>
  );
});

export function EmailSendFormDisclosure({ children, className = '', ...props }) {
  return (
    <div className={['email-send-form-disclosure', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}

export function EmailSendFormLabel({
  children,
  className = '',
  warning = '',
  warnings = [],
  ...props
}) {
  const LabelElement = props.htmlFor ? 'label' : 'span';
  const reviewWarnings = warnings.length ? warnings : getReviewWarnings(warning, 'error');

  return (
    <LabelElement className={['email-send-form-label', className].filter(Boolean).join(' ')} {...props}>
      <EmailSendFormFieldWarningIcon warnings={reviewWarnings} />
      <span className="email-send-form-label-text">{children}</span>
    </LabelElement>
  );
}

function EmailSendFormFailedIcon(props) {
  return (
    <svg fill="none" height="20" viewBox="0 0 24 24" width="20" {...props}>
      <path
        d="M12 19.5C16.1421 19.5 19.5 16.1421 19.5 12C19.5 7.85786 16.1421 4.5 12 4.5C7.85786 4.5 4.5 7.85786 4.5 12C4.5 16.1421 7.85786 19.5 12 19.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M14.5 9.5L9.5 14.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M9.5 9.5L14.5 14.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function EmailSendFormFieldWarningIcon({ warnings = [] }) {
  const activeWarnings = warnings.filter(Boolean);

  if (!activeWarnings.length) {
    return null;
  }

  const hasError = activeWarnings.some((item) => !item.severity || item.severity === 'error');
  const severity = hasError ? 'error' : 'warning';
  const message = getPrimaryWarningMessage(activeWarnings);

  return (
    <Tooltip
      className="email-send-form-field-warning-tooltip"
      content={message}
      contentClassName="email-send-form-field-warning-tooltip-content"
      maxWidth="20rem"
      side="left"
      type="description"
    >
      <span
        aria-label={message}
        className="email-send-form-field-warning-icon"
        data-severity={severity}
        role="img"
        tabIndex={0}
      >
        {hasError ? (
          <EmailSendFormFailedIcon aria-hidden="true" />
        ) : (
          <TriangleAlert aria-hidden="true" size={16} />
        )}
      </span>
    </Tooltip>
  );
}

export function EmailSendFormScheduleField({
  id,
  onCollapseEmpty,
  onEmptyBackspace,
  onNowSelect,
  onReviewMessageChange,
  onValueChange,
  options,
  placeholder,
  value,
}) {
  const [displayValue, setDisplayValue] = useState(() => getScheduleDisplayValue(value));
  const [isParsing, setIsParsing] = useState(false);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const parseTimerRef = useRef(null);
  const timeZone = getUserTimeZone();
  const presetOptions = useMemo(
    () => options.map((option) => getParsedScheduleOption(option, timeZone)).filter(Boolean),
    [options, timeZone]
  );
  const filteredOptions = useMemo(() => {
    const normalizedValue = displayValue.trim().toLowerCase();

    return presetOptions.filter((option) => (
      !normalizedValue || option.label.toLowerCase().includes(normalizedValue)
    ));
  }, [displayValue, presetOptions]);
  const parsedOption = useMemo(() => {
    if (!displayValue.trim() || filteredOptions.length > 0) {
      return null;
    }

    return parseEmailSendFormScheduleText(displayValue, timeZone);
  }, [displayValue, filteredOptions.length, timeZone]);
  const parsedScheduleIsInvalid = parsedOption && !isValidScheduleDate(parsedOption.value);
  const valueScheduleIsInvalid = value && !isValidScheduleDate(value);
  const hasInvalidSchedule = Boolean(displayValue.trim()) && !isParsing && (
    valueScheduleIsInvalid || parsedScheduleIsInvalid || (!parsedOption && filteredOptions.length === 0)
  );
  const scheduleReviewMessage = hasInvalidSchedule ? 'Invalid date' : '';

  useEffect(() => () => {
    if (parseTimerRef.current) {
      clearTimeout(parseTimerRef.current);
    }
  }, []);

  useEffect(() => {
    onReviewMessageChange?.(scheduleReviewMessage);
  }, [onReviewMessageChange, scheduleReviewMessage]);

  function selectOption(option) {
    if (!option) {
      onReviewMessageChange?.('');
      onNowSelect?.();
      setDisplayValue('');
    } else {
      onValueChange?.(option.value);
      onReviewMessageChange?.(isValidScheduleDate(option.value) ? '' : 'Invalid date');
      setDisplayValue(formatScheduledAt(option.value));
    }

    if (parseTimerRef.current) {
      clearTimeout(parseTimerRef.current);
    }

    setIsParsing(false);
    setOpen(false);
  }

  function updateScheduleInput(nextValue) {
    setDisplayValue(nextValue);
    setOpen(true);

    if (parseTimerRef.current) {
      clearTimeout(parseTimerRef.current);
    }

    if (!nextValue.trim()) {
      setIsParsing(false);
      onValueChange?.('');
      onReviewMessageChange?.('');
      return;
    }

    setIsParsing(true);
    parseTimerRef.current = setTimeout(() => {
      setIsParsing(false);

      const parsedSchedule = parseEmailSendFormScheduleText(nextValue, timeZone);

      if (parsedSchedule) {
        onValueChange?.(parsedSchedule.value);
        onReviewMessageChange?.(isValidScheduleDate(parsedSchedule.value) ? '' : 'Invalid date');
      } else {
        onReviewMessageChange?.('Invalid date');
      }
    }, 300);
  }

  return (
    <div
      className="email-send-form-schedule-field"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          if (!displayValue) {
            onCollapseEmpty?.();
          }
        }
      }}
    >
      <EmailSendFormInput
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={hasInvalidSchedule ? 'true' : undefined}
        className={hasInvalidSchedule ? 'review-error' : ''}
        id={id}
        onChange={(event) => updateScheduleInput(event.target.value)}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            return;
          }

          if (event.key === 'Backspace' && !event.currentTarget.value) {
            setOpen(false);
            onEmptyBackspace?.(event);
          }
        }}
        placeholder={placeholder}
        spellCheck={false}
        type="text"
        value={displayValue}
      />
      {open ? (
        <div className="email-send-form-schedule-menu" id={menuId} role="listbox">
          <div className="email-send-form-schedule-list">
            <button
              aria-selected={!value}
              className="email-send-form-schedule-option"
              onClick={() => {
                if (parseTimerRef.current) {
                  clearTimeout(parseTimerRef.current);
                }

                setIsParsing(false);
                setDisplayValue('');
                setOpen(false);
                setTimeout(() => onNowSelect?.(), 300);
              }}
              onMouseDown={(event) => event.preventDefault()}
              role="option"
              type="button"
            >
              <span className="email-send-form-schedule-option-label">
                <Clock aria-hidden="true" size={16} />
                <span>지금</span>
              </span>
            </button>
            {isParsing ? (
              <div className="email-send-form-schedule-status">
                <LoaderCircle aria-hidden="true" className="email-send-form-spin" size={16} />
                <span>날짜 확인 중...</span>
              </div>
            ) : null}
            {parsedOption && !isParsing ? (
              <button
                aria-selected={parsedOption.value === value}
                className="email-send-form-schedule-option"
                onClick={() => selectOption(parsedOption)}
                onMouseDown={(event) => event.preventDefault()}
                role="option"
                type="button"
              >
                <EmailSendFormScheduleOptionContent option={parsedOption} />
              </button>
            ) : null}
            {filteredOptions.map((option) => (
              <button
                aria-selected={option.value === value}
                className="email-send-form-schedule-option"
                key={option.value}
                onClick={() => selectOption(option)}
                onMouseDown={(event) => event.preventDefault()}
                role="option"
                type="button"
              >
                <EmailSendFormScheduleOptionContent option={option} />
              </button>
            ))}
            {!isParsing && displayValue && !parsedOption && filteredOptions.length === 0 ? (
              <div className="email-send-form-schedule-status">
                <CalendarX2 aria-hidden="true" size={16} />
                <span>유효하지 않은 날짜 또는 시간</span>
              </div>
            ) : null}
          </div>
          <div className="email-send-form-schedule-timezone">
            {getScheduleTimezoneLabel(timeZone)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmailSendFormScheduleOptionContent({ option }) {
  return (
    <>
      <span className="email-send-form-schedule-option-label">
        <Calendar aria-hidden="true" size={16} />
        <span>{option.originalText || option.label}</span>
      </span>
      <span className="email-send-form-schedule-option-time">
        {formatScheduledAt(option.value)}
      </span>
    </>
  );
}

export const EmailSendFormInput = forwardRef(function EmailSendFormInput(
  { className = '', ...props },
  ref
) {
  return <input className={['email-send-form-input', className].filter(Boolean).join(' ')} ref={ref} {...props} />;
});

export const EmailSendFormTextarea = forwardRef(function EmailSendFormTextarea(
  { className = '', ...props },
  ref
) {
  return <textarea className={['email-send-form-textarea', className].filter(Boolean).join(' ')} ref={ref} {...props} />;
});

export function EmailSendFormEmptyState({
  className = '',
  initialSelectedTemplateId,
  onOpenTemplateDialog,
  onTemplateDialogOpenChange,
  onSelectedTemplateChange,
  onTemplateSelect,
  renderTemplateCard,
  renderToolbarAction,
  selectedTemplateId,
  selectionMode,
  templateDialogOpen,
  templates = defaultEmailSendFormTemplates,
  ...props
}) {
  return (
    <div
      className={['email-send-form-empty-state', className].filter(Boolean).join(' ')}
      data-testid="editor-empty-state"
      {...props}
    >
      <div className="email-send-form-empty-state-actions">
        <EmailSendFormTemplateDialog
          initialSelectedTemplateId={initialSelectedTemplateId}
          onOpenChange={onTemplateDialogOpenChange}
          onSelectedTemplateChange={onSelectedTemplateChange}
          onTemplateSelect={onTemplateSelect}
          open={templateDialogOpen}
          renderTemplateCard={renderTemplateCard}
          renderToolbarAction={renderToolbarAction}
          selectedTemplateId={selectedTemplateId}
          selectionMode={selectionMode}
          templates={templates}
          trigger={(
            <EmailSendFormTemplateButton onClick={onOpenTemplateDialog}>
              템플릿 선택
            </EmailSendFormTemplateButton>
          )}
        />
      </div>
    </div>
  );
}

function useEmailSendFormTemplateIconAnimation() {
  const containerRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const animation = lottie.loadAnimation({
      animationData: templatesAnimation,
      autoplay: false,
      container: containerRef.current,
      loop: false,
      renderer: 'svg',
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet',
        progressiveLoad: true,
      },
    });

    animationRef.current = animation;
    animation.goToAndStop(0, true);

    return () => {
      animation.destroy();
      animationRef.current = null;
    };
  }, []);

  return {
    containerRef,
    onMouseEnter() {
      const animation = animationRef.current;
      if (!animation) return;

      animation.stop();
      animation.setDirection(1);
      animation.setSpeed(1);
      animation.play();
    },
    onMouseLeave() {
      const animation = animationRef.current;
      if (!animation) return;

      animation.stop();
      animation.goToAndStop(0, true);
    },
  };
}

export const EmailSendFormTemplateButton = forwardRef(function EmailSendFormTemplateButton(
  { children = '템플릿 선택', className = '', onMouseEnter, onMouseLeave, type = 'button', ...props },
  ref
) {
  const {
    containerRef,
    onMouseEnter: playTemplateIcon,
    onMouseLeave: resetTemplateIcon,
  } = useEmailSendFormTemplateIconAnimation();

  return (
    <button
      className={['email-send-form-template-trigger', className].filter(Boolean).join(' ')}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        playTemplateIcon();
      }}
      onMouseLeave={(event) => {
        onMouseLeave?.(event);
        resetTemplateIcon();
      }}
      ref={ref}
      type={type}
      {...props}
    >
      <span className="email-send-form-template-trigger-icon">
        <span aria-hidden="true" className="email-send-form-template-lottie" ref={containerRef} />
      </span>
      <span>{children}</span>
    </button>
  );
});

function getTemplateDialogCardMeta(template) {
  const templateName = template.name ?? template.title ?? 'Untitled template';
  const templateSubject = template.subject ?? templateName;
  const templatePreviewText = template.previewText ?? template.preview_text;
  const cardKey = template.id ?? `${templateName}-${templateSubject}`;

  return {
    cardKey,
    id: String(cardKey),
    templateName,
    templatePreviewText,
    templateSubject,
  };
}

function normalizeTemplateDialogId(value) {
  return value === null || value === undefined ? '' : String(value);
}

function filterTemplateDialogItems(templates, query) {
  const templateItems = Array.isArray(templates) ? templates : [];
  const normalizedQuery = String(query ?? '').trim().toLowerCase();

  if (!normalizedQuery) {
    return templateItems;
  }

  return templateItems.filter((template) => {
    const { templateName, templatePreviewText, templateSubject } = getTemplateDialogCardMeta(template);
    const searchable = [
      templateName,
      template.title,
      template.alias,
      template.description,
      templateSubject,
      templatePreviewText,
    ].filter(Boolean).join(' ').toLowerCase();

    return searchable.includes(normalizedQuery);
  });
}

export function EmailSendFormTemplateDialog({
  beforePicker,
  description = 'Search and choose a published template to import into the editor.',
  emptyCopy,
  emptyTitle,
  initialSelectedTemplateId = '',
  onOpenChange,
  onSelectedTemplateChange,
  onTemplateSelect,
  open,
  renderTemplateCard,
  renderToolbarAction,
  searchLabel,
  searchPlaceholder,
  selectedTemplateId: controlledSelectedTemplateId,
  selectionMode = 'immediate',
  templates = defaultEmailSendFormTemplates,
  title = 'Choose a Template',
  trigger,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [internalSelectedTemplateId, setInternalSelectedTemplateId] = useState(() => normalizeTemplateDialogId(initialSelectedTemplateId));
  const [templateQuery, setTemplateQuery] = useState('');
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const isDeferredSelection = selectionMode === 'deferred';
  const isSelectionControlled = controlledSelectedTemplateId !== undefined;
  const selectedTemplateId = isSelectionControlled
    ? normalizeTemplateDialogId(controlledSelectedTemplateId)
    : internalSelectedTemplateId;
  const templateItems = useMemo(() => (Array.isArray(templates) ? templates : []), [templates]);
  const visibleTemplates = useMemo(
    () => filterTemplateDialogItems(templateItems, templateQuery),
    [templateItems, templateQuery]
  );
  const selectedTemplate = useMemo(
    () => templateItems.find((template) => getTemplateDialogCardMeta(template).id === selectedTemplateId) ?? null,
    [selectedTemplateId, templateItems]
  );
  const visibleTemplateIds = useMemo(
    () => new Set(visibleTemplates.map((template) => getTemplateDialogCardMeta(template).id)),
    [visibleTemplates]
  );
  const isSelectionVisible = Boolean(selectedTemplate && visibleTemplateIds.has(selectedTemplateId));

  function setSelectedTemplateId(nextTemplateId, template = null) {
    const normalizedTemplateId = normalizeTemplateDialogId(nextTemplateId);

    if (!isSelectionControlled) {
      setInternalSelectedTemplateId(normalizedTemplateId);
    }

    onSelectedTemplateChange?.(normalizedTemplateId, template);
  }

  function getTemplateById(templateId) {
    const normalizedTemplateId = normalizeTemplateDialogId(templateId);

    return templateItems.find((template) => getTemplateDialogCardMeta(template).id === normalizedTemplateId) ?? null;
  }

  function setOpen(nextOpen) {
    if (isDeferredSelection) {
      setTemplateQuery('');

      if (nextOpen) {
        const nextTemplateId = normalizeTemplateDialogId(initialSelectedTemplateId);
        setSelectedTemplateId(nextTemplateId, getTemplateById(nextTemplateId));
      } else {
        setSelectedTemplateId('', null);
      }
    }

    if (!isControlled) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  }

  function selectTemplate(template) {
    if (isDeferredSelection) {
      setSelectedTemplateId(getTemplateDialogCardMeta(template).id, template);
      return;
    }

    onTemplateSelect?.(template);
    setOpen(false);
  }

  function handleTemplateQueryChange(nextQuery) {
    setTemplateQuery(nextQuery);

    if (!isDeferredSelection || !selectedTemplateId) {
      return;
    }

    const nextVisibleTemplates = filterTemplateDialogItems(templateItems, nextQuery);
    const isSelectedTemplateStillVisible = nextVisibleTemplates.some((template) => (
      getTemplateDialogCardMeta(template).id === selectedTemplateId
    ));

    if (!isSelectedTemplateStillVisible) {
      setSelectedTemplateId('', null);
    }
  }

  const toolbarAction = isDeferredSelection && renderToolbarAction ? renderToolbarAction({
    clearSelection: () => setSelectedTemplateId('', null),
    closeDialog: () => setOpen(false),
    isSelectionVisible,
    selectedTemplate: isSelectionVisible ? selectedTemplate : null,
    selectedTemplateId: isSelectionVisible ? selectedTemplateId : '',
  }) : null;

  return (
    <Dialog onOpenChange={setOpen} open={isOpen}>
      {trigger !== null ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <EmailSendFormTemplateButton>
              템플릿 선택
            </EmailSendFormTemplateButton>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="email-send-form-template-dialog" size="large">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="email-send-form-template-dialog-description">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="email-send-form-template-dialog-body">
          {beforePicker}
          <EmailSendFormTemplatePicker
            emptyCopy={emptyCopy}
            emptyTitle={emptyTitle}
            onTemplateSelect={selectTemplate}
            onQueryChange={isDeferredSelection ? handleTemplateQueryChange : undefined}
            query={isDeferredSelection ? templateQuery : undefined}
            renderTemplateCard={renderTemplateCard}
            searchLabel={searchLabel}
            searchPlaceholder={searchPlaceholder}
            selectedTemplateId={isDeferredSelection ? selectedTemplateId : ''}
            templates={templateItems}
            toolbarAction={toolbarAction}
            visibleTemplates={isDeferredSelection ? visibleTemplates : undefined}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function EmailSendFormTemplatePicker({
  className = '',
  emptyCopy,
  emptyTitle,
  onQueryChange,
  onTemplateSelect,
  query,
  renderTemplateCard,
  searchLabel = 'Search templates',
  searchPlaceholder = 'Search templates...',
  selectedTemplateId = '',
  templates = defaultEmailSendFormTemplates,
  toolbarAction,
  visibleTemplates: controlledVisibleTemplates,
}) {
  const [internalQuery, setInternalQuery] = useState('');
  const queryValue = query ?? internalQuery;
  const normalizedQuery = queryValue.trim().toLowerCase();
  const computedVisibleTemplates = useMemo(
    () => filterTemplateDialogItems(templates, queryValue),
    [queryValue, templates]
  );
  const visibleTemplates = controlledVisibleTemplates ?? computedVisibleTemplates;

  function handleQueryChange(event) {
    const nextQuery = event.target.value;

    if (query === undefined) {
      setInternalQuery(nextQuery);
    }

    onQueryChange?.(nextQuery);
  }

  return (
    <div className={['email-send-form-template-picker', className].filter(Boolean).join(' ')}>
      <div className={['email-send-form-template-toolbar', toolbarAction ? 'has-action' : ''].filter(Boolean).join(' ')}>
        <label className="email-send-form-template-search">
          <Search aria-hidden="true" size={16} />
          <input
            aria-label={searchLabel}
            onChange={handleQueryChange}
            placeholder={searchPlaceholder}
            type="search"
            value={queryValue}
          />
        </label>
        {toolbarAction ? (
          <div className="email-send-form-template-toolbar-action">
            {toolbarAction}
          </div>
        ) : null}
      </div>

      {visibleTemplates.length > 0 ? (
        <div className={['email-send-form-template-grid', renderTemplateCard ? 'email-send-form-template-grid--custom' : ''].filter(Boolean).join(' ')}>
          {visibleTemplates.map((template) => {
            const {
              cardKey,
              id: templateId,
              templateName,
              templatePreviewText,
              templateSubject,
            } = getTemplateDialogCardMeta(template);
            const isSelected = Boolean(selectedTemplateId) && selectedTemplateId === templateId;

            if (renderTemplateCard) {
              return renderTemplateCard({
                cardKey,
                isSelected,
                key: cardKey,
                onSelect: () => onTemplateSelect?.(template),
                template,
                templateName,
                templatePreviewText,
                templateSubject,
              });
            }

            return (
              <button
                aria-pressed={isSelected || undefined}
                className="email-send-form-template-card"
                data-selected={isSelected ? 'true' : undefined}
                key={cardKey}
                onClick={() => onTemplateSelect?.(template)}
                type="button"
              >
                <span className="email-send-form-template-card-preview" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="email-send-form-template-card-copy">
                  <strong>{templateName}</strong>
                  <span>{templateSubject}</span>
                  {templatePreviewText ? (
                    <small>{templatePreviewText}</small>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <EmailSendFormTemplateEmptyState
          emptyCopy={emptyCopy}
          emptyTitle={emptyTitle}
          hasQuery={Boolean(normalizedQuery)}
        />
      )}
    </div>
  );
}

export function EmailSendFormTemplateEmptyState({ emptyCopy, emptyTitle, hasQuery }) {
  const title = emptyTitle ?? (hasQuery ? 'No templates found' : 'No published templates yet');
  const copy = emptyCopy ?? (
    hasQuery
      ? 'Try searching for a different term or contact support.'
      : 'Published templates from your team will appear here. Create and publish templates to use them in your messages.'
  );

  return (
    <div className="email-send-form-template-empty">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

export const EmailSendFormGhostButton = forwardRef(function EmailSendFormGhostButton(
  { children, className = '', type = 'button', ...props },
  ref
) {
  return (
    <button className={['email-send-form-ghost-button', className].filter(Boolean).join(' ')} ref={ref} type={type} {...props}>
      {children}
    </button>
  );
});

export function EmailSendFormSelect({
  ariaLabel,
  className = '',
  emptyActionLabel,
  emptyDescription,
  onEmptyAction,
  onValueChange,
  options = [],
  placeholder = '선택...',
  showMenuLabel = true,
  value,
}) {
  const selected = useMemo(() => getOption(options, value), [options, value]);
  const hasEmptyAction = options.length === 0 && Boolean(emptyActionLabel);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={ariaLabel}
          className={['email-send-form-select', className].filter(Boolean).join(' ')}
          type="button"
        >
          <span className={selected ? '' : 'email-send-form-placeholder'}>
            {selected?.label ?? placeholder}
          </span>
          {selected?.count !== undefined ? (
            <span className="email-send-form-select-count">{selected.count}</span>
          ) : null}
          <ChevronDown aria-hidden="true" size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={['email-send-form-select-menu', hasEmptyAction ? 'sms-fallback-menu' : ''].filter(Boolean).join(' ')}
      >
        {showMenuLabel ? (
          <>
            <DropdownMenuLabel>{ariaLabel}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {hasEmptyAction ? (
          <>
            {emptyDescription ? <p className="sms-fallback-help">{emptyDescription}</p> : null}
            <DropdownMenuItem
              className="sms-fallback-create"
              onSelect={(event) => {
                if (onEmptyAction) {
                  event.preventDefault();
                  onEmptyAction();
                }
              }}
            >
              <Plus aria-hidden="true" size={16} />
              <span>{emptyActionLabel}</span>
            </DropdownMenuItem>
          </>
        ) : (
          options.map((option) => (
            <DropdownMenuItem
              className="email-send-form-select-item"
              key={option.value}
              onSelect={() => onValueChange?.(option.value)}
            >
              <span>
                <span>{option.label}</span>
                {option.count !== undefined ? (
                  <small>{option.count.toLocaleString()}</small>
                ) : null}
              </span>
              {option.value === value ? <Check aria-hidden="true" size={14} /> : null}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const EmailSendFormCanvas = forwardRef(function EmailSendFormCanvas(
  { children, className = '', ...props },
  ref
) {
  return (
    <div className={['email-send-form-canvas', className].filter(Boolean).join(' ')} ref={ref} {...props}>
      {children}
    </div>
  );
});

EmailSendForm.Root = EmailSendFormRoot;
EmailSendForm.Selection = EmailSendFormSelection;
EmailSendForm.Row = EmailSendFormRow;
EmailSendForm.Disclosure = EmailSendFormDisclosure;
EmailSendForm.Label = EmailSendFormLabel;
EmailSendForm.ScheduleField = EmailSendFormScheduleField;
EmailSendForm.Input = EmailSendFormInput;
EmailSendForm.Textarea = EmailSendFormTextarea;
EmailSendForm.EmptyState = EmailSendFormEmptyState;
EmailSendForm.FieldWarningIcon = EmailSendFormFieldWarningIcon;
EmailSendForm.GhostButton = EmailSendFormGhostButton;
EmailSendForm.RecipientSelect = EmailSendFormRecipientSelect;
EmailSendForm.SubscribeTopicSelect = EmailSendFormSubscribeTopicSelect;
EmailSendForm.Select = EmailSendFormSelect;
EmailSendForm.Canvas = EmailSendFormCanvas;
EmailSendForm.TemplateButton = EmailSendFormTemplateButton;
EmailSendForm.TemplateDialog = EmailSendFormTemplateDialog;
EmailSendForm.TemplatePicker = EmailSendFormTemplatePicker;
