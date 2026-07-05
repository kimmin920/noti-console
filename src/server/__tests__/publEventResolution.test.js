import { describe, expect, it } from 'vitest';

import { resolvePublEventPayload } from '../publEvents/service.js';

describe('PUBL event payload resolution', () => {
  it('allows disabled required props without exposing them', () => {
    const result = resolvePublEventPayload(
      createEventDefinition({
        props: [
          createProp({
            alias: 'eventKey',
            label: '이벤트 키',
            rawPath: 'eventKey',
            required: true,
            enabled: false,
          }),
        ],
      }),
      {}
    );

    expect(result.validationErrors).toEqual([]);
    expect(result.variables).not.toHaveProperty('eventKey');
    expect(result.variables).not.toHaveProperty('이벤트 키');
  });

  it('blocks enabled required props without fallback and includes the missing rawPath', () => {
    const result = resolvePublEventPayload(
      createEventDefinition({
        props: [
          createProp({
            alias: 'targetPhoneNumber',
            label: '수신자 번호',
            rawPath: 'recipient.phone',
            required: true,
            enabled: true,
          }),
        ],
      }),
      {}
    );

    expect(result.validationErrors).toEqual([
      { alias: 'targetPhoneNumber', rawPath: 'recipient.phone', reason: 'required' },
    ]);
    expect(result.variables).toEqual({});
  });

  it('allows enabled required props when fallback is present', () => {
    const result = resolvePublEventPayload(
      createEventDefinition({
        props: [
          createProp({
            alias: 'targetName',
            label: '닉네임',
            rawPath: 'targetName',
            enabled: true,
            fallback: '고객',
            required: true,
          }),
        ],
      }),
      {}
    );

    expect(result.validationErrors).toEqual([]);
    expect(result.variables.targetName).toBe('고객');
    expect(result.variables.닉네임).toBe('고객');
  });

  it('does not use sample as a runtime value or required-prop fallback', () => {
    const result = resolvePublEventPayload(
      createEventDefinition({
        props: [
          createProp({
            alias: 'targetName',
            label: '닉네임',
            rawPath: 'targetName',
            enabled: true,
            required: true,
            fallback: null,
            sample: '샘플 고객',
          }),
        ],
      }),
      {}
    );

    expect(result.validationErrors).toEqual([
      { alias: 'targetName', rawPath: 'targetName', reason: 'required' },
    ]);
    expect(result.variables.targetName).toBeUndefined();
    expect(result.variables.닉네임).toBeUndefined();
    expect(JSON.stringify(result.variables)).not.toContain('샘플 고객');
  });

  it('exposes enabled alias, label, and whitespace-normalized Korean label variables', () => {
    const result = resolvePublEventPayload(
      createEventDefinition({
        props: [
          createProp({
            alias: 'targetName',
            label: '닉네임',
            rawPath: 'targetName',
            enabled: true,
          }),
          createProp({
            alias: 'channelTitle',
            label: '채널 제목',
            rawPath: 'channelTitle',
            enabled: true,
            sortOrder: 1,
          }),
        ],
      }),
      {
        targetName: '민지',
        channelTitle: '공지 채널',
      }
    );

    expect(result.validationErrors).toEqual([]);
    expect(result.variables.targetName).toBe('민지');
    expect(result.variables.닉네임).toBe('민지');
    expect(result.variables.channelTitle).toBe('공지 채널');
    expect(result.variables['채널 제목']).toBe('공지 채널');
    expect(result.variables.채널제목).toBe('공지 채널');
  });

  it('applies targetName fallback before variable exposure', () => {
    const result = resolvePublEventPayload(
      createEventDefinition({
        props: [
          createProp({
            alias: 'targetName',
            label: '닉네임',
            rawPath: 'targetName',
            enabled: true,
            fallback: '고객',
            required: false,
          }),
        ],
      }),
      {}
    );

    expect(result.validationErrors).toEqual([]);
    expect(result.variables.targetName).toBe('고객');
    expect(result.variables.닉네임).toBe('고객');
  });

  it('supports dateFormat, currencyFormat, mapTemplate, and join parser steps', () => {
    const result = resolvePublEventPayload(
      createEventDefinition({
        props: [
          createProp({
            alias: 'eventOccurredAt',
            label: '발생일시',
            rawPath: 'occuredAt',
            enabled: true,
            parserPipeline: [{ type: 'dateFormat', format: 'yyyy년 M월 d일 HH:mm', timezone: 'Asia/Seoul' }],
          }),
          createProp({
            alias: 'finalPriceAmount',
            label: '최종 결제 금액',
            rawPath: 'sourceDetailMeta.finalPrice.amount',
            enabled: true,
            sortOrder: 1,
            parserPipeline: [
              {
                type: 'currencyFormat',
                locale: 'ko-KR',
                currencyPath: 'sourceDetailMeta.finalPrice.currency',
              },
            ],
          }),
          createProp({
            alias: 'orderItemNames',
            label: '주문 상품 목록',
            rawPath: 'sourceDetailMeta.orderItems',
            enabled: true,
            sortOrder: 2,
            parserPipeline: [
              { type: 'mapTemplate', template: '#{productName} #{serializedOptions} {{qty}}개' },
              { type: 'join', separator: ', ' },
            ],
          }),
        ],
      }),
      {
        occuredAt: '2026-06-19T01:05:00.000Z',
        sourceDetailMeta: {
          finalPrice: { amount: 12000, currency: 'KRW' },
          orderItems: [
            { productName: '티켓', serializedOptions: 'A구역', qty: 2 },
            { productName: '굿즈', serializedOptions: '블랙', qty: 1 },
          ],
        },
      }
    );

    expect(result.validationErrors).toEqual([]);
    expect(result.variables.eventOccurredAt).toBe('2026년 6월 19일 10:05');
    expect(result.variables.finalPriceAmount).toBe('₩12,000');
    expect(result.variables.orderItemNames).toBe('티켓 A구역 2개, 굿즈 블랙 1개');
  });

  it('supports fallback, firstItem, phoneFormat, truncate, and replace parser steps', () => {
    const result = resolvePublEventPayload(
      createEventDefinition({
        props: [
          createProp({
            alias: 'fallbackText',
            label: '대체 문구',
            rawPath: 'emptyText',
            enabled: true,
            parserPipeline: [{ type: 'fallback', fallback: '대체값' }],
          }),
          createProp({
            alias: 'firstOrderItem',
            label: '첫 상품',
            rawPath: 'orderItemNames',
            enabled: true,
            sortOrder: 1,
            parserPipeline: [{ type: 'firstItem' }],
          }),
          createProp({
            alias: 'targetPhoneNumber',
            label: '전화번호',
            rawPath: 'phone',
            enabled: true,
            sortOrder: 2,
            parserPipeline: [{ type: 'phoneFormat' }],
          }),
          createProp({
            alias: 'shortTitle',
            label: '짧은 제목',
            rawPath: 'title',
            enabled: true,
            sortOrder: 3,
            parserPipeline: [{ type: 'truncate', maxLength: 5 }],
          }),
          createProp({
            alias: 'replacedText',
            label: '치환 문구',
            rawPath: 'message',
            enabled: true,
            sortOrder: 4,
            parserPipeline: [{ type: 'replace', from: 'A', to: 'X' }],
          }),
        ],
      }),
      {
        emptyText: '',
        message: 'A-B-A',
        orderItemNames: ['티켓', '굿즈'],
        phone: '01012345678',
        title: '긴 제목입니다',
      }
    );

    expect(result.validationErrors).toEqual([]);
    expect(result.variables.fallbackText).toBe('대체값');
    expect(result.variables.firstOrderItem).toBe('티켓');
    expect(result.variables.targetPhoneNumber).toBe('010-1234-5678');
    expect(result.variables.shortTitle).toBe('긴 제목입');
    expect(result.variables.replacedText).toBe('X-B-X');
  });

  it('does not expose disabled array props with parser pipelines', () => {
    const result = resolvePublEventPayload(
      createEventDefinition({
        props: [
          createProp({
            alias: 'orderItemNames',
            label: '주문 상품 목록',
            rawPath: 'sourceDetailMeta.orderItems',
            enabled: false,
            parserPipeline: [
              { type: 'mapTemplate', template: '#{productName}' },
              { type: 'join', separator: ', ' },
            ],
          }),
        ],
      }),
      {
        sourceDetailMeta: {
          orderItems: [{ productName: '티켓' }],
        },
      }
    );

    expect(result.validationErrors).toEqual([]);
    expect(result.variables).toEqual({});
  });

  it('keeps first variable value and reports collisions when later values differ', () => {
    const result = resolvePublEventPayload(
      createEventDefinition({
        props: [
          createProp({ alias: 'firstName', label: '이름', rawPath: 'firstName', enabled: true }),
          createProp({
            alias: 'secondName',
            label: '이름',
            rawPath: 'secondName',
            enabled: true,
            sortOrder: 1,
          }),
        ],
      }),
      {
        firstName: '민지',
        secondName: '서준',
      }
    );

    expect(result.variables.이름).toBe('민지');
    expect(result.validationErrors).toContainEqual({
      alias: 'secondName',
      key: '이름',
      reason: 'variable_key_collision',
    });
  });
});

function createEventDefinition(overrides = {}) {
  return {
    eventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
    eventType: 'publ-event',
    props: [],
    ...overrides,
  };
}

function createProp(overrides = {}) {
  return {
    sortOrder: 0,
    rawPath: 'targetName',
    alias: 'targetName',
    label: '닉네임',
    type: 'text',
    required: false,
    enabled: false,
    fallback: null,
    parserPipeline: null,
    ...overrides,
  };
}
