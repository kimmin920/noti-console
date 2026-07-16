import { Checkbox } from '../../primitives/checkbox';
import {
  DataTable,
  type RowSelectionCheckedState,
  type RowSelectionState,
} from '../../data-display/data-table';
import { topicDefaultSubscriptionLabels } from './data';
import { AudienceManagementRowActions } from './audience-management-row-actions';
import type {
  AudienceManagementView,
  AudienceManagementRowActionDisabled,
  AudienceManagementRowActionHandler,
  AudiencePropertyRecord,
  AudienceSegmentRecord,
  AudienceTopicRecord,
} from './types';

function assertNever(value: never): never {
  throw new Error(`Unhandled audience management view: ${value}`);
}

function SelectableName({
  checked,
  children,
  href,
  label,
  onCheckedChange,
  rowIndex,
}: {
  readonly checked: boolean;
  readonly children: string;
  readonly href: string;
  readonly label: string;
  readonly onCheckedChange: (checked: RowSelectionCheckedState) => void;
  readonly rowIndex: number;
}) {
  return (
    <span className="resend-ui-audience-management-list__name-cell">
      <DataTable.SelectionItem selected={checked}>
        <Checkbox
          aria-label={label}
          checked={checked}
          data-row-index={rowIndex}
          onCheckedChange={onCheckedChange}
        />
      </DataTable.SelectionItem>
      <a className="resend-ui-audience-management-list__name-link" href={href} title={children}>
        {children}
      </a>
    </span>
  );
}

function SegmentRow({
  getHref,
  index,
  isRowActionDisabled,
  onRowAction,
  segment,
  selection,
}: {
  readonly getHref: (segment: AudienceSegmentRecord) => string;
  readonly index: number;
  readonly isRowActionDisabled?: AudienceManagementRowActionDisabled | undefined;
  readonly onRowAction?: AudienceManagementRowActionHandler | undefined;
  readonly segment: AudienceSegmentRecord;
  readonly selection: RowSelectionState;
}) {
  const selected = selection.selectedRowIdsSet.has(segment.id);

  return (
    <DataTable.Row data-selected={selected ? '' : undefined}>
      <DataTable.Cell className="resend-ui-audience-management-list__name-cell-wrap" selectionAnchor>
        <SelectableName
          checked={selected}
          href={getHref(segment)}
          label={`Select ${segment.name}`}
          onCheckedChange={(checked) => selection.setRowChecked(segment.id, checked)}
          rowIndex={index}
        >
          {segment.name}
        </SelectableName>
      </DataTable.Cell>
      <DataTable.Cell>{segment.contactsCount.toLocaleString()}</DataTable.Cell>
      <DataTable.Cell>{segment.unsubscribedCount.toLocaleString()}</DataTable.Cell>
      <DataTable.Cell className="resend-ui-audience-management-list__created-cell">
        <time dateTime={segment.createdAtDateTime}>{segment.createdAtLabel}</time>
      </DataTable.Cell>
      <DataTable.Cell className="resend-ui-audience-management-list__action-cell">
        <AudienceManagementRowActions
          isRowActionDisabled={isRowActionDisabled}
          onRowAction={onRowAction}
          record={segment}
          view="segments"
        />
      </DataTable.Cell>
    </DataTable.Row>
  );
}

function PropertyRow({
  index,
  isRowActionDisabled,
  onRowAction,
  propertiesHref,
  property,
  selection,
}: {
  readonly index: number;
  readonly isRowActionDisabled?: AudienceManagementRowActionDisabled | undefined;
  readonly onRowAction?: AudienceManagementRowActionHandler | undefined;
  readonly propertiesHref: string;
  readonly property: AudiencePropertyRecord;
  readonly selection: RowSelectionState;
}) {
  const selected = selection.selectedRowIdsSet.has(property.id);

  return (
    <DataTable.Row data-selected={selected ? '' : undefined}>
      <DataTable.Cell className="resend-ui-audience-management-list__name-cell-wrap" selectionAnchor>
        <SelectableName
          checked={selected}
          href={propertiesHref}
          label={`Select ${property.key}`}
          onCheckedChange={(checked) => selection.setRowChecked(property.id, checked)}
          rowIndex={index}
        >
          {property.key}
        </SelectableName>
      </DataTable.Cell>
      <DataTable.Cell>
        <span className="resend-ui-audience-management-list__tag">{property.type}</span>
      </DataTable.Cell>
      <DataTable.Cell>{property.fallbackValue ?? '-'}</DataTable.Cell>
      <DataTable.Cell className="resend-ui-audience-management-list__created-cell">
        <time dateTime={property.createdAtDateTime}>{property.createdAtLabel}</time>
      </DataTable.Cell>
      <DataTable.Cell className="resend-ui-audience-management-list__action-cell">
        <AudienceManagementRowActions
          isRowActionDisabled={isRowActionDisabled}
          onRowAction={onRowAction}
          record={property}
          view="properties"
        />
      </DataTable.Cell>
    </DataTable.Row>
  );
}

function TopicRow({
  getHref,
  index,
  isRowActionDisabled,
  onRowAction,
  selection,
  topic,
}: {
  readonly getHref: (topic: AudienceTopicRecord) => string;
  readonly index: number;
  readonly isRowActionDisabled?: AudienceManagementRowActionDisabled | undefined;
  readonly onRowAction?: AudienceManagementRowActionHandler | undefined;
  readonly selection: RowSelectionState;
  readonly topic: AudienceTopicRecord;
}) {
  const selected = selection.selectedRowIdsSet.has(topic.id);

  return (
    <DataTable.Row data-selected={selected ? '' : undefined}>
      <DataTable.Cell className="resend-ui-audience-management-list__name-cell-wrap" selectionAnchor>
        <SelectableName
          checked={selected}
          href={getHref(topic)}
          label={`Select ${topic.name}`}
          onCheckedChange={(checked) => selection.setRowChecked(topic.id, checked)}
          rowIndex={index}
        >
          {topic.name}
        </SelectableName>
      </DataTable.Cell>
      <DataTable.Cell>{topicDefaultSubscriptionLabels[topic.defaultSubscription]}</DataTable.Cell>
      <DataTable.Cell className="resend-ui-audience-management-list__capitalize">
        {topic.visibility}
      </DataTable.Cell>
      <DataTable.Cell className="resend-ui-audience-management-list__created-cell">
        <time dateTime={topic.createdAtDateTime}>{topic.createdAtLabel}</time>
      </DataTable.Cell>
      <DataTable.Cell className="resend-ui-audience-management-list__action-cell">
        <AudienceManagementRowActions
          isRowActionDisabled={isRowActionDisabled}
          onRowAction={onRowAction}
          record={topic}
          view="topics"
        />
      </DataTable.Cell>
    </DataTable.Row>
  );
}

function getAudienceManagementRowIds(
  view: AudienceManagementView,
  properties: readonly AudiencePropertyRecord[],
  segments: readonly AudienceSegmentRecord[],
  topics: readonly AudienceTopicRecord[]
) {
  switch (view) {
    case 'properties':
      return properties.map((property) => property.id);
    case 'segments':
      return segments.map((segment) => segment.id);
    case 'topics':
      return topics.map((topic) => topic.id);
    default:
      return assertNever(view);
  }
}

function AudienceManagementRows({
  getSegmentHref,
  getTopicHref,
  isRowActionDisabled,
  onRowAction,
  propertiesHref,
  properties,
  segments,
  selection,
  topics,
  view,
}: {
  readonly getSegmentHref: (segment: AudienceSegmentRecord) => string;
  readonly getTopicHref: (topic: AudienceTopicRecord) => string;
  readonly isRowActionDisabled?: AudienceManagementRowActionDisabled | undefined;
  readonly onRowAction?: AudienceManagementRowActionHandler | undefined;
  readonly propertiesHref: string;
  readonly properties: readonly AudiencePropertyRecord[];
  readonly segments: readonly AudienceSegmentRecord[];
  readonly selection: RowSelectionState;
  readonly topics: readonly AudienceTopicRecord[];
  readonly view: AudienceManagementView;
}) {
  switch (view) {
    case 'properties':
      return properties.map((property, index) => (
        <PropertyRow
          index={index}
          isRowActionDisabled={isRowActionDisabled}
          key={property.id}
          onRowAction={onRowAction}
          propertiesHref={propertiesHref}
          property={property}
          selection={selection}
        />
      ));
    case 'segments':
      return segments.map((segment, index) => (
        <SegmentRow
          getHref={getSegmentHref}
          index={index}
          isRowActionDisabled={isRowActionDisabled}
          key={segment.id}
          onRowAction={onRowAction}
          segment={segment}
          selection={selection}
        />
      ));
    case 'topics':
      return topics.map((topic, index) => (
        <TopicRow
          getHref={getTopicHref}
          index={index}
          isRowActionDisabled={isRowActionDisabled}
          key={topic.id}
          onRowAction={onRowAction}
          selection={selection}
          topic={topic}
        />
      ));
    default:
      return assertNever(view);
  }
}

export { AudienceManagementRows, getAudienceManagementRowIds };
