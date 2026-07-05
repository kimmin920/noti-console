import { describe, expect, it } from 'vitest';

import { RELAY_ERROR_CODES } from '../relay/constants.js';
import { createPublEventEditorService } from '../publEvents/service.js';
import {
  toPublEventCatalogListView,
  toPublEventDetailView,
} from '../publEvents/views.js';

const BASE_UPDATED_AT = new Date('2026-06-26T12:00:00.000Z');
const SAVE_NOW = new Date('2026-06-26T12:30:00.000Z');

describe('PUBL event editor service', () => {
  it('lets an operator update event metadata', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });

    const result = await service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        event: { displayName: 'Order created updated' },
      }),
    });

    expect(result.event).toMatchObject({
      eventKey: 'ORDER_CREATED',
      displayName: 'Order created updated',
      updatedAt: SAVE_NOW,
    });
    expect(repository.updateCalls).toHaveLength(1);
  });

  it('lets an operator create a DB-owned event with the default variable contract', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });

    const result = await service.createPublEventDefinition({
      actor: createOperatorActor(),
      payload: {
        event: {
          eventKey: 'CUSTOM_MESSAGE_READY',
          displayName: 'Custom message ready',
          locationType: 'P_APP',
          locationId: 'X00004',
          sourceType: 'message',
          actionType: 'ready',
        },
      },
    });

    expect(result.event).toMatchObject({
      eventKey: 'CUSTOM_MESSAGE_READY',
      displayName: 'Custom message ready',
      locationType: 'P_APP',
      locationId: 'X00004',
      serviceStatus: null,
      updatedAt: SAVE_NOW,
    });
    expect(result.props.map((prop) => [prop.alias, prop.rawPath, prop.required, prop.enabled])).toEqual([
      ['targetPhoneNumber', 'targetPhoneNumber', true, true],
      ['eventKey', 'eventKey', true, true],
      ['channelCode', 'channelCode', true, true],
    ]);
    expect(repository.createCalls).toHaveLength(1);
  });

  it('lets an operator create a DB-owned event with a selected variable contract', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });

    const result = await service.createPublEventDefinition({
      actor: createOperatorActor(),
      payload: {
        event: {
          eventKey: 'CUSTOM_PAYMENT_READY',
          displayName: 'Custom payment ready',
        },
        props: [
          createNewPropPayload('targetPhoneNumber', {
            label: '수신자 전화번호',
            required: true,
            sample: '010-1234-1234',
          }),
          createNewPropPayload('eventKey', {
            label: '이벤트 키',
            required: true,
          }),
          createNewPropPayload('channelCode', {
            label: '채널 코드',
            required: true,
          }),
          createNewPropPayload('targetName', {
            label: '고객명',
            sample: '김민준',
          }),
          createNewPropPayload('paymentAmount', {
            label: '결제금액',
            sample: '49000',
            type: 'number',
          }),
        ],
      },
    });

    expect(result.props.map((prop) => [prop.alias, prop.rawPath, prop.type, prop.required])).toEqual([
      ['targetPhoneNumber', 'targetPhoneNumber', 'text', true],
      ['eventKey', 'eventKey', 'text', true],
      ['channelCode', 'channelCode', 'text', true],
      ['targetName', 'targetName', 'text', false],
      ['paymentAmount', 'paymentAmount', 'number', false],
    ]);
    expect(result.props.map((prop) => prop.sortOrder)).toEqual([0, 1, 2, 3, 4]);
    expect(result.props[1].sample).toBe('CUSTOM_PAYMENT_READY');
  });

  it('rejects duplicate event creation with 409', async () => {
    const service = createTestService();

    await expect(service.createPublEventDefinition({
      actor: createOperatorActor(),
      payload: {
        event: {
          eventKey: 'ORDER_CREATED',
          displayName: 'Duplicate order created',
        },
      },
    })).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      status: 409,
    });
  });

  it('rejects a non-operator mutation with FORBIDDEN', async () => {
    const service = createTestService();

    await expect(service.savePublEventEditorDraft({
      actor: createUserActor({ isOperator: false }),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload(),
    })).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.FORBIDDEN,
    });
  });

  it('rejects unknown events with 404', async () => {
    const service = createTestService({ repository: createMemoryRepository({ events: [] }) });

    await expect(service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'MISSING_EVENT',
      payload: createEditorPayload({ event: { eventKey: 'MISSING_EVENT' } }),
    })).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      status: 404,
    });
  });

  it('lets an operator delete an unconnected DB-owned event', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });

    const result = await service.deletePublEventDefinition({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: {
        confirmation: 'DELETE_EVENT',
        eventKey: 'ORDER_CREATED',
      },
    });

    expect(result).toMatchObject({
      deleted: true,
      eventKey: 'ORDER_CREATED',
    });
    expect(repository.deleteCalls).toEqual([{ eventKey: 'ORDER_CREATED' }]);
    expect(await repository.findEventByKey('ORDER_CREATED')).toBeNull();
    expect(await repository.listPropsByEventId('event_1')).toEqual([]);
  });

  it('rejects event deletion when the typed eventKey does not match', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });

    await expect(service.deletePublEventDefinition({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: {
        confirmation: 'DELETE_EVENT',
        eventKey: 'ORDER_RENAMED',
      },
    })).rejects.toThrow(/eventKey confirmation/i);
    expect(repository.deleteCalls).toHaveLength(0);
  });

  it('blocks event deletion when automations or delivery history are connected', async () => {
    const repository = createMemoryRepository({
      connectionCounts: {
        automationRules: 1,
        deliveries: 2,
      },
    });
    const service = createTestService({ repository });

    await expect(service.deletePublEventDefinition({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: {
        confirmation: 'DELETE_EVENT',
        eventKey: 'ORDER_CREATED',
      },
    })).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      status: 409,
    });
    expect(repository.deleteCalls).toHaveLength(0);
  });

  it('rejects absent or changed eventKey values because eventKey cannot be changed', async () => {
    const service = createTestService({
      repository: createMemoryRepository({
        events: [createEvent(), createEvent({ id: 'event_2', eventKey: 'ORDER_RENAMED' })],
      }),
    });

    await expect(service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({ event: { eventKey: 'ORDER_RENAMED' } }),
    })).rejects.toThrow(/eventKey/i);

    const missingEventKeyPayload = createEditorPayload();
    delete missingEventKeyPayload.event.eventKey;

    await expect(service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: missingEventKeyPayload,
    })).rejects.toThrow(/eventKey/i);
  });

  it('rejects stale baseUpdatedAt with STALE_PUBL_EVENT_EDITOR_DRAFT', async () => {
    const service = createTestService();

    await expect(service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({ baseUpdatedAt: '2026-06-26T11:00:00.000Z' }),
    })).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      state: 'STALE_PUBL_EVENT_EDITOR_DRAFT',
    });
  });

  it('rejects unsupported payload, event, and prop fields', async () => {
    const service = createTestService();

    await expect(service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: { ...createEditorPayload(), unsupported: true },
    })).rejects.toThrow(/unsupported/i);

    await expect(service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({ event: { unsupported: true } }),
    })).rejects.toThrow(/unsupported/i);

    const rejectingService = createTestService();

    await expect(rejectingService.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [
          createPropPayload('targetPhoneNumber', { unsupported: true }),
          createPropPayload('targetName'),
        ],
      }),
    })).rejects.toThrow(/unsupported/i);

    await expect(service.createPublEventDefinition({
      actor: createOperatorActor(),
      payload: {
        event: {
          eventKey: 'CUSTOM_UNSUPPORTED_PROP',
          displayName: 'Custom unsupported prop',
        },
        props: [
          createNewPropPayload('targetPhoneNumber', { unsupported: true }),
        ],
      },
    })).rejects.toThrow(/unsupported/i);
  });

  it('rejects duplicate originalAlias and duplicate alias values', async () => {
    const service = createTestService();

    await expect(service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [
          createPropPayload('targetPhoneNumber'),
          createPropPayload('targetPhoneNumber', { label: '다른 이름' }),
        ],
      }),
    })).rejects.toThrow(/Duplicate originalAlias/i);

    await expect(service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [
          createPropPayload('targetPhoneNumber'),
          createPropPayload('targetName'),
          {
            originalAlias: null,
            rawPath: 'payload.duplicate',
            alias: 'targetPhoneNumber',
            label: '중복 변수',
            type: 'text',
            required: false,
            enabled: true,
            fallback: null,
            description: null,
            parserPipeline: null,
          },
        ],
      }),
    })).rejects.toThrow(/Duplicate alias/i);
  });

  it('rejects alias and label-derived variable-key collisions', async () => {
    const service = createTestService();

    const rejectingService = createTestService();

    await expect(rejectingService.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [
          createPropPayload('targetPhoneNumber', { label: '주문 번호' }),
          createPropPayload('targetName', { label: '주문번호' }),
        ],
      }),
    })).rejects.toThrow(/label-derived/i);

    await expect(service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [
          createPropPayload('targetPhoneNumber', { alias: 'orderNumber' }),
          createPropPayload('targetName', { label: 'order Number' }),
        ],
        dangerousChangeConfirmations: {
          alias: [
            {
              originalAlias: 'targetPhoneNumber',
              from: 'targetPhoneNumber',
              to: 'orderNumber',
              confirmation: 'CHANGE_ALIAS',
            },
          ],
        },
      }),
    })).rejects.toThrow(/collision/i);
  });

  it('adds a new prop, updates an existing prop, and preserves required and enabled booleans independently', async () => {
    const service = createTestService();

    const result = await service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [
          createPropPayload('targetPhoneNumber', {
            enabled: false,
            label: '수신자 번호 수정',
            required: true,
            sample: '010-0000-0000',
          }),
          createPropPayload('targetName'),
          {
            originalAlias: null,
            rawPath: 'payload.orderNo',
            alias: 'orderNo',
            label: '주문 번호',
            type: 'text',
            required: false,
            enabled: true,
            fallback: null,
            sample: 'ORD-123',
            description: null,
            parserPipeline: null,
          },
        ],
      }),
    });

    expect(result.props.map((prop) => prop.alias)).toEqual(['targetPhoneNumber', 'targetName', 'orderNo']);
    expect(result.props.map((prop) => prop.sortOrder)).toEqual([0, 1, 2]);
    expect(result.props[0]).toMatchObject({
      alias: 'targetPhoneNumber',
      enabled: false,
      label: '수신자 번호 수정',
      required: true,
      sample: '010-0000-0000',
    });
    expect(result.props[2]).toMatchObject({
      alias: 'orderNo',
      sample: 'ORD-123',
    });
  });

  it('accepts boolean and object prop types from the editor payload', async () => {
    const service = createTestService();

    const result = await service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [
          createPropPayload('targetPhoneNumber', { type: 'boolean' }),
          createPropPayload('targetName', { type: 'object' }),
        ],
      }),
    });

    expect(result.props.map((prop) => [prop.alias, prop.type])).toEqual([
      ['targetPhoneNumber', 'boolean'],
      ['targetName', 'object'],
    ]);
  });

  it('rejects unsupported prop types with the full supported type list', async () => {
    const service = createTestService();

    await expect(service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [
          createPropPayload('targetPhoneNumber', { type: 'file' }),
          createPropPayload('targetName'),
        ],
      }),
    })).rejects.toThrow(/text, number, datetime, boolean, enum, object, or array/i);
  });

  it('clears a saved sample to null without changing fallback semantics', async () => {
    const repository = createMemoryRepository({
      propsByEventId: {
        event_1: [
          createProp({
            alias: 'targetPhoneNumber',
            label: '수신자 번호',
            rawPath: 'targetPhoneNumber',
            sample: '010-0000-0000',
          }),
          createProp({
            alias: 'targetName',
            fallback: '고객',
            label: '고객명',
            rawPath: 'targetName',
            sample: '홍길동',
            sortOrder: 1,
          }),
        ],
      },
    });
    const service = createTestService({ repository });

    const result = await service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [
          createPropPayload('targetPhoneNumber', { sample: null }),
          createPropPayload('targetName', { fallback: '고객', sample: null }),
        ],
      }),
    });

    expect(result.props[0]).toMatchObject({
      alias: 'targetPhoneNumber',
      fallback: null,
      sample: null,
    });
    expect(result.props[1]).toMatchObject({
      alias: 'targetName',
      fallback: '고객',
      sample: null,
    });
  });

  it('deletes an existing prop when DELETE_PROP confirmation is present', async () => {
    const service = createTestService();

    const result = await service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [createPropPayload('targetPhoneNumber')],
        deletedAliases: [{ originalAlias: 'targetName', confirmation: 'DELETE_PROP' }],
      }),
    });

    expect(result.props.map((prop) => prop.alias)).toEqual(['targetPhoneNumber']);
  });

  it('rejects an omitted existing prop unless it has DELETE_PROP confirmation', async () => {
    const service = createTestService();

    await expect(service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [createPropPayload('targetPhoneNumber')],
      }),
    })).rejects.toThrow(/Omitted existing prop/i);
  });

  it('rejects rawPath changes without rawPath unlock confirmation', async () => {
    const service = createTestService();

    await expect(service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [
          createPropPayload('targetPhoneNumber', { rawPath: 'payload.phone' }),
          createPropPayload('targetName'),
        ],
      }),
    })).rejects.toThrow(/rawPath.*unlock/i);

    const result = await service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [
          createPropPayload('targetPhoneNumber', { rawPath: 'payload.phone' }),
          createPropPayload('targetName'),
        ],
        dangerousChangeConfirmations: {
          rawPath: [
            {
              originalAlias: 'targetPhoneNumber',
              from: 'targetPhoneNumber',
              to: 'payload.phone',
              confirmation: 'CHANGE_RAW_PATH',
            },
          ],
        },
      }),
    });

    expect(result.props[0].rawPath).toBe('payload.phone');
  });

  it('rejects alias changes without alias unlock confirmation', async () => {
    const service = createTestService();

    await expect(service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [
          createPropPayload('targetPhoneNumber', { alias: 'recipientPhone' }),
          createPropPayload('targetName'),
        ],
      }),
    })).rejects.toThrow(/alias.*unlock/i);

    const result = await service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [
          createPropPayload('targetPhoneNumber', { alias: 'recipientPhone' }),
          createPropPayload('targetName'),
        ],
        dangerousChangeConfirmations: {
          alias: [
            {
              originalAlias: 'targetPhoneNumber',
              from: 'targetPhoneNumber',
              to: 'recipientPhone',
              confirmation: 'CHANGE_ALIAS',
            },
          ],
        },
      }),
    });

    expect(result.props[0].alias).toBe('recipientPhone');
  });

  it('validates parser pipeline format and rejects unsupported parserPipeline step types', async () => {
    const service = createTestService();
    const supportedParserPipeline = [
      { type: 'fallback', fallback: '010-0000-0000' },
      { type: 'phoneFormat' },
      { type: 'truncate', maxLength: 13 },
      { type: 'replace', from: '-', to: '' },
    ];

    const result = await service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [
          createPropPayload('targetPhoneNumber', {
            parserPipeline: supportedParserPipeline,
          }),
          createPropPayload('targetName', {
            parserPipeline: [
              { type: 'firstItem' },
              { type: 'mapTemplate', template: '{{name}}' },
              { type: 'join', separator: ', ' },
              { type: 'dateFormat', format: 'yyyy년 M월 d일 HH:mm' },
              { type: 'currencyFormat', locale: 'ko-KR', currency: 'KRW' },
            ],
          }),
        ],
      }),
    });

    expect(result.props[0].parserPipeline).toEqual(supportedParserPipeline);
    expect(result.props[1].parserPipeline.map((step) => step.type)).toEqual([
      'firstItem',
      'mapTemplate',
      'join',
      'dateFormat',
      'currencyFormat',
    ]);

    const rejectingService = createTestService();

    await expect(rejectingService.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [
          createPropPayload('targetPhoneNumber', {
            parserPipeline: [{ type: 'normalizePhone' }],
          }),
          createPropPayload('targetName'),
        ],
      }),
    })).rejects.toThrow(/Unsupported parser pipeline step type/i);
  });

  it('returns detail sample while keeping forbidden source metadata out after mutation', async () => {
    const repository = createMemoryRepository({
      events: [
        createEvent({
          defaultTemplate: { templateCode: 'IGNORED_TEMPLATE' },
          providerTemplates: [{ templateCode: 'IGNORED_PROVIDER_TEMPLATE' }],
        }),
      ],
      propsByEventId: {
        event_1: [
          createProp({ sample: '010-0000-0000' }),
          createProp({ alias: 'targetName', label: '고객명', rawPath: 'targetName', sortOrder: 1 }),
        ],
      },
    });
    const service = createTestService({ repository });

    const result = await service.savePublEventEditorDraft({
      actor: createOperatorActor(),
      eventKey: 'ORDER_CREATED',
      payload: createEditorPayload({
        props: [
          createPropPayload('targetPhoneNumber', { sample: '010-0000-0000' }),
          createPropPayload('targetName'),
        ],
      }),
    });
    const detailView = toPublEventDetailView(result.event, result.props);
    const listView = toPublEventCatalogListView([{ ...result.event, props: result.props }]);
    const serialized = JSON.stringify({ detailView, listView });

    expect(detailView.props[0]).toHaveProperty('sample', '010-0000-0000');
    expect(listView.events[0]).not.toHaveProperty('props');
    expect(JSON.stringify(listView)).not.toContain('010-0000-0000');
    expect(serialized).not.toContain('IGNORED_TEMPLATE');
    expect(serialized).not.toContain('IGNORED_PROVIDER_TEMPLATE');
    expect(listView.events[0].variableOptions[0]).not.toHaveProperty('rawPath');
  });
});

function createTestService({ repository = createMemoryRepository() } = {}) {
  return createPublEventEditorService({
    repository,
    now: () => SAVE_NOW,
  });
}

function createEditorPayload({
  baseUpdatedAt = BASE_UPDATED_AT.toISOString(),
  event = {},
  props = [createPropPayload('targetPhoneNumber'), createPropPayload('targetName')],
  deletedAliases = [],
  dangerousChangeConfirmations = {},
} = {}) {
  return {
    baseUpdatedAt,
    event: {
      eventKey: 'ORDER_CREATED',
      displayName: 'Order created',
      locationType: 'P_APP',
      locationId: 'A00001',
      sourceType: 'order',
      actionType: 'created',
      ...event,
    },
    props,
    deletedAliases,
    dangerousChangeConfirmations,
  };
}

function createPropPayload(originalAlias, overrides = {}) {
  const existing = createProp({ alias: originalAlias });

  return {
    originalAlias,
    rawPath: existing.rawPath,
    alias: existing.alias,
    label: existing.label,
    type: existing.type,
    required: existing.required,
    enabled: existing.enabled,
    fallback: existing.fallback,
    sample: existing.sample,
    description: existing.description,
    parserPipeline: existing.parserPipeline,
    ...overrides,
  };
}

function createNewPropPayload(alias, overrides = {}) {
  const existing = createProp({ alias });

  return {
    rawPath: existing.rawPath,
    alias: existing.alias,
    label: existing.label,
    type: existing.type,
    required: existing.required,
    enabled: existing.enabled,
    fallback: existing.fallback,
    sample: existing.sample,
    description: existing.description,
    parserPipeline: existing.parserPipeline,
    ...overrides,
  };
}

function createMemoryRepository(overrides = {}) {
  const events = [...(overrides.events ?? [createEvent()])];
  const connectionCounts = overrides.connectionCounts ?? {
    automationRules: 0,
    deliveries: 0,
  };
  const propsByEventId = new Map(
    Object.entries(overrides.propsByEventId ?? {
      event_1: [
        createProp({ alias: 'targetPhoneNumber', label: '수신자 번호', rawPath: 'targetPhoneNumber' }),
        createProp({ alias: 'targetName', label: '고객명', rawPath: 'targetName', sortOrder: 1 }),
      ],
    }).map(([eventId, props]) => [eventId, [...props]])
  );

  return {
    events,
    propsByEventId,
    createCalls: [],
    deleteCalls: [],
    updateCalls: [],

    async findEventByKey(eventKey) {
      return this.events.find((event) => event.eventKey === eventKey) ?? null;
    },

    async listPropsByEventId(eventId) {
      return this.propsByEventId.get(eventId) ?? [];
    },

    async createEventDefinition({ event, props, now }) {
      this.createCalls.push({ event, props, now });

      const createdEvent = {
        ...event,
        eventType: 'publ-event',
        id: `event_${this.events.length + 1}`,
        updatedAt: now,
      };
      const createdProps = props.map((prop, index) => ({
        ...prop,
        eventId: createdEvent.id,
        id: `prop_${this.events.length + 1}_${index + 1}`,
        propType: prop.type,
        parserPipelineJson: prop.parserPipeline,
        updatedAt: now,
      }));

      this.events.push(createdEvent);
      this.propsByEventId.set(createdEvent.id, createdProps);

      return {
        event: createdEvent,
        props: createdProps,
      };
    },

    async countEventConnections() {
      return {
        automationRules: Number(connectionCounts.automationRules ?? 0),
        deliveries: Number(connectionCounts.deliveries ?? 0),
      };
    },

    async deleteEventDefinition({ eventKey }) {
      this.deleteCalls.push({ eventKey });

      const eventIndex = this.events.findIndex((candidate) => candidate.eventKey === eventKey);
      if (eventIndex === -1) return null;

      const [deletedEvent] = this.events.splice(eventIndex, 1);
      this.propsByEventId.delete(deletedEvent.id);

      return deletedEvent;
    },

    async updateEventEditorDraft({ eventKey, event, props, deletedAliases, now }) {
      this.updateCalls.push({ eventKey, event, props, deletedAliases, now });

      const eventIndex = this.events.findIndex((candidate) => candidate.eventKey === eventKey);
      const currentEvent = this.events[eventIndex];
      const deletedAliasSet = new Set(deletedAliases.map((entry) => entry.originalAlias));
      const currentProps = this.propsByEventId.get(currentEvent.id) ?? [];
      const byOriginalAlias = new Map(currentProps.map((prop) => [prop.alias, prop]));
      const nextProps = props.map((prop) => {
        const previous = prop.originalAlias === null ? {} : byOriginalAlias.get(prop.originalAlias);

        return {
          ...previous,
          sortOrder: prop.sortOrder,
          rawPath: prop.rawPath,
          alias: prop.alias,
          label: prop.label,
          type: prop.type,
          propType: prop.type,
          required: prop.required,
          enabled: prop.enabled,
          fallback: prop.fallback,
          sample: prop.sample,
          parserPipeline: prop.parserPipeline,
          parserPipelineJson: prop.parserPipeline,
          description: prop.description,
          updatedAt: now,
        };
      });

      this.events[eventIndex] = {
        ...currentEvent,
        ...event,
        updatedAt: now,
      };
      this.propsByEventId.set(
        currentEvent.id,
        nextProps
          .filter((prop) => !deletedAliasSet.has(prop.alias))
          .sort((left, right) => left.sortOrder - right.sortOrder)
      );

      return {
        event: this.events[eventIndex],
        props: this.propsByEventId.get(currentEvent.id),
      };
    },
  };
}

function createOperatorActor() {
  return createUserActor({ isOperator: true });
}

function createUserActor({ isOperator = false } = {}) {
  return {
    user: {
      id: isOperator ? 'operator_1' : 'user_1',
      isOperator,
    },
  };
}

function createEvent(overrides = {}) {
  return {
    id: 'event_1',
    eventKey: 'ORDER_CREATED',
    eventType: 'publ-event',
    displayName: 'Order created',
    serviceStatus: 'active',
    locationType: 'P_APP',
    locationId: 'A00001',
    sourceType: 'order',
    actionType: 'created',
    updatedAt: BASE_UPDATED_AT,
    ...overrides,
  };
}

function createProp(overrides = {}) {
  const alias = overrides.alias ?? 'targetPhoneNumber';
  const defaults = {
    targetPhoneNumber: {
      rawPath: 'targetPhoneNumber',
      label: '수신자 번호',
    },
    targetName: {
      rawPath: 'targetName',
      label: '고객명',
    },
  }[alias] ?? {
    rawPath: alias,
    label: alias,
  };

  return {
    sortOrder: 0,
    rawPath: defaults.rawPath,
    alias,
    label: defaults.label,
    type: 'text',
    propType: 'text',
    required: false,
    enabled: true,
    fallback: null,
    sample: null,
    parserPipeline: null,
    parserPipelineJson: null,
    description: null,
    ...overrides,
  };
}
