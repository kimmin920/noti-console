import { and, asc, desc, eq, gte, isNotNull, isNull, lte, ne, sql } from 'drizzle-orm';

import {
  automationEventDeliveries,
  automationRuleRevisions,
  automationRules,
  publEventDefinitions,
  publEventPropDefinitions,
  publChannelMappings,
  senderResources,
  userSenderResources,
} from '../../db/schema.js';

const BROWSER_SAFE_DELIVERY_FIELDS = [
  'id',
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
  'payloadExpiresAt',
  'payloadPurgedAt',
  'messageSendGroupId',
  'receivedAt',
  'sentAt',
  'dismissedAt',
  'lastAttemptAt',
  'createdAt',
  'updatedAt',
];

const DELIVERY_WRITE_FIELDS = [
  'id',
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
  'createdAt',
  'updatedAt',
];

const BROWSER_SAFE_RULE_FIELDS = [
  'id',
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
  'enabledAt',
  'archivedAt',
  'createdAt',
  'updatedAt',
];

const RULE_WRITE_FIELDS = [
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
  'createdAt',
  'updatedAt',
];

const BROWSER_SAFE_REVISION_FIELDS = [
  'id',
  'automationRuleId',
  'actorUserId',
  'revisionNumber',
  'action',
  'statusBefore',
  'statusAfter',
  'configSnapshotJson',
  'createdAt',
];

export function createAutomationRepository(db) {
  return {
    async findActiveChannelMappingByCode(channelCode) {
      const normalizedChannelCode = normalizeNonEmptyString(channelCode);
      if (!normalizedChannelCode) return null;

      const [mapping] = await db
        .select()
        .from(publChannelMappings)
        .where(
          and(
            eq(publChannelMappings.channelCode, normalizedChannelCode),
            eq(publChannelMappings.status, 'active')
          )
        )
        .limit(1);

      return mapping ?? null;
    },

    async listActiveRulesForUserEvent({ userId, eventDefinitionId }) {
      if (!userId || !eventDefinitionId) return [];

      return db
        .select()
        .from(automationRules)
        .where(
          and(
            eq(automationRules.userId, userId),
            eq(automationRules.eventDefinitionId, eventDefinitionId),
            eq(automationRules.status, 'enabled')
          )
        )
        .orderBy(asc(automationRules.createdAt), asc(automationRules.id));
    },

    async listAutomationRulesForUser({ userId, status, limit = 100, offset = 0 } = {}) {
      if (!userId) return [];

      const predicates = [eq(automationRules.userId, userId)];
      const normalizedStatus = normalizeNonEmptyString(status);

      if (normalizedStatus) {
        predicates.push(eq(automationRules.status, normalizedStatus));
      }

      const rows = await db
        .select({
          rule: automationRules,
          eventKey: publEventDefinitions.eventKey,
          eventDisplayName: publEventDefinitions.displayName,
          senderResourceDisplayName: senderResources.displayName,
          senderResourceType: senderResources.type,
        })
        .from(automationRules)
        .innerJoin(publEventDefinitions, eq(automationRules.eventDefinitionId, publEventDefinitions.id))
        .innerJoin(senderResources, eq(automationRules.senderResourceId, senderResources.id))
        .where(and(...predicates))
        .orderBy(desc(automationRules.updatedAt), asc(automationRules.id))
        .limit(limit)
        .offset(offset);

      return rows.map(toAutomationRuleDetailDto);
    },

    async findAutomationRuleForUser({ ruleId, userId } = {}) {
      if (!ruleId || !userId) return null;

      const [row] = await db
        .select({
          rule: automationRules,
          eventKey: publEventDefinitions.eventKey,
          eventDisplayName: publEventDefinitions.displayName,
          senderResourceDisplayName: senderResources.displayName,
          senderResourceType: senderResources.type,
        })
        .from(automationRules)
        .innerJoin(publEventDefinitions, eq(automationRules.eventDefinitionId, publEventDefinitions.id))
        .innerJoin(senderResources, eq(automationRules.senderResourceId, senderResources.id))
        .where(and(eq(automationRules.id, ruleId), eq(automationRules.userId, userId)))
        .limit(1);

      return toAutomationRuleDetailDto(row);
    },

    async findEventDefinitionById(eventDefinitionId) {
      if (!eventDefinitionId) return null;

      const [event] = await db
        .select()
        .from(publEventDefinitions)
        .where(eq(publEventDefinitions.id, eventDefinitionId))
        .limit(1);

      if (!event) return null;

      const props = await db
        .select()
        .from(publEventPropDefinitions)
        .where(eq(publEventPropDefinitions.eventId, eventDefinitionId))
        .orderBy(asc(publEventPropDefinitions.sortOrder));

      return {
        ...event,
        props: props.map((prop) => ({
          ...prop,
          type: prop.propType,
          parserPipeline: prop.parserPipelineJson,
        })),
      };
    },

    async getUserSenderResource({ userId, senderResourceId }) {
      if (!userId || !senderResourceId) return null;

      const [row] = await db
        .select({
          link: userSenderResources,
          resource: senderResources,
        })
        .from(userSenderResources)
        .innerJoin(senderResources, eq(userSenderResources.senderResourceId, senderResources.id))
        .where(
          and(
            eq(userSenderResources.userId, userId),
            eq(userSenderResources.senderResourceId, senderResourceId)
          )
        )
        .limit(1);

      return row ?? null;
    },

    async createAutomationRule({ values, now = new Date() } = {}) {
      const [rule] = await db
        .insert(automationRules)
        .values(toAutomationRuleInsert(values, now))
        .returning();

      return toAutomationRuleDto(rule);
    },

    async updateAutomationRule({ ruleId, userId, values, now = new Date() } = {}) {
      if (!ruleId || !userId) return null;

      const [rule] = await db
        .update(automationRules)
        .set(toAutomationRuleUpdate(values, now))
        .where(and(eq(automationRules.id, ruleId), eq(automationRules.userId, userId)))
        .returning();

      return toAutomationRuleDto(rule);
    },

    async enableAutomationRule({ ruleId, userId, now = new Date() } = {}) {
      if (!ruleId || !userId) return { conflict: false, rule: null };

      try {
        return await db.transaction(async (tx) => {
          const rule = await findAutomationRuleRowForUser(tx, { ruleId, userId });
          if (!rule) return { conflict: false, rule: null };

          const [competing] = await tx
            .select({ id: automationRules.id })
            .from(automationRules)
            .where(
              and(
                eq(automationRules.userId, rule.userId),
                eq(automationRules.eventDefinitionId, rule.eventDefinitionId),
                eq(automationRules.status, 'enabled'),
                ne(automationRules.id, rule.id)
              )
            )
            .limit(1);

          if (competing) {
            return {
              conflict: true,
              competingRuleId: competing.id,
              rule: toAutomationRuleDto(rule),
            };
          }

          const [enabledRule] = await tx
            .update(automationRules)
            .set({ status: 'enabled', enabledAt: now, updatedAt: now })
            .where(and(eq(automationRules.id, ruleId), eq(automationRules.userId, userId)))
            .returning();

          return {
            conflict: false,
            rule: toAutomationRuleDto(enabledRule),
          };
        });
      } catch (error) {
        if (isEnabledRuleUniqueConflict(error)) {
          return { conflict: true, rule: null };
        }

        throw error;
      }
    },

    async disableAutomationRule({ ruleId, userId, now = new Date() } = {}) {
      if (!ruleId || !userId) return null;

      const [rule] = await db
        .update(automationRules)
        .set({ status: 'disabled', enabledAt: null, updatedAt: now })
        .where(and(eq(automationRules.id, ruleId), eq(automationRules.userId, userId)))
        .returning();

      return toAutomationRuleDto(rule);
    },

    async archiveAutomationRule({ ruleId, userId, now = new Date() } = {}) {
      if (!ruleId || !userId) return null;

      const [rule] = await db
        .update(automationRules)
        .set({ status: 'archived', archivedAt: now, enabledAt: null, updatedAt: now })
        .where(and(eq(automationRules.id, ruleId), eq(automationRules.userId, userId)))
        .returning();

      return toAutomationRuleDto(rule);
    },

    async createAutomationRuleRevision({ values, now = new Date() } = {}) {
      const automationRuleId = normalizeNonEmptyString(values?.automationRuleId);
      if (!automationRuleId) return null;

      const [revisionCounter] = await db
        .select({
          nextRevisionNumber: sql`(coalesce(max(${automationRuleRevisions.revisionNumber}), 0) + 1)::int`,
        })
        .from(automationRuleRevisions)
        .where(eq(automationRuleRevisions.automationRuleId, automationRuleId));
      const [revision] = await db
        .insert(automationRuleRevisions)
        .values({
          automationRuleId,
          actorUserId: values.actorUserId,
          revisionNumber: Number(revisionCounter?.nextRevisionNumber ?? 1),
          action: values.action,
          statusBefore: values.statusBefore ?? null,
          statusAfter: values.statusAfter ?? null,
          configSnapshotJson: sanitizeRevisionEvidence(values.configSnapshotJson ?? {}),
          createdAt: now,
        })
        .returning();

      return toAutomationRuleRevisionDto(revision);
    },

    async listAutomationRuleRevisions({ automationRuleId, userId, limit = 50 } = {}) {
      if (!automationRuleId || !userId) return [];

      const rows = await db
        .select({ revision: automationRuleRevisions })
        .from(automationRuleRevisions)
        .innerJoin(automationRules, eq(automationRuleRevisions.automationRuleId, automationRules.id))
        .where(and(eq(automationRuleRevisions.automationRuleId, automationRuleId), eq(automationRules.userId, userId)))
        .orderBy(desc(automationRuleRevisions.revisionNumber))
        .limit(limit);

      return rows.map((row) => toAutomationRuleRevisionDto(row.revision));
    },

    async createDelivery(values, { now = new Date() } = {}) {
      const [delivery] = await db
        .insert(automationEventDeliveries)
        .values(toAutomationDeliveryInsert(values, now))
        .returning();

      return toAutomationDeliveryDto(delivery);
    },

    async findDeliveryById(deliveryId) {
      if (!deliveryId) return null;

      const [delivery] = await db
        .select()
        .from(automationEventDeliveries)
        .where(eq(automationEventDeliveries.id, deliveryId))
        .limit(1);

      return toAutomationDeliveryDto(delivery);
    },

    async findDuplicateDelivery({ channelMappingId, externalEventId, automationRuleId }) {
      const key = createAutomationDeliveryKey({ channelMappingId, externalEventId, automationRuleId });
      if (!key) return null;

      const [delivery] = await db
        .select()
        .from(automationEventDeliveries)
        .where(
          and(
            eq(automationEventDeliveries.channelMappingId, key.channelMappingId),
            eq(automationEventDeliveries.externalEventId, key.externalEventId),
            eq(automationEventDeliveries.automationRuleId, key.automationRuleId)
          )
        )
        .limit(1);

      return toAutomationDeliveryDto(delivery);
    },

    async findRecentDeliveryForCooldown({ automationRuleId, excludeDeliveryId = null, targetRefHash, since } = {}) {
      if (!automationRuleId || !targetRefHash || !since) return null;
      const predicates = [
        eq(automationEventDeliveries.automationRuleId, automationRuleId),
        eq(automationEventDeliveries.targetRefHash, targetRefHash),
        gte(automationEventDeliveries.createdAt, since),
      ];

      if (excludeDeliveryId) {
        predicates.push(ne(automationEventDeliveries.id, excludeDeliveryId));
      }

      const [delivery] = await db
        .select()
        .from(automationEventDeliveries)
        .where(and(...predicates))
        .orderBy(desc(automationEventDeliveries.createdAt), desc(automationEventDeliveries.id))
        .limit(1);

      return toAutomationDeliveryDto(delivery);
    },

    async updateDelivery({ deliveryId, values, now = new Date() }) {
      if (!deliveryId) return null;

      const [delivery] = await db
        .update(automationEventDeliveries)
        .set(toAutomationDeliveryUpdate(values, now))
        .where(eq(automationEventDeliveries.id, deliveryId))
        .returning();

      return toAutomationDeliveryDto(delivery);
    },

    async listUnsentDeliveriesForUser({ userId, limit = 50, offset = 0 } = {}) {
      if (!userId) return [];

      const rows = await db
        .select()
        .from(automationEventDeliveries)
        .where(and(eq(automationEventDeliveries.userId, userId), eq(automationEventDeliveries.status, 'unsent')))
        .orderBy(desc(automationEventDeliveries.createdAt), asc(automationEventDeliveries.id))
        .limit(limit)
        .offset(offset);

      return rows.map(toAutomationDeliveryDto);
    },

    async listUnsentDeliverySummariesForUser({ userId, limit = 50, offset = 0 } = {}) {
      if (!userId) return [];

      const rows = await db
        .select({
          delivery: automationEventDeliveries,
          eventDisplayName: publEventDefinitions.displayName,
          ruleName: automationRules.name,
        })
        .from(automationEventDeliveries)
        .innerJoin(automationRules, eq(automationEventDeliveries.automationRuleId, automationRules.id))
        .innerJoin(publEventDefinitions, eq(automationEventDeliveries.eventDefinitionId, publEventDefinitions.id))
        .where(and(eq(automationEventDeliveries.userId, userId), eq(automationEventDeliveries.status, 'unsent')))
        .orderBy(desc(automationEventDeliveries.createdAt), asc(automationEventDeliveries.id))
        .limit(limit)
        .offset(offset);

      return rows.map((row) => ({
        delivery: toAutomationDeliveryDto(row.delivery),
        eventDisplayName: row.eventDisplayName ?? null,
        ruleName: row.ruleName ?? null,
      }));
    },

    async findUnsentDeliveryForUser({ deliveryId, userId }) {
      const delivery = await findUnsentDeliveryRow(db, { deliveryId, userId });
      return toAutomationDeliveryDto(delivery);
    },

    async findUnsentDeliveryWithEncryptedPayloadForUser({ deliveryId, userId }) {
      const delivery = await findUnsentDeliveryRow(db, { deliveryId, userId });
      if (!delivery) return null;

      return {
        delivery: toAutomationDeliveryDto(delivery),
        encryptedPayload: toAutomationDeliveryEncryptedPayload(delivery),
      };
    },

    async markDeliverySent({ deliveryId, messageSendGroupId, now = new Date() }) {
      return this.updateDelivery({
        deliveryId,
        now,
        values: {
          messageSendGroupId,
          reasonCode: null,
          reasonMessage: null,
          sentAt: now,
          status: 'sent',
        },
      });
    },

    async markDeliveryUnsent({ deliveryId, reasonCode, reasonMessage, now = new Date() }) {
      return this.updateDelivery({
        deliveryId,
        now,
        values: {
          lastAttemptAt: now,
          reasonCode,
          reasonMessage,
          status: 'unsent',
        },
      });
    },

    async markDeliveryDismissed({ deliveryId, now = new Date() }) {
      return this.updateDelivery({
        deliveryId,
        now,
        values: {
          dismissedAt: now,
          status: 'dismissed',
        },
      });
    },

    async markDeliveryFailed({ deliveryId, reasonCode, reasonMessage, now = new Date() }) {
      return this.updateDelivery({
        deliveryId,
        now,
        values: {
          lastAttemptAt: now,
          reasonCode,
          reasonMessage,
          status: 'failed',
        },
      });
    },

    async markDeliveryPayloadPurged({ deliveryId, now = new Date() }) {
      return this.updateDelivery({
        deliveryId,
        now,
        values: {
          eventPayloadCiphertext: null,
          eventPayloadIv: null,
          eventPayloadTag: null,
          payloadPurgedAt: now,
        },
      });
    },

    async listExpiredDeliveryPayloads({ now = new Date(), limit = 100 } = {}) {
      const rows = await db
        .select()
        .from(automationEventDeliveries)
        .where(
          and(
            isNull(automationEventDeliveries.payloadPurgedAt),
            isNotNull(automationEventDeliveries.eventPayloadCiphertext),
            lte(automationEventDeliveries.payloadExpiresAt, now)
          )
        )
        .orderBy(asc(automationEventDeliveries.payloadExpiresAt), asc(automationEventDeliveries.id))
        .limit(limit);

      return rows.map(toAutomationDeliveryDto);
    },
  };
}

export function createAutomationDeliveryKey({ channelMappingId, externalEventId, automationRuleId } = {}) {
  const normalizedExternalEventId = normalizeNonEmptyString(externalEventId);

  if (!channelMappingId || !automationRuleId || !normalizedExternalEventId) {
    return null;
  }

  return {
    automationRuleId,
    channelMappingId,
    externalEventId: normalizedExternalEventId,
  };
}

export function automationDeliveryKeyMatches(row, keyInput) {
  const key = createAutomationDeliveryKey(keyInput);
  if (!row || !key) return false;

  return (
    row.channelMappingId === key.channelMappingId &&
    row.externalEventId === key.externalEventId &&
    row.automationRuleId === key.automationRuleId
  );
}

export function isExpiredAutomationDeliveryPayload(row, now = new Date()) {
  if (!row?.eventPayloadCiphertext || row.payloadPurgedAt || !row.payloadExpiresAt) return false;
  return new Date(row.payloadExpiresAt).getTime() <= now.getTime();
}

export function toAutomationDeliveryDto(row) {
  if (!row) return null;

  return Object.fromEntries(
    BROWSER_SAFE_DELIVERY_FIELDS
      .filter((field) => Object.hasOwn(row, field))
      .map((field) => [field, row[field]])
  );
}

export function toAutomationRuleDto(row) {
  if (!row) return null;

  return Object.fromEntries(
    BROWSER_SAFE_RULE_FIELDS
      .filter((field) => Object.hasOwn(row, field))
      .map((field) => [field, row[field]])
  );
}

export function toAutomationRuleRevisionDto(row) {
  if (!row) return null;

  return Object.fromEntries(
    BROWSER_SAFE_REVISION_FIELDS
      .filter((field) => Object.hasOwn(row, field))
      .map((field) => [
        field,
        field === 'configSnapshotJson'
          ? sanitizeRevisionEvidence(row[field])
          : row[field],
      ])
  );
}

export function toAutomationDeliveryEncryptedPayload(row) {
  if (!row?.eventPayloadCiphertext || !row?.eventPayloadIv || !row?.eventPayloadTag) return null;

  return {
    eventPayloadCiphertext: row.eventPayloadCiphertext,
    eventPayloadIv: row.eventPayloadIv,
    eventPayloadTag: row.eventPayloadTag,
    eventPayloadVersion: row.eventPayloadVersion,
  };
}

function toAutomationDeliveryInsert(values, now) {
  return pickDefinedDeliveryFields({
    ...values,
    ...normalizeEncryptedPayloadInput(values),
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
  });
}

function toAutomationDeliveryUpdate(values, now) {
  return pickDefinedDeliveryFields({
    ...values,
    ...normalizeEncryptedPayloadInput(values),
    updatedAt: now,
  });
}

function normalizeEncryptedPayloadInput(values = {}) {
  if (!values.encryptedPayload) return {};

  return {
    eventPayloadCiphertext: values.encryptedPayload.eventPayloadCiphertext,
    eventPayloadIv: values.encryptedPayload.eventPayloadIv,
    eventPayloadTag: values.encryptedPayload.eventPayloadTag,
    eventPayloadVersion: values.encryptedPayload.eventPayloadVersion,
  };
}

function pickDefinedDeliveryFields(values) {
  const delivery = {};

  for (const field of DELIVERY_WRITE_FIELDS) {
    if (Object.hasOwn(values, field) && values[field] !== undefined) {
      delivery[field] = values[field];
    }
  }

  return delivery;
}

function toAutomationRuleDetailDto(row) {
  if (!row) return null;

  return {
    ...toAutomationRuleDto(row.rule ?? row),
    ...(Object.hasOwn(row, 'channelCode') ? {
      channelMapping: {
        channelCode: row.channelCode,
        displayName: row.channelDisplayName ?? null,
      },
    } : {}),
    ...(Object.hasOwn(row, 'eventKey') ? {
      eventDefinition: {
        eventKey: row.eventKey,
        displayName: row.eventDisplayName ?? null,
      },
    } : {}),
    ...(Object.hasOwn(row, 'senderResourceType') ? {
      senderResource: {
        displayName: row.senderResourceDisplayName ?? null,
        type: row.senderResourceType ?? null,
      },
    } : {}),
  };
}

function toAutomationRuleInsert(values, now) {
  return pickDefinedRuleFields({
    ...values,
    createdAt: values?.createdAt ?? now,
    updatedAt: values?.updatedAt ?? now,
  });
}

function toAutomationRuleUpdate(values, now) {
  return pickDefinedRuleFields({
    ...values,
    updatedAt: now,
  });
}

function pickDefinedRuleFields(values = {}) {
  const rule = {};

  for (const field of RULE_WRITE_FIELDS) {
    if (Object.hasOwn(values, field) && values[field] !== undefined) {
      rule[field] = values[field];
    }
  }

  return rule;
}

async function findAutomationRuleRowForUser(db, { ruleId, userId }) {
  const [rule] = await db
    .select()
    .from(automationRules)
    .where(and(eq(automationRules.id, ruleId), eq(automationRules.userId, userId)))
    .limit(1);

  return rule ?? null;
}

function sanitizeRevisionEvidence(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeRevisionEvidence).filter((item) => item !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !isSensitiveEvidenceKey(key))
        .map(([key, nestedValue]) => [key, sanitizeRevisionEvidence(nestedValue)])
        .filter(([, nestedValue]) => nestedValue !== undefined)
    );
  }

  if (typeof value === 'string' && looksLikePhoneNumber(value)) {
    return '[redacted]';
  }

  return value;
}

function isSensitiveEvidenceKey(key) {
  return /(^raw|sample|provider|payload|ciphertext|secret|requestBody|responseBody|templateBody|rendered|recipientNo|rawRecipientPhone)/i
    .test(key);
}

function looksLikePhoneNumber(value) {
  return value.replace(/\D/g, '').length >= 8;
}

function isEnabledRuleUniqueConflict(error) {
  return (
    error?.code === '23505' &&
    String(error?.constraint ?? error?.message ?? '').includes('automation_rules_enabled_event_unique')
  );
}

async function findUnsentDeliveryRow(db, { deliveryId, userId }) {
  if (!deliveryId || !userId) return null;

  const [delivery] = await db
    .select()
    .from(automationEventDeliveries)
    .where(
      and(
        eq(automationEventDeliveries.id, deliveryId),
        eq(automationEventDeliveries.userId, userId),
        eq(automationEventDeliveries.status, 'unsent')
      )
    )
    .limit(1);

  return delivery ?? null;
}

function normalizeNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
