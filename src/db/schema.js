import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const shortRef = (name) => varchar(name, { length: 20 });
const timestampWithTimezone = (name) => timestamp(name, { withTimezone: true });
const createdAt = () => timestampWithTimezone('created_at').notNull().defaultNow();
const updatedAt = () => timestampWithTimezone('updated_at').notNull().defaultNow();

export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'archived']);
export const billingAccountOwnerTypeEnum = pgEnum('billing_account_owner_type', ['user', 'workspace']);
export const billingAccountStatusEnum = pgEnum('billing_account_status', ['active', 'suspended', 'archived']);
export const senderResourceProviderEnum = pgEnum('sender_resource_provider', ['nhn']);
export const externalAuthProviderEnum = pgEnum('external_auth_provider', ['clerk', 'publ', 'google', 'kakao']);
export const senderResourceTypeEnum = pgEnum('sender_resource_type', ['sms_send_no', 'kakao_sender_key']);
export const senderResourceStatusEnum = pgEnum('sender_resource_status', ['active', 'suspended', 'archived']);
export const senderNumberApplicationTypeEnum = pgEnum('sender_number_application_type', ['personal', 'company']);
export const userSenderResourceRoleEnum = pgEnum('user_sender_resource_role', [
  'owner',
  'sender',
  'viewer',
  'auditor',
]);
export const userSenderResourceStatusEnum = pgEnum('user_sender_resource_status', [
  'pending',
  'active',
  'rejected',
  'suspended',
]);
export const senderResourceApplicationStatusEnum = pgEnum('sender_resource_application_status', [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'canceled',
]);
export const limitIncreaseRequestStatusEnum = pgEnum('limit_increase_request_status', [
  'submitted',
  'approved',
  'rejected',
  'canceled',
]);
export const limitIncreaseRequestScopeEnum = pgEnum('limit_increase_request_scope', [
  'monthly',
  'daily_channel',
]);
export const evidenceFileStatusEnum = pgEnum('evidence_file_status', [
  'active',
  'delete_pending',
  'deleted',
]);
export const senderResourceEvidenceDocumentTypeEnum = pgEnum('sender_resource_evidence_document_type', [
  'telecom_certificate',
  'consent_document',
  'id_card_copy',
  'business_registration',
  'relationship_proof',
  'additional_document',
]);
export const settlementRunStatusEnum = pgEnum('settlement_run_status', [
  'running',
  'succeeded',
  'failed',
  'finalized',
]);
export const settlementChannelEnum = pgEnum('settlement_channel', ['alimtalk', 'sms', 'lms', 'mms']);
export const settlementUsageTypeEnum = pgEnum('settlement_usage_type', [
  'direct',
  'fallback',
  'resend',
  'all',
]);
export const smsBulkSendChannelEnum = pgEnum('sms_bulk_send_channel', ['sms', 'lms', 'mms']);
export const smsBulkSendRunStatusEnum = pgEnum('sms_bulk_send_run_status', [
  'queued',
  'running',
  'completed',
  'blocked',
  'failed',
  'canceled',
]);
export const smsBulkSendBatchStatusEnum = pgEnum('sms_bulk_send_batch_status', [
  'pending',
  'sending',
  'accepted',
  'rejected',
  'unknown',
  'failed',
  'canceled',
]);
export const smsQuotaScopeEnum = pgEnum('sms_quota_scope', ['user_period', 'sender_resource_period']);
export const smsQuotaReservationStatusEnum = pgEnum('sms_quota_reservation_status', [
  'reserved',
  'consumed',
  'released',
]);
export const senderResourceQuotaChannelEnum = pgEnum('sender_resource_quota_channel', [
  'sms',
  'alimtalk',
  'brand-message',
]);
export const senderResourceQuotaReservationKindEnum = pgEnum('sender_resource_quota_reservation_kind', [
  'primary',
  'fallback',
]);
export const messageSendChannelEnum = pgEnum('message_send_channel', [
  'sms',
  'lms',
  'mms',
  'alimtalk',
  'brand-message',
]);
export const messageSendKindEnum = pgEnum('message_send_kind', ['basic', 'bulk']);
export const messageSendTimingEnum = pgEnum('message_send_timing', ['immediate', 'scheduled']);
export const messageSendProviderStateEnum = pgEnum('message_send_provider_state', [
  'queued',
  'sending',
  'accepted',
  'partial',
  'rejected',
  'unknown',
  'failed',
  'blocked',
  'canceled',
]);
export const messageSendResultStateEnum = pgEnum('message_send_result_state', [
  'not_synced',
  'syncing',
  'partially_synced',
  'synced',
  'stale',
  'error',
]);
export const messageSendSourceTypeEnum = pgEnum('message_send_source_type', ['manual', 'automation']);
export const publChannelMappingStatusEnum = pgEnum('publ_channel_mapping_status', [
  'active',
  'disabled',
  'archived',
]);
export const automationRuleStatusEnum = pgEnum('automation_rule_status', ['enabled', 'disabled', 'archived']);
export const automationEventDeliveryStatusEnum = pgEnum('automation_event_delivery_status', [
  'processing',
  'sent',
  'unsent',
  'dismissed',
  'failed',
]);

export const publEventDefinitions = pgTable(
  'publ_event_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventKey: varchar('event_key', { length: 160 }).notNull(),
    eventType: varchar('event_type', { length: 40 }).notNull().default('publ-event'),
    displayName: varchar('display_name', { length: 160 }),
    serviceStatus: varchar('service_status', { length: 40 }),
    locationType: varchar('location_type', { length: 80 }),
    locationId: varchar('location_id', { length: 80 }),
    sourceType: varchar('source_type', { length: 80 }),
    actionType: varchar('action_type', { length: 80 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('publ_event_definitions_event_key_unique').on(table.eventKey),
    index('publ_event_definitions_event_type_service_status_idx').on(table.eventType, table.serviceStatus),
    check('publ_event_definitions_event_type_check', sql`${table.eventType} = 'publ-event'`),
  ]
);

export const publEventPropDefinitions = pgTable(
  'publ_event_prop_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => publEventDefinitions.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull(),
    rawPath: varchar('raw_path', { length: 255 }).notNull(),
    alias: varchar('alias', { length: 120 }).notNull(),
    label: varchar('label', { length: 160 }).notNull(),
    propType: varchar('prop_type', { length: 40 }).notNull(),
    required: boolean('required').notNull().default(false),
    enabled: boolean('enabled').notNull().default(false),
    fallback: varchar('fallback', { length: 500 }),
    sample: varchar('sample', { length: 500 }),
    parserPipelineJson: jsonb('parser_pipeline_json'),
    description: varchar('description', { length: 1000 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('publ_event_prop_definitions_event_alias_unique').on(table.eventId, table.alias),
    uniqueIndex('publ_event_prop_definitions_event_sort_order_unique').on(table.eventId, table.sortOrder),
    index('publ_event_prop_definitions_event_enabled_idx').on(table.eventId, table.enabled),
    check(
      'publ_event_prop_definitions_prop_type_check',
      sql`${table.propType} in ('text', 'number', 'datetime', 'boolean', 'enum', 'object', 'array')`
    ),
  ]
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userRef: shortRef('user_ref').notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    name: varchar('name', { length: 120 }),
    status: userStatusEnum('status').notNull().default('active'),
    isOperator: boolean('is_operator').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('users_user_ref_unique').on(table.userRef),
    uniqueIndex('users_email_unique').on(table.email),
    index('users_status_idx').on(table.status),
  ]
);

export const billingAccounts = pgTable(
  'billing_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    billingRef: shortRef('billing_ref').notNull(),
    ownerType: billingAccountOwnerTypeEnum('owner_type').notNull().default('user'),
    ownerId: uuid('owner_id').notNull(),
    status: billingAccountStatusEnum('status').notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('billing_accounts_billing_ref_unique').on(table.billingRef),
    uniqueIndex('billing_accounts_owner_unique').on(table.ownerType, table.ownerId),
    index('billing_accounts_status_idx').on(table.status),
  ]
);

export const externalAuthAccounts = pgTable(
  'external_auth_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: externalAuthProviderEnum('provider').notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    email: varchar('email', { length: 320 }),
    displayName: varchar('display_name', { length: 120 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('external_auth_accounts_provider_account_unique').on(table.provider, table.providerAccountId),
    index('external_auth_accounts_user_idx').on(table.userId),
    index('external_auth_accounts_user_provider_idx').on(table.userId, table.provider),
  ]
);

export const publPappSessions = pgTable(
  'publ_papp_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    consumerId: varchar('consumer_id', { length: 255 }).notNull(),
    pAppCode: varchar('p_app_code', { length: 80 }).notNull(),
    channelId: bigint('channel_id', { mode: 'number' }),
    channelCode: varchar('channel_code', { length: 160 }).notNull(),
    installedPAppId: bigint('installed_p_app_id', { mode: 'number' }),
    sellerProfileDistinctId: varchar('seller_profile_distinct_id', { length: 255 }),
    sellerRole: varchar('seller_role', { length: 80 }),
    refreshTokenHash: varchar('refresh_token_hash', { length: 128 }).notNull(),
    refreshTokenExpiresAt: timestampWithTimezone('refresh_token_expires_at').notNull(),
    accessTokenJti: varchar('access_token_jti', { length: 128 }).notNull(),
    accessTokenExpiresAt: timestampWithTimezone('access_token_expires_at').notNull(),
    revokedAt: timestampWithTimezone('revoked_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('publ_papp_sessions_consumer_id_unique').on(table.consumerId),
    index('publ_papp_sessions_user_idx').on(table.userId),
    index('publ_papp_sessions_refresh_lookup_idx').on(
      table.consumerId,
      table.refreshTokenHash,
      table.revokedAt,
      table.refreshTokenExpiresAt
    ),
    index('publ_papp_sessions_expiry_revocation_idx').on(table.revokedAt, table.refreshTokenExpiresAt),
  ]
);

export const senderResources = pgTable(
  'sender_resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resourceRef: shortRef('resource_ref').notNull(),
    provider: senderResourceProviderEnum('provider').notNull().default('nhn'),
    type: senderResourceTypeEnum('type').notNull(),
    value: varchar('value', { length: 128 }).notNull(),
    displayName: varchar('display_name', { length: 120 }),
    quotaLimit: integer('quota_limit').notNull().default(1000),
    status: senderResourceStatusEnum('status').notNull().default('active'),
    providerStatus: varchar('provider_status', { length: 80 }),
    metadataJson: jsonb('metadata_json'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('sender_resources_resource_ref_unique').on(table.resourceRef),
    uniqueIndex('sender_resources_provider_type_value_unique').on(table.provider, table.type, table.value),
    index('sender_resources_type_status_idx').on(table.type, table.status),
    check('sender_resources_quota_limit_positive', sql`${table.quotaLimit} > 0`),
  ]
);

export const publChannelMappings = pgTable(
  'publ_channel_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    channelCode: varchar('channel_code', { length: 160 }).notNull(),
    displayName: varchar('display_name', { length: 160 }).notNull(),
    status: publChannelMappingStatusEnum('status').notNull().default('active'),
    externalBusinessRef: varchar('external_business_ref', { length: 160 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('publ_channel_mappings_channel_code_unique').on(table.channelCode),
    index('publ_channel_mappings_user_status_idx').on(table.userId, table.status),
    index('publ_channel_mappings_status_idx').on(table.status),
  ]
);

export const automationRules = pgTable(
  'automation_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    eventDefinitionId: uuid('event_definition_id')
      .notNull()
      .references(() => publEventDefinitions.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 160 }).notNull(),
    status: automationRuleStatusEnum('status').notNull().default('disabled'),
    sendChannel: messageSendChannelEnum('send_channel').notNull(),
    senderResourceId: uuid('sender_resource_id')
      .notNull()
      .references(() => senderResources.id, { onDelete: 'restrict' }),
    templateCode: varchar('template_code', { length: 160 }).notNull(),
    templateSource: varchar('template_source', { length: 80 }),
    templateSourceKey: varchar('template_source_key', { length: 160 }),
    variableMappingJson: jsonb('variable_mapping_json').notNull().default(sql`'{}'::jsonb`),
    recipientMappingJson: jsonb('recipient_mapping_json').notNull().default(sql`'{}'::jsonb`),
    conditionJson: jsonb('condition_json').notNull().default(sql`'{}'::jsonb`),
    cooldownPolicyJson: jsonb('cooldown_policy_json').notNull().default(sql`'{}'::jsonb`),
    validationSnapshotJson: jsonb('validation_snapshot_json'),
    validatedConfigHash: varchar('validated_config_hash', { length: 128 }),
    lastValidatedAt: timestampWithTimezone('last_validated_at'),
    enabledAt: timestampWithTimezone('enabled_at'),
    archivedAt: timestampWithTimezone('archived_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('automation_rules_enabled_event_unique')
      .on(table.userId, table.eventDefinitionId)
      .where(sql`${table.status} = 'enabled'`),
    index('automation_rules_lookup_idx').on(table.userId, table.eventDefinitionId, table.status),
    index('automation_rules_user_status_idx').on(table.userId, table.status),
    index('automation_rules_sender_resource_idx').on(table.senderResourceId),
  ]
);

export const automationRuleRevisions = pgTable(
  'automation_rule_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    automationRuleId: uuid('automation_rule_id')
      .notNull()
      .references(() => automationRules.id, { onDelete: 'restrict' }),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    revisionNumber: integer('revision_number').notNull(),
    action: varchar('action', { length: 40 }).notNull(),
    statusBefore: automationRuleStatusEnum('status_before'),
    statusAfter: automationRuleStatusEnum('status_after'),
    configSnapshotJson: jsonb('config_snapshot_json').notNull().default(sql`'{}'::jsonb`),
    validationSnapshotJson: jsonb('validation_snapshot_json'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('automation_rule_revisions_rule_revision_unique').on(
      table.automationRuleId,
      table.revisionNumber
    ),
    index('automation_rule_revisions_rule_history_idx').on(table.automationRuleId, table.revisionNumber),
    index('automation_rule_revisions_actor_action_idx').on(table.actorUserId, table.action, table.createdAt),
    check('automation_rule_revisions_revision_number_positive', sql`${table.revisionNumber} > 0`),
  ]
);

export const userSenderResources = pgTable(
  'user_sender_resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    senderResourceId: uuid('sender_resource_id')
      .notNull()
      .references(() => senderResources.id, { onDelete: 'cascade' }),
    billingAccountId: uuid('billing_account_id').references(() => billingAccounts.id, { onDelete: 'set null' }),
    role: userSenderResourceRoleEnum('role').notNull().default('sender'),
    status: userSenderResourceStatusEnum('status').notNull().default('pending'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('user_sender_resources_user_resource_unique').on(table.userId, table.senderResourceId),
    index('user_sender_resources_user_status_idx').on(table.userId, table.status),
    index('user_sender_resources_resource_status_idx').on(table.senderResourceId, table.status),
    index('user_sender_resources_billing_account_idx').on(table.billingAccountId),
  ]
);

export const senderResourceApplications = pgTable(
  'sender_resource_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    resourceType: senderResourceTypeEnum('resource_type').notNull(),
    requestedValue: varchar('requested_value', { length: 128 }).notNull(),
    senderNumberType: senderNumberApplicationTypeEnum('sender_number_type'),
    status: senderResourceApplicationStatusEnum('status').notNull().default('draft'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestampWithTimezone('reviewed_at'),
    reviewMemo: varchar('review_memo', { length: 1000 }),
    rejectReason: varchar('reject_reason', { length: 1000 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('sender_resource_applications_user_status_idx').on(table.userId, table.status),
    index('sender_resource_applications_reviewed_by_idx').on(table.reviewedBy),
    index('sender_resource_applications_resource_type_idx').on(table.resourceType),
  ]
);

export const senderResourceApplicationEvidenceFiles = pgTable(
  'sender_resource_application_evidence_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => senderResourceApplications.id, { onDelete: 'cascade' }),
    r2Bucket: varchar('r2_bucket', { length: 128 }).notNull(),
    r2ObjectKey: varchar('r2_object_key', { length: 512 }).notNull(),
    originalFileName: varchar('original_file_name', { length: 255 }),
    documentType: senderResourceEvidenceDocumentTypeEnum('document_type'),
    contentType: varchar('content_type', { length: 120 }),
    byteSize: bigint('byte_size', { mode: 'number' }),
    checksumSha256: varchar('checksum_sha256', { length: 64 }),
    status: evidenceFileStatusEnum('status').notNull().default('active'),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    deleteAfter: timestampWithTimezone('delete_after'),
    deletedAt: timestampWithTimezone('deleted_at'),
    deletedBy: uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('sender_resource_application_evidence_files_r2_object_unique').on(
      table.r2Bucket,
      table.r2ObjectKey
    ),
    index('sender_resource_application_evidence_files_application_idx').on(table.applicationId),
    index('sender_resource_application_evidence_files_status_delete_after_idx').on(table.status, table.deleteAfter),
  ]
);

export const limitIncreaseRequests = pgTable(
  'limit_increase_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: messageSendChannelEnum('channel').notNull(),
    limitScope: limitIncreaseRequestScopeEnum('limit_scope').notNull(),
    senderResourceId: uuid('sender_resource_id').references(() => senderResources.id, { onDelete: 'set null' }),
    currentLimit: integer('current_limit'),
    requestedLimit: integer('requested_limit').notNull(),
    reason: varchar('reason', { length: 1000 }),
    status: limitIncreaseRequestStatusEnum('status').notNull().default('submitted'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestampWithTimezone('reviewed_at'),
    reviewMemo: varchar('review_memo', { length: 1000 }),
    rejectReason: varchar('reject_reason', { length: 1000 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('limit_increase_requests_user_status_idx').on(table.userId, table.status),
    index('limit_increase_requests_status_created_idx').on(table.status, table.createdAt),
    index('limit_increase_requests_sender_resource_idx').on(table.senderResourceId),
    index('limit_increase_requests_reviewed_by_idx').on(table.reviewedBy),
    check('limit_increase_requests_requested_limit_positive', sql`${table.requestedLimit} > 0`),
    check(
      'limit_increase_requests_current_limit_nonnegative',
      sql`${table.currentLimit} is null or ${table.currentLimit} >= 0`
    ),
  ]
);

export const settlementRuns = pgTable(
  'settlement_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    startReceiveDate: timestampWithTimezone('start_receive_date').notNull(),
    endReceiveDate: timestampWithTimezone('end_receive_date').notNull(),
    status: settlementRunStatusEnum('status').notNull().default('running'),
    requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    startedAt: timestampWithTimezone('started_at'),
    finishedAt: timestampWithTimezone('finished_at'),
    finalizedBy: uuid('finalized_by').references(() => users.id, { onDelete: 'set null' }),
    finalizedAt: timestampWithTimezone('finalized_at'),
    errorMessage: varchar('error_message', { length: 1000 }),
    createdAt: createdAt(),
  },
  (table) => [
    index('settlement_runs_status_idx').on(table.status),
    index('settlement_runs_receive_date_idx').on(table.startReceiveDate, table.endReceiveDate),
    index('settlement_runs_requested_by_idx').on(table.requestedBy),
  ]
);

export const settlementUsageSummaries = pgTable(
  'settlement_usage_summaries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => settlementRuns.id, { onDelete: 'cascade' }),
    billingAccountId: uuid('billing_account_id')
      .notNull()
      .references(() => billingAccounts.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    channel: settlementChannelEnum('channel').notNull(),
    usageType: settlementUsageTypeEnum('usage_type').notNull().default('all'),
    deliveredCount: integer('delivered_count').notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('settlement_usage_summaries_run_scope_unique').on(
      table.runId,
      table.billingAccountId,
      table.userId,
      table.channel,
      table.usageType
    ),
    index('settlement_usage_summaries_billing_account_idx').on(table.billingAccountId),
    index('settlement_usage_summaries_user_idx').on(table.userId),
  ]
);

export const smsBulkSendRuns = pgTable(
  'sms_bulk_send_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runRef: shortRef('run_ref').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    senderResourceId: uuid('sender_resource_id')
      .notNull()
      .references(() => senderResources.id, { onDelete: 'restrict' }),
    billingAccountId: uuid('billing_account_id').references(() => billingAccounts.id, { onDelete: 'set null' }),
    channel: smsBulkSendChannelEnum('channel').notNull().default('sms'),
    managementSendName: varchar('management_send_name', { length: 160 }),
    requestDate: varchar('request_date', { length: 16 }),
    totalRecipients: integer('total_recipients').notNull(),
    batchSize: integer('batch_size').notNull(),
    totalBatches: integer('total_batches').notNull(),
    acceptedCount: integer('accepted_count').notNull().default(0),
    rejectedCount: integer('rejected_count').notNull().default(0),
    unknownCount: integer('unknown_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    status: smsBulkSendRunStatusEnum('status').notNull().default('queued'),
    nextBatchAvailableAt: timestampWithTimezone('next_batch_available_at').notNull().defaultNow(),
    startedAt: timestampWithTimezone('started_at'),
    finishedAt: timestampWithTimezone('finished_at'),
    errorCode: varchar('error_code', { length: 80 }),
    errorState: varchar('error_state', { length: 80 }),
    errorMessage: varchar('error_message', { length: 500 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('sms_bulk_send_runs_run_ref_unique').on(table.runRef),
    index('sms_bulk_send_runs_worker_claim_idx').on(table.status, table.nextBatchAvailableAt, table.updatedAt),
    index('sms_bulk_send_runs_user_recent_idx').on(table.userId, table.createdAt),
    index('sms_bulk_send_runs_sender_resource_idx').on(table.senderResourceId),
  ]
);

export const smsBulkSendBatches = pgTable(
  'sms_bulk_send_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => smsBulkSendRuns.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    recipientCount: integer('recipient_count').notNull(),
    status: smsBulkSendBatchStatusEnum('status').notNull().default('pending'),
    clientRequestId: uuid('client_request_id').notNull(),
    providerRequestId: varchar('provider_request_id', { length: 128 }),
    attempts: integer('attempts').notNull().default(0),
    lockedBy: varchar('locked_by', { length: 120 }),
    leaseExpiresAt: timestampWithTimezone('lease_expires_at'),
    claimedAt: timestampWithTimezone('claimed_at'),
    sentAt: timestampWithTimezone('sent_at'),
    finishedAt: timestampWithTimezone('finished_at'),
    errorCode: varchar('error_code', { length: 80 }),
    errorState: varchar('error_state', { length: 80 }),
    errorMessage: varchar('error_message', { length: 500 }),
    payloadJson: jsonb('payload_json'),
    payloadExpiresAt: timestampWithTimezone('payload_expires_at'),
    payloadPurgedAt: timestampWithTimezone('payload_purged_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('sms_bulk_send_batches_run_sequence_unique').on(table.runId, table.sequence),
    uniqueIndex('sms_bulk_send_batches_client_request_unique').on(table.clientRequestId),
    index('sms_bulk_send_batches_run_sequence_idx').on(table.runId, table.sequence),
    index('sms_bulk_send_batches_provider_request_idx').on(table.providerRequestId),
    index('sms_bulk_send_batches_worker_claim_idx').on(table.status, table.leaseExpiresAt, table.sequence),
    index('sms_bulk_send_batches_payload_cleanup_idx').on(table.payloadExpiresAt, table.payloadPurgedAt),
  ]
);

export const smsQuotaBuckets = pgTable(
  'sms_quota_buckets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    senderResourceId: uuid('sender_resource_id')
      .references(() => senderResources.id, { onDelete: 'restrict' }),
    channel: smsBulkSendChannelEnum('channel').notNull().default('sms'),
    quotaScope: smsQuotaScopeEnum('quota_scope').notNull().default('user_period'),
    periodStartAt: timestampWithTimezone('period_start_at').notNull(),
    periodEndAt: timestampWithTimezone('period_end_at').notNull(),
    quotaLimit: integer('quota_limit').notNull(),
    reservedCount: integer('reserved_count').notNull().default(0),
    consumedCount: integer('consumed_count').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('sms_quota_buckets_scope_unique').on(
      table.userId,
      table.channel,
      table.quotaScope,
      table.periodStartAt,
      table.periodEndAt
    ),
    index('sms_quota_buckets_lookup_idx').on(table.userId, table.channel, table.quotaScope, table.periodEndAt),
    index('sms_quota_buckets_sender_resource_lookup_idx').on(
      table.senderResourceId,
      table.quotaScope,
      table.periodEndAt
    ),
  ]
);

export const smsQuotaReservations = pgTable(
  'sms_quota_reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bucketId: uuid('bucket_id')
      .notNull()
      .references(() => smsQuotaBuckets.id, { onDelete: 'cascade' }),
    runId: uuid('run_id')
      .notNull()
      .references(() => smsBulkSendRuns.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: smsBulkSendChannelEnum('channel').notNull().default('sms'),
    quotaScope: smsQuotaScopeEnum('quota_scope').notNull().default('user_period'),
    reservedCount: integer('reserved_count').notNull(),
    consumedCount: integer('consumed_count').notNull().default(0),
    releasedCount: integer('released_count').notNull().default(0),
    status: smsQuotaReservationStatusEnum('status').notNull().default('reserved'),
    expiresAt: timestampWithTimezone('expires_at'),
    consumedAt: timestampWithTimezone('consumed_at'),
    releasedAt: timestampWithTimezone('released_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('sms_quota_reservations_run_unique').on(table.runId),
    index('sms_quota_reservations_bucket_status_idx').on(table.bucketId, table.status),
    index('sms_quota_reservations_user_recent_idx').on(table.userId, table.createdAt),
  ]
);

export const senderResourceQuotaBuckets = pgTable(
  'sender_resource_quota_buckets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    senderResourceId: uuid('sender_resource_id')
      .notNull()
      .references(() => senderResources.id, { onDelete: 'restrict' }),
    quotaChannel: senderResourceQuotaChannelEnum('quota_channel').notNull(),
    periodStartAt: timestampWithTimezone('period_start_at').notNull(),
    periodEndAt: timestampWithTimezone('period_end_at').notNull(),
    quotaLimit: integer('quota_limit').notNull(),
    reservedCount: integer('reserved_count').notNull().default(0),
    consumedCount: integer('consumed_count').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('sender_resource_quota_buckets_period_unique').on(
      table.senderResourceId,
      table.quotaChannel,
      table.periodStartAt,
      table.periodEndAt
    ),
    index('sender_resource_quota_buckets_lookup_idx').on(
      table.senderResourceId,
      table.quotaChannel,
      table.periodEndAt
    ),
    check('sender_resource_quota_buckets_period_valid', sql`${table.periodEndAt} > ${table.periodStartAt}`),
    check('sender_resource_quota_buckets_limit_positive', sql`${table.quotaLimit} > 0`),
    check('sender_resource_quota_buckets_reserved_nonnegative', sql`${table.reservedCount} >= 0`),
    check('sender_resource_quota_buckets_consumed_nonnegative', sql`${table.consumedCount} >= 0`),
  ]
);

export const messageSendGroups = pgTable(
  'message_send_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    senderResourceId: uuid('sender_resource_id')
      .notNull()
      .references(() => senderResources.id, { onDelete: 'restrict' }),
    billingAccountId: uuid('billing_account_id').references(() => billingAccounts.id, { onDelete: 'set null' }),
    channel: messageSendChannelEnum('channel').notNull(),
    sendKind: messageSendKindEnum('send_kind').notNull().default('basic'),
    sendTiming: messageSendTimingEnum('send_timing').notNull().default('immediate'),
    managementTitle: varchar('management_title', { length: 160 }).notNull(),
    sourceType: messageSendSourceTypeEnum('source_type').notNull().default('manual'),
    sourceEventKey: varchar('source_event_key', { length: 160 }),
    sourceExternalEventId: varchar('source_external_event_id', { length: 255 }),
    sourceChannelCode: varchar('source_channel_code', { length: 160 }),
    sourceAutomationRuleId: uuid('source_automation_rule_id').references(() => automationRules.id, {
      onDelete: 'restrict',
    }),
    sourceAutomationDeliveryId: uuid('source_automation_delivery_id'),
    totalRecipientCount: integer('total_recipient_count').notNull(),
    providerRequestCount: integer('provider_request_count').notNull().default(0),
    acceptedRequestCount: integer('accepted_request_count').notNull().default(0),
    providerState: messageSendProviderStateEnum('provider_state').notNull().default('queued'),
    resultState: messageSendResultStateEnum('result_state').notNull().default('not_synced'),
    successCount: integer('success_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    pendingCount: integer('pending_count').notNull().default(0),
    canceledCount: integer('canceled_count').notNull().default(0),
    resultSyncedAt: timestampWithTimezone('result_synced_at'),
    resultFinalizedAt: timestampWithTimezone('result_finalized_at'),
    scheduledAt: timestampWithTimezone('scheduled_at'),
    expiresAt: timestampWithTimezone('expires_at').notNull(),
    archivedAt: timestampWithTimezone('archived_at'),
    archiveReason: varchar('archive_reason', { length: 120 }),
    purgeAfter: timestampWithTimezone('purge_after'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('message_send_groups_user_channel_active_created_idx').on(
      table.userId,
      table.channel,
      table.archivedAt,
      table.createdAt.desc()
    ),
    index('message_send_groups_user_expires_at_idx').on(table.userId, table.expiresAt),
    index('message_send_groups_purge_after_archived_idx').on(table.purgeAfter, table.archivedAt),
    index('message_send_groups_sync_scope_idx').on(
      table.sendKind,
      table.channel,
      table.resultState,
      table.resultFinalizedAt
    ),
    index('message_send_groups_automation_source_lookup_idx').on(
      table.sourceType,
      table.sourceChannelCode,
      table.sourceExternalEventId,
      table.sourceAutomationRuleId,
      table.sourceAutomationDeliveryId
    ),
    check('message_send_groups_total_recipient_count_nonnegative', sql`${table.totalRecipientCount} >= 0`),
    check('message_send_groups_provider_request_count_nonnegative', sql`${table.providerRequestCount} >= 0`),
    check('message_send_groups_accepted_request_count_nonnegative', sql`${table.acceptedRequestCount} >= 0`),
    check(
      'message_send_groups_accepted_request_count_lte_provider_request_count',
      sql`${table.acceptedRequestCount} <= ${table.providerRequestCount}`
    ),
    check('message_send_groups_success_count_nonnegative', sql`${table.successCount} >= 0`),
    check('message_send_groups_failed_count_nonnegative', sql`${table.failedCount} >= 0`),
    check('message_send_groups_pending_count_nonnegative', sql`${table.pendingCount} >= 0`),
    check('message_send_groups_canceled_count_nonnegative', sql`${table.canceledCount} >= 0`),
    check(
      'message_send_groups_result_counts_lte_total_recipient_count',
      sql`${table.successCount} + ${table.failedCount} + ${table.pendingCount} + ${table.canceledCount} <= ${table.totalRecipientCount}`
    ),
  ]
);

export const messageSendProviderRequests = pgTable(
  'message_send_provider_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => messageSendGroups.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    clientRequestId: uuid('client_request_id').notNull(),
    providerRequestId: varchar('provider_request_id', { length: 128 }),
    recipientCount: integer('recipient_count').notNull(),
    providerState: messageSendProviderStateEnum('provider_state').notNull().default('queued'),
    resultState: messageSendResultStateEnum('result_state').notNull().default('not_synced'),
    successCount: integer('success_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    pendingCount: integer('pending_count').notNull().default(0),
    canceledCount: integer('canceled_count').notNull().default(0),
    resultSnapshotJson: jsonb('result_snapshot_json'),
    resultSnapshotVersion: integer('result_snapshot_version').notNull().default(0),
    firstResultReceivedAt: timestampWithTimezone('first_result_received_at'),
    resultSyncedAt: timestampWithTimezone('result_synced_at'),
    resultFinalizedAt: timestampWithTimezone('result_finalized_at'),
    syncLockedBy: varchar('sync_locked_by', { length: 120 }),
    syncLeaseExpiresAt: timestampWithTimezone('sync_lease_expires_at'),
    syncAttempts: integer('sync_attempts').notNull().default(0),
    nextSyncAt: timestampWithTimezone('next_sync_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('message_send_provider_requests_group_sequence_unique').on(table.groupId, table.sequence),
    uniqueIndex('message_send_provider_requests_client_request_unique').on(table.clientRequestId),
    index('message_send_provider_requests_provider_request_idx').on(table.providerRequestId),
    index('message_send_provider_requests_group_sequence_idx').on(table.groupId, table.sequence),
    index('message_send_provider_requests_sync_claim_idx').on(
      table.resultState,
      table.nextSyncAt,
      table.syncLeaseExpiresAt
    ),
    check('message_send_provider_requests_sequence_positive', sql`${table.sequence} > 0`),
    check('message_send_provider_requests_recipient_count_nonnegative', sql`${table.recipientCount} >= 0`),
    check('message_send_provider_requests_success_count_nonnegative', sql`${table.successCount} >= 0`),
    check('message_send_provider_requests_failed_count_nonnegative', sql`${table.failedCount} >= 0`),
    check('message_send_provider_requests_pending_count_nonnegative', sql`${table.pendingCount} >= 0`),
    check('message_send_provider_requests_canceled_count_nonnegative', sql`${table.canceledCount} >= 0`),
    check('message_send_provider_requests_result_snapshot_version_nonnegative', sql`${table.resultSnapshotVersion} >= 0`),
    check('message_send_provider_requests_sync_attempts_nonnegative', sql`${table.syncAttempts} >= 0`),
    check(
      'message_send_provider_requests_result_counts_lte_recipient_count',
      sql`${table.successCount} + ${table.failedCount} + ${table.pendingCount} + ${table.canceledCount} <= ${table.recipientCount}`
    ),
  ]
);

export const senderResourceQuotaReservations = pgTable(
  'sender_resource_quota_reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bucketId: uuid('bucket_id')
      .notNull()
      .references(() => senderResourceQuotaBuckets.id, { onDelete: 'cascade' }),
    providerRequestId: uuid('provider_request_id')
      .references(() => messageSendProviderRequests.id, { onDelete: 'set null' }),
    kind: senderResourceQuotaReservationKindEnum('kind').notNull(),
    reservedCount: integer('reserved_count').notNull(),
    consumedCount: integer('consumed_count').notNull().default(0),
    releasedCount: integer('released_count').notNull().default(0),
    settlementSnapshotJson: jsonb('settlement_snapshot_json'),
    fallbackOpenedAt: timestampWithTimezone('fallback_opened_at'),
    resultSyncedAt: timestampWithTimezone('result_synced_at'),
    resultFinalizedAt: timestampWithTimezone('result_finalized_at'),
    settledAt: timestampWithTimezone('settled_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('sender_resource_quota_reservations_request_kind_unique')
      .on(table.providerRequestId, table.kind)
      .where(sql`${table.providerRequestId} is not null`),
    index('sender_resource_quota_reservations_bucket_idx').on(table.bucketId),
    index('sender_resource_quota_reservations_request_idx').on(table.providerRequestId),
    index('sender_resource_quota_reservations_fallback_sync_idx').on(table.kind, table.resultFinalizedAt),
    check('sender_resource_quota_reservations_reserved_positive', sql`${table.reservedCount} > 0`),
    check('sender_resource_quota_reservations_consumed_nonnegative', sql`${table.consumedCount} >= 0`),
    check('sender_resource_quota_reservations_released_nonnegative', sql`${table.releasedCount} >= 0`),
    check(
      'sender_resource_quota_reservations_settlement_lte_reserved',
      sql`${table.consumedCount} + ${table.releasedCount} <= ${table.reservedCount}`
    ),
  ]
);

export const automationEventDeliveries = pgTable(
  'automation_event_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    channelMappingId: uuid('channel_mapping_id')
      .notNull()
      .references(() => publChannelMappings.id, { onDelete: 'restrict' }),
    automationRuleId: uuid('automation_rule_id')
      .notNull()
      .references(() => automationRules.id, { onDelete: 'restrict' }),
    eventDefinitionId: uuid('event_definition_id')
      .notNull()
      .references(() => publEventDefinitions.id, { onDelete: 'restrict' }),
    externalEventId: varchar('external_event_id', { length: 255 }).notNull(),
    eventKey: varchar('event_key', { length: 160 }).notNull(),
    channelCode: varchar('channel_code', { length: 160 }).notNull(),
    sendChannel: messageSendChannelEnum('send_channel').notNull(),
    status: automationEventDeliveryStatusEnum('status').notNull().default('processing'),
    reasonCode: varchar('reason_code', { length: 120 }),
    reasonMessage: varchar('reason_message', { length: 500 }),
    targetPhoneMasked: varchar('target_phone_masked', { length: 80 }),
    targetRefHash: varchar('target_ref_hash', { length: 128 }),
    eventPayloadCiphertext: text('event_payload_ciphertext'),
    eventPayloadIv: varchar('event_payload_iv', { length: 64 }),
    eventPayloadTag: varchar('event_payload_tag', { length: 64 }),
    eventPayloadVersion: integer('event_payload_version').notNull().default(1),
    payloadExpiresAt: timestampWithTimezone('payload_expires_at'),
    payloadPurgedAt: timestampWithTimezone('payload_purged_at'),
    messageSendGroupId: uuid('message_send_group_id').references(() => messageSendGroups.id, { onDelete: 'set null' }),
    receivedAt: timestampWithTimezone('received_at').notNull().defaultNow(),
    sentAt: timestampWithTimezone('sent_at'),
    dismissedAt: timestampWithTimezone('dismissed_at'),
    lastAttemptAt: timestampWithTimezone('last_attempt_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('automation_event_deliveries_delivery_unique').on(
      table.channelMappingId,
      table.externalEventId,
      table.automationRuleId
    ),
    index('automation_event_deliveries_user_status_created_idx').on(
      table.userId,
      table.status,
      table.createdAt.desc()
    ),
    index('automation_event_deliveries_payload_purge_idx').on(table.payloadExpiresAt, table.payloadPurgedAt),
    index('automation_event_deliveries_message_send_group_idx').on(table.messageSendGroupId),
    check('automation_event_deliveries_payload_version_positive', sql`${table.eventPayloadVersion} > 0`),
  ]
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 120 }).notNull(),
    targetType: varchar('target_type', { length: 120 }).notNull(),
    targetId: varchar('target_id', { length: 128 }),
    metadataJson: jsonb('metadata_json'),
    ipAddressHash: varchar('ip_address_hash', { length: 128 }),
    userAgentSummary: varchar('user_agent_summary', { length: 255 }),
    createdAt: createdAt(),
  },
  (table) => [
    index('audit_logs_actor_user_idx').on(table.actorUserId),
    index('audit_logs_target_idx').on(table.targetType, table.targetId),
    index('audit_logs_action_created_at_idx').on(table.action, table.createdAt),
  ]
);

export const publEventDefinitionsRelations = relations(publEventDefinitions, ({ many }) => ({
  props: many(publEventPropDefinitions),
  automationEventDeliveries: many(automationEventDeliveries),
}));

export const publEventPropDefinitionsRelations = relations(publEventPropDefinitions, ({ one }) => ({
  event: one(publEventDefinitions, {
    fields: [publEventPropDefinitions.eventId],
    references: [publEventDefinitions.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  externalAuthAccounts: many(externalAuthAccounts),
  publPappSessions: many(publPappSessions),
  publChannelMappings: many(publChannelMappings),
  automationRules: many(automationRules),
  automationRuleRevisions: many(automationRuleRevisions),
  automationEventDeliveries: many(automationEventDeliveries),
  userSenderResources: many(userSenderResources),
  senderResourceApplications: many(senderResourceApplications, { relationName: 'applicationRequester' }),
  reviewedSenderResourceApplications: many(senderResourceApplications, { relationName: 'applicationReviewer' }),
  limitIncreaseRequests: many(limitIncreaseRequests, { relationName: 'limitIncreaseRequester' }),
  reviewedLimitIncreaseRequests: many(limitIncreaseRequests, { relationName: 'limitIncreaseReviewer' }),
  uploadedEvidenceFiles: many(senderResourceApplicationEvidenceFiles, { relationName: 'evidenceUploader' }),
  deletedEvidenceFiles: many(senderResourceApplicationEvidenceFiles, { relationName: 'evidenceDeleter' }),
  requestedSettlementRuns: many(settlementRuns, { relationName: 'settlementRequester' }),
  finalizedSettlementRuns: many(settlementRuns, { relationName: 'settlementFinalizer' }),
  settlementUsageSummaries: many(settlementUsageSummaries),
  smsBulkSendRuns: many(smsBulkSendRuns),
  smsQuotaBuckets: many(smsQuotaBuckets),
  smsQuotaReservations: many(smsQuotaReservations),
  messageSendGroups: many(messageSendGroups),
  auditLogs: many(auditLogs),
}));

export const billingAccountsRelations = relations(billingAccounts, ({ many }) => ({
  userSenderResources: many(userSenderResources),
  settlementUsageSummaries: many(settlementUsageSummaries),
  smsBulkSendRuns: many(smsBulkSendRuns),
  messageSendGroups: many(messageSendGroups),
}));

export const externalAuthAccountsRelations = relations(externalAuthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [externalAuthAccounts.userId],
    references: [users.id],
  }),
}));

export const publPappSessionsRelations = relations(publPappSessions, ({ one }) => ({
  user: one(users, {
    fields: [publPappSessions.userId],
    references: [users.id],
  }),
}));

export const senderResourcesRelations = relations(senderResources, ({ many }) => ({
  userSenderResources: many(userSenderResources),
  automationRules: many(automationRules),
  smsBulkSendRuns: many(smsBulkSendRuns),
  messageSendGroups: many(messageSendGroups),
  quotaBuckets: many(senderResourceQuotaBuckets),
  limitIncreaseRequests: many(limitIncreaseRequests),
}));

export const publChannelMappingsRelations = relations(publChannelMappings, ({ one, many }) => ({
  user: one(users, {
    fields: [publChannelMappings.userId],
    references: [users.id],
  }),
  automationRules: many(automationRules),
  automationEventDeliveries: many(automationEventDeliveries),
}));

export const automationRulesRelations = relations(automationRules, ({ one, many }) => ({
  user: one(users, {
    fields: [automationRules.userId],
    references: [users.id],
  }),
  eventDefinition: one(publEventDefinitions, {
    fields: [automationRules.eventDefinitionId],
    references: [publEventDefinitions.id],
  }),
  senderResource: one(senderResources, {
    fields: [automationRules.senderResourceId],
    references: [senderResources.id],
  }),
  revisions: many(automationRuleRevisions),
  automationEventDeliveries: many(automationEventDeliveries),
  messageSendGroups: many(messageSendGroups),
}));

export const automationRuleRevisionsRelations = relations(automationRuleRevisions, ({ one }) => ({
  automationRule: one(automationRules, {
    fields: [automationRuleRevisions.automationRuleId],
    references: [automationRules.id],
  }),
  actor: one(users, {
    fields: [automationRuleRevisions.actorUserId],
    references: [users.id],
  }),
}));

export const userSenderResourcesRelations = relations(userSenderResources, ({ one }) => ({
  user: one(users, {
    fields: [userSenderResources.userId],
    references: [users.id],
  }),
  senderResource: one(senderResources, {
    fields: [userSenderResources.senderResourceId],
    references: [senderResources.id],
  }),
  billingAccount: one(billingAccounts, {
    fields: [userSenderResources.billingAccountId],
    references: [billingAccounts.id],
  }),
}));

export const senderResourceApplicationsRelations = relations(senderResourceApplications, ({ one, many }) => ({
  user: one(users, {
    fields: [senderResourceApplications.userId],
    references: [users.id],
    relationName: 'applicationRequester',
  }),
  reviewer: one(users, {
    fields: [senderResourceApplications.reviewedBy],
    references: [users.id],
    relationName: 'applicationReviewer',
  }),
  evidenceFiles: many(senderResourceApplicationEvidenceFiles),
}));

export const senderResourceApplicationEvidenceFilesRelations = relations(
  senderResourceApplicationEvidenceFiles,
  ({ one }) => ({
    application: one(senderResourceApplications, {
      fields: [senderResourceApplicationEvidenceFiles.applicationId],
      references: [senderResourceApplications.id],
    }),
    uploader: one(users, {
      fields: [senderResourceApplicationEvidenceFiles.uploadedBy],
      references: [users.id],
      relationName: 'evidenceUploader',
    }),
    deleter: one(users, {
      fields: [senderResourceApplicationEvidenceFiles.deletedBy],
      references: [users.id],
      relationName: 'evidenceDeleter',
    }),
  })
);

export const limitIncreaseRequestsRelations = relations(limitIncreaseRequests, ({ one }) => ({
  user: one(users, {
    fields: [limitIncreaseRequests.userId],
    references: [users.id],
    relationName: 'limitIncreaseRequester',
  }),
  senderResource: one(senderResources, {
    fields: [limitIncreaseRequests.senderResourceId],
    references: [senderResources.id],
  }),
  reviewer: one(users, {
    fields: [limitIncreaseRequests.reviewedBy],
    references: [users.id],
    relationName: 'limitIncreaseReviewer',
  }),
}));

export const settlementRunsRelations = relations(settlementRuns, ({ one, many }) => ({
  requester: one(users, {
    fields: [settlementRuns.requestedBy],
    references: [users.id],
    relationName: 'settlementRequester',
  }),
  finalizer: one(users, {
    fields: [settlementRuns.finalizedBy],
    references: [users.id],
    relationName: 'settlementFinalizer',
  }),
  usageSummaries: many(settlementUsageSummaries),
}));

export const settlementUsageSummariesRelations = relations(settlementUsageSummaries, ({ one }) => ({
  run: one(settlementRuns, {
    fields: [settlementUsageSummaries.runId],
    references: [settlementRuns.id],
  }),
  billingAccount: one(billingAccounts, {
    fields: [settlementUsageSummaries.billingAccountId],
    references: [billingAccounts.id],
  }),
  user: one(users, {
    fields: [settlementUsageSummaries.userId],
    references: [users.id],
  }),
}));

export const smsBulkSendRunsRelations = relations(smsBulkSendRuns, ({ one, many }) => ({
  user: one(users, {
    fields: [smsBulkSendRuns.userId],
    references: [users.id],
  }),
  senderResource: one(senderResources, {
    fields: [smsBulkSendRuns.senderResourceId],
    references: [senderResources.id],
  }),
  billingAccount: one(billingAccounts, {
    fields: [smsBulkSendRuns.billingAccountId],
    references: [billingAccounts.id],
  }),
  batches: many(smsBulkSendBatches),
  quotaReservations: many(smsQuotaReservations),
}));

export const smsBulkSendBatchesRelations = relations(smsBulkSendBatches, ({ one }) => ({
  run: one(smsBulkSendRuns, {
    fields: [smsBulkSendBatches.runId],
    references: [smsBulkSendRuns.id],
  }),
}));

export const smsQuotaBucketsRelations = relations(smsQuotaBuckets, ({ one, many }) => ({
  user: one(users, {
    fields: [smsQuotaBuckets.userId],
    references: [users.id],
  }),
  senderResource: one(senderResources, {
    fields: [smsQuotaBuckets.senderResourceId],
    references: [senderResources.id],
  }),
  reservations: many(smsQuotaReservations),
}));

export const smsQuotaReservationsRelations = relations(smsQuotaReservations, ({ one }) => ({
  bucket: one(smsQuotaBuckets, {
    fields: [smsQuotaReservations.bucketId],
    references: [smsQuotaBuckets.id],
  }),
  run: one(smsBulkSendRuns, {
    fields: [smsQuotaReservations.runId],
    references: [smsBulkSendRuns.id],
  }),
  user: one(users, {
    fields: [smsQuotaReservations.userId],
    references: [users.id],
  }),
}));

export const senderResourceQuotaBucketsRelations = relations(senderResourceQuotaBuckets, ({ one, many }) => ({
  senderResource: one(senderResources, {
    fields: [senderResourceQuotaBuckets.senderResourceId],
    references: [senderResources.id],
  }),
  reservations: many(senderResourceQuotaReservations),
}));

export const messageSendGroupsRelations = relations(messageSendGroups, ({ one, many }) => ({
  user: one(users, {
    fields: [messageSendGroups.userId],
    references: [users.id],
  }),
  senderResource: one(senderResources, {
    fields: [messageSendGroups.senderResourceId],
    references: [senderResources.id],
  }),
  billingAccount: one(billingAccounts, {
    fields: [messageSendGroups.billingAccountId],
    references: [billingAccounts.id],
  }),
  sourceAutomationRule: one(automationRules, {
    fields: [messageSendGroups.sourceAutomationRuleId],
    references: [automationRules.id],
  }),
  providerRequests: many(messageSendProviderRequests),
  automationEventDeliveries: many(automationEventDeliveries),
}));

export const messageSendProviderRequestsRelations = relations(messageSendProviderRequests, ({ one, many }) => ({
  group: one(messageSendGroups, {
    fields: [messageSendProviderRequests.groupId],
    references: [messageSendGroups.id],
  }),
  quotaReservations: many(senderResourceQuotaReservations),
}));

export const senderResourceQuotaReservationsRelations = relations(senderResourceQuotaReservations, ({ one }) => ({
  bucket: one(senderResourceQuotaBuckets, {
    fields: [senderResourceQuotaReservations.bucketId],
    references: [senderResourceQuotaBuckets.id],
  }),
  providerRequest: one(messageSendProviderRequests, {
    fields: [senderResourceQuotaReservations.providerRequestId],
    references: [messageSendProviderRequests.id],
  }),
}));

export const automationEventDeliveriesRelations = relations(automationEventDeliveries, ({ one }) => ({
  user: one(users, {
    fields: [automationEventDeliveries.userId],
    references: [users.id],
  }),
  channelMapping: one(publChannelMappings, {
    fields: [automationEventDeliveries.channelMappingId],
    references: [publChannelMappings.id],
  }),
  automationRule: one(automationRules, {
    fields: [automationEventDeliveries.automationRuleId],
    references: [automationRules.id],
  }),
  eventDefinition: one(publEventDefinitions, {
    fields: [automationEventDeliveries.eventDefinitionId],
    references: [publEventDefinitions.id],
  }),
  messageSendGroup: one(messageSendGroups, {
    fields: [automationEventDeliveries.messageSendGroupId],
    references: [messageSendGroups.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));
