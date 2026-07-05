import { describe, expect, it } from 'vitest';

import {
  toPublEventCatalogListView,
  toPublEventDetailView,
} from '../publEvents/views.js';

describe('PUBL event catalog view', () => {
  it('summarizes event metadata and prop flags without exposing canonical prop rows', () => {
    const view = toPublEventCatalogListView([
      {
        id: 'event_1',
        eventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
        eventType: 'publ-event',
        displayName: '회원 가입',
        serviceStatus: 'ACTIVE',
        locationType: 'GENERAL',
        locationId: 'CHANNEL',
        sourceType: 'ACCOUNT',
        actionType: 'REGISTER',
        updatedAt: new Date('2026-06-19T03:00:00.000Z'),
        props: [
          {
            alias: 'internalId',
            enabled: false,
            label: '내부 ID',
            parserPipeline: null,
            required: true,
            sortOrder: 1,
            type: 'text',
          },
          {
            alias: 'targetName',
            enabled: true,
            label: '닉네임',
            parserPipeline: [
              { type: 'mapTemplate', template: '#{name}' },
              { type: 'join', separator: ', ' },
            ],
            required: true,
            sortOrder: 0,
            type: 'text',
          },
          {
            alias: 'targetPhoneNumber',
            enabled: true,
            label: '수신자 번호',
            rawPath: 'recipient.phone',
            required: false,
            sortOrder: 2,
            type: 'text',
          },
        ],
      },
    ]);

    expect(view.totals).toEqual({
      events: 1,
      props: 3,
      enabledProps: 2,
      requiredProps: 2,
      parserPipelineProps: 1,
      parserSteps: 2,
    });
    expect(view.events[0]).toEqual(expect.objectContaining({
      eventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
      eventType: 'publ-event',
      propCount: 3,
      enabledPropCount: 2,
      requiredPropCount: 2,
      parserStepCount: 2,
      updatedAt: '2026-06-19T03:00:00.000Z',
      variablePreview: [
        { alias: 'targetName', label: '닉네임', type: 'text' },
        { alias: 'targetPhoneNumber', label: '수신자 번호', type: 'text' },
      ],
    }));
    expect(view.events[0].variableOptions).toEqual([
      { alias: 'targetName', label: '닉네임', required: true, type: 'text' },
      { alias: 'targetPhoneNumber', label: '수신자 번호', required: false, type: 'text' },
    ]);
    expect(view.events[0]).not.toHaveProperty('props');
    expect(JSON.stringify(view.events[0])).not.toContain('recipient.phone');
    expect(view.events[0].variableOptions[0]).not.toHaveProperty('parserPipeline');
    expect(view.events[0].variableOptions[0]).not.toHaveProperty('parserPipelineJson');
    expect(view.events[0]).not.toHaveProperty('category');
  });

  it('defaults missing event type to publ-event for catalog rows', () => {
    const view = toPublEventCatalogListView([{ eventKey: 'ORDER_CREATED', props: [] }]);

    expect(view.events[0].eventType).toBe('publ-event');
  });

  it('returns approved detail internals and sample while keeping ignored source metadata out', () => {
    const view = toPublEventDetailView(
      {
        id: 'event_1',
        eventKey: 'ORDER_DELIVERED',
        displayName: '배송 완료',
        serviceStatus: 'ACTIVE',
        updatedAt: '2026-06-19T03:00:00.000Z',
        defaultTemplate: { templateCode: 'IGNORED_TEMPLATE' },
        providerTemplates: [{ templateCode: 'IGNORED_PROVIDER_TEMPLATE' }],
        rules: [{ senderProfile: { plusFriendId: '@ignored' } }],
      },
      [
        {
          alias: 'customerName',
          enabled: true,
          label: '고객명',
          rawPath: 'customer.name',
          required: false,
          sortOrder: 2,
          type: 'text',
          sample: '홍길동',
        },
        {
          alias: 'targetPhoneNumber',
          enabled: true,
          label: '수신자 번호',
          parserPipeline: [{ type: 'normalizePhone' }],
          rawPath: 'recipient.phone',
          required: true,
          sortOrder: 0,
          type: 'text',
        },
      ]
    );

    expect(view).toEqual(expect.objectContaining({
      eventKey: 'ORDER_DELIVERED',
      propCount: 2,
      enabledPropCount: 2,
      requiredPropCount: 1,
      parserPipelinePropCount: 1,
      parserStepCount: 1,
    }));
    expect(view.props.map((prop) => prop.alias)).toEqual(['targetPhoneNumber', 'customerName']);
    expect(view.props[0]).toEqual(expect.objectContaining({
      alias: 'targetPhoneNumber',
      rawPath: 'recipient.phone',
      parserPipeline: [{ type: 'normalizePhone' }],
      sample: null,
      sortOrder: 0,
    }));
    expect(view.props[1]).toEqual(expect.objectContaining({
      alias: 'customerName',
      sample: '홍길동',
    }));
    expect(view.variableOptions).toEqual([
      { alias: 'targetPhoneNumber', label: '수신자 번호', required: true, type: 'text' },
      { alias: 'customerName', label: '고객명', required: false, type: 'text' },
    ]);
    expect(JSON.stringify(view)).not.toContain('IGNORED_TEMPLATE');
    expect(JSON.stringify(view)).not.toContain('IGNORED_PROVIDER_TEMPLATE');
    expect(JSON.stringify(view)).not.toContain('@ignored');
    expect(view.props[0]).not.toHaveProperty('rules');
    expect(view.props[0]).not.toHaveProperty('defaultTemplate');
  });
});
