import { DropdownMenu as RadixDropdownMenu } from 'radix-ui';
import { Check, FileUp, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../primitives/button';
import { DropdownMenu } from '../../primitives/dropdown-menu';
import { ExportModal } from '../export-modal';
import { FilterButton } from '../../primitives/filter-button';
import { PageHeaderApiAction } from '../../layout/page-header-actions';
import { SearchField } from '../../primitives/search-field';
import { NavigationTabs } from '../../primitives/tabs';
import {
  audienceStatusOptions,
} from './data';
import { AudienceAddContactsModal } from './audience-add-contacts-modal';
import { AudienceImportCsvModal } from './audience-import-csv-modal';
import type { ExportModalPayload } from '../export-modal';
import type {
  AudienceAddContactsPayload,
  AudienceAddContactsResult,
  AudienceContactCsvCustomProperty,
  AudienceContactCsvParseResult,
  AudienceImportContactCsvPayload,
  AudienceSegment,
  AudienceSegmentFilter,
  AudienceStatus,
  AudienceTopic,
} from './types';

const audienceTabs = [
  { href: '/audience/', label: 'Contacts', value: 'contacts' },
  { href: '/audience/properties', label: 'Properties', value: 'properties' },
  { href: '/audience/segments', label: 'Segments', value: 'segments' },
  { href: '/audience/topics', label: 'Topics', value: 'topics' },
] as const;

type AudienceTabValue = (typeof audienceTabs)[number]['value'];

type AudienceContactAddActionsProps = {
  readonly canCreateSegment?: boolean | undefined;
  readonly customProperties?: readonly AudienceContactCsvCustomProperty[] | undefined;
  readonly mode?: 'menu' | 'split';
  readonly onAddContacts?: ((payload: AudienceAddContactsPayload) => AudienceAddContactsResult | Promise<AudienceAddContactsResult | void> | void) | undefined;
  readonly onImportContactCsv?: ((payload: AudienceImportContactCsvPayload) => Promise<void> | void) | undefined;
  readonly onParseContactCsv?: ((file: File) => AudienceContactCsvParseResult | Promise<AudienceContactCsvParseResult>) | undefined;
  readonly segments: readonly AudienceSegment[];
  readonly selectedSegment?: AudienceSegment | undefined;
};

function AudienceContactAddActions({
  canCreateSegment,
  customProperties,
  mode = 'menu',
  onAddContacts,
  onImportContactCsv,
  onParseContactCsv,
  segments,
  selectedSegment,
}: AudienceContactAddActionsProps) {
  const [manualOpen, setManualOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  return (
    <>
      {mode === 'menu' ? (
        <DropdownMenu.Root>
          <RadixDropdownMenu.Trigger asChild>
            <Button className="resend-ui-audience-contact-list__add" hasLeadingIcon variant="accent">
              <Plus aria-hidden="true" size={16} />
              Add contacts
            </Button>
          </RadixDropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item onSelect={() => window.requestAnimationFrame(() => setManualOpen(true))}>
              Add manually
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => window.requestAnimationFrame(() => setCsvOpen(true))}>
              Import CSV
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      ) : (
        <div className="resend-ui-audience-contact-list__empty-actions">
          <Button hasLeadingIcon onClick={() => setManualOpen(true)} variant="accent">
            <Plus aria-hidden="true" size={16} />
            Add contacts
          </Button>
          <Button hasLeadingIcon onClick={() => setCsvOpen(true)} variant="interactive">
            <FileUp aria-hidden="true" size={16} />
            Import contacts
          </Button>
        </div>
      )}
      <AudienceAddContactsModal
        defaultSegmentIds={selectedSegment ? [selectedSegment.id] : []}
        onAddContacts={onAddContacts}
        onOpenChange={setManualOpen}
        open={manualOpen}
        segments={segments}
      />
      <AudienceImportCsvModal
        canCreateSegment={canCreateSegment}
        customProperties={customProperties}
        onImportContactCsv={onImportContactCsv}
        onOpenChange={setCsvOpen}
        onParseContactCsv={onParseContactCsv}
        open={csvOpen}
        segments={segments}
      />
    </>
  );
}

function SegmentFilter({
  onSegmentFilterChange,
  segmentFilter,
  selectedSegment,
  segments,
}: {
  readonly onSegmentFilterChange: (segmentFilter: AudienceSegmentFilter) => void;
  readonly segmentFilter: AudienceSegmentFilter;
  readonly selectedSegment: AudienceSegment | undefined;
  readonly segments: readonly AudienceSegment[];
}) {
  return (
    <DropdownMenu.Root>
      <RadixDropdownMenu.Trigger asChild>
        <FilterButton className="resend-ui-audience-contact-list__segment-filter">
          {selectedSegment?.name ?? 'All contacts'}
        </FilterButton>
      </RadixDropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="resend-ui-audience-contact-list__filter-content">
        <DropdownMenu.Item
          className="resend-ui-audience-contact-list__menu-check-row"
          data-filter-value="all"
          onSelect={() => onSegmentFilterChange('all')}
        >
          <span>All contacts</span>
          {segmentFilter === 'all' && <Check aria-hidden="true" size={14} />}
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <span className="resend-ui-audience-contact-list__menu-label">Segments</span>
        {segments.map((segment) => (
          <DropdownMenu.Item
            className="resend-ui-audience-contact-list__menu-check-row"
            data-filter-value={segment.id}
            key={segment.id}
            onSelect={() => onSegmentFilterChange(segment.id)}
          >
            <span>
              {segment.name}
              <span className="resend-ui-audience-contact-list__menu-count">
                {segment.contactsCount?.toLocaleString()}
              </span>
            </span>
            {selectedSegment?.id === segment.id && <Check aria-hidden="true" size={14} />}
          </DropdownMenu.Item>
        ))}
        <DropdownMenu.Separator />
        <DropdownMenu.Item>Create a segment</DropdownMenu.Item>
        <DropdownMenu.Item>Manage segments</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

function StatusFilter({
  onStatusFilterChange,
  selectedStatus,
  topics,
}: {
  readonly onStatusFilterChange: (statusFilter: AudienceStatus) => void;
  readonly selectedStatus: AudienceStatus;
  readonly topics: readonly AudienceTopic[];
}) {
  const selected = audienceStatusOptions.find((option) => option.id === selectedStatus) ?? {
    id: 'all',
    name: 'All subscriptions',
  };

  return (
    <DropdownMenu.Root>
      <RadixDropdownMenu.Trigger asChild>
        <FilterButton className="resend-ui-audience-contact-list__status-filter">
          {selected.name}
        </FilterButton>
      </RadixDropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="resend-ui-audience-contact-list__filter-content">
        {audienceStatusOptions.map((option) => (
          <DropdownMenu.Item
            className="resend-ui-audience-contact-list__status-option"
            data-filter-value={option.id}
            key={option.id}
            onSelect={() => onStatusFilterChange(option.id)}
          >
            <span className="resend-ui-audience-contact-list__status-option-content">
              <span
                aria-hidden="true"
                className="resend-ui-audience-contact-list__status-dot"
                data-status={option.id}
              />
              {option.name}
            </span>
            {selectedStatus === option.id && <Check aria-hidden="true" size={14} />}
          </DropdownMenu.Item>
        ))}
        <DropdownMenu.Separator />
        <span className="resend-ui-audience-contact-list__menu-label">Topics</span>
        {topics.map((topic) => (
          <DropdownMenu.Item key={topic.id}>{topic.name}</DropdownMenu.Item>
        ))}
        <DropdownMenu.Separator />
        <DropdownMenu.Item>Manage topics</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

function AudienceContactFilters({
  isUserAdmin,
  onExport,
  onSegmentFilterChange,
  onStatusFilterChange,
  segmentFilter,
  selectedSegment,
  selectedStatus,
  segments,
  topics,
}: {
  readonly isUserAdmin: boolean;
  readonly onExport?: ((payload: ExportModalPayload) => void) | undefined;
  readonly onSegmentFilterChange: (segmentFilter: AudienceSegmentFilter) => void;
  readonly onStatusFilterChange: (statusFilter: AudienceStatus) => void;
  readonly segmentFilter: AudienceSegmentFilter;
  readonly selectedSegment: AudienceSegment | undefined;
  readonly selectedStatus: AudienceStatus;
  readonly segments: readonly AudienceSegment[];
  readonly topics: readonly AudienceTopic[];
}) {
  return (
    <div className="resend-ui-audience-contact-list__filters">
      <SearchField
        aria-label="Search contacts"
        className="resend-ui-audience-contact-list__search"
        placeholder="Search by name, email, or multiple emails..."
      />
      <div className="resend-ui-audience-contact-list__filter-group">
        <SegmentFilter
          onSegmentFilterChange={onSegmentFilterChange}
          segmentFilter={segmentFilter}
          selectedSegment={selectedSegment}
          segments={segments}
        />
        <StatusFilter onStatusFilterChange={onStatusFilterChange} selectedStatus={selectedStatus} topics={topics} />
      </div>
      <ExportModal
        disabled={!isUserAdmin}
        entity="contacts"
        onExport={onExport}
        triggerAriaLabel="Export contacts"
        triggerClassName="resend-ui-audience-contact-list__export"
      />
    </div>
  );
}

export function AudienceContactHeader({
  canCreateSegment,
  customProperties,
  onAddContacts,
  onImportContactCsv,
  onParseContactCsv,
  segments,
  selectedSegment,
}: AudienceContactAddActionsProps) {
  return (
    <header className="resend-ui-audience-contact-list__header">
      <h1 className="resend-ui-audience-contact-list__title">Audience</h1>
      <div className="resend-ui-audience-contact-list__toolbar">
        <AudienceContactAddActions
          canCreateSegment={canCreateSegment}
          customProperties={customProperties}
          onAddContacts={onAddContacts}
          onImportContactCsv={onImportContactCsv}
          onParseContactCsv={onParseContactCsv}
          segments={segments}
          selectedSegment={selectedSegment}
        />
        <PageHeaderApiAction />
      </div>
    </header>
  );
}

export function AudienceContactNav({
  value = 'contacts',
}: {
  readonly value?: AudienceTabValue;
}) {
  return <NavigationTabs className="resend-ui-audience-contact-list__tabs" items={audienceTabs} value={value} />;
}

export { AudienceContactAddActions, AudienceContactFilters };
export type { AudienceTabValue };
