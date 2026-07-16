import { useEffect, useRef } from 'react';
import { Checkbox } from '../../primitives/checkbox';
import { DataTable, useRowSelection, type RowSelectionState } from '../../data-display/data-table';
import {
  audienceContactTableHeaders,
  getAudienceContactFullName,
  getAudienceContactInitial,
  getAudienceContactStatus,
  getAudienceContactStatusAppearance,
} from './data';
import { AudienceContactRowActions } from './audience-contact-row-actions';
import type {
  AudienceContact,
  AudienceContactCustomPropertyDefinition,
  AudienceDeleteContactsPayload,
  AudienceRemoveContactsFromSegmentsPayload,
  AudienceContactRowActionDisabled,
  AudienceContactRowActionHandler,
  AudienceSegment,
  AudienceTopic,
  AudienceUpdateContactPayload,
} from './types';

type AudienceContactTableProps = {
  readonly contactColumnLabel?: string;
  readonly contactCustomProperties?: readonly AudienceContactCustomPropertyDefinition[];
  readonly contacts: readonly AudienceContact[];
  readonly defaultSelectedContactIds?: readonly string[] | undefined;
  readonly isRowActionDisabled?: AudienceContactRowActionDisabled | undefined;
  readonly onDeleteContacts?: ((payload: AudienceDeleteContactsPayload) => Promise<void> | void) | undefined;
  readonly onRemoveContactsFromSegments?: ((payload: AudienceRemoveContactsFromSegmentsPayload) => Promise<void> | void) | undefined;
  readonly onRowAction?: AudienceContactRowActionHandler | undefined;
  readonly onSelectedContactIdsChange?: ((selectedContactIds: readonly string[]) => void) | undefined;
  readonly selectedContactIds?: readonly string[] | undefined;
  readonly selectedSegment: AudienceSegment | undefined;
  readonly segments?: readonly AudienceSegment[];
  readonly segmentsColumnLabel?: string;
  readonly statusColumnLabel?: string;
  readonly subscribedLabel?: string;
  readonly topics?: readonly AudienceTopic[];
  readonly unsubscribedLabel?: string;
  readonly onUpdateContact?: ((payload: AudienceUpdateContactPayload) => Promise<void> | void) | undefined;
};

function ContactAvatar({ contact }: { readonly contact: AudienceContact }) {
  return (
    <a
      aria-hidden="true"
      className="resend-ui-audience-contact-list__avatar"
      href={`/audience/contacts/${contact.id}`}
      tabIndex={-1}
    >
      {getAudienceContactInitial(contact)}
    </a>
  );
}

function ContactName({ contact }: { readonly contact: AudienceContact }) {
  const fullName = getAudienceContactFullName(contact);

  return (
    <a
      className="resend-ui-audience-contact-list__email-link"
      href={`/audience/contacts/${contact.id}`}
      title={contact.email}
    >
      {contact.email}
      {fullName !== '' && <span>, {fullName}</span>}
    </a>
  );
}

function ContactSegments({ contact }: { readonly contact: AudienceContact }) {
  const visibleSegments = contact.segments.slice(0, 2);
  const hiddenSegments = contact.segments.slice(2);

  return (
    <div className="resend-ui-audience-contact-list__segments">
      {visibleSegments.map((segment) => (
        <a
          className="resend-ui-audience-contact-list__segment-link"
          href={`/audience?segmentId=${segment.id}`}
          key={segment.id}
          title={segment.name}
        >
          {segment.name}
        </a>
      ))}
      {hiddenSegments.length > 0 && (
        <span className="resend-ui-audience-contact-list__segment-more" title={hiddenSegments.map((segment) => segment.name).join(', ')}>
          +{hiddenSegments.length}
        </span>
      )}
    </div>
  );
}

function ContactStatusTag({
  contact,
  subscribedLabel,
  unsubscribedLabel,
}: {
  readonly contact: AudienceContact;
  readonly subscribedLabel: string;
  readonly unsubscribedLabel: string;
}) {
  const status = getAudienceContactStatus(contact);

  return (
    <span
      className="resend-ui-audience-contact-list__status-tag"
      data-appearance={getAudienceContactStatusAppearance(contact.unsubscribed)}
    >
      {status === 'subscribed' ? subscribedLabel : unsubscribedLabel}
      {contact.topics.length > 0 && (
        <span
          className="resend-ui-audience-contact-list__topic-count"
          data-appearance={getAudienceContactStatusAppearance(contact.unsubscribed)}
          title={`Topics: ${contact.topics.map((topic) => topic.name).join(', ')}`}
        >
          {contact.topics.length}
        </span>
      )}
    </span>
  );
}

function AudienceContactRow({
  contact,
  contactCustomProperties,
  index,
  isRowActionDisabled,
  onDeleteContacts,
  onRemoveContactsFromSegments,
  onRowAction,
  onUpdateContact,
  selection,
  selectedSegment,
  segments,
  subscribedLabel,
  topics,
  unsubscribedLabel,
}: {
  readonly contact: AudienceContact;
  readonly contactCustomProperties: readonly AudienceContactCustomPropertyDefinition[];
  readonly index: number;
  readonly isRowActionDisabled?: AudienceContactRowActionDisabled | undefined;
  readonly onDeleteContacts?: ((payload: AudienceDeleteContactsPayload) => Promise<void> | void) | undefined;
  readonly onRemoveContactsFromSegments?: ((payload: AudienceRemoveContactsFromSegmentsPayload) => Promise<void> | void) | undefined;
  readonly onRowAction?: AudienceContactRowActionHandler | undefined;
  readonly onUpdateContact?: ((payload: AudienceUpdateContactPayload) => Promise<void> | void) | undefined;
  readonly selection: RowSelectionState;
  readonly selectedSegment: AudienceSegment | undefined;
  readonly segments: readonly AudienceSegment[];
  readonly subscribedLabel: string;
  readonly topics: readonly AudienceTopic[];
  readonly unsubscribedLabel: string;
}) {
  const selected = selection.selectedRowIdsSet.has(contact.id);
  const shiftPressedRef = useRef(false);

  return (
    <DataTable.Row data-selected={selected ? '' : undefined}>
      <DataTable.Cell className="resend-ui-audience-contact-list__email-cell" selectionAnchor>
        <div className="resend-ui-audience-contact-list__email-stack">
          <DataTable.SelectionItem selected={selected}>
            <Checkbox
              aria-label={`Select ${contact.email}`}
              checked={selected}
              data-row-index={index}
              onCheckedChange={(checked) => {
                if (shiftPressedRef.current) selection.setRowRangeChecked(contact.id, checked);
                else selection.setRowChecked(contact.id, checked);
                shiftPressedRef.current = false;
              }}
              onClickCapture={(event) => {
                shiftPressedRef.current = event.shiftKey;
              }}
            />
          </DataTable.SelectionItem>
          <ContactAvatar contact={contact} />
          <ContactName contact={contact} />
        </div>
      </DataTable.Cell>
      <DataTable.Cell>
        <ContactSegments contact={contact} />
      </DataTable.Cell>
      <DataTable.Cell>
        <ContactStatusTag
          contact={contact}
          subscribedLabel={subscribedLabel}
          unsubscribedLabel={unsubscribedLabel}
        />
      </DataTable.Cell>
      <DataTable.Cell className="resend-ui-audience-contact-list__created-cell">
        <time dateTime={contact.createdAtDateTime}>{contact.createdAtLabel}</time>
      </DataTable.Cell>
      <DataTable.Cell className="resend-ui-audience-contact-list__action-cell">
        <AudienceContactRowActions
          contact={contact}
          customProperties={contactCustomProperties}
          isRowActionDisabled={isRowActionDisabled}
          onDeleteContacts={onDeleteContacts}
          onRemoveContactsFromSegments={onRemoveContactsFromSegments}
          onRowAction={onRowAction}
          onUpdateContact={onUpdateContact}
          selectedSegment={selectedSegment}
          segments={segments}
          topics={topics}
        />
      </DataTable.Cell>
    </DataTable.Row>
  );
}

export function AudienceContactTable({
  contactColumnLabel = 'Email',
  contactCustomProperties = [],
  contacts,
  defaultSelectedContactIds,
  isRowActionDisabled,
  onDeleteContacts,
  onRemoveContactsFromSegments,
  onRowAction,
  onSelectedContactIdsChange,
  selectedContactIds,
  selectedSegment,
  segments = [],
  segmentsColumnLabel = 'Segments',
  statusColumnLabel = 'Status',
  subscribedLabel = 'Subscribed',
  topics = [],
  unsubscribedLabel = 'Unsubscribed',
  onUpdateContact,
}: AudienceContactTableProps) {
  const rowIds = contacts.map((contact) => contact.id);
  const selection = useRowSelection({
    defaultSelectedRowIds: defaultSelectedContactIds,
    onSelectedRowIdsChange: onSelectedContactIdsChange,
    rowIds,
    selectedRowIds: selectedContactIds,
  });

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target;
      const editableTarget = target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
      const targetElement = target instanceof Element ? target : null;
      const interactionSurfaceOpen = targetElement?.closest('[role="dialog"], [role="listbox"], [role="menu"]')
        || document.querySelector([
          '[data-resend-audience-contact-modal]',
          '[role="menu"][data-state="open"]',
          '.resend-ui-audience-contact-combobox__content[data-state="open"]',
        ].join(', '));
      if (editableTarget || interactionSurfaceOpen) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        selection.setAllRowsChecked(true);
      } else if (event.key === 'Escape' && selection.selectedRowIds.length > 0) {
        selection.setAllRowsChecked(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection]);

  return (
    <DataTable.SelectionRoot>
      <DataTable.SelectionViewport className="resend-ui-audience-contact-list__table-scroll">
        <DataTable.Root className="resend-ui-audience-contact-list__table" data-qa="audience-contact-table">
          <DataTable.Head>
            <DataTable.Row>
              {audienceContactTableHeaders.map((header, index) => (
                <DataTable.Header
                  align={header.align}
                  className={header.className}
                  key={header.id}
                  selectionAnchor={index === 0}
                >
                  {index === 0 ? (
                    <DataTable.SelectionLabel className="resend-ui-audience-contact-list__select-all">
                      <DataTable.SelectAll selected={selection.selectedRowIds.length > 0}>
                        <Checkbox
                          aria-label="Select all contacts"
                          checked={selection.allRowsCheckboxState}
                          onCheckedChange={selection.setAllRowsChecked}
                        />
                      </DataTable.SelectAll>
                      {contactColumnLabel}
                    </DataTable.SelectionLabel>
                  ) : (
                    header.id === 'segments'
                      ? segmentsColumnLabel
                      : header.id === 'status'
                        ? statusColumnLabel
                        : header.name
                  )}
                </DataTable.Header>
              ))}
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {contacts.map((contact, index) => (
              <AudienceContactRow
                contact={contact}
                contactCustomProperties={contactCustomProperties}
                index={index}
                isRowActionDisabled={isRowActionDisabled}
                key={contact.id}
                onDeleteContacts={onDeleteContacts}
                onRemoveContactsFromSegments={onRemoveContactsFromSegments}
                onRowAction={onRowAction}
                onUpdateContact={onUpdateContact}
                selection={selection}
                selectedSegment={selectedSegment}
                segments={segments}
                subscribedLabel={subscribedLabel}
                topics={topics}
                unsubscribedLabel={unsubscribedLabel}
              />
            ))}
          </DataTable.Body>
        </DataTable.Root>
      </DataTable.SelectionViewport>
    </DataTable.SelectionRoot>
  );
}

export type { AudienceContactTableProps };
