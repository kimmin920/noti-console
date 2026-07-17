import { describe, expect, it } from 'vitest';

import {
  createBrandMessageDraftFromTemplate,
  defaultBrandMessageSendFormValue,
} from '../../components/ui/BrandMessageSendForm.jsx';
import {
  buildBrandMessageSendPayload,
  buildBrandTemplateRegistrationPayload,
  buildSmsSendPayload,
  MessageSendValidationError,
} from '../../features/console/messageSend/payloads.js';

const baseSmsMessage = {
  body: '안내 문자입니다.',
  recipient: [{ type: 'manual', value: '010-1234-5678' }],
  senderNumber: 'sms_resource_1',
};
const baseBrandMessage = {
  mode: 'freestyle',
  pushAlarm: true,
  recipient: [{ type: 'manual', value: '010-1234-5678' }],
  senderProfileId: 'kakao_resource_1',
};
const legacyBrandTerms = [
  'sendType',
  'msgType',
  'messageVariable',
  'buttonVariable',
  'couponVariable',
  'imageVariable',
  'videoVariable',
  'commerceVariable',
  'carouselVariable',
  'originCID',
  'isUseVariable',
  'selectCouponType',
  'exceptionVariableTitle',
];

describe('message send payload builders', () => {
  it('includes a trimmed SMS management title when provided', () => {
    const payload = buildSmsSendPayload({
      ...baseSmsMessage,
      managementTitle: '  6월 대량 발송  ',
    });

    expect(payload.managementTitle).toBe('6월 대량 발송');
  });

  it('omits the SMS management title when blank', () => {
    const payload = buildSmsSendPayload({
      ...baseSmsMessage,
      managementTitle: '   ',
    });

    expect(payload).not.toHaveProperty('managementTitle');
  });

  it('uses the title field as the recipient-visible LMS title', () => {
    const payload = buildSmsSendPayload({
      ...baseSmsMessage,
      body: '가'.repeat(46),
      managementTitle: '  배송 일정 안내  ',
    });

    expect(payload.channel).toBe('lms');
    expect(payload.managementTitle).toBe('배송 일정 안내');
    expect(payload.title).toBe('배송 일정 안내');
  });

  it('expands a concrete Publ contact into the existing SMS recipient payload', () => {
    const payload = buildSmsSendPayload({
      ...baseSmsMessage,
      recipient: [{
        externalId: 'publ-member-1',
        label: 'Publ 고객',
        recipientSource: 'publ',
        type: 'publ-contact',
        value: '010-9999-8888',
      }],
    });

    expect(payload.recipients).toEqual([{ recipientNo: '01099998888' }]);
  });

  it('rejects SMS management titles over 120 characters', () => {
    expect(() => buildSmsSendPayload({
      ...baseSmsMessage,
      managementTitle: '가'.repeat(121),
    })).toThrow(MessageSendValidationError);
  });

  it('rejects SMS/LMS/MMS bodies over 2000 bytes', () => {
    expect(() => buildSmsSendPayload({
      ...baseSmsMessage,
      body: '가'.repeat(1001),
    })).toThrow(MessageSendValidationError);
  });

  it('marks advertising SMS for server-owned advertisement delivery', () => {
    const payload = buildSmsSendPayload({
      ...baseSmsMessage,
      isAdvertisement: true,
      unsubscribeNumber: '080-999-9999',
    });

    expect(payload.isAdvertisement).toBe(true);
    expect(payload).not.toHaveProperty('unsubscribeNo');
    expect(payload).not.toHaveProperty('unsubscribeNumber');
  });

  it('builds an NHN TEXT brand-message freestyle payload', () => {
    const payload = stripRequestId(buildBrandMessageSendPayload({
      ...baseBrandMessage,
      buttonVariable: { legacy: true },
      buttons: [{ id: 'button-1', linkMo: 'https://example.com', name: '자세히 보기', type: 'WL' }],
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
      coupon: { description: '10% 할인', linkMo: 'https://example.com/coupon', percent: '10', type: 'PERCENT' },
      messageVariable: { legacy: true },
      resellerCode: 'reseller-1',
      statsId: 'brand01',
      targeting: 'M',
      unsubscribeAuthNo: 'AUTH-1',
      unsubscribeNo: '080-123-4567',
    }));

    expect(payload).toEqual({
      adult: false,
      buttons: [{ linkMo: 'https://example.com', name: '자세히 보기', type: 'WL' }],
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
      coupon: { description: '10% 할인', linkMo: 'https://example.com/coupon', title: '10% 할인 쿠폰' },
      fallback: { enabled: false },
      mode: 'freestyle',
      pushAlarm: true,
      recipients: [{ recipientNo: '01012345678' }],
      resellerCode: 'reseller-1',
      senderResourceId: 'kakao_resource_1',
      statsId: 'brand01',
      targeting: 'M',
      unsubscribeAuthNo: 'AUTH-1',
      unsubscribeNo: '080-123-4567',
    });
    expectNoLegacyBrandFields(payload);
  });

  it('builds a Brand Message template registration payload without send-only fields', () => {
    const payload = buildBrandTemplateRegistrationPayload({
      ...baseBrandMessage,
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
      fallbackEnabled: true,
      fallbackSenderNumber: '',
      pushAlarm: false,
      recipient: [],
      resellerCode: 'reseller-1',
      scheduledAt: '2026-06-02 15:00',
      statsId: 'brand01',
      targeting: 'M',
      unsubscribeAuthNo: 'AUTH-1',
      unsubscribeNo: '080-123-4567',
    }, { templateName: '  6월 브랜드 템플릿  ' });

    expect(payload).toEqual({
      adult: false,
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
      senderResourceId: 'kakao_resource_1',
      templateName: '6월 브랜드 템플릿',
    });
    expectNoBrandTemplateRegistrationSendOnlyFields(payload);
  });

  it('requires uploaded image URLs for Brand Message template registration', () => {
    expect(() => buildBrandTemplateRegistrationPayload({
      ...baseBrandMessage,
      chatBubbleType: 'IMAGE',
      content: '이미지 안내',
      image: { imageUrl: 'blob:http://localhost/image' },
      recipient: [],
    }, { templateName: '이미지 템플릿' })).toThrow(MessageSendValidationError);

    expect(() => buildBrandTemplateRegistrationPayload({
      ...baseBrandMessage,
      chatBubbleType: 'IMAGE',
      content: '이미지 안내',
      image: null,
      recipient: [],
    }, { templateName: '이미지 템플릿' })).toThrow(MessageSendValidationError);
  });

  it('rejects template-mode Brand Message template registration', () => {
    expect(() => buildBrandTemplateRegistrationPayload({
      ...baseBrandMessage,
      mode: 'template',
      recipient: [],
      templateCode: 'BRAND_TEMPLATE',
    }, { templateName: '재등록 템플릿' })).toThrow(MessageSendValidationError);
  });

  it('requires a bounded Brand Message template registration name', () => {
    expect(() => buildBrandTemplateRegistrationPayload({
      ...baseBrandMessage,
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
      recipient: [],
    }, { templateName: '   ' })).toThrow(MessageSendValidationError);

    expect(() => buildBrandTemplateRegistrationPayload({
      ...baseBrandMessage,
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
      recipient: [],
    }, { templateName: '가'.repeat(201) })).toThrow(MessageSendValidationError);
  });

  it('serializes fixed coupon options without leaking editor-only coupon fields', () => {
    const payload = stripRequestId(buildBrandMessageSendPayload({
      ...baseBrandMessage,
      buttons: [{ linkMo: 'https://example.com', name: '자세히 보기', type: 'WL' }],
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
      coupon: {
        description: '15% 할인',
        exceptionVariableTitle: '% 할인 쿠폰',
        fixedCouponValue: '15',
        isUseVariable: true,
        linkMo: 'https://example.com/coupon',
        selectCouponType: 'discountRateCoupon',
        title: '15% 할인 쿠폰',
        variable: '15',
      },
    }));

    expect(payload.coupon).toEqual({
      description: '15% 할인',
      linkMo: 'https://example.com/coupon',
      title: '15% 할인 쿠폰',
    });
    expectNoLegacyBrandFields(payload);
  });

  it('keeps coupon placeholder and fixed-value rules provider-safe for template registration', () => {
    const payload = buildBrandTemplateRegistrationPayload({
      ...baseBrandMessage,
      buttons: [{ linkMo: 'https://example.com', name: '자세히 보기', type: 'WL' }],
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
      coupon: {
        description: '15% 할인',
        exceptionVariableTitle: '% 할인 쿠폰',
        fixedCouponValue: '15',
        isUseVariable: true,
        linkMo: 'https://example.com/coupon',
        selectCouponType: 'discountRateCoupon',
        title: '15% 할인 쿠폰',
        variable: '15',
      },
      recipient: [],
    }, { templateName: '쿠폰 템플릿' });

    expect(payload.coupon).toEqual({
      description: '15% 할인',
      linkMo: 'https://example.com/coupon',
      title: '15% 할인 쿠폰',
    });
    expectNoLegacyBrandFields(payload);
    expectNoBrandTemplateRegistrationSendOnlyFields(payload);

    expect(() => buildBrandTemplateRegistrationPayload({
      ...baseBrandMessage,
      buttons: [{ linkMo: 'https://example.com', name: '자세히 보기', type: 'WL' }],
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
      coupon: {
        description: '할인',
        linkMo: 'https://example.com/coupon',
        title: '#{할인율}% 할인 쿠폰',
      },
      recipient: [],
    }, { templateName: '쿠폰 템플릿' })).toThrow(MessageSendValidationError);
  });

  it('rejects unresolved coupon placeholders in freestyle brand-message payloads', () => {
    expect(() => buildBrandMessageSendPayload({
      ...baseBrandMessage,
      buttons: [{ linkMo: 'https://example.com', name: '자세히 보기', type: 'WL' }],
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
      coupon: {
        description: '할인',
        linkMo: 'https://example.com/coupon',
        title: '#{할인율}% 할인 쿠폰',
      },
    })).toThrow(MessageSendValidationError);
  });

  it('rejects invalid NHN AC channel-add buttons before submit', () => {
    expect(() => buildBrandMessageSendPayload({
      ...baseBrandMessage,
      buttons: [{ name: '친구 추가', type: 'AC' }],
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
    })).toThrow(MessageSendValidationError);

    expect(() => buildBrandMessageSendPayload({
      ...baseBrandMessage,
      buttons: [
        { linkMo: 'https://example.com', name: '자세히 보기', type: 'WL' },
        { name: '채널 추가', type: 'AC' },
      ],
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
    })).toThrow(MessageSendValidationError);

    expect(() => buildBrandMessageSendPayload({
      ...baseBrandMessage,
      carousel: {
        list: [
          {
            buttons: [{ name: '채널 추가', type: 'AC' }],
            header: '피드 카드 1',
            imageUrl: 'https://cdn.example.com/feed-card-1.png',
            message: '카드 본문',
          },
          {
            buttons: [{ name: '채널 추가', type: 'AC' }],
            header: '피드 카드 2',
            imageUrl: 'https://cdn.example.com/feed-card-2.png',
            message: '카드 본문',
          },
        ],
      },
      chatBubbleType: 'CAROUSEL_FEED',
    })).toThrow(MessageSendValidationError);
  });

  it('omits stale rich fields when building an NHN WIDE brand-message payload', () => {
    const payload = stripRequestId(buildBrandMessageSendPayload({
      ...baseBrandMessage,
      carousel: {
        list: [
          { image: { imageUrl: 'https://cdn.example.com/card-1.png' }, title: '카드 1' },
          { image: { imageUrl: 'https://cdn.example.com/card-2.png' }, title: '카드 2' },
        ],
      },
      chatBubbleType: 'WIDE',
      commerce: {
        image: { imageUrl: 'https://cdn.example.com/commerce.png' },
        title: '상품',
      },
      content: '와이드 이미지 안내',
      image: {
        imageName: 'wide.png',
        imageUrl: 'https://cdn.example.com/wide.png',
      },
      item: {
        list: [
          { image: { imageUrl: 'https://cdn.example.com/item.png' }, title: '아이템' },
        ],
      },
      video: {
        thumbnailUrl: 'https://cdn.example.com/thumb.png',
        title: '영상',
        videoUrl: 'https://tv.kakao.com/v/1234',
      },
    }));

    expect(payload).toMatchObject({
      chatBubbleType: 'WIDE',
      content: '와이드 이미지 안내',
      image: {
        imageName: 'wide.png',
        imageUrl: 'https://cdn.example.com/wide.png',
      },
      mode: 'freestyle',
    });
    expect(payload).not.toHaveProperty('carousel');
    expect(payload).not.toHaveProperty('commerce');
    expect(payload).not.toHaveProperty('item');
    expect(payload).not.toHaveProperty('video');
  });

  it('builds an NHN WIDE_ITEM_LIST brand-message freestyle payload', () => {
    const payload = stripRequestId(buildBrandMessageSendPayload({
      ...baseBrandMessage,
      chatBubbleType: 'WIDE_ITEM_LIST',
      content: 'stale body',
      header: '추천 상품',
      item: {
        list: [
          {
            id: 'ui-item-1',
            image: {
              imageFile: { name: 'local.png' },
              imageUrl: 'https://cdn.example.com/main.png',
            },
            msgType: 'legacy',
            linkMo: 'https://m.example.com/main',
            title: '아우터',
          },
          {
            content: '재입고',
            image: { imageUrl: 'https://cdn.example.com/sub.png' },
            linkMo: 'https://m.example.com/sub',
            title: '니트',
          },
          {
            content: '단독 혜택',
            image: { imageUrl: 'https://cdn.example.com/sub-2.png' },
            linkMo: 'https://m.example.com/sub-2',
            title: '팬츠',
          },
        ],
      },
    }));

    expect(payload).toMatchObject({
      chatBubbleType: 'WIDE_ITEM_LIST',
      header: '추천 상품',
      item: {
        list: [
          {
            imageUrl: 'https://cdn.example.com/main.png',
            linkMo: 'https://m.example.com/main',
            title: '아우터',
          },
          {
            imageUrl: 'https://cdn.example.com/sub.png',
            linkMo: 'https://m.example.com/sub',
            title: '니트',
          },
          {
            imageUrl: 'https://cdn.example.com/sub-2.png',
            linkMo: 'https://m.example.com/sub-2',
            title: '팬츠',
          },
        ],
      },
      mode: 'freestyle',
    });
    expect(payload).not.toHaveProperty('content');
    expectNoLegacyBrandFields(payload);
    expect(JSON.stringify(payload)).not.toContain('imageFile');
    expect(JSON.stringify(payload)).not.toContain('ui-item-1');
  });

  it('builds an NHN PREMIUM_VIDEO brand-message freestyle payload', () => {
    const payload = stripRequestId(buildBrandMessageSendPayload({
      ...baseBrandMessage,
      chatBubbleType: 'PREMIUM_VIDEO',
      content: '영상 소개 문구',
      video: {
        thumbnailFile: { name: 'thumb.png' },
        thumbnailUrl: 'https://cdn.example.com/thumb.png',
        title: '시즌 필름',
        videoUrl: 'https://tv.kakao.com/v/1234',
        videoVariable: { legacy: true },
      },
    }));

    expect(payload).toMatchObject({
      chatBubbleType: 'PREMIUM_VIDEO',
      content: '영상 소개 문구',
      mode: 'freestyle',
      video: {
        thumbnailUrl: 'https://cdn.example.com/thumb.png',
        title: '시즌 필름',
        videoUrl: 'https://tv.kakao.com/v/1234',
      },
    });
    expectNoLegacyBrandFields(payload);
    expect(JSON.stringify(payload)).not.toContain('thumbnailFile');
  });

  it('builds an NHN COMMERCE brand-message freestyle payload', () => {
    const payload = stripRequestId(buildBrandMessageSendPayload({
      ...baseBrandMessage,
      buttons: [{ linkMo: 'https://example.com/bag', name: '구매하기', type: 'WL' }],
      chatBubbleType: 'COMMERCE',
      content: '상품 소개 문구',
      commerce: {
        commerceVariable: { legacy: true },
        discountPrice: '39000',
        image: { imageUrl: 'https://cdn.example.com/bag.png' },
        regularPrice: '59000',
        title: '시그니처 백',
      },
    }));

    expect(payload).toMatchObject({
      chatBubbleType: 'COMMERCE',
      buttons: [{ linkMo: 'https://example.com/bag', name: '구매하기', type: 'WL' }],
      image: { imageUrl: 'https://cdn.example.com/bag.png' },
      commerce: {
        discountPrice: 39000,
        discountRate: 33,
        regularPrice: 59000,
        title: '시그니처 백',
      },
      mode: 'freestyle',
    });
    expectNoLegacyBrandFields(payload);
  });

  it('builds NHN CAROUSEL_FEED and CAROUSEL_COMMERCE brand-message freestyle payloads', () => {
    const feedPayload = stripRequestId(buildBrandMessageSendPayload({
      ...baseBrandMessage,
      carousel: {
        carouselVariable: { legacy: true },
        head: { image: { imageUrl: 'https://cdn.example.com/feed-head.png' } },
        list: [
          {
            buttons: [{ linkMo: 'https://example.com/feed-1', name: '보기', type: 'WL' }],
            coupon: { description: '쿠폰', linkMo: 'https://example.com/coupon-1', title: '10% 할인 쿠폰' },
            header: '피드 카드 1',
            imageUrl: 'https://cdn.example.com/feed-card-1.png',
            message: '카드 본문',
          },
          {
            buttons: [{ linkMo: 'https://example.com/feed-2', name: '보기', type: 'WL' }],
            header: '피드 카드 2',
            imageUrl: 'https://cdn.example.com/feed-card-2.png',
            message: '카드 본문',
          },
        ],
      },
      buttons: [{ linkMo: 'https://example.com/global', name: '공통', type: 'WL' }],
      chatBubbleType: 'CAROUSEL_FEED',
      content: 'stale body',
      coupon: { description: '공통 쿠폰', linkMo: 'https://example.com/global-coupon', percent: '5', type: 'PERCENT' },
    }));
    const commercePayload = stripRequestId(buildBrandMessageSendPayload({
      ...baseBrandMessage,
      carousel: {
        list: [
          {
            buttons: [{ linkMo: 'https://example.com/commerce-1', name: '구매', type: 'WL' }],
            commerce: {
              discountFixed: 13000,
              discountPrice: 29000,
              regularPrice: 42000,
              title: '크로스백 1',
            },
            imageUrl: 'https://cdn.example.com/commerce-card-1.png',
          },
          {
            buttons: [{ linkMo: 'https://example.com/commerce-2', name: '구매', type: 'WL' }],
            commerce: {
              discountFixed: 13000,
              discountPrice: 19000,
              regularPrice: 32000,
              title: '크로스백 2',
            },
            imageUrl: 'https://cdn.example.com/commerce-card-2.png',
          },
        ],
      },
      buttons: [{ linkMo: 'https://example.com/global', name: '공통', type: 'WL' }],
      chatBubbleType: 'CAROUSEL_COMMERCE',
      content: 'stale commerce intro',
      coupon: { description: '공통 쿠폰', linkMo: 'https://example.com/global-coupon', percent: '5', type: 'PERCENT' },
    }));

    expect(feedPayload).toMatchObject({
      carousel: {
        list: [
          {
            buttons: [{ linkMo: 'https://example.com/feed-1', name: '보기', type: 'WL' }],
            coupon: { description: '쿠폰', linkMo: 'https://example.com/coupon-1', title: '10% 할인 쿠폰' },
            header: '피드 카드 1',
            imageUrl: 'https://cdn.example.com/feed-card-1.png',
            message: '카드 본문',
          },
          {
            buttons: [{ linkMo: 'https://example.com/feed-2', name: '보기', type: 'WL' }],
            header: '피드 카드 2',
            imageUrl: 'https://cdn.example.com/feed-card-2.png',
            message: '카드 본문',
          },
        ],
      },
      chatBubbleType: 'CAROUSEL_FEED',
      mode: 'freestyle',
    });
    expect(feedPayload).not.toHaveProperty('content');
    expect(commercePayload).toMatchObject({
      carousel: {
        list: [
          {
            buttons: [{ linkMo: 'https://example.com/commerce-1', name: '구매', type: 'WL' }],
            commerce: {
              discountFixed: 13000,
              discountPrice: 29000,
              regularPrice: 42000,
              title: '크로스백 1',
            },
            imageUrl: 'https://cdn.example.com/commerce-card-1.png',
          },
          {
            buttons: [{ linkMo: 'https://example.com/commerce-2', name: '구매', type: 'WL' }],
            commerce: {
              discountFixed: 13000,
              discountPrice: 19000,
              regularPrice: 32000,
              title: '크로스백 2',
            },
            imageUrl: 'https://cdn.example.com/commerce-card-2.png',
          },
        ],
      },
      chatBubbleType: 'CAROUSEL_COMMERCE',
      mode: 'freestyle',
    });
    expect(commercePayload).not.toHaveProperty('content');
    expect(feedPayload.carousel).not.toHaveProperty('head');
    expect(commercePayload.carousel).not.toHaveProperty('head');
    expect(feedPayload).not.toHaveProperty('buttons');
    expect(feedPayload).not.toHaveProperty('coupon');
    expect(commercePayload).not.toHaveProperty('buttons');
    expect(commercePayload).not.toHaveProperty('coupon');
    expectNoLegacyBrandFields(feedPayload);
    expectNoLegacyBrandFields(commercePayload);
  });

  it('builds carousel tail only when the more button is enabled', () => {
    const baseCarousel = {
      list: [
        {
          buttons: [{ linkMo: 'https://example.com/feed-1', name: '보기', type: 'WL' }],
          header: '피드 카드 1',
          imageUrl: 'https://cdn.example.com/feed-card-1.png',
          message: '카드 본문',
        },
        {
          buttons: [{ linkMo: 'https://example.com/feed-2', name: '보기', type: 'WL' }],
          header: '피드 카드 2',
          imageUrl: 'https://cdn.example.com/feed-card-2.png',
          message: '카드 본문',
        },
      ],
    };
    const payload = stripRequestId(buildBrandMessageSendPayload({
      ...baseBrandMessage,
      carousel: {
        ...baseCarousel,
        moreButton: {
          isMoreButton: true,
          linkMobile: ' https://m.example.com/more ',
          linkPc: 'https://example.com/more',
        },
      },
      chatBubbleType: 'CAROUSEL_FEED',
    }));
    const disabledPayload = stripRequestId(buildBrandMessageSendPayload({
      ...baseBrandMessage,
      carousel: {
        ...baseCarousel,
        tail: {
          isMoreButton: false,
          linkMo: 'https://m.example.com/more',
        },
      },
      chatBubbleType: 'CAROUSEL_FEED',
    }));

    expect(payload.carousel.tail).toEqual({
      isMoreButton: true,
      linkMo: 'https://m.example.com/more',
      linkPc: 'https://example.com/more',
    });
    expect(payload.carousel).not.toHaveProperty('moreButton');
    expect(disabledPayload.carousel).not.toHaveProperty('tail');
  });

  it('requires a mobile link when carousel more button is enabled', () => {
    expect(() => buildBrandMessageSendPayload({
      ...baseBrandMessage,
      carousel: {
        list: [
          {
            buttons: [{ linkMo: 'https://example.com/feed-1', name: '보기', type: 'WL' }],
            header: '피드 카드 1',
            imageUrl: 'https://cdn.example.com/feed-card-1.png',
            message: '카드 본문',
          },
          {
            buttons: [{ linkMo: 'https://example.com/feed-2', name: '보기', type: 'WL' }],
            header: '피드 카드 2',
            imageUrl: 'https://cdn.example.com/feed-card-2.png',
            message: '카드 본문',
          },
        ],
        tail: {
          isMoreButton: true,
          linkPc: 'https://example.com/more',
        },
      },
      chatBubbleType: 'CAROUSEL_FEED',
    })).toThrow(MessageSendValidationError);
  });

  it('includes a CAROUSEL_COMMERCE intro head only when intro is enabled', () => {
    const payload = stripRequestId(buildBrandMessageSendPayload({
      ...baseBrandMessage,
      carousel: {
        head: {
          content: '기획전 대표 문구',
          header: '브랜드 단독 혜택',
          image: { imageUrl: 'https://cdn.example.com/commerce-head.png' },
          imageName: 'local-head.png',
          linkMo: ' https://m.example.com/event ',
          linkPc: 'https://example.com/event',
        },
        isUseIntro: true,
        list: [
          {
            buttons: [{ linkMo: 'https://example.com/commerce', name: '구매', type: 'WL' }],
            commerce: {
              discountFixed: 13000,
              discountPrice: 29000,
              regularPrice: 42000,
              title: '크로스백',
            },
            imageUrl: 'https://cdn.example.com/commerce-card.png',
          },
        ],
      },
      chatBubbleType: 'CAROUSEL_COMMERCE',
    }));
    const disabledPayload = stripRequestId(buildBrandMessageSendPayload({
      ...baseBrandMessage,
      carousel: {
        head: {
          content: '',
          header: '',
          image: {},
          linkPc: 'https://example.com/ignored',
        },
        isUseIntro: false,
        list: [
          {
            buttons: [{ linkMo: 'https://example.com/commerce-1', name: '구매', type: 'WL' }],
            commerce: {
              discountFixed: 13000,
              discountPrice: 29000,
              regularPrice: 42000,
              title: '크로스백 1',
            },
            imageUrl: 'https://cdn.example.com/commerce-card-1.png',
          },
          {
            buttons: [{ linkMo: 'https://example.com/commerce-2', name: '구매', type: 'WL' }],
            commerce: {
              discountFixed: 13000,
              discountPrice: 19000,
              regularPrice: 32000,
              title: '크로스백 2',
            },
            imageUrl: 'https://cdn.example.com/commerce-card-2.png',
          },
        ],
      },
      chatBubbleType: 'CAROUSEL_COMMERCE',
    }));

    expect(payload).toMatchObject({
      carousel: {
        head: {
          content: '기획전 대표 문구',
          header: '브랜드 단독 혜택',
          imageUrl: 'https://cdn.example.com/commerce-head.png',
          linkMo: 'https://m.example.com/event',
          linkPc: 'https://example.com/event',
        },
        list: [
          {
            buttons: [{ linkMo: 'https://example.com/commerce', name: '구매', type: 'WL' }],
            commerce: {
              discountFixed: 13000,
              discountPrice: 29000,
              regularPrice: 42000,
              title: '크로스백',
            },
            imageUrl: 'https://cdn.example.com/commerce-card.png',
          },
        ],
      },
      chatBubbleType: 'CAROUSEL_COMMERCE',
      mode: 'freestyle',
    });
    expect(payload.carousel).not.toHaveProperty('isUseIntro');
    expect(payload.carousel.head).not.toHaveProperty('image');
    expect(payload.carousel.head).not.toHaveProperty('imageName');
    expect(disabledPayload.carousel).not.toHaveProperty('head');
    expect(disabledPayload.carousel).not.toHaveProperty('isUseIntro');
  });

  it('builds an NHN template brand-message payload with recipient parameters', () => {
    const payload = stripRequestId(buildBrandMessageSendPayload({
      ...baseBrandMessage,
      imageParameters: [{ imageUrl: 'https://cdn.example.com/template.png', name: 'hero' }],
      mode: 'template',
      recipient: [
        {
          targeting: 'N',
          type: 'manual',
          unsubscribeAuthNo: 'RECIPIENT-AUTH',
          unsubscribeNo: '080-999-0000',
          value: '010-1234-5678',
        },
      ],
      templateCode: 'BRAND_TEMPLATE',
      templateParameter: { customerName: '민지' },
      videoParameter: { videoUrl: 'https://tv.kakao.com/v/5555' },
    }));

    expect(payload).toEqual({
      fallback: { enabled: false },
      mode: 'template',
      pushAlarm: true,
      recipients: [
        {
          imageParameters: [{ imageUrl: 'https://cdn.example.com/template.png', name: 'hero' }],
          recipientNo: '01012345678',
          targeting: 'N',
          templateParameter: { customerName: '민지' },
          unsubscribeAuthNo: 'RECIPIENT-AUTH',
          unsubscribeNo: '080-999-0000',
          videoParameter: { videoUrl: 'https://tv.kakao.com/v/5555' },
        },
      ],
      senderResourceId: 'kakao_resource_1',
      templateCode: 'BRAND_TEMPLATE',
    });
    expectNoLegacyBrandFields(payload);
  });

  it('sends a Brand Message started from a template through the freestyle payload branch', () => {
    const { draft } = createBrandMessageDraftFromTemplate({
      buttons: [{ linkMo: 'https://example.com/collection', name: '보기', type: 'WL' }],
      chatBubbleType: 'WIDE',
      content: '#{고객명}님, 신규 컬렉션을 확인해 주세요.',
      image: { imageName: 'wide.png', imageUrl: 'https://cdn.example.com/wide.png' },
      templateCode: 'BRAND_TEMPLATE_WIDE',
      templateParameter: { 고객명: '민지' },
    }, {
      ...defaultBrandMessageSendFormValue,
      ...baseBrandMessage,
    });
    const payload = stripRequestId(buildBrandMessageSendPayload(draft));

    expect(payload.mode).toBe('freestyle');
    expect(payload.content).toBe('민지님, 신규 컬렉션을 확인해 주세요.');
    expect(payload).not.toHaveProperty('templateCode');
    expect(payload.recipients[0]).not.toHaveProperty('templateParameter');
    expect(payload.recipients[0]).not.toHaveProperty('imageParameters');
    expect(payload.recipients[0]).not.toHaveProperty('videoParameter');
    expectNoLegacyBrandFields(payload);
  });

  it('validates numeric coupon templateParameter values for template brand-message payloads', () => {
    const payload = stripRequestId(buildBrandMessageSendPayload({
      ...baseBrandMessage,
      mode: 'template',
      recipient: [{ type: 'manual', value: '010-1234-5678' }],
      templateCode: 'BRAND_TEMPLATE',
      templateParameter: { 상품명: '멤버십', 할인금액: '1000', 할인율: '15' },
    }));

    expect(payload.recipients[0].templateParameter).toEqual({
      상품명: '멤버십',
      할인금액: '1000',
      할인율: '15',
    });
    expect(() => buildBrandMessageSendPayload({
      ...baseBrandMessage,
      mode: 'template',
      recipient: [{ type: 'manual', value: '010-1234-5678' }],
      templateCode: 'BRAND_TEMPLATE',
      templateParameter: { 할인율: '15%' },
    })).toThrow(MessageSendValidationError);
  });
});

function stripRequestId(payload) {
  const { clientRequestId, ...rest } = payload;

  expect(clientRequestId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );

  return rest;
}

function expectNoLegacyBrandFields(payload) {
  const serialized = JSON.stringify(payload);

  for (const term of legacyBrandTerms) {
    expect(serialized).not.toContain(term);
  }
}

function expectNoBrandTemplateRegistrationSendOnlyFields(payload) {
  const sendOnlyFields = [
    'clientRequestId',
    'fallback',
    'mode',
    'pushAlarm',
    'recipientList',
    'recipients',
    'requestDate',
    'resellerCode',
    'scheduledAt',
    'statsId',
    'targeting',
    'unsubscribeAuthNo',
    'unsubscribeNo',
  ];

  for (const field of sendOnlyFields) {
    expect(payload).not.toHaveProperty(field);
  }
}
