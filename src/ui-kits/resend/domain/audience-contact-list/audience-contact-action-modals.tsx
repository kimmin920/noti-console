import { Info, Loader2 } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { showToast } from '../../feedback/toast';
import { Button } from '../../primitives/button';
import { FormField, FormLabel, FormMessage } from '../../primitives/form-field';
import { Input } from '../../primitives/input';
import { Switch } from '../../primitives/switch';
import { DeleteCopyButton } from '../delete-confirmation-modal/delete-copy-button';
import {
  AudienceContactTagSelector,
  type AudienceContactTagOption,
} from './audience-contact-combobox';
import {
  AudienceContactModalShell,
  AudienceContactModalShortcut,
} from './audience-contact-modal-shell';
import type {
  AudienceAddContactsToSegmentsPayload,
  AudienceContact,
  AudienceContactCustomPropertyDefinition,
  AudienceDeleteContactsPayload,
  AudienceRemoveContactsFromSegmentsPayload,
  AudienceSegment,
  AudienceSubscribeContactsToTopicsPayload,
  AudienceTopic,
  AudienceUpdateContactPayload,
} from './types';

type MaybePromise<T> = T | Promise<T>;
const EMPTY_IDS: readonly string[] = [];
const EMPTY_CUSTOM_PROPERTIES: readonly AudienceContactCustomPropertyDefinition[] = [];
const EMPTY_TAG_OPTIONS: readonly AudienceContactTagOption[] = [];
const SEGMENTS_HREF = '/audience/segments';
const TOPICS_HREF = '/audience/topics';

type ControlledActionModalProps = {
  readonly loading?: boolean | undefined;
  readonly onCloseAutoFocus?: ((event: Event) => void) | undefined;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSuccess?: (() => void) | undefined;
  readonly open: boolean;
};

type AudienceEditContactModalProps = ControlledActionModalProps & {
  readonly contact: AudienceContact;
  readonly customProperties?: readonly AudienceContactCustomPropertyDefinition[];
  readonly customPropertyValues?: Readonly<Record<string, string>>;
  readonly onSave?: ((payload: AudienceUpdateContactPayload) => MaybePromise<void>) | undefined;
  readonly scopedSegmentId?: string | undefined;
  readonly segments: readonly AudienceSegment[];
  readonly topics: readonly AudienceTopic[];
};

type AudienceDeleteContactsModalProps = ControlledActionModalProps & {
  readonly contactEmail?: string | undefined;
  readonly contactIds: readonly string[];
  readonly onDelete?: ((payload: AudienceDeleteContactsPayload) => MaybePromise<void>) | undefined;
};

type AudienceAddContactsToSegmentsModalProps = ControlledActionModalProps & {
  readonly contactIds: readonly string[];
  readonly onAdd?: ((payload: AudienceAddContactsToSegmentsPayload) => MaybePromise<void>) | undefined;
  readonly segments: readonly AudienceSegment[];
};

type AudienceRemoveContactsFromSegmentsModalProps = ControlledActionModalProps & {
  readonly contactIds: readonly string[];
  readonly defaultSegmentIds?: readonly string[];
  readonly onRemove?: ((payload: AudienceRemoveContactsFromSegmentsPayload) => MaybePromise<void>) | undefined;
  readonly segments: readonly AudienceSegment[];
};

type AudienceSubscribeContactsToTopicsModalProps = ControlledActionModalProps & {
  readonly contactIds: readonly string[];
  readonly onSubscribe?: ((payload: AudienceSubscribeContactsToTopicsPayload) => MaybePromise<void>) | undefined;
  readonly topics: readonly AudienceTopic[];
};

function AudienceEditContactModal({
  contact,
  customProperties = EMPTY_CUSTOM_PROPERTIES,
  customPropertyValues,
  loading = false,
  onCloseAutoFocus,
  onOpenChange,
  onSave,
  onSuccess,
  open,
  scopedSegmentId,
  segments,
  topics,
}: AudienceEditContactModalProps) {
  const emailRef = useRef<HTMLInputElement>(null);
  const subscribedId = useId();
  const [email, setEmail] = useState(contact.email);
  const [firstName, setFirstName] = useState(contact.firstName ?? '');
  const [lastName, setLastName] = useState(contact.lastName ?? '');
  const [subscribed, setSubscribed] = useState(!contact.unsubscribed);
  const [segmentIds, setSegmentIds] = useState<readonly string[]>(contact.segments.map(({ id }) => id));
  const [topicIds, setTopicIds] = useState<readonly string[]>(getInitialTopicIds(contact));
  const [propertyValues, setPropertyValues] = useState<Readonly<Record<string, string>>>(() => (
    getInitialCustomPropertyValues(contact, customPropertyValues)
  ));
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const emailError = emailTouched ? getEmailError(email) : null;
  const busy = loading || submitting;
  const availableSegments = mergeTagOptions(segments, contact.segments);
  const availableTopics = mergeTagOptions(
    topics,
    contact.topicSubscriptions?.optIn ?? contact.topics,
    contact.topicSubscriptions?.optOut ?? EMPTY_TAG_OPTIONS
  );

  useEffect(() => {
    if (!open) return;
    setEmail(contact.email);
    setFirstName(contact.firstName ?? '');
    setLastName(contact.lastName ?? '');
    setSubscribed(!contact.unsubscribed);
    setSegmentIds(contact.segments.map(({ id }) => id));
    setTopicIds(getInitialTopicIds(contact));
    setPropertyValues(getInitialCustomPropertyValues(contact, customPropertyValues));
    setEmailTouched(false);
    setSubmitting(false);
  }, [contact, customPropertyValues, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setEmailTouched(false);
      setSubmitting(false);
    }
    onOpenChange(nextOpen);
  }

  async function submit() {
    setEmailTouched(true);
    if (getEmailError(email) !== null || busy) return;

    setSubmitting(true);
    try {
      const nextCustomProperties = Object.fromEntries(
        customProperties.map((property) => [property.id, propertyValues[property.key] ?? ''])
      );
      await onSave?.({
        audienceIds: segmentIds,
        contactId: contact.id,
        ...(Object.keys(nextCustomProperties).length > 0
          ? { customProperties: nextCustomProperties }
          : {}),
        email: email.trim(),
        ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        newSubscriptions: topicIds,
        originalSubscriptions: getInitialTopicIds(contact),
        unsubscribed: !subscribed,
        updateAudiences: scopedSegmentId === undefined,
      });
      showToast({ appearance: 'green', title: 'This contact has been edited.' });
      handleOpenChange(false);
      onSuccess?.();
    } catch (error) {
      showToast({
        appearance: 'red',
        title: getErrorMessage(error, 'Unable to edit this contact.'),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AudienceContactModalShell
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        window.requestAnimationFrame(() => emailRef.current?.focus());
      }}
      onOpenChange={handleOpenChange}
      open={open}
      title="Edit contact"
    >
      <form
        className="resend-ui-audience-contact-modal__form"
        data-resend-audience-edit-contact-form
        data-resend-audience-edit-contact-modal
        noValidate
        onKeyDown={(event) => handleFormShortcut(event, submit)}
        onSubmit={(event) => handleFormSubmit(event, submit)}
      >
        <FormField
          className="resend-ui-audience-contact-modal__field resend-ui-audience-contact-modal__field--first"
          invalid={emailError !== null}
        >
          <FormLabel>Email</FormLabel>
          <Input
            autoComplete="off"
            data-resend-audience-edit-contact-email
            name="email"
            onBlur={() => setEmailTouched(true)}
            onChange={(event) => setEmail(event.currentTarget.value)}
            placeholder="Your contact email"
            ref={emailRef}
            type="email"
            value={email}
          />
          <FormMessage message={emailError} />
        </FormField>

        {scopedSegmentId === undefined ? (
          <ContactSelectorField
            ariaLabel="Segments"
            emptyOptions={(
              <p className="resend-ui-audience-contact-combobox__message">
                No Segments yet. <a href={SEGMENTS_HREF}>Segments</a>
              </p>
            )}
            info="Use segments to group contacts based on your business logic"
            label="Segments"
            onChange={setSegmentIds}
            options={availableSegments}
            placeholder="Optionally add to existing segments..."
            value={segmentIds}
          />
        ) : null}

        <div className="resend-ui-audience-contact-modal__field" data-resend-audience-edit-contact-topics>
          <span className="resend-ui-audience-contact-modal__label">Topics</span>
          {availableTopics.length > 0 ? (
            <AudienceContactTagSelector
              ariaLabel="Topics"
              onChange={setTopicIds}
              options={availableTopics}
              placeholder="Assign to existing topics..."
              value={topicIds}
            />
          ) : (
            <p className="resend-ui-audience-contact-combobox__message">
              No topics yet. <a href={TOPICS_HREF}>Create one</a>
            </p>
          )}
        </div>

        <div className="resend-ui-audience-contact-modal__field" data-resend-audience-edit-contact-subscribed>
          <label className="resend-ui-audience-contact-modal__label" htmlFor={subscribedId}>Subscribed</label>
          <Switch
            checked={subscribed}
            disabled={busy}
            id={subscribedId}
            onCheckedChange={setSubscribed}
          />
        </div>

        <div
          aria-hidden="true"
          className="resend-ui-audience-contact-modal__details-divider"
          data-resend-audience-edit-contact-divider
        />

        <FormField className="resend-ui-audience-contact-modal__field">
          <FormLabel>First name</FormLabel>
          <Input
            data-resend-audience-edit-contact-first-name
            name="firstName"
            onChange={(event) => setFirstName(event.currentTarget.value)}
            placeholder="Your contact name"
            value={firstName}
          />
        </FormField>
        <FormField className="resend-ui-audience-contact-modal__field">
          <FormLabel>Last name</FormLabel>
          <Input
            data-resend-audience-edit-contact-last-name
            name="lastName"
            onChange={(event) => setLastName(event.currentTarget.value)}
            placeholder="Your contact last name"
            value={lastName}
          />
        </FormField>

        {customProperties.map((property) => (
          <CustomPropertyField
            disabled={busy}
            key={property.id}
            onChange={(value) => {
              setPropertyValues((current) => ({ ...current, [property.key]: value }));
            }}
            property={property}
            value={propertyValues[property.key] ?? ''}
          />
        ))}

        <ModalActions
          busy={busy}
          onCancel={() => handleOpenChange(false)}
          primaryLabel="Save"
        />
      </form>
    </AudienceContactModalShell>
  );
}

function AudienceDeleteContactsModal({
  contactEmail,
  contactIds,
  loading = false,
  onCloseAutoFocus,
  onDelete,
  onOpenChange,
  onSuccess,
  open,
}: AudienceDeleteContactsModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const count = contactIds.length;
  const plural = count > 1;
  const expected = plural ? `DELETE ${count} CONTACTS` : contactEmail ?? contactIds[0] ?? '';
  const busy = loading || submitting;
  const canDelete = expected.length > 0 && confirmation === expected && !busy;

  useEffect(() => {
    if (!open) return;
    setConfirmation('');
    setSubmitting(false);
  }, [contactEmail, contactIds, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmation('');
      setSubmitting(false);
    }
    onOpenChange(nextOpen);
  }

  async function submit() {
    if (!canDelete) return;
    setSubmitting(true);
    try {
      await onDelete?.({ ids: contactIds });
      showToast({
        appearance: 'green',
        title: plural ? `${count} contacts have been deleted` : 'This contact has been deleted',
      });
      handleOpenChange(false);
      onSuccess?.();
    } catch (error) {
      showToast({ appearance: 'red', title: getErrorMessage(error, 'Unable to delete contact.') });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AudienceContactModalShell
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        window.requestAnimationFrame(() => inputRef.current?.focus());
      }}
      onOpenChange={handleOpenChange}
      open={open}
      title={plural ? 'Delete contacts' : 'Delete contact'}
    >
      <div data-resend-audience-delete-contacts-modal>
        <p className="resend-ui-delete-confirmation-modal__description">
          Are you sure you want to delete {plural ? `${count} contacts` : 'this contact'} and remove {plural ? 'them' : 'it'} from all segments?{' '}
          <strong className="resend-ui-delete-confirmation-modal__warning">This can not be undone.</strong>
        </p>
        <p className="resend-ui-delete-confirmation-modal__instruction">
          Type{' '}
          <span className="resend-ui-delete-confirmation-modal__tag">
            <span
              className="resend-ui-delete-confirmation-modal__confirmation"
              data-resend-audience-delete-contacts-confirmation
            >
              {expected}
            </span>
            <DeleteCopyButton value={expected} />
          </span>{' '}
          to confirm.
        </p>
        <form
          data-resend-audience-delete-contacts-form
          onKeyDown={(event) => handleFormShortcut(event, submit)}
          onSubmit={(event) => handleFormSubmit(event, submit)}
        >
          <div className="resend-ui-delete-confirmation-modal__field">
            <Input
              autoComplete="off"
              data-resend-audience-delete-contacts-input
              onChange={(event) => setConfirmation(event.currentTarget.value)}
              placeholder="Enter contact email"
              ref={inputRef}
              value={confirmation}
            />
          </div>
          <div className="resend-ui-delete-confirmation-modal__actions">
            <Button
              className="resend-ui-delete-confirmation-modal__destructive resend-ui-delete-confirmation-modal__action--shortcut"
              data-loading={busy ? '' : undefined}
              data-resend-audience-delete-contacts-submit
              disabled={!canDelete}
              type="submit"
              variant="accent"
            >
              {busy ? <Loader2 aria-hidden="true" className="resend-ui-audience-contact-modal__spinner" size={14} /> : null}
              <span>{plural ? 'Delete contacts' : 'Delete contact'}</span>
              <AudienceContactModalShortcut tokens={['CMD', 'ENTER']} />
            </Button>
            <Button
              className="resend-ui-delete-confirmation-modal__action--shortcut"
              disabled={busy}
              onClick={() => handleOpenChange(false)}
              type="button"
            >
              <span>Cancel</span>
              <AudienceContactModalShortcut tokens={['ESC']} />
            </Button>
          </div>
        </form>
      </div>
    </AudienceContactModalShell>
  );
}

function AudienceAddContactsToSegmentsModal({
  contactIds,
  loading,
  onCloseAutoFocus,
  onAdd,
  onOpenChange,
  onSuccess,
  open,
  segments,
}: AudienceAddContactsToSegmentsModalProps) {
  return (
    <ContactAssignmentModal
      contactIds={contactIds}
      emptyLabel="No matching segments."
      emptyOptions={(
        <p className="resend-ui-audience-contact-combobox__message">
          No Segments yet. <a href={SEGMENTS_HREF}>Segments</a>
        </p>
      )}
      info="Use segments to group contacts based on your business logic"
      label="Segments"
      loading={loading}
      mode="add-to-segments"
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={onOpenChange}
      onSubmit={async (selectedIds) => onAdd?.({ audienceIds: selectedIds, ids: contactIds })}
      onSuccess={onSuccess}
      open={open}
      options={segments}
      placeholder="Optionally add to existing segments..."
      primaryLabel="Add"
      successTitle="Contacts added to segment"
      title={`Add ${contactIds.length > 1 ? `${contactIds.length} contacts` : 'this contact'} to`}
    />
  );
}

function AudienceRemoveContactsFromSegmentsModal({
  contactIds,
  defaultSegmentIds = EMPTY_IDS,
  loading,
  onCloseAutoFocus,
  onOpenChange,
  onRemove,
  onSuccess,
  open,
  segments,
}: AudienceRemoveContactsFromSegmentsModalProps) {
  return (
    <ContactAssignmentModal
      contactIds={contactIds}
      defaultSelectedIds={defaultSegmentIds}
      emptyLabel="No matching segments."
      info="Select which segments to remove these contacts from"
      label="Segments"
      loading={loading}
      mode="remove-from-segments"
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={onOpenChange}
      onSubmit={async (selectedIds) => onRemove?.({ audienceIds: selectedIds, ids: contactIds })}
      onSuccess={onSuccess}
      open={open}
      options={segments}
      placeholder="Select segments to remove contacts from..."
      primaryLabel="Remove"
      successTitle={(selectedIds) => {
        const segmentLabel = selectedIds.length === 1 ? 'segment' : `${selectedIds.length} segments`;
        return contactIds.length > 1
          ? `${contactIds.length} contacts removed from ${segmentLabel}`
          : `Contact removed from ${segmentLabel}`;
      }}
      title={`Remove ${contactIds.length > 1 ? `${contactIds.length} contacts` : 'this contact'} from`}
    />
  );
}

function AudienceSubscribeContactsToTopicsModal({
  contactIds,
  loading,
  onCloseAutoFocus,
  onOpenChange,
  onSubscribe,
  onSuccess,
  open,
  topics,
}: AudienceSubscribeContactsToTopicsModalProps) {
  return (
    <ContactAssignmentModal
      contactIds={contactIds}
      emptyLabel="No matching topics."
      emptyOptions={(
        <p className="resend-ui-audience-contact-combobox__message">
          No topics yet. <a href={TOPICS_HREF}>Create one</a>
        </p>
      )}
      info="Use topics to manage subscription preferences for your contacts"
      label="Topics"
      loading={loading}
      mode="subscribe-to-topics"
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={onOpenChange}
      onSubmit={async (selectedIds) => onSubscribe?.({ ids: contactIds, topicIds: selectedIds })}
      onSuccess={onSuccess}
      open={open}
      options={topics}
      placeholder="Assign to existing topics..."
      primaryLabel="Subscribe"
      successTitle="Contacts subscribed to topic"
      title={`Subscribe ${contactIds.length > 1 ? `${contactIds.length} contacts` : 'this contact'} to`}
    />
  );
}

type ContactAssignmentModalProps = ControlledActionModalProps & {
  readonly contactIds: readonly string[];
  readonly defaultSelectedIds?: readonly string[];
  readonly emptyLabel: string;
  readonly emptyOptions?: ReactNode;
  readonly info: string;
  readonly label: string;
  readonly mode: 'add-to-segments' | 'remove-from-segments' | 'subscribe-to-topics';
  readonly onSubmit: (selectedIds: readonly string[]) => MaybePromise<void | undefined>;
  readonly options: readonly AudienceContactTagOption[];
  readonly placeholder: string;
  readonly primaryLabel: string;
  readonly successTitle: string | ((selectedIds: readonly string[]) => string);
  readonly title: string;
};

function ContactAssignmentModal({
  defaultSelectedIds = EMPTY_IDS,
  emptyLabel,
  emptyOptions,
  info,
  label,
  loading = false,
  mode,
  onCloseAutoFocus,
  onOpenChange,
  onSubmit,
  onSuccess,
  open,
  options,
  placeholder,
  primaryLabel,
  successTitle,
  title,
}: ContactAssignmentModalProps) {
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(defaultSelectedIds);
  const [submitting, setSubmitting] = useState(false);
  const busy = loading || submitting;

  useEffect(() => {
    if (!open) return;
    setSelectedIds(defaultSelectedIds);
    setSubmitting(false);
  }, [defaultSelectedIds, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedIds(defaultSelectedIds);
      setSubmitting(false);
    }
    onOpenChange(nextOpen);
  }

  async function submit() {
    if (busy || (mode === 'remove-from-segments' && selectedIds.length === 0)) return;
    setSubmitting(true);
    try {
      await onSubmit(selectedIds);
      showToast({
        appearance: 'green',
        title: typeof successTitle === 'function' ? successTitle(selectedIds) : successTitle,
      });
      handleOpenChange(false);
      onSuccess?.();
    } catch (error) {
      showToast({ appearance: 'red', title: getErrorMessage(error, `Unable to ${primaryLabel.toLowerCase()} contacts.`) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AudienceContactModalShell
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={handleOpenChange}
      open={open}
      title={title}
    >
      <form
        className="resend-ui-audience-contact-modal__form"
        data-resend-audience-contact-action-modal={mode}
        data-resend-audience-contact-assignment-form
        onKeyDown={(event) => handleFormShortcut(event, submit)}
        onSubmit={(event) => handleFormSubmit(event, submit)}
      >
        <div className="resend-ui-audience-contact-modal__field resend-ui-audience-contact-modal__field--first">
          <span className="resend-ui-audience-contact-modal__label">
            {label}
            <span className="resend-ui-audience-contact-modal__info" title={info}>
              <Info aria-hidden="true" size={14} />
              <span className="resend-ui-sr-only">{info}</span>
            </span>
          </span>
          {options.length > 0 ? (
            <AudienceContactTagSelector
              ariaLabel={label}
              onChange={setSelectedIds}
              options={options}
              placeholder={placeholder}
              value={selectedIds}
            />
          ) : emptyOptions ?? (
            <p className="resend-ui-audience-contact-combobox__message">{emptyLabel}</p>
          )}
        </div>
        <ModalActions
          busy={busy}
          disabled={mode === 'remove-from-segments' && (selectedIds.length === 0 || options.length === 0)}
          onCancel={() => handleOpenChange(false)}
          primaryLabel={primaryLabel}
        />
      </form>
    </AudienceContactModalShell>
  );
}

function ContactSelectorField({
  ariaLabel,
  emptyOptions,
  info,
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  readonly ariaLabel: string;
  readonly emptyOptions?: ReactNode;
  readonly info?: string;
  readonly label: string;
  readonly onChange: (value: readonly string[]) => void;
  readonly options: readonly AudienceContactTagOption[];
  readonly placeholder: string;
  readonly value: readonly string[];
}) {
  return (
    <div className="resend-ui-audience-contact-modal__field">
      <span className="resend-ui-audience-contact-modal__label">
        {label}
        {info ? (
          <span className="resend-ui-audience-contact-modal__info" title={info}>
            <Info aria-hidden="true" size={14} />
            <span className="resend-ui-sr-only">{info}</span>
          </span>
        ) : null}
      </span>
      {options.length > 0 ? (
        <AudienceContactTagSelector
          ariaLabel={ariaLabel}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          value={value}
        />
      ) : emptyOptions ?? null}
    </div>
  );
}

function CustomPropertyField({
  disabled,
  onChange,
  property,
  value,
}: {
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly property: AudienceContactCustomPropertyDefinition;
  readonly value: string;
}) {
  const controlId = useId();
  if (property.type === 'boolean') {
    return (
      <div className="resend-ui-audience-contact-modal__field" data-resend-audience-edit-contact-property={property.key}>
        <label className="resend-ui-audience-contact-modal__label" htmlFor={controlId}>{property.key}</label>
        <Switch
          checked={value === 'true'}
          disabled={disabled}
          id={controlId}
          onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
        />
      </div>
    );
  }

  return (
    <FormField className="resend-ui-audience-contact-modal__field" data-resend-audience-edit-contact-property={property.key}>
      <FormLabel>{property.key}</FormLabel>
      <Input
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={property.fallbackValue}
        step={property.type === 'number' ? 'any' : undefined}
        type={property.type === 'number' ? 'number' : 'text'}
        value={value}
      />
    </FormField>
  );
}

function ModalActions({
  busy,
  disabled = false,
  onCancel,
  primaryLabel,
}: {
  readonly busy: boolean;
  readonly disabled?: boolean;
  readonly onCancel: () => void;
  readonly primaryLabel: string;
}) {
  return (
    <div className="resend-ui-audience-contact-modal__actions">
      <Button
        className="resend-ui-audience-contact-modal__action-with-shortcut"
        data-loading={busy ? '' : undefined}
        data-resend-audience-contact-modal-submit
        disabled={disabled || busy}
        type="submit"
        variant="accent"
      >
        {busy ? <Loader2 aria-hidden="true" className="resend-ui-audience-contact-modal__spinner" size={14} /> : null}
        <span>{primaryLabel}</span>
        <AudienceContactModalShortcut tokens={['CMD', 'ENTER']} />
      </Button>
      <Button
        className="resend-ui-audience-contact-modal__action-with-shortcut"
        disabled={busy}
        onClick={onCancel}
        type="button"
      >
        <span>Cancel</span>
        <AudienceContactModalShortcut tokens={['ESC']} />
      </Button>
    </div>
  );
}

function handleFormSubmit(event: FormEvent<HTMLFormElement>, submit: () => MaybePromise<void>) {
  event.preventDefault();
  void submit();
}

function handleFormShortcut(event: KeyboardEvent<HTMLFormElement>, submit: () => MaybePromise<void>) {
  if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return;
  event.preventDefault();
  void submit();
}

function getEmailError(value: string) {
  const normalized = value.trim();
  if (normalized.length === 0) return 'Email is required';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? null : 'Enter a valid email address';
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getInitialTopicIds(contact: AudienceContact) {
  return (contact.topicSubscriptions?.optIn ?? contact.topics).map(({ id }) => id);
}

function getInitialCustomPropertyValues(
  contact: AudienceContact,
  override: Readonly<Record<string, string>> | undefined
) {
  if (override !== undefined) return override;
  return Object.fromEntries(
    Object.entries(contact.properties ?? {}).map(([key, property]) => [key, property.value])
  );
}

function mergeTagOptions(...groups: readonly (readonly AudienceContactTagOption[])[]) {
  const byId = new Map<string, AudienceContactTagOption>();
  for (const group of groups) {
    for (const option of group) byId.set(option.id, option);
  }
  return [...byId.values()];
}

export {
  AudienceAddContactsToSegmentsModal,
  AudienceDeleteContactsModal,
  AudienceEditContactModal,
  AudienceRemoveContactsFromSegmentsModal,
  AudienceSubscribeContactsToTopicsModal,
};

export type {
  AudienceAddContactsToSegmentsModalProps,
  AudienceDeleteContactsModalProps,
  AudienceEditContactModalProps,
  AudienceRemoveContactsFromSegmentsModalProps,
  AudienceSubscribeContactsToTopicsModalProps,
};

export type {
  AudienceAddContactsToSegmentsPayload,
  AudienceContactCustomPropertyDefinition,
  AudienceDeleteContactsPayload,
  AudienceRemoveContactsFromSegmentsPayload,
  AudienceSubscribeContactsToTopicsPayload,
  AudienceUpdateContactPayload,
} from './types';
