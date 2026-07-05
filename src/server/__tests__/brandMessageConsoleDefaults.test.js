import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  brandChatBubbleTypeConfig,
  brandMessageInspectorIgnoreSelector,
  BrandMessageSendForm,
  createBrandMessageDraftFromTemplate,
  defaultBrandMessageSendFormValue,
  defaultBrandMessageTemplates,
  getBrandMessageTemplateRegistrationIssues,
  getBrandMessageValidationIssues,
  normalizeBrandMessageDraftValue,
} from '../../components/ui/BrandMessageSendForm.jsx';
import { NhnBrandMessagePreview } from '../../components/ui/BrandMessagePreview.jsx';
import {
  BrandMessageTemplateDialogCard,
  getBrandTemplateDialogItems,
} from '../../components/ui/MessageTemplateDialogAdapters.jsx';
import { BrandMessageTemplateCardPreview } from '../../components/ui/BrandMessageTemplateCardPreview.jsx';
import { EmailSendFormTemplatePicker } from '../../components/ui/EmailSendForm.jsx';
import { TemplateCardList } from '../../features/console/templates/TemplateCardList.jsx';
import {
  applyBrandImageUploadResult,
  buildBrandImageUploadFormData,
  getBrandImageUploadTargets,
  MessageSendValidationError,
} from '../../features/console/messageSend/payloads.js';

const REQUIRED_NHN_DRAFT_FIELDS = [
  'mode',
  'chatBubbleType',
  'content',
  'header',
  'additionalContent',
  'image',
  'item',
  'video',
  'commerce',
  'carousel',
  'buttons',
  'coupon',
  'templateCode',
  'templateParameter',
  'imageParameters',
  'videoParameter',
  'targeting',
  'pushAlarm',
  'adult',
  'unsubscribeNo',
  'unsubscribeAuthNo',
  'resellerCode',
  'statsId',
];

const FORBIDDEN_LEGACY_DRAFT_FIELDS = [
  'sendType',
  'msgType',
  'messageVariable',
  'buttonVariable',
  'couponVariable',
  'imageVariable',
  'videoVariable',
  'commerceVariable',
  'carouselVariable',
  'messageType',
  'templateId',
  'variables',
];

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

describe('Brand Message console defaults', () => {
  it('keeps inspector workflow controls out of outside-close handling', () => {
    expect(brandMessageInspectorIgnoreSelector).toContain('.brand-message-button-editor-header button');
    expect(brandMessageInspectorIgnoreSelector).toContain('.brand-message-coupon-editor-header button');
    expect(brandMessageInspectorIgnoreSelector).toContain('.brand-message-button-drag-handle');
    expect(brandMessageInspectorIgnoreSelector).toContain('.image-crop-dialog');
  });

  it('declares content modes for every NHN brand-message bubble type', () => {
    expect(Object.fromEntries(
      Object.entries(brandChatBubbleTypeConfig).map(([type, config]) => [type, config.contentMode])
    )).toEqual({
      CAROUSEL_COMMERCE: 'hidden',
      CAROUSEL_FEED: 'hidden',
      COMMERCE: 'hidden',
      IMAGE: 'required',
      PREMIUM_VIDEO: 'optional',
      TEXT: 'required',
      WIDE: 'required',
      WIDE_ITEM_LIST: 'hidden',
    });
    expect(brandChatBubbleTypeConfig.PREMIUM_VIDEO.contentLabel).toBe('영상 소개 문구');
  });

  it('renders selected Brand Message templates as rich previews for every NHN bubble type', () => {
    const senderProfiles = [{ plusFriendId: '@store', value: 'brand-profile-acme' }];
    const baseValue = {
      ...defaultBrandMessageSendFormValue,
      mode: 'template',
      senderProfileId: 'brand-profile-acme',
      templateParameter: { name: '민지' },
    };
    const cases = [
      {
        expected: ['안녕하세요 ', '민지'],
        template: {
          chatBubbleType: 'TEXT',
          content: '안녕하세요 #{name}',
          templateCode: 'BRAND_TEXT',
          value: 'BRAND_TEXT',
        },
      },
      {
        expected: ['https://cdn.example.com/image.jpg', '이미지 ', '민지'],
        template: {
          chatBubbleType: 'IMAGE',
          content: '이미지 #{name}',
          imageUrl: 'https://cdn.example.com/image.jpg',
          templateCode: 'BRAND_IMAGE',
          value: 'BRAND_IMAGE',
        },
      },
      {
        expected: ['https://cdn.example.com/wide.jpg', '와이드 ', '민지'],
        template: {
          chatBubbleType: 'WIDE',
          content: '와이드 #{name}',
          image: { imageUrl: 'https://cdn.example.com/wide.jpg' },
          templateCode: 'BRAND_WIDE',
          value: 'BRAND_WIDE',
        },
      },
      {
        expected: ['추천 #{name}', '대표 #{name}', 'https://cdn.example.com/wide-list.jpg', '행사'],
        template: {
          chatBubbleType: 'WIDE_ITEM_LIST',
          header: '추천 #{name}',
          item: {
            list: [
              { imageUrl: 'https://cdn.example.com/wide-list.jpg', title: '대표 #{name}' },
              { image: { imageUrl: 'https://cdn.example.com/wide-list-row.jpg' }, title: '행사' },
            ],
          },
          templateCode: 'BRAND_WIDE_LIST',
          value: 'BRAND_WIDE_LIST',
        },
      },
      {
        expected: ['https://cdn.example.com/video-cover.jpg', '영상 #{name}', '프리미엄 ', '민지'],
        template: {
          chatBubbleType: 'PREMIUM_VIDEO',
          content: '프리미엄 #{name}',
          imageUrl: 'https://cdn.example.com/video-cover.jpg',
          templateCode: 'BRAND_VIDEO',
          value: 'BRAND_VIDEO',
          video: { title: '영상 #{name}' },
        },
      },
      {
        expected: ['https://cdn.example.com/commerce.jpg', '상품 ', '민지', '39,000원'],
        template: {
          chatBubbleType: 'COMMERCE',
          commerce: {
            discountPrice: '39000',
            imageUrl: 'https://cdn.example.com/commerce.jpg',
            regularPrice: '59000',
            title: '상품 #{name}',
          },
          templateCode: 'BRAND_COMMERCE',
          value: 'BRAND_COMMERCE',
        },
      },
      {
        expected: ['https://cdn.example.com/feed-1.jpg', '피드 1', '본문 ', '민지'],
        template: {
          carousel: {
            list: [
              { content: '본문 #{name}', imageUrl: 'https://cdn.example.com/feed-1.jpg', title: '피드 1' },
              { content: '본문 2', image: { imageUrl: 'https://cdn.example.com/feed-2.jpg' }, title: '피드 2' },
            ],
          },
          chatBubbleType: 'CAROUSEL_FEED',
          templateCode: 'BRAND_CAROUSEL_FEED',
          value: 'BRAND_CAROUSEL_FEED',
        },
      },
      {
        expected: [
          'https://cdn.example.com/intro.jpg',
          '인트로',
          '소개 ',
          '민지',
          'https://cdn.example.com/carousel-commerce.jpg',
          '캐러셀 상품 ',
          '29,000원',
        ],
        template: {
          carousel: {
            head: {
              content: '소개 #{name}',
              header: '인트로',
              imageUrl: 'https://cdn.example.com/intro.jpg',
            },
            isUseIntro: true,
            list: [
              {
                commerce: {
                  discountPrice: '29000',
                  regularPrice: '42000',
                  title: '캐러셀 상품 #{name}',
                },
                imageUrl: 'https://cdn.example.com/carousel-commerce.jpg',
              },
            ],
          },
          chatBubbleType: 'CAROUSEL_COMMERCE',
          templateCode: 'BRAND_CAROUSEL_COMMERCE',
          value: 'BRAND_CAROUSEL_COMMERCE',
        },
      },
    ];

    for (const { expected, template } of cases) {
      const markup = renderToStaticMarkup(createElement(NhnBrandMessagePreview, {
        senderProfiles,
        templates: [template],
        value: {
          ...baseValue,
          templateCode: template.templateCode,
        },
      }));

      expected.forEach((text) => {
        expect(markup).toContain(text);
      });
    }
  });

  it('keeps the Brand Message send preview shell separate from template card previews', () => {
    const markup = renderToStaticMarkup(createElement(NhnBrandMessagePreview, {
      value: {
        ...defaultBrandMessageSendFormValue,
        content: '브랜드 메시지 본문',
      },
    }));

    expect(markup).toContain('brand-message-preview-title');
    expect(markup).toContain('brand-message-preview-phone');
    expect(markup).not.toContain('template-card-brand-preview-shell');
  });

  it('renders selected Brand Message template metadata without raw parameter inputs', () => {
    const template = {
      chatBubbleType: 'WIDE',
      content: '신규 컬렉션이 공개되었습니다.',
      requiredVariables: [],
      senderProfileId: 'brand-profile-acme',
      templateCode: 'BRAND_STATIC_WIDE',
      templateName: '고정 와이드 안내',
      variables: [],
    };
    const markup = renderToStaticMarkup(createElement(BrandMessageSendForm, {
      templates: [template],
      value: {
        ...defaultBrandMessageSendFormValue,
        mode: 'template',
        recipient: [{ type: 'manual', value: '010-1234-5678' }],
        senderProfileId: 'brand-profile-acme',
        templateCode: 'BRAND_STATIC_WIDE',
      },
    }));

    expect(markup).toContain('brand-message-template-meta');
    expect(markup).toContain('템플릿 발송으로 사용');
    expect(markup).not.toContain('템플릿으로 시작하기');
    expect(markup).toContain('<code title="BRAND_STATIC_WIDE">BRAND_STATIC_WIDE</code>');
    expect(markup).toContain('선택한 템플릿에는 입력할 변수가 없습니다.');
    expect(markup).not.toContain('value="BRAND_STATIC_WIDE"');
    expect(markup).not.toContain('templateParameter');
    expect(markup).not.toContain('imageParameters');
    expect(markup).not.toContain('videoParameter');
  });

  it('renders selected Brand Message template variables as editable chips', () => {
    const template = {
      chatBubbleType: 'TEXT',
      content: '#{고객명}님, 혜택을 확인해 주세요.',
      requiredVariables: ['고객명'],
      senderProfileId: 'brand-profile-acme',
      templateCode: 'BRAND_VARIABLE_TEXT',
      templateName: '변수 텍스트 안내',
      variables: [{ key: '고객명', type: 'string' }],
    };
    const markup = renderToStaticMarkup(createElement(BrandMessageSendForm, {
      templates: [template],
      value: {
        ...defaultBrandMessageSendFormValue,
        mode: 'template',
        recipient: [{ type: 'manual', value: '010-1234-5678' }],
        senderProfileId: 'brand-profile-acme',
        templateCode: 'BRAND_VARIABLE_TEXT',
        templateParameter: { 고객명: { mode: 'manual', value: '' } },
      },
    }));

    expect(markup).toContain('brand-message-template-variable-list');
    expect(markup).toContain('brand-message-template-variable-chip');
    expect(markup).toContain('#{고객명}');
    expect(markup).toContain('필요');
    expect(markup).not.toContain('label="templateParameter"');
  });

  it('renders Brand Message template picker cards as selectable previews', () => {
    const [template] = getBrandTemplateDialogItems([{
      buttons: [{ name: '자세히 보기', type: 'WL' }],
      chatBubbleType: 'WIDE',
      content: '#{고객명}님, 신규 컬렉션이 공개되었습니다.',
      senderProfileId: 'brand-profile-acme',
      templateCode: 'BRAND_WIDE',
      templateName: '신규 컬렉션 와이드',
      variables: [{ fallbackValue: '고객', key: '고객명' }],
    }]);
    const markup = renderToStaticMarkup(createElement(BrandMessageTemplateDialogCard, {
      isSelected: true,
      onSelect: () => {},
      template,
    }));

    expect(markup).toContain('aria-label="신규 컬렉션 와이드 템플릿 선택"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('data-selected="true"');
    expect(markup).not.toContain('템플릿 사용');
    expect(markup).not.toContain('복사해서 편집');
    expect(markup).not.toContain('그대로 사용');
    expect(markup).not.toContain('템플릿 발송으로 사용</button>');
    expect(markup).not.toContain('템플릿으로 시작하기</button>');
  });

  it('renders Brand Message template picker with a toolbar action after selection', () => {
    const [template] = getBrandTemplateDialogItems([{
      buttons: [{ name: '자세히 보기', type: 'WL' }],
      chatBubbleType: 'WIDE',
      content: '#{고객명}님, 신규 컬렉션이 공개되었습니다.',
      senderProfileId: 'brand-profile-acme',
      templateCode: 'BRAND_WIDE',
      templateName: '신규 컬렉션 와이드',
      variables: [{ fallbackValue: '고객', key: '고객명' }],
    }]);
    const markup = renderToStaticMarkup(createElement(EmailSendFormTemplatePicker, {
      onTemplateSelect: () => {},
      renderTemplateCard: ({ cardKey, isSelected, onSelect, template: cardTemplate }) => createElement(BrandMessageTemplateDialogCard, {
        cardKey,
        isSelected,
        onSelect,
        template: cardTemplate,
      }),
      selectedTemplateId: template.id,
      templates: [template],
      toolbarAction: createElement('button', {
        className: 'brand-template-selection-action-trigger',
        type: 'button',
      }, '템플릿 사용'),
    }));

    expect(markup).toContain('email-send-form-template-toolbar has-action');
    expect(markup).toContain('brand-template-selection-action-trigger');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('템플릿 사용');
  });

  it('converts a variable-free WIDE template into a freestyle draft', () => {
    const { draft, unresolvedVariables, unsupportedFields } = createBrandMessageDraftFromTemplate({
      buttons: [{ linkMo: 'https://example.com/collection', name: '자세히 보기', type: 'WL' }],
      chatBubbleType: 'WIDE',
      content: '신규 컬렉션이 공개되었습니다.',
      image: { imageName: 'wide.png', imageUrl: 'https://cdn.example.com/wide.png' },
      templateCode: 'BRAND_STATIC_WIDE',
    }, {
      ...defaultBrandMessageSendFormValue,
      recipient: [{ type: 'manual', value: '010-1234-5678' }],
      scheduledAt: '2026-06-30 09:00',
      senderProfileId: 'brand-profile-acme',
      templateParameter: { stale: 'value' },
    });

    expect(draft).toMatchObject({
      chatBubbleType: 'WIDE',
      content: '신규 컬렉션이 공개되었습니다.',
      image: { imageName: 'wide.png', imageUrl: 'https://cdn.example.com/wide.png' },
      mode: 'freestyle',
      recipient: [{ type: 'manual', value: '010-1234-5678' }],
      scheduledAt: '2026-06-30 09:00',
      senderProfileId: 'brand-profile-acme',
      templateCode: '',
      templateParameter: {},
    });
    expect(draft.buttons).toEqual([
      {
        id: 'template-button-1',
        linkMo: 'https://example.com/collection',
        name: '자세히 보기',
        ordering: 1,
        type: 'WL',
      },
    ]);
    expect(draft.imageParameters).toEqual({});
    expect(draft.videoParameter).toBeNull();
    expect(unresolvedVariables).toEqual([]);
    expect(unsupportedFields).toEqual([]);
  });

  it('renders a Brand Message started from a template as an editable freestyle draft', () => {
    const template = {
      buttons: [{ linkMo: 'https://example.com/collection', name: '자세히 보기', type: 'WL' }],
      chatBubbleType: 'WIDE',
      content: '신규 컬렉션이 공개되었습니다.',
      image: { imageName: 'wide.png', imageUrl: 'https://cdn.example.com/wide.png' },
      senderProfileId: 'brand-profile-acme',
      templateCode: 'BRAND_STATIC_WIDE',
      templateName: '변수 없는 와이드',
    };
    const { draft } = createBrandMessageDraftFromTemplate(template, {
      ...defaultBrandMessageSendFormValue,
      senderProfileId: 'brand-profile-acme',
    });
    const markup = renderToStaticMarkup(createElement(BrandMessageSendForm, {
      templates: [template],
      value: draft,
    }));

    expect(markup).toContain('aria-label="브랜드 메시지 본문"');
    expect(markup).toContain('신규 컬렉션이 공개되었습니다.');
    expect(markup).toContain('https://cdn.example.com/wide.png');
    expect(markup).not.toContain('brand-message-template-meta');
    expect(markup).not.toContain('템플릿 발송으로 사용');
    expect(markup).not.toContain('templateParameter');
    expect(markup).not.toContain('imageParameters');
    expect(markup).not.toContain('videoParameter');
  });

  it('materializes Brand Message template variables into freestyle content', () => {
    const { draft, unresolvedVariables } = createBrandMessageDraftFromTemplate({
      chatBubbleType: 'TEXT',
      content: '#{고객명}님, #{혜택명} 혜택을 확인해 주세요.',
      templateParameter: { 고객명: '수빈' },
      variables: [{ fallbackValue: '오늘만', key: '혜택명' }],
    });

    expect(draft.mode).toBe('freestyle');
    expect(draft.content).toBe('수빈님, 오늘만 혜택을 확인해 주세요.');
    expect(draft.templateCode).toBe('');
    expect(draft.templateParameter).toEqual({});
    expect(unresolvedVariables).toEqual([]);
  });

  it('preserves unresolved Brand Message template variables in freestyle drafts', () => {
    const { draft, unresolvedVariables } = createBrandMessageDraftFromTemplate({
      chatBubbleType: 'TEXT',
      content: '#{고객명}님, #{혜택명} 혜택을 확인해 주세요.',
      variables: [{ fallbackValue: '고객', key: '고객명' }],
    });

    expect(draft.content).toBe('고객님, #{혜택명} 혜택을 확인해 주세요.');
    expect(unresolvedVariables).toEqual(['혜택명']);
  });

  it('copies carousel templates with editable item button IDs', () => {
    const { draft } = createBrandMessageDraftFromTemplate({
      carousel: {
        list: [
          {
            buttons: [{ linkMo: 'https://example.com/a', name: '보기', type: 'WL' }],
            content: '첫 번째 #{고객명}',
            image: { imageUrl: 'https://cdn.example.com/a.png' },
            title: '카드 A',
          },
          {
            buttons: [{ id: 'existing-button', linkMo: 'https://example.com/b', name: '보기', ordering: 7, type: 'WL' }],
            content: '두 번째',
            image: { imageUrl: 'https://cdn.example.com/b.png' },
            title: '카드 B',
          },
        ],
      },
      chatBubbleType: 'CAROUSEL_FEED',
      variables: [{ fallbackValue: '고객', key: '고객명' }],
    });

    expect(draft.mode).toBe('freestyle');
    expect(draft.chatBubbleType).toBe('CAROUSEL_FEED');
    expect(draft.carousel.list[0].content).toBe('첫 번째 고객');
    expect(draft.carousel.list[0].buttons[0]).toMatchObject({
      id: 'template-carousel-1-button-1',
      ordering: 1,
    });
    expect(draft.carousel.list[1].buttons[0]).toMatchObject({
      id: 'existing-button',
      ordering: 1,
    });
  });

  it('converts every Brand Message chat bubble template shape into a freestyle draft', () => {
    const cases = [
      {
        assert: (draft) => expect(draft.content).toBe('텍스트 고객'),
        template: {
          buttons: [{ name: '보기', type: 'WL' }],
          chatBubbleType: 'TEXT',
          content: '텍스트 #{고객명}',
        },
      },
      {
        assert: (draft) => expect(draft.image).toMatchObject({ imageUrl: 'https://cdn.example.com/image.png' }),
        template: {
          buttons: [{ name: '보기', type: 'WL' }],
          chatBubbleType: 'IMAGE',
          content: '이미지 #{고객명}',
          imageUrl: 'https://cdn.example.com/image.png',
        },
      },
      {
        assert: (draft) => expect(draft.image).toMatchObject({ imageUrl: 'https://cdn.example.com/wide.png' }),
        template: {
          buttons: [{ name: '보기', type: 'WL' }],
          chatBubbleType: 'WIDE',
          content: '와이드 #{고객명}',
          imageUrl: 'https://cdn.example.com/wide.png',
        },
      },
      {
        assert: (draft) => expect(draft.item.list).toHaveLength(2),
        template: {
          buttons: [{ name: '보기', type: 'WL' }],
          chatBubbleType: 'WIDE_ITEM_LIST',
          header: '리스트 #{고객명}',
          items: [{ title: '대표' }, { title: '보조' }],
        },
      },
      {
        assert: (draft) => expect(draft.video).toMatchObject({ videoUrl: 'https://tv.kakao.com/v/123' }),
        template: {
          buttons: [{ name: '보기', type: 'WL' }],
          chatBubbleType: 'PREMIUM_VIDEO',
          content: '영상 #{고객명}',
          video: { videoUrl: 'https://tv.kakao.com/v/123' },
        },
      },
      {
        assert: (draft) => expect(draft.commerce).toMatchObject({
          additionalContent: '커머스 고객',
          imageUrl: 'https://cdn.example.com/commerce.png',
          title: '상품 고객',
        }),
        template: {
          buttons: [{ name: '보기', type: 'WL' }],
          chatBubbleType: 'COMMERCE',
          commerce: {
            imageUrl: 'https://cdn.example.com/commerce.png',
            price: '59000',
            title: '상품 #{고객명}',
          },
          content: '커머스 #{고객명}',
        },
      },
      {
        assert: (draft) => expect(draft.carousel.list[0].content).toBe('피드 고객'),
        template: {
          carouselItems: [{ buttons: [{ name: '보기', type: 'WL' }], content: '피드 #{고객명}', title: '피드' }],
          chatBubbleType: 'CAROUSEL_FEED',
        },
      },
      {
        assert: (draft) => expect(draft.carousel.list[0].title).toBe('상품 고객'),
        template: {
          carouselItems: [{ buttons: [{ name: '보기', type: 'WL' }], price: '59000', title: '상품 #{고객명}' }],
          chatBubbleType: 'CAROUSEL_COMMERCE',
        },
      },
    ];

    for (const { assert, template } of cases) {
      const { draft, unresolvedVariables } = createBrandMessageDraftFromTemplate({
        ...template,
        variables: [{ fallbackValue: '고객', key: '고객명' }],
      });

      expect(draft.mode).toBe('freestyle');
      expect(draft.chatBubbleType).toBe(template.chatBubbleType);
      expect(draft.templateCode).toBe('');
      expect(draft.templateParameter).toEqual({});
      expect(draft.imageParameters).toEqual({});
      expect(draft.videoParameter).toBeNull();
      expect(unresolvedVariables).toEqual([]);
      assert(draft);
    }
  });

  it('renders Brand Message template list cards from rich list preview fields', () => {
    const markup = renderToStaticMarkup(createElement(BrandMessageTemplateCardPreview, {
      template: {
        carousel: {
          head: {
            content: '소개 #{name}',
            header: '인트로',
            imageUrl: 'https://cdn.example.com/intro.jpg',
          },
          list: [
            {
              commerce: {
                discountPrice: '29000',
                regularPrice: '42000',
                title: '캐러셀 상품 #{name}',
              },
              imageUrl: 'https://cdn.example.com/carousel-commerce.jpg',
            },
          ],
        },
        chatBubbleType: 'CAROUSEL_COMMERCE',
        codeMetaLabel: '@store',
        name: '브랜드 특가 캐러셀',
        templateParameter: { name: '민지' },
      },
    }));

    expect(markup).toContain('template-card-brand-preview-shell');
    expect(markup).toContain('template-card-brand-preview');
    expect(markup).toContain('template-card-brand-preview is-carousel');
    expect(markup).toContain('data-brand-template-type="CAROUSEL_COMMERCE"');
    expect(markup).not.toContain('brand-message-preview-phone');
    expect(markup).toContain('brand-message-preview-carousel');
    expect(markup).not.toContain('캐러셀 커머스');
    expect(markup).toContain('https://cdn.example.com/intro.jpg');
    expect(markup).toContain('인트로');
    expect(markup).toContain('소개 ');
    expect(markup).toContain('#{name}');
    expect(markup).toContain('https://cdn.example.com/carousel-commerce.jpg');
    expect(markup).toContain('캐러셀 상품 ');
    expect(markup).toContain('29,000원');
  });

  it('renders Brand Message template card text from body-only list records', () => {
    const markup = renderToStaticMarkup(createElement(BrandMessageTemplateCardPreview, {
      template: {
        body: '승인된 브랜드 메시지 본문입니다.',
        chatBubbleType: 'TEXT',
        codeMetaLabel: '@store',
        name: '본문만 있는 템플릿',
      },
    }));

    expect(markup).toContain('승인된 브랜드 메시지 본문입니다.');
    expect(markup).not.toContain('메시지 내용을 입력해주세요.');
  });

  it('renders SMS template cards as centered message-only bubbles', () => {
    const markup = renderToStaticMarkup(createElement(TemplateCardList, {
      activeTab: 'SMS',
      emptyCopy: 'SMS 템플릿이 없습니다.',
      emptyTitle: 'SMS 템플릿 없음',
      templates: [
        {
          body: '##name##님 픽업 준비가 완료되었습니다.',
          code: 'SMS_PICKUP',
          id: 'sms-pickup',
          imageUrl: 'https://cdn.example.com/notice.jpg',
          name: '픽업 안내',
          senderNumber: '1544-0000',
          sendType: '1',
          status: '사용',
          statusTone: 'green',
        },
      ],
    }));

    expect(markup).toContain('template-card-sms-preview-shell');
    expect(markup).toContain('template-card-sms-phone');
    expect(markup).toContain('template-card-sms-bubble');
    expect(markup).toContain('template-card-sms-token');
    expect(markup).toContain('픽업 준비가 완료되었습니다.');
    expect(markup).not.toContain('template-card-sms-time');
    expect(markup).not.toContain('template-card-sms-type');
    expect(markup).not.toContain('template-card-sms-sender');
    expect(markup).not.toContain('1544-0000');
    expect(markup).not.toContain('https://cdn.example.com/notice.jpg');
    expect(markup).not.toContain('template-card-preview-text');
  });

  it('renders Brand Message template list previews without editor links', () => {
    const markup = renderToStaticMarkup(createElement(TemplateCardList, {
      activeTab: '브랜드 메시지',
      emptyCopy: '브랜드 메시지 템플릿이 없습니다.',
      emptyTitle: '브랜드 메시지 템플릿 없음',
      templates: [
        {
          carousel: {
            list: [
              {
                commerce: {
                  discountPrice: '29000',
                  regularPrice: '42000',
                  title: '상품',
                },
                imageUrl: 'https://cdn.example.com/product.jpg',
              },
              {
                commerce: {
                  discountPrice: '19000',
                  regularPrice: '32000',
                  title: '상품 2',
                },
                imageUrl: 'https://cdn.example.com/product-2.jpg',
              },
            ],
          },
          chatBubbleType: 'CAROUSEL_COMMERCE',
          code: 'BRAND_CAROUSEL',
          codeMetaLabel: '@store',
          id: 'brand-carousel',
          name: '브랜드 캐러셀',
          status: '등록',
          statusTone: 'green',
        },
      ],
    }));

    expect(markup).toContain('template-card-preview-surface');
    expect(markup).toContain('brand-message-preview-carousel');
    expect(markup).not.toContain('/templates/brand-carousel/editor');
    expect(markup).not.toContain('<a class="template-card-preview-link"');
  });

  it('renders the common content field only for visible top-level content modes', () => {
    const renderForm = (chatBubbleType) => renderToStaticMarkup(createElement(BrandMessageSendForm, {
      templates: [],
      value: {
        ...defaultBrandMessageSendFormValue,
        buttons: [],
        carousel: {
          list: [
            { content: '카드 본문', image: { imageUrl: 'https://cdn.example.com/feed-1.png' }, title: '카드 1' },
            { content: '카드 본문', image: { imageUrl: 'https://cdn.example.com/feed-2.png' }, title: '카드 2' },
          ],
        },
        chatBubbleType,
        commerce: {
          image: { imageUrl: 'https://cdn.example.com/bag.png' },
          regularPrice: '59000',
          title: '시그니처 백',
        },
        content: '',
        header: '추천 상품',
        item: {
          list: [
            { title: '아이템 1' },
            { title: '아이템 2' },
            { title: '아이템 3' },
          ],
        },
        mode: 'freestyle',
        video: { videoUrl: 'https://tv.kakao.com/v/1234' },
      },
    }));

    for (const type of ['TEXT', 'IMAGE', 'WIDE', 'PREMIUM_VIDEO']) {
      const markup = renderForm(type);

      expect(markup).toContain('aria-label="브랜드 메시지 본문"');
      expect(markup).toContain('brand-message-content-field');
      expect(markup).not.toContain('message-template-variable-label">메시지 내용');
      expect(markup).not.toContain('message-template-variable-label">영상 소개 문구');
      expect(markup).not.toContain('message-template-variable-label">상품 소개 문구');
      expect(markup).not.toContain('message-template-variable-label">인트로 본문');
    }
    expect(renderForm('WIDE_ITEM_LIST')).not.toContain('brand-message-content-field');
    expect(renderForm('COMMERCE')).not.toContain('brand-message-content-field');
    expect(renderForm('CAROUSEL_FEED')).not.toContain('brand-message-content-field');
    expect(renderForm('CAROUSEL_COMMERCE')).not.toContain('brand-message-content-field');
    expect(renderForm('CAROUSEL_FEED')).toContain('카드 본문');
  });

  it('uses the same sender channel select label and placeholder as 알림톡', () => {
    const markup = renderToStaticMarkup(createElement(BrandMessageSendForm, {
      senderProfiles: [],
      templates: [],
      value: {
        ...defaultBrandMessageSendFormValue,
        senderProfileId: '',
      },
    }));

    expect(markup).toContain('aria-label="발신 채널 선택"');
    expect(markup).toContain('발신 채널 선택');
    expect(markup).not.toContain('브랜드 발신 채널 선택');
  });

  it('renders brand-message image sources as upload-only fields', () => {
    const renderForm = (value) => renderToStaticMarkup(createElement(BrandMessageSendForm, {
      templates: [],
      value: {
        ...defaultBrandMessageSendFormValue,
        buttons: [],
        content: '',
        mode: 'freestyle',
        ...value,
      },
    }));
    const topLevelMarkup = [
      renderForm({ chatBubbleType: 'IMAGE' }),
      renderForm({ chatBubbleType: 'WIDE' }),
    ].join('');
    const wideListMarkup = renderForm({
      chatBubbleType: 'WIDE_ITEM_LIST',
      header: '추천 상품',
      item: { list: [{ title: '아이템 1' }, { title: '아이템 2' }, { title: '아이템 3' }] },
    });
    const premiumVideoMarkup = renderForm({
      chatBubbleType: 'PREMIUM_VIDEO',
      video: { videoUrl: 'https://tv.kakao.com/v/1234' },
    });
    const commerceMarkup = renderForm({
      chatBubbleType: 'COMMERCE',
      commerce: { regularPrice: '59000', title: '시그니처 백' },
    });
    const carouselFeedMarkup = renderForm({
      carousel: {
        head: {},
        list: [
          { content: '카드 본문', title: '카드 1' },
          { content: '카드 본문', title: '카드 2' },
        ],
      },
      chatBubbleType: 'CAROUSEL_FEED',
    });
    const carouselCommerceMarkup = renderForm({
      carousel: {
        isUseIntro: false,
        list: [
          { regularPrice: '59000', title: '상품 1' },
          { regularPrice: '42000', title: '상품 2' },
        ],
      },
      chatBubbleType: 'CAROUSEL_COMMERCE',
    });
    const carouselCommerceIntroMarkup = renderForm({
      carousel: {
        head: {},
        isUseIntro: true,
        list: [{ regularPrice: '59000', title: '상품 1' }],
      },
      chatBubbleType: 'CAROUSEL_COMMERCE',
    });

    expect(topLevelMarkup).toContain('type="file"');
    expect(topLevelMarkup).not.toContain('브랜드 메시지 이미지 URL');
    expect(topLevelMarkup).not.toContain('https://image.example.com/brand.png');
    expect(wideListMarkup).toContain('리스트 아이템 1 수정');
    expect(wideListMarkup).not.toContain('이미지 URL');
    expect(premiumVideoMarkup).toContain('썸네일 이미지 업로드');
    expect(premiumVideoMarkup).not.toContain('썸네일 이미지 URL');
    expect(commerceMarkup).toContain('상품 이미지 업로드');
    expect(commerceMarkup).not.toContain('상품 이미지 URL');
    expect(carouselFeedMarkup).not.toContain('커머스 인트로 이미지 업로드');
    expect(carouselFeedMarkup).not.toContain('캐러셀 헤드 이미지');
    expect(carouselCommerceMarkup).toContain('캐러셀 인트로 사용');
    expect(carouselCommerceMarkup).not.toContain('커머스 인트로 이미지 업로드');
    expect(carouselCommerceIntroMarkup).toContain('커머스 인트로 수정');
    expect(carouselCommerceIntroMarkup).not.toContain('커머스 인트로 이미지 업로드');
    expect(carouselCommerceIntroMarkup).not.toContain('커머스 인트로 이미지 URL');
    expect([
      wideListMarkup,
      premiumVideoMarkup,
      commerceMarkup,
      carouselFeedMarkup,
      carouselCommerceMarkup,
      carouselCommerceIntroMarkup,
    ].join('')).not.toContain('placeholder="https://..."');
  });


  it('hides premium video from user-facing brand-message type lists', () => {
    const markup = renderToStaticMarkup(createElement(BrandMessageSendForm, {
      templates: [],
      value: {
        ...defaultBrandMessageSendFormValue,
        buttons: [],
        chatBubbleType: 'TEXT',
        content: '',
        mode: 'freestyle',
      },
    }));

    expect(markup).not.toContain('프리미엄 동영상');
    expect(defaultBrandMessageTemplates.map((template) => template.chatBubbleType)).not.toContain('PREMIUM_VIDEO');
  });

  it('validates top-level content according to the configured content mode', () => {
    const baseDraft = {
      buttons: [],
      recipient: [{ type: 'manual', value: '010-1234-5678' }],
      senderProfileId: 'brand-profile-acme',
    };
    const contentFields = (draft) => (
      getBrandMessageValidationIssues({ ...baseDraft, ...draft })
        .filter((issue) => issue.field === 'content')
    );

    expect(contentFields({
      carousel: {
        list: [
          { content: '카드 본문', image: { imageUrl: 'https://cdn.example.com/feed-1.png' }, title: '카드 1' },
          { content: '카드 본문', image: { imageUrl: 'https://cdn.example.com/feed-2.png' }, title: '카드 2' },
        ],
      },
      chatBubbleType: 'CAROUSEL_FEED',
      content: 'stale body'.repeat(200),
    })).toEqual([]);
    expect(contentFields({
      chatBubbleType: 'WIDE_ITEM_LIST',
      content: 'stale body'.repeat(200),
      header: '추천 상품',
      item: {
        list: [
          { title: '아이템 1' },
          { title: '아이템 2' },
          { title: '아이템 3' },
        ],
      },
    })).toEqual([]);
    expect(contentFields({
      chatBubbleType: 'PREMIUM_VIDEO',
      content: '',
      video: { videoUrl: 'https://tv.kakao.com/v/1234' },
    })).toEqual([]);
    expect(contentFields({
      chatBubbleType: 'COMMERCE',
      commerce: {
        image: { imageUrl: 'https://cdn.example.com/bag.png' },
        regularPrice: '59000',
        title: '시그니처 백',
      },
      content: '',
    })).toEqual([]);
    expect(contentFields({
      carousel: {
        list: [
          {
            image: { imageUrl: 'https://cdn.example.com/commerce-1.png' },
            regularPrice: '59000',
            title: '상품 1',
          },
          {
            image: { imageUrl: 'https://cdn.example.com/commerce-2.png' },
            regularPrice: '42000',
            title: '상품 2',
          },
        ],
      },
      chatBubbleType: 'CAROUSEL_COMMERCE',
      content: 'stale body'.repeat(200),
    })).toEqual([]);
  });

  it('validates carousel commerce intro only when the intro switch is on', () => {
    const baseCarouselCommerceDraft = {
      carousel: {
        head: {},
        list: [
          {
            image: { imageUrl: 'https://cdn.example.com/commerce-1.png' },
            regularPrice: '59000',
            title: '상품 1',
          },
          {
            image: { imageUrl: 'https://cdn.example.com/commerce-2.png' },
            regularPrice: '42000',
            title: '상품 2',
          },
        ],
      },
      chatBubbleType: 'CAROUSEL_COMMERCE',
      recipient: [{ type: 'manual', value: '010-1234-5678' }],
      senderProfileId: 'brand-profile-acme',
    };
    const introMessages = (draft) => getBrandMessageValidationIssues(draft)
      .map((issue) => issue.message)
      .filter((message) => message.startsWith('커머스 인트로'));

    expect(introMessages({
      ...baseCarouselCommerceDraft,
      carousel: {
        ...baseCarouselCommerceDraft.carousel,
        isUseIntro: false,
      },
    })).toEqual([]);
    expect(introMessages({
      ...baseCarouselCommerceDraft,
      carousel: {
        ...baseCarouselCommerceDraft.carousel,
        isUseIntro: true,
      },
    })).toEqual([
      '커머스 인트로 제목을 입력해 주세요.',
      '커머스 인트로 내용을 입력해 주세요.',
      '커머스 인트로 이미지를 업로드해 주세요.',
    ]);
  });

  it('validates carousel actions per slide instead of using common buttons or coupons', () => {
    const issues = getBrandMessageValidationIssues({
      buttons: [{ id: 'common-button', name: '', type: 'WL' }],
      carousel: {
        list: [
          {
            buttons: [],
            content: '카드 본문',
            image: { imageUrl: 'https://cdn.example.com/feed-1.png' },
            title: '카드 1',
          },
          {
            buttons: [{ id: 'card-button', linkMo: 'https://example.com', name: '보기', type: 'WL' }],
            content: '카드 본문',
            image: { imageUrl: 'https://cdn.example.com/feed-2.png' },
            title: '카드 2',
          },
        ],
      },
      chatBubbleType: 'CAROUSEL_FEED',
      coupon: { description: '', type: 'PERCENT' },
      recipient: [{ type: 'manual', value: '010-1234-5678' }],
      senderProfileId: 'brand-profile-acme',
    });

    expect(issues).toContainEqual({
      field: 'carousel',
      message: '캐러셀 피드 1번 버튼을 1개 이상 추가해 주세요.',
    });
    expect(issues.some((issue) => issue.field === 'buttons')).toBe(false);
    expect(issues.some((issue) => issue.field === 'coupon')).toBe(false);
  });

  it('normalizes coupons through the fixed option and fixed-value model', () => {
    const templateCoupon = normalizeBrandMessageDraftValue({
      coupon: {
        description: '쿠폰',
        isUseVariable: false,
        linkMo: 'https://example.com/coupon',
        title: '#{할인율}% 할인 쿠폰',
      },
    }).coupon;
    const fixedCoupon = normalizeBrandMessageDraftValue({
      coupon: {
        description: '쿠폰',
        fixedCouponValue: '15',
        isUseVariable: true,
        linkMo: 'https://example.com/coupon',
        selectCouponType: 'discountRateCoupon',
      },
    }).coupon;

    expect(templateCoupon).toMatchObject({
      fixedCouponValue: '',
      isUseVariable: false,
      selectCouponType: 'discountRateCoupon',
      title: '#{할인율}% 할인 쿠폰',
      type: 'PERCENT',
      variable: '',
    });
    expect(fixedCoupon).toMatchObject({
      fixedCouponValue: '15',
      isUseVariable: true,
      percent: '15',
      selectCouponType: 'discountRateCoupon',
      title: '15% 할인 쿠폰',
      type: 'PERCENT',
      variable: '15',
    });
    expect(getBrandMessageValidationIssues({
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
      coupon: templateCoupon,
      recipient: [{ type: 'manual', value: '010-1234-5678' }],
      senderProfileId: 'brand-profile-acme',
    })).toContainEqual({
      field: 'coupon',
      message: '쿠폰: 고정값을 입력해야 발송할 수 있습니다.',
    });
  });

  it('validates Brand Message template registration without send-only prerequisites', () => {
    const issues = getBrandMessageTemplateRegistrationIssues({
      chatBubbleType: 'TEXT',
      content: '',
      fallbackAdvertisementEnabled: true,
      fallbackEnabled: true,
      fallbackSenderNumber: '',
      fallbackUnsubscribeNumber: '',
      recipient: [],
      scheduledAt: '2026-06-02 15:00',
      senderProfileId: '',
    });

    expect(issues).toContainEqual({
      field: 'senderProfileId',
      message: '브랜드 발신 채널을 선택해 주세요.',
    });
    expect(issues).toContainEqual({
      field: 'content',
      message: '메시지 내용을 입력해 주세요.',
    });
    expect(issues.some((issue) => issue.field === 'recipient')).toBe(false);
    expect(issues.some((issue) => issue.field === 'fallbackSenderNumber')).toBe(false);
    expect(issues.some((issue) => issue.field === 'fallbackUnsubscribeNumber')).toBe(false);
    expect(issues.some((issue) => issue.field === 'scheduledAt')).toBe(false);
    expect(issues.some((issue) => issue.field === 'templateParameter')).toBe(false);
  });

  it('validates Brand Message template registration button, coupon, and mode constraints', () => {
    const templateCoupon = normalizeBrandMessageDraftValue({
      coupon: {
        description: '쿠폰',
        isUseVariable: false,
        linkMo: 'https://example.com/coupon',
        title: '#{할인율}% 할인 쿠폰',
      },
    }).coupon;

    expect(getBrandMessageTemplateRegistrationIssues({
      buttons: [
        { id: 'link-button', linkMo: 'https://example.com', name: '자세히 보기', type: 'WL' },
        { id: 'ac-button', name: '채널 추가', type: 'AC' },
      ],
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
      coupon: templateCoupon,
      senderProfileId: 'brand-profile-acme',
    })).toEqual(expect.arrayContaining([
      {
        field: 'coupon',
        message: '쿠폰: 고정값을 입력해야 발송할 수 있습니다.',
      },
      {
        field: 'buttons',
        message: '텍스트 채널 추가(AC) 버튼은 첫 번째 버튼이어야 합니다.',
      },
    ]));

    expect(getBrandMessageTemplateRegistrationIssues({
      mode: 'template',
      senderProfileId: 'brand-profile-acme',
      templateCode: 'BRAND_TEMPLATE',
    })).toContainEqual({
      field: 'mode',
      message: '템플릿 등록은 프리스타일 작성 중인 브랜드 메시지만 사용할 수 있습니다.',
    });
  });

  it('normalizes NHN AC channel-add button names and validates position and carousel uniqueness', () => {
    expect(normalizeBrandMessageDraftValue({
      buttons: [{ id: 'ac-button', name: '친구 추가', type: 'AC' }],
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
      recipient: [{ type: 'manual', value: '010-1234-5678' }],
      senderProfileId: 'brand-profile-acme',
    }).buttons[0]).toMatchObject({ name: '채널 추가', type: 'AC' });

    expect(getBrandMessageValidationIssues({
      buttons: [
        { id: 'link-button', linkMo: 'https://example.com', name: '자세히 보기', type: 'WL' },
        { id: 'ac-button', name: '채널 추가', type: 'AC' },
      ],
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
      recipient: [{ type: 'manual', value: '010-1234-5678' }],
      senderProfileId: 'brand-profile-acme',
    })).toContainEqual({
      field: 'buttons',
      message: '텍스트 채널 추가(AC) 버튼은 첫 번째 버튼이어야 합니다.',
    });

    expect(getBrandMessageValidationIssues({
      carousel: {
        list: [
          {
            buttons: [{ id: 'ac-button-1', name: '채널 추가', type: 'AC' }],
            content: '카드 본문',
            image: { imageUrl: 'https://cdn.example.com/feed-1.png' },
            title: '카드 1',
          },
          {
            buttons: [{ id: 'ac-button-2', name: '채널 추가', type: 'AC' }],
            content: '카드 본문',
            image: { imageUrl: 'https://cdn.example.com/feed-2.png' },
            title: '카드 2',
          },
        ],
      },
      chatBubbleType: 'CAROUSEL_FEED',
      recipient: [{ type: 'manual', value: '010-1234-5678' }],
      senderProfileId: 'brand-profile-acme',
    })).toContainEqual({
      field: 'carousel',
      message: '캐러셀 전체에서 채널 추가(AC) 버튼은 1개만 사용할 수 있습니다.',
    });
  });

  it('does not leak playground sender profile IDs into production template queries', () => {
    expect(defaultBrandMessageSendFormValue.senderProfileId).toBe('');
  });

  it('uses the NHN brand-message draft field names by default', () => {
    for (const field of REQUIRED_NHN_DRAFT_FIELDS) {
      expect(hasOwn(defaultBrandMessageSendFormValue, field)).toBe(true);
    }

    expect(defaultBrandMessageSendFormValue).toMatchObject({
      chatBubbleType: 'TEXT',
      mode: 'freestyle',
      templateCode: '',
      templateParameter: {},
    });

    for (const field of FORBIDDEN_LEGACY_DRAFT_FIELDS) {
      expect(hasOwn(defaultBrandMessageSendFormValue, field)).toBe(false);
    }
  });

  it('normalizes legacy brand-message callers at the component boundary', () => {
    const normalized = normalizeBrandMessageDraftValue({
      imageName: 'hero.png',
      imageUrl: 'sample:blue',
      messageType: 'wide',
      mode: 'TEMPLATE',
      templateId: 'BRAND_WIDE',
      variables: {
        고객명: {
          mode: 'manual',
          value: '민지',
        },
      },
    });

    expect(normalized).toMatchObject({
      chatBubbleType: 'WIDE',
      image: {
        imageName: 'hero.png',
        imageUrl: 'sample:blue',
      },
      mode: 'template',
      templateCode: 'BRAND_WIDE',
      templateParameter: {
        고객명: {
          mode: 'manual',
          value: '민지',
        },
      },
    });

    for (const field of FORBIDDEN_LEGACY_DRAFT_FIELDS) {
      expect(hasOwn(normalized, field)).toBe(false);
    }
  });

  it('selects NHN image upload types for every image-bearing brand bubble type', () => {
    const file = { name: 'brand.png' };
    const cases = [
      {
        draft: { chatBubbleType: 'IMAGE', imageFile: file },
        expected: [{ imageType: 'IMAGE', index: null, section: 'image' }],
      },
      {
        draft: { chatBubbleType: 'WIDE', imageFile: file },
        expected: [{ imageType: 'WIDE_IMAGE', index: null, section: 'image' }],
      },
      {
        draft: {
          chatBubbleType: 'WIDE_ITEM_LIST',
          item: {
            list: [
              { image: { imageFile: file } },
              { image: { imageFile: file } },
            ],
          },
        },
        expected: [
          { imageType: 'MAIN_WIDE_ITEMLIST_IMAGE', index: 0, section: 'item.list[]' },
          { imageType: 'NORMAL_WIDE_ITEMLIST_IMAGE', index: 1, section: 'item.list[]' },
        ],
      },
      {
        draft: { chatBubbleType: 'PREMIUM_VIDEO', video: { thumbnailFile: file } },
        expected: [{ imageType: 'IMAGE', index: null, section: 'video.thumbnailUrl' }],
      },
      {
        draft: { chatBubbleType: 'COMMERCE', commerce: { image: { imageFile: file } } },
        expected: [{ imageType: 'IMAGE', index: null, section: 'commerce' }],
      },
      {
        draft: {
          chatBubbleType: 'CAROUSEL_FEED',
          carousel: {
            head: { image: { imageFile: file } },
            list: [
              { image: { imageFile: file } },
              { image: { imageFile: file } },
            ],
          },
        },
        expected: [
          { imageType: 'CAROUSEL_FEED_IMAGE', index: 0, section: 'carousel.list[]' },
          { imageType: 'CAROUSEL_FEED_IMAGE', index: 1, section: 'carousel.list[]' },
        ],
      },
      {
        draft: {
          chatBubbleType: 'CAROUSEL_COMMERCE',
          carousel: {
            list: [{ image: { imageFile: file } }],
          },
        },
        expected: [{ imageType: 'CAROUSEL_COMMERCE_IMAGE', index: 0, section: 'carousel.list[]' }],
      },
      {
        draft: {
          chatBubbleType: 'CAROUSEL_COMMERCE',
          carousel: {
            head: { image: { imageFile: file } },
            isUseIntro: true,
            list: [{ image: { imageFile: file } }],
          },
        },
        expected: [
          { imageType: 'CAROUSEL_COMMERCE_IMAGE', index: null, section: 'carousel.head' },
          { imageType: 'CAROUSEL_COMMERCE_IMAGE', index: 0, section: 'carousel.list[]' },
        ],
      },
    ];

    for (const { draft, expected } of cases) {
      expect(getBrandImageUploadTargets(draft).map(({ imageType, index, section }) => ({
        imageType,
        index,
        section,
      }))).toEqual(expected);
    }
  });

  it('builds NHN brand image upload form data from a non-empty image file', () => {
    const file = new File(['image-bytes'], 'brand.png', { type: 'image/png' });
    const formData = buildBrandImageUploadFormData({
      file,
      imageType: 'MAIN_WIDE_ITEMLIST_IMAGE',
      senderResourceId: 'brand-profile-acme',
    });

    expect(formData.get('senderResourceId')).toBe('brand-profile-acme');
    expect(formData.get('imageType')).toBe('MAIN_WIDE_ITEMLIST_IMAGE');
    expect(formData.get('image')).toBe(file);
  });

  it('rejects empty brand image files before requesting upload', () => {
    const file = new File([], 'empty.png', { type: 'image/png' });

    expect(() => buildBrandImageUploadFormData({
      file,
      imageType: 'MAIN_WIDE_ITEMLIST_IMAGE',
      senderResourceId: 'brand-profile-acme',
    })).toThrow(MessageSendValidationError);
    expect(() => buildBrandImageUploadFormData({
      file,
      imageType: 'MAIN_WIDE_ITEMLIST_IMAGE',
      senderResourceId: 'brand-profile-acme',
    })).toThrow('이미지 파일이 비어 있습니다.');
  });

  it('applies uploaded brand images back to their NHN draft section', () => {
    const file = { name: 'brand.png' };
    const draft = {
      chatBubbleType: 'CAROUSEL_COMMERCE',
      carousel: {
        head: { image: { imageFile: file, imageUrl: 'data:image/png;base64,head' } },
        isUseIntro: true,
        list: [{ image: { imageFile: file, imageUrl: 'data:image/png;base64,card' } }],
      },
    };
    const [headTarget, cardTarget] = getBrandImageUploadTargets(draft);
    const withHead = applyBrandImageUploadResult(draft, headTarget, {
      imageName: 'head.png',
      imageSeq: 'head-seq',
      imageUrl: 'https://cdn.example.com/head.png',
    });
    const withCard = applyBrandImageUploadResult(withHead, cardTarget, {
      imageName: 'card.png',
      imageSeq: 'card-seq',
      imageUrl: 'https://cdn.example.com/card.png',
    });

    expect(withCard.carousel.head).toMatchObject({
      image: {
        imageName: 'head.png',
        imageSeq: 'head-seq',
        imageType: 'CAROUSEL_COMMERCE_IMAGE',
        imageUrl: 'https://cdn.example.com/head.png',
      },
      imageUrl: 'https://cdn.example.com/head.png',
    });
    expect(withCard.carousel.list[0]).toMatchObject({
      image: {
        imageName: 'card.png',
        imageSeq: 'card-seq',
        imageType: 'CAROUSEL_COMMERCE_IMAGE',
        imageUrl: 'https://cdn.example.com/card.png',
      },
      imageUrl: 'https://cdn.example.com/card.png',
    });
    expect(JSON.stringify(withCard)).not.toContain('data:image');
  });
});
