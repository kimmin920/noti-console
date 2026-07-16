import { DropdownMenu as RadixDropdownMenu } from 'radix-ui';
import { Check, Palette, Plus } from 'lucide-react';
import { Button } from '../../primitives/button';
import { DropdownMenu } from '../../primitives/dropdown-menu';
import { EmptyState } from '../../data-display/empty-state';
import { FilterButton } from '../../primitives/filter-button';
import { PageHeaderApiAction } from '../../layout/page-header-actions';
import { SearchField } from '../../primitives/search-field';
import { useControllableValue } from '../../utils/use-controllable-value';
import { AudienceContactNav } from '../audience-contact-list/audience-contact-toolbar';
import {
  audienceManagementEmptyCopy,
  audienceManagementPrimaryActions,
  audienceManagementSearchPlaceholders,
} from './data';
import { AudienceManagementListTable } from './audience-management-list-table';
import type {
  AudienceManagementListProps,
  AudienceManagementListState,
  AudienceManagementView,
  AudiencePropertyTypeFilter,
  TopicDefaultSubscriptionFilter,
} from './types';

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

function getTotalForView(view: AudienceManagementView, properties: readonly unknown[], segments: readonly unknown[], topics: readonly unknown[]) {
  switch (view) {
    case 'properties':
      return properties.length;
    case 'segments':
      return segments.length;
    case 'topics':
      return topics.length;
  }
}

function getDefaultSelectedIdsForView(
  view: AudienceManagementView,
  properties: readonly { readonly id: string }[],
  segments: readonly { readonly id: string }[],
  topics: readonly { readonly id: string }[]
) {
  switch (view) {
    case 'properties':
      return properties.slice(0, 2).map((property) => property.id);
    case 'segments':
      return segments.slice(0, 2).map((segment) => segment.id);
    case 'topics':
      return topics.slice(0, 2).map((topic) => topic.id);
  }
}

function getPluralLabel(view: AudienceManagementView) {
  switch (view) {
    case 'properties':
      return 'properties';
    case 'segments':
      return 'segments';
    case 'topics':
      return 'topics';
  }
}

function AudienceManagementHeader({ unsubscribePageHref, view }: {
  readonly unsubscribePageHref: string;
  readonly view: AudienceManagementView;
}) {
  return (
    <header className="resend-ui-audience-contact-list__header">
      <h1 className="resend-ui-audience-contact-list__title">Audience</h1>
      <div className="resend-ui-audience-contact-list__toolbar">
        <Button className="resend-ui-audience-management-list__primary" hasLeadingIcon variant="accent">
          <Plus aria-hidden="true" size={16} />
          {audienceManagementPrimaryActions[view]}
        </Button>
        {view === 'topics' && (
          <Button asChild className="resend-ui-audience-management-list__page-action" hasLeadingIcon>
            <a aria-label="Edit Unsubscribe Page" href={unsubscribePageHref}>
              <Palette aria-hidden="true" size={16} />
              <span className="resend-ui-audience-management-list__page-action-text">
                Edit Unsubscribe Page
              </span>
            </a>
          </Button>
        )}
        <PageHeaderApiAction />
      </div>
    </header>
  );
}

function MenuFilter({
  label,
  options,
  onValueChange,
  value,
}: {
  readonly label: string;
  readonly onValueChange: (value: string) => void;
  readonly options: readonly { readonly label: string; readonly value: string }[];
  readonly value: string;
}) {
  return (
    <DropdownMenu.Root>
      <RadixDropdownMenu.Trigger asChild>
        <FilterButton className="resend-ui-audience-management-list__filter">{label}</FilterButton>
      </RadixDropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="resend-ui-audience-management-list__filter-content">
        {options.map((option) => (
          <DropdownMenu.Item
            className="resend-ui-audience-management-list__menu-check-row"
            data-filter-value={option.value}
            key={option.value}
            onSelect={() => onValueChange(option.value)}
          >
            <span>{option.label}</span>
            {value === option.value && <Check aria-hidden="true" size={14} />}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

const topicDefaultOptions = [
  { label: 'Any default', value: 'any' },
  { label: 'Opt-in', value: 'opt_in' },
  { label: 'Opt-out', value: 'opt_out' },
] as const;

const propertyTypeOptions = [
  { label: 'All types', value: 'all' },
  { label: 'string', value: 'string' },
  { label: 'number', value: 'number' },
  { label: 'boolean', value: 'boolean' },
] as const;

function getTopicDefaultLabel(value: TopicDefaultSubscriptionFilter) {
  return topicDefaultOptions.find((option) => option.value === value)?.label ?? 'Any default';
}

function getPropertyTypeLabel(value: AudiencePropertyTypeFilter) {
  return propertyTypeOptions.find((option) => option.value === value)?.label ?? 'All types';
}

function isTopicDefaultFilter(value: string): value is TopicDefaultSubscriptionFilter {
  return topicDefaultOptions.some((option) => option.value === value);
}

function isPropertyTypeFilter(value: string): value is AudiencePropertyTypeFilter {
  return propertyTypeOptions.some((option) => option.value === value);
}

function AudienceManagementFilters({
  onPropertyTypeFilterChange,
  onTopicDefaultFilterChange,
  propertyTypeFilter,
  topicDefaultFilter,
  view,
}: {
  readonly onPropertyTypeFilterChange: (propertyTypeFilter: AudiencePropertyTypeFilter) => void;
  readonly onTopicDefaultFilterChange: (topicDefaultFilter: TopicDefaultSubscriptionFilter) => void;
  readonly propertyTypeFilter: AudiencePropertyTypeFilter;
  readonly topicDefaultFilter: TopicDefaultSubscriptionFilter;
  readonly view: AudienceManagementView;
}) {
  return (
    <div className="resend-ui-audience-management-list__filters">
      <SearchField
        aria-label={`Search ${getPluralLabel(view)}`}
        className="resend-ui-audience-management-list__search"
        placeholder={audienceManagementSearchPlaceholders[view]}
      />
      {view === 'topics' && (
        <MenuFilter
          label={getTopicDefaultLabel(topicDefaultFilter)}
          onValueChange={(value) => {
            if (isTopicDefaultFilter(value)) onTopicDefaultFilterChange(value);
          }}
          options={topicDefaultOptions}
          value={topicDefaultFilter}
        />
      )}
      {view === 'properties' && (
        <MenuFilter
          label={getPropertyTypeLabel(propertyTypeFilter)}
          onValueChange={(value) => {
            if (isPropertyTypeFilter(value)) onPropertyTypeFilterChange(value);
          }}
          options={propertyTypeOptions}
          value={propertyTypeFilter}
        />
      )}
    </div>
  );
}

function AudienceManagementEmpty({
  state,
  view,
}: {
  readonly state: AudienceManagementListState;
  readonly view: AudienceManagementView;
}) {
  const copy = audienceManagementEmptyCopy[view];
  const isFiltered = state === 'filtered-empty';

  return (
    <EmptyState.Root className="resend-ui-audience-management-list__empty">
      <EmptyState.Content>
        <EmptyState.Media />
        <EmptyState.Title>{isFiltered ? copy.filteredTitle : copy.title}</EmptyState.Title>
        <EmptyState.Description>
          {isFiltered ? copy.filteredDescription : copy.description}
        </EmptyState.Description>
        {!isFiltered && (
          <EmptyState.Actions>
            <Button hasLeadingIcon variant="accent">
              <Plus aria-hidden="true" size={16} />
              {copy.action}
            </Button>
          </EmptyState.Actions>
        )}
      </EmptyState.Content>
    </EmptyState.Root>
  );
}

function AudienceManagementBulkBar({ view }: { readonly view: AudienceManagementView }) {
  return (
    <div className="resend-ui-audience-management-list__bottom-bar" data-mode="bulk">
      <div className="resend-ui-audience-management-list__bottom-bar-gradient" aria-hidden="true" />
      <div className="resend-ui-audience-management-list__bottom-bar-content">
        <Button className="resend-ui-audience-management-list__bulk-delete" variant="interactive">
          Delete
        </Button>
        <span className="resend-ui-audience-management-list__bulk-copy">
          Delete selected {getPluralLabel(view)}
        </span>
      </div>
    </div>
  );
}

export function AudienceManagementList({
  className,
  defaultPropertyTypeFilter = 'all',
  defaultSelectedAudienceManagementIds,
  defaultTopicDefaultFilter = 'any',
  getSegmentHref = (segment) => `/audience?segmentId=${segment.id}`,
  getTopicHref = (topic) => `/audience?status=${topic.id}`,
  isAudienceManagementRowActionDisabled,
  onAudienceManagementRowAction,
  onPropertyTypeFilterChange,
  onSelectedAudienceManagementIdsChange,
  onTopicDefaultFilterChange,
  propertyTypeFilter,
  properties = [],
  propertiesHref = '/audience/properties',
  selectedAudienceManagementIds,
  segments = [],
  state = 'loaded',
  topicDefaultFilter,
  unsubscribePageHref = '/audience/topics/unsubscribe-page/edit',
  topics = [],
  view = 'segments',
  ...props
}: AudienceManagementListProps) {
  const [currentPropertyTypeFilter, setCurrentPropertyTypeFilter] = useControllableValue<AudiencePropertyTypeFilter>({
    controlledValue: propertyTypeFilter,
    defaultValue: defaultPropertyTypeFilter,
    onValueChange: onPropertyTypeFilterChange,
  });
  const [currentTopicDefaultFilter, setCurrentTopicDefaultFilter] = useControllableValue<TopicDefaultSubscriptionFilter>({
    controlledValue: topicDefaultFilter,
    defaultValue: defaultTopicDefaultFilter,
    onValueChange: onTopicDefaultFilterChange,
  });
  const showEmpty = state === 'empty' || state === 'filtered-empty';
  const showLoading = state === 'loading';
  const showTable = state === 'loaded' || state === 'bulk' || showLoading;
  const fallbackSelectedAudienceManagementIds = state === 'bulk'
    ? getDefaultSelectedIdsForView(view, properties, segments, topics)
    : undefined;

  return (
    <section
      className={cx('resend-ui-audience-management-list', className)}
      data-resend-domain-audience-management-list
      data-view={view}
      {...props}
      >
      <AudienceManagementHeader unsubscribePageHref={unsubscribePageHref} view={view} />
      <AudienceContactNav value={view} />
      <AudienceManagementFilters
        onPropertyTypeFilterChange={setCurrentPropertyTypeFilter}
        onTopicDefaultFilterChange={setCurrentTopicDefaultFilter}
        propertyTypeFilter={currentPropertyTypeFilter}
        topicDefaultFilter={currentTopicDefaultFilter}
        view={view}
      />
      {showEmpty && <AudienceManagementEmpty state={state} view={view} />}
      {showTable && (
        <AudienceManagementListTable
          defaultSelectedAudienceManagementIds={
            defaultSelectedAudienceManagementIds ?? fallbackSelectedAudienceManagementIds
          }
          isRowActionDisabled={isAudienceManagementRowActionDisabled}
          getSegmentHref={getSegmentHref}
          getTopicHref={getTopicHref}
          loading={showLoading}
          onRowAction={onAudienceManagementRowAction}
          onSelectedAudienceManagementIdsChange={onSelectedAudienceManagementIdsChange}
          propertiesHref={propertiesHref}
          properties={properties}
          segments={segments}
          selectedAudienceManagementIds={selectedAudienceManagementIds}
          topics={topics}
          view={view}
        />
      )}
      {showTable && (
        <div className="resend-ui-audience-management-list__pagination">
          {getTotalForView(view, properties, segments, topics)} {getPluralLabel(view)}
        </div>
      )}
      {state === 'bulk' && <AudienceManagementBulkBar view={view} />}
    </section>
  );
}
