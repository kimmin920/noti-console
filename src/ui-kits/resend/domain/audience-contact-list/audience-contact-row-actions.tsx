import { Ellipsis } from 'lucide-react';
import { DropdownMenu as RadixDropdownMenu } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';
import { DropdownMenu } from '../../primitives/dropdown-menu';
import { IconButton } from '../../primitives/icon-button';
import {
  AudienceDeleteContactsModal,
  AudienceEditContactModal,
  AudienceRemoveContactsFromSegmentsModal,
} from './audience-contact-action-modals';
import type {
  AudienceContact,
  AudienceContactCustomPropertyDefinition,
  AudienceDeleteContactsPayload,
  AudienceRemoveContactsFromSegmentsPayload,
  AudienceContactRowAction,
  AudienceContactRowActionDisabled,
  AudienceContactRowActionHandler,
  AudienceSegment,
  AudienceTopic,
  AudienceUpdateContactPayload,
} from './types';

type AudienceContactRowActionsProps = {
  readonly contact: AudienceContact;
  readonly customProperties?: readonly AudienceContactCustomPropertyDefinition[];
  readonly isRowActionDisabled?: AudienceContactRowActionDisabled | undefined;
  readonly onDeleteContacts?: ((payload: AudienceDeleteContactsPayload) => Promise<void> | void) | undefined;
  readonly onRemoveContactsFromSegments?: ((payload: AudienceRemoveContactsFromSegmentsPayload) => Promise<void> | void) | undefined;
  readonly onRowAction?: AudienceContactRowActionHandler | undefined;
  readonly onUpdateContact?: ((payload: AudienceUpdateContactPayload) => Promise<void> | void) | undefined;
  readonly selectedSegment: AudienceSegment | undefined;
  readonly segments?: readonly AudienceSegment[];
  readonly topics?: readonly AudienceTopic[];
};

export function AudienceContactRowActions({
  contact,
  customProperties = [],
  isRowActionDisabled,
  onDeleteContacts,
  onRemoveContactsFromSegments,
  onRowAction,
  onUpdateContact,
  selectedSegment,
  segments = [],
  topics = [],
}: AudienceContactRowActionsProps) {
  const [activeModal, setActiveModal] = useState<AudienceContactRowAction | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const modalFrameRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isDisabled = (action: AudienceContactRowAction) => isRowActionDisabled?.(action, contact) ?? false;

  useEffect(() => () => {
    if (modalFrameRef.current !== null) window.cancelAnimationFrame(modalFrameRef.current);
  }, []);

  const handleSelect = (action: AudienceContactRowAction) => {
    onRowAction?.(action, contact);
    setMenuOpen(false);
    modalFrameRef.current = window.requestAnimationFrame(() => {
      modalFrameRef.current = null;
      setActiveModal(action);
    });
  };
  const handleModalCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    triggerRef.current?.focus();
  };

  return (
    <>
      <DropdownMenu.Root onOpenChange={setMenuOpen} open={menuOpen}>
        <RadixDropdownMenu.Trigger asChild>
          <IconButton
            className="resend-ui-audience-contact-list__row-action-trigger"
            icon={<Ellipsis size={12} />}
            label="More actions"
            ref={triggerRef}
          />
        </RadixDropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Item
            disabled={isDisabled('edit')}
            onSelect={(event) => {
              event.preventDefault();
              handleSelect('edit');
            }}
          >
            Edit contact
          </DropdownMenu.Item>
          {selectedSegment !== undefined && (
            <DropdownMenu.Item
              disabled={isDisabled('remove-from-segment')}
              onSelect={(event) => {
                event.preventDefault();
                handleSelect('remove-from-segment');
              }}
            >
              Remove from segment
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            disabled={isDisabled('delete')}
            onSelect={(event) => {
              event.preventDefault();
              handleSelect('delete');
            }}
            variant="red"
          >
            Delete contact
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      <AudienceEditContactModal
        contact={contact}
        customProperties={customProperties}
        onCloseAutoFocus={handleModalCloseAutoFocus}
        onOpenChange={(open) => setActiveModal(open ? 'edit' : null)}
        onSave={onUpdateContact}
        open={activeModal === 'edit'}
        segments={segments}
        topics={topics}
      />
      {selectedSegment !== undefined ? (
        <AudienceRemoveContactsFromSegmentsModal
          contactIds={[contact.id]}
          defaultSegmentIds={[selectedSegment.id]}
          onCloseAutoFocus={handleModalCloseAutoFocus}
          onOpenChange={(open) => setActiveModal(open ? 'remove-from-segment' : null)}
          onRemove={onRemoveContactsFromSegments}
          open={activeModal === 'remove-from-segment'}
          segments={segments}
        />
      ) : null}
      <AudienceDeleteContactsModal
        contactEmail={contact.email}
        contactIds={[contact.id]}
        onCloseAutoFocus={handleModalCloseAutoFocus}
        onDelete={onDeleteContacts}
        onOpenChange={(open) => setActiveModal(open ? 'delete' : null)}
        open={activeModal === 'delete'}
      />
    </>
  );
}
