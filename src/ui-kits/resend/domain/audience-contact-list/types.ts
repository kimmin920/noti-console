import type { ComponentPropsWithoutRef } from 'react';
import type { ExportModalPayload } from '../export-modal';

type AudienceContactListState =
  | 'bulk'
  | 'empty'
  | 'filtered-empty'
  | 'importing'
  | 'loaded'
  | 'loading'
  | 'segment'
  | 'segment-empty'
  | 'status-empty';

type AudienceSegment = {
  readonly contactsCount?: number;
  readonly id: string;
  readonly name: string;
};

type AudienceTopic = {
  readonly id: string;
  readonly name: string;
};

type AudienceContactTopicSubscriptions = {
  readonly optIn: readonly AudienceTopic[];
  readonly optOut: readonly AudienceTopic[];
};

type AudienceContactPropertyValue = {
  readonly value: string;
};

type AudienceContactCustomPropertyType = 'boolean' | 'number' | 'string' | 'text';

type AudienceContactCustomPropertyDefinition = {
  readonly fallbackValue?: string;
  readonly id: string;
  readonly key: string;
  readonly type: AudienceContactCustomPropertyType;
};

type AudienceContact = {
  readonly createdAtDateTime: string;
  readonly createdAtLabel: string;
  readonly email: string;
  readonly firstName?: string;
  readonly id: string;
  readonly lastName?: string;
  readonly properties?: Readonly<Record<string, AudienceContactPropertyValue>>;
  readonly segments: readonly AudienceSegment[];
  readonly topicSubscriptions?: AudienceContactTopicSubscriptions;
  readonly topics: readonly AudienceTopic[];
  readonly unsubscribed: boolean;
};

type AudienceContactRowAction = 'delete' | 'edit' | 'remove-from-segment';
type AudienceContactRowActionHandler = (action: AudienceContactRowAction, contact: AudienceContact) => void;
type AudienceContactRowActionDisabled = (action: AudienceContactRowAction, contact: AudienceContact) => boolean;

type AudienceAddContactsPayload = {
  readonly emails: readonly string[];
  readonly segmentIds: readonly string[];
};

type AudienceAddContactsResult = {
  readonly total?: number;
};

type AudienceUpdateContactPayload = {
  readonly audienceIds: readonly string[];
  readonly contactId: string;
  readonly customProperties?: Readonly<Record<string, string>>;
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly newSubscriptions: readonly string[];
  readonly originalSubscriptions: readonly string[];
  readonly unsubscribed: boolean;
  readonly updateAudiences: boolean;
};

type AudienceDeleteContactsPayload = {
  readonly ids: readonly string[];
};

type AudienceAddContactsToSegmentsPayload = {
  readonly audienceIds: readonly string[];
  readonly ids: readonly string[];
};

type AudienceRemoveContactsFromSegmentsPayload = {
  readonly audienceIds: readonly string[];
  readonly ids: readonly string[];
};

type AudienceSubscribeContactsToTopicsPayload = {
  readonly ids: readonly string[];
  readonly topicIds: readonly string[];
};

type AudienceContactCsvStandardField = 'email' | 'first_name' | 'last_name' | 'unsubscribed';

type AudienceContactCsvColumn = {
  readonly csvHeader: string;
  readonly previewValue?: string;
  readonly suggestedCustomPropertyKey?: string;
  readonly suggestedField?: AudienceContactCsvStandardField;
};

type AudienceContactCsvParseResult = {
  readonly mappings: readonly AudienceContactCsvColumn[];
  readonly rowCount: number;
};

type AudienceContactCsvPropertyTarget =
  | { readonly field: AudienceContactCsvStandardField; readonly kind: 'standard' }
  | { readonly key: string; readonly kind: 'custom' };

type AudienceContactCsvResolvedMapping = {
  readonly csvHeader: string;
  readonly target: AudienceContactCsvPropertyTarget;
};

type AudienceContactCsvDestination =
  | { readonly kind: 'all-contacts' }
  | { readonly id: string; readonly kind: 'existing' }
  | { readonly kind: 'create'; readonly name: string };

type AudienceImportContactCsvPayload = {
  readonly destination: AudienceContactCsvDestination;
  readonly file: File;
  readonly mappings: readonly AudienceContactCsvResolvedMapping[];
  readonly rowCount: number;
};

type AudienceContactCsvCustomProperty = {
  readonly key: string;
};

type AudienceStatus = 'all' | 'subscribed' | 'unsubscribed';
type AudienceSegmentFilter = 'all' | string;

type AudienceStatusOption = {
  readonly id: AudienceStatus;
  readonly name: string;
};

type AudienceContactTableHeader = {
  readonly align?: 'right';
  readonly className?: string;
  readonly id: string;
  readonly name: string;
};

type AudienceContactListProps = ComponentPropsWithoutRef<'section'> & {
  readonly canCreateSegment?: boolean;
  readonly contactColumnLabel?: string;
  readonly contactCsvCustomProperties?: readonly AudienceContactCsvCustomProperty[];
  readonly contactCustomProperties?: readonly AudienceContactCustomPropertyDefinition[];
  readonly contacts?: readonly AudienceContact[];
  readonly defaultSegmentFilter?: AudienceSegmentFilter | undefined;
  readonly defaultSelectedContactIds?: readonly string[] | undefined;
  readonly defaultStatusFilter?: AudienceStatus | undefined;
  readonly isAudienceContactRowActionDisabled?: AudienceContactRowActionDisabled | undefined;
  readonly isUserAdmin?: boolean;
  readonly onAddContacts?: ((payload: AudienceAddContactsPayload) => AudienceAddContactsResult | Promise<AudienceAddContactsResult | void> | void) | undefined;
  readonly onAddContactsToSegments?: ((payload: AudienceAddContactsToSegmentsPayload) => Promise<void> | void) | undefined;
  readonly onAudienceContactRowAction?: AudienceContactRowActionHandler | undefined;
  readonly onDeleteContacts?: ((payload: AudienceDeleteContactsPayload) => Promise<void> | void) | undefined;
  readonly onExport?: ((payload: ExportModalPayload) => void) | undefined;
  readonly onImportContactCsv?: ((payload: AudienceImportContactCsvPayload) => Promise<void> | void) | undefined;
  readonly onParseContactCsv?: ((file: File) => AudienceContactCsvParseResult | Promise<AudienceContactCsvParseResult>) | undefined;
  readonly onRemoveContactsFromSegments?: ((payload: AudienceRemoveContactsFromSegmentsPayload) => Promise<void> | void) | undefined;
  readonly onSegmentFilterChange?: ((segmentFilter: AudienceSegmentFilter) => void) | undefined;
  readonly onSelectedContactIdsChange?: ((selectedContactIds: readonly string[]) => void) | undefined;
  readonly onStatusFilterChange?: ((statusFilter: AudienceStatus) => void) | undefined;
  readonly onSubscribeContactsToTopics?: ((payload: AudienceSubscribeContactsToTopicsPayload) => Promise<void> | void) | undefined;
  readonly onUpdateContact?: ((payload: AudienceUpdateContactPayload) => Promise<void> | void) | undefined;
  readonly segmentFilter?: AudienceSegmentFilter | undefined;
  readonly selectedContactIds?: readonly string[] | undefined;
  readonly segments?: readonly AudienceSegment[] | undefined;
  readonly segmentsColumnLabel?: string;
  readonly state?: AudienceContactListState;
  readonly statusColumnLabel?: string;
  readonly statusFilter?: AudienceStatus | undefined;
  readonly subscribedLabel?: string;
  readonly topics?: readonly AudienceTopic[] | undefined;
  readonly unsubscribedLabel?: string;
};

export type {
  AudienceAddContactsPayload,
  AudienceAddContactsResult,
  AudienceAddContactsToSegmentsPayload,
  AudienceContact,
  AudienceContactCsvColumn,
  AudienceContactCsvCustomProperty,
  AudienceContactCsvDestination,
  AudienceContactCsvParseResult,
  AudienceContactCsvPropertyTarget,
  AudienceContactCsvResolvedMapping,
  AudienceContactCsvStandardField,
  AudienceContactCustomPropertyDefinition,
  AudienceContactCustomPropertyType,
  AudienceContactListProps,
  AudienceContactListState,
  AudienceContactRowAction,
  AudienceContactRowActionDisabled,
  AudienceContactRowActionHandler,
  AudienceContactTableHeader,
  AudienceContactTopicSubscriptions,
  AudienceDeleteContactsPayload,
  AudienceSegmentFilter,
  AudienceSegment,
  AudienceStatus,
  AudienceStatusOption,
  AudienceTopic,
  AudienceImportContactCsvPayload,
  AudienceRemoveContactsFromSegmentsPayload,
  AudienceSubscribeContactsToTopicsPayload,
  AudienceUpdateContactPayload,
};
