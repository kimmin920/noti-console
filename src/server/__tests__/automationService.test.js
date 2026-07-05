import { describe, expect, it, vi } from 'vitest';

import {
  AUTOMATION_PROCESSING_STATUSES,
  AUTOMATION_RULE_VALIDATION_REASON_CODES,
  AUTOMATION_UNSENT_REASON_CODES,
  createAutomationService,
} from '../automations/service.js';
import { RELAY_ERROR_CODES } from '../relay/constants.js';

const FIXED_NOW = new Date('2026-06-21T12:00:00.000Z');
const TEST_KEY = Buffer.from('0123456789abcdef0123456789abcdef');

describe('automation event processing service', () => {
  it('returns unknown_channel_code and stores nothing for unknown channels', async () => {
    const repository = createMemoryAutomationRepository({ channelMappings: [] });
    const service = createTestService({ repository });

    const result = await service.processPublAutomationEvent(createEnvelope());

    expect(result).toMatchObject({
      ok: false,
      status: AUTOMATION_PROCESSING_STATUSES.UNKNOWN_CHANNEL_CODE,
      reasonCode: AUTOMATION_PROCESSING_STATUSES.UNKNOWN_CHANNEL_CODE,
      deliveryCount: 0,
    });
    expect(repository.deliveries).toHaveLength(0);
  });

  it('returns ignored_no_rule and stores nothing when no active rule matches', async () => {
    const repository = createMemoryAutomationRepository({ rules: [] });
    const service = createTestService({ repository });

    const result = await service.processPublAutomationEvent(createEnvelope());

    expect(result).toMatchObject({
      ok: true,
      status: AUTOMATION_PROCESSING_STATUSES.IGNORED_NO_RULE,
      reasonCode: AUTOMATION_PROCESSING_STATUSES.IGNORED_NO_RULE,
      deliveryCount: 0,
    });
    expect(repository.deliveries).toHaveLength(0);
  });

  it('rejects a missing externalEventId as invalid_payload without storing a delivery', async () => {
    const repository = createMemoryAutomationRepository();
    const service = createTestService({ repository });

    const result = await service.processPublAutomationEvent({
      eventKey: 'order.created',
      channelCode: 'store_1',
      payload: {},
    });

    expect(result).toMatchObject({
      ok: false,
      status: AUTOMATION_PROCESSING_STATUSES.INVALID_PAYLOAD,
      reasonCode: AUTOMATION_PROCESSING_STATUSES.INVALID_PAYLOAD,
      deliveryCount: 0,
    });
    expect(repository.deliveries).toHaveLength(0);
  });

  it('rejects non-object payloads as invalid_payload without storing a delivery', async () => {
    const repository = createMemoryAutomationRepository();
    const service = createTestService({ repository });

    const result = await service.processPublAutomationEvent(createEnvelope({
      payload: ['not-an-object'],
    }));

    expect(result).toMatchObject({
      ok: false,
      status: AUTOMATION_PROCESSING_STATUSES.INVALID_PAYLOAD,
      reasonCode: AUTOMATION_PROCESSING_STATUSES.INVALID_PAYLOAD,
      deliveryCount: 0,
    });
    expect(repository.deliveries).toHaveLength(0);
  });

  it('rejects missing catalog events as invalid_payload without storing a delivery', async () => {
    const repository = createMemoryAutomationRepository();
    const service = createTestService({
      eventRepository: createMemoryPublEventRepository({ events: [] }),
      repository,
    });

    const result = await service.processPublAutomationEvent(createEnvelope());

    expect(result).toMatchObject({
      ok: false,
      status: AUTOMATION_PROCESSING_STATUSES.INVALID_PAYLOAD,
      reasonCode: AUTOMATION_PROCESSING_STATUSES.INVALID_PAYLOAD,
      deliveryCount: 0,
    });
    expect(repository.deliveries).toHaveLength(0);
  });

  it('creates an unsent delivery when targetPhoneNumber is missing', async () => {
    const repository = createMemoryAutomationRepository();
    const service = createTestService({ repository });

    const result = await service.processPublAutomationEvent(createEnvelope({
      payload: {
        orderId: 'order_123',
      },
    }));

    expect(result).toMatchObject({
      ok: true,
      status: AUTOMATION_PROCESSING_STATUSES.UNSENT,
      reasonCode: AUTOMATION_UNSENT_REASON_CODES.MISSING_TARGET_PHONE,
      deliveryCount: 1,
    });
    expect(result.deliveries[0]).toMatchObject({
      status: 'unsent',
      reasonCode: AUTOMATION_UNSENT_REASON_CODES.MISSING_TARGET_PHONE,
      targetPhoneMasked: null,
    });
    expect(repository.deliveries).toHaveLength(1);
    expect(repository.deliveries[0]).toHaveProperty('eventPayloadCiphertext', expect.any(String));
  });

  it('creates a processing delivery for a valid matching rule ready for dispatch', async () => {
    const repository = createMemoryAutomationRepository();
    const service = createTestService({ repository });

    const result = await service.processPublAutomationEvent(createEnvelope());

    expect(result).toMatchObject({
      ok: true,
      status: AUTOMATION_PROCESSING_STATUSES.UNSENT,
      reasonCode: null,
      deliveryCount: 1,
    });
    expect(result.deliveries[0]).toMatchObject({
      id: 'delivery_1',
      status: 'processing',
      eventKey: 'order.created',
      channelCode: 'store_1',
      externalEventId: 'evt_1',
      sendChannel: 'alimtalk',
      targetPhoneMasked: '010****5678',
    });
    expect(result.deliveries[0]).not.toHaveProperty('eventPayloadCiphertext');
    expect(result.deliveries[0]).not.toHaveProperty('targetRefHash');
    expect(repository.deliveries).toHaveLength(1);
    expect(repository.deliveries[0]).toMatchObject({
      status: 'processing',
      targetRefHash: expect.any(String),
      eventPayloadCiphertext: expect.any(String),
      payloadExpiresAt: new Date('2026-06-28T12:00:00.000Z'),
    });
  });

  it('creates one delivery per active matching rule', async () => {
    const repository = createMemoryAutomationRepository({
      rules: [
        createRule({ id: 'rule_1' }),
        createRule({ id: 'rule_2', templateCode: 'ORDER_READY_BACKUP' }),
      ],
    });
    const service = createTestService({ repository });

    const result = await service.processPublAutomationEvent(createEnvelope());

    expect(result.deliveryCount).toBe(2);
    expect(repository.deliveries.map((delivery) => delivery.automationRuleId)).toEqual(['rule_1', 'rule_2']);
  });

  it('returns duplicate for repeated events across existing delivery states', async () => {
    for (const existingStatus of ['sent', 'unsent', 'processing', 'dismissed', 'failed']) {
      const repository = createMemoryAutomationRepository({
        deliveries: [
          createDeliveryRow({
            id: `delivery_existing_${existingStatus}`,
            status: existingStatus,
            reasonCode: existingStatus === 'unsent'
              ? AUTOMATION_UNSENT_REASON_CODES.MISSING_TEMPLATE_CODE
              : null,
          }),
        ],
      });
      const service = createTestService({ repository });

      const result = await service.processPublAutomationEvent(createEnvelope());

      expect(result, existingStatus).toMatchObject({
        ok: true,
        status: AUTOMATION_PROCESSING_STATUSES.DUPLICATE,
        deliveryCount: 1,
      });
      expect(result.deliveries[0], existingStatus).toMatchObject({
        id: `delivery_existing_${existingStatus}`,
        status: existingStatus,
      });
      expect(repository.deliveries, existingStatus).toHaveLength(1);
    }
  });

  it('creates safe unsent deliveries for missing rule requirements', async () => {
    const cases = [
      {
        name: 'sender resource',
        rules: [createRule({ senderResourceId: 'missing_resource' })],
        reasonCode: AUTOMATION_UNSENT_REASON_CODES.MISSING_SENDER_RESOURCE,
      },
      {
        name: 'template code',
        rules: [createRule({ templateCode: '' })],
        reasonCode: AUTOMATION_UNSENT_REASON_CODES.MISSING_TEMPLATE_CODE,
      },
      {
        name: 'send channel',
        rules: [createRule({ sendChannel: 'friendtalk' })],
        reasonCode: AUTOMATION_UNSENT_REASON_CODES.UNSUPPORTED_SEND_CHANNEL,
      },
      {
        name: 'payload validation',
        events: [createEvent({
          props: [
            createProp({
              alias: 'requiredOrderId',
              rawPath: 'orderId',
              required: true,
              enabled: true,
            }),
          ],
        })],
        reasonCode: AUTOMATION_UNSENT_REASON_CODES.PAYLOAD_VALIDATION_FAILED,
      },
    ];

    for (const testCase of cases) {
      const repository = createMemoryAutomationRepository({ rules: testCase.rules });
      const service = createTestService({
        eventRepository: createMemoryPublEventRepository({ events: testCase.events }),
        repository,
      });

      const result = await service.processPublAutomationEvent(createEnvelope({
        externalEventId: `evt_${testCase.name.replace(/\s+/g, '_')}`,
        payload: {
          orderStatus: 'READY',
          targetPhoneNumber: '010-1234-5678',
        },
      }));

      expect(result.reasonCode, testCase.name).toBe(testCase.reasonCode);
      expect(result.deliveries[0].status, testCase.name).toBe('unsent');
      expect(repository.deliveries, testCase.name).toHaveLength(1);
    }
  });

  it('does not expose raw payload, encrypted payload, or full phone number in browser-facing results', async () => {
    const repository = createMemoryAutomationRepository();
    const service = createTestService({ repository });

    const result = await service.processPublAutomationEvent(createEnvelope({
      payload: {
        orderId: 'order_private_123',
        targetPhoneNumber: '010-1234-5678',
      },
    }));
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('order_private_123');
    expect(serialized).not.toContain('01012345678');
    expect(serialized).not.toContain('010-1234-5678');
    expect(serialized).not.toContain('eventPayloadCiphertext');
    expect(serialized).not.toContain('targetRefHash');
    expect(result.deliveries[0].targetPhoneMasked).toBe('010****5678');
  });
});

describe('automation rule management service', () => {
  it('creates a valid disabled rule with safe revision evidence', async () => {
    const repository = createMemoryAutomationRepository({ rules: [] });
    const service = createTestService({ repository });

    const result = await service.createAutomationRule({
      actorUserId: 'user_1',
      payload: createRulePayload(),
    });

    expect(result.rule).toMatchObject({
      name: 'Order ready automation',
      status: 'disabled',
      sendChannel: 'alimtalk',
      templateCode: 'ORDER_READY',
    });
    expect(result.rule).not.toHaveProperty('readiness');
    expect(repository.rules).toHaveLength(1);
    expect(repository.revisions).toHaveLength(1);
    expect(repository.revisions[0]).toMatchObject({
      action: 'create',
      statusBefore: null,
      statusAfter: 'disabled',
      configSnapshotJson: {
        eventKey: 'order.created',
        sendChannel: 'alimtalk',
        templateCode: 'ORDER_READY',
        variableMapping: { orderNo: 'orderId' },
      },
    });
    expect(JSON.stringify(repository.revisions[0])).not.toContain('010-1234-5678');
  });

  it('rejects unauthorized rule detail access', async () => {
    const service = createTestService();

    await expect(service.getAutomationRule({
      actorUserId: 'other_user',
      ruleId: 'rule_1',
    })).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.FORBIDDEN,
    });
  });

  it('rejects incompatible sender resources before enabling', async () => {
    const repository = createMemoryAutomationRepository({
      rules: [
        createRule({
          sendChannel: 'sms',
          senderResourceId: 'kakao_resource_1',
          status: 'disabled',
          templateCode: 'SMS_PICKUP',
          templateSource: null,
        }),
      ],
    });
    const service = createTestService({ repository });

    await expect(service.enableAutomationRule({
      actorUserId: 'user_1',
      ruleId: 'rule_1',
    })).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      reasonCode: AUTOMATION_RULE_VALIDATION_REASON_CODES.SENDER_RESOURCE_INCOMPATIBLE,
    });
    expect(repository.rules[0].status).toBe('disabled');
    expect(repository.revisions.some((revision) => revision.action === 'validate')).toBe(false);
  });

  it('rejects invalid condition operators before storing a rule', async () => {
    const service = createTestService();

    await expect(service.createAutomationRule({
      actorUserId: 'user_1',
      payload: createRulePayload({
        condition: {
          all: [{ alias: 'orderStatus', operator: 'regex', value: '^READY$' }],
        },
      }),
    })).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
    });
  });

  it('validates the current saved configuration inline before enabling', async () => {
    const repository = createMemoryAutomationRepository({ rules: [createRule({ status: 'disabled' })] });
    const service = createTestService({ repository });

    await service.updateAutomationRule({
      actorUserId: 'user_1',
      ruleId: 'rule_1',
      payload: {
        variableMapping: { orderNo: 'targetPhoneNumber' },
      },
    });

    const result = await service.enableAutomationRule({
      actorUserId: 'user_1',
      ruleId: 'rule_1',
    });

    expect(result.rule.status).toBe('enabled');
    expect(result.rule).not.toHaveProperty('readiness');
    expect(repository.rules[0]).toMatchObject({
      status: 'enabled',
      validatedConfigHash: null,
      validationSnapshotJson: null,
    });
  });

  it('archives rules as read-only and blocks later enable', async () => {
    const repository = createMemoryAutomationRepository({ rules: [createRule({ status: 'disabled' })] });
    const service = createTestService({ repository });

    const archived = await service.archiveAutomationRule({
      actorUserId: 'user_1',
      ruleId: 'rule_1',
    });

    expect(archived.rule).toMatchObject({
      status: 'archived',
    });
    expect(archived.rule).not.toHaveProperty('readiness');
    await expect(service.enableAutomationRule({
      actorUserId: 'user_1',
      ruleId: 'rule_1',
    })).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
    });
  });

  it('leaves exactly one enabled rule for concurrent competing enables', async () => {
    const repository = createMemoryAutomationRepository({
      rules: [
        createRule({ id: 'rule_1', status: 'disabled' }),
        createRule({ id: 'rule_2', status: 'disabled', templateCode: 'ORDER_READY_BACKUP' }),
      ],
    });
    const service = createTestService({ repository });

    const results = await Promise.allSettled([
      service.enableAutomationRule({ actorUserId: 'user_1', ruleId: 'rule_1' }),
      service.enableAutomationRule({ actorUserId: 'user_1', ruleId: 'rule_2' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(repository.rules.filter((rule) => rule.status === 'enabled')).toHaveLength(1);
    expect(repository.revisions.filter((revision) => revision.action === 'enable')).toHaveLength(1);
  });

  it('dry-runs a complete sample without exposing raw sample values', async () => {
    const repository = createMemoryAutomationRepository();
    const service = createTestService({ repository });

    const result = await service.dryRunAutomationRule({
      actorUserId: 'user_1',
      ruleId: 'rule_1',
      sampleEnvelope: createEnvelope({
        payload: {
          orderId: 'order_private_123',
          orderStatus: 'READY',
          targetPhoneNumber: '010-1234-5678',
        },
      }),
    });
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({
      ok: true,
      wouldSend: true,
      maskedRecipient: '010****5678',
      conditionResult: {
        passed: true,
      },
      cooldownResult: {
        eligible: true,
      },
      templateVariables: {
        missing: [],
        required: ['orderNo'],
      },
    });
    expect(repository.deliveries).toHaveLength(0);
    expect(repository.revisions).toHaveLength(0);
    expect(serialized).not.toContain('order_private_123');
    expect(serialized).not.toContain('010-1234-5678');
    expect(serialized).not.toContain('01012345678');
  });

  it('dry-run blocks missing recipients with safe blockers', async () => {
    const service = createTestService();

    const result = await service.dryRunAutomationRule({
      actorUserId: 'user_1',
      ruleId: 'rule_1',
      sampleEnvelope: createEnvelope({
        payload: {
          orderId: 'order_123',
          orderStatus: 'READY',
        },
      }),
    });

    expect(result).toMatchObject({
      ok: false,
      wouldSend: false,
      maskedRecipient: null,
    });
    expect(result.blockers).toContainEqual(expect.objectContaining({ code: 'missing_recipient' }));
  });

  it('dry-run blocks failed conditions', async () => {
    const service = createTestService();

    const result = await service.dryRunAutomationRule({
      actorUserId: 'user_1',
      ruleId: 'rule_1',
      sampleEnvelope: createEnvelope({
        payload: {
          orderId: 'order_123',
          orderStatus: 'PENDING',
          targetPhoneNumber: '010-1234-5678',
        },
      }),
    });

    expect(result.conditionResult).toMatchObject({ passed: false });
    expect(result.blockers).toContainEqual(expect.objectContaining({ code: 'condition_failed' }));
  });

  it('dry-run checks cooldown without writing delivery rows', async () => {
    const repository = createMemoryAutomationRepository();
    repository.findRecentDeliveryForCooldown = vi.fn(async () => createDeliveryRow({ createdAt: FIXED_NOW }));
    const service = createTestService({ repository });

    const result = await service.dryRunAutomationRule({
      actorUserId: 'user_1',
      ruleId: 'rule_1',
      sampleEnvelope: createEnvelope({
        payload: {
          orderId: 'order_123',
          orderStatus: 'READY',
          targetPhoneNumber: '010-1234-5678',
        },
      }),
    });

    expect(result.cooldownResult).toMatchObject({
      eligible: false,
      enabled: true,
      reasonCode: 'recent_delivery_found',
    });
    expect(result.blockers).toContainEqual(expect.objectContaining({ code: 'cooldown_blocked' }));
    expect(repository.deliveries).toHaveLength(0);
    expect(repository.findRecentDeliveryForCooldown).toHaveBeenCalledTimes(1);
  });

  it('dry-run reports missing required template variables', async () => {
    const service = createTestService();

    const result = await service.dryRunAutomationRule({
      actorUserId: 'user_1',
      ruleId: 'rule_1',
      sampleEnvelope: createEnvelope({
        payload: {
          orderStatus: 'READY',
          targetPhoneNumber: '010-1234-5678',
        },
      }),
    });

    expect(result.templateVariables).toMatchObject({
      missing: ['orderNo'],
      required: ['orderNo'],
    });
    expect(result.blockers).toContainEqual(expect.objectContaining({ code: 'template_variable_missing' }));
  });

  it('dry-run rejects invalid sample envelopes safely', async () => {
    const service = createTestService();

    const result = await service.dryRunAutomationRule({
      actorUserId: 'user_1',
      ruleId: 'rule_1',
      sampleEnvelope: createEnvelope({ payload: 'not-an-object' }),
    });

    expect(result).toMatchObject({
      ok: false,
      wouldSend: false,
    });
    expect(result.blockers).toContainEqual(expect.objectContaining({ code: 'invalid_sample' }));
  });

  it('dry-run rejects unauthorized rules', async () => {
    const service = createTestService();

    await expect(service.dryRunAutomationRule({
      actorUserId: 'other_user',
      ruleId: 'rule_1',
      sampleEnvelope: createEnvelope(),
    })).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.FORBIDDEN,
    });
  });

  it('dry-run never calls provider send methods', async () => {
    const messageSendService = {
      sendAlimtalk: vi.fn(),
      sendBrandMessage: vi.fn(),
      sendSms: vi.fn(),
    };
    const service = createTestService({ messageSendService });

    await service.dryRunAutomationRule({
      actorUserId: 'user_1',
      ruleId: 'rule_1',
      sampleEnvelope: createEnvelope({
        payload: {
          orderId: 'order_123',
          orderStatus: 'READY',
          targetPhoneNumber: '010-1234-5678',
        },
      }),
    });

    expect(messageSendService.sendAlimtalk).not.toHaveBeenCalled();
    expect(messageSendService.sendBrandMessage).not.toHaveBeenCalled();
    expect(messageSendService.sendSms).not.toHaveBeenCalled();
  });
});

function createTestService({ repository, eventRepository, messageSendService, templateService } = {}) {
  return createAutomationService({
    automationRepository: repository ?? createMemoryAutomationRepository(),
    messageSendService,
    publEventRepository: eventRepository ?? createMemoryPublEventRepository(),
    templateService: templateService ?? createMemoryTemplateService(),
    now: () => FIXED_NOW,
    payloadVaultOptions: { key: TEST_KEY },
  });
}

function createRulePayload(overrides = {}) {
  return {
    name: 'Order ready automation',
    eventDefinitionId: 'event_definition_1',
    sendChannel: 'alimtalk',
    senderResourceId: 'kakao_resource_1',
    templateCode: 'ORDER_READY',
    templateSource: 'SENDER_PROFILE',
    variableMapping: { orderNo: 'orderId' },
    recipientMapping: { type: 'event_alias', alias: 'targetPhoneNumber' },
    condition: { all: [{ alias: 'orderStatus', operator: 'equals', value: 'READY' }] },
    cooldownPolicy: { enabled: true, windowSeconds: 300 },
    ...overrides,
  };
}

function createEnvelope(overrides = {}) {
  return {
    eventKey: 'order.created',
    externalEventId: 'evt_1',
    channelCode: 'store_1',
    occurredAt: '2026-06-21T11:55:00.000Z',
    payload: {
      orderId: 'order_123',
      orderStatus: 'READY',
      targetPhoneNumber: '010-1234-5678',
    },
    ...overrides,
  };
}

function createMemoryAutomationRepository(overrides = {}) {
  return {
    channelMappings: overrides.channelMappings ?? [createChannelMapping()],
    rules: overrides.rules ?? [createRule()],
    resources: overrides.resources ?? [createSenderResource()],
    links: overrides.links ?? [createSenderResourceLink()],
    deliveries: overrides.deliveries ?? [],
    events: overrides.events ?? [createEvent({
      props: [
        createProp({ alias: 'targetPhoneNumber', rawPath: 'targetPhoneNumber', label: '수신자 번호' }),
        createProp({ alias: 'orderId', rawPath: 'orderId', label: '주문 번호' }),
        createProp({ alias: 'orderStatus', rawPath: 'orderStatus', label: '주문 상태' }),
      ],
    })],
    revisions: overrides.revisions ?? [],

    async findActiveChannelMappingByCode(channelCode) {
      return this.channelMappings.find((mapping) => (
        mapping.channelCode === channelCode &&
        mapping.status === 'active'
      )) ?? null;
    },

    async listActiveRulesForUserEvent({ userId, eventDefinitionId }) {
      return this.rules.filter((rule) => (
        rule.userId === userId &&
        rule.eventDefinitionId === eventDefinitionId &&
        rule.status === 'enabled'
      ));
    },

    async listAutomationRulesForUser({ userId }) {
      return this.rules.filter((rule) => rule.userId === userId);
    },

    async findAutomationRuleForUser({ ruleId, userId }) {
      return this.rules.find((rule) => rule.id === ruleId && rule.userId === userId) ?? null;
    },

    async findEventDefinitionById(eventDefinitionId) {
      return this.events.find((event) => event.id === eventDefinitionId) ?? null;
    },

    async getUserSenderResource({ userId, senderResourceId }) {
      const link = this.links.find((item) => (
        item.userId === userId &&
        item.senderResourceId === senderResourceId
      ));

      if (!link) return null;

      return {
        link,
        resource: this.resources.find((resource) => resource.id === senderResourceId) ?? null,
      };
    },

    async createAutomationRule({ values, now = FIXED_NOW } = {}) {
      const rule = {
        id: `rule_${this.rules.length + 1}`,
        status: 'disabled',
        validationSnapshotJson: null,
        validatedConfigHash: null,
        lastValidatedAt: null,
        enabledAt: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        ...values,
      };

      this.rules.push(rule);
      return rule;
    },

    async updateAutomationRule({ ruleId, userId, values, now = FIXED_NOW } = {}) {
      const rule = this.rules.find((candidate) => candidate.id === ruleId && candidate.userId === userId);
      if (!rule) return null;
      Object.assign(rule, values, { updatedAt: now });
      return rule;
    },

    async enableAutomationRule({ ruleId, userId, now = FIXED_NOW } = {}) {
      const rule = this.rules.find((candidate) => candidate.id === ruleId && candidate.userId === userId);
      if (!rule) return { conflict: false, rule: null };

      const competing = this.rules.find((candidate) => (
        candidate.id !== rule.id &&
        candidate.userId === rule.userId &&
        candidate.eventDefinitionId === rule.eventDefinitionId &&
        candidate.status === 'enabled'
      ));

      if (competing) {
        return { conflict: true, competingRuleId: competing.id, rule };
      }

      Object.assign(rule, { status: 'enabled', enabledAt: now, updatedAt: now });
      return { conflict: false, rule };
    },

    async disableAutomationRule({ ruleId, userId, now = FIXED_NOW } = {}) {
      const rule = this.rules.find((candidate) => candidate.id === ruleId && candidate.userId === userId);
      if (!rule) return null;
      Object.assign(rule, { status: 'disabled', enabledAt: null, updatedAt: now });
      return rule;
    },

    async archiveAutomationRule({ ruleId, userId, now = FIXED_NOW } = {}) {
      const rule = this.rules.find((candidate) => candidate.id === ruleId && candidate.userId === userId);
      if (!rule) return null;
      Object.assign(rule, { status: 'archived', archivedAt: now, enabledAt: null, updatedAt: now });
      return rule;
    },

    async createAutomationRuleRevision({ values, now = FIXED_NOW } = {}) {
      const revision = {
        id: `revision_${this.revisions.length + 1}`,
        revisionNumber: this.revisions.filter((item) => item.automationRuleId === values.automationRuleId).length + 1,
        createdAt: now,
        ...values,
      };

      this.revisions.push(revision);
      return revision;
    },

    async listAutomationRuleRevisions({ automationRuleId, userId }) {
      const rule = this.rules.find((candidate) => (
        candidate.id === automationRuleId &&
        candidate.userId === userId
      ));

      if (!rule) return [];
      return this.revisions.filter((revision) => revision.automationRuleId === automationRuleId);
    },

    async findDuplicateDelivery({ channelMappingId, externalEventId, automationRuleId }) {
      return this.deliveries.find((delivery) => (
        delivery.channelMappingId === channelMappingId &&
        delivery.externalEventId === externalEventId &&
        delivery.automationRuleId === automationRuleId
      )) ?? null;
    },

    async createDelivery(values, { now = FIXED_NOW } = {}) {
      const { encryptedPayload, ...deliveryValues } = values;
      const delivery = {
        id: `delivery_${this.deliveries.length + 1}`,
        createdAt: now,
        updatedAt: now,
        ...deliveryValues,
        ...(encryptedPayload ?? {}),
      };

      this.deliveries.push(delivery);
      return delivery;
    },
  };
}

function createMemoryTemplateService() {
  const templates = new Map([
    ['alimtalk:ORDER_READY', createTemplate()],
    ['alimtalk:ORDER_READY_BACKUP', createTemplate({ templateCode: 'ORDER_READY_BACKUP' })],
    ['sms:SMS_PICKUP', createTemplate({
      channel: 'sms',
      templateCode: 'SMS_PICKUP',
      source: null,
      requiredVariables: ['code'],
      variables: [{ key: 'code', type: 'string', fallbackValue: '' }],
    })],
  ]);

  return {
    async getTemplate({ channel, templateCode }) {
      const template = templates.get(`${channel}:${templateCode}`);
      if (!template) {
        throw new Error('template not found');
      }

      return {
        channel,
        template,
      };
    },
  };
}

function createMemoryPublEventRepository(overrides = {}) {
  const events = overrides.events ?? [createEvent({
    props: [
      createProp({ alias: 'targetPhoneNumber', rawPath: 'targetPhoneNumber', label: '수신자 번호' }),
      createProp({ alias: 'orderId', rawPath: 'orderId', label: '주문 번호' }),
      createProp({ alias: 'orderStatus', rawPath: 'orderStatus', label: '주문 상태' }),
    ],
  })];

  return {
    async findEventByKey(eventKey) {
      return events.find((event) => event.eventKey === eventKey) ?? null;
    },

    async listPropsByEventId(eventId) {
      return events.find((event) => event.id === eventId)?.props ?? [];
    },
  };
}

function createChannelMapping(overrides = {}) {
  return {
    id: 'mapping_1',
    userId: 'user_1',
    channelCode: 'store_1',
    displayName: 'Store',
    status: 'active',
    ...overrides,
  };
}

function createRule(overrides = {}) {
  return {
    id: 'rule_1',
    userId: 'user_1',
    eventDefinitionId: 'event_definition_1',
    name: 'Order ready',
    status: 'enabled',
    sendChannel: 'alimtalk',
    senderResourceId: 'kakao_resource_1',
    templateCode: 'ORDER_READY',
    templateSource: 'SENDER_PROFILE',
    variableMappingJson: { orderNo: 'orderId' },
    recipientMappingJson: { type: 'event_alias', alias: 'targetPhoneNumber' },
    conditionJson: { all: [{ alias: 'orderStatus', operator: 'equals', value: 'READY' }] },
    cooldownPolicyJson: { enabled: true, windowSeconds: 300 },
    validationSnapshotJson: null,
    validatedConfigHash: null,
    lastValidatedAt: null,
    enabledAt: null,
    archivedAt: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

function createTemplate(overrides = {}) {
  return {
    channel: 'alimtalk',
    source: 'SENDER_PROFILE',
    templateCode: 'ORDER_READY',
    templateName: 'Order ready',
    requiredVariables: ['orderNo'],
    variables: [{ key: 'orderNo', type: 'string', fallbackValue: '' }],
    ...overrides,
  };
}

function createEvent(overrides = {}) {
  return {
    id: 'event_definition_1',
    eventKey: 'order.created',
    eventType: 'publ-event',
    displayName: 'Order created',
    props: [],
    ...overrides,
  };
}

function createProp(overrides = {}) {
  return {
    sortOrder: 0,
    rawPath: 'targetPhoneNumber',
    alias: 'targetPhoneNumber',
    label: '수신자 번호',
    type: 'text',
    required: false,
    enabled: true,
    fallback: null,
    parserPipeline: null,
    ...overrides,
  };
}

function createSenderResource(overrides = {}) {
  return {
    id: 'kakao_resource_1',
    resourceRef: 'kakaoref1',
    provider: 'nhn',
    type: 'kakao_sender_key',
    value: 'sender-key-1',
    displayName: '@store',
    status: 'active',
    providerStatus: 'active',
    ...overrides,
  };
}

function createSenderResourceLink(overrides = {}) {
  return {
    id: 'link_1',
    userId: 'user_1',
    senderResourceId: 'kakao_resource_1',
    billingAccountId: 'billing_1',
    role: 'sender',
    status: 'active',
    isDefault: false,
    ...overrides,
  };
}

function createDeliveryRow(overrides = {}) {
  return {
    id: 'delivery_1',
    userId: 'user_1',
    channelMappingId: 'mapping_1',
    automationRuleId: 'rule_1',
    eventDefinitionId: 'event_definition_1',
    externalEventId: 'evt_1',
    eventKey: 'order.created',
    channelCode: 'store_1',
    sendChannel: 'alimtalk',
    status: 'processing',
    reasonCode: null,
    reasonMessage: null,
    targetPhoneMasked: '010****5678',
    targetRefHash: 'hashed-target-ref',
    eventPayloadCiphertext: 'encrypted-event-payload',
    eventPayloadIv: 'payload-iv',
    eventPayloadTag: 'payload-tag',
    eventPayloadVersion: 1,
    payloadExpiresAt: new Date('2026-06-28T12:00:00.000Z'),
    payloadPurgedAt: null,
    messageSendGroupId: null,
    receivedAt: FIXED_NOW,
    sentAt: null,
    dismissedAt: null,
    lastAttemptAt: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}
