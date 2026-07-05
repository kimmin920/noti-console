import { describe, expect, it } from 'vitest';

import {
  buildAlimtalkTemplateCreatePayload,
  AlimtalkTemplateCreateValidationError,
} from '../../features/console/alimtalkTemplates/alimtalkTemplateCreatePayload.js';

const CREATE_OPTIONS = {
  senderResourceId: 'kakao_resource_1',
};

const BASE_TEMPLATE = {
  emphasizeType: 'NONE',
  templateCode: 'ORDER_READY',
  templateContent: '주문 #{orderNo} 접수 완료',
  templateName: '주문 접수 안내',
};

function createButton(index, patch = {}) {
  return {
    buttonName: `버튼 ${index + 1}`,
    buttonType: 'BK',
    ...patch,
  };
}

function createQuickReply(index, patch = {}) {
  return {
    name: `바로가기 ${index + 1}`,
    type: 'BK',
    ...patch,
  };
}

function expectCreatePayloadError(templatePatch, message) {
  expect(() => buildAlimtalkTemplateCreatePayload({
    ...BASE_TEMPLATE,
    ...templatePatch,
  }, CREATE_OPTIONS)).toThrow(message);
}

describe('AlimTalk template create payload builder', () => {
  it('builds provider-safe basic template registration payloads', () => {
    const payload = buildAlimtalkTemplateCreatePayload({
      buttons: [
        {
          buttonName: '자세히',
          buttonType: 'WL',
          linkMo: 'https://m.example.com/orders/#{orderNo}',
          linkPc: '',
        },
      ],
      emphasizeType: 'NONE',
      extraText: '고객센터 09:00-18:00',
      quickReplies: [],
      securityFlag: true,
      templateCode: 'ORDER_READY',
      templateContent: '#{customerName}님 주문 #{orderNo} 접수 완료',
      templateName: '주문 접수 안내',
    }, {
      senderResourceId: 'kakao_resource_1',
    });

    expect(payload).toEqual({
      buttons: [
        {
          linkMo: 'https://m.example.com/orders/#{orderNo}',
          name: '자세히',
          ordering: 1,
          type: 'WL',
        },
      ],
      securityFlag: true,
      senderResourceId: 'kakao_resource_1',
      templateCode: 'ORDER_READY',
      templateContent: '#{customerName}님 주문 #{orderNo} 접수 완료',
      templateEmphasizeType: 'NONE',
      templateExtra: '고객센터 09:00-18:00',
      templateMessageType: 'EX',
      templateName: '주문 접수 안내',
    });
  });

  it('builds text-emphasis template registration payloads', () => {
    const payload = buildAlimtalkTemplateCreatePayload({
      emphasizeSubtitle: '결제 확인 완료',
      emphasizeTitle: '주문이 접수되었습니다',
      emphasizeType: 'TEXT',
      templateCode: 'ORDER_TEXT',
      templateContent: '#{customerName}님 주문이 접수되었습니다.',
      templateName: '주문 강조 안내',
    }, {
      senderResourceId: 'kakao_resource_1',
    });

    expect(payload).toMatchObject({
      senderResourceId: 'kakao_resource_1',
      templateCode: 'ORDER_TEXT',
      templateEmphasizeType: 'TEXT',
      templateMessageType: 'BA',
      templateSubtitle: '결제 확인 완료',
      templateTitle: '주문이 접수되었습니다',
    });
  });

  it('rejects image templates until provider image upload is available', () => {
    expect(() => buildAlimtalkTemplateCreatePayload({
      emphasizeType: 'IMAGE',
      imageFileData: 'base64',
      imageFileInfo: { fileName: 'image.png' },
      templateCode: 'IMAGE_TEMPLATE',
      templateContent: '이미지 안내',
      templateName: '이미지 안내',
    }, {
      senderResourceId: 'kakao_resource_1',
    })).toThrow(AlimtalkTemplateCreateValidationError);
  });

  it('rejects action combinations outside AlimTalk provider limits', () => {
    expectCreatePayloadError({
      buttons: Array.from({ length: 6 }, (_, index) => createButton(index)),
    }, '버튼은 최대 5개까지 등록할 수 있습니다.');

    expectCreatePayloadError({
      quickReplies: Array.from({ length: 11 }, (_, index) => createQuickReply(index)),
    }, '바로가기는 최대 10개까지 등록할 수 있습니다.');

    expectCreatePayloadError({
      buttons: Array.from({ length: 3 }, (_, index) => createButton(index)),
      quickReplies: [createQuickReply(0)],
    }, '바로가기를 사용하는 템플릿은 버튼을 최대 2개까지 등록할 수 있습니다.');

    expectCreatePayloadError({
      buttons: [
        createButton(0),
        createButton(1, { buttonName: '채널 추가', buttonType: 'AC' }),
      ],
    }, '채널추가 버튼은 첫 번째 버튼에서만 사용할 수 있습니다.');

    expectCreatePayloadError({
      buttons: [
        createButton(0, { buttonName: '채널 추가', buttonType: 'AC' }),
        createButton(1, { buttonName: '채널 추가', buttonType: 'AC' }),
      ],
    }, '채널추가 버튼은 한 개만 사용할 수 있습니다.');
  });
});
