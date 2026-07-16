import type { ComponentPropsWithoutRef } from 'react';

type AudienceManagementView = 'properties' | 'segments' | 'topics';
type AudienceManagementListState = 'bulk' | 'empty' | 'filtered-empty' | 'loaded' | 'loading';
type AudiencePropertyType = 'boolean' | 'number' | 'string';
type TopicDefaultSubscription = 'opt_in' | 'opt_out';
type AudiencePropertyTypeFilter = 'all' | AudiencePropertyType;
type TopicDefaultSubscriptionFilter = 'any' | TopicDefaultSubscription;
type TopicVisibility = 'private' | 'public';

type AudienceManagementTableHeader = {
  readonly align?: 'right';
  readonly className?: string;
  readonly id: string;
  readonly name: string;
};

type AudienceSegmentRecord = {
  readonly contactsCount: number;
  readonly createdAtDateTime: string;
  readonly createdAtLabel: string;
  readonly id: string;
  readonly name: string;
  readonly unsubscribedCount: number;
};

type AudiencePropertyRecord = {
  readonly createdAtDateTime: string;
  readonly createdAtLabel: string;
  readonly fallbackValue?: string;
  readonly id: string;
  readonly key: string;
  readonly type: AudiencePropertyType;
};

type AudienceTopicRecord = {
  readonly createdAtDateTime: string;
  readonly createdAtLabel: string;
  readonly defaultSubscription: TopicDefaultSubscription;
  readonly id: string;
  readonly name: string;
  readonly visibility: TopicVisibility;
};

type AudienceManagementRecord = AudiencePropertyRecord | AudienceSegmentRecord | AudienceTopicRecord;
type AudienceManagementRowAction = 'copy-id' | 'delete' | 'edit';
type AudienceManagementRowActionHandler = (
  action: AudienceManagementRowAction,
  record: AudienceManagementRecord,
  view: AudienceManagementView
) => void;
type AudienceManagementRowActionDisabled = (
  action: AudienceManagementRowAction,
  record: AudienceManagementRecord,
  view: AudienceManagementView
) => boolean;

type AudienceManagementListProps = ComponentPropsWithoutRef<'section'> & {
  readonly defaultPropertyTypeFilter?: AudiencePropertyTypeFilter | undefined;
  readonly defaultSelectedAudienceManagementIds?: readonly string[] | undefined;
  readonly defaultTopicDefaultFilter?: TopicDefaultSubscriptionFilter | undefined;
  readonly isAudienceManagementRowActionDisabled?: AudienceManagementRowActionDisabled | undefined;
  readonly getSegmentHref?: ((segment: AudienceSegmentRecord) => string) | undefined;
  readonly getTopicHref?: ((topic: AudienceTopicRecord) => string) | undefined;
  readonly onAudienceManagementRowAction?: AudienceManagementRowActionHandler | undefined;
  readonly onPropertyTypeFilterChange?: ((propertyTypeFilter: AudiencePropertyTypeFilter) => void) | undefined;
  readonly onSelectedAudienceManagementIdsChange?: ((selectedIds: readonly string[]) => void) | undefined;
  readonly onTopicDefaultFilterChange?: ((topicDefaultFilter: TopicDefaultSubscriptionFilter) => void) | undefined;
  readonly propertyTypeFilter?: AudiencePropertyTypeFilter | undefined;
  readonly propertiesHref?: string | undefined;
  readonly properties?: readonly AudiencePropertyRecord[] | undefined;
  readonly selectedAudienceManagementIds?: readonly string[] | undefined;
  readonly segments?: readonly AudienceSegmentRecord[] | undefined;
  readonly state?: AudienceManagementListState;
  readonly topicDefaultFilter?: TopicDefaultSubscriptionFilter | undefined;
  readonly unsubscribePageHref?: string | undefined;
  readonly topics?: readonly AudienceTopicRecord[] | undefined;
  readonly view?: AudienceManagementView;
};

export type {
  AudienceManagementListProps,
  AudienceManagementListState,
  AudienceManagementRecord,
  AudienceManagementRowAction,
  AudienceManagementRowActionDisabled,
  AudienceManagementRowActionHandler,
  AudienceManagementTableHeader,
  AudienceManagementView,
  AudiencePropertyRecord,
  AudiencePropertyType,
  AudiencePropertyTypeFilter,
  AudienceSegmentRecord,
  AudienceTopicRecord,
  TopicDefaultSubscription,
  TopicDefaultSubscriptionFilter,
  TopicVisibility,
};
