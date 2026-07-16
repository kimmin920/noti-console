import { DropdownMenu as RadixDropdownMenu } from 'radix-ui';
import { Delete as BackspaceIcon, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Button } from '../../primitives/button';
import { DropdownMenu } from '../../primitives/dropdown-menu';
import { IconButton } from '../../primitives/icon-button';
import {
  AudienceAddContactsToSegmentsModal,
  AudienceDeleteContactsModal,
  AudienceRemoveContactsFromSegmentsModal,
  AudienceSubscribeContactsToTopicsModal,
} from './audience-contact-action-modals';
import type {
  AudienceAddContactsToSegmentsPayload,
  AudienceContact,
  AudienceDeleteContactsPayload,
  AudienceRemoveContactsFromSegmentsPayload,
  AudienceSegment,
  AudienceSubscribeContactsToTopicsPayload,
  AudienceTopic,
} from './types';

type AudienceContactBulkActionsProps = {
  readonly onAddContactsToSegments?: ((payload: AudienceAddContactsToSegmentsPayload) => Promise<void> | void) | undefined;
  readonly onClearSelection: () => void;
  readonly onDeleteContacts?: ((payload: AudienceDeleteContactsPayload) => Promise<void> | void) | undefined;
  readonly onRemoveContactsFromSegments?: ((payload: AudienceRemoveContactsFromSegmentsPayload) => Promise<void> | void) | undefined;
  readonly onSubscribeContactsToTopics?: ((payload: AudienceSubscribeContactsToTopicsPayload) => Promise<void> | void) | undefined;
  readonly segments: readonly AudienceSegment[];
  readonly selectedContacts: readonly AudienceContact[];
  readonly selectedSegment: AudienceSegment | undefined;
  readonly topics: readonly AudienceTopic[];
};

type BulkModal = 'add-to-segments' | 'delete' | 'remove-from-segments' | 'subscribe-to-topics' | null;

function hasOpenKeyboardInteractionSurface(target: EventTarget | null) {
  const targetElement = target instanceof Element ? target : null;
  return Boolean(
    targetElement?.closest('[role="dialog"], [role="listbox"], [role="menu"]')
    || document.querySelector([
      '[data-resend-audience-contact-modal]',
      '[role="menu"][data-state="open"]',
      '.resend-ui-audience-contact-combobox__content[data-state="open"]',
    ].join(', '))
  );
}

function AudienceContactBulkActions({
  onAddContactsToSegments,
  onClearSelection,
  onDeleteContacts,
  onRemoveContactsFromSegments,
  onSubscribeContactsToTopics,
  segments,
  selectedContacts,
  selectedSegment,
  topics,
}: AudienceContactBulkActionsProps) {
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [modal, setModal] = useState<BulkModal>(null);
  const prefersReducedMotion = useReducedMotion();
  const contactIds = selectedContacts.map((contact) => contact.id);
  const count = contactIds.length;

  useEffect(() => {
    if (count > 0) return;
    setEditMenuOpen(false);
    setModal(null);
  }, [count]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (count === 0) return;
      const target = event.target;
      const editableTarget = target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
      if (editableTarget || hasOpenKeyboardInteractionSurface(target)) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

      if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        setEditMenuOpen(true);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        setModal('delete');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [count]);

  function openModal(nextModal: Exclude<BulkModal, null>) {
    setEditMenuOpen(false);
    setModal(nextModal);
  }

  function clearSelection() {
    setEditMenuOpen(false);
    setModal(null);
    onClearSelection();
  }

  return (
    <>
      <AnimatePresence>
        {count > 0 ? (
          <motion.div
            animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
            className="resend-ui-audience-contact-list__bottom-bar"
            data-mode="bulk"
            data-resend-audience-contact-bulk-actions
            exit={prefersReducedMotion
              ? { opacity: 0 }
              : { transition: { bounce: 0, duration: .6, type: 'spring' }, y: 100 }}
            initial={prefersReducedMotion ? { opacity: 0 } : { y: 100 }}
            key="audience-contact-bulk-actions"
            transition={prefersReducedMotion
              ? { duration: 0 }
              : { bounce: 0, duration: .3, type: 'spring' }}
          >
            <motion.div
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              aria-hidden="true"
              className="resend-ui-audience-contact-list__bottom-bar-gradient"
              exit={{ opacity: 0, transition: { duration: prefersReducedMotion ? 0 : 1 } }}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: prefersReducedMotion ? 0 : .5 }}
            />
            <div className="resend-ui-audience-contact-list__bottom-bar-content">
              <span className="resend-ui-audience-contact-list__bulk-count">{count} selected</span>
              <IconButton
                className="resend-ui-audience-contact-list__bulk-fade-button resend-ui-audience-contact-list__bulk-clear"
                icon={<X aria-hidden="true" size={12} />}
                label="Clear selection"
                onClick={clearSelection}
              />
              <span aria-hidden="true" className="resend-ui-audience-contact-list__bulk-divider" />
              <DropdownMenu.Root onOpenChange={setEditMenuOpen} open={editMenuOpen}>
                <RadixDropdownMenu.Trigger asChild>
                  <Button className="resend-ui-audience-contact-list__bulk-fade-button" variant="interactive">
                    <span>Edit</span>
                    <kbd aria-hidden="true" className="resend-ui-audience-contact-list__bulk-shortcut">E</kbd>
                  </Button>
                </RadixDropdownMenu.Trigger>
                <DropdownMenu.Content align="start">
                  <DropdownMenu.Item
                    onSelect={(event) => {
                      event.preventDefault();
                      openModal('add-to-segments');
                    }}
                  >
                    Add to segments
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={(event) => {
                      event.preventDefault();
                      openModal('remove-from-segments');
                    }}
                  >
                    Remove from segment
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    onSelect={(event) => {
                      event.preventDefault();
                      openModal('subscribe-to-topics');
                    }}
                  >
                    Subscribe to topics
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
              <Button
                className="resend-ui-audience-contact-list__bulk-fade-button resend-ui-audience-contact-list__bulk-delete"
                onClick={() => openModal('delete')}
                variant="interactive"
              >
                <span>Delete</span>
                <kbd aria-hidden="true" className="resend-ui-audience-contact-list__bulk-shortcut">
                  <BackspaceIcon aria-hidden="true" size={12} />
                </kbd>
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {count > 0 ? <AudienceAddContactsToSegmentsModal
        contactIds={contactIds}
        onAdd={onAddContactsToSegments}
        onOpenChange={(open) => setModal(open ? 'add-to-segments' : null)}
        onSuccess={clearSelection}
        open={modal === 'add-to-segments'}
        segments={segments}
      /> : null}
      {count > 0 ? <AudienceRemoveContactsFromSegmentsModal
        contactIds={contactIds}
        defaultSegmentIds={selectedSegment ? [selectedSegment.id] : []}
        onOpenChange={(open) => setModal(open ? 'remove-from-segments' : null)}
        onRemove={onRemoveContactsFromSegments}
        onSuccess={clearSelection}
        open={modal === 'remove-from-segments'}
        segments={segments}
      /> : null}
      {count > 0 ? <AudienceSubscribeContactsToTopicsModal
        contactIds={contactIds}
        onOpenChange={(open) => setModal(open ? 'subscribe-to-topics' : null)}
        onSubscribe={onSubscribeContactsToTopics}
        onSuccess={clearSelection}
        open={modal === 'subscribe-to-topics'}
        topics={topics}
      /> : null}
      {count > 0 ? <AudienceDeleteContactsModal
        contactEmail={count === 1 ? selectedContacts[0]?.email : undefined}
        contactIds={contactIds}
        onDelete={onDeleteContacts}
        onOpenChange={(open) => setModal(open ? 'delete' : null)}
        onSuccess={clearSelection}
        open={modal === 'delete'}
      /> : null}
    </>
  );
}

export { AudienceContactBulkActions };
export type { AudienceContactBulkActionsProps };
