import { describe, expect, it, vi } from 'vitest';

import {
  AUTOMATION_PROCESSING_STATUSES,
  AUTOMATION_UNSENT_REASON_CODES,
  createAutomationService,
} from '../automations/service.js';
import { createMessageSendService } from '../messages/service.js';
import { CHANNELS, RELAY_ERROR_CODES, SENDER_RESOURCE_TYPES } from '../relay/constants.js';
import { RelayError } from '../relay/errors.js';

const FIXED_NOW = new Date('2026-06-21T01:00:00.000Z');
const TEST_KEY = Buffer.from('0123456789abcdef0123456789abcdef');

describe('automation message dispatch', () => {
  it('sends SMS from a provider template and records automation source metadata', async () => {
    const harness = createDispatchHarness({
      rules: [createRule({
        sendChannel: CHANNELS.SMS,
        senderResourceId: 'sms_resource_1',
        templateCode: 'SMS_PICKUP',
        variableMappingJson: { code: 'pickupCode' },
      })],
      eventRepository: createMemoryPublEventRepository({
        events: [createEvent({
          props: [
            createProp({ alias: 'targetPhoneNumber', rawPath: 'targetPhoneNumber' }),
            createProp({ alias: 'pickupCode', rawPath: 'pickup.code' }),
          ],
        })],
      }),
    });

    const result = await harness.service.processPublAutomationEvent(createEnvelope({
      payload: {
        pickup: { code: 'ABC123' },
        targetPhoneNumber: '010-1234-5678',
      },
    }));

    expect(result).toMatchObject({
      ok: true,
      status: AUTOMATION_PROCESSING_STATUSES.SENT,
      reasonCode: null,
      deliveryCount: 1,
    });
    expect(harness.smsClient.sendSms).toHaveBeenCalledTimes(1);
    expect(harness.smsClient.sendSms.mock.calls[0][0]).toMatchObject({
      body: 'Pickup code ##code##',
      sendNo: '15446859',
      templateId: 'SMS_PICKUP',
      recipientList: [
        {
          recipientNo: '01012345678',
          templateParameter: { code: 'ABC123' },
        },
      ],
    });
    expect(harness.ledgerRepository.groups[0]).toMatchObject({
      channel: CHANNELS.SMS,
      sourceType: 'automation',
      sourceEventKey: 'order.created',
      sourceExternalEventId: 'evt_1',
      sourceChannelCode: 'store_1',
      sourceAutomationRuleId: 'rule_1',
      sourceAutomationDeliveryId: 'delivery_1',
    });
    expect(harness.repository.deliveries[0]).toMatchObject({
      status: 'sent',
      messageSendGroupId: 'ledger_group_1',
      eventPayloadCiphertext: null,
      payloadPurgedAt: FIXED_NOW,
    });
    expect(JSON.stringify(harness.ledgerRepository)).not.toContain('01012345678');
    expect(JSON.stringify(harness.ledgerRepository)).not.toContain('ABC123');
  });

  it('sends AlimTalk template parameters resolved from PUBL variables', async () => {
    const harness = createDispatchHarness({
      eventRepository: createMemoryPublEventRepository({
        events: [createEvent({
          props: [
            createProp({ alias: 'targetPhoneNumber', rawPath: 'recipient.phone' }),
            createProp({ alias: 'orderNo', rawPath: 'order.no' }),
          ],
        })],
      }),
      rules: [createRule({
        variableMappingJson: { orderNo: 'orderNo' },
      })],
    });

    const result = await harness.service.processPublAutomationEvent(createEnvelope({
      payload: {
        order: { no: 'ORDER-123' },
        recipient: { phone: '010-1234-5678' },
      },
    }));

    expect(result.status).toBe(AUTOMATION_PROCESSING_STATUSES.SENT);
    expect(harness.kakaoClient.sendAlimtalkMessage).toHaveBeenCalledTimes(1);
    expect(harness.kakaoClient.sendAlimtalkMessage.mock.calls[0][0]).not.toHaveProperty('managementTitle');
    expect(harness.kakaoClient.sendAlimtalkMessage.mock.calls[0][0].recipientList).toEqual([
      {
        recipientNo: '01012345678',
        templateParameter: { orderNo: 'ORDER-123' },
        buttons: [{ type: 'WL', name: 'Open', linkMo: 'https://example.com' }],
        recipientGroupingKey: expect.stringContaining(':n:0'),
      },
    ]);
    expect(JSON.stringify(harness.ledgerRepository)).not.toContain('ORDER-123');
  });

  it('uses the rule recipient mapping alias when resolving the target phone number', async () => {
    const harness = createDispatchHarness({
      eventRepository: createMemoryPublEventRepository({
        events: [createEvent({
          props: [
            createProp({ alias: 'recipientPhone', rawPath: 'recipient.phone' }),
            createProp({ alias: 'orderNo', rawPath: 'order.no' }),
          ],
        })],
      }),
      rules: [createRule({
        recipientMappingJson: { type: 'event_alias', alias: 'recipientPhone' },
        variableMappingJson: { orderNo: 'orderNo' },
      })],
    });

    const result = await harness.service.processPublAutomationEvent(createEnvelope({
      payload: {
        order: { no: 'ORDER-123' },
        recipient: { phone: '010-1234-5678' },
      },
    }));

    expect(result.status).toBe(AUTOMATION_PROCESSING_STATUSES.SENT);
    expect(harness.kakaoClient.sendAlimtalkMessage.mock.calls[0][0].recipientList[0].recipientNo).toBe('01012345678');
    expect(harness.repository.deliveries[0]).toMatchObject({
      targetPhoneMasked: '010****5678',
      targetRefHash: expect.any(String),
    });
  });

  it('sends Brand Message automation through template mode only', async () => {
    const harness = createDispatchHarness({
      rules: [createRule({
        sendChannel: CHANNELS.BRAND_MESSAGE,
        senderResourceId: 'kakao_resource_1',
        templateCode: 'BRAND_TEMPLATE_1',
        variableMappingJson: { customerName: 'customerName' },
      })],
      eventRepository: createMemoryPublEventRepository({
        events: [createEvent({
          props: [
            createProp({ alias: 'targetPhoneNumber', rawPath: 'phone' }),
            createProp({ alias: 'customerName', rawPath: 'customer.name' }),
          ],
        })],
      }),
    });

    const result = await harness.service.processPublAutomationEvent(createEnvelope({
      payload: {
        customer: { name: 'Kim' },
        phone: '010-1234-5678',
      },
    }));

    expect(result.status).toBe(AUTOMATION_PROCESSING_STATUSES.SENT);
    expect(harness.kakaoClient.sendBrandBasicMessage).toHaveBeenCalledTimes(1);
    expect(harness.kakaoClient.sendBrandFreestyleMessage).not.toHaveBeenCalled();
    expect(harness.kakaoClient.sendBrandBasicMessage.mock.calls[0][0]).toMatchObject({
      senderKey: 'sender-key-1',
      templateCode: 'BRAND_TEMPLATE_1',
      recipientList: [
        {
          recipientNo: '01012345678',
          templateParameter: { customerName: 'Kim' },
        },
      ],
    });
    expect(harness.kakaoClient.sendBrandBasicMessage.mock.calls[0][0]).not.toHaveProperty('content');
    expect(harness.kakaoClient.sendBrandBasicMessage.mock.calls[0][0]).not.toHaveProperty('chatBubbleType');
  });

  it('marks missing sender resources unsent without calling the provider', async () => {
    const harness = createDispatchHarness({
      rules: [createRule({ senderResourceId: 'missing_resource' })],
    });

    const result = await harness.service.processPublAutomationEvent(createEnvelope());

    expect(result).toMatchObject({
      status: AUTOMATION_PROCESSING_STATUSES.UNSENT,
      reasonCode: AUTOMATION_UNSENT_REASON_CODES.MISSING_SENDER_RESOURCE,
    });
    expect(harness.smsClient.sendSms).not.toHaveBeenCalled();
    expect(harness.kakaoClient.sendAlimtalkMessage).not.toHaveBeenCalled();
    expect(harness.repository.deliveries[0]).toMatchObject({
      status: 'unsent',
      reasonCode: AUTOMATION_UNSENT_REASON_CODES.MISSING_SENDER_RESOURCE,
    });
  });

  it('marks missing templates unsent without calling the provider', async () => {
    const templateService = createTemplateService({ missingTemplate: true });
    const harness = createDispatchHarness({ templateService });

    const result = await harness.service.processPublAutomationEvent(createEnvelope());

    expect(result).toMatchObject({
      status: AUTOMATION_PROCESSING_STATUSES.UNSENT,
      reasonCode: AUTOMATION_UNSENT_REASON_CODES.MISSING_TEMPLATE,
    });
    expect(templateService.getTemplate).toHaveBeenCalledTimes(1);
    expect(harness.kakaoClient.sendAlimtalkMessage).not.toHaveBeenCalled();
    expect(harness.repository.deliveries[0]).toMatchObject({
      status: 'unsent',
      reasonCode: AUTOMATION_UNSENT_REASON_CODES.MISSING_TEMPLATE,
    });
  });

  it('marks sender-resource quota exhaustion as unsent instead of a retryable dispatch failure', async () => {
    const messageSendService = {
      sendAlimtalk: vi.fn(async () => {
        throw new RelayError({
          code: RELAY_ERROR_CODES.SENDER_RESOURCE_QUOTA_EXCEEDED,
          message: 'Sender quota exhausted.',
          retryable: false,
          status: 429,
        });
      }),
    };
    const harness = createDispatchHarness({ messageSendService });

    const result = await harness.service.processPublAutomationEvent(createEnvelope());

    expect(result).toMatchObject({
      status: AUTOMATION_PROCESSING_STATUSES.UNSENT,
      reasonCode: AUTOMATION_UNSENT_REASON_CODES.QUOTA_EXCEEDED,
    });
    expect(messageSendService.sendAlimtalk).toHaveBeenCalledTimes(1);
    expect(harness.repository.deliveries[0]).toMatchObject({
      reasonCode: AUTOMATION_UNSENT_REASON_CODES.QUOTA_EXCEEDED,
      status: 'unsent',
    });
  });

  it('dispatches when rule conditions match', async () => {
    const harness = createDispatchHarness({
      eventRepository: createMemoryPublEventRepository({
        events: [createEvent({
          props: [
            createProp({ alias: 'targetPhoneNumber', rawPath: 'targetPhoneNumber' }),
            createProp({ alias: 'orderStatus', rawPath: 'orderStatus' }),
          ],
        })],
      }),
      rules: [createRule({
        conditionJson: { all: [{ alias: 'orderStatus', operator: 'equals', value: 'READY' }] },
      })],
    });

    const result = await harness.service.processPublAutomationEvent(createEnvelope({
      payload: {
        orderStatus: 'READY',
        targetPhoneNumber: '010-1234-5678',
      },
    }));

    expect(result.status).toBe(AUTOMATION_PROCESSING_STATUSES.SENT);
    expect(harness.kakaoClient.sendAlimtalkMessage).toHaveBeenCalledTimes(1);
  });

  it('blocks dispatch when rule conditions do not match', async () => {
    const harness = createDispatchHarness({
      eventRepository: createMemoryPublEventRepository({
        events: [createEvent({
          props: [
            createProp({ alias: 'targetPhoneNumber', rawPath: 'targetPhoneNumber' }),
            createProp({ alias: 'orderStatus', rawPath: 'orderStatus' }),
          ],
        })],
      }),
      rules: [createRule({
        conditionJson: { all: [{ alias: 'orderStatus', operator: 'equals', value: 'READY' }] },
      })],
    });

    const result = await harness.service.processPublAutomationEvent(createEnvelope({
      payload: {
        orderStatus: 'PENDING',
        targetPhoneNumber: '010-1234-5678',
      },
    }));
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({
      status: AUTOMATION_PROCESSING_STATUSES.UNSENT,
      reasonCode: AUTOMATION_UNSENT_REASON_CODES.CONDITION_MISMATCH,
    });
    expect(harness.kakaoClient.sendAlimtalkMessage).not.toHaveBeenCalled();
    expect(harness.repository.deliveries[0]).toMatchObject({
      reasonCode: AUTOMATION_UNSENT_REASON_CODES.CONDITION_MISMATCH,
      status: 'unsent',
    });
    expect(serialized).not.toContain('010-1234-5678');
    expect(serialized).not.toContain('01012345678');
  });

  it('allows the first send when cooldown has no recent delivery', async () => {
    const harness = createDispatchHarness({
      rules: [createRule({
        cooldownPolicyJson: { enabled: true, windowSeconds: 300 },
      })],
    });

    const result = await harness.service.processPublAutomationEvent(createEnvelope());

    expect(result.status).toBe(AUTOMATION_PROCESSING_STATUSES.SENT);
    expect(harness.kakaoClient.sendAlimtalkMessage).toHaveBeenCalledTimes(1);
    expect(harness.repository.deliveries[0]).toMatchObject({
      status: 'sent',
      targetRefHash: expect.any(String),
    });
  });

  it('blocks repeat sends inside the cooldown window', async () => {
    const harness = createDispatchHarness({
      rules: [createRule({
        cooldownPolicyJson: { enabled: true, windowSeconds: 300 },
      })],
    });

    await harness.service.processPublAutomationEvent(createEnvelope({ externalEventId: 'evt_1' }));
    const result = await harness.service.processPublAutomationEvent(createEnvelope({ externalEventId: 'evt_2' }));

    expect(result).toMatchObject({
      status: AUTOMATION_PROCESSING_STATUSES.UNSENT,
      reasonCode: AUTOMATION_UNSENT_REASON_CODES.COOLDOWN_BLOCKED,
    });
    expect(harness.kakaoClient.sendAlimtalkMessage).toHaveBeenCalledTimes(1);
    expect(harness.repository.deliveries).toHaveLength(2);
    expect(harness.repository.deliveries[1]).toMatchObject({
      reasonCode: AUTOMATION_UNSENT_REASON_CODES.COOLDOWN_BLOCKED,
      status: 'unsent',
    });
  });

  it('blocks cooldown dispatch when the target is unavailable', async () => {
    const harness = createDispatchHarness({
      rules: [createRule({
        cooldownPolicyJson: { enabled: true, windowSeconds: 300 },
      })],
    });

    const result = await harness.service.processPublAutomationEvent(createEnvelope({
      payload: {},
    }));

    expect(result).toMatchObject({
      status: AUTOMATION_PROCESSING_STATUSES.UNSENT,
      reasonCode: AUTOMATION_UNSENT_REASON_CODES.MISSING_TARGET_PHONE,
    });
    expect(harness.kakaoClient.sendAlimtalkMessage).not.toHaveBeenCalled();
    expect(harness.repository.deliveries[0]).toMatchObject({
      reasonCode: AUTOMATION_UNSENT_REASON_CODES.MISSING_TARGET_PHONE,
      status: 'unsent',
      targetRefHash: null,
    });
  });

  it('does not dispatch a duplicate retry after a delivery was sent', async () => {
    const repository = createMemoryDispatchRepository({
      deliveries: [
        createDeliveryRow({
          status: 'sent',
          messageSendGroupId: 'ledger_group_existing',
          sentAt: FIXED_NOW,
        }),
      ],
    });
    const harness = createDispatchHarness({ repository });

    const result = await harness.service.processPublAutomationEvent(createEnvelope());

    expect(result.status).toBe(AUTOMATION_PROCESSING_STATUSES.DUPLICATE);
    expect(harness.kakaoClient.sendAlimtalkMessage).not.toHaveBeenCalled();
    expect(repository.deliveries).toHaveLength(1);
  });

  it('returns an existing duplicate delivery without dispatching twice', async () => {
    const harness = createDispatchHarness();

    const firstResult = await harness.service.processPublAutomationEvent(createEnvelope());
    const duplicateResult = await harness.service.processPublAutomationEvent(createEnvelope());

    expect(firstResult.status).toBe(AUTOMATION_PROCESSING_STATUSES.SENT);
    expect(duplicateResult.status).toBe(AUTOMATION_PROCESSING_STATUSES.DUPLICATE);
    expect(harness.kakaoClient.sendAlimtalkMessage).toHaveBeenCalledTimes(1);
    expect(harness.repository.deliveries).toHaveLength(1);
  });

  it('uses a deterministic automation client request id across matching retries', async () => {
    const firstHarness = createDispatchHarness();
    const secondHarness = createDispatchHarness();

    await firstHarness.service.processPublAutomationEvent(createEnvelope());
    await secondHarness.service.processPublAutomationEvent(createEnvelope());

    const firstClientRequestId = firstHarness.kakaoClient.sendAlimtalkMessage.mock.calls[0][0]
      .senderGroupingKey.match(/:q:([^:]+)$/)[1];
    const secondClientRequestId = secondHarness.kakaoClient.sendAlimtalkMessage.mock.calls[0][0]
      .senderGroupingKey.match(/:q:([^:]+)$/)[1];

    expect(firstHarness.ledgerRepository.providerRequests[0].clientRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(firstHarness.ledgerRepository.providerRequests[0].clientRequestId).toBe(
      secondHarness.ledgerRepository.providerRequests[0].clientRequestId
    );
    expect(firstClientRequestId).toBe(secondClientRequestId);
  });
});

function createDispatchHarness({
  eventRepository = createMemoryPublEventRepository(),
  messageSendService: injectedMessageSendService,
  repository = createMemoryDispatchRepository(),
  rules,
  templateService = createTemplateService(),
} = {}) {
  if (rules) {
    repository.rules = rules;
  }

  const ledgerRepository = createMemoryLedgerRepository();
  const smsClient = createSmsClient();
  const kakaoClient = createKakaoClient();
  const messageSendService = injectedMessageSendService ?? createMessageSendService({
      ledgerRepository,
      repository,
      smsClient,
      kakaoClient,
      now: () => FIXED_NOW,
    });
  const service = createAutomationService({
    automationRepository: repository,
    messageSendService,
    payloadVaultOptions: { key: TEST_KEY },
    publEventRepository: eventRepository,
    templateService,
    now: () => FIXED_NOW,
  });

  return {
    kakaoClient,
    ledgerRepository,
    repository,
    service,
    smsClient,
  };
}

function createSmsClient() {
  return {
    sendSms: vi.fn(async () => ({
      header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      body: {
        data: {
          requestId: 'sms-request-1',
          statusCode: '2',
          sendResultList: [{ recipientSeq: 1, resultCode: 0, resultMessage: 'SUCCESS' }],
        },
      },
    })),
    sendMms: vi.fn(async () => ({
      header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      body: {
        data: {
          requestId: 'mms-request-1',
          statusCode: '2',
          sendResultList: [{ recipientSeq: 1, resultCode: 0, resultMessage: 'SUCCESS' }],
        },
      },
    })),
  };
}

function createKakaoClient() {
  return {
    sendAlimtalkMessage: vi.fn(async () => ({
      header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      message: {
        requestId: 'alimtalk-request-1',
        sendResults: [{ recipientSeq: 1, resultCode: 'MRC01', resultMessage: 'SUCCESS' }],
      },
    })),
    sendBrandBasicMessage: vi.fn(async () => ({
      header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      message: {
        requestId: 'brand-request-1',
        sendResults: [{ recipientSeq: 1, resultCode: 'MRC01', resultMessage: 'SUCCESS' }],
      },
    })),
    sendBrandFreestyleMessage: vi.fn(),
    uploadBrandImage: vi.fn(),
  };
}

function createTemplateService({ missingTemplate = false } = {}) {
  return {
    getTemplate: vi.fn(async ({ channel, templateCode }) => {
      if (missingTemplate) {
        throw new RelayError({
          code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
          message: 'Template was not found.',
          status: 404,
        });
      }

      const templates = {
        [`${CHANNELS.SMS}:SMS_PICKUP`]: {
          channel: CHANNELS.SMS,
          templateCode: 'SMS_PICKUP',
          body: 'Pickup code ##code##',
          title: 'Pickup',
        },
        [`${CHANNELS.ALIMTALK}:ORDER_READY`]: {
          channel: CHANNELS.ALIMTALK,
          templateCode: 'ORDER_READY',
          buttons: [{ type: 'WL', name: 'Open', linkMo: 'https://example.com' }],
          quickReplies: [],
        },
        [`${CHANNELS.BRAND_MESSAGE}:BRAND_TEMPLATE_1`]: {
          channel: CHANNELS.BRAND_MESSAGE,
          templateCode: 'BRAND_TEMPLATE_1',
        },
      };
      const template = templates[`${channel}:${templateCode}`];

      if (!template) {
        throw new RelayError({
          code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
          message: 'Template was not found.',
          status: 404,
        });
      }

      return { channel, template };
    }),
  };
}

function createMemoryDispatchRepository(overrides = {}) {
  return {
    users: overrides.users ?? [createUser()],
    billingAccounts: overrides.billingAccounts ?? [createBillingAccount()],
    channelMappings: overrides.channelMappings ?? [createChannelMapping()],
    rules: overrides.rules ?? [createRule()],
    resources: overrides.resources ?? [
      createSenderResource(),
      createSenderResource({
        id: 'sms_resource_1',
        resourceRef: 'smsref1',
        type: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
        value: '15446859',
        displayName: '1544-6859',
        providerStatus: 'approved',
      }),
    ],
    links: overrides.links ?? [
      createSenderResourceLink({ id: 'kakao_link_1', senderResourceId: 'kakao_resource_1' }),
      createSenderResourceLink({ id: 'sms_link_1', senderResourceId: 'sms_resource_1' }),
    ],
    deliveries: overrides.deliveries ?? [],
    auditLogs: [],

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

    async getUserById(userId) {
      return this.users.find((user) => user.id === userId) ?? null;
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

    async getBillingAccountById(billingAccountId) {
      return this.billingAccounts.find((billingAccount) => billingAccount.id === billingAccountId) ?? null;
    },

    async findBillingAccountForUser(userId) {
      return this.billingAccounts.find((billingAccount) => (
        billingAccount.ownerType === 'user' &&
        billingAccount.ownerId === userId
      )) ?? null;
    },

    async findDuplicateDelivery({ channelMappingId, externalEventId, automationRuleId }) {
      return this.deliveries.find((delivery) => (
        delivery.channelMappingId === channelMappingId &&
        delivery.externalEventId === externalEventId &&
        delivery.automationRuleId === automationRuleId
      )) ?? null;
    },

    async findRecentDeliveryForCooldown({ automationRuleId, excludeDeliveryId = null, targetRefHash, since } = {}) {
      return this.deliveries
        .filter((delivery) => (
          delivery.automationRuleId === automationRuleId &&
          delivery.id !== excludeDeliveryId &&
          delivery.targetRefHash === targetRefHash &&
          new Date(delivery.createdAt).getTime() >= new Date(since).getTime()
        ))
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null;
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

    async updateDelivery({ deliveryId, values, now = FIXED_NOW }) {
      const delivery = this.deliveries.find((item) => item.id === deliveryId);
      if (!delivery) return null;

      Object.assign(delivery, values, { updatedAt: now });
      return delivery;
    },

    async markDeliverySent({ deliveryId, messageSendGroupId, now = FIXED_NOW }) {
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

    async markDeliveryUnsent({ deliveryId, reasonCode, reasonMessage, now = FIXED_NOW }) {
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

    async markDeliveryFailed({ deliveryId, reasonCode, reasonMessage, now = FIXED_NOW }) {
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

    async markDeliveryPayloadPurged({ deliveryId, now = FIXED_NOW }) {
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

    async createAuditLog(values) {
      const auditLog = {
        id: `audit_${this.auditLogs.length + 1}`,
        createdAt: FIXED_NOW,
        ...values,
      };
      this.auditLogs.push(auditLog);
      return auditLog;
    },
  };
}

function createMemoryPublEventRepository(overrides = {}) {
  const events = overrides.events ?? [createEvent({
    props: [
      createProp({ alias: 'targetPhoneNumber', rawPath: 'targetPhoneNumber' }),
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

function createMemoryLedgerRepository() {
  return {
    groups: [],
    providerRequests: [],
    async createGroupWithProviderRequests({ group, providerRequests = [], now }) {
      const createdGroup = {
        id: `ledger_group_${this.groups.length + 1}`,
        ...group,
        createdAt: group.createdAt ?? now,
      };
      const createdRequests = providerRequests.map((request) => ({
        id: `ledger_request_${this.providerRequests.length + 1}`,
        groupId: createdGroup.id,
        ...request,
        createdAt: now,
      }));

      this.groups.push(createdGroup);
      this.providerRequests.push(...createdRequests);

      return {
        group: createdGroup,
        providerRequests: createdRequests,
      };
    },
  };
}

function createEnvelope(overrides = {}) {
  return {
    eventKey: 'order.created',
    externalEventId: 'evt_1',
    channelCode: 'store_1',
    occurredAt: '2026-06-21T11:55:00.000Z',
    payload: {
      targetPhoneNumber: '010-1234-5678',
    },
    ...overrides,
  };
}

function createUser(overrides = {}) {
  return {
    id: 'user_1',
    userRef: 'u1ref',
    email: 'user@example.com',
    status: 'active',
    isOperator: false,
    ...overrides,
  };
}

function createBillingAccount(overrides = {}) {
  return {
    id: 'billing_1',
    billingRef: 'b1ref',
    ownerType: 'user',
    ownerId: 'user_1',
    status: 'active',
    ...overrides,
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
    sendChannel: CHANNELS.ALIMTALK,
    senderResourceId: 'kakao_resource_1',
    templateCode: 'ORDER_READY',
    templateSource: 'SENDER_PROFILE',
    variableMappingJson: {},
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
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
    label: null,
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
    type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
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
    sendChannel: CHANNELS.ALIMTALK,
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
