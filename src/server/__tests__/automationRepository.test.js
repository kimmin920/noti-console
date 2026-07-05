import { describe, expect, it } from 'vitest';

import {
  automationDeliveryKeyMatches,
  createAutomationDeliveryKey,
  createAutomationRepository,
  isExpiredAutomationDeliveryPayload,
  toAutomationDeliveryDto,
  toAutomationRuleDto,
  toAutomationRuleRevisionDto,
  toAutomationDeliveryEncryptedPayload,
} from '../automations/repository.js';

const FIXED_NOW = new Date('2026-06-21T12:00:00.000Z');
const EXPIRED_AT = new Date('2026-06-21T11:59:00.000Z');
const FUTURE_AT = new Date('2026-06-21T12:01:00.000Z');

describe('automation repository contract', () => {
  it('exposes the required automation repository methods', () => {
    const repository = createAutomationRepository({});

    expect(repository.findActiveChannelMappingByCode).toEqual(expect.any(Function));
    expect(repository.listActiveRulesForUserEvent).toEqual(expect.any(Function));
    expect(repository.listAutomationRulesForUser).toEqual(expect.any(Function));
    expect(repository.findAutomationRuleForUser).toEqual(expect.any(Function));
    expect(repository.findEventDefinitionById).toEqual(expect.any(Function));
    expect(repository.createAutomationRule).toEqual(expect.any(Function));
    expect(repository.updateAutomationRule).toEqual(expect.any(Function));
    expect(repository.enableAutomationRule).toEqual(expect.any(Function));
    expect(repository.disableAutomationRule).toEqual(expect.any(Function));
    expect(repository.archiveAutomationRule).toEqual(expect.any(Function));
    expect(repository.createAutomationRuleRevision).toEqual(expect.any(Function));
    expect(repository.listAutomationRuleRevisions).toEqual(expect.any(Function));
    expect(repository.createDelivery).toEqual(expect.any(Function));
    expect(repository.findDuplicateDelivery).toEqual(expect.any(Function));
    expect(repository.findRecentDeliveryForCooldown).toEqual(expect.any(Function));
    expect(repository.listUnsentDeliveriesForUser).toEqual(expect.any(Function));
    expect(repository.findUnsentDeliveryForUser).toEqual(expect.any(Function));
    expect(repository.findUnsentDeliveryWithEncryptedPayloadForUser).toEqual(expect.any(Function));
    expect(repository.markDeliverySent).toEqual(expect.any(Function));
    expect(repository.markDeliveryUnsent).toEqual(expect.any(Function));
    expect(repository.markDeliveryDismissed).toEqual(expect.any(Function));
    expect(repository.markDeliveryFailed).toEqual(expect.any(Function));
    expect(repository.markDeliveryPayloadPurged).toEqual(expect.any(Function));
    expect(repository.listExpiredDeliveryPayloads).toEqual(expect.any(Function));
  });

  it('projects browser-facing delivery DTOs without encrypted fields or raw values', () => {
    const dto = toAutomationDeliveryDto({
      id: 'delivery_1',
      userId: 'user_1',
      channelMappingId: 'mapping_1',
      automationRuleId: 'rule_1',
      eventDefinitionId: 'event_definition_1',
      externalEventId: 'evt_1',
      eventKey: 'order.created',
      channelCode: 'store_1',
      sendChannel: 'alimtalk',
      status: 'unsent',
      reasonCode: 'missing_template',
      targetPhoneMasked: '010****5678',
      targetPhoneNumber: '01012345678',
      targetRefHash: 'hashed-target-ref',
      eventPayloadCiphertext: 'ciphertext-containing-private-data',
      eventPayloadIv: 'iv',
      eventPayloadTag: 'tag',
      eventPayloadVersion: 1,
      plaintextPayload: {
        orderId: 'order_123',
      },
      payloadExpiresAt: EXPIRED_AT,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    const serialized = JSON.stringify(dto);

    expect(dto).not.toHaveProperty('eventPayloadCiphertext');
    expect(dto).not.toHaveProperty('eventPayloadIv');
    expect(dto).not.toHaveProperty('eventPayloadTag');
    expect(dto).not.toHaveProperty('eventPayloadVersion');
    expect(dto).not.toHaveProperty('plaintextPayload');
    expect(dto).not.toHaveProperty('targetPhoneNumber');
    expect(dto).not.toHaveProperty('targetRefHash');
    expect(serialized).not.toContain('01012345678');
    expect(serialized).not.toContain('order_123');
    expect(dto).toMatchObject({
      id: 'delivery_1',
      status: 'unsent',
      targetPhoneMasked: '010****5678',
    });
  });

  it('projects browser-managed rule DTOs without provider payloads or sample values', () => {
    const dto = toAutomationRuleDto({
      id: 'rule_1',
      userId: 'user_1',
      eventDefinitionId: 'event_definition_1',
      name: 'Order ready',
      status: 'disabled',
      sendChannel: 'alimtalk',
      senderResourceId: 'kakao_resource_1',
      templateCode: 'ORDER_READY',
      templateSource: 'SENDER_PROFILE',
      variableMappingJson: { orderNo: 'orderId' },
      recipientMappingJson: { type: 'event_alias', alias: 'targetPhoneNumber' },
      conditionJson: { all: [{ alias: 'orderStatus', operator: 'equals', value: 'READY' }] },
      cooldownPolicyJson: { enabled: true, windowSeconds: 300 },
      validationSnapshotJson: { success: true, configHash: 'hash_1' },
      validatedConfigHash: 'hash_1',
      lastValidatedAt: FIXED_NOW,
      providerRequestBody: { recipientNo: '01012345678' },
      providerResponseBody: { raw: true },
      samplePayload: { orderId: 'order_123' },
      templateBody: 'Order #{orderNo} is ready.',
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    const serialized = JSON.stringify(dto);

    expect(dto).not.toHaveProperty('providerRequestBody');
    expect(dto).not.toHaveProperty('providerResponseBody');
    expect(dto).not.toHaveProperty('samplePayload');
    expect(dto).not.toHaveProperty('templateBody');
    expect(serialized).not.toContain('01012345678');
    expect(serialized).not.toContain('order_123');
    expect(serialized).not.toContain('Order #{orderNo}');
    expect(dto).toMatchObject({
      id: 'rule_1',
      status: 'disabled',
      templateCode: 'ORDER_READY',
      variableMappingJson: { orderNo: 'orderId' },
    });
  });

  it('projects rule revision DTOs as safe audit evidence only', () => {
    const dto = toAutomationRuleRevisionDto({
      id: 'revision_1',
      automationRuleId: 'rule_1',
      actorUserId: 'user_1',
      revisionNumber: 1,
      action: 'validate',
      statusBefore: 'disabled',
      statusAfter: 'disabled',
      configSnapshotJson: {
        eventKey: 'order.created',
        sendChannel: 'alimtalk',
        templateCode: 'ORDER_READY',
        variableMapping: { orderNo: 'orderId' },
        rawRecipientPhone: '01012345678',
      },
      validationSnapshotJson: {
        success: true,
        samplePayload: { orderId: 'order_123' },
      },
      createdAt: FIXED_NOW,
      rawProviderResponse: { resultCode: 0 },
    });
    const serialized = JSON.stringify(dto);

    expect(dto).not.toHaveProperty('rawProviderResponse');
    expect(serialized).not.toContain('01012345678');
    expect(serialized).not.toContain('order_123');
    expect(dto).toMatchObject({
      automationRuleId: 'rule_1',
      action: 'validate',
      configSnapshotJson: {
        templateCode: 'ORDER_READY',
      },
    });
  });

  it('matches duplicate deliveries by channel mapping, external event, and automation rule', async () => {
    const repository = createMemoryAutomationRepository([
      createDeliveryRow({
        id: 'delivery_rule_1',
        automationRuleId: 'rule_1',
        externalEventId: 'evt_1',
      }),
      createDeliveryRow({
        id: 'delivery_rule_2',
        automationRuleId: 'rule_2',
        externalEventId: 'evt_1',
      }),
    ]);

    expect(createAutomationDeliveryKey({
      channelMappingId: 'mapping_1',
      externalEventId: ' evt_1 ',
      automationRuleId: 'rule_1',
    })).toEqual({
      channelMappingId: 'mapping_1',
      externalEventId: 'evt_1',
      automationRuleId: 'rule_1',
    });
    await expect(repository.findDuplicateDelivery({
      channelMappingId: 'mapping_1',
      externalEventId: 'evt_1',
      automationRuleId: 'rule_1',
    })).resolves.toMatchObject({
      id: 'delivery_rule_1',
    });
    await expect(repository.findDuplicateDelivery({
      channelMappingId: 'mapping_1',
      externalEventId: 'evt_1',
      automationRuleId: 'rule_2',
    })).resolves.toMatchObject({
      id: 'delivery_rule_2',
    });
    await expect(repository.findDuplicateDelivery({
      channelMappingId: 'mapping_1',
      externalEventId: 'evt_1',
      automationRuleId: 'rule_missing',
    })).resolves.toBeNull();
  });

  it('keeps unsent list DTOs safe and only exposes encrypted payloads through the explicit path', async () => {
    const repository = createMemoryAutomationRepository([
      createDeliveryRow({
        id: 'delivery_unsent',
        status: 'unsent',
      }),
      createDeliveryRow({
        id: 'delivery_sent',
        status: 'sent',
      }),
    ]);

    const [listed] = await repository.listUnsentDeliveriesForUser({ userId: 'user_1' });
    const safeDetail = await repository.findUnsentDeliveryForUser({
      deliveryId: 'delivery_unsent',
      userId: 'user_1',
    });
    const encryptedDetail = await repository.findUnsentDeliveryWithEncryptedPayloadForUser({
      deliveryId: 'delivery_unsent',
      userId: 'user_1',
    });

    expect(listed).toMatchObject({ id: 'delivery_unsent', status: 'unsent' });
    expect(listed).not.toHaveProperty('eventPayloadCiphertext');
    expect(safeDetail).not.toHaveProperty('eventPayloadCiphertext');
    expect(encryptedDetail.delivery).not.toHaveProperty('eventPayloadCiphertext');
    expect(encryptedDetail.encryptedPayload).toEqual({
      eventPayloadCiphertext: 'encrypted-event-payload',
      eventPayloadIv: 'payload-iv',
      eventPayloadTag: 'payload-tag',
      eventPayloadVersion: 1,
    });
  });

  it('selects purge candidates by payload expiration and missing purge timestamp', async () => {
    const repository = createMemoryAutomationRepository([
      createDeliveryRow({
        id: 'delivery_expired',
        eventPayloadCiphertext: 'encrypted-event-payload',
        payloadExpiresAt: EXPIRED_AT,
        payloadPurgedAt: null,
      }),
      createDeliveryRow({
        id: 'delivery_future',
        eventPayloadCiphertext: 'encrypted-event-payload',
        payloadExpiresAt: FUTURE_AT,
        payloadPurgedAt: null,
      }),
      createDeliveryRow({
        id: 'delivery_purged',
        eventPayloadCiphertext: 'encrypted-event-payload',
        payloadExpiresAt: EXPIRED_AT,
        payloadPurgedAt: FIXED_NOW,
      }),
      createDeliveryRow({
        id: 'delivery_without_payload',
        eventPayloadCiphertext: null,
        payloadExpiresAt: EXPIRED_AT,
        payloadPurgedAt: null,
      }),
    ]);

    const candidates = await repository.listExpiredDeliveryPayloads({ now: FIXED_NOW });

    expect(candidates.map((candidate) => candidate.id)).toEqual(['delivery_expired']);
    expect(candidates[0]).not.toHaveProperty('eventPayloadCiphertext');
    expect(isExpiredAutomationDeliveryPayload(createDeliveryRow({
      eventPayloadCiphertext: 'encrypted-event-payload',
      payloadExpiresAt: EXPIRED_AT,
      payloadPurgedAt: null,
    }), FIXED_NOW)).toBe(true);
    expect(isExpiredAutomationDeliveryPayload(createDeliveryRow({
      eventPayloadCiphertext: 'encrypted-event-payload',
      payloadExpiresAt: FUTURE_AT,
      payloadPurgedAt: null,
    }), FIXED_NOW)).toBe(false);
  });
});

function createMemoryAutomationRepository(rows = []) {
  return {
    async findDuplicateDelivery(key) {
      return toAutomationDeliveryDto(rows.find((row) => automationDeliveryKeyMatches(row, key)));
    },

    async listUnsentDeliveriesForUser({ userId }) {
      return rows
        .filter((row) => row.userId === userId && row.status === 'unsent')
        .map(toAutomationDeliveryDto);
    },

    async findUnsentDeliveryForUser({ deliveryId, userId }) {
      return toAutomationDeliveryDto(rows.find((row) => (
        row.id === deliveryId &&
        row.userId === userId &&
        row.status === 'unsent'
      )));
    },

    async findUnsentDeliveryWithEncryptedPayloadForUser({ deliveryId, userId }) {
      const row = rows.find((candidate) => (
        candidate.id === deliveryId &&
        candidate.userId === userId &&
        candidate.status === 'unsent'
      ));

      if (!row) return null;

      return {
        delivery: toAutomationDeliveryDto(row),
        encryptedPayload: toAutomationDeliveryEncryptedPayload(row),
      };
    },

    async listExpiredDeliveryPayloads({ now }) {
      return rows
        .filter((row) => isExpiredAutomationDeliveryPayload(row, now))
        .map(toAutomationDeliveryDto);
    },
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
    status: 'unsent',
    reasonCode: null,
    reasonMessage: null,
    targetPhoneMasked: '010****5678',
    targetRefHash: 'hashed-target-ref',
    eventPayloadCiphertext: 'encrypted-event-payload',
    eventPayloadIv: 'payload-iv',
    eventPayloadTag: 'payload-tag',
    eventPayloadVersion: 1,
    payloadExpiresAt: FUTURE_AT,
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
