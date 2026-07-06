import { readFileSync } from 'node:fs';

import { getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
  automationEventDeliveries,
  automationEventDeliveryStatusEnum,
  automationRuleRevisions,
  automationRules,
  automationRuleStatusEnum,
  auditLogs,
  billingAccounts,
  externalAuthAccounts,
  externalAuthProviderEnum,
  messageSendChannelEnum,
  messageSendGroups,
  messageSendKindEnum,
  messageSendProviderRequests,
  messageSendProviderStateEnum,
  messageSendResultStateEnum,
  messageSendSourceTypeEnum,
  messageSendTimingEnum,
  publChannelMappings,
  publChannelMappingStatusEnum,
  publPappSessions,
  publEventDefinitions,
  publEventPropDefinitions,
  senderResourceApplicationEvidenceFiles,
  senderResourceApplications,
  senderResourceTypeEnum,
  senderResources,
  settlementChannelEnum,
  settlementRuns,
  settlementUsageSummaries,
  smsBulkSendBatchStatusEnum,
  smsBulkSendBatches,
  smsBulkSendChannelEnum,
  smsBulkSendRunStatusEnum,
  smsBulkSendRuns,
  smsQuotaBuckets,
  smsQuotaReservationStatusEnum,
  smsQuotaReservations,
  smsQuotaScopeEnum,
  userSenderResourceStatusEnum,
  userSenderResources,
  users,
} from '../../db/schema.js';

const domainTables = [
  publEventDefinitions,
  publEventPropDefinitions,
  users,
  billingAccounts,
  externalAuthAccounts,
  publPappSessions,
  senderResources,
  publChannelMappings,
  automationRules,
  automationRuleRevisions,
  userSenderResources,
  senderResourceApplications,
  senderResourceApplicationEvidenceFiles,
  settlementRuns,
  settlementUsageSummaries,
  smsBulkSendRuns,
  smsBulkSendBatches,
  smsQuotaBuckets,
  smsQuotaReservations,
  messageSendGroups,
  messageSendProviderRequests,
  automationEventDeliveries,
  auditLogs,
];

const verifyMigrationsSource = readFileSync(new URL('../../../scripts/verify_migrations.js', import.meta.url), 'utf8');
const migrationForbiddenIdentifiers = extractForbiddenMigrationIdentifiers(verifyMigrationsSource);

const forbiddenTableNames = [
  'send_requests',
  'send_delivery_results',
  'message_logs',
  'message_recipients',
  'recipient_results',
  'delivery_results',
  'template_source_payloads',
];

const forbiddenColumnNames = [
  'recipientNo',
  'recipientPhone',
  'phoneNumber',
  'messageBody',
  'messageTitle',
  'contentPreview',
  'renderedContent',
  'messageStatus',
  'receiveDate',
  'sendNo',
  'templateParameter',
  'templateParameters',
  'templateValues',
  'templatePayload',
  'button',
  'buttons',
  'quickReplies',
  'nhnResultPayload',
  'rawPayload',
  'providerPayload',
  'webhookPayload',
  'responseBody',
  'resultPayload',
  'accessToken',
  'refreshToken',
  'oauthAccessToken',
  'oauthRefreshToken',
  'providerAccessToken',
  'providerRefreshToken',
  'token',
  'secret',
];

function tableColumnNames(table) {
  return Object.keys(table).filter((key) => key !== 'enableRLS');
}

describe('relay domain schema', () => {
  it('defines only the local relay ownership, PUBL catalog, automation, approval, settlement, and audit tables', () => {
    expect(domainTables.map((table) => getTableName(table))).toEqual([
      'publ_event_definitions',
      'publ_event_prop_definitions',
      'users',
      'billing_accounts',
      'external_auth_accounts',
      'publ_papp_sessions',
      'sender_resources',
      'publ_channel_mappings',
      'automation_rules',
      'automation_rule_revisions',
      'user_sender_resources',
      'sender_resource_applications',
      'sender_resource_application_evidence_files',
      'settlement_runs',
      'settlement_usage_summaries',
      'sms_bulk_send_runs',
      'sms_bulk_send_batches',
      'sms_quota_buckets',
      'sms_quota_reservations',
      'message_send_groups',
      'message_send_provider_requests',
      'automation_event_deliveries',
      'audit_logs',
    ]);

    expect(domainTables.map((table) => getTableName(table))).not.toEqual(
      expect.arrayContaining(forbiddenTableNames)
    );
    expect(tableColumnNames(publEventDefinitions)).not.toEqual(expect.arrayContaining(['category']));
  });

  it('keeps short immutable grouping refs and shared sender resource links', () => {
    expect(users.userRef.length).toBe(20);
    expect(billingAccounts.billingRef.length).toBe(20);
    expect(senderResources.resourceRef.length).toBe(20);
    expect(externalAuthProviderEnum.enumValues).toEqual(['clerk', 'publ', 'google', 'kakao']);
    expect(senderResourceTypeEnum.enumValues).toEqual(['sms_send_no', 'kakao_sender_key']);
    expect(userSenderResourceStatusEnum.enumValues).toEqual(['pending', 'active', 'rejected', 'suspended']);

    expect(tableColumnNames(senderResources)).not.toEqual(expect.arrayContaining(['userId', 'billingAccountId']));
    expect(tableColumnNames(externalAuthAccounts)).toEqual(
      expect.arrayContaining(['userId', 'provider', 'providerAccountId', 'email', 'displayName'])
    );
    expect(tableColumnNames(externalAuthAccounts)).not.toEqual(expect.arrayContaining(forbiddenColumnNames));
    expect(tableColumnNames(userSenderResources)).toEqual(
      expect.arrayContaining(['userId', 'senderResourceId', 'billingAccountId', 'role', 'status', 'isDefault'])
    );
  });

  it('does not add persistent sent-message content, recipient, template payload, or provider-result fields', () => {
    const allColumnNames = domainTables.flatMap((table) => tableColumnNames(table));

    expect(allColumnNames).not.toEqual(expect.arrayContaining(forbiddenColumnNames));
    expect(settlementChannelEnum.enumValues).toEqual(['alimtalk', 'sms', 'lms', 'mms']);
    expect(tableColumnNames(auditLogs)).toEqual(
      expect.arrayContaining(['action', 'targetType', 'targetId', 'metadataJson', 'ipAddressHash'])
    );
  });

  it('defines PUBL automation mappings, rules, and deliveries with safe encrypted payload metadata', () => {
    expect(publChannelMappingStatusEnum.enumValues).toEqual(['active', 'disabled', 'archived']);
    expect(automationRuleStatusEnum.enumValues).toEqual(['enabled', 'disabled', 'archived']);
    expect(automationEventDeliveryStatusEnum.enumValues).toEqual([
      'processing',
      'sent',
      'unsent',
      'dismissed',
      'failed',
    ]);

    expect(tableColumnNames(publChannelMappings)).toEqual(
      expect.arrayContaining([
        'userId',
        'channelCode',
        'displayName',
        'status',
        'externalBusinessRef',
        'createdAt',
        'updatedAt',
      ])
    );
    expect(tableColumnNames(automationRules)).toEqual(
      expect.arrayContaining([
        'userId',
        'eventDefinitionId',
        'name',
        'status',
        'sendChannel',
        'senderResourceId',
        'templateCode',
        'templateSource',
        'templateSourceKey',
        'variableMappingJson',
        'recipientMappingJson',
        'conditionJson',
        'cooldownPolicyJson',
        'validationSnapshotJson',
        'validatedConfigHash',
        'lastValidatedAt',
        'enabledAt',
        'archivedAt',
      ])
    );
    expect(automationRules.variableMappingJson.default).toBeDefined();
    expect(automationRules.recipientMappingJson.default).toBeDefined();
    expect(automationRules.conditionJson.default).toBeDefined();
    expect(automationRules.cooldownPolicyJson.default).toBeDefined();
    expect(automationRules.recipientMappingJson.notNull).toBe(true);
    expect(automationRules.conditionJson.notNull).toBe(true);
    expect(automationRules.cooldownPolicyJson.notNull).toBe(true);
    expect(tableColumnNames(automationRuleRevisions)).toEqual(
      expect.arrayContaining([
        'automationRuleId',
        'actorUserId',
        'revisionNumber',
        'action',
        'statusBefore',
        'statusAfter',
        'configSnapshotJson',
        'validationSnapshotJson',
        'createdAt',
      ])
    );
    expect(automationRuleRevisions.configSnapshotJson.default).toBeDefined();
    expect(automationRuleRevisions.configSnapshotJson.notNull).toBe(true);
    expect(tableColumnNames(automationEventDeliveries)).toEqual(
      expect.arrayContaining([
        'userId',
        'channelMappingId',
        'automationRuleId',
        'eventDefinitionId',
        'externalEventId',
        'eventKey',
        'channelCode',
        'sendChannel',
        'status',
        'reasonCode',
        'reasonMessage',
        'targetPhoneMasked',
        'targetRefHash',
        'eventPayloadCiphertext',
        'eventPayloadIv',
        'eventPayloadTag',
        'eventPayloadVersion',
        'payloadExpiresAt',
        'payloadPurgedAt',
        'messageSendGroupId',
        'receivedAt',
        'sentAt',
        'dismissedAt',
        'lastAttemptAt',
      ])
    );

    expect(indexNames(publChannelMappings)).toEqual(
      expect.arrayContaining([
        'publ_channel_mappings_channel_code_unique',
        'publ_channel_mappings_user_status_idx',
      ])
    );
    expect(indexNames(automationRules)).toEqual(
      expect.arrayContaining([
        'automation_rules_enabled_event_unique',
        'automation_rules_lookup_idx',
        'automation_rules_user_status_idx',
      ])
    );
    expect(indexNames(automationRuleRevisions)).toEqual(
      expect.arrayContaining([
        'automation_rule_revisions_rule_revision_unique',
        'automation_rule_revisions_rule_history_idx',
        'automation_rule_revisions_actor_action_idx',
      ])
    );
    expect(indexNames(automationEventDeliveries)).toEqual(
      expect.arrayContaining([
        'automation_event_deliveries_delivery_unique',
        'automation_event_deliveries_user_status_created_idx',
        'automation_event_deliveries_payload_purge_idx',
      ])
    );

    expect(foreignKeyDeleteActions(publChannelMappings)).toEqual(['restrict']);
    expect(foreignKeyDeleteActions(automationRules)).toEqual(['restrict', 'restrict', 'restrict']);
    expect(foreignKeyDeleteActions(automationRuleRevisions)).toEqual(['restrict', 'restrict']);
    expect(foreignKeyDeleteActions(automationEventDeliveries)).toEqual(
      expect.arrayContaining(['restrict', 'restrict', 'restrict', 'restrict', 'set null'])
    );
    expect(checkNames(automationRuleRevisions)).toEqual(
      expect.arrayContaining(['automation_rule_revisions_revision_number_positive'])
    );

    const automationMigrationSource = readFileSync(
      new URL('../../../drizzle/0012_automation_rules_enabled_event_unique.sql', import.meta.url),
      'utf8'
    );
    expect(automationMigrationSource).toContain(
      'CREATE UNIQUE INDEX "automation_rules_enabled_event_unique" ON "automation_rules" USING btree ("user_id","event_definition_id") WHERE "automation_rules"."status" = \'enabled\''
    );

    const encryptedPayloadSqlNames = [
      automationEventDeliveries.eventPayloadCiphertext.name,
      automationEventDeliveries.eventPayloadIv.name,
      automationEventDeliveries.eventPayloadTag.name,
      automationEventDeliveries.eventPayloadVersion.name,
    ];

    expect(encryptedPayloadSqlNames).toEqual([
      'event_payload_ciphertext',
      'event_payload_iv',
      'event_payload_tag',
      'event_payload_version',
    ]);
    expect(encryptedPayloadSqlNames.filter((name) => migrationForbiddenIdentifiers.has(name))).toEqual([]);
    expect(tableColumnNames(automationRules)).not.toEqual(
      expect.arrayContaining(['messageBody', 'renderedContent', 'templateParameter', 'templateValues'])
    );
    expect(tableColumnNames(automationRuleRevisions)).not.toEqual(
      expect.arrayContaining(['rawPayload', 'recipientNo', 'messageBody', 'templateParameter', 'providerPayload'])
    );
  });

  it('defines nullable PUBL event prop samples as catalog metadata only', () => {
    expect(tableColumnNames(publEventPropDefinitions)).toEqual(
      expect.arrayContaining(['fallback', 'sample', 'parserPipelineJson', 'description'])
    );
    expect(publEventPropDefinitions.sample.notNull).toBe(false);
    expect(checkNames(publEventPropDefinitions)).toEqual(
      expect.arrayContaining(['publ_event_prop_definitions_prop_type_check'])
    );
  });

  it('defines SMS bulk send runs, worker batches, and quota reservations without local delivery logs', () => {
    expect(smsBulkSendChannelEnum.enumValues).toEqual(['sms', 'lms', 'mms']);
    expect(smsBulkSendRunStatusEnum.enumValues).toEqual([
      'queued',
      'running',
      'completed',
      'blocked',
      'failed',
      'canceled',
    ]);
    expect(smsBulkSendBatchStatusEnum.enumValues).toEqual([
      'pending',
      'sending',
      'accepted',
      'rejected',
      'unknown',
      'failed',
      'canceled',
    ]);
    expect(smsQuotaScopeEnum.enumValues).toEqual(['user_period']);
    expect(smsQuotaReservationStatusEnum.enumValues).toEqual(['reserved', 'consumed', 'released']);

    expect(tableColumnNames(smsBulkSendRuns)).toEqual(
      expect.arrayContaining([
        'userId',
        'senderResourceId',
        'channel',
        'managementSendName',
        'requestDate',
        'totalRecipients',
        'batchSize',
        'totalBatches',
        'acceptedCount',
        'rejectedCount',
        'unknownCount',
        'status',
        'errorCode',
        'errorMessage',
      ])
    );
    expect(tableColumnNames(smsBulkSendBatches)).toEqual(
      expect.arrayContaining([
        'runId',
        'sequence',
        'recipientCount',
        'status',
        'clientRequestId',
        'providerRequestId',
        'attempts',
        'lockedBy',
        'leaseExpiresAt',
        'payloadJson',
        'payloadExpiresAt',
        'payloadPurgedAt',
      ])
    );
    expect(tableColumnNames(smsQuotaBuckets)).toEqual(
      expect.arrayContaining(['userId', 'channel', 'quotaScope', 'quotaLimit', 'reservedCount', 'consumedCount'])
    );
    expect(tableColumnNames(smsQuotaReservations)).toEqual(
      expect.arrayContaining(['bucketId', 'runId', 'reservedCount', 'consumedCount', 'releasedCount', 'status'])
    );

    expect(indexNames(smsBulkSendRuns)).toEqual(expect.arrayContaining(['sms_bulk_send_runs_worker_claim_idx']));
    expect(indexNames(smsBulkSendBatches)).toEqual(
      expect.arrayContaining([
        'sms_bulk_send_batches_run_sequence_idx',
        'sms_bulk_send_batches_worker_claim_idx',
        'sms_bulk_send_batches_provider_request_idx',
      ])
    );
    expect(indexNames(smsQuotaBuckets)).toEqual(expect.arrayContaining(['sms_quota_buckets_lookup_idx']));

    expect(tableColumnNames(smsBulkSendRuns)).not.toEqual(
      expect.arrayContaining(['recipientNo', 'messageBody', 'templateParameter', 'nhnResultPayload'])
    );
  });

  it('defines minimal provider-neutral message send ledger tables without recipient-level storage', () => {
    expect(messageSendChannelEnum.enumValues).toEqual(['sms', 'lms', 'mms', 'alimtalk', 'brand-message']);
    expect(messageSendKindEnum.enumValues).toEqual(['basic', 'bulk']);
    expect(messageSendTimingEnum.enumValues).toEqual(['immediate', 'scheduled']);
    expect(messageSendSourceTypeEnum.enumValues).toEqual(['manual', 'automation']);
    expect(messageSendProviderStateEnum.enumValues).toEqual([
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
    expect(messageSendResultStateEnum.enumValues).toEqual([
      'not_synced',
      'syncing',
      'partially_synced',
      'synced',
      'stale',
      'error',
    ]);

    expect(tableColumnNames(messageSendGroups)).toEqual(
      expect.arrayContaining([
        'userId',
        'senderResourceId',
        'billingAccountId',
        'channel',
        'sendKind',
        'sendTiming',
        'managementTitle',
        'sourceType',
        'sourceEventKey',
        'sourceExternalEventId',
        'sourceChannelCode',
        'sourceAutomationRuleId',
        'sourceAutomationDeliveryId',
        'totalRecipientCount',
        'providerRequestCount',
        'acceptedRequestCount',
        'providerState',
        'resultState',
        'successCount',
        'failedCount',
        'pendingCount',
        'canceledCount',
        'resultSyncedAt',
        'resultFinalizedAt',
        'scheduledAt',
        'expiresAt',
        'archivedAt',
        'archiveReason',
        'purgeAfter',
      ])
    );
    expect(tableColumnNames(messageSendProviderRequests)).toEqual(
      expect.arrayContaining([
        'groupId',
        'sequence',
        'clientRequestId',
        'providerRequestId',
        'recipientCount',
        'providerState',
        'resultState',
        'successCount',
        'failedCount',
        'pendingCount',
        'canceledCount',
        'resultSnapshotJson',
        'resultSnapshotVersion',
        'firstResultReceivedAt',
        'resultSyncedAt',
        'resultFinalizedAt',
        'syncLockedBy',
        'syncLeaseExpiresAt',
        'syncAttempts',
        'nextSyncAt',
      ])
    );

    expect(tableColumnNames(messageSendGroups)).not.toEqual(expect.arrayContaining(forbiddenColumnNames));
    expect(tableColumnNames(messageSendProviderRequests)).not.toEqual(expect.arrayContaining(forbiddenColumnNames));
    expect(indexNames(messageSendGroups)).toEqual(
      expect.arrayContaining([
        'message_send_groups_user_channel_active_created_idx',
        'message_send_groups_user_expires_at_idx',
        'message_send_groups_purge_after_archived_idx',
        'message_send_groups_sync_scope_idx',
        'message_send_groups_automation_source_lookup_idx',
      ])
    );
    expect(indexNames(messageSendProviderRequests)).toEqual(
      expect.arrayContaining([
        'message_send_provider_requests_group_sequence_unique',
        'message_send_provider_requests_client_request_idx',
        'message_send_provider_requests_provider_request_idx',
        'message_send_provider_requests_sync_claim_idx',
      ])
    );
    expect(checkNames(messageSendGroups)).toEqual(
      expect.arrayContaining([
        'message_send_groups_accepted_request_count_lte_provider_request_count',
        'message_send_groups_result_counts_lte_total_recipient_count',
      ])
    );
    expect(checkNames(messageSendProviderRequests)).toEqual(
      expect.arrayContaining([
        'message_send_provider_requests_result_counts_lte_recipient_count',
        'message_send_provider_requests_result_snapshot_version_nonnegative',
        'message_send_provider_requests_sync_attempts_nonnegative',
      ])
    );
    expect(foreignKeyDeleteActions(messageSendProviderRequests)).toEqual(['cascade']);
    expect(foreignKeyNames(messageSendGroups)).not.toEqual(
      expect.arrayContaining(['message_send_groups_source_automation_delivery_id_automation_event_deliveries_id_fk'])
    );
  });

  it('defines Publ PApp sessions with hashed refresh-token storage only', () => {
    expect(externalAuthProviderEnum.enumValues).toContain('publ');
    expect(tableColumnNames(publPappSessions)).toEqual(
      expect.arrayContaining([
        'id',
        'userId',
        'consumerId',
        'pAppCode',
        'channelId',
        'channelCode',
        'installedPAppId',
        'sellerProfileDistinctId',
        'sellerRole',
        'refreshTokenHash',
        'refreshTokenExpiresAt',
        'accessTokenJti',
        'accessTokenExpiresAt',
        'createdAt',
        'updatedAt',
        'revokedAt',
      ])
    );
    expect(tableColumnNames(publPappSessions)).not.toEqual(
      expect.arrayContaining(['refreshToken', 'accessToken', 'rawPayload', 'providerPayload'])
    );
    expect(publPappSessions.consumerId.notNull).toBe(true);
    expect(publPappSessions.refreshTokenHash.notNull).toBe(true);
    expect(publPappSessions.refreshTokenExpiresAt.notNull).toBe(true);
    expect(publPappSessions.accessTokenJti.notNull).toBe(true);
    expect(publPappSessions.accessTokenExpiresAt.notNull).toBe(true);
    expect(indexNames(publPappSessions)).toEqual(
      expect.arrayContaining([
        'publ_papp_sessions_consumer_id_unique',
        'publ_papp_sessions_user_idx',
        'publ_papp_sessions_refresh_lookup_idx',
        'publ_papp_sessions_expiry_revocation_idx',
      ])
    );
    expect(foreignKeyDeleteActions(publPappSessions)).toEqual(['cascade']);
  });
});

function extractForbiddenMigrationIdentifiers(source) {
  const setSource = source.match(/const forbiddenIdentifiers = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? '';
  return new Set([...setSource.matchAll(/'([^']+)'/g)].map((match) => match[1]));
}

function indexNames(table) {
  return getTableConfig(table).indexes.map((item) => item.config.name);
}

function checkNames(table) {
  return getTableConfig(table).checks.map((item) => item.name);
}

function foreignKeyDeleteActions(table) {
  return getTableConfig(table).foreignKeys.map((item) => item.onDelete);
}

function foreignKeyNames(table) {
  return getTableConfig(table).foreignKeys.map((item) => item.getName());
}
