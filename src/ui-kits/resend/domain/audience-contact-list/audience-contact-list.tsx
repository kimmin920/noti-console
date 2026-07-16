import { Loader2 } from 'lucide-react';
import { DataTable } from '../../data-display/data-table';
import { useControllableValue } from '../../utils/use-controllable-value';
import {
  audienceContactTableHeaders,
} from './data';
import { AudienceContactEmpty } from './audience-contact-empty';
import { AudienceContactBulkActions } from './audience-contact-bulk-actions';
import {
  AudienceContactFilters,
  AudienceContactHeader,
  AudienceContactNav,
} from './audience-contact-toolbar';
import { AudienceContactTable } from './audience-contact-table';
import type {
  AudienceContact,
  AudienceContactListProps,
  AudienceContactListState,
  AudienceSegment,
  AudienceSegmentFilter,
  AudienceStatus,
} from './types';

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

function isEmptyState(state: AudienceContactListState) {
  return state === 'empty' || state === 'filtered-empty' || state === 'segment-empty' || state === 'status-empty';
}

function getFallbackSegmentFilter(state: AudienceContactListState, segments: readonly AudienceSegment[]): AudienceSegmentFilter {
  if (state === 'segment' || state === 'segment-empty') return segments[0]?.id ?? 'all';
  return 'all';
}

function getFallbackStatusFilter(state: AudienceContactListState): AudienceStatus {
  if (state === 'status-empty') return 'unsubscribed';
  return 'all';
}

function getSelectedSegment(segmentFilter: AudienceSegmentFilter, segments: readonly AudienceSegment[]): AudienceSegment | undefined {
  if (segmentFilter === 'all') return undefined;
  return segments.find((segment) => segment.id === segmentFilter);
}

function AudienceLoadingTable({
  contactColumnLabel = 'Email',
  rows = 40,
  segmentsColumnLabel = 'Segments',
  statusColumnLabel = 'Status',
}: {
  readonly contactColumnLabel?: string;
  readonly rows?: number;
  readonly segmentsColumnLabel?: string;
  readonly statusColumnLabel?: string;
}) {
  const skeletonRows = Array.from({ length: rows }, (_, index) => `audience-contact-loading-${index}`);

  return (
    <div className="resend-ui-audience-contact-list__table-scroll">
      <DataTable.Root
        aria-busy="true"
        aria-label="Loading contacts"
        className="resend-ui-audience-contact-list__table"
        data-qa="audience-contact-loading-table"
      >
        <DataTable.Head>
          <DataTable.Row>
            {audienceContactTableHeaders.map((header) => (
              <DataTable.Header align={header.align} className={header.className} key={header.id}>
                {header.id === 'email'
                  ? contactColumnLabel
                  : header.id === 'segments'
                    ? segmentsColumnLabel
                  : header.id === 'status'
                    ? statusColumnLabel
                    : header.name}
              </DataTable.Header>
            ))}
          </DataTable.Row>
        </DataTable.Head>
        <DataTable.Body>
          {skeletonRows.map((row) => (
            <DataTable.Row key={row}>
              <DataTable.LoadingCell className="resend-ui-audience-contact-list__email-cell">
                <span className="resend-ui-audience-contact-list__loading-contact">
                  <span className="resend-ui-audience-contact-list__skeleton resend-ui-audience-contact-list__skeleton--avatar" />
                  <span className="resend-ui-audience-contact-list__skeleton resend-ui-audience-contact-list__skeleton--email" />
                </span>
              </DataTable.LoadingCell>
              <DataTable.LoadingCell>
                <span className="resend-ui-audience-contact-list__skeleton resend-ui-audience-contact-list__skeleton--segments" />
              </DataTable.LoadingCell>
              <DataTable.LoadingCell>
                <span className="resend-ui-audience-contact-list__skeleton resend-ui-audience-contact-list__skeleton--status" />
              </DataTable.LoadingCell>
              <DataTable.LoadingCell className="resend-ui-audience-contact-list__created-cell">
                <span className="resend-ui-audience-contact-list__skeleton resend-ui-audience-contact-list__skeleton--created" />
              </DataTable.LoadingCell>
              <DataTable.LoadingCell className="resend-ui-audience-contact-list__action-cell">
                <span className="resend-ui-audience-contact-list__skeleton resend-ui-audience-contact-list__skeleton--action" />
              </DataTable.LoadingCell>
            </DataTable.Row>
          ))}
        </DataTable.Body>
      </DataTable.Root>
    </div>
  );
}

function AudiencePagination() {
  return <div className="resend-ui-audience-contact-list__pagination">40 contacts</div>;
}

function AudienceImportingBar() {
  return (
    <div className="resend-ui-audience-contact-list__bottom-bar" data-mode="importing">
      <div className="resend-ui-audience-contact-list__bottom-bar-gradient" aria-hidden="true" />
      <div className="resend-ui-audience-contact-list__importing-status" role="status">
        <Loader2 aria-hidden="true" size={16} />
        Importing contacts...
      </div>
    </div>
  );
}

function getContactsForState(
  contacts: readonly AudienceContact[],
  selectedSegment: AudienceSegment | undefined,
  selectedStatus: AudienceStatus
) {
  return contacts.filter((contact) => {
    const matchesSegment = selectedSegment === undefined
      || contact.segments.some((segment) => segment.id === selectedSegment.id);
    const matchesStatus = selectedStatus === 'all'
      || (selectedStatus === 'subscribed' && !contact.unsubscribed)
      || (selectedStatus === 'unsubscribed' && contact.unsubscribed);
    return matchesSegment && matchesStatus;
  });
}

export function AudienceContactList({
  canCreateSegment = true,
  className,
  contactColumnLabel = 'Email',
  contactCsvCustomProperties = [],
  contactCustomProperties = [],
  contacts = [],
  defaultSegmentFilter,
  defaultSelectedContactIds,
  defaultStatusFilter,
  isAudienceContactRowActionDisabled,
  isUserAdmin = true,
  onAddContacts,
  onAddContactsToSegments,
  onAudienceContactRowAction,
  onDeleteContacts,
  onExport,
  onImportContactCsv,
  onParseContactCsv,
  onRemoveContactsFromSegments,
  onSegmentFilterChange,
  onSelectedContactIdsChange,
  onStatusFilterChange,
  onSubscribeContactsToTopics,
  onUpdateContact,
  segmentFilter,
  selectedContactIds,
  segments = [],
  segmentsColumnLabel = 'Segments',
  state = 'loaded',
  statusColumnLabel = 'Status',
  statusFilter,
  subscribedLabel = 'Subscribed',
  topics = [],
  unsubscribedLabel = 'Unsubscribed',
  ...props
}: AudienceContactListProps) {
  const [currentSegmentFilter, setCurrentSegmentFilter] = useControllableValue<AudienceSegmentFilter>({
    controlledValue: segmentFilter,
    defaultValue: defaultSegmentFilter ?? getFallbackSegmentFilter(state, segments),
    onValueChange: onSegmentFilterChange,
  });
  const [currentStatusFilter, setCurrentStatusFilter] = useControllableValue<AudienceStatus>({
    controlledValue: statusFilter,
    defaultValue: defaultStatusFilter ?? getFallbackStatusFilter(state),
    onValueChange: onStatusFilterChange,
  });
  const selectedSegment = getSelectedSegment(currentSegmentFilter, segments);
  const tableContacts = getContactsForState(contacts, selectedSegment, currentStatusFilter);
  const showLoading = state === 'loading' || state === 'importing';
  const showTable = state === 'loaded' || state === 'bulk' || state === 'segment';
  const fallbackSelectedContactIds = state === 'bulk'
    ? tableContacts.slice(0, 2).map((contact) => contact.id)
    : [];
  const [currentSelectedContactIds, setCurrentSelectedContactIds] = useControllableValue<readonly string[]>({
    controlledValue: selectedContactIds,
    defaultValue: defaultSelectedContactIds ?? fallbackSelectedContactIds,
    onValueChange: onSelectedContactIdsChange,
  });
  const visibleSelectedContacts = tableContacts.filter((contact) => currentSelectedContactIds.includes(contact.id));

  return (
    <section
      className={cx('resend-ui-audience-contact-list', className)}
      data-resend-domain-audience-contact-list
      {...props}
    >
      <AudienceContactHeader
        canCreateSegment={canCreateSegment}
        customProperties={contactCsvCustomProperties}
        onAddContacts={onAddContacts}
        onImportContactCsv={onImportContactCsv}
        onParseContactCsv={onParseContactCsv}
        segments={segments}
        selectedSegment={selectedSegment}
      />
      <AudienceContactNav />
      <AudienceContactFilters
        isUserAdmin={isUserAdmin}
        onExport={onExport}
        onSegmentFilterChange={setCurrentSegmentFilter}
        onStatusFilterChange={setCurrentStatusFilter}
        segmentFilter={currentSegmentFilter}
        selectedSegment={selectedSegment}
        selectedStatus={currentStatusFilter}
        segments={segments}
        topics={topics}
      />
      {showLoading && (
        <AudienceLoadingTable
          contactColumnLabel={contactColumnLabel}
          segmentsColumnLabel={segmentsColumnLabel}
          statusColumnLabel={statusColumnLabel}
        />
      )}
      {isEmptyState(state) && (
        <AudienceContactEmpty
          canCreateSegment={canCreateSegment}
          customProperties={contactCsvCustomProperties}
          onAddContacts={onAddContacts}
          onImportContactCsv={onImportContactCsv}
          onParseContactCsv={onParseContactCsv}
          segments={segments}
          selectedSegment={selectedSegment}
          state={state}
        />
      )}
      {showTable && (
        <AudienceContactTable
          contactColumnLabel={contactColumnLabel}
          contactCustomProperties={contactCustomProperties}
          contacts={tableContacts}
          isRowActionDisabled={isAudienceContactRowActionDisabled}
          onDeleteContacts={onDeleteContacts}
          onRemoveContactsFromSegments={onRemoveContactsFromSegments}
          onRowAction={onAudienceContactRowAction}
          onSelectedContactIdsChange={setCurrentSelectedContactIds}
          onUpdateContact={onUpdateContact}
          selectedContactIds={currentSelectedContactIds}
          selectedSegment={selectedSegment}
          segments={segments}
          segmentsColumnLabel={segmentsColumnLabel}
          statusColumnLabel={statusColumnLabel}
          subscribedLabel={subscribedLabel}
          topics={topics}
          unsubscribedLabel={unsubscribedLabel}
        />
      )}
      {(showLoading || showTable) && <AudiencePagination />}
      {showTable && (
        <AudienceContactBulkActions
          onAddContactsToSegments={onAddContactsToSegments}
          onClearSelection={() => setCurrentSelectedContactIds([])}
          onDeleteContacts={onDeleteContacts}
          onRemoveContactsFromSegments={onRemoveContactsFromSegments}
          onSubscribeContactsToTopics={onSubscribeContactsToTopics}
          segments={segments}
          selectedContacts={visibleSelectedContacts}
          selectedSegment={selectedSegment}
          topics={topics}
        />
      )}
      {state === 'importing' && <AudienceImportingBar />}
    </section>
  );
}
