import { createHash } from 'node:crypto';

import { getDb } from '../../db/client.js';
import {
  createDefaultMessageSendService,
  createDeterministicClientRequestId,
} from '../messages/service.js';
import { createPublEventCatalogRepository } from '../publEvents/repository.js';
import { resolvePublEventPayload } from '../publEvents/service.js';
import {
  CHANNELS,
  PROVIDERS,
  RELAY_ERROR_CODES,
  SEND_RESPONSE_STATES,
  SENDER_RESOURCE_TYPES,
} from '../relay/constants.js';
import { RelayError, RelayValidationError } from '../relay/errors.js';
import { createDefaultTemplateCatalogService } from '../templates/service.js';
import {
  createAutomationRepository,
  toAutomationDeliveryDto,
} from './repository.js';
import {
  decryptAutomationEventPayload,
  encryptAutomationEventPayload,
  hashTargetRef,
  maskPhoneNumber,
} from './payloadVault.js';

export const AUTOMATION_PROCESSING_STATUSES = Object.freeze({
  SENT: 'sent',
  UNSENT: 'unsent',
  IGNORED_NO_RULE: 'ignored_no_rule',
  UNKNOWN_CHANNEL_CODE: 'unknown_channel_code',
  INVALID_PAYLOAD: 'invalid_payload',
  DUPLICATE: 'duplicate',
  FAILED: 'failed',
});

export const AUTOMATION_UNSENT_REASON_CODES = Object.freeze({
  CONDITION_MISMATCH: 'condition_mismatch',
  COOLDOWN_BLOCKED: 'cooldown_blocked',
  DISPATCH_VALIDATION_FAILED: 'dispatch_validation_failed',
  DISPATCH_FAILED: 'dispatch_failed',
  MISSING_REGISTRATION: 'missing_registration',
  MISSING_RULE: 'missing_rule',
  MISSING_TARGET_PHONE: 'missing_target_phone',
  MISSING_SENDER_RESOURCE: 'missing_sender_resource',
  MISSING_TEMPLATE: 'missing_template',
  MISSING_TEMPLATE_CODE: 'missing_template_code',
  PAYLOAD_VALIDATION_FAILED: 'payload_validation_failed',
  PROVIDER_REJECTED: 'provider_rejected',
  PROVIDER_UNKNOWN: 'provider_unknown',
  UNSUPPORTED_SEND_CHANNEL: 'unsupported_send_channel',
});

export const AUTOMATION_RULE_VALIDATION_REASON_CODES = Object.freeze({
  ARCHIVED_RULE: 'archived_rule',
  CONDITION_INVALID: 'condition_invalid',
  COOLDOWN_INVALID: 'cooldown_invalid',
  ENABLE_CONFLICT: 'enable_conflict',
  EVENT_DEFINITION_UNAVAILABLE: 'event_definition_unavailable',
  NAME_REQUIRED: 'name_required',
  RECIPIENT_MAPPING_INVALID: 'recipient_mapping_invalid',
  SENDER_RESOURCE_INCOMPATIBLE: 'sender_resource_incompatible',
  SEND_CHANNEL_UNSUPPORTED: 'send_channel_unsupported',
  TEMPLATE_INCOMPATIBLE: 'template_incompatible',
  TEMPLATE_UNAVAILABLE: 'template_unavailable',
  VARIABLE_MAPPING_INVALID: 'variable_mapping_invalid',
});

export const AUTOMATION_EVENT_PAYLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ACTIVE_RESOURCE_STATUS = 'active';
const ACTIVE_LINK_STATUS = 'active';
const SEND_ROLES = new Set(['owner', 'sender']);
const SUPPORTED_SEND_CHANNELS = new Set(Object.values(CHANNELS));
const AUTOMATION_RULE_STATUSES = Object.freeze({
  ARCHIVED: 'archived',
  DISABLED: 'disabled',
  ENABLED: 'enabled',
});
const AUTOMATION_RULE_CONDITION_OPERATORS = new Set([
  'equals',
  'not_equals',
  'exists',
  'contains',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
]);
const SEND_CHANNEL_RESOURCE_TYPES = Object.freeze({
  [CHANNELS.ALIMTALK]: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
  [CHANNELS.BRAND_MESSAGE]: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
  [CHANNELS.LMS]: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
  [CHANNELS.MMS]: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
  [CHANNELS.SMS]: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
});

export function createDefaultAutomationService(options = {}) {
  const db = getDb();

  return createAutomationService({
    automationRepository: createAutomationRepository(db),
    messageSendService: createDefaultMessageSendService(),
    publEventRepository: createPublEventCatalogRepository(db),
    templateService: createDefaultTemplateCatalogService(),
    ...options,
  });
}

export async function processPublAutomationEvent(envelope, options = {}) {
  return createDefaultAutomationService(options).processPublAutomationEvent(envelope);
}

export function createAutomationService({
  automationRepository,
  messageSendService = null,
  publEventRepository,
  now = () => new Date(),
  payloadTtlMs = AUTOMATION_EVENT_PAYLOAD_TTL_MS,
  payloadVaultOptions = {},
  templateService = null,
} = {}) {
  return {
    async listAutomationRules({ actorUserId, query = {} } = {}) {
      const rules = await automationRepository.listAutomationRulesForUser({
        userId: actorUserId,
        status: normalizeNonEmptyString(query.status),
        limit: parseAutomationRuleLimit(query.limit),
        offset: parseAutomationRuleOffset(query.offset),
      });

      return {
        rules: rules.map(toAutomationRuleManagementDto),
      };
    },

    async getAutomationRule({ actorUserId, ruleId } = {}) {
      const rule = await requireAutomationRuleForActor({ actorUserId, automationRepository, ruleId });
      const revisions = typeof automationRepository.listAutomationRuleRevisions === 'function'
        ? await automationRepository.listAutomationRuleRevisions({
          automationRuleId: rule.id,
          userId: actorUserId,
        })
        : [];

      return {
        rule: toAutomationRuleManagementDto(rule),
        revisions,
      };
    },

    async createAutomationRule({ actorUserId, payload = {} } = {}) {
      const normalized = await normalizeAutomationRuleManagementConfig({
        actorUserId,
        automationRepository,
        payload,
        templateService,
      });
      const validation = await evaluateAutomationRuleConfig({
        actorUserId,
        automationRepository,
        config: normalized.config,
        templateService,
      });

      assertAutomationRuleValidationSuccess(validation);

      const createdRule = await automationRepository.createAutomationRule({
        now: now(),
        values: {
          ...normalized.values,
          userId: actorUserId,
          status: AUTOMATION_RULE_STATUSES.DISABLED,
          enabledAt: null,
          archivedAt: null,
        },
      });

      await writeAutomationRuleRevision({
        action: 'create',
        actorUserId,
        automationRepository,
        config: normalized.config,
        context: normalized.context,
        rule: createdRule,
        statusBefore: null,
        statusAfter: createdRule.status,
        now,
      });

      return {
        rule: toAutomationRuleManagementDto(createdRule),
      };
    },

    async updateAutomationRule({ actorUserId, ruleId, payload = {} } = {}) {
      const existingRule = await requireAutomationRuleForActor({ actorUserId, automationRepository, ruleId });
      assertAutomationRuleEditable(existingRule);

      const normalized = await normalizeAutomationRuleManagementConfig({
        actorUserId,
        automationRepository,
        existingRule,
        payload,
        templateService,
      });
      const validation = await evaluateAutomationRuleConfig({
        actorUserId,
        automationRepository,
        config: normalized.config,
        templateService,
      });

      assertAutomationRuleValidationSuccess(validation);

      const updatedRule = await automationRepository.updateAutomationRule({
        ruleId,
        userId: actorUserId,
        now: now(),
        values: normalized.values,
      });

      await writeAutomationRuleRevision({
        action: 'update',
        actorUserId,
        automationRepository,
        config: normalized.config,
        context: normalized.context,
        rule: updatedRule,
        statusBefore: existingRule.status,
        statusAfter: updatedRule.status,
        now,
      });

      return {
        rule: toAutomationRuleManagementDto(updatedRule),
      };
    },

    async dryRunAutomationRule({
      actorUserId,
      ruleId = null,
      payload = {},
      sampleEnvelope = {},
    } = {}) {
      const existingRule = ruleId
        ? await requireAutomationRuleForActor({ actorUserId, automationRepository, ruleId })
        : null;
      const normalized = await normalizeAutomationRuleManagementConfig({
        actorUserId,
        automationRepository,
        existingRule,
        payload,
        templateService,
      });
      const configValidation = await evaluateAutomationRuleConfig({
        actorUserId,
        automationRepository,
        config: normalized.config,
        templateService,
      });
      const envelope = normalizePublAutomationEnvelope(sampleEnvelope);

      if (!envelope.ok) {
        return createAutomationDryRunResult({
          blockers: [createDryRunBlocker('invalid_sample', envelope.reasonMessage)],
          configValidation,
          ok: false,
        });
      }

      const envelopeBlockers = validateDryRunEnvelope({
        envelope,
        eventDefinition: normalized.context.eventDefinition,
      });
      const runtimePayload = createRuntimePayload(envelope);
      const resolution = resolvePublEventPayload(normalized.context.eventDefinition, runtimePayload);
      const recipient = resolveDryRunRecipient({
        config: normalized.config,
        runtimePayload,
        variables: resolution.variables,
      });
      const conditionResult = evaluateAutomationConditionResult({
        condition: normalized.config.condition,
        variables: resolution.variables,
      });
      const cooldownResult = await evaluateAutomationDryRunCooldown({
        automationRepository,
        config: normalized.config,
        now: now(),
        recipient,
        ruleId: existingRule?.id ?? null,
        targetRefHash: recipient.value ? hashTargetRef(recipient.value, payloadVaultOptions) : null,
      });
      const templateVariables = await evaluateDryRunTemplateVariables({
        actorUserId,
        config: normalized.config,
        templateService,
        variables: resolution.variables,
      });
      const blockers = [
        ...configValidation.reasonCodes.map((code) => createDryRunBlocker(code, dryRunMessageForCode(code))),
        ...envelopeBlockers,
        ...resolution.validationErrors.map((error) => createDryRunBlocker(
          'event_payload_validation_failed',
          `Event variable ${error.alias} is not available.`
        )),
        ...(recipient.value ? [] : [createDryRunBlocker('missing_recipient', 'Recipient mapping did not resolve.')]),
        ...(conditionResult.passed ? [] : [createDryRunBlocker('condition_failed', 'Automation conditions did not pass.')]),
        ...(cooldownResult.eligible ? [] : [createDryRunBlocker('cooldown_blocked', 'Cooldown policy blocks this send.')]),
        ...templateVariables.missing.map((key) => createDryRunBlocker(
          'template_variable_missing',
          `Template variable ${key} is not resolved.`
        )),
      ];

      return createAutomationDryRunResult({
        blockers,
        conditionResult,
        configValidation,
        cooldownResult,
        maskedRecipient: recipient.masked,
        ok: blockers.length === 0,
        templateVariables,
        variables: createDryRunVariableDtos(resolution.variables),
      });
    },

    async enableAutomationRule({ actorUserId, ruleId } = {}) {
      const existingRule = await requireAutomationRuleForActor({ actorUserId, automationRepository, ruleId });
      assertAutomationRuleEditable(existingRule);
      const normalized = await normalizeAutomationRuleManagementConfig({
        actorUserId,
        automationRepository,
        existingRule,
        payload: {},
        templateService,
      });
      const validation = await evaluateAutomationRuleConfig({
        actorUserId,
        automationRepository,
        config: normalized.config,
        templateService,
      });

      assertAutomationRuleValidationSuccess(validation);

      const result = await automationRepository.enableAutomationRule({
        ruleId,
        userId: actorUserId,
        now: now(),
      });

      if (result?.conflict) {
        throw automationRuleValidationError('Another rule is already enabled for this channel event.', {
          reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.ENABLE_CONFLICT,
        });
      }

      if (!result?.rule) {
        throw automationRuleUnavailableError();
      }

      const context = await resolveExistingAutomationRuleContext({
        actorUserId,
        automationRepository,
        rule: result.rule,
      });

      await writeAutomationRuleRevision({
        action: 'enable',
        actorUserId,
        automationRepository,
        config: normalized.config,
        context,
        rule: result.rule,
        statusBefore: existingRule.status,
        statusAfter: result.rule.status,
        now,
      });

      return {
        rule: toAutomationRuleManagementDto(result.rule),
      };
    },

    async disableAutomationRule({ actorUserId, ruleId } = {}) {
      const existingRule = await requireAutomationRuleForActor({ actorUserId, automationRepository, ruleId });
      assertAutomationRuleEditable(existingRule);

      const disabledRule = await automationRepository.disableAutomationRule({
        ruleId,
        userId: actorUserId,
        now: now(),
      });
      const context = await resolveExistingAutomationRuleContext({
        actorUserId,
        automationRepository,
        rule: disabledRule,
      });

      await writeAutomationRuleRevision({
        action: 'disable',
        actorUserId,
        automationRepository,
        context,
        rule: disabledRule,
        statusBefore: existingRule.status,
        statusAfter: disabledRule.status,
        now,
      });

      return {
        rule: toAutomationRuleManagementDto(disabledRule),
      };
    },

    async archiveAutomationRule({ actorUserId, ruleId } = {}) {
      const existingRule = await requireAutomationRuleForActor({ actorUserId, automationRepository, ruleId });
      const archivedRule = await automationRepository.archiveAutomationRule({
        ruleId,
        userId: actorUserId,
        now: now(),
      });
      const context = await resolveExistingAutomationRuleContext({
        actorUserId,
        automationRepository,
        rule: archivedRule,
      });

      await writeAutomationRuleRevision({
        action: 'archive',
        actorUserId,
        automationRepository,
        context,
        rule: archivedRule,
        statusBefore: existingRule.status,
        statusAfter: archivedRule.status,
        now,
      });

      return {
        rule: toAutomationRuleManagementDto(archivedRule),
      };
    },

    async listUnsentDeliveries({ actorUserId, query = {} } = {}) {
      const limit = parseUnsentLimit(query.limit);
      const summaries = typeof automationRepository.listUnsentDeliverySummariesForUser === 'function'
        ? await automationRepository.listUnsentDeliverySummariesForUser({ userId: actorUserId, limit })
        : (await automationRepository.listUnsentDeliveriesForUser({ userId: actorUserId, limit }))
          .map((delivery) => ({ delivery }));

      return {
        deliveries: summaries.map(toAutomationConsoleDeliveryDto),
      };
    },

    async sendUnsentDelivery({ actorUserId, deliveryId } = {}) {
      return retryUnsentAutomationDelivery({
        actorUserId,
        automationRepository,
        deliveryId,
        messageSendService,
        now,
        payloadVaultOptions,
        publEventRepository,
        templateService,
      });
    },

    async dismissUnsentDelivery({ actorUserId, deliveryId } = {}) {
      const delivery = await automationRepository.findUnsentDeliveryForUser({ deliveryId, userId: actorUserId });

      if (!delivery) {
        throw automationDeliveryUnavailableError();
      }

      const dismissedDelivery = await automationRepository.markDeliveryDismissed({
        deliveryId: delivery.id,
        now: now(),
      });

      return {
        delivery: toAutomationConsoleDeliveryDto({ delivery: dismissedDelivery }),
      };
    },

    async processPublAutomationEvent(envelopeInput = {}) {
      const acceptedAt = now();
      const envelope = normalizePublAutomationEnvelope(envelopeInput);

      if (!envelope.ok) {
        return createServiceResult({
          acceptedAt,
          ok: false,
          reasonCode: AUTOMATION_PROCESSING_STATUSES.INVALID_PAYLOAD,
          reasonMessage: envelope.reasonMessage,
          status: AUTOMATION_PROCESSING_STATUSES.INVALID_PAYLOAD,
        });
      }

      const channelMapping = await automationRepository.findActiveChannelMappingByCode(envelope.channelCode);

      if (!channelMapping) {
        return createServiceResult({
          acceptedAt,
          envelope,
          ok: false,
          reasonCode: AUTOMATION_PROCESSING_STATUSES.UNKNOWN_CHANNEL_CODE,
          reasonMessage: 'No active channel mapping exists for the channel code.',
          status: AUTOMATION_PROCESSING_STATUSES.UNKNOWN_CHANNEL_CODE,
        });
      }

      const eventDefinition = await findPublEventDefinitionWithProps(publEventRepository, envelope.eventKey);

      if (!eventDefinition) {
        return createServiceResult({
          acceptedAt,
          envelope,
          ok: false,
          reasonCode: AUTOMATION_PROCESSING_STATUSES.INVALID_PAYLOAD,
          reasonMessage: 'No PUBL event definition exists for the event key.',
          status: AUTOMATION_PROCESSING_STATUSES.INVALID_PAYLOAD,
        });
      }

      const runtimePayload = createRuntimePayload(envelope);
      const resolution = resolvePublEventPayload(eventDefinition, runtimePayload);
      const activeRules = await automationRepository.listActiveRulesForUserEvent({
        userId: channelMapping.userId,
        eventDefinitionId: eventDefinition.id,
      });

      if (activeRules.length === 0) {
        return createServiceResult({
          acceptedAt,
          envelope,
          ok: true,
          reasonCode: AUTOMATION_PROCESSING_STATUSES.IGNORED_NO_RULE,
          reasonMessage: 'No active automation rule matched this event.',
          status: AUTOMATION_PROCESSING_STATUSES.IGNORED_NO_RULE,
        });
      }

      const ruleResults = [];

      for (const rule of activeRules) {
        const result = await processMatchedRule({
          acceptedAt,
          automationRepository,
          channelMapping,
          envelope,
          eventDefinition,
          messageSendService,
          payloadTtlMs,
          payloadVaultOptions,
          resolution,
          rule,
          runtimePayload,
          templateService,
        });

        ruleResults.push(result);
      }

      return createAggregateServiceResult({
        acceptedAt,
        envelope,
        ruleResults,
      });
    },
  };
}

async function requireAutomationRuleForActor({ actorUserId, automationRepository, ruleId }) {
  const rule = await automationRepository.findAutomationRuleForUser({
    ruleId,
    userId: actorUserId,
  });

  if (!rule) {
    throw automationRuleUnavailableError();
  }

  return rule;
}

function assertAutomationRuleEditable(rule) {
  if (rule?.status === AUTOMATION_RULE_STATUSES.ARCHIVED) {
    throw automationRuleValidationError('Archived automation rules cannot be changed.', {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.ARCHIVED_RULE,
    });
  }
}

async function normalizeAutomationRuleManagementConfig({
  actorUserId,
  automationRepository,
  existingRule = null,
  payload = {},
}) {
  if (!normalizeNonEmptyString(actorUserId)) {
    throw automationRuleUnavailableError();
  }

  const merged = mergeAutomationRulePayload(existingRule, payload);
  const name = normalizeNonEmptyString(merged.name);

  if (!name) {
    throw automationRuleValidationError('Automation rule name is required.', {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.NAME_REQUIRED,
    });
  }

  const sendChannel = normalizeSupportedSendChannel(merged.sendChannel);

  if (!sendChannel) {
    throw automationRuleValidationError('Unsupported automation send channel.', {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.SEND_CHANNEL_UNSUPPORTED,
    });
  }

  const eventDefinition = await automationRepository.findEventDefinitionById(merged.eventDefinitionId);

  if (!eventDefinition) {
    throw automationRuleValidationError('Automation requires an event definition.', {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.EVENT_DEFINITION_UNAVAILABLE,
    });
  }

  const eventAliases = getEventAliasSet(eventDefinition);
  const variableMapping = normalizeAutomationVariableMapping(merged.variableMapping, eventAliases);
  const recipientMapping = normalizeAutomationRecipientMapping(merged.recipientMapping, eventAliases);
  const condition = normalizeAutomationCondition(merged.condition, eventAliases);
  const cooldownPolicy = normalizeAutomationCooldownPolicy(merged.cooldownPolicy);
  const config = {
    condition,
    cooldownPolicy,
    eventDefinitionId: eventDefinition.id,
    name,
    recipientMapping,
    sendChannel,
    senderResourceId: normalizeNonEmptyString(merged.senderResourceId),
    templateCode: normalizeNonEmptyString(merged.templateCode),
    templateSource: normalizeNonEmptyString(merged.templateSource),
    templateSourceKey: normalizeNonEmptyString(merged.templateSourceKey),
    variableMapping,
  };

  if (!config.senderResourceId) {
    throw automationRuleValidationError('Automation requires a sender resource.', {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.SENDER_RESOURCE_INCOMPATIBLE,
    });
  }

  if (!config.templateCode) {
    throw automationRuleValidationError('Automation requires a template code.', {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.TEMPLATE_UNAVAILABLE,
    });
  }

  return {
    config,
    context: {
      eventDefinition,
    },
    values: {
      conditionJson: config.condition,
      cooldownPolicyJson: config.cooldownPolicy,
      eventDefinitionId: config.eventDefinitionId,
      name: config.name,
      recipientMappingJson: config.recipientMapping,
      sendChannel: config.sendChannel,
      senderResourceId: config.senderResourceId,
      templateCode: config.templateCode,
      templateSource: config.templateSource,
      templateSourceKey: config.templateSourceKey,
      variableMappingJson: config.variableMapping,
    },
  };
}

async function evaluateAutomationRuleConfig({
  actorUserId,
  automationRepository,
  config,
  templateService,
}) {
  const configHash = createAutomationRuleConfigHash(config);

  if (!(await hasCompatibleSenderResource({ actorUserId, automationRepository, config }))) {
    return createRuleValidationResult({
      configHash,
      reasonCodes: [AUTOMATION_RULE_VALIDATION_REASON_CODES.SENDER_RESOURCE_INCOMPATIBLE],
    });
  }

  const templateResolution = await resolveAutomationRuleValidationTemplate({
    actorUserId,
    config,
    templateService,
  });

  if (!templateResolution.template) {
    return createRuleValidationResult({
      configHash,
      reasonCodes: [templateResolution.reasonCode],
    });
  }

  const variableReason = validateAutomationTemplateVariables({
    config,
    template: templateResolution.template,
  });

  if (variableReason) {
    return createRuleValidationResult({
      configHash,
      reasonCodes: [variableReason],
    });
  }

  return createRuleValidationResult({
    configHash,
    reasonCodes: [],
  });
}

function assertAutomationRuleValidationSuccess(validation) {
  if (validation.success) return;

  throw automationRuleValidationError('Automation rule configuration is invalid.', {
    reasonCode: validation.reasonCodes[0],
    reasonCodes: validation.reasonCodes,
  });
}

async function hasCompatibleSenderResource({ actorUserId, automationRepository, config }) {
  if (typeof automationRepository.getUserSenderResource !== 'function') {
    return true;
  }

  const row = await automationRepository.getUserSenderResource({
    userId: actorUserId,
    senderResourceId: config.senderResourceId,
  });
  const requiredResourceType = SEND_CHANNEL_RESOURCE_TYPES[config.sendChannel];

  return (
    row?.link?.status === ACTIVE_LINK_STATUS &&
    SEND_ROLES.has(row.link.role) &&
    row?.resource?.status === ACTIVE_RESOURCE_STATUS &&
    row.resource.provider === PROVIDERS.NHN &&
    row.resource.type === requiredResourceType
  );
}

async function resolveAutomationRuleValidationTemplate({ actorUserId, config, templateService }) {
  if (!templateService || typeof templateService.getTemplate !== 'function') {
    return {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.TEMPLATE_UNAVAILABLE,
      template: null,
    };
  }

  try {
    const result = await templateService.getTemplate({
      actorUserId,
      channel: getTemplateLookupChannel(config.sendChannel),
      templateCode: config.templateCode,
      query: {
        senderResourceId: config.senderResourceId,
        source: config.templateSource,
        sourceKey: config.templateSourceKey,
      },
    });
    const template = result?.template ?? null;

    if (!template || normalizeNonEmptyString(template.templateCode) !== config.templateCode) {
      return {
        reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.TEMPLATE_UNAVAILABLE,
        template: null,
      };
    }

    if (
      normalizeNonEmptyString(template.channel) &&
      getTemplateLookupChannel(template.channel) !== getTemplateLookupChannel(config.sendChannel)
    ) {
      return {
        reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.TEMPLATE_INCOMPATIBLE,
        template: null,
      };
    }

    if (isSmsSendChannel(config.sendChannel) && !normalizeNonEmptyString(template.body ?? template.content)) {
      return {
        reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.TEMPLATE_INCOMPATIBLE,
        template: null,
      };
    }

    return { template };
  } catch {
    return {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.TEMPLATE_UNAVAILABLE,
      template: null,
    };
  }
}

function validateAutomationTemplateVariables({ config, template }) {
  const requiredKeys = getTemplateRequiredVariableKeys(template);
  const allowedKeys = getTemplateVariableKeys(template, requiredKeys);
  const mappedKeys = new Set(Object.keys(config.variableMapping));

  for (const key of requiredKeys) {
    if (!mappedKeys.has(key)) {
      return AUTOMATION_RULE_VALIDATION_REASON_CODES.VARIABLE_MAPPING_INVALID;
    }
  }

  if (allowedKeys.size > 0) {
    for (const key of mappedKeys) {
      if (!allowedKeys.has(key)) {
        return AUTOMATION_RULE_VALIDATION_REASON_CODES.VARIABLE_MAPPING_INVALID;
      }
    }
  }

  return null;
}

function mergeAutomationRulePayload(existingRule, payload) {
  return {
    condition: pickRulePayloadValue(payload, existingRule, 'condition', 'conditionJson') ?? {},
    cooldownPolicy: pickRulePayloadValue(payload, existingRule, 'cooldownPolicy', 'cooldownPolicyJson') ?? {},
    eventDefinitionId: pickRulePayloadValue(payload, existingRule, 'eventDefinitionId'),
    name: pickRulePayloadValue(payload, existingRule, 'name'),
    recipientMapping: pickRulePayloadValue(payload, existingRule, 'recipientMapping', 'recipientMappingJson'),
    sendChannel: pickRulePayloadValue(payload, existingRule, 'sendChannel'),
    senderResourceId: pickRulePayloadValue(payload, existingRule, 'senderResourceId'),
    templateCode: pickRulePayloadValue(payload, existingRule, 'templateCode'),
    templateSource: pickRulePayloadValue(payload, existingRule, 'templateSource'),
    templateSourceKey: pickRulePayloadValue(payload, existingRule, 'templateSourceKey'),
    variableMapping: pickRulePayloadValue(payload, existingRule, 'variableMapping', 'variableMappingJson') ?? {},
  };
}

function pickRulePayloadValue(payload, existingRule, payloadKey, storedKey = payloadKey) {
  if (Object.hasOwn(payload, payloadKey)) return payload[payloadKey];
  if (Object.hasOwn(payload, storedKey)) return payload[storedKey];
  return existingRule?.[storedKey] ?? existingRule?.[payloadKey] ?? null;
}

function normalizeAutomationVariableMapping(value, eventAliases) {
  if (!isObjectRecord(value)) {
    throw automationRuleValidationError('Automation variable mapping must be an object.', {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.VARIABLE_MAPPING_INVALID,
    });
  }

  const mapping = {};

  for (const [templateKeyInput, mappingValue] of Object.entries(value)) {
    const templateKey = normalizeNonEmptyString(templateKeyInput);
    const alias = resolveVariableMappingKey(mappingValue);

    if (!templateKey || !alias || !eventAliases.has(alias)) {
      throw automationRuleValidationError('Automation variable mapping references an unknown alias.', {
        reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.VARIABLE_MAPPING_INVALID,
      });
    }

    mapping[templateKey] = alias;
  }

  return mapping;
}

function normalizeAutomationRecipientMapping(value, eventAliases) {
  if (!isObjectRecord(value) || value.type !== 'event_alias') {
    throw automationRuleValidationError('Automation recipient mapping must use an event alias.', {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.RECIPIENT_MAPPING_INVALID,
    });
  }

  const alias = normalizeNonEmptyString(value.alias);

  if (!alias || !eventAliases.has(alias)) {
    throw automationRuleValidationError('Automation recipient mapping references an unknown alias.', {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.RECIPIENT_MAPPING_INVALID,
    });
  }

  return {
    alias,
    type: 'event_alias',
  };
}

function normalizeAutomationCondition(value, eventAliases) {
  if (!value || Object.keys(value).length === 0) {
    return { all: [] };
  }

  if (!isObjectRecord(value) || !Array.isArray(value.all) || Object.keys(value).some((key) => key !== 'all')) {
    throw automationRuleValidationError('Automation conditions support only an all list.', {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.CONDITION_INVALID,
    });
  }

  return {
    all: value.all.map((clause) => normalizeAutomationConditionClause(clause, eventAliases)),
  };
}

function normalizeAutomationConditionClause(clause, eventAliases) {
  if (!isObjectRecord(clause)) {
    throw automationRuleValidationError('Automation condition clauses must be objects.', {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.CONDITION_INVALID,
    });
  }

  const alias = normalizeNonEmptyString(clause.alias);
  const operator = normalizeNonEmptyString(clause.operator);

  if (!alias || !eventAliases.has(alias) || !AUTOMATION_RULE_CONDITION_OPERATORS.has(operator)) {
    throw automationRuleValidationError('Automation condition clause is invalid.', {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.CONDITION_INVALID,
    });
  }

  if (operator === 'exists') {
    return { alias, operator };
  }

  if (!isSafeConditionOperand(clause.value, operator)) {
    throw automationRuleValidationError('Automation condition value is invalid.', {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.CONDITION_INVALID,
    });
  }

  return {
    alias,
    operator,
    value: clause.value,
  };
}

function normalizeAutomationCooldownPolicy(value) {
  if (!value || Object.keys(value).length === 0) {
    return { enabled: false };
  }

  if (!isObjectRecord(value) || typeof value.enabled !== 'boolean') {
    throw automationRuleValidationError('Automation cooldown policy is invalid.', {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.COOLDOWN_INVALID,
    });
  }

  if (!value.enabled) {
    return { enabled: false };
  }

  const windowSeconds = Number(value.windowSeconds);

  if (!Number.isInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 2_592_000) {
    throw automationRuleValidationError('Automation cooldown window is invalid.', {
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.COOLDOWN_INVALID,
    });
  }

  return {
    enabled: true,
    windowSeconds,
  };
}

function isSafeConditionOperand(value, operator) {
  if (operator === 'in') {
    return (
      Array.isArray(value) &&
      value.length <= 50 &&
      value.every((item) => isSafeConditionLiteral(item))
    );
  }

  return isSafeConditionLiteral(value);
}

function isSafeConditionLiteral(value) {
  if (typeof value === 'string') {
    return value.length <= 200 && !looksLikePhoneNumber(value);
  }

  return typeof value === 'number' || typeof value === 'boolean' || value === null;
}

function looksLikePhoneNumber(value) {
  return String(value).replace(/\D/g, '').length >= 8;
}

function getEventAliasSet(eventDefinition) {
  return new Set(
    (eventDefinition.props ?? [])
      .map((prop) => normalizeNonEmptyString(prop.alias ?? prop.rawPath))
      .filter(Boolean)
  );
}

function getTemplateRequiredVariableKeys(template) {
  return new Set(
    (template.requiredVariables ?? [])
      .map(normalizeNonEmptyString)
      .filter(Boolean)
  );
}

function getTemplateVariableKeys(template, requiredKeys) {
  const keys = new Set(requiredKeys);

  for (const variable of template.variables ?? []) {
    const key = normalizeNonEmptyString(variable?.key ?? variable?.name);
    if (key) keys.add(key);
  }

  return keys;
}

function createRuleValidationResult({ configHash, reasonCodes }) {
  return {
    configHash,
    reasonCodes,
    success: reasonCodes.length === 0,
  };
}

function validateDryRunEnvelope({ envelope, eventDefinition }) {
  const blockers = [];

  if (envelope.eventKey !== eventDefinition.eventKey) {
    blockers.push(createDryRunBlocker('event_definition_mismatch', 'Sample event key does not match this rule.'));
  }

  return blockers;
}

function resolveDryRunRecipient({ config, runtimePayload, variables }) {
  const alias = config.recipientMapping?.alias;
  const value = normalizePhoneNumber(variables[alias]) || normalizePhoneNumber(runtimePayload[alias]);

  return {
    masked: value ? maskPhoneNumber(value) : null,
    value,
  };
}

function evaluateAutomationConditionResult({ condition, variables }) {
  const clauses = Array.isArray(condition?.all) ? condition.all : [];
  const clauseResults = clauses.map((clause) => {
    const actualValue = variables[clause.alias];
    const passed = evaluateAutomationConditionClause({ actualValue, clause });

    return {
      alias: clause.alias,
      operator: clause.operator,
      passed,
      valuePresent: actualValue !== undefined && actualValue !== null && actualValue !== '',
    };
  });

  return {
    clauses: clauseResults,
    passed: clauseResults.every((clause) => clause.passed),
  };
}

function evaluateAutomationConditionClause({ actualValue, clause }) {
  switch (clause.operator) {
    case 'exists':
      return actualValue !== undefined && actualValue !== null && actualValue !== '';
    case 'equals':
      return String(actualValue ?? '') === String(clause.value ?? '');
    case 'not_equals':
      return String(actualValue ?? '') !== String(clause.value ?? '');
    case 'contains':
      return String(actualValue ?? '').includes(String(clause.value ?? ''));
    case 'gt':
      return Number(actualValue) > Number(clause.value);
    case 'gte':
      return Number(actualValue) >= Number(clause.value);
    case 'lt':
      return Number(actualValue) < Number(clause.value);
    case 'lte':
      return Number(actualValue) <= Number(clause.value);
    case 'in':
      return Array.isArray(clause.value) && clause.value.map(String).includes(String(actualValue ?? ''));
    default:
      return false;
  }
}

async function evaluateAutomationDryRunCooldown({
  automationRepository,
  config,
  now,
  recipient,
  ruleId,
  targetRefHash,
}) {
  if (!config.cooldownPolicy?.enabled) {
    return {
      eligible: true,
      enabled: false,
    };
  }

  if (!recipient.value || !targetRefHash) {
    return {
      eligible: false,
      enabled: true,
      reasonCode: 'missing_target_hash',
      windowSeconds: config.cooldownPolicy.windowSeconds,
    };
  }

  const since = new Date(now.getTime() - config.cooldownPolicy.windowSeconds * 1000);
  const recentDelivery = typeof automationRepository.findRecentDeliveryForCooldown === 'function'
    ? await automationRepository.findRecentDeliveryForCooldown({
      automationRuleId: ruleId,
      since,
      targetRefHash,
    })
    : null;

  return {
    eligible: !recentDelivery,
    enabled: true,
    lastDeliveryAt: recentDelivery ? serializeDateValue(recentDelivery.createdAt) : null,
    reasonCode: recentDelivery ? 'recent_delivery_found' : null,
    windowSeconds: config.cooldownPolicy.windowSeconds,
  };
}

async function evaluateDryRunTemplateVariables({ actorUserId, config, templateService, variables }) {
  const templateResolution = await resolveAutomationRuleValidationTemplate({
    actorUserId,
    config,
    templateService,
  });
  const required = templateResolution.template
    ? Array.from(getTemplateRequiredVariableKeys(templateResolution.template))
    : [];
  const mapped = required.filter((key) => normalizeNonEmptyString(config.variableMapping[key]));
  const missing = mapped.filter((key) => {
    const alias = config.variableMapping[key];
    const value = variables[alias];
    return value === undefined || value === null || value === '';
  });

  return {
    mapped,
    missing,
    required,
  };
}

function createDryRunVariableDtos(variables) {
  return Object.entries(variables)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({
      key,
      presence: value !== undefined && value !== null && value !== '',
      preview: createSafeVariablePreview(value),
      type: dryRunVariableType(value),
    }));
}

function createSafeVariablePreview(value) {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'string' && normalizePhoneNumber(value)) {
    return maskPhoneNumber(value);
  }

  if (typeof value === 'string') return '[present]';
  if (typeof value === 'number') return '[number]';
  if (typeof value === 'boolean') return value ? '[true]' : '[false]';
  if (Array.isArray(value)) return `[array:${value.length}]`;
  if (typeof value === 'object') return '[object]';
  return '[present]';
}

function dryRunVariableType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function createAutomationDryRunResult({
  blockers,
  conditionResult = { clauses: [], passed: false },
  configValidation,
  cooldownResult = { eligible: true, enabled: false },
  maskedRecipient = null,
  ok,
  templateVariables = { mapped: [], missing: [], required: [] },
  variables = [],
}) {
  return {
    blockers,
    conditionResult,
    configHash: configValidation?.configHash ?? null,
    cooldownResult,
    maskedRecipient,
    ok,
    templateVariables,
    variables,
    wouldSend: ok && blockers.length === 0,
  };
}

function createDryRunBlocker(code, message) {
  return { code, message };
}

function dryRunMessageForCode(code) {
  switch (code) {
    case AUTOMATION_RULE_VALIDATION_REASON_CODES.SENDER_RESOURCE_INCOMPATIBLE:
      return 'Sender resource is not compatible with this send channel.';
    case AUTOMATION_RULE_VALIDATION_REASON_CODES.TEMPLATE_UNAVAILABLE:
      return 'Template is not available for this sender resource.';
    case AUTOMATION_RULE_VALIDATION_REASON_CODES.TEMPLATE_INCOMPATIBLE:
      return 'Template is not compatible with this send channel.';
    case AUTOMATION_RULE_VALIDATION_REASON_CODES.VARIABLE_MAPPING_INVALID:
      return 'Template variable mapping is incomplete.';
    default:
      return 'Automation rule configuration is not ready.';
  }
}

async function resolveExistingAutomationRuleContext({ actorUserId, automationRepository, rule }) {
  return {
    eventDefinition: await automationRepository.findEventDefinitionById(rule.eventDefinitionId),
  };
}

async function writeAutomationRuleRevision({
  action,
  actorUserId,
  automationRepository,
  config = null,
  context = {},
  rule,
  statusBefore,
  statusAfter,
  now,
}) {
  if (typeof automationRepository.createAutomationRuleRevision !== 'function' || !rule) return;

  await automationRepository.createAutomationRuleRevision({
    now: now(),
    values: {
      action,
      actorUserId,
      automationRuleId: rule.id,
      configSnapshotJson: createAutomationRuleRevisionConfigSnapshot({
        config,
        context,
        rule,
      }),
      statusAfter,
      statusBefore,
    },
  });
}

function createAutomationRuleRevisionConfigSnapshot({ config, context = {}, rule }) {
  const snapshotConfig = config ?? createAutomationRuleConfigFromRule(rule);

  return {
    condition: snapshotConfig.condition,
    configHash: createAutomationRuleConfigHash(snapshotConfig),
    cooldownPolicy: snapshotConfig.cooldownPolicy,
    eventDefinitionId: snapshotConfig.eventDefinitionId,
    eventKey: context.eventDefinition?.eventKey ?? rule.eventDefinition?.eventKey ?? null,
    recipientMapping: snapshotConfig.recipientMapping,
    sendChannel: snapshotConfig.sendChannel,
    senderResourceId: snapshotConfig.senderResourceId,
    templateCode: snapshotConfig.templateCode,
    templateSource: snapshotConfig.templateSource,
    templateSourceKey: snapshotConfig.templateSourceKey,
    variableMapping: snapshotConfig.variableMapping,
  };
}

function toAutomationRuleManagementDto(rule) {
  const configHash = createAutomationRuleConfigHashFromRule(rule);
  const safeRule = { ...(rule ?? {}) };

  delete safeRule.lastValidatedAt;
  delete safeRule.validatedConfigHash;
  delete safeRule.validationSnapshotJson;

  return {
    ...safeRule,
    configHash,
  };
}

function createAutomationRuleConfigHashFromRule(rule) {
  return createAutomationRuleConfigHash(createAutomationRuleConfigFromRule(rule));
}

function createAutomationRuleConfigFromRule(rule) {
  return {
    condition: rule.conditionJson ?? {},
    cooldownPolicy: rule.cooldownPolicyJson ?? {},
    eventDefinitionId: rule.eventDefinitionId,
    recipientMapping: rule.recipientMappingJson ?? {},
    sendChannel: rule.sendChannel,
    senderResourceId: rule.senderResourceId,
    templateCode: rule.templateCode,
    templateSource: rule.templateSource ?? null,
    templateSourceKey: rule.templateSourceKey ?? null,
    variableMapping: rule.variableMappingJson ?? {},
  };
}

function createAutomationRuleConfigHash(config) {
  return createHash('sha256')
    .update(stableJsonStringify({
      condition: config.condition ?? {},
      cooldownPolicy: config.cooldownPolicy ?? {},
      eventDefinitionId: config.eventDefinitionId,
      recipientMapping: config.recipientMapping ?? {},
      sendChannel: config.sendChannel,
      senderResourceId: config.senderResourceId,
      templateCode: config.templateCode,
      templateSource: config.templateSource ?? null,
      templateSourceKey: config.templateSourceKey ?? null,
      variableMapping: config.variableMapping ?? {},
    }))
    .digest('hex');
}

function stableJsonStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJsonStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function parseAutomationRuleLimit(value) {
  if (value === undefined || value === null || value === '') return 100;

  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new RelayValidationError('limit must be an integer between 1 and 200.');
  }

  return limit;
}

function parseAutomationRuleOffset(value) {
  if (value === undefined || value === null || value === '') return 0;

  const offset = Number(value);

  if (!Number.isInteger(offset) || offset < 0) {
    throw new RelayValidationError('offset must be a positive integer.');
  }

  return offset;
}

function automationRuleUnavailableError() {
  return new RelayError({
    code: RELAY_ERROR_CODES.FORBIDDEN,
    message: 'Automation rule was not found or is not available.',
    retryable: false,
    status: 403,
  });
}

function automationRuleValidationError(message, { reasonCode, reasonCodes } = {}) {
  const error = new RelayValidationError(message);
  error.reasonCode = reasonCode ?? null;
  error.reasonCodes = reasonCodes ?? (reasonCode ? [reasonCode] : []);
  return error;
}

async function processMatchedRule({
  acceptedAt,
  automationRepository,
  channelMapping,
  envelope,
  eventDefinition,
  messageSendService,
  payloadTtlMs,
  payloadVaultOptions,
  resolution,
  rule,
  runtimePayload,
  templateService,
}) {
  const duplicate = await automationRepository.findDuplicateDelivery({
    automationRuleId: rule.id,
    channelMappingId: channelMapping.id,
    externalEventId: envelope.externalEventId,
  });

  if (duplicate) {
    return {
      duplicate: true,
      delivery: toAutomationDeliveryDto(duplicate),
      deliveryStatus: duplicate.status,
      status: AUTOMATION_PROCESSING_STATUSES.DUPLICATE,
    };
  }

  const targetPhoneNumber = resolveTargetPhoneNumber({
    recipientMapping: rule.recipientMappingJson,
    runtimePayload,
    variables: resolution.variables,
  });
  const targetRefHash = targetPhoneNumber ? hashTargetRef(targetPhoneNumber, payloadVaultOptions) : null;
  const reason = await resolvePreDispatchReason({
    acceptedAt,
    automationRepository,
    channelMapping,
    resolution,
    rule,
    targetPhoneNumber,
    targetRefHash,
  });
  const deliveryStatus = reason ? 'unsent' : 'processing';
  const createdDelivery = await automationRepository.createDelivery({
    userId: channelMapping.userId,
    channelMappingId: channelMapping.id,
    automationRuleId: rule.id,
    eventDefinitionId: eventDefinition.id,
    externalEventId: envelope.externalEventId,
    eventKey: envelope.eventKey,
    channelCode: envelope.channelCode,
    sendChannel: normalizeSupportedSendChannel(rule.sendChannel) || CHANNELS.ALIMTALK,
    status: deliveryStatus,
    reasonCode: reason?.code ?? null,
    reasonMessage: reason?.message ?? null,
    targetPhoneMasked: targetPhoneNumber ? maskPhoneNumber(targetPhoneNumber) : null,
    targetRefHash,
    encryptedPayload: encryptAutomationEventPayload(runtimePayload, payloadVaultOptions),
    payloadExpiresAt: new Date(acceptedAt.getTime() + payloadTtlMs),
    receivedAt: acceptedAt,
    lastAttemptAt: deliveryStatus === 'unsent' ? acceptedAt : null,
  }, { now: acceptedAt });

  if (!reason && messageSendService && templateService) {
    return dispatchMatchedRule({
      acceptedAt,
      automationRepository,
      channelMapping,
      delivery: createdDelivery,
      envelope,
      messageSendService,
      resolution,
      rule,
      targetPhoneNumber,
      templateService,
    });
  }

  return {
    duplicate: false,
    delivery: toAutomationDeliveryDto(createdDelivery),
    deliveryStatus,
    reasonCode: reason?.code ?? null,
    reasonMessage: reason?.message ?? null,
    status: AUTOMATION_PROCESSING_STATUSES.UNSENT,
  };
}

async function retryUnsentAutomationDelivery({
  actorUserId,
  automationRepository,
  deliveryId,
  messageSendService,
  now,
  payloadVaultOptions,
  publEventRepository,
  templateService,
}) {
  const acceptedAt = now();
  const detail = await automationRepository.findUnsentDeliveryWithEncryptedPayloadForUser({
    deliveryId,
    userId: actorUserId,
  });

  if (!detail?.delivery) {
    throw automationDeliveryUnavailableError();
  }

  const { delivery, encryptedPayload } = detail;
  assertAutomationPayloadCanBeRetried({ delivery, encryptedPayload, now: acceptedAt });

  if (!messageSendService || !templateService) {
    throw automationDispatchConfigError();
  }

  const runtimePayload = decryptRetryPayload(encryptedPayload, payloadVaultOptions);
  const envelope = {
    eventKey: delivery.eventKey,
    externalEventId: delivery.externalEventId,
    channelCode: delivery.channelCode,
    ...(normalizeNonEmptyString(runtimePayload.occurredAt) ? { occurredAt: runtimePayload.occurredAt } : {}),
  };
  const channelMapping = await automationRepository.findActiveChannelMappingByCode(delivery.channelCode);

  if (
    !channelMapping ||
    channelMapping.id !== delivery.channelMappingId ||
    channelMapping.userId !== actorUserId
  ) {
    return createConsoleRetryResponse(await markRetryDeliveryUnsent({
      acceptedAt,
      automationRepository,
      delivery,
      reason: {
        code: AUTOMATION_UNSENT_REASON_CODES.MISSING_REGISTRATION,
        message: 'Automation dispatch requires an active channel mapping.',
      },
    }));
  }

  const eventDefinition = await findPublEventDefinitionWithProps(publEventRepository, delivery.eventKey);

  if (!eventDefinition || eventDefinition.id !== delivery.eventDefinitionId) {
    return createConsoleRetryResponse(await markRetryDeliveryUnsent({
      acceptedAt,
      automationRepository,
      delivery,
      reason: {
        code: AUTOMATION_UNSENT_REASON_CODES.PAYLOAD_VALIDATION_FAILED,
        message: 'The event definition required for this automation delivery is not available.',
      },
    }));
  }

  const resolution = resolvePublEventPayload(eventDefinition, runtimePayload);
  const activeRules = await automationRepository.listActiveRulesForUserEvent({
    userId: channelMapping.userId,
    eventDefinitionId: eventDefinition.id,
  });
  const rule = activeRules.find((candidate) => candidate.id === delivery.automationRuleId);

  if (!rule) {
    return createConsoleRetryResponse(await markRetryDeliveryUnsent({
      acceptedAt,
      automationRepository,
      delivery,
      reason: {
        code: AUTOMATION_UNSENT_REASON_CODES.MISSING_RULE,
        message: 'The automation rule for this delivery is not available.',
      },
    }));
  }

  const targetPhoneNumber = resolveTargetPhoneNumber({
    recipientMapping: rule.recipientMappingJson,
    runtimePayload,
    variables: resolution.variables,
  });
  const targetRefHash = targetPhoneNumber ? hashTargetRef(targetPhoneNumber, payloadVaultOptions) : null;
  const preDispatchReason = await resolvePreDispatchReason({
    acceptedAt,
    automationRepository,
    channelMapping,
    excludeDeliveryId: delivery.id,
    resolution,
    rule,
    targetPhoneNumber,
    targetRefHash,
  });

  if (preDispatchReason) {
    return createConsoleRetryResponse(await markRetryDeliveryUnsent({
      acceptedAt,
      automationRepository,
      delivery,
      reason: preDispatchReason,
    }));
  }

  return createConsoleRetryResponse(await dispatchMatchedRule({
    acceptedAt,
    automationRepository,
    channelMapping,
    delivery,
    envelope,
    messageSendService,
    resolution,
    rule,
    targetPhoneNumber,
    templateService,
  }));
}

async function dispatchMatchedRule({
  acceptedAt,
  automationRepository,
  channelMapping,
  delivery,
  envelope,
  messageSendService,
  resolution,
  rule,
  targetPhoneNumber,
  templateService,
}) {
  const sendChannel = normalizeSupportedSendChannel(rule.sendChannel) || CHANNELS.ALIMTALK;
  const templateResolution = await resolveAutomationTemplate({
    actorUserId: channelMapping.userId,
    rule,
    sendChannel,
    templateService,
  });

  if (templateResolution.reason) {
    const updatedDelivery = await automationRepository.markDeliveryUnsent({
      deliveryId: delivery.id,
      reasonCode: templateResolution.reason.code,
      reasonMessage: templateResolution.reason.message,
      now: acceptedAt,
    });

    return createRuleDispatchResult({
      delivery: updatedDelivery,
      deliveryStatus: 'unsent',
      reason: templateResolution.reason,
      status: AUTOMATION_PROCESSING_STATUSES.UNSENT,
    });
  }

  const sendPayload = buildAutomationSendPayload({
    delivery,
    rule,
    sendChannel,
    targetPhoneNumber,
    template: templateResolution.template,
    variables: resolution.variables,
  });
  const sourceMetadata = {
    sourceType: 'automation',
    sourceEventKey: envelope.eventKey,
    sourceExternalEventId: envelope.externalEventId,
    sourceChannelCode: envelope.channelCode,
    sourceAutomationRuleId: rule.id,
    sourceAutomationDeliveryId: delivery.id,
  };

  try {
    const sendResult = await sendAutomationMessage({
      actorUserId: channelMapping.userId,
      messageSendService,
      payload: sendPayload,
      sendChannel,
      sourceMetadata,
    });

    if (sendResult.state === SEND_RESPONSE_STATES.ACCEPTED_BY_PROVIDER) {
      const sentDelivery = await automationRepository.markDeliverySent({
        deliveryId: delivery.id,
        messageSendGroupId: sendResult.ledger?.groupId ?? null,
        now: acceptedAt,
      });
      const purgedDelivery = typeof automationRepository.markDeliveryPayloadPurged === 'function'
        ? await automationRepository.markDeliveryPayloadPurged({ deliveryId: delivery.id, now: acceptedAt })
        : sentDelivery;

      return createRuleDispatchResult({
        delivery: purgedDelivery ?? sentDelivery,
        deliveryStatus: 'sent',
        status: AUTOMATION_PROCESSING_STATUSES.SENT,
      });
    }

    const failedReason = providerResultReason(sendResult);
    const failedDelivery = await automationRepository.markDeliveryFailed({
      deliveryId: delivery.id,
      reasonCode: failedReason.code,
      reasonMessage: failedReason.message,
      now: acceptedAt,
    });

    return createRuleDispatchResult({
      delivery: failedDelivery,
      deliveryStatus: 'failed',
      reason: failedReason,
      status: AUTOMATION_PROCESSING_STATUSES.FAILED,
    });
  } catch (error) {
    const reason = errorDispatchReason(error);
    const markMethod = reason.failed ? automationRepository.markDeliveryFailed : automationRepository.markDeliveryUnsent;
    const updatedDelivery = await markMethod.call(automationRepository, {
      deliveryId: delivery.id,
      reasonCode: reason.code,
      reasonMessage: reason.message,
      now: acceptedAt,
    });

    return createRuleDispatchResult({
      delivery: updatedDelivery,
      deliveryStatus: reason.failed ? 'failed' : 'unsent',
      reason,
      status: reason.failed ? AUTOMATION_PROCESSING_STATUSES.FAILED : AUTOMATION_PROCESSING_STATUSES.UNSENT,
    });
  }
}

async function resolveAutomationTemplate({ actorUserId, rule, sendChannel, templateService }) {
  try {
    const result = await templateService.getTemplate({
      actorUserId,
      channel: getTemplateLookupChannel(sendChannel),
      templateCode: rule.templateCode,
      query: {
        senderResourceId: rule.senderResourceId,
        source: rule.templateSource,
        sourceKey: rule.templateSourceKey,
      },
    });
    const template = result?.template ?? null;

    if (!template || !normalizeNonEmptyString(template.templateCode ?? rule.templateCode)) {
      return {
        reason: {
          code: AUTOMATION_UNSENT_REASON_CODES.MISSING_TEMPLATE,
          message: 'The automation rule template is not available.',
        },
      };
    }

    if (isSmsSendChannel(sendChannel) && !normalizeNonEmptyString(template.body ?? template.content)) {
      return {
        reason: {
          code: AUTOMATION_UNSENT_REASON_CODES.MISSING_TEMPLATE,
          message: 'The SMS automation template does not include sendable content.',
        },
      };
    }

    return { template };
  } catch (error) {
    return {
      reason: templateLookupReason(error),
    };
  }
}

function buildAutomationSendPayload({
  delivery,
  rule,
  sendChannel,
  targetPhoneNumber,
  template,
  variables,
}) {
  const templateParameter = buildAutomationTemplateParameter({
    mapping: rule.variableMappingJson,
    variables,
  });
  const recipient = {
    recipientNo: targetPhoneNumber,
    ...(Object.keys(templateParameter).length ? { templateParameter } : {}),
  };
  const clientRequestId = resolveAutomationClientRequestId({
    delivery,
    rule,
    sendChannel,
  });
  const templateCode = normalizeNonEmptyString(template.templateCode) ?? normalizeNonEmptyString(rule.templateCode);
  const basePayload = {
    clientRequestId,
    recipients: [recipient],
    senderResourceId: rule.senderResourceId,
    templateCode,
  };

  if (isSmsSendChannel(sendChannel)) {
    const title = normalizeNonEmptyString(template.title);

    return {
      ...basePayload,
      body: normalizeNonEmptyString(template.body ?? template.content),
      channel: sendChannel,
      ...(title ? { title } : {}),
    };
  }

  if (sendChannel === CHANNELS.BRAND_MESSAGE) {
    return {
      ...basePayload,
      mode: 'template',
    };
  }

  return {
    ...basePayload,
    ...(Array.isArray(template.buttons) && template.buttons.length ? {
      recipients: [{ ...recipient, buttons: template.buttons }],
    } : {}),
    ...(Array.isArray(template.quickReplies) && template.quickReplies.length ? {
      recipients: [{
        ...recipient,
        ...(Array.isArray(template.buttons) && template.buttons.length ? { buttons: template.buttons } : {}),
        quickReplies: template.quickReplies,
      }],
    } : {}),
  };
}

function buildAutomationTemplateParameter({ mapping, variables }) {
  if (!isObjectRecord(mapping)) return {};

  const parameters = {};

  for (const [templateKey, mappingValue] of Object.entries(mapping)) {
    const normalizedTemplateKey = normalizeNonEmptyString(templateKey);
    const variableKey = resolveVariableMappingKey(mappingValue);

    if (!normalizedTemplateKey || !variableKey || variableKey === 'targetPhoneNumber') {
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(variables, variableKey)) {
      continue;
    }

    const value = normalizeTemplateParameterValue(variables[variableKey]);

    if (value !== null) {
      parameters[normalizedTemplateKey] = value;
    }
  }

  return parameters;
}

function resolveVariableMappingKey(mappingValue) {
  if (typeof mappingValue === 'string') {
    return normalizeNonEmptyString(mappingValue);
  }

  if (!isObjectRecord(mappingValue)) return null;

  return normalizeNonEmptyString(
    mappingValue.variable ??
    mappingValue.variableKey ??
    mappingValue.source ??
    mappingValue.sourceKey ??
    mappingValue.alias ??
    mappingValue.path
  );
}

function normalizeTemplateParameterValue(value) {
  if (value === undefined || value === null) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const joined = value.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
    return joined || null;
  }

  return JSON.stringify(value);
}

function resolveAutomationClientRequestId({ delivery, rule, sendChannel }) {
  const providedClientRequestId = normalizeNonEmptyString(
    rule.clientRequestId ??
    rule.payloadJson?.clientRequestId ??
    rule.sendPayloadJson?.clientRequestId
  );

  if (providedClientRequestId) {
    return providedClientRequestId;
  }

  return createDeterministicClientRequestId([
    'automation',
    delivery.id,
    rule.id,
    delivery.externalEventId,
    sendChannel,
  ]);
}

async function sendAutomationMessage({ actorUserId, messageSendService, payload, sendChannel, sourceMetadata }) {
  if (sendChannel === CHANNELS.ALIMTALK) {
    return messageSendService.sendAlimtalk({ actorUserId, payload, sourceMetadata });
  }

  if (sendChannel === CHANNELS.BRAND_MESSAGE) {
    return messageSendService.sendBrandMessage({ actorUserId, payload, sourceMetadata });
  }

  return messageSendService.sendSms({ actorUserId, payload, sourceMetadata });
}

function createRuleDispatchResult({ delivery, deliveryStatus, reason = null, status }) {
  return {
    duplicate: false,
    delivery: toAutomationDeliveryDto(delivery),
    deliveryStatus,
    reasonCode: reason?.code ?? null,
    reasonMessage: reason?.message ?? null,
    status,
  };
}

async function markRetryDeliveryUnsent({ acceptedAt, automationRepository, delivery, reason }) {
  const updatedDelivery = await automationRepository.markDeliveryUnsent({
    deliveryId: delivery.id,
    reasonCode: reason.code,
    reasonMessage: reason.message,
    now: acceptedAt,
  });

  return createRuleDispatchResult({
    delivery: updatedDelivery,
    deliveryStatus: 'unsent',
    reason,
    status: AUTOMATION_PROCESSING_STATUSES.UNSENT,
  });
}

function createConsoleRetryResponse(result) {
  return {
    delivery: toAutomationConsoleDeliveryDto({ delivery: result.delivery }),
    sendResult: {
      status: result.status,
      deliveryStatus: result.deliveryStatus,
      reasonCode: result.reasonCode ?? null,
      ...(result.reasonMessage ? { reasonMessage: result.reasonMessage } : {}),
    },
  };
}

function toAutomationConsoleDeliveryDto(summary = {}) {
  const delivery = summary.delivery ?? summary;

  return {
    id: delivery.id,
    status: delivery.status,
    eventKey: delivery.eventKey,
    eventDisplayName: summary.eventDisplayName ?? null,
    channelCode: delivery.channelCode,
    sendChannel: delivery.sendChannel,
    ruleName: summary.ruleName ?? null,
    maskedRecipient: delivery.targetPhoneMasked ?? null,
    reasonCode: delivery.reasonCode ?? null,
    reasonMessage: delivery.reasonMessage ?? null,
    receivedAt: serializeDateValue(delivery.receivedAt),
    payloadExpiresAt: serializeDateValue(delivery.payloadExpiresAt),
    createdAt: serializeDateValue(delivery.createdAt),
  };
}

function assertAutomationPayloadCanBeRetried({ delivery, encryptedPayload, now }) {
  const expiresAt = delivery.payloadExpiresAt ? new Date(delivery.payloadExpiresAt) : null;

  if (
    !encryptedPayload ||
    delivery.payloadPurgedAt ||
    !expiresAt ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= now.getTime()
  ) {
    throw expiredAutomationPayloadError();
  }
}

function decryptRetryPayload(encryptedPayload, payloadVaultOptions) {
  try {
    const payload = decryptAutomationEventPayload(encryptedPayload, payloadVaultOptions);
    return isObjectRecord(payload) ? payload : {};
  } catch (error) {
    throw new RelayError({
      code: RELAY_ERROR_CODES.RELAY_CONFIG_ERROR,
      message: 'Automation event data cannot be decrypted.',
      retryable: false,
      status: 500,
      cause: error,
    });
  }
}

function parseUnsentLimit(value) {
  if (value === undefined || value === null || value === '') {
    return 50;
  }

  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RelayValidationError('limit must be an integer between 1 and 100.');
  }

  return limit;
}

function serializeDateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function automationDeliveryUnavailableError() {
  return new RelayError({
    code: RELAY_ERROR_CODES.FORBIDDEN,
    message: 'Automation delivery was not found or is not available.',
    retryable: false,
    status: 403,
  });
}

function automationDispatchConfigError() {
  return new RelayError({
    code: RELAY_ERROR_CODES.RELAY_CONFIG_ERROR,
    message: 'Automation dispatch is not configured.',
    retryable: false,
    status: 500,
  });
}

function expiredAutomationPayloadError() {
  return new RelayError({
    code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
    message: 'Event data has expired. Ask the source system to send the event again.',
    retryable: false,
    status: 400,
    state: SEND_RESPONSE_STATES.LOCAL_VALIDATION_FAILED,
  });
}

function providerResultReason(sendResult) {
  if (sendResult.state === SEND_RESPONSE_STATES.UNKNOWN_AFTER_PROVIDER_CALL) {
    return {
      code: AUTOMATION_UNSENT_REASON_CODES.PROVIDER_UNKNOWN,
      message: 'The provider result is unknown for this automation delivery.',
    };
  }

  return {
    code: AUTOMATION_UNSENT_REASON_CODES.PROVIDER_REJECTED,
    message: 'The provider rejected this automation delivery.',
  };
}

function errorDispatchReason(error) {
  if (error instanceof RelayError) {
    if (error.code === RELAY_ERROR_CODES.FORBIDDEN) {
      return {
        code: AUTOMATION_UNSENT_REASON_CODES.MISSING_REGISTRATION,
        failed: false,
        message: 'Automation dispatch requires an active sender registration.',
      };
    }

    if (error.code === RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED) {
      return {
        code: AUTOMATION_UNSENT_REASON_CODES.DISPATCH_VALIDATION_FAILED,
        failed: false,
        message: 'Automation dispatch payload validation failed.',
      };
    }
  }

  return {
    code: AUTOMATION_UNSENT_REASON_CODES.DISPATCH_FAILED,
    failed: true,
    message: 'Automation dispatch failed before provider acceptance.',
  };
}

function templateLookupReason(error) {
  if (error instanceof RelayError && error.code === RELAY_ERROR_CODES.FORBIDDEN) {
    return {
      code: AUTOMATION_UNSENT_REASON_CODES.MISSING_REGISTRATION,
      message: 'Automation dispatch requires an active sender registration.',
    };
  }

  return {
    code: AUTOMATION_UNSENT_REASON_CODES.MISSING_TEMPLATE,
    message: 'The automation rule template is not available.',
  };
}

function getTemplateLookupChannel(sendChannel) {
  return isSmsSendChannel(sendChannel) ? CHANNELS.SMS : sendChannel;
}

function isSmsSendChannel(sendChannel) {
  return sendChannel === CHANNELS.SMS || sendChannel === CHANNELS.LMS || sendChannel === CHANNELS.MMS;
}

async function resolvePreDispatchReason({
  acceptedAt,
  automationRepository,
  channelMapping,
  excludeDeliveryId = null,
  resolution,
  rule,
  targetPhoneNumber,
  targetRefHash,
}) {
  if (!targetPhoneNumber) {
    return {
      code: AUTOMATION_UNSENT_REASON_CODES.MISSING_TARGET_PHONE,
      message: 'A target phone number is required for automation dispatch.',
    };
  }

  const sendChannel = normalizeNonEmptyString(rule.sendChannel);

  if (!SUPPORTED_SEND_CHANNELS.has(sendChannel)) {
    return {
      code: AUTOMATION_UNSENT_REASON_CODES.UNSUPPORTED_SEND_CHANNEL,
      message: 'The automation rule uses an unsupported send channel.',
    };
  }

  if (!(await hasUsableSenderResource({
    automationRepository,
    channelMapping,
    rule,
    sendChannel,
  }))) {
    return {
      code: AUTOMATION_UNSENT_REASON_CODES.MISSING_SENDER_RESOURCE,
      message: 'The automation rule requires an active sender resource.',
    };
  }

  if (!normalizeNonEmptyString(rule.templateCode)) {
    return {
      code: AUTOMATION_UNSENT_REASON_CODES.MISSING_TEMPLATE_CODE,
      message: 'The automation rule requires a provider template code.',
    };
  }

  if (resolution.validationErrors.length > 0) {
    return {
      code: AUTOMATION_UNSENT_REASON_CODES.PAYLOAD_VALIDATION_FAILED,
      message: 'The event payload is missing data required by the event catalog.',
    };
  }

  const conditionResult = evaluateAutomationConditionResult({
    condition: rule.conditionJson,
    variables: resolution.variables,
  });

  if (!conditionResult.passed) {
    return {
      code: AUTOMATION_UNSENT_REASON_CODES.CONDITION_MISMATCH,
      message: 'Automation conditions did not match this event.',
    };
  }

  const cooldownReason = await resolveCooldownPreDispatchReason({
    acceptedAt,
    automationRepository,
    excludeDeliveryId,
    rule,
    targetRefHash,
  });

  if (cooldownReason) {
    return cooldownReason;
  }

  return null;
}

async function resolveCooldownPreDispatchReason({
  acceptedAt,
  automationRepository,
  excludeDeliveryId,
  rule,
  targetRefHash,
}) {
  const cooldownPolicy = isObjectRecord(rule.cooldownPolicyJson) ? rule.cooldownPolicyJson : {};

  if (!cooldownPolicy.enabled) return null;

  if (!targetRefHash) {
    return {
      code: AUTOMATION_UNSENT_REASON_CODES.MISSING_TARGET_PHONE,
      message: 'Automation cooldown requires a target hash before dispatch.',
    };
  }

  const windowSeconds = Number(cooldownPolicy.windowSeconds);

  if (!Number.isInteger(windowSeconds) || windowSeconds < 1) {
    return {
      code: AUTOMATION_UNSENT_REASON_CODES.DISPATCH_VALIDATION_FAILED,
      message: 'Automation cooldown policy is invalid.',
    };
  }

  const since = new Date(acceptedAt.getTime() - windowSeconds * 1000);
  const recentDelivery = typeof automationRepository.findRecentDeliveryForCooldown === 'function'
    ? await automationRepository.findRecentDeliveryForCooldown({
      automationRuleId: rule.id,
      excludeDeliveryId,
      since,
      targetRefHash,
    })
    : null;

  if (!recentDelivery) return null;

  return {
    code: AUTOMATION_UNSENT_REASON_CODES.COOLDOWN_BLOCKED,
    message: 'Automation cooldown blocked this delivery.',
  };
}

async function hasUsableSenderResource({
  automationRepository,
  channelMapping,
  rule,
  sendChannel,
}) {
  const senderResourceId = normalizeNonEmptyString(rule.senderResourceId);
  if (!senderResourceId) return false;

  if (typeof automationRepository.getUserSenderResource !== 'function') {
    return true;
  }

  const row = await automationRepository.getUserSenderResource({
    userId: channelMapping.userId,
    senderResourceId,
  });
  const requiredResourceType = SEND_CHANNEL_RESOURCE_TYPES[sendChannel];

  return (
    row?.link?.status === ACTIVE_LINK_STATUS &&
    SEND_ROLES.has(row.link.role) &&
    row?.resource?.status === ACTIVE_RESOURCE_STATUS &&
    row.resource.provider === PROVIDERS.NHN &&
    row.resource.type === requiredResourceType
  );
}

async function findPublEventDefinitionWithProps(publEventRepository, eventKey) {
  const event = await publEventRepository.findEventByKey(eventKey);
  if (!event) return null;

  if (Array.isArray(event.props)) {
    return event;
  }

  const props = typeof publEventRepository.listPropsByEventId === 'function'
    ? await publEventRepository.listPropsByEventId(event.id)
    : [];

  return { ...event, props };
}

function normalizePublAutomationEnvelope(input) {
  if (!isObjectRecord(input)) {
    return {
      ok: false,
      reasonMessage: 'Automation event envelope must be an object.',
    };
  }

  const eventKey = normalizeNonEmptyString(input.eventKey);
  const externalEventId = normalizeNonEmptyString(input.externalEventId);
  const channelCode = normalizeNonEmptyString(input.channelCode);

  if (!eventKey || !externalEventId || !channelCode) {
    return {
      ok: false,
      reasonMessage: 'eventKey, externalEventId, and channelCode are required.',
    };
  }

  if (Object.hasOwn(input, 'payload') && !isObjectRecord(input.payload)) {
    return {
      ok: false,
      reasonMessage: 'payload must be an object when provided.',
    };
  }

  return {
    ok: true,
    eventKey,
    externalEventId,
    channelCode,
    occurredAt: normalizeNonEmptyString(input.occurredAt),
    payload: Object.hasOwn(input, 'payload') ? input.payload : {},
  };
}

function createRuntimePayload(envelope) {
  return {
    ...envelope.payload,
    eventKey: envelope.eventKey,
    externalEventId: envelope.externalEventId,
    channelCode: envelope.channelCode,
    ...(envelope.occurredAt ? { occurredAt: envelope.occurredAt } : {}),
  };
}

function resolveTargetPhoneNumber({ recipientMapping, runtimePayload, variables }) {
  const alias = normalizeNonEmptyString(recipientMapping?.alias) || 'targetPhoneNumber';

  return normalizePhoneNumber(variables[alias]) || normalizePhoneNumber(runtimePayload[alias]);
}

function createAggregateServiceResult({ acceptedAt, envelope, ruleResults }) {
  const deliveries = ruleResults
    .map((result) => result.delivery)
    .filter(Boolean)
    .map(toAutomationDeliveryDto);
  const createdResults = ruleResults.filter((result) => !result.duplicate);
  const duplicateResults = ruleResults.filter((result) => result.duplicate);
  const firstUnsent = createdResults.find((result) => result.deliveryStatus === 'unsent');
  const firstFailed = createdResults.find((result) => result.deliveryStatus === 'failed');

  if (createdResults.length === 0 && duplicateResults.length > 0) {
    return createServiceResult({
      acceptedAt,
      deliveries,
      envelope,
      ok: true,
      reasonCode: null,
      status: AUTOMATION_PROCESSING_STATUSES.DUPLICATE,
    });
  }

  if (createdResults.length > 0 && createdResults.every((result) => result.deliveryStatus === 'sent')) {
    return createServiceResult({
      acceptedAt,
      deliveries,
      envelope,
      ok: true,
      reasonCode: null,
      status: AUTOMATION_PROCESSING_STATUSES.SENT,
    });
  }

  if (!firstUnsent && firstFailed) {
    return createServiceResult({
      acceptedAt,
      deliveries,
      envelope,
      ok: true,
      reasonCode: firstFailed.reasonCode ?? null,
      reasonMessage: firstFailed.reasonMessage ?? null,
      status: AUTOMATION_PROCESSING_STATUSES.FAILED,
    });
  }

  return createServiceResult({
    acceptedAt,
    deliveries,
    envelope,
    ok: true,
    reasonCode: firstUnsent?.reasonCode ?? null,
    reasonMessage: firstUnsent?.reasonMessage ?? null,
    status: AUTOMATION_PROCESSING_STATUSES.UNSENT,
  });
}

function createServiceResult({
  acceptedAt,
  deliveries = [],
  envelope = {},
  ok,
  reasonCode = null,
  reasonMessage = null,
  status,
}) {
  return {
    ok,
    status,
    reasonCode,
    ...(reasonMessage ? { reasonMessage } : {}),
    ...(envelope.eventKey ? { eventKey: envelope.eventKey } : {}),
    ...(envelope.externalEventId ? { externalEventId: envelope.externalEventId } : {}),
    ...(envelope.channelCode ? { channelCode: envelope.channelCode } : {}),
    acceptedAt: acceptedAt.toISOString(),
    deliveryCount: deliveries.length,
    deliveries: deliveries.map(toAutomationDeliveryDto),
  };
}

function normalizeNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeSupportedSendChannel(value) {
  const sendChannel = normalizeNonEmptyString(value);
  return SUPPORTED_SEND_CHANNELS.has(sendChannel) ? sendChannel : null;
}

function normalizePhoneNumber(value) {
  if (value == null) return null;

  const stringValue = String(value).trim();
  if (!stringValue) return null;

  const digits = stringValue.replace(/\D/g, '');
  return digits.length >= 8 ? stringValue : null;
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
