import { Info, Loader2 } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { showToast } from '../../feedback/toast';
import { Button } from '../../primitives/button';
import { FormField, FormLabel, FormMessage } from '../../primitives/form-field';
import { Textarea } from '../../primitives/textarea';
import { AudienceSegmentTagSelector } from './audience-contact-combobox';
import {
  AudienceContactModalShell,
  AudienceContactModalShortcut,
} from './audience-contact-modal-shell';
import { getContactEmailsError, parseContactEmails } from './audience-contact-modal-utils';
import type {
  AudienceAddContactsPayload,
  AudienceAddContactsResult,
  AudienceSegment,
} from './types';

type AudienceAddContactsModalProps = {
  readonly defaultSegmentIds?: readonly string[];
  readonly onAddContacts?: ((payload: AudienceAddContactsPayload) => AudienceAddContactsResult | Promise<AudienceAddContactsResult | void> | void) | undefined;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly segments: readonly AudienceSegment[];
};

function AudienceAddContactsModal({
  defaultSegmentIds = [],
  onAddContacts,
  onOpenChange,
  open,
  segments,
}: AudienceAddContactsModalProps) {
  const emailChangedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasOpenRef = useRef(false);
  const [emailsValue, setEmailsValue] = useState('');
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<readonly string[]>(defaultSegmentIds);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const error = touched ? getContactEmailsError(emailsValue) : null;
  const disabled = emailsValue.trim().length === 0 || submitting;

  useEffect(() => {
    if (open && !wasOpenRef.current) setSelectedSegmentIds(defaultSegmentIds);
    wasOpenRef.current = open;
  }, [defaultSegmentIds, open]);

  function reset() {
    setEmailsValue('');
    setSelectedSegmentIds(defaultSegmentIds);
    setTouched(false);
    setSubmitting(false);
    emailChangedRef.current = false;
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  async function submit() {
    setTouched(true);
    const nextError = getContactEmailsError(emailsValue);
    if (nextError !== null || submitting) return;

    const emails = parseContactEmails(emailsValue);
    setSubmitting(true);
    try {
      const result = await onAddContacts?.({ emails, segmentIds: selectedSegmentIds });
      const total = result?.total ?? emails.length;
      showToast({
        appearance: 'green',
        title: `${total.toLocaleString()} contact(s) added`,
      });
      handleOpenChange(false);
    } catch (caughtError) {
      showToast({
        appearance: 'red',
        title: caughtError instanceof Error ? caughtError.message : 'Failed to add contacts.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) return;
    event.preventDefault();
    void submit();
  }

  return (
    <AudienceContactModalShell
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        window.requestAnimationFrame(() => textareaRef.current?.focus());
      }}
      onOpenChange={handleOpenChange}
      open={open}
      title="Add contacts"
    >
      <form
        className="resend-ui-audience-contact-modal__form"
        data-resend-audience-add-contacts-form
        noValidate
        onKeyDown={handleKeyDown}
        onSubmit={handleSubmit}
      >
        <FormField
          className="resend-ui-audience-contact-modal__field resend-ui-audience-contact-modal__field--first"
          invalid={error !== null}
        >
          <FormLabel>Email addresses</FormLabel>
          <Textarea
            className="resend-ui-audience-contact-modal__emails"
            name="emails"
            onBlur={() => {
              if (emailChangedRef.current) setTouched(true);
            }}
            onChange={(event) => {
              emailChangedRef.current = true;
              setEmailsValue(event.currentTarget.value);
            }}
            placeholder="foo@gmail.com, bar@gmail.com"
            ref={textareaRef}
            value={emailsValue}
          />
          <span className="resend-ui-audience-contact-modal__helper">
            Use commas or line breaks to separate multiple email addresses.
          </span>
          <FormMessage message={error} />
        </FormField>
        {segments.length > 0 ? (
          <div className="resend-ui-audience-contact-modal__field">
            <span className="resend-ui-audience-contact-modal__label">
              Segments
              <span
                className="resend-ui-audience-contact-modal__info"
                title="Use segments to group contacts based on your business logic"
              >
                <Info aria-hidden="true" size={14} />
                <span className="resend-ui-sr-only">Use segments to group contacts based on your business logic</span>
              </span>
            </span>
            <AudienceSegmentTagSelector
              onChange={setSelectedSegmentIds}
              segments={segments}
              value={selectedSegmentIds}
            />
          </div>
        ) : null}
        <div className="resend-ui-audience-contact-modal__actions">
          <Button
            className="resend-ui-audience-contact-modal__action-with-shortcut"
            data-loading={submitting ? '' : undefined}
            disabled={disabled}
            type="submit"
            variant="accent"
          >
            {submitting ? <Loader2 aria-hidden="true" className="resend-ui-audience-contact-modal__spinner" size={14} /> : null}
            <span>Add</span>
            <AudienceContactModalShortcut tokens={['CMD', 'ENTER']} />
          </Button>
          <Button
            className="resend-ui-audience-contact-modal__action-with-shortcut"
            onClick={() => handleOpenChange(false)}
            type="button"
          >
            <span>Cancel</span>
            <AudienceContactModalShortcut tokens={['ESC']} />
          </Button>
        </div>
      </form>
    </AudienceContactModalShell>
  );
}

export { AudienceAddContactsModal };
