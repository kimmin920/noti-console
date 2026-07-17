'use client';

import { ChevronDown, ChevronLeft, Copy, GripVertical, ImagePlus, Pencil, Plus, Send, Ticket, Trash2, X } from 'lucide-react';
import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Sortable from 'sortablejs';
import {
  defaultEmailSendFormSchedules,
  defaultEmailSendFormSegments,
  EmailSendFormCanvas,
  EmailSendFormDisclosure,
  EmailSendFormEmptyState,
  EmailSendFormGhostButton,
  EmailSendFormInput,
  EmailSendFormLabel,
  EmailSendFormRoot,
  EmailSendFormRow,
  EmailSendFormScheduleField,
  EmailSendFormSelect,
  EmailSendFormSelection,
  EmailSendFormTemplateButton,
  EmailSendFormTemplateDialog,
  EmailSendFormTextarea,
} from './EmailSendForm.jsx';
import {
  getMessageTemplateVariableToken,
  getMessageTemplateVariableValue,
  getInitialTemplateVariables,
  getTemplateVariableDetails,
  MessageTemplateDocument,
  MessageTemplateVariablePanel,
} from './MessageTemplateVariables.jsx';
import { ImageCropDialog } from './ImageCropDialog.jsx';
import { RecipientSelect } from './RecipientSelect.jsx';
import {
  defaultSmsFallbackSenderNumbers,
  SmsFallbackSelect,
} from './SmsFallbackSelect.jsx';
import { Tooltip } from './Tooltip.jsx';
import {
  BrandMessageTemplateDialogCard,
  getBrandTemplateDialogItems,
} from './MessageTemplateDialogAdapters.jsx';
import {
  ActionMenu,
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuTrigger,
} from './ActionMenu.jsx';

export const defaultBrandMessageSenderProfiles = [
  {
    label: '@acme 브랜드',
    plusFriendId: '@acme',
    senderProfileType: '브랜드 채널',
    value: 'brand-profile-acme',
  },
  {
    label: '@acme_style 쇼핑',
    plusFriendId: '@acme_style',
    senderProfileType: '브랜드 채널',
    value: 'brand-profile-style',
  },
];

export const defaultBrandMessageTemplates = [
  {
    carouselItems: [
      {
        buttons: [{ name: '컬렉션 보기', ordering: 1, type: 'WL' }],
        description: '가볍게 걸치는 데일리 셋업',
        imageTone: 'sage',
        title: '봄 셋업',
      },
      {
        buttons: [{ name: '컬렉션 보기', ordering: 1, type: 'WL' }],
        description: '주말 외출을 위한 와이드 팬츠',
        imageTone: 'blue',
        title: '와이드 팬츠',
      },
      {
        buttons: [{ name: '컬렉션 보기', ordering: 1, type: 'WL' }],
        description: '이번 주 베스트 컬러만 모았습니다',
        imageTone: 'rose',
        title: '컬러 니트',
      },
    ],
    chatBubbleType: 'CAROUSEL_FEED',
    content: '#{고객명}님, 이번 주 #{브랜드명} 추천 상품을 확인해 보세요.',
    label: '시즌 추천 캐러셀 · CAROUSEL_FEED',
    senderProfileId: 'brand-profile-acme',
    templateName: '시즌 추천 캐러셀',
    value: 'brand-template-carousel-feed',
    variables: [
      { fallbackValue: '고객', key: '고객명', type: 'string' },
      { fallbackValue: 'ACME', key: '브랜드명', type: 'string' },
    ],
  },
  {
    buttons: [{ name: '자세히 보기', ordering: 1, type: 'WL' }],
    chatBubbleType: 'WIDE',
    content: '#{고객명}님, 신규 컬렉션이 공개되었습니다.\n#{혜택명} 혜택을 확인해 보세요.',
    imageTone: 'blue',
    label: '신규 컬렉션 와이드 · WIDE',
    senderProfileId: 'brand-profile-acme',
    templateName: '신규 컬렉션 와이드',
    value: 'brand-template-wide',
    variables: [
      { fallbackValue: '고객', key: '고객명', type: 'string' },
      { fallbackValue: '이번 주 한정', key: '혜택명', type: 'string' },
    ],
  },
  {
    buttons: [{ name: '구매하기', ordering: 1, type: 'WL' }],
    chatBubbleType: 'COMMERCE',
    commerce: {
      discountPrice: '39,000원',
      imageTone: 'sand',
      price: '59,000원',
      title: '브랜드 시그니처 백',
    },
    content: '#{고객명}님, 오늘만 적용되는 #{할인율} 브랜드 특가입니다.',
    label: '브랜드 특가 · COMMERCE',
    senderProfileId: 'brand-profile-style',
    templateName: '브랜드 특가',
    value: 'brand-template-commerce',
    variables: [
      { fallbackValue: '고객', key: '고객명', type: 'string' },
      { fallbackValue: '30%', key: '할인율', type: 'string' },
    ],
  },
  {
    buttons: [{ name: '전체 보기', ordering: 1, type: 'WL' }],
    chatBubbleType: 'WIDE_ITEM_LIST',
    content: '#{고객명}님을 위해 이번 주 새로 들어온 #{브랜드명} 소식을 모았습니다.',
    items: [
      { description: '가볍게 입는 바람막이', imageTone: 'sage', title: '아우터' },
      { description: '재입고된 인기 컬러', imageTone: 'rose', title: '니트' },
      { description: '출근용 데일리 백', imageTone: 'sand', title: '가방' },
    ],
    label: '주간 신상품 리스트 · WIDE_ITEM_LIST',
    senderProfileId: 'brand-profile-acme',
    templateName: '주간 신상품 리스트',
    value: 'brand-template-wide-item-list',
    variables: [
      { fallbackValue: '고객', key: '고객명', type: 'string' },
      { fallbackValue: 'ACME', key: '브랜드명', type: 'string' },
    ],
  },
  {
    carouselItems: [
      {
        buttons: [{ name: '기획전 보기', ordering: 1, type: 'WL' }],
        discountPrice: '39,000원',
        imageTone: 'sand',
        price: '59,000원',
        title: '시그니처 백',
      },
      {
        buttons: [{ name: '기획전 보기', ordering: 1, type: 'WL' }],
        discountPrice: '29,000원',
        imageTone: 'blue',
        price: '42,000원',
        title: '라이트 크로스백',
      },
    ],
    chatBubbleType: 'CAROUSEL_COMMERCE',
    content: '#{고객명}님, #{기획전명} 상품을 캐러셀로 확인해 보세요.',
    label: '브랜드 특가 캐러셀 · CAROUSEL_COMMERCE',
    senderProfileId: 'brand-profile-style',
    templateName: '브랜드 특가 캐러셀',
    value: 'brand-template-carousel-commerce',
    variables: [
      { fallbackValue: '고객', key: '고객명', type: 'string' },
      { fallbackValue: '브랜드 특가', key: '기획전명', type: 'string' },
    ],
  },
];

export const defaultBrandMessageSendFormValue = {
  adult: false,
  additionalContent: '',
  buttons: [{ id: 'brand-button-1', name: '자세히 보기', type: 'WL' }],
  carousel: null,
  chatBubbleType: 'TEXT',
  commerce: null,
  content: '',
  coupon: null,
  fallbackAdvertisementEnabled: false,
  fallbackEnabled: false,
  fallbackSenderNumber: '1544-0000',
  fallbackUnsubscribeNumber: '',
  header: '',
  image: null,
  imageFile: null,
  imageParameters: {},
  item: null,
  mode: 'freestyle',
  pushAlarm: true,
  recipient: [],
  resellerCode: '',
  scheduledAt: '',
  senderProfileId: '',
  statsId: '',
  targeting: '',
  templateCode: '',
  templateParameter: {},
  unsubscribeAuthNo: '',
  unsubscribeNo: '',
  video: null,
  videoParameter: null,
};

export const brandChatBubbleTypeConfig = {
  TEXT: {
    buttonMaxCount: 5,
    contentLabel: '메시지 내용',
    contentMaxLength: 1300,
    contentMaxLineBreak: 99,
    contentMode: 'required',
    contentPlaceholder: '브랜드 메시지 본문을 입력하세요.',
    editor: 'plain',
    label: '텍스트',
  },
  IMAGE: {
    buttonMaxCount: 5,
    contentLabel: '메시지 내용',
    contentMaxLength: 1300,
    contentMaxLineBreak: 99,
    contentMode: 'required',
    contentPlaceholder: '이미지와 함께 보낼 메시지 내용을 입력하세요.',
    editor: 'image',
    label: '이미지',
  },
  WIDE: {
    buttonMaxCount: 2,
    contentLabel: '메시지 내용',
    contentMaxLength: 76,
    contentMaxLineBreak: 5,
    contentMode: 'required',
    contentPlaceholder: '와이드 이미지 본문을 입력하세요.',
    editor: 'wideImage',
    label: '와이드 이미지',
  },
  CAROUSEL_FEED: {
    buttonMaxCount: 2,
    contentMaxLength: 1300,
    contentMode: 'hidden',
    editor: 'carouselFeed',
    label: '캐러셀 피드',
  },
  PREMIUM_VIDEO: {
    buttonMaxCount: 1,
    contentLabel: '영상 소개 문구',
    contentMaxLength: 76,
    contentMaxLineBreak: 5,
    contentMode: 'optional',
    contentPlaceholder: '영상 소개 문구를 입력하세요.',
    editor: 'premiumVideo',
    label: '프리미엄 동영상',
  },
  WIDE_ITEM_LIST: {
    buttonMaxCount: 2,
    contentMaxLength: 1300,
    contentMode: 'hidden',
    editor: 'wideItemList',
    label: '와이드 리스트',
  },
  COMMERCE: {
    buttonMaxCount: 2,
    contentMaxLength: 1300,
    contentMode: 'hidden',
    editor: 'commerce',
    label: '커머스',
  },
  CAROUSEL_COMMERCE: {
    buttonMaxCount: 2,
    contentMaxLength: 1300,
    contentMode: 'hidden',
    editor: 'carouselCommerce',
    label: '캐러셀 커머스',
  },
};

const hiddenBrandChatBubbleTypeOptions = new Set(['PREMIUM_VIDEO']);

const brandChatBubbleTypeOptions = Object.entries(brandChatBubbleTypeConfig)
  .filter(([value]) => !hiddenBrandChatBubbleTypeOptions.has(value))
  .map(([value, config]) => ({
    label: config.label,
    value,
  }));

const brandChatBubbleTypeLabels = Object.fromEntries(
  Object.entries(brandChatBubbleTypeConfig).map(([value, config]) => [value, config.label])
);

const brandChatBubbleTypeValues = new Set(Object.keys(brandChatBubbleTypeConfig));

const brandTopLevelImageTypes = new Set(['IMAGE', 'WIDE']);
const brandCarouselTypes = new Set(['CAROUSEL_FEED', 'CAROUSEL_COMMERCE']);
const brandShortButtonNameTypes = new Set(['WIDE', 'WIDE_ITEM_LIST', 'PREMIUM_VIDEO', 'COMMERCE']);
const brandCarouselListMinimum = 2;
const brandCarouselListMaximum = 6;
const brandCarouselCommerceIntroMaximum = 5;
const brandCarouselButtonMaxCount = 2;
const brandCarouselFeedContentRules = { contentMaxLength: 180, contentMaxLineBreak: 2 };
const brandCommercePriceMax = 99999999;
const brandCommerceDiscountFixedMax = 999999;
const brandCommerceDiscountTypeOptions = [
  { label: '할인율(%)', value: 'rate' },
  { label: '정액 할인가격(원)', value: 'fixed' },
];
const brandCommerceDiscountTypeValues = new Set(brandCommerceDiscountTypeOptions.map((option) => option.value));

const brandMessageButtonTypeOptions = [
  { label: '웹 링크', value: 'WL' },
  { label: '앱 링크', value: 'AL' },
  { label: '봇 키워드', value: 'BK' },
  { label: '메시지 전달', value: 'MD' },
  { label: '채널 추가', value: 'AC' },
  { label: '챗봇 전환', value: 'BT' },
  { label: '비즈니스폼', value: 'BF' },
];

const brandAddChannelButtonName = '채널 추가';

function BrandTemplateSelectionAction({
  disabled = false,
  onCopyEdit,
  onUseAsIs,
  selectedTemplateName = '',
}) {
  const triggerLabel = selectedTemplateName
    ? `${selectedTemplateName} 템플릿 사용`
    : '선택한 템플릿 사용';

  return (
    <ActionMenu>
      <ActionMenuTrigger asChild>
        <button
          aria-label={triggerLabel}
          className="brand-template-selection-action-trigger"
          disabled={disabled}
          type="button"
        >
          <span>템플릿 사용</span>
          <ChevronDown aria-hidden="true" size={14} />
        </button>
      </ActionMenuTrigger>
      <ActionMenuContent align="end" className="brand-template-selection-action-menu" sideOffset={6}>
        <ActionMenuItem
          description="templateCode로 템플릿 발송"
          leadingVisual={<Send size={16} />}
          onSelect={onUseAsIs}
        >
          그대로 사용
        </ActionMenuItem>
        <ActionMenuItem
          description="내용을 가져와 자유형으로 수정"
          leadingVisual={<Copy size={16} />}
          onSelect={onCopyEdit}
        >
          복사해서 편집
        </ActionMenuItem>
      </ActionMenuContent>
    </ActionMenu>
  );
}

function getBrandMessageButtonTypeLabel(type) {
  return brandMessageButtonTypeOptions.find((option) => option.value === type)?.label ?? type;
}

const brandMessageCouponFixedOptionOptions = [
  {
    defaultFixedValue: '100',
    fixedCouponValue: 'amount',
    fixedLabel: '할인 금액',
    fixedPlaceholder: '0~99,999,999 (숫자만 입력)',
    label: '#{할인금액}원 할인 쿠폰',
    suffix: '원 할인 쿠폰',
    templateTitle: '#{할인금액}원 할인 쿠폰',
    type: 'AMOUNT',
    value: 'discountPriceCoupon',
    variableKey: '할인금액',
  },
  {
    defaultFixedValue: '10',
    fixedCouponValue: 'rate',
    fixedLabel: '할인율',
    fixedPlaceholder: '0~100 (숫자만 입력)',
    label: '#{할인율}% 할인 쿠폰',
    suffix: '% 할인 쿠폰',
    templateTitle: '#{할인율}% 할인 쿠폰',
    type: 'PERCENT',
    value: 'discountRateCoupon',
    variableKey: '할인율',
  },
  {
    defaultFixedValue: '',
    fixedCouponValue: 'none',
    fixedLabel: '',
    fixedPlaceholder: '',
    label: '배송비 할인 쿠폰',
    suffix: '',
    templateTitle: '배송비 할인 쿠폰',
    type: 'SHIPPING',
    value: 'shippingDiscountCoupon',
    variableKey: '',
  },
  {
    defaultFixedValue: '상품',
    fixedCouponValue: 'productName',
    fixedLabel: '상품명',
    fixedPlaceholder: '최대 7자 입력',
    label: '#{상품명} 무료 쿠폰',
    suffix: ' 무료 쿠폰',
    templateTitle: '#{상품명} 무료 쿠폰',
    type: 'FREE',
    value: 'freeProductNameCoupon',
    variableKey: '상품명',
  },
  {
    defaultFixedValue: '상품',
    fixedCouponValue: 'productName',
    fixedLabel: '상품명',
    fixedPlaceholder: '최대 7자 입력',
    label: '#{상품명} UP 쿠폰',
    suffix: ' UP 쿠폰',
    templateTitle: '#{상품명} UP 쿠폰',
    type: 'UP',
    value: 'productNameUpCoupon',
    variableKey: '상품명',
  },
];

function createBrandCouponId() {
  return `brand-coupon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getBoundedNumberText(value, max) {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  return String(Math.min(max, Math.max(1, Number(digits))));
}

function getBrandIntegerValue(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = Number(String(value).replace(/[^0-9.-]/g, '').trim());

  return Number.isFinite(normalized) ? Math.trunc(normalized) : null;
}

function getBrandCommerceDiscountType(value) {
  return brandCommerceDiscountTypeValues.has(value) ? value : 'rate';
}

function isBrandIntegerInRange(value, min, max) {
  const integer = getBrandIntegerValue(value);

  return integer !== null && integer >= min && integer <= max;
}

function formatCouponAmount(value) {
  const amount = Number(String(value ?? '').replace(/\D/g, ''));

  if (!Number.isFinite(amount) || amount < 1) {
    return '1';
  }

  return amount.toLocaleString('ko-KR');
}

function getLimitedText(value, maxLength) {
  return Array.from(String(value ?? '')).slice(0, maxLength).join('');
}

function getBrandCouponOptionByValue(value) {
  return brandMessageCouponFixedOptionOptions.find((option) => option.value === value) ?? null;
}

function getBrandCouponOptionByType(type) {
  return brandMessageCouponFixedOptionOptions.find((option) => option.type === type) ?? null;
}

function parseBrandCouponTitle(title) {
  const text = String(title ?? '').trim();

  if (!text) {
    return null;
  }

  const templateOption = brandMessageCouponFixedOptionOptions.find((option) => option.templateTitle === text);

  if (templateOption) {
    return {
      fixedValue: '',
      option: templateOption,
      usesTemplateTitle: Boolean(templateOption.variableKey),
    };
  }

  const amountMatch = text.match(/^([\d,]+)원 할인 쿠폰$/);

  if (amountMatch) {
    return {
      fixedValue: amountMatch[1].replace(/\D/g, ''),
      option: getBrandCouponOptionByValue('discountPriceCoupon'),
      usesTemplateTitle: false,
    };
  }

  const rateMatch = text.match(/^(\d+)% 할인 쿠폰$/);

  if (rateMatch) {
    return {
      fixedValue: rateMatch[1],
      option: getBrandCouponOptionByValue('discountRateCoupon'),
      usesTemplateTitle: false,
    };
  }

  if (text === '배송비 할인 쿠폰') {
    return {
      fixedValue: '',
      option: getBrandCouponOptionByValue('shippingDiscountCoupon'),
      usesTemplateTitle: false,
    };
  }

  const freeMatch = text.match(/^(.+) 무료 쿠폰$/);

  if (freeMatch) {
    return {
      fixedValue: getLimitedText(freeMatch[1], 7),
      option: getBrandCouponOptionByValue('freeProductNameCoupon'),
      usesTemplateTitle: false,
    };
  }

  const upMatch = text.match(/^(.+) UP 쿠폰$/);

  if (upMatch) {
    return {
      fixedValue: getLimitedText(upMatch[1], 7),
      option: getBrandCouponOptionByValue('productNameUpCoupon'),
      usesTemplateTitle: false,
    };
  }

  return null;
}

function getBrandCouponOption(coupon) {
  return getBrandCouponOptionByValue(coupon.selectCouponType)
    ?? getBrandCouponOptionByType(coupon.type)
    ?? parseBrandCouponTitle(coupon.title)?.option
    ?? getBrandCouponOptionByValue('discountPriceCoupon');
}

function getRawBrandCouponFixedValue(coupon, option, parsedTitle) {
  if (coupon.fixedCouponValue !== undefined) return coupon.fixedCouponValue;
  if (coupon.variable !== undefined) return coupon.variable;
  if (parsedTitle?.fixedValue !== undefined && parsedTitle.fixedValue !== '') return parsedTitle.fixedValue;
  if (option.type === 'AMOUNT' && coupon.amount !== undefined) return coupon.amount;
  if (option.type === 'PERCENT' && coupon.percent !== undefined) return coupon.percent;
  if ((option.type === 'FREE' || option.type === 'UP') && coupon.text !== undefined) return coupon.text;

  return undefined;
}

function normalizeBrandCouponFixedValue(value, option) {
  if (option.fixedCouponValue === 'amount') {
    return getBoundedNumberText(value ?? '', 99999999);
  }

  if (option.fixedCouponValue === 'rate') {
    return getBoundedNumberText(value ?? '', 100);
  }

  if (option.fixedCouponValue === 'productName') {
    return getLimitedText(value ?? '', 7);
  }

  return '';
}

function getBrandCouponFixedTitle(fixedValue, option) {
  if (option.fixedCouponValue === 'amount') {
    return `${formatCouponAmount(fixedValue)}${option.suffix}`;
  }

  if (option.fixedCouponValue === 'rate') {
    return `${fixedValue || '1'}${option.suffix}`;
  }

  if (option.fixedCouponValue === 'productName') {
    return `${fixedValue || option.defaultFixedValue}${option.suffix}`;
  }

  return option.templateTitle;
}

function getBrandCouponMode(coupon, option, parsedTitle, fixedValue) {
  if (!option.variableKey) {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(coupon, 'isUseVariable')) {
    return Boolean(coupon.isUseVariable);
  }

  if (parsedTitle?.usesTemplateTitle) {
    return false;
  }

  return fixedValue !== '' || coupon.fixedCouponValue === undefined;
}

function normalizeBrandCoupon(coupon) {
  if (!coupon || typeof coupon !== 'object' || Array.isArray(coupon)) {
    return null;
  }

  const parsedTitle = parseBrandCouponTitle(coupon.title);
  const option = getBrandCouponOption(coupon);
  const rawFixedValue = getRawBrandCouponFixedValue(coupon, option, parsedTitle);
  const fixedValue = normalizeBrandCouponFixedValue(rawFixedValue ?? option.defaultFixedValue, option);
  const isUseVariable = getBrandCouponMode(coupon, option, parsedTitle, fixedValue);
  const title = isUseVariable
    ? getBrandCouponFixedTitle(fixedValue, option)
    : option.templateTitle;

  return {
    amount: option.type === 'AMOUNT' ? fixedValue : getBoundedNumberText(coupon.amount ?? '100', 99999999),
    description: coupon.description ?? 'discount coupon',
    exceptionVariableTitle: option.suffix,
    fixedCouponValue: isUseVariable ? fixedValue : '',
    id: coupon.id ?? createBrandCouponId(),
    isUseVariable,
    linkMo: coupon.linkMo ?? '',
    linkPc: coupon.linkPc ?? '',
    percent: option.type === 'PERCENT' ? fixedValue : getBoundedNumberText(coupon.percent ?? '10', 100),
    schemeAndroid: coupon.schemeAndroid ?? '',
    schemeIos: coupon.schemeIos ?? '',
    selectCouponType: option.value,
    text: option.type === 'FREE' || option.type === 'UP'
      ? fixedValue
      : getLimitedText(coupon.text ?? (option.type === 'UP' ? '상품' : '상품'), 7),
    title,
    type: option.type,
    variable: isUseVariable ? fixedValue : '',
  };
}

function isBlankText(value) {
  return !String(value ?? '').trim();
}

function countBrandLineBreaks(value) {
  return (String(value ?? '').match(/\r\n|\r|\n/g) ?? []).length;
}

function getKoreanObjectParticle(value) {
  const lastCharacter = Array.from(String(value ?? '').trim()).at(-1);
  const codePoint = lastCharacter?.charCodeAt(0) ?? 0;

  if (codePoint < 0xac00 || codePoint > 0xd7a3) {
    return '을';
  }

  return (codePoint - 0xac00) % 28 === 0 ? '를' : '을';
}

function hasBrandCouponConnection(coupon) {
  const normalizedCoupon = normalizeBrandCoupon(coupon);

  if (!normalizedCoupon) {
    return true;
  }

  const mobileWebLink = String(normalizedCoupon.linkMo ?? '').trim();
  const androidLink = String(normalizedCoupon.schemeAndroid ?? '').trim();
  const iosLink = String(normalizedCoupon.schemeIos ?? '').trim();

  return Boolean(
    isHttpUrl(mobileWebLink)
    || androidLink.startsWith('alimtalk=coupon://')
    || iosLink.startsWith('alimtalk=coupon://')
  );
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value ?? '').trim());
}

function getBrandCouponContentMaxLength(chatBubbleType) {
  const couponContentMaxLength = ['WIDE', 'WIDE_ITEM_LIST', 'PREMIUM_VIDEO'].includes(chatBubbleType) ? 18 : 12;

  return couponContentMaxLength;
}

function getBrandCouponValidation(coupon, { chatBubbleType = 'TEXT' } = {}) {
  const normalizedCoupon = normalizeBrandCoupon(coupon);

  if (!normalizedCoupon) {
    return {
      errors: {},
      firstField: '',
      isValid: true,
      statusLabels: [],
    };
  }

  const errors = {};
  const couponContentMaxLength = getBrandCouponContentMaxLength(chatBubbleType);

  if (isBlankText(normalizedCoupon.description)) {
    errors.description = '설명을 입력해 주세요.';
  } else if (countBrandLineBreaks(normalizedCoupon.description) > 0) {
    errors.description = '설명에는 줄바꿈을 사용할 수 없습니다.';
  } else if (Array.from(normalizedCoupon.description).length > couponContentMaxLength) {
    errors.description = `설명은 ${couponContentMaxLength}자 이하로 입력해 주세요.`;
  }

  const option = getBrandCouponOption(normalizedCoupon);

  if (option.variableKey && !normalizedCoupon.isUseVariable) {
    errors.fixedCouponValue = '고정값을 입력해야 발송할 수 있습니다.';
  }

  if (normalizedCoupon.isUseVariable && option.fixedCouponValue === 'amount' && isBlankText(normalizedCoupon.fixedCouponValue)) {
    errors.fixedCouponValue = '할인 금액을 입력해 주세요.';
  }

  if (normalizedCoupon.isUseVariable && option.fixedCouponValue === 'rate' && isBlankText(normalizedCoupon.fixedCouponValue)) {
    errors.fixedCouponValue = '할인율을 입력해 주세요.';
  }

  if (normalizedCoupon.isUseVariable && option.fixedCouponValue === 'productName' && isBlankText(normalizedCoupon.fixedCouponValue)) {
    errors.fixedCouponValue = '상품명을 입력해 주세요.';
  }

  if (!hasBrandCouponConnection(normalizedCoupon)) {
    errors.connection = 'https:// 모바일 웹 링크 또는 alimtalk=coupon:// 앱 링크를 입력해 주세요.';
  }

  const statusLabels = [];

  if (errors.description) {
    statusLabels.push('설명 필요');
  }

  if (errors.fixedCouponValue) {
    statusLabels.push('조건 필요');
  }

  if (errors.connection) {
    statusLabels.push('연결 필요');
  }

  return {
    errors,
    firstField: ['description', 'fixedCouponValue', 'linkMo'].find((field) => {
      if (field === 'linkMo') {
        return Boolean(errors.connection);
      }

      return Boolean(errors[field]);
    }) ?? '',
    isValid: statusLabels.length === 0,
    statusLabels,
  };
}

function isKakaoTvUrl(value) {
  const url = String(value ?? '').trim();

  return /^https?:\/\/(?:tv\.kakao\.com|kakaotv\.daum\.net)\//i.test(url);
}

function hasBrandImageData(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return false;
  }

  const image = source.image && typeof source.image === 'object' && !Array.isArray(source.image)
    ? source.image
    : source;

  return Boolean(
    String(source.imageFile?.name ?? '').trim()
    || String(image.imageFile?.name ?? '').trim()
    || String(source.imageUrl ?? source.url ?? '').trim()
    || String(image.imageUrl ?? image.url ?? '').trim()
    || String(image.imageSeq ?? '').trim()
    || String(image.imageName ?? image.name ?? '').trim()
  );
}

function getBrandListFromObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const list = [value.list, value.items, value.listItems, value.itemList].find(Array.isArray);

  return list ? list.map((item) => (item && typeof item === 'object' && !Array.isArray(item) ? { ...item } : {})) : [];
}

function getBrandWideItemList(item) {
  return getBrandListFromObject(item);
}

function normalizeBrandItemButtons(buttons) {
  return Array.isArray(buttons)
    ? withBrandButtonOrdering(buttons.map((button, index) => (
        button && typeof button === 'object' && !Array.isArray(button)
          ? normalizeBrandButtonDraft({ ...button, id: button.id ?? `carousel-button-${index + 1}` })
          : { id: `carousel-button-${index + 1}` }
      )))
    : [];
}

function getBrandCarouselList(carousel) {
  return getBrandListFromObject(carousel).map((item) => ({
    ...item,
    buttons: normalizeBrandItemButtons(item.buttons),
    coupon: normalizeBrandCoupon(item.coupon),
  }));
}

function hasBrandCarouselTailLink(tail) {
  return Boolean(
    !isBlankText(tail?.linkMo ?? tail?.linkMobile ?? tail?.mobileLink ?? tail?.mobileWebLink)
    || !isBlankText(tail?.linkPc)
    || !isBlankText(tail?.schemeAndroid)
    || !isBlankText(tail?.schemeIos)
  );
}

function getBrandCarouselTailValidation(tail) {
  const normalizedTail = normalizeBrandCarouselTail(tail);
  const errors = {};

  if (normalizedTail?.isMoreButton && isBlankText(normalizedTail.linkMo)) {
    errors.linkMo = '더보기 모바일 링크를 입력해 주세요.';
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

function createBrandCarouselTail() {
  return {
    isMoreButton: false,
    linkMo: '',
    linkPc: '',
    schemeAndroid: '',
    schemeIos: '',
  };
}

function getBrandCarouselTailSummary(tail) {
  if (!isBlankText(tail?.linkMo)) {
    return '모바일 링크 설정됨';
  }

  if (hasBrandCarouselTailLink(tail)) {
    return '링크 설정됨 · 모바일 링크 필요';
  }

  return '링크 없음';
}

function hasBrandCarouselIntroData(head) {
  if (!head || typeof head !== 'object' || Array.isArray(head)) {
    return false;
  }

  return Boolean(
    !isBlankText(head.header)
    || !isBlankText(head.content)
    || hasBrandImageData(head)
    || !isBlankText(head.linkMo)
    || !isBlankText(head.linkPc)
    || !isBlankText(head.schemeAndroid)
    || !isBlankText(head.schemeIos)
  );
}

function getBrandCommerceItemErrors(item, label, { requireImage = true } = {}) {
  const errors = {};
  const title = String(item.title ?? '');
  const additionalContent = String(item.additionalContent ?? '');
  const regularPrice = getBrandIntegerValue(item.regularPrice ?? item.price);
  const discountPrice = getBrandIntegerValue(item.discountPrice);
  const discountRate = getBrandIntegerValue(item.discountRate);
  const discountFixed = getBrandIntegerValue(item.discountFixed);
  const discountType = item.discountType;

  if (isBlankText(title)) {
    errors.title = `${label} 상품명을 입력해 주세요.`;
  } else if (countBrandLineBreaks(title) > 0) {
    errors.title = `${label} 상품명에는 줄바꿈을 사용할 수 없습니다.`;
  } else if (Array.from(title).length > 30) {
    errors.title = `${label} 상품명은 30자 이하로 입력해 주세요.`;
  }

  if (regularPrice === null) {
    errors.regularPrice = `${label} 정상가를 입력해 주세요.`;
  } else if (!isBrandIntegerInRange(item.regularPrice ?? item.price, 0, brandCommercePriceMax)) {
    errors.regularPrice = `${label} 정상가는 0 이상 99,999,999 이하로 입력해 주세요.`;
  }

  if (discountPrice !== null && !isBrandIntegerInRange(item.discountPrice, 0, brandCommercePriceMax)) {
    errors.discountPrice = `${label} 할인가은 0 이상 99,999,999 이하로 입력해 주세요.`;
  }

  if (discountRate !== null && !isBrandIntegerInRange(item.discountRate, 0, 100)) {
    errors.discountRate = `${label} 할인율은 0 이상 100 이하로 입력해 주세요.`;
  }

  if (discountFixed !== null && !isBrandIntegerInRange(item.discountFixed, 0, brandCommerceDiscountFixedMax)) {
    errors.discountFixed = `${label} 정액 할인은 0 이상 999,999 이하로 입력해 주세요.`;
  }

  if (discountType && !brandCommerceDiscountTypeValues.has(discountType)) {
    errors.discountType = `${label} 할인 유형을 선택해 주세요.`;
  }

  if (regularPrice !== null && discountPrice !== null && regularPrice < discountPrice) {
    errors['discount-lower-than-regular'] = '정상 가격이 할인 가격보다 낮습니다.';
  }

  if (additionalContent && countBrandLineBreaks(additionalContent) > 1) {
    errors.additionalContent = `${label} 추가 문구 줄바꿈은 1회 이하여야 합니다.`;
  } else if (Array.from(additionalContent).length > 34) {
    errors.additionalContent = `${label} 추가 문구는 34자 이하로 입력해 주세요.`;
  }

  if (requireImage && !hasBrandImageData(item)) {
    errors.image = `${label} 이미지를 입력해 주세요.`;
  }

  return errors;
}

function getBrandCommerceItemIssues(item, index, { carousel = false, requireImage = true } = {}) {
  const label = carousel ? `캐러셀 커머스 ${index + 1}번` : '커머스';

  return Object.values(getBrandCommerceItemErrors(item, label, { requireImage }));
}

function getBrandCommerceValidation(item) {
  const errors = getBrandCommerceItemErrors(item ?? {}, '커머스');

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    statusLabels: [
      errors.title ? '상품명 필요' : '',
      errors.regularPrice ? '정상가 필요' : '',
      errors.discountPrice || errors.discountRate || errors.discountFixed || errors.discountType || errors['discount-lower-than-regular']
        ? '할인 확인'
        : '',
      errors.additionalContent ? '추가 문구 확인' : '',
      errors.image ? '이미지 필요' : '',
    ].filter(Boolean),
  };
}

function getBrandWideItemValidation(item, index) {
  const errors = {};
  const label = `와이드 리스트 ${index + 1}번`;
  const titleRequirement = index === 0 ? { title: 'optional' } : { title: 'required' };
  const titleMode = titleRequirement.title;
  const titleMaxLength = titleMode === 'optional' ? 25 : 30;
  const titleLength = Array.from(String(item.title ?? '')).length;

  if (titleMode !== 'optional' && isBlankText(item.title)) {
    errors.title = `${label} 제목을 입력해 주세요.`;
  } else if (titleLength > titleMaxLength) {
    errors.title = `${label} 제목은 ${titleMaxLength}자 이하로 입력해 주세요.`;
  }

  if (!hasBrandImageData(item)) {
    errors.image = `${label} 이미지를 입력해 주세요.`;
  }

  if (isBlankText(item.linkMo)) {
    errors.linkMo = `${label} 모바일 링크를 입력해 주세요.`;
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    statusLabels: [
      errors.title ? '제목 필요' : '',
      errors.image ? '이미지 필요' : '',
      errors.linkMo ? '링크 필요' : '',
    ].filter(Boolean),
  };
}

function getBrandFeedItemValidation(item, index) {
  const errors = {};
  const label = `캐러셀 피드 ${index + 1}번`;
  const content = String(item.content ?? item.description ?? '');

  if (isBlankText(item.title)) {
    errors.title = `${label} 제목을 입력해 주세요.`;
  }

  if (isBlankText(content)) {
    errors.content = `${label} 본문을 입력해 주세요.`;
  } else if (Array.from(content).length > brandCarouselFeedContentRules.contentMaxLength) {
    errors.content = `${label} 본문은 ${brandCarouselFeedContentRules.contentMaxLength}자 이하로 입력해 주세요.`;
  } else if (countBrandLineBreaks(content) > brandCarouselFeedContentRules.contentMaxLineBreak) {
    errors.content = `${label} 본문 줄바꿈은 ${brandCarouselFeedContentRules.contentMaxLineBreak}회 이하여야 합니다.`;
  }

  if (!hasBrandImageData(item)) {
    errors.image = `${label} 이미지를 입력해 주세요.`;
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    statusLabels: [
      errors.title ? '제목 필요' : '',
      errors.content ? '본문 필요' : '',
      errors.image ? '이미지 필요' : '',
    ].filter(Boolean),
  };
}

function getBrandCarouselCommerceItemValidation(item, index) {
  const errors = {};
  const label = `캐러셀 커머스 ${index + 1}번`;

  if (isBlankText(item.title)) {
    errors.title = `${label} 상품명을 입력해 주세요.`;
  }

  if (isBlankText(item.regularPrice ?? item.price)) {
    errors.regularPrice = `${label} 정상가를 입력해 주세요.`;
  }

  if (!hasBrandImageData(item)) {
    errors.image = `${label} 이미지를 입력해 주세요.`;
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    statusLabels: [
      errors.title ? '상품명 필요' : '',
      errors.regularPrice ? '정상가 필요' : '',
      errors.image ? '이미지 필요' : '',
    ].filter(Boolean),
  };
}

function getBrandCarouselIntroValidation(head) {
  const errors = {};

  if (isBlankText(head.header)) {
    errors.header = '커머스 인트로 제목을 입력해 주세요.';
  }

  if (isBlankText(head.content)) {
    errors.content = '커머스 인트로 내용을 입력해 주세요.';
  }

  if (!hasBrandImageData(head)) {
    errors.image = '커머스 인트로 이미지를 업로드해 주세요.';
  }

  if ((head.linkPc || head.schemeAndroid || head.schemeIos) && isBlankText(head.linkMo)) {
    errors.linkMo = '커머스 인트로 링크를 사용하려면 모바일 웹 링크를 입력해 주세요.';
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    statusLabels: [
      errors.header ? '제목 필요' : '',
      errors.content ? '내용 필요' : '',
      errors.image ? '이미지 필요' : '',
      errors.linkMo ? '모바일 링크 필요' : '',
    ].filter(Boolean),
  };
}

function getBrandScopedErrorMessage(scope, errors) {
  return Object.values(errors)
    .map(getBrandInspectorErrorMessage)
    .filter(Boolean)
    .map((message) => `${scope}: ${message}`)
    .join('\n');
}

function getBrandCarouselItemActionValidation(item, index, itemLabel, chatBubbleType) {
  const label = `캐러셀 ${itemLabel} ${index + 1}번`;
  const buttons = normalizeBrandItemButtons(item?.buttons);
  const coupon = normalizeBrandCoupon(item?.coupon);
  const errors = {};
  const statusLabels = [];
  let firstInvalidButtonId = '';
  let firstInvalidCouponField = '';

  if (buttons.length < 1) {
    errors.buttons = `${label} 버튼을 1개 이상 추가해 주세요.`;
    statusLabels.push('버튼 필요');
  } else if (buttons.length > brandCarouselButtonMaxCount) {
    errors.buttons = `${label} 버튼은 최대 2개까지 추가할 수 있습니다.`;
    statusLabels.push('버튼 초과');
  }

  buttons.forEach((button, buttonIndex) => {
    const validation = getBrandButtonValidation(button, { maxNameLength: 8 });

    if (!validation.isValid) {
      errors[`button-${buttonIndex}`] = getBrandScopedErrorMessage(
        `${label} ${buttonIndex + 1}번 버튼`,
        validation.errors
      );

      if (!statusLabels.includes('버튼 확인')) {
        statusLabels.push('버튼 확인');
      }

      if (!firstInvalidButtonId) {
        firstInvalidButtonId = button.id ?? '';
      }
    }
  });

  const addChannelPositionError = getBrandAddChannelButtonPositionError(buttons, chatBubbleType, label);

  if (addChannelPositionError) {
    errors.addChannelPosition = addChannelPositionError;
    statusLabels.push('AC 순서 확인');
  }

  if (coupon) {
    const validation = getBrandCouponValidation(coupon, { chatBubbleType });

    if (!validation.isValid) {
      errors.coupon = getBrandScopedErrorMessage(`${label} 쿠폰`, validation.errors);
      statusLabels.push('쿠폰 확인');
      firstInvalidCouponField = validation.firstField;
    }
  }

  return {
    errors,
    firstInvalidButtonId,
    firstInvalidCouponField,
    isValid: Object.keys(errors).length === 0,
    statusLabels,
  };
}

function getBrandCarouselItemValidation(item, index, isCommerce) {
  const baseValidation = isCommerce
    ? getBrandCarouselCommerceItemValidation(item, index)
    : getBrandFeedItemValidation(item, index);
  const actionValidation = getBrandCarouselItemActionValidation(
    item,
    index,
    isCommerce ? '커머스' : '피드',
    isCommerce ? 'CAROUSEL_COMMERCE' : 'CAROUSEL_FEED'
  );

  return {
    errors: {
      ...baseValidation.errors,
      ...actionValidation.errors,
    },
    firstInvalidButtonId: actionValidation.firstInvalidButtonId,
    firstInvalidCouponField: actionValidation.firstInvalidCouponField,
    isValid: baseValidation.isValid && actionValidation.isValid,
    statusLabels: [
      ...baseValidation.statusLabels,
      ...actionValidation.statusLabels,
    ],
  };
}

function getFirstInvalidBrandItemEditor(message) {
  if (message.chatBubbleType === 'WIDE_ITEM_LIST') {
    const items = getBrandWideItemList(message.item);
    const invalidIndex = items.findIndex((item, index) => !getBrandWideItemValidation(item, index).isValid);

    return invalidIndex >= 0 ? { index: invalidIndex, kind: 'wide' } : null;
  }

  if (message.chatBubbleType === 'CAROUSEL_FEED') {
    const items = getBrandCarouselList(message.carousel);
    const invalidIndex = items.findIndex((item, index) => !getBrandCarouselItemValidation(item, index, false).isValid);
    const tailValidation = getBrandCarouselTailValidation(message.carousel?.tail ?? message.carousel?.moreButton);

    if (invalidIndex >= 0) {
      const validation = getBrandCarouselItemValidation(items[invalidIndex], invalidIndex, false);

      if (validation.firstInvalidButtonId) {
        return {
          buttonId: validation.firstInvalidButtonId,
          index: invalidIndex,
          kind: 'carousel',
          panel: 'button',
        };
      }

      if (validation.firstInvalidCouponField) {
        return {
          index: invalidIndex,
          kind: 'carousel',
          panel: 'coupon',
        };
      }

      return { index: invalidIndex, kind: 'carousel', panel: 'details' };
    }

    if (!tailValidation.isValid) {
      return { kind: 'carouselTail' };
    }

    return null;
  }

  if (message.chatBubbleType === 'CAROUSEL_COMMERCE') {
    const head = message.carousel?.head ?? {};

    if (message.carousel?.isUseIntro && !getBrandCarouselIntroValidation(head).isValid) {
      return { kind: 'carouselIntro' };
    }

    const items = getBrandCarouselList(message.carousel);
    const invalidIndex = items.findIndex((item, index) => !getBrandCarouselItemValidation(item, index, true).isValid);
    const tailValidation = getBrandCarouselTailValidation(message.carousel?.tail ?? message.carousel?.moreButton);

    if (invalidIndex >= 0) {
      const validation = getBrandCarouselItemValidation(items[invalidIndex], invalidIndex, true);

      if (validation.firstInvalidButtonId) {
        return {
          buttonId: validation.firstInvalidButtonId,
          index: invalidIndex,
          kind: 'carousel',
          panel: 'button',
        };
      }

      if (validation.firstInvalidCouponField) {
        return {
          index: invalidIndex,
          kind: 'carousel',
          panel: 'coupon',
        };
      }

      return { index: invalidIndex, kind: 'carousel', panel: 'details' };
    }

    if (!tailValidation.isValid) {
      return { kind: 'carouselTail' };
    }

    return null;
  }

  return null;
}

function getReorderedIndex(index, oldIndex, newIndex) {
  if (index === oldIndex) {
    return newIndex;
  }

  if (oldIndex < newIndex && index > oldIndex && index <= newIndex) {
    return index - 1;
  }

  if (oldIndex > newIndex && index >= newIndex && index < oldIndex) {
    return index + 1;
  }

  return index;
}

function moveArrayItem(items, oldIndex, newIndex) {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(oldIndex, 1);

  if (!movedItem) {
    return items;
  }

  nextItems.splice(newIndex, 0, movedItem);
  return nextItems;
}

function getEditorAfterItemRemoval(editor, kind, index) {
  if (editor?.kind !== kind) {
    return editor;
  }

  if (editor.index === index) {
    return null;
  }

  if (editor.index > index) {
    return { ...editor, index: editor.index - 1 };
  }

  return editor;
}

function getBrandCarouselPreviewTargetIndex(editor, message, carouselItemCount) {
  if (!brandCarouselTypes.has(message.chatBubbleType)) {
    return null;
  }

  const hasIntro = message.chatBubbleType === 'CAROUSEL_COMMERCE' && Boolean(message.carousel?.isUseIntro);
  const introOffset = hasIntro ? 1 : 0;

  if (editor?.kind === 'carouselIntro') {
    return 0;
  }

  if (editor?.kind === 'carousel') {
    return introOffset + editor.index;
  }

  if (editor?.kind === 'carouselTail') {
    return introOffset + carouselItemCount;
  }

  return null;
}

function getBrandButtonValidation(button, { maxNameLength = 14 } = {}) {
  const normalizedButton = button && typeof button === 'object' && !Array.isArray(button) ? button : {};
  const type = normalizedButton.type ?? 'WL';
  const name = String(normalizedButton.name ?? '').trim();
  const errors = {};
  const caveats = [];

  if (type === 'AC' && name !== brandAddChannelButtonName) {
    errors.name = `AC 버튼 이름은 '${brandAddChannelButtonName}'로 고정입니다.`;
  } else if (isBlankText(normalizedButton.name)) {
    errors.name = '버튼 이름을 입력해 주세요.';
  } else if (Array.from(String(normalizedButton.name)).length > maxNameLength) {
    errors.name = `버튼 이름은 ${maxNameLength}자 이하로 입력해 주세요.`;
  }

  if (type === 'WL' && !isHttpUrl(normalizedButton.linkMo)) {
    errors.link = '모바일 링크를 입력해주세요.';
  }

  if (type === 'AL') {
    const appLinkCount = [
      isHttpUrl(normalizedButton.linkMo),
      !isBlankText(normalizedButton.schemeAndroid),
      !isBlankText(normalizedButton.schemeIos),
    ].filter(Boolean).length;

    if (appLinkCount < 2) {
      errors.link = '모바일/Android/iOS 링크 중 2개 이상 입력해주세요.';
    }
  }

  if (type === 'BT') {
    caveats.push('BT는 챗봇 전환 메타정보와 이벤트명을 provider 설정과 맞춰야 합니다.');

    if (isBlankText(normalizedButton.chatExtra)) {
      errors.chatExtra = 'BT 버튼은 chatExtra가 필요합니다.';
    }

    if (isBlankText(normalizedButton.chatEvent)) {
      errors.chatEvent = 'BT 버튼은 chatEvent가 필요합니다.';
    }
  }

  if (type === 'BF') {
    const bizFormId = String(normalizedButton.bizFormId ?? normalizedButton.bizFormKey ?? '').trim();

    caveats.push('BF는 연결된 비즈니스폼 ID만 사용할 수 있습니다.');

    if (!/^\d+$/.test(bizFormId)) {
      errors.bizFormId = 'BF 버튼은 숫자형 bizFormId가 필요합니다.';
    }
  }

  if (type === 'AC') {
    caveats.push(`AC는 채널 추가 전용 버튼이며 이름은 '${brandAddChannelButtonName}'로 고정됩니다.`);
    caveats.push('TEXT/IMAGE는 첫 번째, 그 외 타입은 마지막 버튼으로 배치해야 합니다.');
  }

  return {
    caveats,
    errors,
    isValid: Object.keys(errors).length === 0,
    statusLabels: [
      errors.name ? (type === 'AC' ? '이름 고정값' : '이름 필요') : '',
      errors.link ? '링크 필요' : '',
      errors.chatExtra || errors.chatEvent ? '챗봇 값 필요' : '',
      errors.bizFormId ? '비즈폼 ID 필요' : '',
    ].filter(Boolean),
  };
}

function isBrandAddChannelButton(button) {
  return button?.type === 'AC';
}

function getBrandAddChannelButtonPositionError(buttons, chatBubbleType, label) {
  const addChannelIndex = buttons.findIndex(isBrandAddChannelButton);

  if (addChannelIndex < 0) {
    return '';
  }

  const mustBeFirst = chatBubbleType === 'TEXT' || chatBubbleType === 'IMAGE';
  const expectedIndex = mustBeFirst ? 0 : buttons.length - 1;

  if (addChannelIndex === expectedIndex) {
    return '';
  }

  return mustBeFirst
    ? `${label} 채널 추가(AC) 버튼은 첫 번째 버튼이어야 합니다.`
    : `${label} 채널 추가(AC) 버튼은 마지막 버튼이어야 합니다.`;
}

function getBrandCarouselAddChannelButtonCount(items) {
  return items.reduce((count, item) => (
    count + normalizeBrandItemButtons(item.buttons).filter(isBrandAddChannelButton).length
  ), 0);
}

function getBrandMessageTypeValidationIssues(message) {
  const issues = [];
  const chatBubbleType = message.chatBubbleType;
  const typeConfig = getBrandChatBubbleTypeConfig(chatBubbleType);
  const contentLength = Array.from(message.content).length;
  const contentLineBreaks = countBrandLineBreaks(message.content);
  const maxLength = typeConfig.contentMaxLength;
  const maxLineBreak = typeConfig.contentMaxLineBreak;

  if (shouldShowBrandContentField(chatBubbleType)) {
    if (typeConfig.contentMode === 'required' && isBlankText(message.content)) {
      issues.push({
        field: 'content',
        message: `${typeConfig.contentLabel}${getKoreanObjectParticle(typeConfig.contentLabel)} 입력해 주세요.`,
      });
    }

    if (contentLength > maxLength) {
      issues.push({
        field: 'content',
        message: `${typeConfig.contentLabel}은 ${maxLength.toLocaleString()}자 이하여야 합니다.`,
      });
    }

    if (Number.isFinite(maxLineBreak) && contentLineBreaks > maxLineBreak) {
      issues.push({
        field: 'content',
        message: `${typeConfig.contentLabel}의 줄바꿈은 ${maxLineBreak}회 이하여야 합니다.`,
      });
    }
  }

  if (['IMAGE', 'WIDE'].includes(chatBubbleType) && !hasBrandImageData(message)) {
    const imageLabel = chatBubbleType === 'WIDE' ? '와이드 이미지' : '이미지';
    issues.push({ field: 'image', message: `${imageLabel}${getKoreanObjectParticle(imageLabel)} 입력해 주세요.` });
  }

  if (chatBubbleType === 'WIDE_ITEM_LIST') {
    const items = getBrandWideItemList(message.item);

    if (isBlankText(message.header)) {
      issues.push({ field: 'header', message: '와이드 리스트 제목을 입력해 주세요.' });
    }

    if (items.length < 3 || items.length > 4) {
      issues.push({ field: 'item', message: '와이드 리스트는 item.list 항목이 3~4개여야 합니다.' });
    }

    items.forEach((item, index) => {
      for (const messageText of Object.values(getBrandWideItemValidation(item, index).errors)) {
        issues.push({ field: 'item', message: messageText });
      }
    });
  }

  if (chatBubbleType === 'PREMIUM_VIDEO') {
    const videoUrl = String(message.video?.videoUrl ?? '').trim();

    if (!videoUrl) {
      issues.push({ field: 'video', message: '프리미엄 동영상 URL을 입력해 주세요.' });
    } else if (!isKakaoTvUrl(videoUrl)) {
      issues.push({ field: 'video', message: '프리미엄 동영상 URL은 KakaoTV URL 형식이어야 합니다.' });
    }
  }

  if (chatBubbleType === 'COMMERCE') {
    for (const issue of getBrandCommerceItemIssues(message.commerce ?? {}, 0)) {
      issues.push({ field: 'commerce', message: issue });
    }
  }

  if (chatBubbleType === 'CAROUSEL_FEED') {
    const items = getBrandCarouselList(message.carousel);
    const tailValidation = getBrandCarouselTailValidation(message.carousel?.tail ?? message.carousel?.moreButton);

    if (items.length < brandCarouselListMinimum || items.length > brandCarouselListMaximum) {
      issues.push({ field: 'carousel', message: '캐러셀 피드는 carousel.list 항목이 2~6개여야 합니다.' });
    }

    if (getBrandCarouselAddChannelButtonCount(items) > 1) {
      issues.push({ field: 'carousel', message: '캐러셀 전체에서 채널 추가(AC) 버튼은 1개만 사용할 수 있습니다.' });
    }

    items.forEach((item, index) => {
      for (const messageText of Object.values(getBrandCarouselItemValidation(item, index, false).errors)) {
        issues.push({ field: 'carousel', message: messageText });
      }
    });

    for (const messageText of Object.values(tailValidation.errors)) {
      issues.push({ field: 'carousel', message: messageText });
    }
  }

  if (chatBubbleType === 'CAROUSEL_COMMERCE') {
    const items = getBrandCarouselList(message.carousel);
    const hasIntro = Boolean(message.carousel?.isUseIntro);
    const minItems = hasIntro ? 1 : brandCarouselListMinimum;
    const maxItems = hasIntro ? brandCarouselCommerceIntroMaximum : brandCarouselListMaximum;
    const head = message.carousel?.head ?? {};
    const tailValidation = getBrandCarouselTailValidation(message.carousel?.tail ?? message.carousel?.moreButton);

    if (items.length < minItems || items.length > maxItems) {
      issues.push({
        field: 'carousel',
        message: hasIntro
          ? '인트로를 사용하면 캐러셀 커머스 상품은 1~5개여야 합니다.'
          : '인트로를 사용하지 않으면 캐러셀 커머스 상품은 2~6개여야 합니다.',
      });
    }

    if (hasIntro) {
      for (const messageText of Object.values(getBrandCarouselIntroValidation(head).errors)) {
        issues.push({ field: 'carousel', message: messageText });
      }
    }

    if (getBrandCarouselAddChannelButtonCount(items) > 1) {
      issues.push({ field: 'carousel', message: '캐러셀 전체에서 채널 추가(AC) 버튼은 1개만 사용할 수 있습니다.' });
    }

    items.forEach((item, index) => {
      for (const messageText of Object.values(getBrandCarouselItemValidation(item, index, true).errors)) {
        issues.push({ field: 'carousel', message: messageText });
      }
    });

    for (const messageText of Object.values(tailValidation.errors)) {
      issues.push({ field: 'carousel', message: messageText });
    }
  }

  return issues;
}

export function getBrandMessageValidationIssues(value) {
  const message = normalizeBrandMessageDraftValue(value);
  const couponValidation = getBrandCouponValidation(message.coupon, { chatBubbleType: message.chatBubbleType });
  const isCarouselType = brandCarouselTypes.has(message.chatBubbleType);
  const issues = [];

  if (!message.senderProfileId) {
    issues.push({ field: 'senderProfileId', message: '브랜드 발신 채널을 선택해 주세요.' });
  }

  if (!message.recipient.length) {
    issues.push({ field: 'recipient', message: '전화번호를 직접 입력해 수신자를 추가해 주세요.' });
  }

  if (message.mode !== 'template') {
    issues.push(...getBrandMessageTypeValidationIssues(message));
  }

  if (message.fallbackEnabled && !message.fallbackSenderNumber) {
    issues.push({ field: 'fallbackSenderNumber', message: 'SMS 대체 발송용 발신번호를 선택해 주세요.' });
  }

  if (!isCarouselType && !couponValidation.isValid) {
    issues.push({
      field: 'coupon',
      message: getBrandScopedErrorMessage('쿠폰', couponValidation.errors),
    });
  }

  if (!isCarouselType) {
    const topLevelButtonMaxCount = getBrandTopLevelButtonLimit(message.chatBubbleType, Boolean(message.coupon));

    if (message.chatBubbleType === 'COMMERCE' && message.buttons.length < 1) {
      issues.push({
        field: 'buttons',
        message: '커머스 메시지는 버튼을 1개 이상 추가해 주세요.',
      });
    }

    if (message.buttons.length > topLevelButtonMaxCount) {
      issues.push({
        field: 'buttons',
        message: `${brandChatBubbleTypeLabels[message.chatBubbleType]} 버튼은 최대 ${topLevelButtonMaxCount}개까지 추가할 수 있습니다.`,
      });
    }

    const addChannelPositionError = getBrandAddChannelButtonPositionError(
      message.buttons,
      message.chatBubbleType,
      brandChatBubbleTypeLabels[message.chatBubbleType] ?? '브랜드 메시지'
    );

    if (addChannelPositionError) {
      issues.push({ field: 'buttons', message: addChannelPositionError });
    }

    message.buttons.forEach((button, index) => {
      const buttonValidation = getBrandButtonValidation(button, {
        maxNameLength: getBrandTopLevelButtonNameMaxLength(message.chatBubbleType),
      });

      if (!buttonValidation.isValid) {
        issues.push({
          field: 'buttons',
          message: getBrandScopedErrorMessage(`${index + 1}번 버튼`, buttonValidation.errors),
        });
      }
    });
  }

  return issues;
}

export function getBrandMessageTemplateRegistrationIssues(value) {
  const message = normalizeBrandMessageDraftValue(value);
  const couponValidation = getBrandCouponValidation(message.coupon, { chatBubbleType: message.chatBubbleType });
  const isCarouselType = brandCarouselTypes.has(message.chatBubbleType);
  const issues = [];

  if (!message.senderProfileId) {
    issues.push({ field: 'senderProfileId', message: '브랜드 발신 채널을 선택해 주세요.' });
  }

  if (message.mode === 'template' || message.templateCode) {
    issues.push({
      field: 'mode',
      message: '템플릿 등록은 프리스타일 작성 중인 브랜드 메시지만 사용할 수 있습니다.',
    });
    return issues;
  }

  issues.push(...getBrandMessageTypeValidationIssues(message));

  if (!isCarouselType && !couponValidation.isValid) {
    issues.push({
      field: 'coupon',
      message: getBrandScopedErrorMessage('쿠폰', couponValidation.errors),
    });
  }

  if (!isCarouselType) {
    const topLevelButtonMaxCount = getBrandTopLevelButtonLimit(message.chatBubbleType, Boolean(message.coupon));

    if (message.chatBubbleType === 'COMMERCE' && message.buttons.length < 1) {
      issues.push({
        field: 'buttons',
        message: '커머스 메시지는 버튼을 1개 이상 추가해 주세요.',
      });
    }

    if (message.buttons.length > topLevelButtonMaxCount) {
      issues.push({
        field: 'buttons',
        message: `${brandChatBubbleTypeLabels[message.chatBubbleType]} 버튼은 최대 ${topLevelButtonMaxCount}개까지 추가할 수 있습니다.`,
      });
    }

    const addChannelPositionError = getBrandAddChannelButtonPositionError(
      message.buttons,
      message.chatBubbleType,
      brandChatBubbleTypeLabels[message.chatBubbleType] ?? '브랜드 메시지'
    );

    if (addChannelPositionError) {
      issues.push({ field: 'buttons', message: addChannelPositionError });
    }

    message.buttons.forEach((button, index) => {
      const buttonValidation = getBrandButtonValidation(button, {
        maxNameLength: getBrandTopLevelButtonNameMaxLength(message.chatBubbleType),
      });

      if (!buttonValidation.isValid) {
        issues.push({
          field: 'buttons',
          message: getBrandScopedErrorMessage(`${index + 1}번 버튼`, buttonValidation.errors),
        });
      }
    });
  }

  return issues;
}

function isBrandButtonRowValidationIssue(issue) {
  return issue.field === 'buttons' && /^\d+번 버튼(?::| )/.test(issue.message);
}

function isBrandCarouselItemRowValidationIssue(issue) {
  return issue.field === 'carousel' && /^캐러셀 (피드|커머스) \d+번 /.test(issue.message);
}

function isBrandWideItemRowValidationIssue(issue) {
  return issue.field === 'item' && /^와이드 리스트 \d+번 /.test(issue.message);
}

function isBrandWideListCountValidationIssue(issue) {
  return issue.field === 'item' && issue.message === '와이드 리스트는 item.list 항목이 3~4개여야 합니다.';
}

function isBrandCarouselPanelValidationIssue(issue) {
  return issue.field === 'carousel' && (
    issue.message === '캐러셀 피드는 carousel.list 항목이 2~6개여야 합니다.'
    || issue.message === '인트로를 사용하면 캐러셀 커머스 상품은 1~5개여야 합니다.'
    || issue.message === '인트로를 사용하지 않으면 캐러셀 커머스 상품은 2~6개여야 합니다.'
    || issue.message === '캐러셀 전체에서 채널 추가(AC) 버튼은 1개만 사용할 수 있습니다.'
  );
}

function isBrandCarouselTailValidationIssue(issue) {
  return issue.field === 'carousel' && issue.message === '더보기 모바일 링크를 입력해 주세요.';
}

function isBrandButtonEditorValidationIssue(issue) {
  return issue.field === 'buttons' && (
    issue.message === '커머스 메시지는 버튼을 1개 이상 추가해 주세요.'
    || / 버튼은 최대 \d+개까지 추가할 수 있습니다\.$/.test(issue.message)
    || / 채널 추가\(AC\) 버튼은 (첫 번째|마지막) 버튼이어야 합니다\.$/.test(issue.message)
  );
}

export function getBrandCouponTitle(coupon) {
  const normalizedCoupon = normalizeBrandCoupon(coupon);

  if (!normalizedCoupon) {
    return '';
  }

  return normalizedCoupon.title;
}

const brandTemplateStartContextFields = [
  'senderProfileId',
  'recipient',
  'scheduledAt',
  'fallbackEnabled',
  'fallbackSenderNumber',
  'fallbackAdvertisementEnabled',
  'fallbackUnsubscribeNumber',
  'pushAlarm',
  'targeting',
  'statsId',
  'resellerCode',
  'unsubscribeNo',
  'unsubscribeAuthNo',
];

const brandTemplateVariablePattern = /#\{([^}]+)\}/g;

export function createBrandMessageDraftFromTemplate(template, currentMessage = {}) {
  const source = normalizeBrandTemplatePlainObject(template);
  const currentDraft = normalizeBrandMessageDraftValue(currentMessage);
  const unresolvedVariableKeys = new Set();
  const unsupportedFields = getBrandTemplateUnsupportedFields(source);
  const variableContext = {
    currentTemplateParameter: currentDraft.templateParameter,
    fallbackValues: getBrandTemplateVariableFallbackValues(source.variables),
    templateParameter: normalizeObject(source.templateParameter),
    unresolvedVariableKeys,
  };
  const materializedSource = materializeBrandTemplateValue(source, variableContext);
  const chatBubbleType = normalizeBrandDraftChatBubbleType(materializedSource.chatBubbleType ?? materializedSource.messageType);
  const bodyReset = {
    additionalContent: '',
    buttons: [],
    carousel: null,
    chatBubbleType,
    commerce: null,
    content: '',
    coupon: null,
    header: '',
    image: null,
    imageFile: null,
    item: null,
    video: null,
  };
  const draftPatch = {
    ...getBrandTemplateStartContext(currentDraft),
    ...bodyReset,
    ...getBrandTemplateDraftBodyPatch(materializedSource, chatBubbleType),
    adult: source.adult === undefined ? currentDraft.adult : Boolean(source.adult),
    imageParameters: {},
    mode: 'freestyle',
    templateCode: '',
    templateParameter: {},
    videoParameter: null,
  };
  const draft = normalizeBrandMessageDraftValue(draftPatch);

  return {
    draft,
    unresolvedVariables: [...unresolvedVariableKeys],
    unsupportedFields,
  };
}

function normalizeBrandTemplatePlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function getBrandTemplateStartContext(currentDraft) {
  return Object.fromEntries(
    brandTemplateStartContextFields.map((field) => [field, currentDraft[field]])
  );
}

function getBrandTemplateUnsupportedFields(template) {
  return ['imageParameters', 'videoParameter']
    .filter((field) => template[field] !== undefined && template[field] !== null);
}

function getBrandTemplateVariableFallbackValues(variables) {
  if (!Array.isArray(variables)) {
    return {};
  }

  return Object.fromEntries(
    variables
      .map((variable) => {
        const key = normalizeText(variable?.key ?? variable?.name ?? variable?.variableName).trim();
        const value = variable?.fallbackValue ?? variable?.defaultValue ?? variable?.sampleValue ?? variable?.value;

        return [key, value];
      })
      .filter(([key, value]) => key && !isBlankText(value))
      .map(([key, value]) => [key, normalizeText(value)])
  );
}

function getBrandTemplateVariableMaterializedValue(key, context) {
  const currentValue = getBrandTemplateParameterValue(context.currentTemplateParameter, key);

  if (!isBlankText(currentValue)) {
    return currentValue;
  }

  const templateValue = getBrandTemplateParameterValue(context.templateParameter, key);

  if (!isBlankText(templateValue)) {
    return templateValue;
  }

  const fallbackValue = context.fallbackValues[key];

  if (!isBlankText(fallbackValue)) {
    return fallbackValue;
  }

  return null;
}

function getBrandTemplateParameterValue(parameters, key) {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    return '';
  }

  if (!Object.prototype.hasOwnProperty.call(parameters, key)) {
    return '';
  }

  return normalizeText(getMessageTemplateVariableValue(parameters, key));
}

function materializeBrandTemplateString(value, context) {
  return value.replace(brandTemplateVariablePattern, (token, rawKey) => {
    const key = normalizeText(rawKey).trim();
    const materializedValue = getBrandTemplateVariableMaterializedValue(key, context);

    if (materializedValue === null) {
      context.unresolvedVariableKeys.add(key);

      return token;
    }

    return materializedValue;
  });
}

function materializeBrandTemplateValue(value, context) {
  if (typeof value === 'string') {
    return materializeBrandTemplateString(value, context);
  }

  if (Array.isArray(value)) {
    return value.map((item) => materializeBrandTemplateValue(item, context));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, materializeBrandTemplateValue(item, context)])
    );
  }

  return value;
}

function getBrandTemplateContent(source) {
  return normalizeText(source.content ?? source.body ?? source.description);
}

function getBrandTemplateItemSource(source) {
  if (source.item && typeof source.item === 'object' && !Array.isArray(source.item)) {
    return source.item;
  }

  return {
    list: [source.items, source.listItems, source.itemList].find(Array.isArray) ?? [],
  };
}

function getBrandTemplateCarouselSource(source) {
  if (source.carousel && typeof source.carousel === 'object' && !Array.isArray(source.carousel)) {
    return source.carousel;
  }

  return {
    list: [source.carouselItems, source.items, source.listItems, source.list].find(Array.isArray) ?? [],
  };
}

function normalizeBrandTemplateButtons(buttons, idPrefix) {
  if (!Array.isArray(buttons)) {
    return [];
  }

  return withBrandButtonOrdering(buttons.map((button, index) => {
    const source = normalizeBrandTemplatePlainObject(button);

    return normalizeBrandButtonDraft({
      ...source,
      id: source.id ?? `${idPrefix}-${index + 1}`,
    });
  }));
}

function normalizeBrandTemplateCarousel(carousel) {
  const sourceCarousel = normalizeBrandTemplatePlainObject(carousel);
  const normalizedCarousel = normalizeBrandCarousel(sourceCarousel);

  if (!normalizedCarousel) {
    return null;
  }

  const sourceList = getBrandListFromObject(sourceCarousel);

  return {
    ...normalizedCarousel,
    list: getBrandCarouselList(normalizedCarousel).map((item, index) => ({
      ...item,
      buttons: normalizeBrandTemplateButtons(
        sourceList[index]?.buttons,
        `template-carousel-${index + 1}-button`
      ),
    })),
  };
}

function getBrandTemplateCommercePatch(source) {
  const sourceCommerce = normalizeBrandTemplatePlainObject(source.commerce);
  const sourceImage = normalizeBrandImage(source);
  const commerceImage = normalizeBrandImage(sourceCommerce) ?? sourceImage;
  const additionalContent = normalizeText(
    source.additionalContent
      ?? sourceCommerce.additionalContent
      ?? source.content
      ?? source.body
  );
  const commerce = normalizeBrandCommerce({
    ...sourceCommerce,
    additionalContent,
    ...(commerceImage ? {
      image: sourceCommerce.image ?? commerceImage,
      imageName: sourceCommerce.imageName ?? commerceImage.imageName,
      imageUrl: sourceCommerce.imageUrl ?? commerceImage.imageUrl,
    } : {}),
  });

  return {
    additionalContent,
    commerce,
    image: commerceImage,
  };
}

function getBrandTemplateDraftBodyPatch(source, chatBubbleType) {
  const topLevelButtons = normalizeBrandTemplateButtons(source.buttons, 'template-button');
  const coupon = normalizeBrandCoupon(source.coupon);
  const content = getBrandTemplateContent(source);

  if (chatBubbleType === 'IMAGE' || chatBubbleType === 'WIDE') {
    return {
      buttons: topLevelButtons,
      content,
      coupon,
      image: normalizeBrandImage(source),
    };
  }

  if (chatBubbleType === 'WIDE_ITEM_LIST') {
    return {
      buttons: topLevelButtons,
      coupon,
      header: normalizeText(source.header),
      item: normalizeBrandItem(getBrandTemplateItemSource(source)),
    };
  }

  if (chatBubbleType === 'PREMIUM_VIDEO') {
    return {
      buttons: topLevelButtons,
      content,
      coupon,
      header: normalizeText(source.header),
      video: normalizeBrandVideo(source.video),
    };
  }

  if (chatBubbleType === 'COMMERCE') {
    return {
      buttons: topLevelButtons,
      coupon,
      ...getBrandTemplateCommercePatch(source),
    };
  }

  if (chatBubbleType === 'CAROUSEL_FEED' || chatBubbleType === 'CAROUSEL_COMMERCE') {
    return {
      buttons: [],
      carousel: normalizeBrandTemplateCarousel(getBrandTemplateCarouselSource(source)),
      coupon: null,
    };
  }

  return {
    buttons: topLevelButtons,
    content,
    coupon,
  };
}

export function normalizeBrandMessageDraftValue(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const templateCode = normalizeText(source.templateCode ?? source.templateId);

  return {
    adult: Boolean(source.adult ?? defaultBrandMessageSendFormValue.adult),
    additionalContent: normalizeText(source.additionalContent),
    buttons: normalizeBrandButtons(source.buttons),
    carousel: normalizeBrandCarousel(source.carousel ?? (source.carouselItems ? { list: source.carouselItems } : null)),
    chatBubbleType: normalizeBrandDraftChatBubbleType(source.chatBubbleType ?? source.messageType),
    commerce: normalizeBrandCommerce(source.commerce),
    content: normalizeText(source.content),
    coupon: normalizeBrandCoupon(source.coupon),
    fallbackAdvertisementEnabled: Boolean(source.fallbackAdvertisementEnabled),
    fallbackEnabled: Boolean(source.fallbackEnabled),
    fallbackSenderNumber: normalizeText(source.fallbackSenderNumber ?? defaultBrandMessageSendFormValue.fallbackSenderNumber),
    fallbackUnsubscribeNumber: normalizeText(source.fallbackUnsubscribeNumber),
    header: normalizeText(source.header),
    image: normalizeBrandImage(source),
    imageFile: source.imageFile ?? null,
    imageParameters: normalizeObject(source.imageParameters),
    item: normalizeBrandItem(source.item ?? (source.items ? { list: source.items } : null)),
    mode: normalizeBrandDraftMode(source.mode, templateCode),
    pushAlarm: source.pushAlarm !== false,
    recipient: normalizeRecipientValue(source.recipient),
    resellerCode: normalizeText(source.resellerCode),
    scheduledAt: normalizeText(source.scheduledAt),
    senderProfileId: normalizeText(source.senderProfileId),
    statsId: normalizeText(source.statsId),
    targeting: normalizeText(source.targeting),
    templateCode,
    templateParameter: normalizeObject(source.templateParameter ?? source.variables),
    unsubscribeAuthNo: normalizeText(source.unsubscribeAuthNo),
    unsubscribeNo: normalizeText(source.unsubscribeNo),
    video: normalizeBrandVideo(source.video),
    videoParameter: normalizeNullableObject(source.videoParameter),
  };
}

function normalizeText(value) {
  return String(value ?? '');
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function normalizeNullableObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : null;
}

function normalizeBrandItem(value) {
  const item = normalizeNullableObject(value);

  if (!item) {
    return null;
  }

  return {
    ...item,
    list: getBrandWideItemList(item),
  };
}

function normalizeBrandCarouselTail(value) {
  const tail = normalizeNullableObject(value);

  if (!tail) {
    return null;
  }

  const {
    linkMobile: _linkMobile,
    mobileLink: _mobileLink,
    mobileWebLink: _mobileWebLink,
    ...rest
  } = tail;
  const linkMo = normalizeText(tail.linkMo ?? tail.linkMobile ?? tail.mobileLink ?? tail.mobileWebLink);
  const nextTail = {
    ...rest,
    isMoreButton: tail.isMoreButton === undefined ? hasBrandCarouselTailLink(tail) : Boolean(tail.isMoreButton),
    linkMo,
    linkPc: normalizeText(tail.linkPc),
    schemeAndroid: normalizeText(tail.schemeAndroid),
    schemeIos: normalizeText(tail.schemeIos),
  };

  return nextTail;
}

function normalizeBrandCarousel(value) {
  const carousel = normalizeNullableObject(value);

  if (!carousel) {
    return null;
  }

  const head = normalizeNullableObject(carousel.head);
  const isUseIntro = carousel.isUseIntro === undefined
    ? hasBrandCarouselIntroData(head)
    : Boolean(carousel.isUseIntro);
  const tail = normalizeBrandCarouselTail(carousel.tail ?? carousel.moreButton);

  return {
    ...carousel,
    head: isUseIntro ? { ...createBrandCarouselIntro(), ...(head ?? {}) } : null,
    isUseIntro,
    list: getBrandCarouselList(carousel),
    moreButton: tail,
    tail,
  };
}

function normalizeBrandCommerce(value) {
  const commerce = normalizeNullableObject(value);

  if (!commerce) {
    return null;
  }

  return {
    ...commerce,
    discountType: getBrandCommerceDiscountType(commerce.discountType),
    regularPrice: normalizeText(commerce.regularPrice ?? commerce.price),
    title: normalizeText(commerce.title),
  };
}

function normalizeBrandVideo(value) {
  const video = normalizeNullableObject(value);

  if (!video) {
    return null;
  }

  return {
    ...video,
    videoUrl: normalizeText(video.videoUrl ?? video.url),
  };
}

function normalizeBrandButtons(buttons) {
  const sourceButtons = Array.isArray(buttons)
    ? buttons
    : defaultBrandMessageSendFormValue.buttons;

  return sourceButtons.map(normalizeBrandButtonDraft);
}

function normalizeBrandButtonDraft(button) {
  const normalizedButton = button && typeof button === 'object' && !Array.isArray(button) ? { ...button } : {};

  if (normalizedButton.bizFormKey && !normalizedButton.bizFormId) {
    normalizedButton.bizFormId = normalizedButton.bizFormKey;
  }

  if (normalizedButton.type === 'AC') {
    return {
      ...normalizedButton,
      name: brandAddChannelButtonName,
    };
  }

  return normalizedButton;
}

function normalizeBrandImage(source) {
  const image = normalizeNullableObject(source.image);
  const imageUrl = normalizeText(image?.imageUrl ?? source.imageUrl);
  const imageName = normalizeText(image?.imageName ?? source.imageName);

  if (!image && !imageUrl && !imageName) {
    return null;
  }

  return {
    ...(image ?? {}),
    ...(imageName ? { imageName } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

function normalizeBrandDraftChatBubbleType(value) {
  const chatBubbleType = normalizeText(value || defaultBrandMessageSendFormValue.chatBubbleType).trim().toUpperCase();

  return brandChatBubbleTypeValues.has(chatBubbleType) ? chatBubbleType : defaultBrandMessageSendFormValue.chatBubbleType;
}

function normalizeBrandDraftMode(value, templateCode) {
  const mode = normalizeText(value).trim().toLowerCase();

  if (mode === 'freestyle' || mode === 'template') {
    return mode;
  }

  return templateCode ? 'template' : 'freestyle';
}

function normalizeRecipientValue(value) {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

function getAvailableBrandTemplates(templates, senderProfileId) {
  return templates.filter((template) => !template.senderProfileId || template.senderProfileId === senderProfileId);
}

function createBrandButtonId() {
  return `brand-button-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatBrandImageTagLabel(fileName) {
  const label = fileName || '업로드 이미지';
  const characters = Array.from(label);

  if (characters.length <= 16) {
    return label;
  }

  return `${characters.slice(0, 16).join('')}...`;
}

function getBrandChatBubbleTypeConfig(chatBubbleType) {
  return brandChatBubbleTypeConfig[chatBubbleType] ?? brandChatBubbleTypeConfig.TEXT;
}

function getBrandButtonMaxCount(chatBubbleType) {
  return getBrandChatBubbleTypeConfig(chatBubbleType).buttonMaxCount;
}

function getBrandTopLevelButtonNameMaxLength(chatBubbleType) {
  return brandShortButtonNameTypes.has(chatBubbleType) ? 8 : 14;
}

function getBrandTopLevelButtonLimit(chatBubbleType, hasCoupon) {
  if (chatBubbleType === 'PREMIUM_VIDEO') {
    return 1;
  }

  if (chatBubbleType === 'WIDE' || chatBubbleType === 'WIDE_ITEM_LIST' || chatBubbleType === 'COMMERCE') {
    return 2;
  }

  if ((chatBubbleType === 'TEXT' || chatBubbleType === 'IMAGE') && hasCoupon) {
    return 4;
  }

  return getBrandButtonMaxCount(chatBubbleType);
}

function shouldShowBrandContentField(chatBubbleType) {
  return getBrandChatBubbleTypeConfig(chatBubbleType).contentMode !== 'hidden';
}

function withBrandButtonOrdering(buttons) {
  return buttons.map((button, index) => ({
    ...button,
    ordering: index + 1,
  }));
}

function getBrandButtonTypePatch(type) {
  const clearLinkProps = {
    bizFormId: undefined,
    bizFormKey: undefined,
    chatEvent: undefined,
    chatExtra: undefined,
    linkMo: undefined,
    linkPc: undefined,
    schemeAndroid: undefined,
    schemeIos: undefined,
  };

  if (type === 'WL') {
    return {
      ...clearLinkProps,
      type,
    };
  }

  if (type === 'AL') {
    return {
      ...clearLinkProps,
      type,
    };
  }

  if (type === 'BT') {
    return {
      ...clearLinkProps,
      chatEvent: '',
      chatExtra: '',
      type,
    };
  }

  if (type === 'BF') {
    return {
      ...clearLinkProps,
      bizFormId: '',
      type,
    };
  }

  if (type === 'AC') {
    return {
      ...clearLinkProps,
      name: brandAddChannelButtonName,
      type,
    };
  }

  return {
    ...clearLinkProps,
    type,
  };
}

function createBrandListItem(kind, index) {
  const label = index + 1;

  if (kind === 'commerce') {
    return {
      buttons: [],
      coupon: null,
      discountPrice: '',
      discountType: 'rate',
      image: { imageUrl: '' },
      regularPrice: '',
      title: `상품 ${label}`,
    };
  }

  if (kind === 'wide') {
    return {
      content: '',
      image: { imageUrl: '' },
      linkMo: '',
      linkPc: '',
      schemeAndroid: '',
      schemeIos: '',
      title: `리스트 ${label}`,
    };
  }

  if (kind === 'feed') {
    return {
      buttons: [{
        id: createBrandButtonId(),
        linkMo: '',
        linkPc: '',
        name: '자세히',
        type: 'WL',
      }],
      content: '',
      coupon: null,
      image: { imageUrl: '' },
      title: `카드 ${label}`,
    };
  }

  return {
    buttons: [],
    content: '',
    coupon: null,
    image: { imageUrl: '' },
    title: `카드 ${label}`,
  };
}

function createBrandCarouselIntro() {
  return {
    content: '',
    header: '',
    image: { imageUrl: '' },
    linkMo: '',
    linkPc: '',
    schemeAndroid: '',
    schemeIos: '',
  };
}

function createBrandListItems(kind, count) {
  return Array.from({ length: count }, (_, index) => createBrandListItem(kind, index));
}

function getBrandTypeSeedPatch(message, chatBubbleType) {
  const patch = { chatBubbleType };

  if (!shouldShowBrandContentField(chatBubbleType)) {
    patch.content = '';
  }

  if (chatBubbleType === 'WIDE_ITEM_LIST' && getBrandWideItemList(message.item).length === 0) {
    patch.item = {
      ...(message.item ?? {}),
      list: createBrandListItems('wide', 3),
    };
  }

  if (chatBubbleType === 'PREMIUM_VIDEO' && !message.video) {
    patch.video = { videoUrl: '' };
  }

  if (chatBubbleType === 'COMMERCE' && !message.commerce) {
    patch.commerce = {
      discountPrice: '',
      discountType: 'rate',
      regularPrice: '',
      title: '',
    };
  }

  if (chatBubbleType === 'CAROUSEL_FEED' && getBrandCarouselList(message.carousel).length === 0) {
    patch.carousel = {
      ...(message.carousel ?? {}),
      head: null,
      isUseIntro: false,
      list: createBrandListItems('feed', 2),
    };
  }

  if (chatBubbleType === 'CAROUSEL_COMMERCE' && getBrandCarouselList(message.carousel).length === 0) {
    patch.carousel = {
      ...(message.carousel ?? {}),
      isUseIntro: Boolean(message.carousel?.isUseIntro),
      list: createBrandListItems('commerce', 2),
    };
  }

  return patch;
}

function isSelectedBrandTemplate(template, templateCode) {
  return Boolean(templateCode) && [
    template?.templateCode,
    template?.templateId,
    template?.value,
    template?.id,
  ].some((value) => value === templateCode);
}

function getTemplateDisplayName(template) {
  return String(
    template?.templateName
      ?? template?.name
      ?? template?.label
      ?? getBrandTemplateCode(template)
      ?? '선택한 템플릿'
  );
}

function getBrandTemplateCode(template) {
  return String(template?.templateCode ?? template?.templateId ?? template?.value ?? template?.id ?? '').trim();
}

function BrandMessageRequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="brand-message-coupon-required-badge">*</span>
      <span className="visually-hidden">필수</span>
    </>
  );
}

function getBrandValidationWarning(issue, id) {
  return issue ? [{ id, message: issue.message, severity: 'error' }] : [];
}

function getBrandValidationWarnings(issues, idPrefix) {
  return issues.map((issue, index) => ({
    id: `${idPrefix}-${index}`,
    message: issue.message,
    severity: 'error',
  }));
}

function getBrandInspectorErrorMessage(message) {
  return normalizeText(message)
    .replace(/^(와이드 리스트|캐러셀 피드|캐러셀 커머스) \d+번 /, '')
    .replace(/^커머스 인트로 /, '');
}

function getBrandInspectorErrorMessages(errors) {
  return Object.fromEntries(
    Object.entries(errors).map(([key, message]) => [key, getBrandInspectorErrorMessage(message)])
  );
}

function getBrandValidationTooltipMessage(errors) {
  return Object.values(errors)
    .flatMap((message) => normalizeText(message).split('\n'))
    .map(getBrandInspectorErrorMessage)
    .filter(Boolean)
    .join('\n');
}

function BrandMessageValidationIssueIcon(props) {
  return (
    <svg fill="none" height="20" viewBox="0 0 24 24" width="20" {...props}>
      <path
        d="M12 19.5C16.1421 19.5 19.5 16.1421 19.5 12C19.5 7.85786 16.1421 4.5 12 4.5C7.85786 4.5 4.5 7.85786 4.5 12C4.5 16.1421 7.85786 19.5 12 19.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M14.5 9.5L9.5 14.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M9.5 9.5L14.5 14.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function BrandMessageValidationIssueTooltip({ className = '', message }) {
  if (!message) {
    return null;
  }

  return (
    <Tooltip
      content={message}
      contentClassName="brand-message-validation-tooltip-content"
      maxWidth="20rem"
      side="left"
      type="description"
    >
      <span
        aria-label={message}
        className={['brand-message-validation-tooltip-trigger', className].filter(Boolean).join(' ')}
        role="img"
        tabIndex={0}
      >
        <BrandMessageValidationIssueIcon aria-hidden="true" />
      </span>
    </Tooltip>
  );
}

function BrandMessageNestedImageField({
  cropPreset = 'BRAND_IMAGE',
  item,
  label = '이미지 업로드',
  onChange,
  showImageLink = true,
  validationIssue = null,
}) {
  const fileInputRef = useRef(null);
  const [imageCropFile, setImageCropFile] = useState(null);
  const image = item.image && typeof item.image === 'object' && !Array.isArray(item.image) ? item.image : {};
  const imageUrl = image.imageUrl ?? item.imageUrl ?? '';
  const imageName = image.imageName ?? item.imageName ?? '';
  const imageLink = item.imageLink ?? image.imageLink ?? '';

  function readNestedImageFile(file) {
    const reader = new FileReader();

    reader.onload = () => {
      onChange({
        image: {
          ...image,
          imageFile: file,
          imageName: file.name,
          imageUrl: reader.result,
        },
        imageName: file.name,
        imageUrl: reader.result,
      });
    };

    reader.readAsDataURL(file);
  }

  function handleNestedImageChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      setImageCropFile(file);
    }
  }

  function handleNestedImageCropOpenChange(open) {
    if (!open) {
      setImageCropFile(null);
    }
  }

  function handleNestedImageCropApply({ file }) {
    readNestedImageFile(file);
  }

  function clearNestedImage() {
    onChange({ image: null, imageName: '', imageUrl: '' });
  }

  return (
    <>
      <div className="brand-message-type-field">
        <EmailSendFormLabel
          className={validationIssue ? 'brand-message-local-validation-label is-invalid' : 'brand-message-local-validation-label'}
          warnings={getBrandValidationWarning(validationIssue, 'brand-message-nested-image-required')}
        >
          {label}
        </EmailSendFormLabel>
        <div className="brand-message-image-field">
          <input
            accept="image/png,image/jpeg"
            className="brand-message-file-input"
            onChange={handleNestedImageChange}
            ref={fileInputRef}
            type="file"
          />
          {imageUrl ? (
            <span className="sms-send-form-upload-tag brand-message-image-upload-tag">
              <span
                aria-hidden="true"
                className="sms-send-form-upload-preview"
                style={{ backgroundImage: `url(${imageUrl})` }}
              />
              <span className="sms-send-form-upload-file">
                <span title={imageName || '업로드 이미지'}>
                  {formatBrandImageTagLabel(imageName)}
                </span>
              </span>
              <button
                aria-label="이미지 제거"
                className="sms-send-form-upload-remove"
                onClick={clearNestedImage}
                type="button"
              >
                <X aria-hidden="true" size={14} />
              </button>
            </span>
          ) : (
            <EmailSendFormGhostButton onClick={() => fileInputRef.current?.click()}>
              <ImagePlus aria-hidden="true" size={14} />
              업로드
            </EmailSendFormGhostButton>
          )}
        </div>
      </div>
      {showImageLink ? (
        <label className="brand-message-type-field">
          <span className="message-template-variable-label">이미지 이동 링크</span>
          <EmailSendFormInput
            onChange={(event) => onChange?.({
              image: {
                ...image,
                imageLink: event.target.value,
              },
              imageLink: event.target.value,
            })}
            placeholder="https://example.com"
            type="url"
            value={imageLink}
          />
        </label>
      ) : null}
      <ImageCropDialog
        file={imageCropFile}
        onApply={handleNestedImageCropApply}
        onOpenChange={handleNestedImageCropOpenChange}
        open={Boolean(imageCropFile)}
        preset={cropPreset}
      />
    </>
  );
}

function BrandMessageVideoThumbnailField({ cropPreset = 'BRAND_WIDE_IMAGE', onChange, video }) {
  const fileInputRef = useRef(null);
  const [thumbnailCropFile, setThumbnailCropFile] = useState(null);
  const thumbnailUrl = video?.thumbnailUrl ?? '';
  const thumbnailName = video?.thumbnailImageName ?? video?.thumbnailName ?? '';
  const imageLink = video?.imageLink ?? '';

  function readThumbnailFile(file) {
    const reader = new FileReader();

    reader.onload = () => {
      onChange({
        thumbnailFile: file,
        thumbnailImageName: file.name,
        thumbnailUrl: reader.result,
      });
    };

    reader.readAsDataURL(file);
  }

  function handleThumbnailFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      setThumbnailCropFile(file);
    }
  }

  function handleThumbnailCropOpenChange(open) {
    if (!open) {
      setThumbnailCropFile(null);
    }
  }

  function handleThumbnailCropApply({ file }) {
    readThumbnailFile(file);
  }

  function clearThumbnail() {
    onChange({
      thumbnailFile: null,
      thumbnailImageName: '',
      thumbnailUrl: '',
    });
  }

  return (
    <>
      <label className="brand-message-type-field">
        <span className="message-template-variable-label">썸네일 이미지 업로드</span>
        <div className="brand-message-image-field">
          <input
            accept="image/png,image/jpeg"
            className="brand-message-file-input"
            onChange={handleThumbnailFileChange}
            ref={fileInputRef}
            type="file"
          />
          {thumbnailUrl ? (
            <span className="sms-send-form-upload-tag brand-message-image-upload-tag">
              <span
                aria-hidden="true"
                className="sms-send-form-upload-preview"
                style={{ backgroundImage: `url(${thumbnailUrl})` }}
              />
              <span className="sms-send-form-upload-file">
                <span title={thumbnailName || '업로드 이미지'}>
                  {formatBrandImageTagLabel(thumbnailName)}
                </span>
              </span>
              <button
                aria-label="썸네일 이미지 제거"
                className="sms-send-form-upload-remove"
                onClick={clearThumbnail}
                type="button"
              >
                <X aria-hidden="true" size={14} />
              </button>
            </span>
          ) : (
            <EmailSendFormGhostButton onClick={() => fileInputRef.current?.click()}>
              <ImagePlus aria-hidden="true" size={14} />
              업로드
            </EmailSendFormGhostButton>
          )}
        </div>
      </label>
      <label className="brand-message-type-field">
        <span className="message-template-variable-label">이미지 이동 링크</span>
        <EmailSendFormInput
          onChange={(event) => onChange({ imageLink: event.target.value })}
          placeholder="https://example.com"
          type="url"
          value={imageLink}
        />
      </label>
      <ImageCropDialog
        file={thumbnailCropFile}
        onApply={handleThumbnailCropApply}
        onOpenChange={handleThumbnailCropOpenChange}
        open={Boolean(thumbnailCropFile)}
        preset={cropPreset}
      />
    </>
  );
}

function getBrandWideItemSummary(item) {
  return hasBrandImageData(item) ? '이미지 설정됨' : '이미지 없음';
}

function getBrandFeedItemSummary(item) {
  return String(item.content ?? item.description ?? '').trim() || '본문 없음';
}

function getBrandCommerceItemSummary(item) {
  const regularPrice = String(item.regularPrice ?? item.price ?? '').trim();
  const discountPrice = String(item.discountPrice ?? '').trim();

  if (regularPrice && discountPrice) {
    return `정상가 ${regularPrice} · 할인가 ${discountPrice}`;
  }

  if (regularPrice) {
    return `정상가 ${regularPrice}`;
  }

  return '정상가 없음';
}

function getBrandCarouselIntroSummary(head) {
  return String(head.content ?? '').trim() || (hasBrandImageData(head) ? '이미지 설정됨' : '내용 없음');
}

function getBrandItemRenderKey(prefix, item, index) {
  const image = item.image && typeof item.image === 'object' && !Array.isArray(item.image) ? item.image : {};

  return [
    prefix,
    index,
    item.title,
    item.content ?? item.description,
    item.regularPrice ?? item.price,
    item.discountPrice,
    item.imageUrl ?? image.imageUrl,
    item.imageName ?? image.imageName,
  ].map((value) => String(value ?? '')).join('|');
}

function BrandMessageTypePanelLabel({ children, range = '' }) {
  return (
    <>
      <span className="brand-message-type-panel-label-main">{children}</span>
      {range ? <span className="brand-message-type-panel-label-meta">({range})</span> : null}
    </>
  );
}

function BrandMessageDiscountTypeField({
  className = 'brand-message-type-field',
  onChange,
  value,
}) {
  const selectedType = getBrandCommerceDiscountType(value);

  return (
    <div className={[className, 'is-wide'].filter(Boolean).join(' ')}>
      <span className="message-template-variable-label">
        할인 유형
        <BrandMessageRequiredMark />
      </span>
      <div aria-label="할인 유형" className="brand-message-discount-type-options" role="radiogroup">
        {brandCommerceDiscountTypeOptions.map((option) => (
          <button
            aria-checked={selectedType === option.value}
            className="brand-message-discount-type-option"
            key={option.value}
            onClick={() => onChange?.({
              discountFixed: '',
              discountRate: '',
              discountType: option.value,
            })}
            role="radio"
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BrandMessageTypeFields({
  activeItemEditor,
  carouselItems,
  carouselItemListRef,
  message,
  onCarouselIntroEdit,
  onCarouselIntroToggle,
  onCarouselItemAdd,
  onCarouselItemEdit,
  onCarouselItemRemove,
  onCarouselTailChange,
  onCarouselTailEdit,
  onCommerceChange,
  onHeaderChange,
  onVideoChange,
  onWideItemAdd,
  onWideItemEdit,
  onWideItemRemove,
  showValidation,
  validationIssues,
  wideItemListRef,
  wideItems,
}) {
  const visibleIssues = showValidation ? validationIssues : [];
  const fieldErrors = new Set(visibleIssues.map((issue) => issue.field));
  const visibleHeaderIssue = visibleIssues.find((issue) => issue.field === 'header') ?? null;
  const visibleVideoIssue = visibleIssues.find((issue) => issue.field === 'video') ?? null;
  const wideListCountIssues = visibleIssues.filter(isBrandWideListCountValidationIssue);
  const carouselPanelIssues = visibleIssues.filter(isBrandCarouselPanelValidationIssue);
  const carouselTailIssue = visibleIssues.find(isBrandCarouselTailValidationIssue) ?? null;
  const commerceValidation = getBrandCommerceValidation(message.commerce ?? {});
  const visibleCommerceErrors = showValidation && message.chatBubbleType === 'COMMERCE'
    ? commerceValidation.errors
    : {};
  const headerWarnings = getBrandValidationWarning(visibleHeaderIssue, 'brand-message-wide-header-required');
  const videoWarnings = getBrandValidationWarning(visibleVideoIssue, 'brand-message-video-url-required');
  const wideListWarnings = getBrandValidationWarnings(wideListCountIssues, 'brand-message-wide-list-count');
  const carouselPanelWarnings = getBrandValidationWarnings(carouselPanelIssues, 'brand-message-carousel-panel');

  if (message.chatBubbleType === 'WIDE_ITEM_LIST') {
    return (
      <div className="brand-message-type-panel brand-message-wide-list-panel">
        <EmailSendFormRow className="brand-message-wide-header-row">
          <EmailSendFormLabel
            className={[
              'brand-message-wide-header-label',
              'brand-message-local-validation-label',
              visibleHeaderIssue && 'is-invalid',
            ].filter(Boolean).join(' ')}
            htmlFor="brand-message-wide-header-input"
            warnings={headerWarnings}
          >
            리스트 제목
          </EmailSendFormLabel>
          <EmailSendFormInput
            aria-invalid={fieldErrors.has('header') ? 'true' : undefined}
            className={fieldErrors.has('header') ? 'is-invalid' : ''}
            id="brand-message-wide-header-input"
            maxLength={20}
            onChange={(event) => onHeaderChange(event.target.value)}
            placeholder="이번 주 추천"
            value={message.header}
          />
        </EmailSendFormRow>
        <div className="brand-message-type-panel-header">
          <div className="brand-message-type-panel-title">
            <EmailSendFormLabel
              className={[
                'brand-message-local-validation-label',
                wideListWarnings.length && 'is-invalid',
              ].filter(Boolean).join(' ')}
              warnings={wideListWarnings}
            >
              <BrandMessageTypePanelLabel range="최소 3개 · 최대 4개">
                와이드 리스트
              </BrandMessageTypePanelLabel>
            </EmailSendFormLabel>
          </div>
          <div className="brand-message-type-panel-actions">
            <EmailSendFormGhostButton
              aria-label="와이드 리스트 아이템 추가"
              disabled={wideItems.length >= 4}
              onClick={onWideItemAdd}
            >
              <Plus aria-hidden="true" size={14} />
              추가
            </EmailSendFormGhostButton>
          </div>
        </div>
        <div className="brand-message-type-list" ref={wideItemListRef}>
          {wideItems.map((item, index) => {
            const itemValidation = getBrandWideItemValidation(item, index);
            const isInvalid = showValidation && !itemValidation.isValid;
            const validationMessage = isInvalid ? getBrandValidationTooltipMessage(itemValidation.errors) : '';

            return (
              <div
                aria-invalid={isInvalid ? 'true' : undefined}
                className={[
                  'brand-message-type-row',
                  'brand-message-wide-item-row',
                  activeItemEditor?.kind === 'wide' && activeItemEditor.index === index && 'is-active',
                  isInvalid && 'is-invalid',
                ].filter(Boolean).join(' ')}
                key={getBrandItemRenderKey('wide-item', item, index)}
              >
                {isInvalid ? (
                  <BrandMessageValidationIssueTooltip
                    className="brand-message-type-row-validation-icon"
                    message={validationMessage}
                  />
                ) : null}
                <button
                  aria-label={`리스트 아이템 ${index + 1} 순서 변경`}
                  className="brand-message-type-row-drag-handle"
                  type="button"
                >
                  <GripVertical aria-hidden="true" size={16} />
                </button>
                <span className="brand-message-type-row-index">{index + 1}</span>
                <div className="brand-message-type-row-copy">
                  <strong>
                    <span className="brand-message-type-row-title-text">{item.title || `아이템 ${index + 1}`}</span>
                  </strong>
                  <span>{getBrandWideItemSummary(item)}</span>
                </div>
                <button
                  aria-label={`리스트 아이템 ${index + 1} 수정`}
                  className="brand-message-type-row-action"
                  onClick={() => onWideItemEdit(index)}
                  type="button"
                >
                  <Pencil aria-hidden="true" size={15} />
                </button>
                <button
                  aria-label={`리스트 아이템 ${index + 1} 삭제`}
                  className="brand-message-type-row-action"
                  onClick={() => onWideItemRemove(index)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={15} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (message.chatBubbleType === 'PREMIUM_VIDEO') {
    return (
      <div className="brand-message-type-panel">
        <div className="brand-message-type-panel-header">
          <div className="brand-message-type-panel-title">
            <EmailSendFormLabel>
              <BrandMessageTypePanelLabel>프리미엄 동영상</BrandMessageTypePanelLabel>
            </EmailSendFormLabel>
          </div>
        </div>
        <p className="brand-message-type-note">프리미엄 동영상은 현재 이용이 제한됩니다. 이용 가능 채널만 발송할 수 있습니다.</p>
        <label className="brand-message-type-field">
          <EmailSendFormLabel
            className={[
              'message-template-variable-label',
              'brand-message-local-validation-label',
              visibleVideoIssue && 'is-invalid',
            ].filter(Boolean).join(' ')}
            warnings={videoWarnings}
          >
            동영상 URL
            <BrandMessageRequiredMark />
          </EmailSendFormLabel>
          <EmailSendFormInput
            aria-invalid={fieldErrors.has('video') ? 'true' : undefined}
            className={fieldErrors.has('video') ? 'is-invalid' : ''}
            onChange={(event) => onVideoChange({ videoUrl: event.target.value })}
            placeholder="https://tv.kakao.com/..."
            type="url"
            value={message.video?.videoUrl ?? ''}
          />
        </label>
        <label className="brand-message-type-field">
          <span className="message-template-variable-label">영상 제목</span>
          <EmailSendFormInput
            onChange={(event) => onVideoChange({ title: event.target.value })}
            placeholder="시즌 필름"
            value={message.video?.title ?? ''}
          />
        </label>
        <BrandMessageVideoThumbnailField onChange={onVideoChange} video={message.video ?? {}} />
      </div>
    );
  }

  if (message.chatBubbleType === 'COMMERCE') {
    return (
      <div className="brand-message-type-panel">
        <div className="brand-message-type-panel-header">
          <div className="brand-message-type-panel-title">
            <EmailSendFormLabel>
              <BrandMessageTypePanelLabel>커머스</BrandMessageTypePanelLabel>
            </EmailSendFormLabel>
          </div>
        </div>
        <label className="brand-message-type-field">
          <EmailSendFormLabel
            className={[
              'message-template-variable-label',
              'brand-message-local-validation-label',
              visibleCommerceErrors.title && 'is-invalid',
            ].filter(Boolean).join(' ')}
            warnings={getBrandValidationWarning(
              visibleCommerceErrors.title
                ? { field: 'commerce', message: visibleCommerceErrors.title }
                : null,
              'brand-message-commerce-title-required'
            )}
          >
            상품명
            <BrandMessageRequiredMark />
          </EmailSendFormLabel>
          <EmailSendFormInput
            aria-invalid={visibleCommerceErrors.title ? 'true' : undefined}
            className={visibleCommerceErrors.title ? 'is-invalid' : ''}
            maxLength={30}
            onChange={(event) => onCommerceChange({ title: event.target.value })}
            placeholder="브랜드 시그니처 백"
            value={message.commerce?.title ?? ''}
          />
        </label>
        <label className="brand-message-type-field">
          <EmailSendFormLabel
            className={[
              'message-template-variable-label',
              'brand-message-local-validation-label',
              visibleCommerceErrors.additionalContent && 'is-invalid',
            ].filter(Boolean).join(' ')}
            warnings={getBrandValidationWarning(
              visibleCommerceErrors.additionalContent
                ? { field: 'commerce', message: visibleCommerceErrors.additionalContent }
                : null,
              'brand-message-commerce-additional-content-invalid'
            )}
          >
            추가 문구
          </EmailSendFormLabel>
          <EmailSendFormTextarea
            aria-invalid={visibleCommerceErrors.additionalContent ? 'true' : undefined}
            className={visibleCommerceErrors.additionalContent ? 'is-invalid' : ''}
            maxLength={34}
            onChange={(event) => onCommerceChange({ additionalContent: event.target.value })}
            placeholder="오늘만 적용되는 혜택"
            rows={2}
            value={message.commerce?.additionalContent ?? ''}
          />
        </label>
        <div className="brand-message-type-grid">
          <label className="brand-message-type-field">
            <EmailSendFormLabel
              className={[
                'message-template-variable-label',
                'brand-message-local-validation-label',
                visibleCommerceErrors.regularPrice && 'is-invalid',
              ].filter(Boolean).join(' ')}
              warnings={getBrandValidationWarning(
                visibleCommerceErrors.regularPrice
                  ? { field: 'commerce', message: visibleCommerceErrors.regularPrice }
                  : null,
                'brand-message-commerce-regular-price-required'
              )}
            >
              정상가
              <BrandMessageRequiredMark />
            </EmailSendFormLabel>
            <EmailSendFormInput
              aria-invalid={visibleCommerceErrors.regularPrice ? 'true' : undefined}
              className={visibleCommerceErrors.regularPrice ? 'is-invalid' : ''}
              inputMode="numeric"
              onChange={(event) => onCommerceChange({ regularPrice: event.target.value })}
              placeholder="59000"
              value={message.commerce?.regularPrice ?? ''}
            />
          </label>
          <label className="brand-message-type-field">
            <span className="message-template-variable-label">할인가</span>
            <EmailSendFormInput
              aria-invalid={Boolean(
                visibleCommerceErrors.discountPrice
                || visibleCommerceErrors['discount-lower-than-regular']
              ) || undefined}
              className={
                visibleCommerceErrors.discountPrice
                || visibleCommerceErrors['discount-lower-than-regular']
                  ? 'is-invalid'
                  : ''
              }
              inputMode="numeric"
              onChange={(event) => onCommerceChange({ discountPrice: event.target.value })}
              placeholder="39000"
              value={message.commerce?.discountPrice ?? ''}
            />
          </label>
          <BrandMessageDiscountTypeField
            onChange={onCommerceChange}
            value={message.commerce?.discountType}
          />
        </div>
        {visibleCommerceErrors.discountPrice
        || visibleCommerceErrors.discountRate
        || visibleCommerceErrors.discountFixed
        || visibleCommerceErrors.discountType
        || visibleCommerceErrors['discount-lower-than-regular'] ? (
          <p className="brand-message-coupon-note is-error">
            {visibleCommerceErrors.discountPrice
              || visibleCommerceErrors.discountRate
              || visibleCommerceErrors.discountFixed
              || visibleCommerceErrors.discountType
              || visibleCommerceErrors['discount-lower-than-regular']}
          </p>
        ) : null}
        <BrandMessageNestedImageField
          cropPreset="BRAND_IMAGE"
          item={message.commerce ?? {}}
          label="상품 이미지 업로드"
          onChange={onCommerceChange}
          validationIssue={
            visibleCommerceErrors.image
              ? { field: 'commerce', message: visibleCommerceErrors.image }
              : null
          }
        />
      </div>
    );
  }

  if (message.chatBubbleType === 'CAROUSEL_FEED' || message.chatBubbleType === 'CAROUSEL_COMMERCE') {
    const isCommerce = message.chatBubbleType === 'CAROUSEL_COMMERCE';
    const hasIntro = isCommerce && Boolean(message.carousel?.isUseIntro);
    const itemRangeText = isCommerce && hasIntro ? '최소 1개 · 최대 5개' : '최소 2개 · 최대 6개';
    const maxItemCount = isCommerce && hasIntro ? brandCarouselCommerceIntroMaximum : brandCarouselListMaximum;
    const carouselHead = message.carousel?.head ?? {};
    const introValidation = getBrandCarouselIntroValidation(carouselHead);
    const isIntroInvalid = hasIntro && showValidation && !introValidation.isValid;
    const carouselTail = normalizeBrandCarouselTail(message.carousel?.tail ?? message.carousel?.moreButton);
    const isMoreButtonEnabled = Boolean(carouselTail?.isMoreButton);
    const carouselTailValidation = getBrandCarouselTailValidation(carouselTail);
    const isTailInvalid = showValidation && !carouselTailValidation.isValid;

    return (
      <div className="brand-message-type-panel">
        <div className="brand-message-type-panel-header">
          <div className="brand-message-type-panel-title">
            <EmailSendFormLabel
              className={[
                'brand-message-local-validation-label',
                carouselPanelWarnings.length && 'is-invalid',
              ].filter(Boolean).join(' ')}
              warnings={carouselPanelWarnings}
            >
              <BrandMessageTypePanelLabel range={itemRangeText}>
                {isCommerce ? '캐러셀 커머스' : '캐러셀 피드'}
              </BrandMessageTypePanelLabel>
            </EmailSendFormLabel>
          </div>
          <div className="brand-message-type-panel-actions">
            <EmailSendFormGhostButton
              aria-label={isCommerce ? '캐러셀 커머스 상품 추가' : '캐러셀 피드 카드 추가'}
              disabled={carouselItems.length >= maxItemCount}
              onClick={onCarouselItemAdd}
            >
              <Plus aria-hidden="true" size={14} />
              추가
            </EmailSendFormGhostButton>
          </div>
        </div>
        {isCommerce ? (
          <p className="brand-message-type-note">
            인트로를 사용하면 상품 카드는 1~5개, 사용하지 않으면 2~6개입니다. 모든 이미지는 같은 비율로 준비해 주세요.
          </p>
        ) : null}
        {isCommerce ? (
          <div
            aria-invalid={isIntroInvalid ? 'true' : undefined}
            className={[
              'brand-message-type-row',
              'brand-message-type-intro-row',
              activeItemEditor?.kind === 'carouselIntro' && 'is-active',
              isIntroInvalid && 'is-invalid',
            ].filter(Boolean).join(' ')}
          >
            {isIntroInvalid ? (
              <BrandMessageValidationIssueTooltip
                className="brand-message-type-row-validation-icon"
                message={getBrandValidationTooltipMessage(introValidation.errors)}
              />
            ) : null}
            <span
              aria-hidden="true"
              className="brand-message-type-row-static-handle"
            >
              <GripVertical size={16} />
            </span>
            <span aria-hidden="true" className="brand-message-type-row-index">인</span>
            <div className="brand-message-type-row-copy">
              <strong>{carouselHead.header || '커머스 인트로'}</strong>
              <span>{hasIntro ? getBrandCarouselIntroSummary(carouselHead) : '사용 안 함'}</span>
            </div>
            <button
              aria-label="커머스 인트로 수정"
              className="brand-message-type-row-action"
              disabled={!hasIntro}
              onClick={onCarouselIntroEdit}
              type="button"
            >
              <Pencil aria-hidden="true" size={15} />
            </button>
            <button
              aria-checked={hasIntro}
              aria-label="캐러셀 인트로 사용"
              className="brand-message-toggle brand-message-type-row-toggle"
              data-brand-message-inspector-ignore="true"
              onClick={() => onCarouselIntroToggle(!hasIntro)}
              role="switch"
              type="button"
            >
              <span aria-hidden="true" className="brand-message-toggle-track">
                <span className="brand-message-toggle-thumb" />
              </span>
            </button>
          </div>
        ) : null}
        <div className="brand-message-type-list">
          <div className="brand-message-type-list" ref={carouselItemListRef}>
            {carouselItems.map((item, index) => {
              const itemValidation = getBrandCarouselItemValidation(item, index, isCommerce);
              const isInvalid = showValidation && !itemValidation.isValid;
              const itemKindLabel = isCommerce ? '상품' : '카드';
              const itemSummary = isCommerce ? getBrandCommerceItemSummary(item) : getBrandFeedItemSummary(item);
              const validationMessage = isInvalid ? getBrandValidationTooltipMessage(itemValidation.errors) : '';

              return (
                <div
                  aria-invalid={isInvalid ? 'true' : undefined}
                  className={[
                    'brand-message-type-row',
                    'brand-message-carousel-item-row',
                    activeItemEditor?.kind === 'carousel' && activeItemEditor.index === index && 'is-active',
                    isInvalid && 'is-invalid',
                  ].filter(Boolean).join(' ')}
                  key={getBrandItemRenderKey('carousel-item', item, index)}
                >
                  {isInvalid ? (
                    <BrandMessageValidationIssueTooltip
                      className="brand-message-type-row-validation-icon"
                      message={validationMessage}
                    />
                  ) : null}
                  <button
                    aria-label={`${itemKindLabel} ${index + 1} 순서 변경`}
                    className="brand-message-type-row-drag-handle"
                    type="button"
                  >
                    <GripVertical aria-hidden="true" size={16} />
                  </button>
                  <span className="brand-message-type-row-index">{index + 1}</span>
                  <div className="brand-message-type-row-copy">
                    <strong>
                      <span className="brand-message-type-row-title-text">{item.title || `${itemKindLabel} ${index + 1}`}</span>
                    </strong>
                    <span>{itemSummary}</span>
                  </div>
                  <button
                    aria-label={`${itemKindLabel} ${index + 1} 수정`}
                    className="brand-message-type-row-action"
                    onClick={() => onCarouselItemEdit(index)}
                    type="button"
                  >
                    <Pencil aria-hidden="true" size={15} />
                  </button>
                  <button
                    aria-label={`${itemKindLabel} ${index + 1} 삭제`}
                    className="brand-message-type-row-action"
                    onClick={() => onCarouselItemRemove(index)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={15} />
                  </button>
                </div>
              );
            })}
          </div>
          <div
            aria-invalid={isTailInvalid ? 'true' : undefined}
            className={[
              'brand-message-type-row',
              'brand-message-carousel-tail-row',
              activeItemEditor?.kind === 'carouselTail' && 'is-active',
              isTailInvalid && 'is-invalid',
            ].filter(Boolean).join(' ')}
          >
            {isTailInvalid ? (
              <BrandMessageValidationIssueTooltip
                className="brand-message-type-row-validation-icon"
                message={carouselTailIssue?.message ?? getBrandValidationTooltipMessage(carouselTailValidation.errors)}
              />
            ) : null}
            <span
              aria-hidden="true"
              className="brand-message-type-row-static-handle"
            >
              <GripVertical size={16} />
            </span>
            <span className="brand-message-type-row-index">더</span>
            <div className="brand-message-type-row-copy">
              <strong>
                <span className="brand-message-type-row-title-text">더보기</span>
              </strong>
              <span>{getBrandCarouselTailSummary(carouselTail)}</span>
            </div>
            <button
              aria-label="더보기 링크 수정"
              className="brand-message-type-row-action"
              onClick={onCarouselTailEdit}
              type="button"
            >
              <Pencil aria-hidden="true" size={15} />
            </button>
            <button
              aria-checked={isMoreButtonEnabled}
              aria-label="더보기 사용"
              className="brand-message-toggle brand-message-type-row-toggle"
              data-brand-message-inspector-ignore="true"
              onClick={() => onCarouselTailChange({ isMoreButton: !isMoreButtonEnabled })}
              role="switch"
              type="button"
            >
              <span aria-hidden="true" className="brand-message-toggle-track">
                <span className="brand-message-toggle-thumb" />
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function isBrandMessageInspectorDropdownTarget(target) {
  return target instanceof Element && Boolean(target.closest('.email-send-form-select-menu, .dropdown-menu-content'));
}

export const brandMessageInspectorIgnoreSelector = [
  '.brand-message-inspector-back-button',
  '.brand-message-type-row-action',
  '.brand-message-type-row-drag-handle',
  '.brand-message-button-action',
  '.brand-message-button-drag-handle',
  '.brand-message-button-editor-header button',
  '.brand-message-coupon-action',
  '.brand-message-coupon-editor-header button',
  '.image-crop-dialog',
  '[data-brand-message-inspector-ignore="true"]',
].join(', ');

function isBrandMessageInspectorIgnoredTarget(target, ignoreSelector) {
  if (typeof document !== 'undefined'
    && document.querySelector('.image-crop-dialog, [data-brand-message-inspector-ignore="true"]')) {
    return true;
  }

  if (!(target instanceof Element)) {
    return false;
  }

  if (ignoreSelector && target.closest(ignoreSelector)) {
    return true;
  }

  const dialogLayer = target.closest('.dialog-layer');

  return Boolean(dialogLayer?.querySelector('.image-crop-dialog, [data-brand-message-inspector-ignore="true"]'));
}

function BrandMessageInspectorPanel({
  backLabel,
  children,
  className = '',
  icon,
  onBack,
  onClose,
  panelRef,
  summary = '',
  testId,
  title,
  titleId,
}) {
  return (
    <aside
      aria-labelledby={titleId}
      className={[
        'message-template-variable-sidebar',
        'brand-message-inspector-sidebar',
        className,
      ].filter(Boolean).join(' ')}
      data-testid={testId}
      ref={panelRef}
    >
      <div className="message-template-variable-sidebar-inner">
        <div className="message-template-variable-sidebar-header brand-message-inspector-header">
          {onBack ? (
            <button
              aria-label={backLabel ?? `${title} 이전 화면으로 돌아가기`}
              className="brand-message-inspector-back-button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onBack();
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onBack();
              }}
              type="button"
            >
              <ChevronLeft aria-hidden="true" size={16} />
            </button>
          ) : (
            <span aria-hidden="true" className="message-template-variable-sidebar-icon brand-message-inspector-icon">
              {icon}
            </span>
          )}
          <span className="brand-message-inspector-heading">
            <strong id={titleId}>{title}</strong>
            {summary ? <span>{summary}</span> : null}
          </span>
          <button
            aria-label={`${title} 설정 닫기`}
            className="message-template-variable-sidebar-button"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>
        <div className="message-template-variable-sidebar-body brand-message-inspector-body">
          {children}
        </div>
      </div>
    </aside>
  );
}

function useBrandMessageInspectorOutsideClose(panelRef, enabled, onClose, ignoreSelector) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    function handlePointerDown(event) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (panelRef.current?.contains(target)) {
        return;
      }

      if (isBrandMessageInspectorIgnoredTarget(target, ignoreSelector)) {
        return;
      }

      if (isBrandMessageInspectorDropdownTarget(target)) {
        return;
      }

      onClose?.();
    }

    document.addEventListener('click', handlePointerDown);

    return () => {
      document.removeEventListener('click', handlePointerDown);
    };
  }, [enabled, ignoreSelector, onClose, panelRef]);
}

function BrandMessageButtonPanel({
  button,
  backLabel,
  ignoreSelector = brandMessageInspectorIgnoreSelector,
  maxNameLength = 14,
  onChange,
  onBack,
  onClose,
  showValidation = false,
  summary,
  testId = 'brand-button-sidebar',
  title = '버튼',
  titleId = 'brand-message-button-inspector-title',
  validation,
}) {
  const panelRef = useRef(null);

  useBrandMessageInspectorOutsideClose(panelRef, Boolean(button), onClose, ignoreSelector);

  if (!button) {
    return null;
  }

  const buttonType = button.type ?? 'WL';
  const isWebLink = buttonType === 'WL';
  const isAppLink = buttonType === 'AL';
  const isBotTransfer = buttonType === 'BT';
  const isBizForm = buttonType === 'BF';
  const isAddChannel = buttonType === 'AC';
  const activeValidation = validation ?? getBrandButtonValidation(button, { maxNameLength });
  const visibleErrors = showValidation ? activeValidation.errors : {};
  const visibleCaveats = activeValidation.caveats;
  const isButtonNameLocked = isAddChannel;

  return (
    <BrandMessageInspectorPanel
      className="brand-message-button-sidebar"
      icon={<Pencil size={16} />}
      backLabel={backLabel}
      onBack={onBack}
      onClose={onClose}
      panelRef={panelRef}
      summary={summary ?? button.name ?? '이름 없음'}
      testId={testId}
      title={title}
      titleId={titleId}
    >
          <div className="message-template-variable-section">
            <label className="brand-message-button-panel-field">
              <span className="message-template-variable-label">이름</span>
              <EmailSendFormInput
                aria-invalid={Boolean(visibleErrors.name) || undefined}
                className={[
                  visibleErrors.name && 'is-invalid',
                  isButtonNameLocked && 'is-locked',
                ].filter(Boolean).join(' ')}
                disabled={isButtonNameLocked}
                maxLength={maxNameLength}
                onChange={isButtonNameLocked ? undefined : (event) => onChange?.({ name: event.target.value })}
                placeholder="이름"
                value={isButtonNameLocked ? brandAddChannelButtonName : button.name ?? ''}
              />
            </label>
            {visibleErrors.name ? (
              <p className="brand-message-coupon-note is-error">{visibleErrors.name}</p>
            ) : null}
            <div className="brand-message-button-panel-field">
              <span className="message-template-variable-label">타입</span>
              <EmailSendFormSelect
                ariaLabel="브랜드 메시지 버튼 타입 선택"
                onValueChange={(type) => onChange?.(getBrandButtonTypePatch(type))}
                options={brandMessageButtonTypeOptions}
                showMenuLabel={false}
                value={buttonType}
              />
            </div>
          </div>
          {isWebLink ? (
            <div className="message-template-variable-section">
              <label className="brand-message-button-panel-field">
                <span className="message-template-variable-label">모바일 링크</span>
                <EmailSendFormInput
                  aria-invalid={Boolean(visibleErrors.link) || undefined}
                  className={visibleErrors.link ? 'is-invalid' : ''}
                  onChange={(event) => onChange?.({ linkMo: event.target.value })}
                  placeholder="https://m.example.com"
                  type="url"
                  value={button.linkMo ?? ''}
                />
              </label>
              <label className="brand-message-button-panel-field">
                <span className="message-template-variable-label">PC 링크</span>
                <EmailSendFormInput
                  aria-invalid={Boolean(visibleErrors.link) || undefined}
                  className={visibleErrors.link ? 'is-invalid' : ''}
                  onChange={(event) => onChange?.({ linkPc: event.target.value })}
                  placeholder="https://example.com"
                  type="url"
                  value={button.linkPc ?? ''}
                />
              </label>
              {visibleErrors.link ? (
                <p className="brand-message-coupon-note is-error">{visibleErrors.link}</p>
              ) : null}
            </div>
          ) : null}
          {isAppLink ? (
            <div className="message-template-variable-section">
              <label className="brand-message-button-panel-field">
                <span className="message-template-variable-label">모바일 링크</span>
                <EmailSendFormInput
                  aria-invalid={Boolean(visibleErrors.link) || undefined}
                  className={visibleErrors.link ? 'is-invalid' : ''}
                  onChange={(event) => onChange?.({ linkMo: event.target.value })}
                  placeholder="https://m.example.com"
                  type="url"
                  value={button.linkMo ?? ''}
                />
              </label>
              <label className="brand-message-button-panel-field">
                <span className="message-template-variable-label">Android 앱 링크</span>
                <EmailSendFormInput
                  aria-invalid={Boolean(visibleErrors.link) || undefined}
                  className={visibleErrors.link ? 'is-invalid' : ''}
                  onChange={(event) => onChange?.({ schemeAndroid: event.target.value })}
                  placeholder="myapp://path"
                  value={button.schemeAndroid ?? ''}
                />
              </label>
              <label className="brand-message-button-panel-field">
                <span className="message-template-variable-label">iOS 앱 링크</span>
                <EmailSendFormInput
                  aria-invalid={Boolean(visibleErrors.link) || undefined}
                  className={visibleErrors.link ? 'is-invalid' : ''}
                  onChange={(event) => onChange?.({ schemeIos: event.target.value })}
                  placeholder="myapp://path"
                  value={button.schemeIos ?? ''}
                />
              </label>
              {visibleErrors.link ? (
                <p className="brand-message-coupon-note is-error">{visibleErrors.link}</p>
              ) : null}
            </div>
          ) : null}
          {isBotTransfer ? (
            <div className="message-template-variable-section">
              <label className="brand-message-button-panel-field">
                <span className="message-template-variable-label">메타정보</span>
                <EmailSendFormInput
                  aria-invalid={Boolean(visibleErrors.chatExtra) || undefined}
                  className={visibleErrors.chatExtra ? 'is-invalid' : ''}
                  onChange={(event) => onChange?.({ chatExtra: event.target.value })}
                  placeholder="chatExtra"
                  value={button.chatExtra ?? ''}
                />
              </label>
              <label className="brand-message-button-panel-field">
                <span className="message-template-variable-label">봇 이벤트명</span>
                <EmailSendFormInput
                  aria-invalid={Boolean(visibleErrors.chatEvent) || undefined}
                  className={visibleErrors.chatEvent ? 'is-invalid' : ''}
                  onChange={(event) => onChange?.({ chatEvent: event.target.value })}
                  placeholder="chatEvent"
                  value={button.chatEvent ?? ''}
                />
              </label>
              {visibleErrors.chatExtra || visibleErrors.chatEvent ? (
                <p className="brand-message-coupon-note is-error">
                  {[visibleErrors.chatExtra, visibleErrors.chatEvent].filter(Boolean).join(' ')}
                </p>
              ) : null}
            </div>
          ) : null}
          {isBizForm ? (
            <div className="message-template-variable-section">
              <label className="brand-message-button-panel-field">
                <span className="message-template-variable-label">비즈폼 ID</span>
                <EmailSendFormInput
                  aria-invalid={Boolean(visibleErrors.bizFormId) || undefined}
                  className={visibleErrors.bizFormId ? 'is-invalid' : ''}
                  inputMode="numeric"
                  onChange={(event) => onChange?.({ bizFormId: event.target.value, bizFormKey: undefined })}
                  placeholder="bizFormId"
                  value={button.bizFormId ?? button.bizFormKey ?? ''}
                />
              </label>
              {visibleErrors.bizFormId ? (
                <p className="brand-message-coupon-note is-error">{visibleErrors.bizFormId}</p>
              ) : null}
            </div>
          ) : null}
          {isAddChannel || visibleCaveats.length ? (
            <div className="message-template-variable-section">
              {visibleCaveats.map((caveat) => (
                <p className="brand-message-coupon-note" key={caveat}>{caveat}</p>
              ))}
            </div>
          ) : null}
    </BrandMessageInspectorPanel>
  );
}

function BrandMessageCouponPanel({
  coupon,
  backLabel,
  chatBubbleType = 'TEXT',
  focusField = '',
  focusRequest = 0,
  ignoreSelector = brandMessageInspectorIgnoreSelector,
  onChange,
  onBack,
  onClose,
  showValidation = false,
  summary,
  testId = 'brand-coupon-sidebar',
  title = '쿠폰',
  titleId = 'brand-message-coupon-inspector-title',
  validation,
}) {
  const panelRef = useRef(null);

  useBrandMessageInspectorOutsideClose(panelRef, Boolean(coupon), onClose, ignoreSelector);

  useEffect(() => {
    if (!coupon || !focusRequest || !focusField) {
      return;
    }

    window.requestAnimationFrame(() => {
      panelRef.current?.querySelector(`[data-coupon-field="${focusField}"]`)?.focus();
    });
  }, [coupon, focusField, focusRequest]);

  if (!coupon) {
    return null;
  }

  const couponTitle = getBrandCouponTitle(coupon);
  const activeValidation = validation ?? getBrandCouponValidation(coupon, { chatBubbleType });
  const visibleErrors = showValidation ? activeValidation.errors : {};
  const couponContentMaxLength = getBrandCouponContentMaxLength(chatBubbleType);
  const selectedCouponOption = getBrandCouponOption(coupon);
  const canUseFixedCouponValue = Boolean(selectedCouponOption.variableKey);
  const fixedCouponValue = coupon.fixedCouponValue ?? '';
  const fixedCouponValueInputMode = selectedCouponOption.fixedCouponValue === 'amount'
    || selectedCouponOption.fixedCouponValue === 'rate'
    ? 'numeric'
    : undefined;

  function handleCouponOptionChange(selectCouponType) {
    const option = getBrandCouponOptionByValue(selectCouponType) ?? getBrandCouponOptionByValue('discountPriceCoupon');

    onChange?.({
      fixedCouponValue: option.defaultFixedValue,
      isUseVariable: Boolean(option.variableKey),
      selectCouponType: option.value,
      type: option.type,
      variable: option.defaultFixedValue,
    });
  }

  function handleFixedCouponValueChange(value) {
    const normalizedValue = normalizeBrandCouponFixedValue(value, selectedCouponOption);

    onChange?.({
      fixedCouponValue: normalizedValue,
      variable: normalizedValue,
    });
  }

  function handleFixedCouponModeChange(isEnabled) {
    const nextFixedCouponValue = isEnabled
      ? fixedCouponValue || selectedCouponOption.defaultFixedValue
      : '';

    onChange?.({
      fixedCouponValue: nextFixedCouponValue,
      isUseVariable: isEnabled,
      variable: nextFixedCouponValue,
    });
  }

  return (
    <BrandMessageInspectorPanel
      className="brand-message-coupon-sidebar"
      icon={<Ticket size={16} />}
      backLabel={backLabel}
      onBack={onBack}
      onClose={onClose}
      panelRef={panelRef}
      summary={summary ?? couponTitle}
      testId={testId}
      title={title}
      titleId={titleId}
    >
          <div className="brand-message-coupon-panel-group">
            <span className="brand-message-coupon-panel-group-title">쿠폰 조건</span>
            <div className="message-template-variable-section">
              <div className="brand-message-button-panel-field">
                <span className="message-template-variable-label">쿠폰명 유형</span>
                <EmailSendFormSelect
                  ariaLabel="쿠폰명 유형 선택"
                  onValueChange={handleCouponOptionChange}
                  options={brandMessageCouponFixedOptionOptions}
                  showMenuLabel={false}
                  value={selectedCouponOption.value}
                />
              </div>
            </div>
            {canUseFixedCouponValue ? (
              <div className="brand-message-button-panel-field brand-message-coupon-panel-row">
                <span className="message-template-variable-label">고정값 입력</span>
                <button
                  aria-checked={Boolean(coupon.isUseVariable)}
                  aria-label="고정값 입력"
                  className="brand-message-toggle brand-message-coupon-fixed-toggle"
                  onClick={() => handleFixedCouponModeChange(!coupon.isUseVariable)}
                  role="switch"
                  type="button"
                >
                  <span aria-hidden="true" className="brand-message-toggle-track">
                    <span className="brand-message-toggle-thumb" />
                  </span>
                </button>
              </div>
            ) : null}
            {canUseFixedCouponValue && coupon.isUseVariable ? (
              <div className="message-template-variable-section brand-message-coupon-panel-field-with-note">
                <label className="brand-message-button-panel-field brand-message-coupon-panel-row">
                  <span className="message-template-variable-label">
                    {selectedCouponOption.fixedLabel}
                    <BrandMessageRequiredMark />
                  </span>
                  <EmailSendFormInput
                    aria-invalid={Boolean(visibleErrors.fixedCouponValue) || undefined}
                    className={visibleErrors.fixedCouponValue ? 'is-invalid' : ''}
                    data-coupon-field="fixedCouponValue"
                    inputMode={fixedCouponValueInputMode}
                    maxLength={selectedCouponOption.fixedCouponValue === 'productName' ? 7 : undefined}
                    onChange={(event) => handleFixedCouponValueChange(event.target.value)}
                    placeholder={selectedCouponOption.fixedPlaceholder}
                    value={fixedCouponValue}
                  />
                </label>
                <p className={[
                  'brand-message-coupon-note',
                  'brand-message-coupon-row-note',
                  visibleErrors.fixedCouponValue && 'is-error',
                ].filter(Boolean).join(' ')}>
                  {visibleErrors.fixedCouponValue || selectedCouponOption.fixedPlaceholder}
                </p>
              </div>
            ) : null}
            {canUseFixedCouponValue && !coupon.isUseVariable && visibleErrors.fixedCouponValue ? (
              <p className="brand-message-coupon-note is-error">{visibleErrors.fixedCouponValue}</p>
            ) : null}
          </div>

          <div className="brand-message-coupon-panel-group">
            <span className="brand-message-coupon-panel-group-title">표시 내용</span>
            <div className="message-template-variable-section brand-message-coupon-panel-row">
              <span className="message-template-variable-label">쿠폰명</span>
              <div className="brand-message-coupon-title-preview">{couponTitle}</div>
            </div>
            <div className="message-template-variable-section">
              <label className="brand-message-button-panel-field brand-message-coupon-panel-row">
                <span className="message-template-variable-label">
                  설명
                  <BrandMessageRequiredMark />
                </span>
                <EmailSendFormInput
                  aria-invalid={Boolean(visibleErrors.description) || undefined}
                  className={visibleErrors.description ? 'is-invalid' : ''}
                  data-coupon-field="description"
                  maxLength={couponContentMaxLength}
                  onChange={(event) => onChange?.({ description: event.target.value })}
                  placeholder="10% off coupon"
                  value={coupon.description ?? ''}
                />
              </label>
              <p className={[
                'brand-message-coupon-note',
                'brand-message-coupon-row-note',
                visibleErrors.description && 'is-error',
              ].filter(Boolean).join(' ')}>
                {visibleErrors.description || `설명은 ${couponContentMaxLength}자 이하입니다.`}
              </p>
            </div>
          </div>

          <div className="brand-message-coupon-panel-group">
            <span className="brand-message-coupon-panel-group-title">
              연결
              <BrandMessageRequiredMark />
            </span>
            <p className="brand-message-coupon-panel-group-note">
              모바일 웹 링크 또는 alimtalk=coupon:// 앱 링크 중 하나 필요
            </p>
            <div className="message-template-variable-section">
              <label className="brand-message-button-panel-field">
                <span className="message-template-variable-label">모바일 웹 링크</span>
                <EmailSendFormInput
                  aria-invalid={Boolean(visibleErrors.connection) || undefined}
                  className={visibleErrors.connection ? 'is-invalid' : ''}
                  data-coupon-field="linkMo"
                  onChange={(event) => onChange?.({ linkMo: event.target.value })}
                  placeholder="https://m.example.com/coupon"
                  type="url"
                  value={coupon.linkMo ?? ''}
                />
              </label>
              <label className="brand-message-button-panel-field">
                <span className="message-template-variable-label">PC 웹 링크</span>
                <EmailSendFormInput
                  onChange={(event) => onChange?.({ linkPc: event.target.value })}
                  placeholder="https://www.example.com/coupon"
                  type="url"
                  value={coupon.linkPc ?? ''}
                />
              </label>
              <label className="brand-message-button-panel-field">
                <span className="message-template-variable-label">Android 앱 링크</span>
                <EmailSendFormInput
                  aria-invalid={Boolean(visibleErrors.connection) || undefined}
                  className={visibleErrors.connection ? 'is-invalid' : ''}
                  data-coupon-field="schemeAndroid"
                  onChange={(event) => onChange?.({ schemeAndroid: event.target.value })}
                  placeholder="alimtalk=coupon://"
                  value={coupon.schemeAndroid ?? ''}
                />
              </label>
              <label className="brand-message-button-panel-field">
                <span className="message-template-variable-label">iOS 앱 링크</span>
                <EmailSendFormInput
                  aria-invalid={Boolean(visibleErrors.connection) || undefined}
                  className={visibleErrors.connection ? 'is-invalid' : ''}
                  data-coupon-field="schemeIos"
                  onChange={(event) => onChange?.({ schemeIos: event.target.value })}
                  placeholder="alimtalk=coupon://"
                  value={coupon.schemeIos ?? ''}
                />
              </label>
              {visibleErrors.connection ? (
                <p className="brand-message-coupon-note is-error">
                  {visibleErrors.connection}
                </p>
              ) : null}
            </div>
          </div>
    </BrandMessageInspectorPanel>
  );
}

function BrandMessageWideItemPanel({
  index,
  item,
  onChange,
  onClose,
  showValidation = false,
}) {
  const panelRef = useRef(null);
  const validation = item ? getBrandWideItemValidation(item, index) : { errors: {} };
  const visibleErrors = showValidation ? getBrandInspectorErrorMessages(validation.errors) : {};
  const isFirstItem = index === 0;
  const titleMaxLength = isFirstItem ? 25 : 30;

  useBrandMessageInspectorOutsideClose(panelRef, Boolean(item), onClose, brandMessageInspectorIgnoreSelector);

  if (!item) {
    return null;
  }

  return (
    <BrandMessageInspectorPanel
      className="brand-message-item-sidebar"
      icon={<Pencil size={16} />}
      onClose={onClose}
      panelRef={panelRef}
      summary={item.title || '제목 없음'}
      testId="brand-wide-item-sidebar"
      title={`리스트 아이템 ${index + 1}`}
      titleId="brand-message-wide-item-inspector-title"
    >
      <div className="message-template-variable-section">
        <label className="brand-message-button-panel-field">
          <span className="message-template-variable-label">
            제목
            {isFirstItem ? null : <BrandMessageRequiredMark />}
          </span>
          <EmailSendFormInput
            aria-invalid={Boolean(visibleErrors.title) || undefined}
            className={visibleErrors.title ? 'is-invalid' : ''}
            maxLength={titleMaxLength}
            onChange={(event) => onChange?.({ title: event.target.value })}
            placeholder={isFirstItem ? '이미지 내 제목 25자' : '상품명 30자'}
            value={item.title ?? ''}
          />
        </label>
        {visibleErrors.title ? (
          <p className="brand-message-coupon-note is-error">{visibleErrors.title}</p>
        ) : null}
        <label className="brand-message-button-panel-field">
          <span className="message-template-variable-label">
            모바일 링크
            <BrandMessageRequiredMark />
          </span>
          <EmailSendFormInput
            aria-invalid={Boolean(visibleErrors.linkMo) || undefined}
            className={visibleErrors.linkMo ? 'is-invalid' : ''}
            onChange={(event) => onChange?.({ linkMo: event.target.value })}
            placeholder="https://m.example.com"
            value={item.linkMo ?? ''}
          />
        </label>
        {visibleErrors.linkMo ? (
          <p className="brand-message-coupon-note is-error">{visibleErrors.linkMo}</p>
        ) : null}
        <label className="brand-message-button-panel-field">
          <span className="message-template-variable-label">PC 링크</span>
          <EmailSendFormInput
            onChange={(event) => onChange?.({ linkPc: event.target.value })}
            placeholder="https://example.com"
            value={item.linkPc ?? ''}
          />
        </label>
        <label className="brand-message-button-panel-field">
          <span className="message-template-variable-label">Android 앱 링크</span>
          <EmailSendFormInput
            onChange={(event) => onChange?.({ schemeAndroid: event.target.value })}
            placeholder="app://path"
            value={item.schemeAndroid ?? ''}
          />
        </label>
        <label className="brand-message-button-panel-field">
          <span className="message-template-variable-label">iOS 앱 링크</span>
          <EmailSendFormInput
            onChange={(event) => onChange?.({ schemeIos: event.target.value })}
            placeholder="app://path"
            value={item.schemeIos ?? ''}
          />
        </label>
        <BrandMessageNestedImageField
          cropPreset={index === 0 ? 'BRAND_MAIN_WIDE_ITEM_LIST_IMAGE' : 'BRAND_NORMAL_WIDE_ITEM_LIST_IMAGE'}
          item={item}
          onChange={(patch) => onChange?.(patch)}
          showImageLink={false}
        />
        {visibleErrors.image ? (
          <p className="brand-message-coupon-note is-error">{visibleErrors.image}</p>
        ) : null}
      </div>
    </BrandMessageInspectorPanel>
  );
}

function BrandMessageCarouselIntroPanel({
  head,
  onChange,
  onClose,
  showValidation = false,
}) {
  const panelRef = useRef(null);
  const intro = head ?? {};
  const validation = getBrandCarouselIntroValidation(intro);
  const visibleErrors = showValidation ? getBrandInspectorErrorMessages(validation.errors) : {};

  useBrandMessageInspectorOutsideClose(panelRef, Boolean(head), onClose, brandMessageInspectorIgnoreSelector);

  if (!head) {
    return null;
  }

  return (
    <BrandMessageInspectorPanel
      className="brand-message-item-sidebar"
      icon={<Pencil size={16} />}
      onClose={onClose}
      panelRef={panelRef}
      summary={intro.header || '제목 없음'}
      testId="brand-carousel-intro-sidebar"
      title="커머스 인트로"
      titleId="brand-message-carousel-intro-inspector-title"
    >
      <div className="message-template-variable-section">
        <label className="brand-message-button-panel-field">
          <span className="message-template-variable-label">
            인트로 제목
            <BrandMessageRequiredMark />
          </span>
          <EmailSendFormInput
            aria-invalid={Boolean(visibleErrors.header) || undefined}
            className={visibleErrors.header ? 'is-invalid' : ''}
            onChange={(event) => onChange?.({ header: event.target.value })}
            placeholder="브랜드 단독 혜택"
            value={intro.header ?? ''}
          />
        </label>
        {visibleErrors.header ? (
          <p className="brand-message-coupon-note is-error">{visibleErrors.header}</p>
        ) : null}
        <label className="brand-message-button-panel-field">
          <span className="message-template-variable-label">
            인트로 내용
            <BrandMessageRequiredMark />
          </span>
          <EmailSendFormTextarea
            aria-invalid={Boolean(visibleErrors.content) || undefined}
            className={visibleErrors.content ? 'is-invalid' : ''}
            onChange={(event) => onChange?.({ content: event.target.value })}
            placeholder="기획전 대표 문구"
            rows={3}
            value={intro.content ?? ''}
          />
        </label>
        {visibleErrors.content ? (
          <p className="brand-message-coupon-note is-error">{visibleErrors.content}</p>
        ) : null}
        <BrandMessageNestedImageField
          cropPreset="BRAND_CAROUSEL_IMAGE"
          item={intro}
          label="커머스 인트로 이미지 업로드"
          onChange={(patch) => onChange?.(patch)}
        />
        {visibleErrors.image ? (
          <p className="brand-message-coupon-note is-error">{visibleErrors.image}</p>
        ) : null}
      </div>
      <div className="message-template-variable-section">
        <label className="brand-message-button-panel-field">
          <span className="message-template-variable-label">모바일 웹 링크</span>
          <EmailSendFormInput
            aria-invalid={Boolean(visibleErrors.linkMo) || undefined}
            className={visibleErrors.linkMo ? 'is-invalid' : ''}
            onChange={(event) => onChange?.({ linkMo: event.target.value })}
            placeholder="https://m.example.com"
            type="url"
            value={intro.linkMo ?? ''}
          />
        </label>
        <label className="brand-message-button-panel-field">
          <span className="message-template-variable-label">PC 웹 링크</span>
          <EmailSendFormInput
            onChange={(event) => onChange?.({ linkPc: event.target.value })}
            placeholder="https://example.com"
            type="url"
            value={intro.linkPc ?? ''}
          />
        </label>
        <label className="brand-message-button-panel-field">
          <span className="message-template-variable-label">Android 앱 링크</span>
          <EmailSendFormInput
            onChange={(event) => onChange?.({ schemeAndroid: event.target.value })}
            placeholder="app://..."
            value={intro.schemeAndroid ?? ''}
          />
        </label>
        <label className="brand-message-button-panel-field">
          <span className="message-template-variable-label">iOS 앱 링크</span>
          <EmailSendFormInput
            onChange={(event) => onChange?.({ schemeIos: event.target.value })}
            placeholder="app://..."
            value={intro.schemeIos ?? ''}
          />
        </label>
        {visibleErrors.linkMo ? (
          <p className="brand-message-coupon-note is-error">{visibleErrors.linkMo}</p>
        ) : null}
      </div>
    </BrandMessageInspectorPanel>
  );
}

function BrandMessageCarouselTailPanel({
  onChange,
  onClose,
  showValidation = false,
  tail,
  validation,
}) {
  const panelRef = useRef(null);
  const visibleErrors = showValidation ? getBrandInspectorErrorMessages(validation?.errors ?? {}) : {};

  useBrandMessageInspectorOutsideClose(panelRef, Boolean(tail), onClose, brandMessageInspectorIgnoreSelector);

  if (!tail) {
    return null;
  }

  return (
    <BrandMessageInspectorPanel
      className="brand-message-item-sidebar"
      icon={<Pencil size={16} />}
      onClose={onClose}
      panelRef={panelRef}
      summary={getBrandCarouselTailSummary(tail)}
      testId="brand-carousel-tail-sidebar"
      title="더보기 링크"
      titleId="brand-message-carousel-tail-inspector-title"
    >
      <div className="message-template-variable-section">
        <label className="brand-message-button-panel-field">
          <span className="message-template-variable-label">
            모바일 링크
            {tail.isMoreButton ? <BrandMessageRequiredMark /> : null}
          </span>
          <EmailSendFormInput
            aria-invalid={Boolean(visibleErrors.linkMo) || undefined}
            className={visibleErrors.linkMo ? 'is-invalid' : ''}
            onChange={(event) => onChange?.({ linkMo: event.target.value })}
            placeholder="https://m.example.com"
            type="url"
            value={tail.linkMo ?? ''}
          />
        </label>
        {visibleErrors.linkMo ? (
          <p className="brand-message-coupon-note is-error">{visibleErrors.linkMo}</p>
        ) : null}
        <label className="brand-message-button-panel-field">
          <span className="message-template-variable-label">PC 링크</span>
          <EmailSendFormInput
            onChange={(event) => onChange?.({ linkPc: event.target.value })}
            placeholder="https://example.com"
            type="url"
            value={tail.linkPc ?? ''}
          />
        </label>
        <label className="brand-message-button-panel-field">
          <span className="message-template-variable-label">Android 앱 링크</span>
          <EmailSendFormInput
            onChange={(event) => onChange?.({ schemeAndroid: event.target.value })}
            placeholder="app://path"
            value={tail.schemeAndroid ?? ''}
          />
        </label>
        <label className="brand-message-button-panel-field">
          <span className="message-template-variable-label">iOS 앱 링크</span>
          <EmailSendFormInput
            onChange={(event) => onChange?.({ schemeIos: event.target.value })}
            placeholder="app://path"
            value={tail.schemeIos ?? ''}
          />
        </label>
      </div>
    </BrandMessageInspectorPanel>
  );
}

function BrandMessageCarouselItemButtonSection({
  activeButtonId = '',
  buttons,
  onAdd,
  onEdit,
  onRemove,
  showValidation = false,
}) {
  const itemButtons = normalizeBrandItemButtons(buttons);
  const canAddButton = itemButtons.length < brandCarouselButtonMaxCount;
  const isMissing = showValidation && itemButtons.length === 0;
  const missingButtonMessage = isMissing ? '버튼을 1개 이상 추가해 주세요.' : '';

  return (
    <div className="brand-message-button-editor brand-message-carousel-item-action-editor">
      <div className="brand-message-button-editor-header">
        <span className="brand-message-action-editor-title">
          {isMissing ? (
            <BrandMessageValidationIssueTooltip
              className="brand-message-action-editor-validation-icon"
              message={missingButtonMessage}
            />
          ) : null}
          <span>버튼 {itemButtons.length}/{brandCarouselButtonMaxCount}</span>
        </span>
        <EmailSendFormGhostButton disabled={!canAddButton} onClick={onAdd}>
          <Plus aria-hidden="true" size={14} />
          추가
        </EmailSendFormGhostButton>
      </div>
      <div className="brand-message-button-list">
        {itemButtons.map((button, index) => {
          const validation = getBrandButtonValidation(button, { maxNameLength: 8 });
          const isInvalid = showValidation && !validation.isValid;
          const validationMessage = isInvalid ? getBrandValidationTooltipMessage(validation.errors) : '';

          return (
            <div
              aria-invalid={isInvalid ? 'true' : undefined}
              className={[
                'brand-message-button-row',
                'brand-message-carousel-button-row',
                button.id === activeButtonId && 'is-active',
                isInvalid && 'is-invalid',
              ].filter(Boolean).join(' ')}
              key={button.id}
            >
              {isInvalid ? (
                <BrandMessageValidationIssueTooltip
                  className="brand-message-button-validation-icon"
                  message={validationMessage}
                />
              ) : null}
              <span className="brand-message-button-index">{index + 1}</span>
              <strong><span className="brand-message-button-title-text">{button.name || '이름 없음'}</span></strong>
              <em>{getBrandMessageButtonTypeLabel(button.type ?? 'WL')}</em>
              <button
                aria-label={`${button.name || `버튼 ${index + 1}`} 수정`}
                className="brand-message-button-action"
                onClick={() => onEdit?.(button.id)}
                type="button"
              >
                <Pencil aria-hidden="true" size={15} />
              </button>
              <button
                aria-label={`${button.name || `버튼 ${index + 1}`} 삭제`}
                className="brand-message-button-action"
                onClick={() => onRemove?.(button.id)}
                type="button"
              >
                <Trash2 aria-hidden="true" size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BrandMessageCarouselItemCouponSection({
  chatBubbleType = 'CAROUSEL_FEED',
  coupon,
  isActive = false,
  onAdd,
  onEdit,
  onRemove,
  showValidation = false,
}) {
  const validation = getBrandCouponValidation(coupon, { chatBubbleType });
  const statusLabels = showValidation && coupon ? validation.statusLabels : [];
  const validationMessage = statusLabels.length ? getBrandValidationTooltipMessage(validation.errors) : '';

  return (
    <div className="brand-message-coupon-editor brand-message-carousel-item-action-editor">
      <div className="brand-message-coupon-editor-header">
        <span>쿠폰 {coupon ? 1 : 0}/1</span>
        {coupon ? (
          <EmailSendFormGhostButton disabled>
            <Ticket aria-hidden="true" size={14} />
            최대 1개
          </EmailSendFormGhostButton>
        ) : (
          <EmailSendFormGhostButton onClick={onAdd}>
            <Plus aria-hidden="true" size={14} />
            추가
          </EmailSendFormGhostButton>
        )}
      </div>
      {coupon ? (
        <div
          aria-invalid={statusLabels.length ? 'true' : undefined}
          className={[
            'brand-message-coupon-row',
            isActive && 'is-active',
            statusLabels.length && 'is-invalid',
          ].filter(Boolean).join(' ')}
        >
          {statusLabels.length ? (
            <>
              <BrandMessageValidationIssueTooltip
                className="brand-message-coupon-validation-icon"
                message={validationMessage}
              />
              <span aria-hidden="true" className="brand-message-coupon-row-icon" />
            </>
          ) : (
            <span aria-hidden="true" className="brand-message-coupon-row-icon">
              <Ticket size={15} />
            </span>
          )}
          <div className="brand-message-coupon-row-copy">
            <strong>{getBrandCouponTitle(coupon)}</strong>
            <span>{coupon.description || '쿠폰 설명 없음'}</span>
          </div>
          <button
            aria-label={`${getBrandCouponTitle(coupon)} 수정`}
            className="brand-message-coupon-action"
            onClick={onEdit}
            type="button"
          >
            <Pencil aria-hidden="true" size={15} />
          </button>
          <button
            aria-label={`${getBrandCouponTitle(coupon)} 삭제`}
            className="brand-message-coupon-action"
            onClick={onRemove}
            type="button"
          >
            <Trash2 aria-hidden="true" size={15} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BrandMessageCarouselItemPanel({
  activeButtonId = '',
  isCouponActive = false,
  index,
  isCommerce,
  item,
  onButtonAdd,
  onButtonEdit,
  onButtonRemove,
  onChange,
  onClose,
  onCouponAdd,
  onCouponEdit,
  onCouponRemove,
  showValidation = false,
}) {
  const panelRef = useRef(null);
  const validation = item ? getBrandCarouselItemValidation(item, index, isCommerce) : { errors: {} };
  const visibleErrors = showValidation ? getBrandInspectorErrorMessages(validation.errors) : {};
  const itemLabel = isCommerce ? '상품' : '카드';

  useBrandMessageInspectorOutsideClose(panelRef, Boolean(item), onClose, brandMessageInspectorIgnoreSelector);

  if (!item) {
    return null;
  }

  return (
    <BrandMessageInspectorPanel
      className="brand-message-item-sidebar"
      icon={<Pencil size={16} />}
      onClose={onClose}
      panelRef={panelRef}
      summary={item.title || '제목 없음'}
      testId="brand-carousel-item-sidebar"
      title={`${itemLabel} ${index + 1}`}
      titleId="brand-message-carousel-item-inspector-title"
    >
      <div className="message-template-variable-section">
        <label className="brand-message-button-panel-field">
          <span className="message-template-variable-label">
            {isCommerce ? '상품명' : '제목'}
            <BrandMessageRequiredMark />
          </span>
          <EmailSendFormInput
            aria-invalid={Boolean(visibleErrors.title) || undefined}
            className={visibleErrors.title ? 'is-invalid' : ''}
            maxLength={isCommerce ? 30 : undefined}
            onChange={(event) => onChange?.({ title: event.target.value })}
            placeholder={isCommerce ? '상품명' : '카드 제목'}
            value={item.title ?? ''}
          />
        </label>
        {visibleErrors.title ? (
          <p className="brand-message-coupon-note is-error">{visibleErrors.title}</p>
        ) : null}
        {isCommerce ? (
          <>
            <label className="brand-message-button-panel-field">
              <span className="message-template-variable-label">추가 문구</span>
              <EmailSendFormTextarea
                aria-invalid={Boolean(visibleErrors.additionalContent) || undefined}
                className={visibleErrors.additionalContent ? 'is-invalid' : ''}
                maxLength={34}
                onChange={(event) => onChange?.({ additionalContent: event.target.value })}
                placeholder="오늘만 적용되는 혜택"
                rows={2}
                value={item.additionalContent ?? ''}
              />
            </label>
            <div className="brand-message-type-grid">
              <label className="brand-message-button-panel-field">
                <span className="message-template-variable-label">
                  정상가
                  <BrandMessageRequiredMark />
                </span>
                <EmailSendFormInput
                  aria-invalid={Boolean(visibleErrors.regularPrice) || undefined}
                  className={visibleErrors.regularPrice ? 'is-invalid' : ''}
                  inputMode="numeric"
                  onChange={(event) => onChange?.({ regularPrice: event.target.value })}
                  placeholder="59000"
                  value={item.regularPrice ?? item.price ?? ''}
                />
              </label>
              <label className="brand-message-button-panel-field">
                <span className="message-template-variable-label">할인가</span>
                <EmailSendFormInput
                  aria-invalid={Boolean(
                    visibleErrors.discountPrice
                    || visibleErrors['discount-lower-than-regular']
                  ) || undefined}
                  className={
                    visibleErrors.discountPrice
                    || visibleErrors['discount-lower-than-regular']
                      ? 'is-invalid'
                      : ''
                  }
                  inputMode="numeric"
                  onChange={(event) => onChange?.({ discountPrice: event.target.value })}
                  placeholder="39000"
                  value={item.discountPrice ?? ''}
                />
              </label>
              <BrandMessageDiscountTypeField
                className="brand-message-button-panel-field"
                onChange={onChange}
                value={item.discountType}
              />
            </div>
          </>
        ) : (
          <label className="brand-message-button-panel-field">
            <span className="message-template-variable-label">
              본문
              <BrandMessageRequiredMark />
            </span>
            <EmailSendFormTextarea
              aria-invalid={Boolean(visibleErrors.content) || undefined}
              className={visibleErrors.content ? 'is-invalid' : ''}
              onChange={(event) => onChange?.({ content: event.target.value })}
              placeholder="카드 본문"
              rows={3}
              value={item.content ?? item.description ?? ''}
            />
          </label>
        )}
        {visibleErrors.regularPrice
        || visibleErrors.content
        || visibleErrors.additionalContent
        || visibleErrors.discountPrice
        || visibleErrors.discountRate
        || visibleErrors.discountFixed
        || visibleErrors.discountType
        || visibleErrors['discount-lower-than-regular'] ? (
          <p className="brand-message-coupon-note is-error">
            {visibleErrors.regularPrice
              || visibleErrors.content
              || visibleErrors.additionalContent
              || visibleErrors.discountPrice
              || visibleErrors.discountRate
              || visibleErrors.discountFixed
              || visibleErrors.discountType
              || visibleErrors['discount-lower-than-regular']}
          </p>
        ) : null}
        <BrandMessageNestedImageField
          cropPreset="BRAND_CAROUSEL_IMAGE"
          item={item}
          label={isCommerce ? '상품 이미지 업로드' : '이미지 업로드'}
          onChange={(patch) => onChange?.(patch)}
        />
        {visibleErrors.image ? (
          <p className="brand-message-coupon-note is-error">{visibleErrors.image}</p>
        ) : null}
      </div>
      <BrandMessageCarouselItemButtonSection
        activeButtonId={activeButtonId}
        buttons={item.buttons}
        onAdd={onButtonAdd}
        onEdit={onButtonEdit}
        onRemove={onButtonRemove}
        showValidation={showValidation}
      />
      <BrandMessageCarouselItemCouponSection
        chatBubbleType={isCommerce ? 'CAROUSEL_COMMERCE' : 'CAROUSEL_FEED'}
        coupon={item.coupon}
        isActive={isCouponActive}
        onAdd={onCouponAdd}
        onEdit={onCouponEdit}
        onRemove={onCouponRemove}
        showValidation={showValidation}
      />
    </BrandMessageInspectorPanel>
  );
}

export const BrandMessageSendForm = forwardRef(function BrandMessageSendForm({
  className = '',
  compositionPurpose = 'send',
  defaultValue,
  fallbackSenderNumbers = defaultSmsFallbackSenderNumbers,
  onChange,
  onCarouselPreviewTargetChange,
  onFallbackSenderNumberCreate,
  onSenderProfileCreate,
  recipientContacts,
  recipientSelectProps,
  recipients = defaultEmailSendFormSegments,
  scheduleOptions = defaultEmailSendFormSchedules,
  senderProfileCreateLabel = '발신채널 추가하기',
  senderProfiles = defaultBrandMessageSenderProfiles,
  templates = defaultBrandMessageTemplates,
  value,
  variablePanelRoot,
  ...props
}, ref) {
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(() => normalizeBrandMessageDraftValue(defaultValue));
  const [scheduleVisible, setScheduleVisible] = useState(() => Boolean(normalizeBrandMessageDraftValue(value ?? defaultValue).scheduledAt));
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [activeVariableKey, setActiveVariableKey] = useState('');
  const [activeButtonId, setActiveButtonId] = useState('');
  const [activeItemEditor, setActiveItemEditor] = useState(null);
  const [couponPanelOpen, setCouponPanelOpen] = useState(false);
  const [couponValidationVisible, setCouponValidationVisible] = useState(false);
  const [couponFocusField, setCouponFocusField] = useState('');
  const [couponFocusRequest, setCouponFocusRequest] = useState(0);
  const [validationVisible, setValidationVisible] = useState(false);
  const [imageCropFile, setImageCropFile] = useState(null);
  const fileInputRef = useRef(null);
  const buttonListRef = useRef(null);
  const wideItemListRef = useRef(null);
  const carouselItemListRef = useRef(null);
  const bodyWarningId = useId();
  const latestButtonsRef = useRef([]);
  const latestWideItemsRef = useRef([]);
  const latestCarouselItemsRef = useRef([]);
  const latestMessageRef = useRef(null);
  const updateMessageRef = useRef(null);
  const message = normalizeBrandMessageDraftValue(isControlled ? value : uncontrolledValue);
  const availableTemplates = useMemo(
    () => getAvailableBrandTemplates(templates, message.senderProfileId),
    [message.senderProfileId, templates]
  );
  const templateDialogItems = useMemo(
    () => getBrandTemplateDialogItems(availableTemplates),
    [availableTemplates]
  );
  const selectedTemplate = availableTemplates.find((template) => isSelectedBrandTemplate(template, message.templateCode)) ?? null;
  const selectedTemplateCode = selectedTemplate ? getBrandTemplateCode(selectedTemplate) : message.templateCode;
  const selectedTemplateDialogId = selectedTemplate
    ? String(selectedTemplate.id ?? selectedTemplate.value ?? selectedTemplateCode)
    : '';
  const selectedTemplateName = getTemplateDisplayName(selectedTemplate);
  const isTemplateRegistrationPurpose = compositionPurpose === 'template-registration';
  const selectedTemplateVariables = useMemo(() => (
    Object.entries(getInitialTemplateVariables(selectedTemplate, 'kakao', message.templateParameter))
  ), [message.templateParameter, selectedTemplate]);
  const selectedVariable = useMemo(() => (
    getTemplateVariableDetails(selectedTemplate, message.templateParameter, activeVariableKey, 'kakao')
  ), [activeVariableKey, message.templateParameter, selectedTemplate]);
  const isTemplateMode = message.mode === 'template' && Boolean(selectedTemplate);
  const isTopLevelImageMessage = !isTemplateMode && brandTopLevelImageTypes.has(message.chatBubbleType);
  const topLevelImageCropPreset = message.chatBubbleType === 'WIDE' ? 'BRAND_WIDE_IMAGE' : 'BRAND_IMAGE';
  const contentConfig = getBrandChatBubbleTypeConfig(message.chatBubbleType);
  const shouldRenderContentField = !isTemplateMode && shouldShowBrandContentField(message.chatBubbleType);
  const shouldRenderTemplatePickerOnly = !isTemplateMode && !shouldRenderContentField;
  const isContentRequired = contentConfig.contentMode === 'required';
  const isBodyEmpty = !message.content.trim();
  const maxLength = contentConfig.contentMaxLength;
  const isCarouselType = brandCarouselTypes.has(message.chatBubbleType);
  const buttonMaxCount = getBrandTopLevelButtonLimit(message.chatBubbleType, Boolean(message.coupon));
  const topLevelButtonMaxNameLength = ['WIDE', 'WIDE_ITEM_LIST', 'PREMIUM_VIDEO', 'COMMERCE'].includes(message.chatBubbleType) ? 8 : 14;
  const canAddButton = !isCarouselType && message.buttons.length < buttonMaxCount;
  const canAddCoupon = !isCarouselType
    && !message.coupon
    && message.buttons.length <= getBrandTopLevelButtonLimit(message.chatBubbleType, true);
  const activeButton = !isCarouselType ? message.buttons.find((button) => button.id === activeButtonId) ?? null : null;
  const activeCoupon = !isCarouselType && couponPanelOpen ? message.coupon : null;
  const couponValidation = getBrandCouponValidation(message.coupon, { chatBubbleType: message.chatBubbleType });
  const shouldShowCouponValidation = couponValidationVisible && Boolean(message.coupon);
  const validationIssues = isTemplateRegistrationPurpose
    ? getBrandMessageTemplateRegistrationIssues(message)
    : getBrandMessageValidationIssues(message);
  const visibleValidationIssues = validationVisible ? validationIssues : [];
  const visibleSenderIssue = visibleValidationIssues.find((issue) => issue.field === 'senderProfileId') ?? null;
  const visibleRecipientIssue = visibleValidationIssues.find((issue) => issue.field === 'recipient') ?? null;
  const visibleImageIssue = visibleValidationIssues.find((issue) => issue.field === 'image') ?? null;
  const visibleFallbackSenderIssue = visibleValidationIssues.find((issue) => issue.field === 'fallbackSenderNumber') ?? null;
  const visibleBodyContentIssue = visibleValidationIssues.find((issue) => (
    issue.field === 'content' && isContentRequired && isBodyEmpty
  )) ?? null;
  const visibleBodyLengthIssue = visibleValidationIssues.find((issue) => (
    issue.field === 'content' && issue !== visibleBodyContentIssue
  )) ?? null;
  const buttonEditorIssues = visibleValidationIssues.filter(isBrandButtonEditorValidationIssue);
  const senderWarnings = getBrandValidationWarning(visibleSenderIssue, 'brand-message-sender-required');
  const recipientWarnings = getBrandValidationWarning(visibleRecipientIssue, 'brand-message-recipient-required');
  const imageWarnings = getBrandValidationWarning(visibleImageIssue, 'brand-message-image-required');
  const fallbackSenderWarnings = getBrandValidationWarning(
    visibleFallbackSenderIssue,
    'brand-message-fallback-sender-required'
  );
  const buttonEditorWarnings = getBrandValidationWarnings(buttonEditorIssues, 'brand-message-button-editor');
  const activeButtonValidation = activeButton ? getBrandButtonValidation(activeButton, { maxNameLength: topLevelButtonMaxNameLength }) : null;
  const wideItems = getBrandWideItemList(message.item);
  const carouselItems = getBrandCarouselList(message.carousel);
  const activeWideItem = activeItemEditor?.kind === 'wide' ? wideItems[activeItemEditor.index] ?? null : null;
  const activeCarouselItem = activeItemEditor?.kind === 'carousel'
    ? carouselItems[activeItemEditor.index] ?? null
    : null;
  const activeCarouselItemPanel = activeItemEditor?.kind === 'carousel'
    ? activeItemEditor.panel ?? 'details'
    : '';
  const activeCarouselItemButton = activeCarouselItemPanel === 'button'
    ? normalizeBrandItemButtons(activeCarouselItem?.buttons).find((button) => button.id === activeItemEditor?.buttonId) ?? null
    : null;
  const activeCarouselItemCoupon = activeCarouselItemPanel === 'coupon'
    ? activeCarouselItem?.coupon ?? null
    : null;
  const activeCarouselButtonValidation = activeCarouselItemButton
    ? getBrandButtonValidation(activeCarouselItemButton, { maxNameLength: 8 })
    : null;
  const activeCarouselCouponValidation = getBrandCouponValidation(activeCarouselItemCoupon, {
    chatBubbleType: message.chatBubbleType,
  });
  const activeCarouselIntro = activeItemEditor?.kind === 'carouselIntro' && message.carousel?.isUseIntro
    ? message.carousel?.head ?? createBrandCarouselIntro()
    : null;
  const activeCarouselTail = activeItemEditor?.kind === 'carouselTail' && isCarouselType
    ? normalizeBrandCarouselTail(message.carousel?.tail ?? message.carousel?.moreButton) ?? createBrandCarouselTail()
    : null;
  const activeCarouselTailValidation = getBrandCarouselTailValidation(activeCarouselTail);
  const activeCarouselPreviewTargetIndex = !isTemplateMode
    ? getBrandCarouselPreviewTargetIndex(activeItemEditor, message, carouselItems.length)
    : null;

  useEffect(() => {
    latestButtonsRef.current = message.buttons;
    latestWideItemsRef.current = wideItems;
    latestCarouselItemsRef.current = carouselItems;
    latestMessageRef.current = message;
    updateMessageRef.current = updateMessage;
  });

  useEffect(() => {
    const targetIndex = activeItemEditor ? activeCarouselPreviewTargetIndex : null;

    onCarouselPreviewTargetChange?.(
      targetIndex === null ? null : { index: targetIndex }
    );
  }, [activeCarouselPreviewTargetIndex, activeItemEditor, onCarouselPreviewTargetChange]);

  useEffect(() => {
    if (isTemplateMode || isCarouselType || !buttonListRef.current) {
      return undefined;
    }

    const sortable = Sortable.create(buttonListRef.current, {
      animation: 180,
      chosenClass: 'brand-message-button-sortable-chosen',
      dragClass: 'brand-message-button-sortable-drag',
      draggable: '.brand-message-button-row',
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fallbackClass: 'brand-message-button-sortable-fallback',
      fallbackOnBody: true,
      forceFallback: true,
      ghostClass: 'brand-message-button-sortable-ghost',
      handle: '.brand-message-button-drag-handle',
      onEnd(event) {
        document.body.classList.remove('is-brand-message-button-dragging');

        if (event.oldIndex === undefined || event.newIndex === undefined || event.oldIndex === event.newIndex) {
          return;
        }

        const nextButtons = [...latestButtonsRef.current];
        const [movedButton] = nextButtons.splice(event.oldIndex, 1);

        if (!movedButton) {
          return;
        }

        nextButtons.splice(event.newIndex, 0, movedButton);
        updateMessageRef.current?.({ buttons: withBrandButtonOrdering(nextButtons) });
      },
      onStart() {
        document.body.classList.add('is-brand-message-button-dragging');
      },
    });

    return () => {
      sortable.destroy();
      document.body.classList.remove('is-brand-message-button-dragging');
    };
  }, [isTemplateMode, isCarouselType]);

  useEffect(() => {
    if (isTemplateMode || message.chatBubbleType !== 'WIDE_ITEM_LIST' || !wideItemListRef.current) {
      return undefined;
    }

    const sortable = Sortable.create(wideItemListRef.current, {
      animation: 180,
      chosenClass: 'brand-message-button-sortable-chosen',
      dragClass: 'brand-message-button-sortable-drag',
      draggable: '.brand-message-type-row',
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fallbackClass: 'brand-message-button-sortable-fallback',
      fallbackOnBody: true,
      forceFallback: true,
      ghostClass: 'brand-message-button-sortable-ghost',
      handle: '.brand-message-type-row-drag-handle',
      onEnd(event) {
        document.body.classList.remove('is-brand-message-button-dragging');

        if (event.oldIndex === undefined || event.newIndex === undefined || event.oldIndex === event.newIndex) {
          return;
        }

        const nextItems = moveArrayItem(latestWideItemsRef.current, event.oldIndex, event.newIndex);

        if (nextItems === latestWideItemsRef.current) {
          return;
        }

        setActiveItemEditor((editor) => (
          editor?.kind === 'wide'
            ? { ...editor, index: getReorderedIndex(editor.index, event.oldIndex, event.newIndex) }
            : editor
        ));
        updateMessageRef.current?.({
          item: {
            ...(latestMessageRef.current?.item ?? {}),
            list: nextItems,
          },
        });
      },
      onStart() {
        document.body.classList.add('is-brand-message-button-dragging');
      },
    });

    return () => {
      sortable.destroy();
      document.body.classList.remove('is-brand-message-button-dragging');
    };
  }, [isTemplateMode, message.chatBubbleType]);

  useEffect(() => {
    const isActiveCarouselType = message.chatBubbleType === 'CAROUSEL_FEED' || message.chatBubbleType === 'CAROUSEL_COMMERCE';

    if (isTemplateMode || !isActiveCarouselType || !carouselItemListRef.current) {
      return undefined;
    }

    const sortable = Sortable.create(carouselItemListRef.current, {
      animation: 180,
      chosenClass: 'brand-message-button-sortable-chosen',
      dragClass: 'brand-message-button-sortable-drag',
      draggable: '.brand-message-carousel-item-row',
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fallbackClass: 'brand-message-button-sortable-fallback',
      fallbackOnBody: true,
      forceFallback: true,
      ghostClass: 'brand-message-button-sortable-ghost',
      handle: '.brand-message-type-row-drag-handle',
      onEnd(event) {
        document.body.classList.remove('is-brand-message-button-dragging');

        const oldIndex = event.oldDraggableIndex ?? event.oldIndex;
        const newIndex = event.newDraggableIndex ?? event.newIndex;

        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) {
          return;
        }

        const maxIndex = latestCarouselItemsRef.current.length - 1;
        const boundedNewIndex = Math.max(0, Math.min(newIndex, maxIndex));
        const nextItems = moveArrayItem(latestCarouselItemsRef.current, oldIndex, boundedNewIndex);

        if (nextItems === latestCarouselItemsRef.current) {
          return;
        }

        setActiveItemEditor((editor) => (
          editor?.kind === 'carousel'
            ? { ...editor, index: getReorderedIndex(editor.index, oldIndex, boundedNewIndex) }
            : editor
        ));
        updateMessageRef.current?.({
          carousel: {
            ...(latestMessageRef.current?.carousel ?? {}),
            list: nextItems,
          },
        });
      },
      onStart() {
        document.body.classList.add('is-brand-message-button-dragging');
      },
    });

    return () => {
      sortable.destroy();
      document.body.classList.remove('is-brand-message-button-dragging');
    };
  }, [isTemplateMode, message.chatBubbleType, message.carousel?.isUseIntro]);

  useImperativeHandle(ref, () => ({
    revealValidation() {
      const nextIssues = isTemplateRegistrationPurpose
        ? getBrandMessageTemplateRegistrationIssues(message)
        : getBrandMessageValidationIssues(message);
      const nextValidation = getBrandCouponValidation(message.coupon, { chatBubbleType: message.chatBubbleType });
      const firstInvalidItemEditor = getFirstInvalidBrandItemEditor(message);
      const firstInvalidButton = isCarouselType
        ? null
        : message.buttons.find((button) => !getBrandButtonValidation(button, {
            maxNameLength: topLevelButtonMaxNameLength,
          }).isValid);

      setValidationVisible(true);
      setCouponValidationVisible(true);

      if (firstInvalidItemEditor) {
        setActiveVariableKey('');
        setActiveButtonId('');
        setCouponFocusField('');
        setCouponPanelOpen(false);
        setActiveItemEditor(firstInvalidItemEditor);
      } else if (firstInvalidButton) {
        setActiveVariableKey('');
        setActiveItemEditor(null);
        setCouponFocusField('');
        setCouponPanelOpen(false);
        setActiveButtonId(firstInvalidButton.id);
      } else if (message.coupon && !nextValidation.isValid) {
        setActiveVariableKey('');
        setActiveButtonId('');
        setActiveItemEditor(null);
        setCouponPanelOpen(true);
        setCouponFocusField(nextValidation.firstField);
        setCouponFocusRequest((current) => current + 1);
      }

      return nextIssues.length === 0;
    },
  }), [isCarouselType, isTemplateRegistrationPurpose, message, topLevelButtonMaxNameLength]);

  function updateMessage(patch) {
    const nextMessage = normalizeBrandMessageDraftValue({ ...message, ...patch });

    if (!isControlled) {
      setUncontrolledValue(nextMessage);
    }

    onChange?.(nextMessage);
  }

  function closeCouponPanel({ validate = true } = {}) {
    if (validate && message.coupon) {
      setCouponValidationVisible(true);
    }

    setCouponFocusField('');
    setCouponPanelOpen(false);
  }

  function closeItemPanel() {
    setActiveItemEditor(null);
  }

  function handleSenderProfileChange(senderProfileId) {
    const nextTemplates = getAvailableBrandTemplates(templates, senderProfileId);
    const nextTemplate = nextTemplates.find((template) => isSelectedBrandTemplate(template, message.templateCode)) ?? null;
    const nextTemplateCode = nextTemplate ? message.templateCode : '';

    setActiveVariableKey('');
    setActiveButtonId('');
    closeItemPanel();
    closeCouponPanel();
    updateMessage({
      imageParameters: nextTemplateCode ? message.imageParameters : {},
      mode: nextTemplateCode ? 'template' : 'freestyle',
      senderProfileId,
      templateCode: nextTemplateCode,
      templateParameter: nextTemplate ? getInitialTemplateVariables(nextTemplate, 'kakao', message.templateParameter) : {},
      videoParameter: nextTemplateCode ? message.videoParameter : null,
    });
  }

  function hideScheduleIfEmpty(nextValue) {
    if (!nextValue) {
      setScheduleVisible(false);
    }
  }

  function handleTemplateSelect(template) {
    setActiveVariableKey('');
    setActiveButtonId('');
    closeItemPanel();
    closeCouponPanel();
    updateMessage({
      imageParameters: {},
      mode: 'template',
      templateCode: getBrandTemplateCode(template),
      templateParameter: getInitialTemplateVariables(template, 'kakao', message.templateParameter),
      videoParameter: null,
    });
  }

  function handleTemplateStart(template) {
    const { draft } = createBrandMessageDraftFromTemplate(template, message);

    setActiveVariableKey('');
    setActiveButtonId('');
    closeItemPanel();
    closeCouponPanel();
    updateMessage(draft);
  }

  function renderBrandTemplateDialogCard({ isSelected, key, onSelect, template }) {
    return (
      <BrandMessageTemplateDialogCard
        isSelected={isSelected}
        key={key}
        onSelect={onSelect}
        template={template}
      />
    );
  }

  function renderBrandTemplateDialogToolbarAction({
    closeDialog,
    isSelectionVisible,
    selectedTemplate: dialogSelectedTemplate,
  }) {
    const hasSelectedTemplate = Boolean(dialogSelectedTemplate && isSelectionVisible);

    return (
      <BrandTemplateSelectionAction
        disabled={!hasSelectedTemplate}
        onCopyEdit={() => {
          if (!dialogSelectedTemplate) return;

          handleTemplateStart(dialogSelectedTemplate);
          closeDialog?.();
        }}
        onUseAsIs={() => {
          if (!dialogSelectedTemplate) return;

          handleTemplateSelect(dialogSelectedTemplate);
          closeDialog?.();
        }}
        selectedTemplateName={dialogSelectedTemplate?.name}
      />
    );
  }

  function clearSelectedTemplate() {
    setActiveVariableKey('');
    setActiveButtonId('');
    closeItemPanel();
    closeCouponPanel();
    updateMessage({
      imageParameters: {},
      mode: 'freestyle',
      templateCode: '',
      templateParameter: {},
      videoParameter: null,
    });
  }

  function updateTemplateParameter(key, nextAssignment) {
    updateMessage({
      templateParameter: {
        ...message.templateParameter,
        [key]: nextAssignment,
      },
    });
  }

  function handleChatBubbleTypeChange(chatBubbleType) {
    const nextButtonMaxCount = getBrandTopLevelButtonLimit(chatBubbleType, Boolean(message.coupon));
    const nextButtons = message.buttons.slice(0, nextButtonMaxCount);

    if (!nextButtons.some((button) => button.id === activeButtonId)) {
      setActiveButtonId('');
    }

    closeCouponPanel();
    closeItemPanel();
    updateMessage({
      buttons: withBrandButtonOrdering(nextButtons),
      ...getBrandTypeSeedPatch(message, chatBubbleType),
    });
  }

  function updateWideItem(index, patch) {
    updateMessage({
      item: {
        ...(message.item ?? {}),
        list: wideItems.map((item, itemIndex) => (
          itemIndex === index ? { ...item, ...patch } : item
        )),
      },
    });
  }

  function addWideItem() {
    if (wideItems.length >= 4) {
      return;
    }

    setActiveVariableKey('');
    setActiveButtonId('');
    closeCouponPanel();
    setActiveItemEditor({ index: wideItems.length, kind: 'wide' });
    updateMessage({
      item: {
        ...(message.item ?? {}),
        list: [...wideItems, createBrandListItem('wide', wideItems.length)],
      },
    });
  }

  function removeWideItem(index) {
    setActiveItemEditor((editor) => getEditorAfterItemRemoval(editor, 'wide', index));
    updateMessage({
      item: {
        ...(message.item ?? {}),
        list: wideItems.filter((_, itemIndex) => itemIndex !== index),
      },
    });
  }

  function updateCarouselItem(index, patch) {
    updateMessage({
      carousel: {
        ...(message.carousel ?? {}),
        list: carouselItems.map((item, itemIndex) => (
          itemIndex === index ? { ...item, ...patch } : item
        )),
      },
    });
  }

  function addCarouselItemButton(index) {
    const item = carouselItems[index];
    const itemButtons = normalizeBrandItemButtons(item?.buttons);

    if (!item || itemButtons.length >= brandCarouselButtonMaxCount) {
      return;
    }

    const nextButton = {
      id: createBrandButtonId(),
      linkMo: '',
      linkPc: '',
      name: `버튼 ${itemButtons.length + 1}`,
      type: 'WL',
    };

    setActiveVariableKey('');
    setActiveButtonId('');
    closeCouponPanel();
    setActiveItemEditor({
      buttonId: nextButton.id,
      index,
      kind: 'carousel',
      panel: 'button',
    });
    updateCarouselItem(index, {
      buttons: withBrandButtonOrdering([...itemButtons, nextButton]),
    });
  }

  function removeCarouselItemButton(index, buttonId) {
    const item = carouselItems[index];
    const nextButtons = normalizeBrandItemButtons(item?.buttons).filter((button) => button.id !== buttonId);

    setActiveItemEditor((editor) => (
      editor?.kind === 'carousel' && editor.index === index && editor.buttonId === buttonId
        ? { index, kind: 'carousel', panel: 'details' }
        : editor
    ));
    updateCarouselItem(index, {
      buttons: withBrandButtonOrdering(nextButtons),
    });
  }

  function updateCarouselItemButton(index, buttonId, patch) {
    const item = carouselItems[index];

    if (!item) {
      return;
    }

    updateCarouselItem(index, {
      buttons: withBrandButtonOrdering(normalizeBrandItemButtons(item.buttons).map((button) => (
        button.id === buttonId ? { ...button, ...patch } : button
      ))),
    });
  }

  function addCarouselItemCoupon(index) {
    const item = carouselItems[index];

    if (!item || item.coupon) {
      return;
    }

    const nextCoupon = normalizeBrandCoupon({
      id: createBrandCouponId(),
      type: 'AMOUNT',
    });

    setActiveVariableKey('');
    setActiveButtonId('');
    closeCouponPanel({ validate: false });
    setActiveItemEditor({
      index,
      kind: 'carousel',
      panel: 'coupon',
    });
    updateCarouselItem(index, { coupon: nextCoupon });
  }

  function removeCarouselItemCoupon(index) {
    setActiveItemEditor((editor) => (
      editor?.kind === 'carousel' && editor.index === index && editor.panel === 'coupon'
        ? { index, kind: 'carousel', panel: 'details' }
        : editor
    ));
    updateCarouselItem(index, { coupon: null });
  }

  function updateCarouselItemCoupon(index, patch) {
    const item = carouselItems[index];

    if (!item?.coupon) {
      return;
    }

    updateCarouselItem(index, {
      coupon: normalizeBrandCoupon({ ...item.coupon, ...patch }),
    });
  }

  function openCarouselItemButtonPanel(index, buttonId) {
    setActiveVariableKey('');
    setActiveButtonId('');
    closeCouponPanel({ validate: false });
    setActiveItemEditor({
      buttonId,
      index,
      kind: 'carousel',
      panel: 'button',
    });
  }

  function openCarouselItemCouponPanel(index) {
    setActiveVariableKey('');
    setActiveButtonId('');
    closeCouponPanel({ validate: false });
    setActiveItemEditor({
      index,
      kind: 'carousel',
      panel: 'coupon',
    });
  }

  function returnToCarouselItemPanel() {
    setActiveItemEditor((editor) => (
      editor?.kind === 'carousel'
        ? { index: editor.index, kind: 'carousel', panel: 'details' }
        : editor
    ));
  }

  function updateCarouselHead(patch) {
    updateMessage({
      carousel: {
        ...(message.carousel ?? {}),
        isUseIntro: true,
        head: {
          ...createBrandCarouselIntro(),
          ...(message.carousel?.head ?? {}),
          ...patch,
        },
      },
    });
  }

  function updateCarouselTail(patch) {
    const currentTail = normalizeBrandCarouselTail(message.carousel?.tail ?? message.carousel?.moreButton) ?? createBrandCarouselTail();
    const patchedTail = {
      ...currentTail,
      ...patch,
    };
    const hasLink = hasBrandCarouselTailLink(patchedTail);
    const nextTail = normalizeBrandCarouselTail({
      ...patchedTail,
      isMoreButton: patch.isMoreButton ?? (patchedTail.isMoreButton || hasLink),
    });

    updateMessage({
      carousel: {
        ...(message.carousel ?? {}),
        moreButton: nextTail,
        tail: nextTail,
      },
    });
  }

  function updateCarouselIntroEnabled(isUseIntro) {
    setActiveItemEditor((current) => (
      !isUseIntro && current?.kind === 'carouselIntro' ? null : current
    ));
    setActiveVariableKey('');
    setActiveButtonId('');
    closeCouponPanel();
    updateMessage({
      carousel: {
        ...(message.carousel ?? {}),
        head: isUseIntro
          ? {
              ...createBrandCarouselIntro(),
              ...(message.carousel?.head ?? {}),
            }
          : null,
        isUseIntro,
      },
    });
  }

  function addCarouselItem() {
    const maxItems = message.chatBubbleType === 'CAROUSEL_COMMERCE' && message.carousel?.isUseIntro
      ? brandCarouselCommerceIntroMaximum
      : brandCarouselListMaximum;

    if (carouselItems.length >= maxItems) {
      return;
    }

    setActiveVariableKey('');
    setActiveButtonId('');
    closeCouponPanel();
    setActiveItemEditor({ index: carouselItems.length, kind: 'carousel', panel: 'details' });
    updateMessage({
      carousel: {
        ...(message.carousel ?? {}),
        list: [
          ...carouselItems,
          createBrandListItem(message.chatBubbleType === 'CAROUSEL_COMMERCE' ? 'commerce' : 'feed', carouselItems.length),
        ],
      },
    });
  }

  function removeCarouselItem(index) {
    setActiveItemEditor((editor) => getEditorAfterItemRemoval(editor, 'carousel', index));
    updateMessage({
      carousel: {
        ...(message.carousel ?? {}),
        list: carouselItems.filter((_, itemIndex) => itemIndex !== index),
      },
    });
  }

  function updateCommerce(patch) {
    updateMessage({
      commerce: {
        ...(message.commerce ?? {}),
        ...patch,
      },
    });
  }

  function updateVideo(patch) {
    updateMessage({
      video: {
        ...(message.video ?? {}),
        ...patch,
      },
    });
  }

  function openVariablePanel(variableKey) {
    setActiveButtonId('');
    closeItemPanel();
    closeCouponPanel();
    setActiveVariableKey(variableKey);
  }

  function openButtonPanel(buttonId) {
    setActiveVariableKey('');
    closeItemPanel();
    closeCouponPanel();
    setActiveButtonId(buttonId);
  }

  function openCouponPanel() {
    setActiveVariableKey('');
    setActiveButtonId('');
    closeItemPanel();
    setCouponFocusField('');
    setCouponPanelOpen(true);
  }

  function openWideItemPanel(index) {
    setActiveVariableKey('');
    setActiveButtonId('');
    closeCouponPanel();
    setActiveItemEditor({ index, kind: 'wide' });
  }

  function openCarouselItemPanel(index) {
    setActiveVariableKey('');
    setActiveButtonId('');
    closeCouponPanel();
    setActiveItemEditor({ index, kind: 'carousel', panel: 'details' });
  }

  function openCarouselIntroPanel() {
    setActiveVariableKey('');
    setActiveButtonId('');
    closeCouponPanel();
    setActiveItemEditor({ kind: 'carouselIntro' });
  }

  function openCarouselTailPanel() {
    setActiveVariableKey('');
    setActiveButtonId('');
    closeCouponPanel({ validate: false });
    setActiveItemEditor({ kind: 'carouselTail' });
  }

  function addButton() {
    if (!canAddButton) {
      return;
    }

    const nextIndex = message.buttons.length + 1;
    const nextButton = {
      id: createBrandButtonId(),
      linkMo: '',
      linkPc: '',
      name: `버튼 ${nextIndex}`,
      type: 'WL',
    };

    setActiveVariableKey('');
    setActiveButtonId(nextButton.id);
    closeItemPanel();
    closeCouponPanel();
    updateMessage({
      buttons: withBrandButtonOrdering([
        ...message.buttons,
        nextButton,
      ]),
    });
  }

  function removeButton(buttonId) {
    if (activeButtonId === buttonId) {
      setActiveButtonId('');
    }

    updateMessage({ buttons: withBrandButtonOrdering(message.buttons.filter((button) => button.id !== buttonId)) });
  }

  function updateButton(buttonId, patch) {
    updateMessage({
      buttons: withBrandButtonOrdering(message.buttons.map((button) => (
        button.id === buttonId ? { ...button, ...patch } : button
      ))),
    });
  }

  function addCoupon() {
    if (!canAddCoupon) {
      return;
    }

    const nextCoupon = normalizeBrandCoupon({
      id: createBrandCouponId(),
      type: 'AMOUNT',
    });

    setActiveVariableKey('');
    setActiveButtonId('');
    closeItemPanel();
    setCouponValidationVisible(false);
    setCouponFocusField('');
    setCouponPanelOpen(true);
    updateMessage({ coupon: nextCoupon });
  }

  function removeCoupon() {
    setCouponValidationVisible(false);
    setCouponFocusField('');
    setCouponPanelOpen(false);
    updateMessage({ coupon: null });
  }

  function updateCoupon(patch) {
    if (!message.coupon) {
      return;
    }

    updateMessage({ coupon: normalizeBrandCoupon({ ...message.coupon, ...patch }) });
  }

  function readImageFile(file) {
    const reader = new FileReader();

    reader.onload = () => {
      updateMessage({
        image: {
          ...(message.image ?? {}),
          imageName: file.name,
          imageUrl: reader.result,
        },
        imageFile: file,
      });
    };

    reader.readAsDataURL(file);
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      setImageCropFile(file);
    }
  }

  function handleImageCropOpenChange(open) {
    if (!open) {
      setImageCropFile(null);
    }
  }

  function handleImageCropApply({ file }) {
    readImageFile(file);
  }

  function clearImage() {
    updateMessage({ image: null, imageFile: null });
  }

  const senderOptions = senderProfiles.map((profile) => ({
    label: `${profile.plusFriendId} (${profile.senderProfileType || '채널'})`,
    value: profile.value,
  }));
  const couponStatusLabels = shouldShowCouponValidation ? couponValidation.statusLabels : [];
  const couponValidationMessage = couponStatusLabels.length
    ? getBrandValidationTooltipMessage(couponValidation.errors)
    : '';

  return (
    <EmailSendFormRoot className={['brand-message-send-form-root', className].filter(Boolean).join(' ')} {...props}>
      <EmailSendFormSelection>
        <EmailSendFormRow>
          <EmailSendFormLabel
            className={[
              'brand-message-sender-label',
              'brand-message-local-validation-label',
              visibleSenderIssue && 'is-invalid',
            ].filter(Boolean).join(' ')}
            warnings={senderWarnings}
          >
            발신 채널
          </EmailSendFormLabel>
          <EmailSendFormSelect
            ariaLabel="발신 채널 선택"
            emptyActionLabel={senderProfileCreateLabel}
            emptyDescription="연결된 알림톡 채널이 없습니다. 채널을 연결하면 알림톡을 발송할 수 있습니다."
            onEmptyAction={onSenderProfileCreate}
            onValueChange={handleSenderProfileChange}
            options={senderOptions}
            placeholder="발신 채널 선택"
            showMenuLabel={false}
            value={message.senderProfileId}
          />
        </EmailSendFormRow>

        {!isTemplateRegistrationPurpose ? (
          <EmailSendFormRow
            action={!scheduleVisible ? (
              <EmailSendFormGhostButton onClick={() => setScheduleVisible(true)}>
                예약
              </EmailSendFormGhostButton>
            ) : null}
            className={!scheduleVisible ? 'sms-send-form-row-before-detail-border' : ''}
          >
            <EmailSendFormLabel
              className={[
                'brand-message-recipient-label',
                'brand-message-local-validation-label',
                visibleRecipientIssue && 'is-invalid',
              ].filter(Boolean).join(' ')}
              warnings={recipientWarnings}
            >
              수신자
            </EmailSendFormLabel>
            <RecipientSelect
              {...recipientSelectProps}
              ariaLabel="브랜드 메시지 수신자 선택"
              contacts={recipientContacts}
              onValueChange={(recipient) => updateMessage({ recipient })}
              options={recipients}
              value={message.recipient}
            />
          </EmailSendFormRow>
        ) : null}

        <EmailSendFormDisclosure open={!isTemplateRegistrationPurpose && scheduleVisible}>
          <EmailSendFormRow className="sms-send-form-row-before-detail-border">
            <EmailSendFormLabel htmlFor="brand-message-send-form-when">예약</EmailSendFormLabel>
            <EmailSendFormScheduleField
              id="brand-message-send-form-when"
              onCollapseEmpty={hideScheduleIfEmpty}
              onEmptyBackspace={() => setScheduleVisible(false)}
              onNowSelect={() => {
                updateMessage({ scheduledAt: '' });
                setScheduleVisible(false);
              }}
              onValueChange={(scheduledAt) => updateMessage({ scheduledAt })}
              options={scheduleOptions}
              placeholder="날짜 또는 시간을 입력하세요"
              value={message.scheduledAt}
            />
          </EmailSendFormRow>
        </EmailSendFormDisclosure>

        {!isTemplateMode ? (
          <>
            <EmailSendFormRow className="brand-message-send-form-group-start">
              <EmailSendFormLabel>메시지 타입</EmailSendFormLabel>
              <EmailSendFormSelect
                ariaLabel="브랜드 메시지 타입 선택"
                onValueChange={handleChatBubbleTypeChange}
                options={brandChatBubbleTypeOptions}
                showMenuLabel={false}
                value={message.chatBubbleType}
              />
            </EmailSendFormRow>

            <EmailSendFormDisclosure open={isTopLevelImageMessage}>
              <EmailSendFormRow>
                <EmailSendFormLabel
                  className={[
                    'brand-message-image-label',
                    'brand-message-local-validation-label',
                    visibleImageIssue && 'is-invalid',
                  ].filter(Boolean).join(' ')}
                  warnings={imageWarnings}
                >
                  이미지
                </EmailSendFormLabel>
                <div className="brand-message-image-field">
                  <input
                    accept="image/png,image/jpeg"
                    className="brand-message-file-input"
                    disabled={Boolean(message.image?.imageUrl)}
                    onChange={handleImageChange}
                    ref={fileInputRef}
                    type="file"
                  />
                  {message.image?.imageUrl ? (
                    <span className="sms-send-form-upload-tag brand-message-image-upload-tag">
                      <span
                        aria-hidden="true"
                        className="sms-send-form-upload-preview"
                        style={{ backgroundImage: `url(${message.image.imageUrl})` }}
                      />
                      <span className="sms-send-form-upload-file">
                        <span title={message.image.imageName || '업로드 이미지'}>
                          {formatBrandImageTagLabel(message.image.imageName)}
                        </span>
                      </span>
                      <button
                        aria-label="첨부 이미지 제거"
                        className="sms-send-form-upload-remove"
                        onClick={clearImage}
                        type="button"
                      >
                        <X aria-hidden="true" size={14} />
                      </button>
                    </span>
                  ) : (
                    <EmailSendFormGhostButton onClick={() => fileInputRef.current?.click()}>
                      <ImagePlus aria-hidden="true" size={14} />
                      업로드
                    </EmailSendFormGhostButton>
                  )}
                </div>
              </EmailSendFormRow>
              <EmailSendFormRow>
                <EmailSendFormLabel>이미지 이동 링크</EmailSendFormLabel>
                <EmailSendFormInput
                  onChange={(event) => updateMessage({
                    image: {
                      ...(message.image ?? {}),
                      imageLink: event.target.value,
                    },
                  })}
                  placeholder="https://example.com"
                  type="url"
                  value={message.image?.imageLink ?? ''}
                />
              </EmailSendFormRow>
              <ImageCropDialog
                file={imageCropFile}
                onApply={handleImageCropApply}
                onOpenChange={handleImageCropOpenChange}
                open={Boolean(imageCropFile)}
                preset={topLevelImageCropPreset}
              />
            </EmailSendFormDisclosure>

          </>
        ) : null}

        <EmailSendFormRow className="brand-message-send-form-group-start">
          <EmailSendFormLabel>{isTemplateRegistrationPurpose ? '템플릿 옵션' : '발송 옵션'}</EmailSendFormLabel>
          <div className="brand-message-option-list">
            {!isTemplateRegistrationPurpose ? (
              <label className="brand-message-checkbox">
                <input
                  checked={message.pushAlarm}
                  onChange={(event) => updateMessage({ pushAlarm: event.target.checked })}
                  type="checkbox"
                />
                <span>푸시 알림</span>
              </label>
            ) : null}
            <label className="brand-message-checkbox">
              <input
                checked={message.adult}
                onChange={(event) => updateMessage({ adult: event.target.checked })}
                type="checkbox"
              />
              <span>성인용</span>
            </label>
            {!isTemplateRegistrationPurpose ? (
              <label className="brand-message-checkbox">
                <input
                  checked={message.fallbackEnabled}
                  onChange={(event) => updateMessage({
                    fallbackAdvertisementEnabled: event.target.checked,
                    fallbackEnabled: event.target.checked,
                    fallbackSenderNumber: event.target.checked
                      ? message.fallbackSenderNumber || fallbackSenderNumbers[0]?.value || ''
                      : message.fallbackSenderNumber,
                    fallbackUnsubscribeNumber: '',
                  })}
                  type="checkbox"
                />
                <span>SMS 대체</span>
              </label>
            ) : null}
          </div>
        </EmailSendFormRow>

        <EmailSendFormDisclosure open={!isTemplateRegistrationPurpose && message.fallbackEnabled}>
          <EmailSendFormRow
            className="brand-message-send-form-fallback-row"
          >
            <EmailSendFormLabel
              className={[
                'brand-message-fallback-label',
                'brand-message-local-validation-label',
                visibleFallbackSenderIssue && 'is-invalid',
              ].filter(Boolean).join(' ')}
              warnings={fallbackSenderWarnings}
            >
              SMS 대체
            </EmailSendFormLabel>
            <SmsFallbackSelect
              description="브랜드메시지 실패 시 SMS로 대체 발송하려면 승인된 발신번호가 필요합니다."
              enabled={message.fallbackEnabled}
              onCreateSenderNumber={onFallbackSenderNumberCreate}
              onValueChange={(nextFallback) => updateMessage({
                fallbackEnabled: nextFallback.enabled,
                fallbackSenderNumber: nextFallback.value,
              })}
              options={fallbackSenderNumbers}
              value={message.fallbackSenderNumber}
            />
          </EmailSendFormRow>
          <EmailSendFormRow className="brand-message-send-form-fallback-ad-row">
            <EmailSendFormLabel description="브랜드 메시지의 문자 대체발송에는 서버에 설정된 NOTI 공통 080 번호가 자동으로 적용됩니다.">
              080 번호
            </EmailSendFormLabel>
            <span className="email-send-form-placeholder">NOTI 공통 080 자동 적용</span>
          </EmailSendFormRow>
        </EmailSendFormDisclosure>
      </EmailSendFormSelection>

      <EmailSendFormCanvas
        aria-label={isTemplateMode ? '브랜드 메시지 템플릿 본문' : '브랜드 메시지 본문'}
        data-empty={shouldRenderContentField && isContentRequired && isBodyEmpty ? 'true' : undefined}
        className={['brand-message-send-form-canvas', isTemplateMode && 'is-readonly'].filter(Boolean).join(' ')}
      >
        {isTemplateMode ? (
          <div className="brand-message-template-workspace">
            <MessageTemplateDocument
              activeKey={activeVariableKey}
              className="brand-message-template-document"
              onVariableClick={openVariablePanel}
              text={selectedTemplate.content ?? ''}
              variables={message.templateParameter}
            />
            <div className="brand-message-template-actions">
              <EmailSendFormTemplateDialog
                emptyActionHref="/templates/brand/new"
                emptyActionLabel="새 템플릿 만들기"
                initialSelectedTemplateId={selectedTemplateDialogId}
                onOpenChange={setTemplateDialogOpen}
                onTemplateSelect={handleTemplateSelect}
                open={templateDialogOpen}
                renderTemplateCard={renderBrandTemplateDialogCard}
                renderToolbarAction={renderBrandTemplateDialogToolbarAction}
                selectionMode="deferred"
                templates={templateDialogItems}
                trigger={(
                  <EmailSendFormTemplateButton className="brand-message-template-action" onClick={() => setTemplateDialogOpen(true)}>
                    템플릿 변경
                  </EmailSendFormTemplateButton>
                )}
              />
              <span aria-hidden="true" className="brand-message-template-action-separator">|</span>
              <EmailSendFormGhostButton className="brand-message-template-action" onClick={clearSelectedTemplate}>
                템플릿 해제
              </EmailSendFormGhostButton>
            </div>
            <div className="brand-message-template-parameter-panel">
              <div className="brand-message-template-meta">
                <span className="brand-message-template-meta-label">발송 방식</span>
                <strong>템플릿 발송으로 사용</strong>
                <span className="brand-message-template-meta-label">선택 템플릿</span>
                <strong title={selectedTemplateName}>{selectedTemplateName}</strong>
                <span className="brand-message-template-meta-label">templateCode</span>
                <code title={selectedTemplateCode}>{selectedTemplateCode || '-'}</code>
              </div>
              {selectedTemplateVariables.length ? (
                <div className="brand-message-template-variable-list" aria-label="템플릿 변수">
                  {selectedTemplateVariables.map(([key]) => {
                    const value = getMessageTemplateVariableValue(message.templateParameter, key);
                    const isMissing = !value;

                    return (
                      <button
                        aria-pressed={activeVariableKey === key}
                        className="message-template-variable brand-message-template-variable-chip"
                        data-missing={isMissing ? 'true' : undefined}
                        key={key}
                        onClick={() => openVariablePanel(key)}
                        type="button"
                      >
                        <code>{getMessageTemplateVariableToken(key, 'kakao')}</code>
                        <span>{isMissing ? '필요' : '입력됨'}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="brand-message-template-empty-variables">
                  선택한 템플릿에는 입력할 변수가 없습니다.
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {shouldRenderTemplatePickerOnly ? (
              <div className="brand-message-template-picker-row">
                <EmailSendFormTemplateDialog
                  emptyActionHref="/templates/brand/new"
                  emptyActionLabel="새 템플릿 만들기"
                  onOpenChange={setTemplateDialogOpen}
                  onTemplateSelect={handleTemplateSelect}
                  open={templateDialogOpen}
                  renderTemplateCard={renderBrandTemplateDialogCard}
                  renderToolbarAction={renderBrandTemplateDialogToolbarAction}
                  selectionMode="deferred"
                  templates={templateDialogItems}
                  trigger={(
                    <EmailSendFormTemplateButton onClick={() => setTemplateDialogOpen(true)}>
                      템플릿 선택
                    </EmailSendFormTemplateButton>
                  )}
                />
              </div>
            ) : null}
            {shouldRenderContentField && isContentRequired && isBodyEmpty ? (
              <EmailSendFormEmptyState
                className="brand-message-send-form-empty-state"
                emptyActionHref="/templates/brand/new"
                emptyActionLabel="새 템플릿 만들기"
                onOpenTemplateDialog={() => setTemplateDialogOpen(true)}
                onTemplateDialogOpenChange={setTemplateDialogOpen}
                onTemplateSelect={handleTemplateSelect}
                renderTemplateCard={renderBrandTemplateDialogCard}
                renderToolbarAction={renderBrandTemplateDialogToolbarAction}
                selectionMode="deferred"
                templateDialogOpen={templateDialogOpen}
                templates={templateDialogItems}
              />
            ) : null}
            {shouldRenderContentField ? (
              <div className="brand-message-content-field">
                {visibleBodyContentIssue ? (
                  <div className="brand-message-content-placeholder-error" aria-hidden="true">
                    <BrandMessageValidationIssueIcon />
                    <span>브랜드 메시지 본문을 입력하세요.</span>
                  </div>
                ) : null}
                <EmailSendFormTextarea
                  aria-describedby={visibleBodyLengthIssue ? bodyWarningId : undefined}
                  aria-label="브랜드 메시지 본문"
                  aria-invalid={visibleBodyContentIssue || visibleBodyLengthIssue ? 'true' : undefined}
                  className={visibleBodyLengthIssue ? 'review-error' : ''}
                  maxLength={maxLength}
                  onChange={(event) => updateMessage({ content: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === '/' && isBodyEmpty) {
                      event.preventDefault();
                      setTemplateDialogOpen(true);
                    }
                  }}
                  placeholder={visibleBodyContentIssue ? '' : '브랜드 메시지 본문을 입력하세요.'}
                  rows={9}
                  value={message.content}
                />
                <div className="brand-message-char-count">
                  {message.content.length} / {maxLength.toLocaleString()}
                </div>
                {visibleBodyLengthIssue ? (
                  <p className="brand-message-body-warning" id={bodyWarningId} role="alert">
                    {visibleBodyLengthIssue.message}
                  </p>
                ) : null}
              </div>
            ) : null}
            <BrandMessageTypeFields
              activeItemEditor={activeItemEditor}
              carouselItems={carouselItems}
              carouselItemListRef={carouselItemListRef}
              message={message}
              onCarouselIntroEdit={openCarouselIntroPanel}
              onCarouselIntroToggle={updateCarouselIntroEnabled}
              onCarouselItemAdd={addCarouselItem}
              onCarouselItemEdit={openCarouselItemPanel}
              onCarouselItemRemove={removeCarouselItem}
              onCarouselTailChange={updateCarouselTail}
              onCarouselTailEdit={openCarouselTailPanel}
              onCommerceChange={updateCommerce}
              onHeaderChange={(header) => updateMessage({ header })}
              onVideoChange={updateVideo}
              onWideItemAdd={addWideItem}
              onWideItemEdit={openWideItemPanel}
              onWideItemRemove={removeWideItem}
              showValidation={validationVisible}
              validationIssues={validationIssues}
              wideItemListRef={wideItemListRef}
              wideItems={wideItems}
            />
            {!isCarouselType ? (
              <>
                <div className="brand-message-button-editor">
                  <div className="brand-message-button-editor-header">
                    <EmailSendFormLabel
                      className={[
                        'brand-message-button-editor-label',
                        'brand-message-local-validation-label',
                        buttonEditorWarnings.length && 'is-invalid',
                      ].filter(Boolean).join(' ')}
                      warnings={buttonEditorWarnings}
                    >
                      버튼 {message.buttons.length}/{buttonMaxCount}
                    </EmailSendFormLabel>
                    <EmailSendFormGhostButton disabled={!canAddButton} onClick={addButton}>
                      <Plus aria-hidden="true" size={14} />
                      추가
                    </EmailSendFormGhostButton>
                  </div>
                  <div className="brand-message-button-list" ref={buttonListRef}>
                    {message.buttons.map((button, index) => {
                      const buttonValidation = getBrandButtonValidation(button, {
                        maxNameLength: topLevelButtonMaxNameLength,
                      });
                      const isInvalid = validationVisible && !buttonValidation.isValid;
                      const validationMessage = isInvalid ? getBrandValidationTooltipMessage(buttonValidation.errors) : '';

                      return (
                        <div
                          aria-invalid={isInvalid ? 'true' : undefined}
                          className={[
                            'brand-message-button-row',
                            button.id === activeButtonId && 'is-active',
                            isInvalid && 'is-invalid',
                          ].filter(Boolean).join(' ')}
                          data-button-id={button.id}
                          key={button.id}
                        >
                          {isInvalid ? (
                            <BrandMessageValidationIssueTooltip
                              className="brand-message-button-validation-icon"
                              message={validationMessage}
                            />
                          ) : null}
                          <button
                            aria-label={`${button.name || `버튼 ${index + 1}`} 순서 변경`}
                            className="brand-message-button-drag-handle"
                            type="button"
                          >
                            <GripVertical aria-hidden="true" size={16} />
                          </button>
                          <span className="brand-message-button-index">{index + 1}</span>
                          <strong><span className="brand-message-button-title-text">{button.name || '이름 없음'}</span></strong>
                          <em>{getBrandMessageButtonTypeLabel(button.type ?? 'WL')}</em>
                          <button
                            aria-label={`${button.name || '버튼'} 수정`}
                            className="brand-message-button-action"
                            onClick={() => openButtonPanel(button.id)}
                            type="button"
                          >
                            <Pencil aria-hidden="true" size={15} />
                          </button>
                          <button
                            aria-label={`${button.name || '버튼'} 삭제`}
                            className="brand-message-button-action"
                            onClick={() => removeButton(button.id)}
                            type="button"
                          >
                            <Trash2 aria-hidden="true" size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="brand-message-coupon-editor">
                  <div className="brand-message-coupon-editor-header">
                    <span>쿠폰 {message.coupon ? 1 : 0}/1</span>
                    {canAddCoupon ? (
                      <EmailSendFormGhostButton onClick={addCoupon}>
                        <Plus aria-hidden="true" size={14} />
                        추가
                      </EmailSendFormGhostButton>
                    ) : (
                      <EmailSendFormGhostButton disabled>
                        <Ticket aria-hidden="true" size={14} />
                        최대 1개
                      </EmailSendFormGhostButton>
                    )}
                  </div>
                  {message.coupon ? (
                    <div
                      aria-invalid={couponStatusLabels.length ? 'true' : undefined}
                      className={[
                        'brand-message-coupon-row',
                        couponPanelOpen && 'is-active',
                        couponStatusLabels.length && 'is-invalid',
                      ].filter(Boolean).join(' ')}
                    >
                      {couponStatusLabels.length ? (
                        <>
                          <BrandMessageValidationIssueTooltip
                            className="brand-message-coupon-validation-icon"
                            message={couponValidationMessage}
                          />
                          <span aria-hidden="true" className="brand-message-coupon-row-icon" />
                        </>
                      ) : (
                        <span aria-hidden="true" className="brand-message-coupon-row-icon">
                          <Ticket size={15} />
                        </span>
                      )}
                      <div className="brand-message-coupon-row-copy">
                        <strong>{getBrandCouponTitle(message.coupon)}</strong>
                        <span>{message.coupon.description || '쿠폰 설명 없음'}</span>
                      </div>
                      <button
                        aria-label={`${getBrandCouponTitle(message.coupon)} 수정`}
                        className="brand-message-coupon-action"
                        onClick={openCouponPanel}
                        type="button"
                      >
                        <Pencil aria-hidden="true" size={15} />
                      </button>
                      <button
                        aria-label={`${getBrandCouponTitle(message.coupon)} 삭제`}
                        className="brand-message-coupon-action"
                        onClick={removeCoupon}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={15} />
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </>
        )}
      </EmailSendFormCanvas>
      {variablePanelRoot
        ? createPortal(
            <MessageTemplateVariablePanel
              onClose={() => setActiveVariableKey('')}
              onValueChange={updateTemplateParameter}
              selectedVariable={selectedVariable}
            />,
            variablePanelRoot
          )
        : null}
      {variablePanelRoot
        ? createPortal(
            <BrandMessageButtonPanel
              button={activeButton}
              maxNameLength={topLevelButtonMaxNameLength}
              onChange={(patch) => activeButton && updateButton(activeButton.id, patch)}
              onClose={() => setActiveButtonId('')}
              showValidation={validationVisible}
              validation={activeButtonValidation}
            />,
            variablePanelRoot
          )
        : null}
      {variablePanelRoot
        ? createPortal(
            <BrandMessageCouponPanel
              chatBubbleType={message.chatBubbleType}
              coupon={activeCoupon}
              focusField={couponFocusField}
              focusRequest={couponFocusRequest}
              onChange={updateCoupon}
              onClose={closeCouponPanel}
              showValidation={shouldShowCouponValidation}
              validation={couponValidation}
            />,
            variablePanelRoot
          )
        : null}
      {variablePanelRoot
        ? createPortal(
            <BrandMessageWideItemPanel
              index={activeItemEditor?.kind === 'wide' ? activeItemEditor.index : -1}
              item={activeWideItem}
              onChange={(patch) => activeItemEditor?.kind === 'wide' && updateWideItem(activeItemEditor.index, patch)}
              onClose={closeItemPanel}
              showValidation={validationVisible}
            />,
            variablePanelRoot
          )
        : null}
      {variablePanelRoot
        ? createPortal(
            <BrandMessageCarouselIntroPanel
              head={activeCarouselIntro}
              onChange={updateCarouselHead}
              onClose={closeItemPanel}
              showValidation={validationVisible}
            />,
            variablePanelRoot
          )
        : null}
      {variablePanelRoot
        ? createPortal(
            <BrandMessageCarouselTailPanel
              onChange={updateCarouselTail}
              onClose={closeItemPanel}
              showValidation={validationVisible}
              tail={activeCarouselTail}
              validation={activeCarouselTailValidation}
            />,
            variablePanelRoot
          )
        : null}
      {variablePanelRoot
        ? createPortal(
            <BrandMessageCarouselItemPanel
              activeButtonId={activeCarouselItemPanel === 'button' ? activeItemEditor?.buttonId ?? '' : ''}
              index={activeItemEditor?.kind === 'carousel' ? activeItemEditor.index : -1}
              isCouponActive={activeCarouselItemPanel === 'coupon'}
              isCommerce={message.chatBubbleType === 'CAROUSEL_COMMERCE'}
              item={activeCarouselItemPanel === 'details' ? activeCarouselItem : null}
              onButtonAdd={() => activeItemEditor?.kind === 'carousel' && addCarouselItemButton(activeItemEditor.index)}
              onButtonEdit={(buttonId) => activeItemEditor?.kind === 'carousel' && openCarouselItemButtonPanel(activeItemEditor.index, buttonId)}
              onButtonRemove={(buttonId) => activeItemEditor?.kind === 'carousel' && removeCarouselItemButton(activeItemEditor.index, buttonId)}
              onChange={(patch) => activeItemEditor?.kind === 'carousel' && updateCarouselItem(activeItemEditor.index, patch)}
              onClose={closeItemPanel}
              onCouponAdd={() => activeItemEditor?.kind === 'carousel' && addCarouselItemCoupon(activeItemEditor.index)}
              onCouponEdit={() => activeItemEditor?.kind === 'carousel' && openCarouselItemCouponPanel(activeItemEditor.index)}
              onCouponRemove={() => activeItemEditor?.kind === 'carousel' && removeCarouselItemCoupon(activeItemEditor.index)}
              showValidation={validationVisible}
            />,
            variablePanelRoot
          )
        : null}
      {variablePanelRoot
        ? createPortal(
            <BrandMessageButtonPanel
              backLabel="슬라이드 상세로 돌아가기"
              button={activeCarouselItemButton}
              ignoreSelector={brandMessageInspectorIgnoreSelector}
              maxNameLength={8}
              onBack={returnToCarouselItemPanel}
              onChange={(patch) => (
                activeItemEditor?.kind === 'carousel' && activeCarouselItemButton
                  ? updateCarouselItemButton(activeItemEditor.index, activeCarouselItemButton.id, patch)
                  : null
              )}
              onClose={closeItemPanel}
              showValidation={validationVisible}
              summary={activeCarouselItem?.title || `슬라이드 ${(activeItemEditor?.index ?? 0) + 1}`}
              testId="brand-carousel-button-sidebar"
              title="슬라이드 버튼"
              titleId="brand-message-carousel-button-inspector-title"
              validation={activeCarouselButtonValidation}
            />,
            variablePanelRoot
          )
        : null}
      {variablePanelRoot
        ? createPortal(
            <BrandMessageCouponPanel
              backLabel="슬라이드 상세로 돌아가기"
              chatBubbleType={message.chatBubbleType}
              coupon={activeCarouselItemCoupon}
              focusField={activeCarouselCouponValidation.firstField}
              ignoreSelector={brandMessageInspectorIgnoreSelector}
              onBack={returnToCarouselItemPanel}
              onChange={(patch) => activeItemEditor?.kind === 'carousel' && updateCarouselItemCoupon(activeItemEditor.index, patch)}
              onClose={closeItemPanel}
              showValidation={validationVisible && Boolean(activeCarouselItemCoupon)}
              summary={activeCarouselItem?.title || `슬라이드 ${(activeItemEditor?.index ?? 0) + 1}`}
              testId="brand-carousel-coupon-sidebar"
              title="슬라이드 쿠폰"
              titleId="brand-message-carousel-coupon-inspector-title"
              validation={activeCarouselCouponValidation}
            />,
            variablePanelRoot
          )
        : null}
    </EmailSendFormRoot>
  );
});
