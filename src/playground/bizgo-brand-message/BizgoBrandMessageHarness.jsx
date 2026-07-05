import { useRef, useState, useMemo } from 'react';

export const BIZGO_BRAND_MESSAGE_PREVIEW_SHELL_CLASS = 'bg-[#ABC1D1] rounded-[20px] pt-[28px] pb-[10px] px-[16px] select-none [&_img]:pointer-events-none [&_img]:select-none max-h-[572px] overflow-y-auto min-h-[572px] max-h-[572px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export const BIZGO_BRAND_MESSAGE_SOURCE_ANCHORS = Object.freeze([
  {
    file: '../bizgo/bizgo-brand-msg/www.bizgo.io/pages/console/team/[teamSeq]/send/brand-message/index.vue',
    lines: 'onMounted initOmni + onMessage bridge',
    proves: 'Bizgo host loads omni-sdk page "brand-message-template-send" and handles send/template/image/address events.',
  },
  {
    file: '../bizgo/bizgo-brand-msg/www.bizgo.io/types/domain/kakao.ts',
    lines: 'BrandMessageType enum + brandMessageTypeList',
    proves: 'Bizgo public message type codes are FT, FI, FW, FL, FC, FP, FM, FA.',
  },
  {
    file: '../bizgo/bizgo-brand-msg/cdn.bizgo.io/omni-front-sdk/prod/chunks/brandMessageTemplate.js',
    lines: '959-1200, 16531-17544',
    proves: 'SDK preview wrapper, type configs, mockup renderers, payload builders, and type-code normalization.',
  },
]);

export const BIZGO_BRAND_MESSAGE_TYPE_CODE_TO_INTERNAL = Object.freeze({
  FT: 'TEXT',
  FI: 'IMAGE',
  FW: 'WIDE',
  FL: 'WIDE_ITEM_LIST',
  FC: 'CAROUSEL_FEED',
  FP: 'PREMIUM_VIDEO',
  FM: 'COMMERCE',
  FA: 'CAROUSEL_COMMERCE',
});

export const BIZGO_BRAND_MESSAGE_TYPES = Object.freeze([
  { code: 'FT', field: 'text', internalType: 'TEXT', label: '텍스트' },
  { code: 'FI', field: 'image', internalType: 'IMAGE', label: '이미지' },
  { code: 'FW', field: 'wideImage', internalType: 'WIDE', label: '와이드 이미지' },
  { code: 'FC', field: 'carouselFeeds', internalType: 'CAROUSEL_FEED', label: '캐러셀 피드' },
  { code: 'FP', field: 'video', internalType: 'PREMIUM_VIDEO', label: '프리미엄 동영상' },
  { code: 'FL', field: 'wideList', internalType: 'WIDE_ITEM_LIST', label: '와이드 리스트' },
  { code: 'FM', field: 'commerce', internalType: 'COMMERCE', label: '커머스' },
  { code: 'FA', field: 'carouselCommerce', internalType: 'CAROUSEL_COMMERCE', label: '캐러셀 커머스' },
]);

export const BIZGO_BRAND_MESSAGE_TYPE_CONFIG = Object.freeze({
  TEXT: {
    buttonMaxLength: 5,
    buttonMaxTextLength: 14,
    buttonMinLength: 0,
    contentMaxLength: 1300,
    contentMaxLineBreak: 99,
    couponContentMaxLength: 12,
    mockup: { buttonType: 'vertical', image: null, isCarousel: false, isHeader: false },
  },
  IMAGE: {
    buttonMaxLength: 5,
    buttonMaxTextLength: 14,
    buttonMinLength: 0,
    contentMaxLength: 400,
    contentMaxLineBreak: 29,
    couponContentMaxLength: 12,
    mockup: { buttonType: 'vertical', image: { width: 200, height: 100 }, isCarousel: false, isHeader: false },
  },
  WIDE: {
    buttonMaxLength: 2,
    buttonMaxTextLength: 8,
    buttonMinLength: 0,
    contentMaxLength: 76,
    contentMaxLineBreak: 1,
    couponContentMaxLength: 18,
    mockup: { buttonType: 'horizontal', image: { width: 230, height: 100 }, isCarousel: false, isHeader: false },
  },
  CAROUSEL_FEED: {
    buttonMaxLength: 2,
    buttonMaxTextLength: 8,
    buttonMinLength: 1,
    contentMaxLength: 180,
    contentMaxLineBreak: 2,
    couponContentMaxLength: 12,
    maxFeed: 6,
    minFeed: 2,
    mockup: { buttonType: 'horizontal', image: { width: 200, height: 100 }, isCarousel: true, isHeader: true },
  },
  PREMIUM_VIDEO: {
    buttonMaxLength: 1,
    buttonMaxTextLength: 8,
    buttonMinLength: 0,
    contentMaxLength: 76,
    contentMaxLineBreak: 1,
    couponContentMaxLength: 18,
    mockup: { buttonType: 'horizontal', image: { width: 200, height: 100 }, isCarousel: false, isHeader: true, isVideo: true },
  },
  WIDE_ITEM_LIST: {
    buttonMaxLength: 2,
    buttonMaxTextLength: 8,
    buttonMinLength: 0,
    couponContentMaxLength: 18,
    maxImage: 4,
    minImage: 3,
    mockup: { buttonType: 'horizontal', image: { width: 230, height: 88 }, isCarousel: false, isHeader: true },
  },
  COMMERCE: {
    buttonMaxLength: 2,
    buttonMaxTextLength: 8,
    buttonMinLength: 1,
    contentMaxLength: 34,
    contentMaxLineBreak: 1,
    couponContentMaxLength: 12,
    mockup: { buttonType: 'horizontal', image: { width: 200, height: 267 }, isCarousel: false, isCommerce: true, isHeader: true },
  },
  CAROUSEL_COMMERCE: {
    buttonMaxLength: 2,
    buttonMaxTextLength: 8,
    buttonMinLength: 1,
    contentMaxLength: 34,
    contentMaxLineBreak: 1,
    couponContentMaxLength: 12,
    maxCarousel: 6,
    minCarousel: 2,
    mockup: { buttonType: 'horizontal', image: { width: 200, height: 267 }, isCarousel: true, isCommerce: true, isHeader: true },
  },
});

export const BIZGO_BRAND_MESSAGE_HOST_EVENTS = Object.freeze([
  'sendPageTemplateCompareState',
  'abtestGA',
  'openToast',
  'navigate',
  'addImage',
  'tempBrandMessageTemplate',
  'templateSendByTemplate',
  'templateSendABTest',
  'loadAddressBook',
  'addressExcelDownload',
  'showLoadingSpinner',
  'hideLoadingSpinner',
  'confirmSelectTemplate',
  'createBrandMessageTemplate',
]);

export const BIZGO_BRAND_MESSAGE_API_ENDPOINTS = Object.freeze([
  'POST /b/kko/template/bm/image',
  'POST /b/kko/template/bm/create-temp',
  'POST /b/kko/template/bm/create',
  'GET /b/kko/template/bm/:seq',
  'GET /b/kko/template/bm/list-for-send',
  'GET /b/kko/sender-key/list',
  'GET /b/msg/callback',
  'POST /b/msg/send',
  'POST /b/msg/send-ab',
]);

const TYPE_BY_INTERNAL = Object.freeze(
  BIZGO_BRAND_MESSAGE_TYPES.reduce((map, type) => ({ ...map, [type.internalType]: type }), {})
);

const BIZGO_BRAND_MESSAGE_TYPE_OPTIONS = BIZGO_BRAND_MESSAGE_TYPES.map((type) => ({
  label: type.label,
  value: type.code,
}));

const BIZGO_BRAND_BUTTON_TYPE_OPTIONS = Object.freeze([
  { label: '웹 링크', value: 'WL' },
  { label: '앱 링크', value: 'AL' },
  { label: '비즈니스폼', value: 'BF' },
  { label: '채널 추가', value: 'AC' },
]);

const SAMPLE_TONES = Object.freeze({
  blue: ['#D6E2F0', '#5E7EA3'],
  commerce: ['#EFE1D1', '#9E6F45'],
  gray: ['#E5E7EB', '#6B7280'],
  rose: ['#EAD7DD', '#9E5265'],
  sage: ['#DCE7D7', '#6E8E67'],
});

export const bizgoBrandMessageControls = Object.freeze([
  { id: 'messageType', label: '타입', type: 'select', options: BIZGO_BRAND_MESSAGE_TYPE_OPTIONS, defaultValue: 'FT' },
  { id: 'channelName', label: '채널', type: 'text', defaultValue: '@bizgo_store' },
  { id: 'templateName', label: '템플릿명', type: 'text', defaultValue: '여름 기획전 안내' },
  { id: 'content', label: '본문', type: 'textarea', defaultValue: '#{고객명}님, 지금 #{브랜드명} 혜택을 확인해 보세요.' },
  { id: 'header', label: '헤더/상품명', type: 'text', defaultValue: '브랜드 단독 혜택' },
  { id: 'imageScenario', label: '이미지', type: 'select', options: ['sage', 'blue', 'rose', 'commerce', 'none'], defaultValue: 'sage' },
  { id: 'imageRatio', label: '이미지 비율', type: 'select', options: ['2:1', '1:1', '3:4'], defaultValue: '2:1' },
  { id: 'itemCount', label: '아이템 수', type: 'select', options: ['1', '2', '3', '4', '5', '6'], defaultValue: '3' },
  { id: 'useButtons', label: '버튼 사용', type: 'boolean', defaultValue: true },
  { id: 'buttonCount', label: '버튼 수', type: 'select', options: ['0', '1', '2', '3', '4', '5'], defaultValue: '2' },
  { id: 'buttonType', label: '버튼 타입', type: 'select', options: BIZGO_BRAND_BUTTON_TYPE_OPTIONS, defaultValue: 'WL' },
  { id: 'couponEnabled', label: '쿠폰', type: 'boolean', defaultValue: false },
  { id: 'useMoreButton', label: '더보기', type: 'boolean', defaultValue: true },
  { id: 'useIntro', label: '커머스 인트로', type: 'boolean', defaultValue: true },
  { id: 'adult', label: '성인 메시지', type: 'boolean', defaultValue: false },
  { id: 'recipientScenario', label: '수신자', type: 'select', options: ['valid', 'empty', 'duplicate', 'invalidPhone', 'missingVariable'], defaultValue: 'valid' },
  { id: 'scheduleState', label: '발송 시점', type: 'select', options: ['immediate', 'reservedValid', 'reservedInvalid'], defaultValue: 'immediate' },
  { id: 'alternativeEnabled', label: '대체 문자', type: 'boolean', defaultValue: false },
  { id: 'sendNumber', label: '대체 발신번호', type: 'text', defaultValue: '0212345678' },
  { id: 'unsubscribePhoneNumber', label: '080 번호', type: 'text', defaultValue: '0801234567' },
  { id: 'variablesJson', label: '변수 JSON', type: 'json', defaultValue: JSON.stringify({ 고객명: '김민지', 브랜드명: 'BIZGO', 할인금액: '5000', 할인율: '20' }, null, 2) },
]);

function getTypeByCode(code) {
  const internalType = BIZGO_BRAND_MESSAGE_TYPE_CODE_TO_INTERNAL[code] ?? code;
  return TYPE_BY_INTERNAL[internalType] ?? TYPE_BY_INTERNAL.TEXT;
}

function parseVariables(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function sampleImageUrl(toneName, label) {
  if (toneName === 'none') {
    return '';
  }

  const [background, foreground] = SAMPLE_TONES[toneName] ?? SAMPLE_TONES.sage;
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">',
    `<rect width="800" height="500" rx="28" fill="${background}"/>`,
    `<circle cx="628" cy="130" r="72" fill="${foreground}" opacity=".18"/>`,
    `<rect x="80" y="328" width="392" height="32" rx="16" fill="${foreground}" opacity=".28"/>`,
    `<rect x="80" y="378" width="248" height="24" rx="12" fill="${foreground}" opacity=".18"/>`,
    `<text x="80" y="132" fill="${foreground}" font-family="Arial, sans-serif" font-size="54" font-weight="700">${label}</text>`,
    '</svg>',
  ].join('');

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function countLineBreaks(value) {
  return (String(value ?? '').match(/\n/g) ?? []).length;
}

function normalizeReservedAt(scheduleState) {
  const base = new Date();
  const offsetMinutes = scheduleState === 'reservedInvalid' ? 5 : 20;
  const reserved = new Date(base.getTime() + offsetMinutes * 60 * 1000);
  const yyyy = String(reserved.getFullYear());
  const mm = String(reserved.getMonth() + 1).padStart(2, '0');
  const dd = String(reserved.getDate()).padStart(2, '0');
  const hh = String(reserved.getHours()).padStart(2, '0');
  const mi = String(reserved.getMinutes()).padStart(2, '0');
  const ss = String(reserved.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

function makeButtons(values, config) {
  const count = Number(values.buttonCount ?? 0);
  const labels = ['자세히 보기', '쿠폰 받기', '톡에서 예약하기', '상담 시작', '채널 추가'];

  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    bizFormId: values.buttonType === 'BF' ? `BIZFORM-${index + 1}` : '',
    linkAndroid: 'https://m.example.com/android',
    linkIos: 'https://m.example.com/ios',
    linkMobile: 'https://m.example.com/event',
    linkPc: 'https://example.com/event',
    linkType: values.buttonType,
    name: labels[index] ?? `버튼 ${index + 1}`,
    sourceButtonType: config.mockup.buttonType,
  }));
}

function couponButton(values) {
  return {
    description: '앱 전용 쿠폰',
    exceptionVariableTitle: '',
    isUseCouponButton: Boolean(values.couponEnabled),
    isUseVariable: false,
    linkAndroid: 'https://m.example.com/coupon',
    linkIos: 'https://m.example.com/coupon',
    linkMobile: 'https://m.example.com/coupon',
    linkPc: 'https://example.com/coupon',
    selectCouponType: 'AMOUNT',
    title: '5,000원',
    variable: '',
  };
}

function makeRecipients(values, variables) {
  const variablePayload = Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [`#{${key}}`, value])
  );

  if (values.recipientScenario === 'empty') {
    return [];
  }

  if (values.recipientScenario === 'invalidPhone') {
    return [{ receiverNumber: '010-12', variables: variablePayload }];
  }

  if (values.recipientScenario === 'duplicate') {
    return [
      { receiverNumber: '01012345678', variables: variablePayload },
      { receiverNumber: '01012345678', variables: variablePayload },
    ];
  }

  if (values.recipientScenario === 'missingVariable') {
    return [{ receiverNumber: '01012345678', variables: { '#{고객명}': '' } }];
  }

  return [
    { receiverNumber: '01012345678', variables: variablePayload },
    { receiverNumber: '01098765432', variables: variablePayload },
  ];
}

function makeList(count, factory) {
  return Array.from({ length: Math.max(0, count) }, (_, index) => factory(index));
}

export function createBizgoBrandMessageModel(values) {
  const type = getTypeByCode(values.messageType);
  const config = BIZGO_BRAND_MESSAGE_TYPE_CONFIG[type.internalType];
  const itemCount = Number(values.itemCount ?? 3);
  const variables = parseVariables(values.variablesJson);
  const content = String(values.content ?? '');
  const imageUrl = sampleImageUrl(values.imageScenario, type.label);
  const buttons = makeButtons(values, config);
  const coupon = couponButton(values);
  const isUseButton = Boolean(values.useButtons) && buttons.length > 0;
  const imageRatio = values.imageRatio === '3:4' ? 3 / 4 : values.imageRatio === '1:1' ? 1 : 2;
  const sharedMessage = { buttons, content, couponButton: coupon, imageRatio, imageUrl, isUseButton };

  const commercePrice = {
    additionalContent: content,
    discountPrice: '39000',
    discountRate: '20',
    discountType: 'rate',
    isUsePriceVariable: false,
    regularPrice: '49000',
    title: values.header,
  };

  const carouselFeedItems = makeList(itemCount, (index) => ({
    buttons,
    content: `${content}\n${index + 1}번 피드입니다.`,
    couponButton: coupon,
    header: `${values.header} ${index + 1}`,
    imageRatio,
    imageUrl: sampleImageUrl(values.imageScenario, `Feed ${index + 1}`),
  }));

  const carouselCommerceItems = makeList(itemCount, (index) => ({
    buttons,
    couponButton: coupon,
    imageRatio,
    imageUrl: sampleImageUrl(values.imageScenario, `Item ${index + 1}`),
    price: { ...commercePrice, title: `${values.header} ${index + 1}` },
  }));

  const wideListItems = makeList(itemCount, (index) => ({
    imageLink: 'https://example.com/item',
    imageUrl: sampleImageUrl(values.imageScenario, `List ${index + 1}`),
    linkAndroid: 'https://m.example.com/item',
    linkIos: 'https://m.example.com/item',
    linkMobile: 'https://m.example.com/item',
    linkPc: 'https://example.com/item',
    title: index === 0 ? values.header : `${values.header} ${index + 1}`,
  }));

  const isReserved = values.scheduleState === 'immediate' ? 'N' : 'Y';
  const reservedAt = isReserved === 'Y' ? normalizeReservedAt(values.scheduleState) : '';
  const addressList = makeRecipients(values, variables);

  return {
    adult: Boolean(values.adult),
    alternativeMessage: {
      authNumber: values.unsubscribePhoneNumber,
      enabled: Boolean(values.alternativeEnabled),
      sendNumber: values.sendNumber,
      sendNumberSeq: values.alternativeEnabled ? 'callback-preview' : '',
      text: content,
      title: values.header,
    },
    apiEndpoints: BIZGO_BRAND_MESSAGE_API_ENDPOINTS,
    chatBubbleType: type.internalType,
    channelName: values.channelName,
    commerce: {
      ...sharedMessage,
      imageLink: 'https://example.com/product',
      price: commercePrice,
    },
    config,
    field: type.field,
    hostEvents: BIZGO_BRAND_MESSAGE_HOST_EVENTS,
    image: {
      ...sharedMessage,
      imageLink: 'https://example.com/image',
    },
    isReserved,
    messageType: type.code,
    previewShellClass: BIZGO_BRAND_MESSAGE_PREVIEW_SHELL_CLASS,
    recipient: {
      addressList,
      target: 'M',
    },
    reservedAt,
    sourceAnchors: BIZGO_BRAND_MESSAGE_SOURCE_ANCHORS,
    templateName: values.templateName,
    text: {
      ...sharedMessage,
      imageUrl: '',
    },
    typeLabel: type.label,
    unsubscribePhoneNumber: values.unsubscribePhoneNumber,
    variables,
    video: {
      ...sharedMessage,
      header: values.header,
      videoLink: 'https://example.com/video.mp4',
    },
    wideImage: {
      ...sharedMessage,
      imageLink: 'https://example.com/wide',
    },
    wideList: {
      buttons,
      couponButton: coupon,
      isUseButton,
      list: wideListItems,
      mainTitle: values.header,
    },
    carouselFeeds: {
      list: carouselFeedItems,
      moreButton: {
        isMoreButton: Boolean(values.useMoreButton),
        linkMobile: 'https://m.example.com/more',
      },
      selectedFeeds: 0,
    },
    carouselCommerce: {
      intro: {
        content,
        header: values.header,
        imageRatio,
        imageUrl: sampleImageUrl(values.imageScenario, 'Intro'),
        type: 'intro',
      },
      isUseIntro: Boolean(values.useIntro),
      list: carouselCommerceItems,
      moreButton: {
        isMoreButton: Boolean(values.useMoreButton),
        linkMobile: 'https://m.example.com/more',
      },
      selectedCommerce: values.useIntro ? 0 : 1,
    },
  };
}

function getValidationParts(model) {
  if (model.chatBubbleType === 'CAROUSEL_FEED') {
    return model.carouselFeeds.list.map((item, index) => ({
      buttons: item.buttons,
      content: item.content,
      data: item,
      field: `carouselFeeds.list.${index}`,
    }));
  }

  if (model.chatBubbleType === 'CAROUSEL_COMMERCE') {
    const commerceItems = model.carouselCommerce.list.map((item, index) => ({
      buttons: item.buttons,
      content: item.price?.additionalContent ?? '',
      data: item,
      field: `carouselCommerce.list.${index}`,
    }));

    if (!model.carouselCommerce.isUseIntro) {
      return commerceItems;
    }

    return [
      {
        buttons: null,
        content: model.carouselCommerce.intro.content,
        data: model.carouselCommerce.intro,
        field: 'carouselCommerce.intro',
      },
      ...commerceItems,
    ];
  }

  if (model.chatBubbleType === 'WIDE_ITEM_LIST') {
    return [
      {
        buttons: model.wideList.buttons,
        content: '',
        data: model.wideList,
        field: 'wideList',
        skipImage: true,
      },
      ...model.wideList.list.map((item, index) => ({
        buttons: null,
        content: '',
        data: item,
        field: `wideList.list.${index}`,
      })),
    ];
  }

  const fieldData = model[model.field] ?? {};

  return [
    {
      buttons: fieldData.buttons,
      content: fieldData.content ?? model.commerce?.price?.additionalContent ?? '',
      data: fieldData,
      field: model.field,
    },
  ];
}

export function getBizgoBrandMessageValidationIssues(model) {
  const issues = [];
  const config = model.config;
  const needsImage = Boolean(config.mockup.image);
  const validationParts = getValidationParts(model);

  if (!model.channelName) {
    issues.push({ field: 'channelId', message: '채널 ID를 선택해주세요.', source: 'bm-template-channel-select' });
  }

  if (!model.templateName) {
    issues.push({ field: 'name', message: '템플릿명을 입력해주세요.', source: 'createBrandMessageTemplate' });
  }

  validationParts.forEach((part) => {
    const content = part.content ?? '';
    const buttons = part.buttons;

    if (config.contentMaxLength && content.length > config.contentMaxLength) {
      issues.push({ field: `${part.field}.content`, message: `${config.contentMaxLength}자 이내로 입력해주세요.`, source: 'contentMaxLength' });
    }

    if (config.contentMaxLineBreak !== undefined && countLineBreaks(content) > config.contentMaxLineBreak) {
      issues.push({ field: `${part.field}.content`, message: `줄바꿈은 ${config.contentMaxLineBreak}회만 가능합니다.`, source: 'contentMaxLineBreak' });
    }

    if (needsImage && !part.skipImage && !part.data.imageUrl) {
      issues.push({ field: `${part.field}.imageUrl`, message: '이미지를 등록해주세요.', source: 'imageUrl.required' });
    }

    if (Array.isArray(buttons)) {
      if (buttons.length < config.buttonMinLength) {
        issues.push({ field: `${part.field}.buttons`, message: `버튼은 최소 ${config.buttonMinLength}개 필요합니다.`, source: 'buttonMinLength' });
      }

      if (buttons.length > config.buttonMaxLength) {
        issues.push({ field: `${part.field}.buttons`, message: `버튼은 최대 ${config.buttonMaxLength}개까지 가능합니다.`, source: 'buttonMaxLength' });
      }

      buttons.forEach((button, index) => {
        if ((button.name ?? '').length > config.buttonMaxTextLength) {
          issues.push({ field: `${part.field}.buttons.${index}.name`, message: `${config.buttonMaxTextLength}자 이내로 입력해주세요.`, source: 'buttonMaxTextLength' });
        }
      });
    }

    if (part.data.couponButton?.isUseCouponButton) {
      if (!part.data.couponButton.title) {
        issues.push({ field: `${part.field}.couponButton.title`, message: '쿠폰 상세 내용을 입력해주세요.', source: 'bm-coupon-description-input' });
      }

      if (!part.data.couponButton.linkMobile) {
        issues.push({ field: `${part.field}.couponButton.linkMobile`, message: '모바일 링크를 입력해주세요.', source: 'bm-coupon-mobile-link' });
      }
    }
  });

  if (model.chatBubbleType === 'PREMIUM_VIDEO' && !model.video.videoLink) {
    issues.push({ field: 'video.videoLink', message: '동영상 URL을 등록해주세요.', source: 'bm-video-link-input' });
  }

  if (model.chatBubbleType === 'CAROUSEL_FEED') {
    const count = model.carouselFeeds.list.length;
    if (count < config.minFeed || count > config.maxFeed) {
      issues.push({ field: 'carouselFeeds.list', message: `캐러셀 피드는 ${config.minFeed}-${config.maxFeed}개여야 합니다.`, source: 'minFeed/maxFeed' });
    }
  }

  if (model.chatBubbleType === 'CAROUSEL_COMMERCE') {
    const count = model.carouselCommerce.list.length;
    if (count < config.minCarousel || count > config.maxCarousel) {
      issues.push({ field: 'carouselCommerce.list', message: `캐러셀 커머스는 ${config.minCarousel}-${config.maxCarousel}개여야 합니다.`, source: 'minCarousel/maxCarousel' });
    }
  }

  if (model.chatBubbleType === 'WIDE_ITEM_LIST') {
    const count = model.wideList.list.length;
    if (count < config.minImage || count > config.maxImage) {
      issues.push({ field: 'wideList.list', message: `와이드 리스트 이미지는 ${config.minImage}-${config.maxImage}개여야 합니다.`, source: 'minImage/maxImage' });
    }
  }

  if (model.recipient.addressList.length === 0) {
    issues.push({ field: 'addressList', message: '번호 없음', source: 'send-recipient-grid' });
  }

  const seen = new Set();
  model.recipient.addressList.forEach((recipient, index) => {
    if (!/^01[016789]\d{7,8}$/.test(recipient.receiverNumber)) {
      issues.push({ field: `addressList.${index}.receiverNumber`, message: '번호 오류', source: 'recipient.phone' });
    }

    if (seen.has(recipient.receiverNumber)) {
      issues.push({ field: `addressList.${index}.receiverNumber`, message: '중복 번호', source: 'recipient.duplicate' });
    }
    seen.add(recipient.receiverNumber);

    if (Object.values(recipient.variables ?? {}).some((value) => String(value ?? '').trim() === '')) {
      issues.push({ field: `addressList.${index}.variables`, message: '변수 없음', source: 'recipient.variables' });
    }
  });

  if (model.isReserved === 'Y') {
    const yyyy = model.reservedAt.slice(0, 4);
    const mm = Number(model.reservedAt.slice(4, 6)) - 1;
    const dd = model.reservedAt.slice(6, 8);
    const hh = model.reservedAt.slice(8, 10);
    const mi = model.reservedAt.slice(10, 12);
    const ss = model.reservedAt.slice(12, 14);
    const reservedDate = new Date(Number(yyyy), mm, Number(dd), Number(hh), Number(mi), Number(ss));
    if (reservedDate.getTime() < Date.now() + 10 * 60 * 1000) {
      issues.push({
        field: 'reservedAt',
        message: '예약시간은 현재시간 +10분 이후부터 가능합니다.',
        source: 'send-reservation-dialog',
      });
    }
  }

  if (model.alternativeMessage.enabled && !/^0\d{1,2}\d{7,8}$/.test(model.alternativeMessage.sendNumber)) {
    issues.push({ field: 'alternativeMessage.sendNumber', message: '올바른 발신번호 형식이 아닙니다.', source: 'alimtalk-send-alt-sendnumber-select' });
  }

  return issues;
}

export function getBizgoBrandMessagePlaygroundProps(values) {
  const model = createBizgoBrandMessageModel(values);
  const validationIssues = getBizgoBrandMessageValidationIssues(model);

  return {
    model,
    validationIssues,
    validationState: validationIssues.length === 0 ? 'valid' : 'invalid',
  };
}

function MessageContent({ content }) {
  return (
    <div className="bizgo-bm-message-copy">
      {content ? (
        <p>{content}</p>
      ) : (
        <p className="is-placeholder">메시지 내용을 입력해주세요.</p>
      )}
    </div>
  );
}

function ChannelHeader({ channelName }) {
  return (
    <div className="bizgo-bm-channel">
      <div className="bizgo-bm-avatar">B</div>
      <p>{channelName || '채널 ID를 선택해주세요.'}</p>
    </div>
  );
}

function ImageBox({ imageRatio, imageUrl, isVideo = false, label = 'image' }) {
  return (
    <div className="bizgo-bm-image" data-ratio={imageRatio} data-video={isVideo ? 'true' : 'false'}>
      {imageUrl ? <img alt={label} src={imageUrl} /> : <span className="bizgo-bm-image-empty">이미지를 등록해주세요</span>}
      {isVideo ? <span className="bizgo-bm-play" aria-hidden="true" /> : null}
    </div>
  );
}

function Buttons({ buttons = [], buttonType = 'vertical', isUseButton }) {
  if (!isUseButton || buttons.length === 0) {
    return null;
  }

  return (
    <div className="bizgo-bm-buttons" data-layout={buttonType}>
      {buttons.map((button, index) => (
        <div className="bizgo-bm-button" data-link-type={button.linkType} key={`${button.name}-${index}`}>
          {button.name}
        </div>
      ))}
    </div>
  );
}

function Coupon({ couponButton }) {
  if (!couponButton?.isUseCouponButton) {
    return null;
  }

  return (
    <div className="bizgo-bm-coupon">
      <div>
        <p>{couponButton.title || '쿠폰 상세 내용을 입력해주세요'}</p>
        <span>{couponButton.description || '쿠폰 설명'}</span>
      </div>
      <div className="bizgo-bm-coupon-mark">
        <strong>%</strong>
        <span>coupon</span>
      </div>
    </div>
  );
}

function Unsubscribe({ model }) {
  return (
    <div className="bizgo-bm-unsubscribe">
      <p>
        {model.unsubscribePhoneNumber ? `무료수신거부 ${model.unsubscribePhoneNumber}` : ''}
        <br />
        {model.alternativeMessage?.authNumber ? `인증번호 ${model.alternativeMessage.authNumber}` : ''}
      </p>
    </div>
  );
}

function Bubble({ children, width }) {
  return (
    <div className="bizgo-bm-bubble-wrap" style={{ width: width ?? '100%' }}>
      <div className="bizgo-bm-bubble">{children}</div>
    </div>
  );
}

function StandardPreview({ model }) {
  const config = model.config;
  const data = model[model.field];
  const width = config.mockup.image?.width;

  return (
    <>
      <ChannelHeader channelName={model.channelName} />
      <Bubble width={width}>
        {config.mockup.image ? (
          <ImageBox
            imageRatio={data.imageRatio}
            imageUrl={data.imageUrl}
            isVideo={model.chatBubbleType === 'PREMIUM_VIDEO'}
            label={model.typeLabel}
          />
        ) : null}
        {model.chatBubbleType === 'PREMIUM_VIDEO' ? <p className="bizgo-bm-title">{model.video.header}</p> : null}
        {model.chatBubbleType === 'COMMERCE' ? (
          <CommercePrice price={model.commerce.price} />
        ) : (
          <MessageContent content={data.content} />
        )}
        <Buttons buttons={data.buttons} buttonType={config.mockup.buttonType} isUseButton={data.isUseButton} />
        <Coupon couponButton={data.couponButton} />
      </Bubble>
      <Unsubscribe model={model} />
    </>
  );
}

function WideListPreview({ model }) {
  const config = model.config;
  const main = model.wideList.list[0] ?? {};
  const rest = model.wideList.list.slice(1);

  return (
    <>
      <ChannelHeader channelName={model.channelName} />
      <Bubble width={config.mockup.image.width}>
        <p className="bizgo-bm-wide-title">{model.wideList.mainTitle}</p>
        <div className="bizgo-bm-wide-main">
          <ImageBox imageRatio={2} imageUrl={main.imageUrl} label={main.title} />
          <p>{main.title || '제목을 입력해주세요'}</p>
        </div>
        <div className="bizgo-bm-wide-list">
          {rest.map((item, index) => (
            <div className="bizgo-bm-wide-item" key={`${item.title}-${index}`}>
              <ImageBox imageRatio={1} imageUrl={item.imageUrl} label={item.title} />
              <p>{item.title || '제목을 입력해주세요'}</p>
            </div>
          ))}
        </div>
        <Buttons buttons={model.wideList.buttons} buttonType={config.mockup.buttonType} isUseButton={model.wideList.isUseButton} />
        <Coupon couponButton={model.wideList.couponButton} />
      </Bubble>
      <Unsubscribe model={model} />
    </>
  );
}

function CommercePrice({ price }) {
  const discount = price.discountType === 'rate' ? `${price.discountRate}%` : `${Number(price.discountPrice || 0).toLocaleString()}원`;

  return (
    <div className="bizgo-bm-price">
      <p>{price.title || '상품명을 입력해주세요.'}</p>
      <div>
        <strong>{discount}</strong>
        <span>{Number(price.regularPrice || 0).toLocaleString()}원</span>
      </div>
      <small>{price.additionalContent || '부가정보를 입력해주세요'}</small>
    </div>
  );
}

function BizgoDragCarousel({ children }) {
  const carouselRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const getSlides = (carousel) => [...carousel.querySelectorAll('.bizgo-bm-carousel-card, .bizgo-bm-more')];

  const getSlideLeft = (carousel, slide) => {
    const carouselRect = carousel.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    return slideRect.left - carouselRect.left + carousel.scrollLeft;
  };

  const getSelectedSlideIndex = (carousel) => {
    const slides = getSlides(carousel);
    if (slides.length === 0) return 0;

    const viewportCenter = carousel.scrollLeft + carousel.clientWidth / 2;
    return slides.reduce((selected, slide, index) => {
      const selectedSlide = slides[selected];
      const selectedDistance = Math.abs(getSlideLeft(carousel, selectedSlide) + selectedSlide.offsetWidth / 2 - viewportCenter);
      const slideDistance = Math.abs(getSlideLeft(carousel, slide) + slide.offsetWidth / 2 - viewportCenter);
      return slideDistance < selectedDistance ? index : selected;
    }, 0);
  };

  const scrollToSlide = (carousel, index, behavior = 'smooth') => {
    const slides = getSlides(carousel);
    if (slides.length === 0) return;

    const targetIndex = Math.max(0, Math.min(slides.length - 1, index));
    const targetSlide = slides[targetIndex];
    const targetLeft = getSlideLeft(carousel, targetSlide) + targetSlide.offsetWidth / 2 - carousel.clientWidth / 2;
    const maxLeft = carousel.scrollWidth - carousel.clientWidth;
    carousel.scrollTo({ left: Math.max(0, Math.min(maxLeft, targetLeft)), behavior });
  };

  const snapByDragDirection = (carousel, dragState, endX) => {
    const deltaX = endX - dragState.startX;
    const threshold = Math.min(80, Math.max(32, carousel.clientWidth * 0.16));
    const direction = Math.abs(deltaX) < threshold ? 0 : deltaX < 0 ? 1 : -1;

    scrollToSlide(carousel, dragState.startIndex + direction);
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0 || event.isPrimary === false) return;

    const carousel = event.currentTarget;
    dragRef.current = {
      pointerId: event.pointerId,
      startScrollLeft: carousel.scrollLeft,
      startX: event.clientX,
      startIndex: getSelectedSlideIndex(carousel),
      moved: false,
    };
    carousel.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (event) => {
    const dragState = dragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    if (Math.abs(deltaX) > 3) {
      dragState.moved = true;
      suppressClickRef.current = true;
      event.preventDefault();
    }

    event.currentTarget.scrollLeft = dragState.startScrollLeft - deltaX;
  };

  const finishPointerDrag = (event) => {
    const dragState = dragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRef.current = null;
    setIsDragging(false);
    snapByDragDirection(event.currentTarget, dragState, event.clientX);
  };

  const handleClickCapture = (event) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleKeyDown = (event) => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      scrollToSlide(carousel, getSelectedSlideIndex(carousel) + direction);
    }
  };

  return (
    <div
      aria-roledescription="carousel"
      className={`bizgo-bm-carousel${isDragging ? ' is-dragging' : ''}`}
      onClickCapture={handleClickCapture}
      onDragStart={(event) => event.preventDefault()}
      onKeyDown={handleKeyDown}
      onPointerCancel={finishPointerDrag}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerDrag}
      ref={carouselRef}
      role="region"
      tabIndex={0}
    >
      {children}
    </div>
  );
}

function CarouselFeedPreview({ model }) {
  return (
    <>
      <ChannelHeader channelName={model.channelName} />
      <BizgoDragCarousel>
        {model.carouselFeeds.list.map((item, index) => (
          <div className="bizgo-bm-carousel-card" key={`${item.header}-${index}`}>
            <ImageBox imageRatio={item.imageRatio} imageUrl={item.imageUrl} label={item.header} />
            <div className="bizgo-bm-carousel-copy">
              <p className="bizgo-bm-title">{item.header}</p>
              <MessageContent content={item.content} />
              <Buttons buttons={item.buttons} buttonType={model.config.mockup.buttonType} isUseButton />
              <Coupon couponButton={item.couponButton} />
            </div>
          </div>
        ))}
        {model.carouselFeeds.moreButton.isMoreButton ? <MoreCard /> : null}
      </BizgoDragCarousel>
      <div className="bizgo-bm-carousel-unsubscribe is-feed">
        <Unsubscribe model={model} />
      </div>
    </>
  );
}

function CarouselCommercePreview({ model }) {
  const items = model.carouselCommerce.isUseIntro
    ? [model.carouselCommerce.intro, ...model.carouselCommerce.list]
    : model.carouselCommerce.list;

  return (
    <>
      <ChannelHeader channelName={model.channelName} />
      <BizgoDragCarousel>
        {items.map((item, index) => {
          const isIntro = item.type === 'intro';
          return (
            <div className="bizgo-bm-carousel-card is-commerce" key={`${item.header ?? item.price?.title}-${index}`}>
              <ImageBox imageRatio={item.imageRatio} imageUrl={item.imageUrl} label={isIntro ? item.header : item.price?.title} />
              <div className="bizgo-bm-carousel-copy">
                {isIntro ? (
                  <>
                    <p className="bizgo-bm-title">{item.header || '제목을 입력해주세요'}</p>
                    <MessageContent content={item.content} />
                  </>
                ) : (
                  <>
                    <CommercePrice price={item.price} />
                    <Buttons buttons={item.buttons} buttonType={model.config.mockup.buttonType} isUseButton />
                    <Coupon couponButton={item.couponButton} />
                  </>
                )}
              </div>
            </div>
          );
        })}
        {model.carouselCommerce.moreButton.isMoreButton ? <MoreCard /> : null}
      </BizgoDragCarousel>
      <div className="bizgo-bm-carousel-unsubscribe is-commerce">
        <Unsubscribe model={model} />
      </div>
    </>
  );
}

function MoreCard() {
  return (
    <div className="bizgo-bm-more-slide">
      <div className="bizgo-bm-more">
        <svg
          aria-hidden="true"
          className="bizgo-bm-more-icon"
          fill="none"
          height="48"
          viewBox="0 0 49 48"
          width="49"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0.5 24C0.5 10.7452 11.2452 0 24.5 0C37.7548 0 48.5 10.7452 48.5 24C48.5 37.2548 37.7548 48 24.5 48C11.2452 48 0.5 37.2548 0.5 24Z"
            fill="#D1D5DB"
          />
          <path
            d="M33.8092 22.8569L25.6426 14.6902C24.9892 14.0369 24.0092 14.0369 23.3559 14.6902C22.7026 15.3435 22.7026 16.3235 23.3559 16.9769L28.7459 22.3669H16.3326C15.3526 22.3669 14.6992 23.0202 14.6992 24.0002C14.6992 24.9802 15.3526 25.6335 16.3326 25.6335H28.7459L23.3559 31.0235C22.7026 31.6769 22.7026 32.6569 23.3559 33.3102C24.0092 33.9635 24.9892 33.9635 25.6426 33.3102L33.8092 25.1435C34.4626 24.6535 34.4626 23.5102 33.8092 22.8569Z"
            fill="white"
          />
        </svg>
        <p>더보기</p>
      </div>
    </div>
  );
}

export function BizgoBrandMessagePreview({ model }) {
  return (
    <div
      className={`${BIZGO_BRAND_MESSAGE_PREVIEW_SHELL_CLASS} bizgo-bm-preview-shell`}
      data-source="omni-front-sdk/prod/chunks/brandMessageTemplate.js:17157"
    >
      {model.chatBubbleType === 'CAROUSEL_FEED' ? <CarouselFeedPreview model={model} /> : null}
      {model.chatBubbleType === 'CAROUSEL_COMMERCE' ? <CarouselCommercePreview model={model} /> : null}
      {model.chatBubbleType === 'WIDE_ITEM_LIST' ? <WideListPreview model={model} /> : null}
      {['TEXT', 'IMAGE', 'WIDE', 'PREMIUM_VIDEO', 'COMMERCE'].includes(model.chatBubbleType) ? (
        <StandardPreview model={model} />
      ) : null}
    </div>
  );
}

function ConstraintGrid({ model, validationIssues }) {
  const config = model.config;

  return (
    <div className="bizgo-bm-constraint-grid">
      <div>
        <span>본문</span>
        <strong>{config.contentMaxLength ? `${config.contentMaxLength}자 / 줄바꿈 ${config.contentMaxLineBreak}회` : '본문 없음'}</strong>
      </div>
      <div>
        <span>버튼</span>
        <strong>{`${config.buttonMinLength}-${config.buttonMaxLength}개 / ${config.buttonMaxTextLength}자`}</strong>
      </div>
      <div>
        <span>이미지</span>
        <strong>{config.mockup.image ? `${config.mockup.image.width}x${config.mockup.image.height} mockup` : '사용 안함'}</strong>
      </div>
      <div>
        <span>검증</span>
        <strong>{validationIssues.length === 0 ? '통과' : `${validationIssues.length}건`}</strong>
      </div>
    </div>
  );
}

export function BizgoBrandMessagePreviewPlayground(values) {
  const props = useMemo(() => getBizgoBrandMessagePlaygroundProps(values), [values]);

  return (
    <div className="bizgo-bm-workbench">
      <div className="bizgo-bm-phone-column">
        <BizgoBrandMessagePreview model={props.model} />
      </div>
      <div className="bizgo-bm-side">
        <p className="bizgo-bm-kicker">Bizgo SDK preview</p>
        <h3>{props.model.typeLabel}</h3>
        <ConstraintGrid model={props.model} validationIssues={props.validationIssues} />
        <ValidationList issues={props.validationIssues} />
      </div>
    </div>
  );
}

function ValidationList({ issues }) {
  if (issues.length === 0) {
    return <p className="bizgo-bm-validation is-valid">Bizgo SDK 제약 기준 통과</p>;
  }

  return (
    <div className="bizgo-bm-validation-list">
      {issues.map((issue) => (
        <div className="bizgo-bm-validation" key={`${issue.field}-${issue.message}`}>
          <strong>{issue.field}</strong>
          <span>{issue.message}</span>
          <code>{issue.source}</code>
        </div>
      ))}
    </div>
  );
}

function buildTemplatePayload(model) {
  const typePayload = {
    adult: model.adult,
    channelId: model.channelName,
    chatBubbleType: model.chatBubbleType,
    name: model.templateName,
    senderKeyType: 'S',
  };

  const field = model[model.field];
  if (model.chatBubbleType === 'WIDE_ITEM_LIST') {
    return { ...typePayload, header: model.wideList.mainTitle, items: model.wideList.list };
  }

  if (model.chatBubbleType === 'CAROUSEL_FEED') {
    return { ...typePayload, carousel: { list: model.carouselFeeds.list, tail: model.carouselFeeds.moreButton } };
  }

  if (model.chatBubbleType === 'CAROUSEL_COMMERCE') {
    return { ...typePayload, carousel: { head: model.carouselCommerce.intro, list: model.carouselCommerce.list, tail: model.carouselCommerce.moreButton } };
  }

  if (model.chatBubbleType === 'COMMERCE') {
    return { ...typePayload, commerce: model.commerce.price, imageUrl: model.commerce.imageUrl };
  }

  return { ...typePayload, ...field };
}

function buildSendPayload(model, isTest = false) {
  return {
    addressList: model.recipient.addressList,
    callback: model.alternativeMessage.enabled ? model.alternativeMessage.sendNumber : undefined,
    data: buildTemplatePayload(model),
    isTest,
    reserved: model.isReserved === 'Y' || undefined,
    reservedAt: model.reservedAt || undefined,
    target: model.recipient.target,
  };
}

export function BizgoBrandMessageSendFormPlayground(values) {
  const props = useMemo(() => getBizgoBrandMessagePlaygroundProps(values), [values]);
  const templatePayload = useMemo(() => buildTemplatePayload(props.model), [props.model]);
  const sendPayload = useMemo(() => buildSendPayload(props.model), [props.model]);
  const disabled = props.validationIssues.length > 0;

  return (
    <div className="bizgo-bm-send-harness">
      <section className="bizgo-bm-send-main">
        <div className="bizgo-bm-form-header">
          <div>
            <p className="bizgo-bm-kicker">brand-message-template-send</p>
            <h3>{props.model.templateName || '템플릿명을 입력해주세요'}</h3>
          </div>
          <span data-state={disabled ? 'invalid' : 'valid'}>{disabled ? '검증 필요' : '발송 가능'}</span>
        </div>

        <div className="bizgo-bm-send-steps">
          <FieldRow label="채널" testId="bm-send-channel-select" value={props.model.channelName} />
          <FieldRow label="템플릿" testId="bm-send-template-select-btn" value={props.model.typeLabel} />
          <FieldRow label="수신자" testId="send-recipient-grid" value={`${props.model.recipient.addressList.length}명`} />
          <FieldRow label="발송 시점" testId="send-schedule-section" value={props.model.isReserved === 'Y' ? `예약 ${props.model.reservedAt}` : '즉시 발송'} />
          <FieldRow label="대체 문자" testId="alimtalk-send-alt-toggle" value={props.model.alternativeMessage.enabled ? props.model.alternativeMessage.sendNumber : '사용 안함'} />
        </div>

        <div className="bizgo-bm-actions">
          <button data-testid="bm-template-temp-save-btn" type="button">임시저장</button>
          <button data-testid="bm-template-submit-btn" disabled={disabled} type="button">템플릿 등록</button>
          <button data-testid="bm-send-test-btn" disabled={disabled} type="button">테스트 발송</button>
          <button data-testid="bm-send-btn" disabled={disabled} type="button">발송</button>
        </div>

        <ValidationList issues={props.validationIssues} />
      </section>

      <section className="bizgo-bm-send-payloads">
        <PayloadBlock title="createBrandMessageTemplate" value={templatePayload} />
        <PayloadBlock title="templateSendByTemplate" value={sendPayload} />
        <PayloadBlock title="Host events" value={props.model.hostEvents} />
      </section>
    </div>
  );
}

function FieldRow({ label, testId, value }) {
  return (
    <div className="bizgo-bm-field-row" data-testid={testId}>
      <span>{label}</span>
      <strong>{value || '-'}</strong>
      <code>{testId}</code>
    </div>
  );
}

function PayloadBlock({ title, value }) {
  return (
    <div className="bizgo-bm-payload">
      <p>{title}</p>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}
