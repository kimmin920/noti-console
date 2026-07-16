import { EmptyState } from '../../data-display/empty-state';
import { AudienceContactAddActions } from './audience-contact-toolbar';
import type {
  AudienceAddContactsPayload,
  AudienceAddContactsResult,
  AudienceContactCsvCustomProperty,
  AudienceContactCsvParseResult,
  AudienceContactListState,
  AudienceImportContactCsvPayload,
  AudienceSegment,
} from './types';

function getEmptyTitle(
  state: AudienceContactListState,
  selectedSegment: AudienceSegment | undefined
) {
  if (state === 'filtered-empty') return 'No contacts found';
  if (state === 'status-empty') return 'No contacts unsubscribed';
  if (state === 'segment-empty') return `No contacts in "${selectedSegment?.name ?? 'segment'}"`;
  return 'No contacts yet';
}

function getEmptyDescription(state: AudienceContactListState) {
  if (state === 'filtered-empty') {
    return 'No contacts match your current filters. Try adjusting your filters or clearing them to see all contacts.';
  }

  return 'Add contacts to manage, segment, and reach your audience.';
}

export function AudienceContactEmpty({
  canCreateSegment,
  customProperties,
  onAddContacts,
  onImportContactCsv,
  onParseContactCsv,
  segments,
  selectedSegment,
  state,
}: {
  readonly canCreateSegment?: boolean | undefined;
  readonly customProperties?: readonly AudienceContactCsvCustomProperty[] | undefined;
  readonly onAddContacts?: ((payload: AudienceAddContactsPayload) => AudienceAddContactsResult | Promise<AudienceAddContactsResult | void> | void) | undefined;
  readonly onImportContactCsv?: ((payload: AudienceImportContactCsvPayload) => Promise<void> | void) | undefined;
  readonly onParseContactCsv?: ((file: File) => AudienceContactCsvParseResult | Promise<AudienceContactCsvParseResult>) | undefined;
  readonly segments: readonly AudienceSegment[];
  readonly selectedSegment: AudienceSegment | undefined;
  readonly state: AudienceContactListState;
}) {
  return (
    <EmptyState.Root className="resend-ui-audience-contact-list__empty">
      <EmptyState.Content>
        <EmptyState.Title>{getEmptyTitle(state, selectedSegment)}</EmptyState.Title>
        <EmptyState.Description>{getEmptyDescription(state)}</EmptyState.Description>
        {state !== 'filtered-empty' && (
          <EmptyState.Actions>
            <AudienceContactAddActions
              canCreateSegment={canCreateSegment}
              customProperties={customProperties}
              mode="split"
              onAddContacts={onAddContacts}
              onImportContactCsv={onImportContactCsv}
              onParseContactCsv={onParseContactCsv}
              segments={segments}
              selectedSegment={selectedSegment}
            />
          </EmptyState.Actions>
        )}
      </EmptyState.Content>
    </EmptyState.Root>
  );
}
