import type {
  AudienceManagementTableHeader,
  AudienceManagementView,
  AudiencePropertyRecord,
  AudienceSegmentRecord,
  AudienceTopicRecord,
  TopicDefaultSubscription,
} from './types';

const audienceManagementPrimaryActions: Record<AudienceManagementView, string> = {
  properties: 'Add property',
  segments: 'Create segment',
  topics: 'Create topic',
} as const;

const audienceManagementSearchPlaceholders: Record<AudienceManagementView, string> = {
  properties: 'Search...',
  segments: 'Search...',
  topics: 'Search...',
} as const;

const audienceManagementEmptyCopy: Record<
  AudienceManagementView,
  {
    readonly action: string;
    readonly description: string;
    readonly filteredDescription: string;
    readonly filteredTitle: string;
    readonly title: string;
  }
> = {
  properties: {
    action: 'Add property',
    description: 'Add custom properties to store extra contact data for imports, edits, and segmentation.',
    filteredDescription: 'No properties match your current filters. Try adjusting your filters or clearing them to see all properties.',
    filteredTitle: 'No properties found',
    title: 'No properties yet',
  },
  segments: {
    action: 'Create segment',
    description: 'Use segments to group contacts based on your business logic.',
    filteredDescription: 'No segments match your current filters. Try adjusting your filters or clearing them to see all segments.',
    filteredTitle: 'No segments found',
    title: 'No segments yet',
  },
  topics: {
    action: 'Create topic',
    description: 'Use Topics with Unsubscribe Page to let users choose the content they want to receive.',
    filteredDescription: 'No topics match your current filters. Try adjusting your filters or clearing them to see all topics.',
    filteredTitle: 'No topics found',
    title: 'No topics yet',
  },
} as const;

const segmentTableHeaders: readonly AudienceManagementTableHeader[] = [
  { className: 'resend-ui-audience-management-list__header--name', id: 'name', name: 'Name' },
  { className: 'resend-ui-audience-management-list__header--count', id: 'contacts_count', name: 'Contacts' },
  { className: 'resend-ui-audience-management-list__header--count', id: 'unsubscribed_count', name: 'Unsubscribed' },
  { align: 'right', className: 'resend-ui-audience-management-list__header--created', id: 'created_at', name: 'Created' },
  { className: 'resend-ui-audience-management-list__header--actions', id: 'actions', name: '' },
] as const;

const propertyTableHeaders: readonly AudienceManagementTableHeader[] = [
  { className: 'resend-ui-audience-management-list__header--name', id: 'key', name: 'Key' },
  { className: 'resend-ui-audience-management-list__header--type', id: 'type', name: 'Type' },
  { className: 'resend-ui-audience-management-list__header--fallback', id: 'fallback_value', name: 'Fallback' },
  { align: 'right', className: 'resend-ui-audience-management-list__header--created', id: 'created_at', name: 'Created' },
  { className: 'resend-ui-audience-management-list__header--actions', id: 'actions', name: '' },
] as const;

const topicTableHeaders: readonly AudienceManagementTableHeader[] = [
  { className: 'resend-ui-audience-management-list__header--name', id: 'name', name: 'Name' },
  { className: 'resend-ui-audience-management-list__header--default', id: 'default_subscription', name: 'Defaults to' },
  { className: 'resend-ui-audience-management-list__header--visibility', id: 'visibility', name: 'Visibility' },
  { align: 'right', className: 'resend-ui-audience-management-list__header--created', id: 'created_at', name: 'Created' },
  { className: 'resend-ui-audience-management-list__header--actions', id: 'actions', name: '' },
] as const;

const audienceManagementHeaders: Record<
  AudienceManagementView,
  readonly AudienceManagementTableHeader[]
> = {
  properties: propertyTableHeaders,
  segments: segmentTableHeaders,
  topics: topicTableHeaders,
} as const;

const defaultAudienceManagementSegments: readonly AudienceSegmentRecord[] = [
  {
    contactsCount: 1240,
    createdAtDateTime: '2026-06-12T08:00:00.000Z',
    createdAtLabel: '20d ago',
    id: 'segment-product',
    name: 'Product updates',
    unsubscribedCount: 31,
  },
  {
    contactsCount: 842,
    createdAtDateTime: '2026-06-10T08:00:00.000Z',
    createdAtLabel: '22d ago',
    id: 'segment-newsletter',
    name: 'Newsletter',
    unsubscribedCount: 18,
  },
  {
    contactsCount: 318,
    createdAtDateTime: '2026-06-04T08:00:00.000Z',
    createdAtLabel: '28d ago',
    id: 'segment-founders',
    name: 'Founders',
    unsubscribedCount: 6,
  },
] as const;

const defaultAudienceManagementProperties: readonly AudiencePropertyRecord[] = [
  {
    createdAtDateTime: '2026-06-25T08:00:00.000Z',
    createdAtLabel: '7d ago',
    fallbackValue: 'free',
    id: 'property-plan',
    key: 'plan',
    type: 'string',
  },
  {
    createdAtDateTime: '2026-06-21T08:00:00.000Z',
    createdAtLabel: '11d ago',
    id: 'property-seat-count',
    key: 'seat_count',
    type: 'number',
  },
  {
    createdAtDateTime: '2026-06-18T08:00:00.000Z',
    createdAtLabel: '14d ago',
    fallbackValue: 'false',
    id: 'property-beta',
    key: 'beta_user',
    type: 'boolean',
  },
] as const;

const defaultAudienceManagementTopics: readonly AudienceTopicRecord[] = [
  {
    createdAtDateTime: '2026-06-29T08:00:00.000Z',
    createdAtLabel: '3d ago',
    defaultSubscription: 'opt_in',
    id: 'topic-product',
    name: 'Product updates',
    visibility: 'public',
  },
  {
    createdAtDateTime: '2026-06-24T08:00:00.000Z',
    createdAtLabel: '8d ago',
    defaultSubscription: 'opt_out',
    id: 'topic-changelog',
    name: 'Changelog',
    visibility: 'private',
  },
] as const;

const topicDefaultSubscriptionLabels: Record<TopicDefaultSubscription, string> = {
  opt_in: 'Opt-in',
  opt_out: 'Opt-out',
} as const;

export {
  audienceManagementEmptyCopy,
  audienceManagementHeaders,
  audienceManagementPrimaryActions,
  audienceManagementSearchPlaceholders,
  defaultAudienceManagementProperties,
  defaultAudienceManagementSegments,
  defaultAudienceManagementTopics,
  topicDefaultSubscriptionLabels,
};
