#!/usr/bin/env node

import { constants as fsConstants } from 'node:fs';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultBizgoCdnRoot = path.resolve(
  rootDir,
  '../bizgo/bizgo-brand-msg/cdn.bizgo.io/omni-front-sdk/prod'
);
const defaultBizgoWwwRoot = path.resolve(rootDir, '../bizgo/bizgo-brand-msg/www.bizgo.io');
const bizgoCdnRoot = process.env.BIZGO_BRAND_MESSAGE_CDN_ROOT
  ? path.resolve(process.env.BIZGO_BRAND_MESSAGE_CDN_ROOT)
  : defaultBizgoCdnRoot;
const bizgoWwwRoot = process.env.BIZGO_BRAND_MESSAGE_ROOT
  ? path.resolve(process.env.BIZGO_BRAND_MESSAGE_ROOT)
  : defaultBizgoWwwRoot;

const args = new Set(process.argv.slice(2));
const reportArg = process.argv.find((arg) => arg.startsWith('--write-report='));
const shouldReport = args.has('--report') || Boolean(reportArg);
const shouldJson = args.has('--json');
const shouldEnforceResolution = args.has('--enforce-resolution');
const reportPath = reportArg ? path.resolve(rootDir, reportArg.slice('--write-report='.length)) : '';

const files = {
  bizgoSdkChunk: path.join(bizgoCdnRoot, 'chunks/brandMessageTemplate.js'),
  bizgoTypes: path.join(bizgoWwwRoot, 'types/domain/kakao.ts'),
  form: path.join(rootDir, 'src/components/ui/BrandMessageSendForm.jsx'),
  preview: path.join(rootDir, 'src/components/ui/BrandMessagePreview.jsx'),
  payloads: path.join(rootDir, 'src/features/console/messageSend/payloads.js'),
  service: path.join(rootDir, 'src/server/messages/service.js'),
  imageCropUtils: path.join(rootDir, 'src/components/ui/imageCropUtils.js'),
  styles: path.join(rootDir, 'src/styles/components.css'),
};

const sourceAnchors = [
  {
    id: 'source.types',
    description: 'Bizgo exposes all 8 brand-message type codes.',
    file: 'bizgoTypes',
    needles: ['FT = "FT"', 'FI = "FI"', 'FW = "FW"', 'FL = "FL"', 'FC = "FC"', 'FP = "FP"', 'FM = "FM"', 'FA = "FA"'],
  },
  {
    id: 'source.type-config.content',
    description: 'Bizgo SDK contains content max, line-break, variable, and URL-ban validation anchors.',
    file: 'bizgoSdkChunk',
    needles: ['"max-line-break"', '"max-variable-count"', '"valid-variable-names"', 'includeNoUrls: !0'],
  },
  {
    id: 'source.type-config.image-upload',
    description: 'Bizgo SDK contains type-specific image upload guides and msgType mapping anchors.',
    file: 'bizgoSdkChunk',
    needles: [
      'WIDE_ITEM_LIST_FIRST',
      'CAROUSEL_COMMERCE_INTRO',
      'PREMIUM_VIDEO: "PREMIUM_VIDEO"',
      'COMMERCE: "COMMERCE"',
      'message: "가로 500px 이상 등록 가능합니다."',
      'message: "용량은 최대 5MB까지 등록 가능합니다."',
    ],
  },
  {
    id: 'source.type-config.button-coupon',
    description: 'Bizgo SDK contains type-specific button text length and coupon variable anchors.',
    file: 'bizgoSdkChunk',
    needles: [
      'buttonMaxTextLength: 8',
      'buttonMaxTextLength: 14',
      'couponContentMaxLength: 18',
      'selectCouponType',
      'discountPriceCoupon',
      'shippingDiscountCoupon',
      'freeProductNameCoupon',
      'productNameUpCoupon',
    ],
  },
  {
    id: 'source.coupon.default-model',
    description: 'Bizgo SDK default coupon object carries coupon enablement, title/body, link, variable-mode, and selected-type fields.',
    file: 'bizgoSdkChunk',
    needles: [
      'dt = {',
      'isUseCouponButton: !1',
      'title: ""',
      'description: ""',
      'linkMobile: ""',
      'linkPc: ""',
      'linkIos: ""',
      'linkAndroid: ""',
      'isUseVariable: !1',
      'variable: ""',
      'exceptionVariableTitle: ""',
      'selectCouponType: ""',
    ],
  },
  {
    id: 'source.coupon.option-list',
    description: 'Bizgo SDK exposes the fixed five-option coupon title list and option values.',
    file: 'bizgoSdkChunk',
    needles: [
      'name: "#{할인금액}원 할인 쿠폰"',
      'value: "discountPriceCoupon"',
      'name: "#{할인율}% 할인 쿠폰"',
      'value: "discountRateCoupon"',
      'name: "배송비 할인 쿠폰"',
      'value: "shippingDiscountCoupon"',
      'name: "#{상품명} 무료 쿠폰"',
      'value: "freeProductNameCoupon"',
      'name: "#{상품명} UP 쿠폰"',
      'value: "productNameUpCoupon"',
    ],
  },
  {
    id: 'source.coupon.variable-input-validation',
    description: 'Bizgo SDK validates coupon amount/rate/product-name fixed inputs with typed placeholders and variable metadata.',
    file: 'bizgoSdkChunk',
    needles: [
      'variableType: "price"',
      'placeholder: "0~99,999,999 (숫자만 입력)"',
      'variableType: "rate"',
      'placeholder: "0~100 (숫자만 입력)"',
      'variableType: "productName"',
      'placeholder: "최대 7자 입력"',
    ],
  },
  {
    id: 'source.coupon.title-conversion',
    description: 'Bizgo SDK converts existing coupon titles into selected coupon type/fixed-value state and then serializes coupon titles for provider payloads.',
    file: 'bizgoSdkChunk',
    needles: [
      'function fs(t)',
      'selectCouponType: s.value',
      'isUseVariable: l',
      'exceptionVariableTitle: u',
      'variable: m',
      'Yt = (t) =>',
      't != null && t.isUseVariable',
      'toLocaleString()}${t == null ? void 0 : t.exceptionVariableTitle}',
      'title: n',
    ],
  },
  {
    id: 'source.coupon.recipient-variable-extraction',
    description: 'Bizgo SDK extracts brand-message template variables and enforces numeric recipient values for amount/rate placeholders.',
    file: 'bizgoSdkChunk',
    needles: [
      'function nt(t)',
      'i.match(/#\\{[^}\\n]+\\}/g)',
      'replaceWords: {',
      'brandmessage: A',
      '["#{할인금액}", "#{할인율}"].filter',
      '할인금액,할인율 변수는 숫자만 입력가능',
      'typeName: "brandmessage"',
    ],
  },
  {
    id: 'source.image-aspect-options',
    description: 'Bizgo SDK contains the brand image ratio option set.',
    file: 'bizgoSdkChunk',
    needles: ['label: "2:1", value: 2 / 1', 'label: "3:4", value: 3 / 4', 'label: "1:1", value: 1'],
  },
  {
    id: 'source.preview-renderers',
    description: 'Bizgo SDK contains preview renderer map for every brand-message type.',
    file: 'bizgoSdkChunk',
    needles: ['[X.TEXT]: Nu', '[X.IMAGE]: Tu', '[X.WIDE]: Ru', '[X.PREMIUM_VIDEO]: Qu', '[X.CAROUSEL_FEED]: Uu', '[X.WIDE_ITEM_LIST]: Vu', '[X.CAROUSEL_COMMERCE]: Hu', '[X.COMMERCE]: Zu'],
  },
  {
    id: 'source.wide-list-shape',
    description: 'Bizgo wide list preview separates first hero item from the rest and centers the main title.',
    file: 'bizgoSdkChunk',
    needles: ['t("wideList.mainTitle")', 'text-center', 't("wideList.list.0.title")', 'return o === 0 ? null'],
  },
  {
    id: 'source.carousel-tail',
    description: 'Bizgo carousel feed and commerce support moreButton/tail.',
    file: 'bizgoSdkChunk',
    needles: ['carouselFeeds.moreButton', 'carouselCommerce.moreButton', 'tail: Hn(m)', 'isMoreButton: !0'],
  },
];

const parityChecks = [
  {
    id: 'content.common-validation',
    area: 'validation',
    severity: 'high',
    description: 'Content fields should enforce NHN type-specific max length and line-break rules.',
    sourceAnchors: ['source.type-config.content'],
    expected: 'TEXT/IMAGE allow 1,300 chars and 99 line breaks; WIDE/PREMIUM_VIDEO allow 76 chars and 5 line breaks; body URL text is allowed.',
    actual: 'Current UI validation checks required/max length, but does not enforce NHN line-break counts.',
    passes: ({ form, payloads, service }) => (
      hasEvery(form, ['contentMaxLineBreak', '99', '5'])
      && hasEvery(payloads + service, ['contentMaxLineBreak', '99', '5'])
    ),
    evidence: [
      'NHN Brand Message content rules: TEXT/IMAGE max 1,300 chars with 99 line breaks; WIDE/PREMIUM_VIDEO max 76 chars with 5 line breaks.',
      'Decision: NHN Brand Message content allows URL text for at least TEXT/IMAGE, so body URL-ban is not a product requirement.',
      'App: BrandMessageSendForm.jsx getBrandMessageTypeValidationIssues currently does not check line-break counts.',
    ],
  },
  {
    id: 'content.variable-policy',
    area: 'validation',
    severity: 'medium',
    description: 'Body content should not inherit Bizgo-only #{variable} validation unless NHN requires it.',
    sourceAnchors: ['source.type-config.content'],
    expected: 'NHN-oriented freestyle body validation does not enforce Bizgo variable count/name rules.',
    actual: 'Current production form does not enforce Bizgo variable count/name rules in body content.',
    passes: ({ form, payloads, service }) => (
      !hasAny(form + payloads + service, ['max-variable-count', 'valid-variable-names', 'maxVariableCount', 'validVariableNames'])
    ),
    evidence: [
      'Bizgo content schema validates max-variable-count and valid-variable-names.',
      'Decision: use NHN content constraints rather than Bizgo-only variable validation for freestyle body content.',
    ],
  },
  {
    id: 'content.body-url-policy',
    area: 'validation',
    severity: 'medium',
    description: 'Body content should not receive a blanket URL-ban despite Bizgo UI validation.',
    sourceAnchors: ['source.type-config.content'],
    expected: 'Brand Message body fields allow URL text under the NHN-oriented product policy.',
    actual: 'Current production form does not implement a blanket body URL-ban.',
    passes: ({ form }) => !componentContains(form, 'getBrandMessageTypeValidationIssues', 'no-urls')
      && !componentContains(form, 'getBrandMessageTypeValidationIssues', 'url 형식 입력 불가')
      && !componentContains(form, 'getBrandMessageTypeValidationIssues', 'includeNoUrls'),
    evidence: [
      'Bizgo content schema includes includeNoUrls, but this has been accepted as a Bizgo-only UI policy difference.',
      'NHN-oriented decision: do not block URL text in Brand Message body content.',
    ],
  },
  {
    id: 'content.image-max-length',
    area: 'type-config',
    severity: 'medium',
    description: 'IMAGE content max length should follow NHN 1,300 chars, not Bizgo 400 chars.',
    sourceAnchors: ['source.type-config.content'],
    expected: 'IMAGE contentMaxLength is 1,300 under NHN Brand Message rules.',
    actual: 'IMAGE is configured with contentMaxLength 1,300.',
    passes: ({ form }) => /IMAGE:\s*\{[\s\S]*?contentMaxLength:\s*1300[\s\S]*?editor:\s*'image'/.test(form),
    evidence: [
      'NHN Brand Message content rules allow IMAGE content up to 1,300 chars and 99 line breaks.',
      'Decision: keep NHN 1,300-char behavior instead of Bizgo SDK 400-char UI policy.',
    ],
  },
  {
    id: 'header.type-specific-surface-rules',
    area: 'editor-validation',
    severity: 'medium',
    description: 'Header fields should only appear in Bizgo header-capable contexts.',
    sourceAnchors: ['source.type-config.content'],
    expected: 'TEXT, IMAGE, WIDE, and COMMERCE have no top-level header; header-positive types are audited by their type-specific checks.',
    actual: 'Non-header top-level types do not expose a header field; WIDE_ITEM_LIST, PREMIUM_VIDEO, and carousel header behavior is tracked by dedicated findings.',
    passes: ({ form }) => (
      /chatBubbleType === 'WIDE_ITEM_LIST'[\s\S]*?field:\s*'header'/.test(form)
      && !/chatBubbleType === 'TEXT'[\s\S]{0,220}field:\s*'header'/.test(form)
      && !/chatBubbleType === 'IMAGE'[\s\S]{0,220}field:\s*'header'/.test(form)
      && !/chatBubbleType === 'WIDE'[\s\S]{0,220}field:\s*'header'/.test(form)
      && !/chatBubbleType === 'COMMERCE'[\s\S]{0,220}field:\s*'header'/.test(form)
    ),
    evidence: [
      'Bizgo type config sets isHeader false for TEXT, IMAGE, WIDE, and COMMERCE.',
      'App only validates the shared header field in the WIDE_ITEM_LIST branch; positive header gaps are captured by wide-list, premium-video, and carousel findings.',
    ],
  },
  {
    id: 'button.link-type-rules',
    area: 'validation',
    severity: 'high',
    description: 'Button link validation should match Bizgo per-link-type rules.',
    sourceAnchors: ['source.type-config.content'],
    expected: 'WL requires mobile link; AL requires at least two of mobile/Android/iOS; BF validates numeric bizFormId.',
    actual: 'WL accepts mobile or PC; AL accepts Android or iOS only; BF uses bizFormKey without numeric validation.',
    passes: ({ form, payloads, service }) => (
      hasEvery(form, ['모바일/Android/iOS 링크 중 2개 이상 입력해주세요.', '모바일 링크를 입력해주세요.'])
      && hasEvery(payloads + service, ['모바일/Android/iOS 링크 중 2개 이상', 'bizFormId'])
      && !hasAny(form, ['!isHttpUrl(normalizedButton.linkMo) && !isHttpUrl(normalizedButton.linkPc)'])
    ),
    evidence: [
      'Bizgo button schema requires WL linkMobile and validates AL minimum two links.',
      'App getBrandButtonValidation currently allows WL linkMo or linkPc and AL schemeAndroid or schemeIos.',
    ],
  },
  {
    id: 'button.type-specific-count-rules',
    area: 'validation',
    severity: 'medium',
    description: 'Button count limits should follow Bizgo type-specific min/max rules.',
    sourceAnchors: ['source.type-config.button-coupon'],
    expected: 'TEXT/IMAGE allow 0-5, WIDE/WIDE_ITEM_LIST allow 0-2, PREMIUM_VIDEO allows 0-1, COMMERCE requires 1-2, carousel items require 1-2.',
    actual: 'Current form, payload, and relay validation enforce these button count ranges.',
    passes: ({ form, payloads, service }) => (
      hasEvery(form, ['function getBrandTopLevelButtonLimit', "chatBubbleType === 'PREMIUM_VIDEO'", "chatBubbleType === 'WIDE' || chatBubbleType === 'WIDE_ITEM_LIST' || chatBubbleType === 'COMMERCE'", 'buttons.length < 1', 'brandCarouselButtonMaxCount'])
      && hasEvery(payloads, ['function getBrandTopLevelButtonMaxCount', "chatBubbleType === 'PREMIUM_VIDEO'", "chatBubbleType === 'WIDE' || chatBubbleType === 'WIDE_ITEM_LIST' || chatBubbleType === 'COMMERCE'", 'minButtons = chatBubbleType === \'COMMERCE\' ? 1 : 0'])
      && hasEvery(service, ['function getBrandTopLevelButtonMaxCount', "chatBubbleType === 'PREMIUM_VIDEO'", "chatBubbleType === 'WIDE' || chatBubbleType === 'WIDE_ITEM_LIST' || chatBubbleType === 'COMMERCE'", "const min = chatBubbleType === 'COMMERCE' ? 1 : 0"])
    ),
    evidence: [
      'Bizgo type config declares buttonMinLength/buttonMaxLength per chat bubble type.',
      'App top-level and carousel validation already applies the same button count ranges.',
    ],
  },
  {
    id: 'button.type-specific-name-length',
    area: 'validation',
    severity: 'high',
    description: 'Top-level button name max length should follow Bizgo per-type buttonMaxTextLength.',
    sourceAnchors: ['source.type-config.button-coupon'],
    expected: 'WIDE, WIDE_ITEM_LIST, PREMIUM_VIDEO, COMMERCE, and carousel buttons use max 8; TEXT/IMAGE use max 14.',
    actual: 'Top-level BrandMessageButtonPanel defaults to maxNameLength 14 for all non-carousel types.',
    passes: ({ form }) => (
      /activeButtonValidation[\s\S]*?getBrandButtonValidation\(activeButton,\s*\{[\s\S]*?maxNameLength/.test(form)
      && /message\.chatBubbleType[\s\S]*?WIDE_ITEM_LIST[\s\S]*?8/.test(form)
    ),
    evidence: [
      'Bizgo type config uses buttonMaxTextLength: 8 for WIDE, WIDE_ITEM_LIST, PREMIUM_VIDEO, COMMERCE, CAROUSEL_*.',
      'App only passes maxNameLength={8} for carousel item buttons; top-level buttons use the default 14.',
    ],
  },
  {
    id: 'image.image-link-editor',
    area: 'editor',
    severity: 'high',
    description: 'Image movement link editor should exist for Bizgo image-link-capable types.',
    sourceAnchors: ['source.type-config.image-upload'],
    expected: 'IMAGE, WIDE, PREMIUM_VIDEO, COMMERCE, and CAROUSEL_* image editors expose imageLink where Bizgo has isImageLink.',
    actual: 'Payload/service can carry imageLink, but production form has no imageLink editor.',
    passes: ({ form }) => hasEvery(form, ['imageLink', '이미지 이동 링크']),
    evidence: [
      'Bizgo image upload component renders label "이미지 이동 링크" when type config has isImageLink.',
      'App payloads/service preserve imageLink, but BrandMessageSendForm lacks a matching editor surface.',
    ],
  },
  {
    id: 'image.upload-original-validation',
    area: 'upload',
    severity: 'medium',
    description: 'Image file selection should reject invalid original files like Bizgo before crop/upload.',
    sourceAnchors: ['source.type-config.image-upload'],
    expected: 'Original jpg/png, 5MB, and width >= 500px are rejected at file selection time.',
    actual: 'Crop presets can upscale small images; pre-crop width rejection is not present in BrandMessageSendForm/ImageCropDialog.',
    passes: ({ form, imageCropUtils }) => (
      hasEvery(form + imageCropUtils, ['naturalWidth', '가로 500px 이상 등록 가능합니다.'])
      || hasEvery(form + imageCropUtils, ['image.width', '가로 500px 이상 등록 가능합니다.'])
    ),
    evidence: [
      'Bizgo validates extension, 5MB, and image width before dispatching addImage.',
      'App image crop presets define minWidth but getTargetSize scales crop output instead of rejecting too-small originals.',
    ],
  },
  {
    id: 'image.aspect-options',
    area: 'upload-editor',
    severity: 'high',
    description: 'Brand image crop ratio options should match Bizgo ratio options and type-specific restrictions.',
    sourceAnchors: ['source.image-aspect-options', 'source.type-config.image-upload'],
    expected: 'General brand images support 2:1, 3:4, and 1:1; WIDE and wide-list first image are fixed 2:1.',
    actual: 'Current crop presets expose 4:3 instead of 3:4 and BRAND_WIDE_IMAGE still allows multiple ratios.',
    passes: ({ imageCropUtils }) => {
      const widePreset = objectBlock(imageCropUtils, 'BRAND_WIDE_IMAGE');
      return hasEvery(imageCropUtils, ["{ label: '3:4', value: 3 / 4 }", 'BRAND_WIDE_IMAGE'])
        && widePreset.includes('aspect: 2')
        && !widePreset.includes('aspectOptions');
    },
    evidence: [
      'Bizgo ratio options are 2:1, 3:4, and 1:1, with WIDE guide fixed to 2:1.',
      'App IMAGE_CROP_PRESETS use 4:3 and allow aspectOptions on BRAND_WIDE_IMAGE.',
    ],
  },
  {
    id: 'image.upload-type-mapping',
    area: 'upload',
    severity: 'high',
    description: 'Provider image upload type names differ from Bizgo msgType names for premium video and commerce.',
    sourceAnchors: ['source.type-config.image-upload'],
    expected: 'NHN upload imageType must use IMAGE for general premium-video thumbnail and commerce images, plus NHN-specific wide/list/carousel image types.',
    actual: 'PREMIUM_VIDEO and COMMERCE uploads are mapped to WIDE_IMAGE in the app.',
    passes: ({ payloads }) => (
      /chatBubbleType === 'PREMIUM_VIDEO'[\s\S]*?imageType:\s*'IMAGE'/.test(payloads)
      && /chatBubbleType === 'COMMERCE'[\s\S]*?imageType:\s*'IMAGE'/.test(payloads)
      && hasEvery(payloads, [
        "imageType: chatBubbleType === 'WIDE' ? 'WIDE_IMAGE' : 'IMAGE'",
        "'MAIN_WIDE_ITEMLIST_IMAGE'",
        "'NORMAL_WIDE_ITEMLIST_IMAGE'",
        "'CAROUSEL_FEED_IMAGE'",
        "'CAROUSEL_COMMERCE_IMAGE'",
      ])
    ),
    evidence: [
      'NHN image upload API accepts IMAGE, WIDE_IMAGE, MAIN_WIDE_ITEMLIST_IMAGE, NORMAL_WIDE_ITEMLIST_IMAGE, CAROUSEL_FEED_IMAGE, and CAROUSEL_COMMERCE_IMAGE.',
      'NHN premium video thumbnail and commerce image descriptions require a general uploaded image URL.',
    ],
  },
  {
    id: 'preview.button-orientation',
    area: 'preview',
    severity: 'medium',
    description: 'Preview button layout should support Bizgo vertical/horizontal buttonType.',
    sourceAnchors: ['source.preview-renderers'],
    expected: 'TEXT/IMAGE use vertical buttons; WIDE/WIDE_ITEM_LIST/PREMIUM_VIDEO/COMMERCE/CAROUSEL use horizontal buttons.',
    actual: 'Preview buttons route through BrandPreviewButtons with a per-type buttonType value from brandPreviewMockup.',
    passes: ({ preview }) => (
      componentContains(preview, 'BrandPreviewButtons', 'buttonType')
      && hasEvery(preview, ['brandPreviewMockup', 'buttonType={config.buttonType}', 'buttonType="horizontal"'])
    ),
    evidence: [
      'Bizgo preview passes rt[type].mockup.buttonType into the shared button renderer.',
      'App BrandPreviewButtons receives buttonType from the preview mockup config or explicit horizontal card contexts.',
    ],
  },
  {
    id: 'preview.coupon-non-text-types',
    area: 'preview',
    severity: 'high',
    description: 'Coupon preview should render for wide list, premium video, commerce, and carousel item cards.',
    sourceAnchors: ['source.preview-renderers'],
    expected: 'WIDE_ITEM_LIST, PREMIUM_VIDEO, COMMERCE, and carousel cards render coupon when configured.',
    actual: 'List, premium-video, commerce, and carousel preview paths render BrandPreviewCoupon when a coupon is configured.',
    passes: ({ preview }) => (
      componentContains(preview, 'BrandMessageListBubble', 'BrandPreviewCoupon')
      && componentContains(preview, 'BrandMessageStandardBubble', 'BrandPreviewCoupon')
      && hasEvery(preview, ['type="PREMIUM_VIDEO"', 'coupon={message.coupon}'])
      && componentContains(preview, 'BrandMessageCommerceBubble', 'BrandPreviewCoupon')
      && componentContains(preview, 'BrandMessageCarousel', 'BrandPreviewCoupon')
    ),
    evidence: [
      'Bizgo Vu, Qu, Zu, Hu render coupon component when couponButton.isUseCouponButton is true.',
      'App list, standard premium-video, commerce, and carousel preview paths all render BrandPreviewCoupon.',
    ],
  },
  {
    id: 'coupon.type-specific-description-limit',
    area: 'validation',
    severity: 'medium',
    description: 'Coupon description max length should vary by chatBubbleType.',
    sourceAnchors: ['source.type-config.content'],
    expected: 'NHN coupon description max length is 18 for WIDE/WIDE_ITEM_LIST/PREMIUM_VIDEO and 12 for the other types; line breaks are disallowed.',
    actual: 'Current coupon validation and input maxLength are hardcoded to 12.',
    passes: ({ form }) => hasAny(form, ['couponContentMaxLength']) && !hasEvery(form, ['maxLength={12}', 'length > 12']),
    evidence: [
      'NHN Brand Message coupon description rules vary by chatBubbleType and disallow line breaks.',
      'App getBrandCouponValidation and BrandMessageCouponPanel hardcode 12.',
    ],
  },
  {
    id: 'coupon.mobile-link-required',
    area: 'validation',
    severity: 'medium',
    description: 'Coupon connection validation should follow NHN coupon link optionality.',
    sourceAnchors: ['source.type-config.button-coupon'],
    expected: 'Coupon has a valid connection when linkMo is present, or when schemeAndroid/schemeIos contains an alimtalk=coupon:// channel coupon URL.',
    actual: 'Current coupon validation accepts alimtalk=coupon:// Android or iOS scheme without linkMo.',
    passes: ({ form, payloads, service }) => (
      componentContains(form, 'hasBrandCouponConnection', 'linkMo')
      && componentContains(form, 'hasBrandCouponConnection', "androidLink.startsWith('alimtalk=coupon://')")
      && componentContains(payloads, 'getBrandProviderCoupon', 'optionalRelayStringProperty')
      && componentContains(service, 'normalizeBrandCoupon', 'optionalStringProperty')
    ),
    evidence: [
      'NHN coupon link fields become optional when linkMo is set, or when schemeAndroid/schemeIos contains alimtalk=coupon://.',
      'Decision: keep NHN coupon-link behavior instead of Bizgo mobile-link-required behavior.',
    ],
  },
  {
    id: 'coupon.variable-mode',
    area: 'editor-payload-validation',
    severity: 'high',
    description: 'Coupon variable flow should use the Bizgo fixed option/fixed-value model instead of a free-form variable-name input.',
    sourceAnchors: [
      'source.coupon.default-model',
      'source.coupon.option-list',
      'source.coupon.variable-input-validation',
      'source.coupon.title-conversion',
    ],
    expected: 'Coupon editor exposes the five fixed selectCouponType options, toggles between template-variable title mode and fixed-value mode, and does not ask users to type an arbitrary coupon variable name.',
    actual: 'Current production editor still exposes a free-form "변수명" field with placeholder "#{쿠폰변수}" behind the variable toggle; fixed-value mode is not represented as the target option flow.',
    passes: ({ form, payloads, service }) => (
      hasEvery(form, [
        '#{할인금액}원 할인 쿠폰',
        '#{할인율}% 할인 쿠폰',
        '#{상품명} 무료 쿠폰',
        '#{상품명} UP 쿠폰',
        'fixedCouponValue',
      ])
      && !componentContains(form, 'BrandMessageCouponPanel', '변수명')
      && !componentContains(form, 'BrandMessageCouponPanel', 'placeholder="#{쿠폰변수}"')
      && !hasAny(payloads + service, ['isUseVariable', 'selectCouponType', 'exceptionVariableTitle'])
    ),
    evidence: [
      'Bizgo default coupon model has isUseCouponButton, title, description, linkMobile/linkPc/linkIos/linkAndroid, isUseVariable, variable, exceptionVariableTitle, and selectCouponType.',
      'Bizgo option list is discountPriceCoupon, discountRateCoupon, shippingDiscountCoupon, freeProductNameCoupon, and productNameUpCoupon with fixed display title templates.',
      'Current app has brandMessageCouponVariableTypeOptions but still renders a free-form variable-name input and preserves variable-mode internals through payload/service normalization.',
    ],
  },
  {
    id: 'coupon.recipient-variable-extraction',
    area: 'payload-validation',
    severity: 'high',
    description: 'Coupon template variables should cross the relay boundary as templateParameter values, with numeric checks for amount/rate placeholders.',
    sourceAnchors: ['source.coupon.recipient-variable-extraction'],
    expected: 'Template/basic sends use title templates containing #{할인금액}, #{할인율}, or #{상품명}; recipient/templateParameter values carry concrete replacements, and #{할인금액}/#{할인율} values are numeric.',
    actual: 'Current generic templateParameter pass-through exists, but there is no coupon-specific target-title extraction or numeric validation for coupon amount/rate placeholders.',
    passes: ({ payloads, service }) => (
      hasEvery(payloads + service, ['#{할인금액}', '#{할인율}', '#{상품명}', 'templateParameter'])
      && hasAny(payloads + service, ['할인금액,할인율 변수는 숫자만 입력가능', 'COUPON_VARIABLE_NUMERIC_REQUIRED'])
    ),
    evidence: [
      'Bizgo nt(C) extracts #{...} variables from brand-message template JSON before recipient editing.',
      'Bizgo recipient grids reject non-numeric values for #{할인금액} and #{할인율}.',
      'Product target: NHN basic/template sends resolve coupon placeholders through templateParameter, not through browser-side provider fan-out.',
    ],
  },
  {
    id: 'coupon.freestyle-placeholder-boundary',
    area: 'payload-validation',
    severity: 'high',
    description: 'Freestyle coupon payloads must not send unresolved coupon placeholders to NHN.',
    sourceAnchors: ['source.coupon.option-list', 'source.coupon.title-conversion'],
    expected: 'Freestyle sends use fixed literal coupon titles only; unresolved #{할인금액}, #{할인율}, or #{상품명} coupon titles are rejected because per-recipient freestyle expansion is out of scope.',
    actual: 'Current payload and relay normalization accept explicit coupon.title values and do not reject unresolved coupon placeholders in freestyle coupon titles.',
    passes: ({ payloads, service }) => (
      hasEvery(payloads + service, [
        'BRAND_COUPON_PLACEHOLDERS',
        'BRAND_FREESTYLE_COUPON_PLACEHOLDER_UNSUPPORTED',
      ])
    ),
    evidence: [
      'Bizgo can collect recipient replacement values for brand-message template variables.',
      'Product target: this relay does not add per-recipient freestyle coupon expansion in this phase.',
      'NHN provider payload must not receive unresolved coupon title placeholders from freestyle sends.',
    ],
  },
  {
    id: 'coupon.url-ban',
    area: 'validation',
    severity: 'medium',
    description: 'Coupon detail text should not inherit Bizgo-only URL-ban unless NHN requires it.',
    sourceAnchors: ['source.type-config.content'],
    expected: 'NHN-oriented coupon description validation allows URL text unless NHN rejects it.',
    actual: 'Coupon description only checks presence and length.',
    passes: ({ form }) => !componentContains(form, 'getBrandCouponValidation', 'no-urls') && !componentContains(form, 'getBrandCouponValidation', 'url 형식'),
    evidence: [
      'Bizgo coupon schema applies Wt() to description.',
      'Decision: NHN docs do not state a coupon-description URL ban, so do not add a Bizgo-only URL-ban.',
    ],
  },
  {
    id: 'wide-list.hero-shape',
    area: 'preview',
    severity: 'high',
    description: 'Wide list first item should be a hero image with title overlay, not a normal row.',
    sourceAnchors: ['source.wide-list-shape'],
    expected: 'Preview renders item 0 separately, larger, with title overlay; remaining items render compact title-only rows.',
    actual: 'App maps all wide-list items through the same row renderer and shows description for every row.',
    passes: ({ preview }) => (
      componentContains(preview, 'BrandMessageListBubble', 'items.slice(1)')
      && componentContains(preview, 'BrandMessageListBubble', 'brand-message-preview-list-hero')
      && !componentContains(preview, 'BrandMessageListBubble', '<span>{item.description}</span>')
    ),
    evidence: [
      'Bizgo Vu renders wideList.list.0 as a larger image block and skips index 0 in the row map.',
      'App BrandMessageListBubble maps every item to brand-message-preview-list-item and renders item.description.',
    ],
  },
  {
    id: 'wide-list.header-rules',
    area: 'editor-preview',
    severity: 'high',
    description: 'Wide list header/main title should be max 20 chars and centered in preview.',
    sourceAnchors: ['source.wide-list-shape'],
    expected: 'Header input enforces 20 chars and preview title is centered.',
    actual: 'Header input has no maxLength/counter and preview template title is generic.',
    passes: ({ form, styles }) => (
      /header[\s\S]*?maxLength=\{?20\}?/.test(form)
      && cssRuleContains(styles, '.brand-message-preview-list-bubble .brand-message-preview-template-title', ['text-align: center'])
    ),
    evidence: [
      'Bizgo Xc validates mainTitle max 20 and preview uses text-center.',
      'App wide list header field lacks maxLength and preview title class has no list-specific centering rule.',
    ],
  },
  {
    id: 'wide-list.item-validation-rules',
    area: 'validation',
    severity: 'high',
    description: 'Wide list item validation should match Bizgo first/rest item rules.',
    sourceAnchors: ['source.wide-list-shape'],
    expected: 'First item title optional with max 25 and no description; rest title required max 30; mobile link required for all.',
    actual: 'Current validation requires title and description/content for every item.',
    passes: ({ form }) => (
      /index\s*===\s*0[\s\S]*?title[\s\S]*?optional/.test(form)
      && hasAny(form, ['maxLength={25}', '25자'])
      && hasAny(form, ['maxLength={30}', '30자'])
      && !componentContains(form, 'getBrandWideItemValidation', 'errors.content')
    ),
    evidence: [
      'Bizgo Jc conditionally allows first item title to be blank and has no description field.',
      'App getBrandWideItemValidation requires title and content/description for every item.',
    ],
  },
  {
    id: 'premium-video.availability-surface',
    area: 'editor',
    severity: 'decision',
    description: 'Premium video availability should be explicit.',
    sourceAnchors: ['source.preview-renderers'],
    expected: 'Either expose Bizgo-like restricted premium video option with policy copy, or document NHN-only exclusion.',
    actual: 'PREMIUM_VIDEO editor exists, but option is silently hidden from type selector.',
    passes: ({ form }) => !hasAny(form, ["hiddenBrandChatBubbleTypeOptions = new Set(['PREMIUM_VIDEO'])"]) && hasAny(form, ['프리미엄 동영상은 현재 이용이 제한됩니다']),
    evidence: [
      'Bizgo type list includes premium video and has restriction copy.',
      'App keeps config/editor code but filters PREMIUM_VIDEO out of selector options.',
    ],
  },
  {
    id: 'premium-video.required-content-header-thumbnail',
    area: 'editor-preview-payload',
    severity: 'medium',
    description: 'Premium video should use NHN optional header/content/thumbnail semantics.',
    sourceAnchors: ['source.preview-renderers'],
    expected: 'NHN PREMIUM_VIDEO content is optional max 76/linebreak 5; header is optional max 20; thumbnailUrl is optional and defaults to KakaoTV thumbnail when omitted.',
    actual: 'Content is optional and thumbnail upload is optional; header is not forced in the production form.',
    passes: ({ form, payloads, service }) => (
      /PREMIUM_VIDEO:\s*\{[\s\S]*?contentMode:\s*'optional'/.test(form)
      && hasEvery(form, ['BrandMessageVideoThumbnailField', 'videoUrl'])
      && hasEvery(payloads + service, ['PREMIUM_VIDEO', 'video'])
    ),
    evidence: [
      'NHN PREMIUM_VIDEO content/header/thumbnailUrl are optional, with thumbnailUrl defaulting to the KakaoTV video thumbnail when absent.',
      'Decision: do not force Bizgo-required header/content/thumbnail semantics.',
    ],
  },
  {
    id: 'commerce.price-and-text-rules',
    area: 'editor-preview-validation',
    severity: 'high',
    description: 'Commerce price, discount, product text, imageLink, and additionalContent should match NHN.',
    sourceAnchors: ['source.preview-renderers'],
    expected: '상품명 max 30/no line break, additionalContent max 34/linebreak 1, imageLink, regularPrice, discountPrice, discountRate, discountFixed, and NHN price ranges.',
    actual: 'Commerce editor, validation, preview, payload, and relay paths expose title, imageLink, additionalContent, regularPrice, discountPrice, discountRate, and discountFixed.',
    passes: ({ form, preview }) => (
      hasEvery(form, ['discountRate', 'discountFixed', 'additionalContent', 'imageLink'])
      && hasAny(form, ['discount-lower-than-regular', '정상 가격이 할인 가격보다 낮습니다'])
      && componentContains(preview, 'getCommercePreview', 'additionalContent')
      && componentContains(preview, 'BrandPreviewCommercePrice', 'additionalContent')
    ),
    evidence: [
      'NHN COMMERCE uses regularPrice, discountPrice, discountRate, discountFixed, image.imageLink, product title, and additionalContent.',
      'Decision: do not require Bizgo price variable toggle or Bizgo URL-ban.',
    ],
  },
  {
    id: 'commerce.default-button',
    area: 'editor',
    severity: 'medium',
    description: 'Commerce default seed should include one WL button like Bizgo if buttons are required.',
    sourceAnchors: ['source.preview-renderers'],
    expected: 'New commerce draft starts with one editable WL button.',
    actual: 'The default freestyle draft already contains one top-level WL button.',
    passes: ({ form }) => /defaultBrandMessageSendFormValue\s*=\s*\{[\s\S]*?buttons:\s*\[\{[\s\S]*?type:\s*'WL'/.test(form),
    evidence: [
      'Bizgo commerce default model uses buttons: [{ ...vt, linkType: Ve.WL }].',
      'App defaultBrandMessageSendFormValue starts with one top-level WL button, so this specific starting-state mismatch is not active.',
    ],
  },
  {
    id: 'carousel-feed.item-content-rules',
    area: 'editor-validation',
    severity: 'high',
    description: 'Carousel feed card content should enforce Bizgo max 180 chars and max 2 line breaks.',
    sourceAnchors: ['source.preview-renderers'],
    expected: 'Each feed card message/content has max 180 and max 2 line breaks.',
    actual: 'Current feed card validation only checks required title/content/image.',
    passes: ({ form }) => hasEvery(form, ['180', '줄바꿈은 2회']) || hasEvery(form, ['contentMaxLength: 180', 'contentMaxLineBreak: 2']),
    evidence: [
      'Bizgo carousel feed item config validates contentMaxLength 180 and contentMaxLineBreak 2.',
      'App getBrandFeedItemValidation does not enforce card content length/line breaks.',
    ],
  },
  {
    id: 'carousel-feed.default-button',
    area: 'editor',
    severity: 'medium',
    description: 'Carousel feed card seed should include one WL button like Bizgo.',
    sourceAnchors: ['source.carousel-tail'],
    expected: 'New feed cards start with one WL button because carousel cards require 1-2 buttons.',
    actual: 'New feed cards start with no buttons and become invalid until edited.',
    passes: ({ form }) => /kind === 'feed'[\s\S]*?buttons:\s*\[[\s\S]*?type:\s*'WL'/.test(form),
    evidence: [
      'Bizgo carousel feed default list items include one WL button.',
      'App createBrandListItem default branch returns buttons: [].',
    ],
  },
  {
    id: 'carousel.tail-more-button',
    area: 'editor-preview-payload',
    severity: 'high',
    description: 'Carousel feed and commerce should expose Bizgo moreButton/tail editor and preview.',
    sourceAnchors: ['source.carousel-tail'],
    expected: 'Carousel feed/commerce editor has moreButton, payload includes carousel.tail, preview shows more card.',
    actual: 'Server can accept tail, but form/preview do not expose moreButton/tail.',
    passes: ({ form, preview, payloads, service }) => (
      hasEvery(form, ['moreButton', 'isMoreButton'])
      && hasEvery(preview, ['moreButton', 'tail'])
      && hasAny(payloads + service, ['tail'])
    ),
    evidence: [
      'Bizgo has carouselFeeds.moreButton and carouselCommerce.moreButton forms and includes tail in transform.',
      'App server supports carousel.tail but production form/preview do not expose it.',
    ],
  },
  {
    id: 'carousel-commerce.price-and-intro-rules',
    area: 'editor-preview-validation',
    severity: 'high',
    description: 'Carousel commerce should share NHN commerce price/additionalContent/imageLink rules and intro max/linebreak/imageLink rules.',
    sourceAnchors: ['source.preview-renderers'],
    expected: 'Carousel commerce cards support regularPrice, discountPrice, discountRate, discountFixed, additionalContent, imageLink; intro supports imageLink and NHN content limits.',
    actual: 'Carousel commerce card and preview paths share commerce price/additionalContent/imageLink fields; intro image link and limits are covered by the carousel editor flow.',
    passes: ({ form, preview }) => (
      hasEvery(form, ['carousel', 'discountRate', 'discountFixed', 'additionalContent', 'imageLink'])
      && componentContains(preview, 'getCarouselItems', 'additionalContent')
      && componentContains(preview, 'BrandMessageCarousel', 'BrandPreviewCommercePrice')
    ),
    evidence: [
      'NHN carousel commerce uses commerce price fields and intro/card image links.',
      'App carousel commerce editor exposes only simplified title/price/image and intro basics.',
    ],
  },
];

const staticDiscoveryProbes = [
  {
    id: 'validation.content.variable-and-linebreak-rules',
    area: 'validation',
    description: 'Bizgo content validation includes variable rules, which are intentionally not adopted under the NHN-oriented freestyle policy.',
    file: 'bizgoSdkChunk',
    needles: ['"max-variable-count"', '"valid-variable-names"', '"max-line-break"'],
    coveredBy: ['content.common-validation', 'content.variable-policy'],
  },
  {
    id: 'validation.content.bizgo-url-ban-policy',
    area: 'validation',
    description: 'Bizgo content validation includes a URL-ban that is intentionally not adopted for NHN-oriented body content.',
    file: 'bizgoSdkChunk',
    needles: ['includeNoUrls: !0', 'n.test(Wt())'],
    coveredBy: ['content.body-url-policy'],
  },
  {
    id: 'validation.button.link-type-rules',
    area: 'validation',
    description: 'Button validation is conditional by WL, AL, BF, BT, and AC link type.',
    file: 'bizgoSdkChunk',
    needles: ['nullable().when("linkType"', 'linkType: r', 'linkMobile: s'],
    coveredBy: ['button.link-type-rules'],
  },
  {
    id: 'validation.button.type-specific-name-length',
    area: 'validation',
    description: 'Button editor receives type-specific buttonMaxTextLength from Bizgo type config.',
    file: 'bizgoSdkChunk',
    needles: ['buttonMaxTextLength: d = 14', 'buttonMaxTextLength: r = 14'],
    coveredBy: ['button.type-specific-name-length'],
  },
  {
    id: 'validation.button.type-specific-count-rules',
    area: 'validation',
    description: 'Button min/max count rules are defined per chat bubble type.',
    file: 'bizgoSdkChunk',
    needles: ['buttonMinLength: 1', 'buttonMaxLength: 5', 'buttonMaxLength: 2', 'buttonMaxLength: 1'],
    coveredBy: ['button.type-specific-count-rules'],
  },
  {
    id: 'validation.coupon.link-mobile-required',
    area: 'validation',
    description: 'Bizgo coupon validation requires linkMobile, while NHN allows channel coupon scheme fallback.',
    file: 'bizgoSdkChunk',
    needles: ['linkMobile: Me().when("isUseCouponButton"', 'required("모바일 링크를 입력해주세요.")'],
    coveredBy: ['coupon.mobile-link-required'],
  },
  {
    id: 'validation.coupon.variable-mode',
    area: 'validation',
    description: 'Coupon validation supports Bizgo coupon variable mode fields.',
    file: 'bizgoSdkChunk',
    needles: ['selectCouponType', 'discountPriceCoupon', 'discountRateCoupon', 'shippingDiscountCoupon', 'freeProductNameCoupon', 'productNameUpCoupon'],
    coveredBy: ['coupon.variable-mode'],
  },
  {
    id: 'defaults.coupon.button-model',
    area: 'editor',
    description: 'Bizgo coupon defaults include enablement, title/body, link, variable-mode, fixed value, exception title, and selected coupon type fields.',
    file: 'bizgoSdkChunk',
    needles: [
      'dt = {',
      'isUseCouponButton: !1',
      'title: ""',
      'description: ""',
      'linkMobile: ""',
      'linkPc: ""',
      'linkIos: ""',
      'linkAndroid: ""',
      'isUseVariable: !1',
      'variable: ""',
      'exceptionVariableTitle: ""',
      'selectCouponType: ""',
    ],
    coveredBy: ['coupon.variable-mode'],
  },
  {
    id: 'editor.coupon.fixed-option-list',
    area: 'editor',
    description: 'Bizgo coupon editor exposes exactly five fixed option values with title templates.',
    file: 'bizgoSdkChunk',
    needles: [
      'name: "#{할인금액}원 할인 쿠폰"',
      'value: "discountPriceCoupon"',
      'name: "#{할인율}% 할인 쿠폰"',
      'value: "discountRateCoupon"',
      'name: "배송비 할인 쿠폰"',
      'value: "shippingDiscountCoupon"',
      'name: "#{상품명} 무료 쿠폰"',
      'value: "freeProductNameCoupon"',
      'name: "#{상품명} UP 쿠폰"',
      'value: "productNameUpCoupon"',
    ],
    coveredBy: ['coupon.variable-mode'],
  },
  {
    id: 'validation.coupon.fixed-value-inputs',
    area: 'validation',
    description: 'Bizgo coupon fixed-value inputs distinguish amount, rate, and product-name validation surfaces.',
    file: 'bizgoSdkChunk',
    needles: [
      'variableType: "price"',
      'placeholder: "0~99,999,999 (숫자만 입력)"',
      'variableType: "rate"',
      'placeholder: "0~100 (숫자만 입력)"',
      'variableType: "productName"',
      'placeholder: "최대 7자 입력"',
    ],
    coveredBy: ['coupon.variable-mode'],
  },
  {
    id: 'payload.coupon.title-conversion',
    area: 'payload',
    description: 'Bizgo parses coupon titles into option/fixed-value state and serializes fixed values back into provider coupon titles.',
    file: 'bizgoSdkChunk',
    needles: ['function fs(t)', 'Yt = (t) =>', 't != null && t.isUseVariable', 'exceptionVariableTitle'],
    coveredBy: ['coupon.variable-mode', 'coupon.freestyle-placeholder-boundary'],
  },
  {
    id: 'payload.coupon.recipient-variable-extraction',
    area: 'payload',
    description: 'Bizgo extracts brand-message placeholders and validates recipient amount/rate placeholders as numeric.',
    file: 'bizgoSdkChunk',
    needles: [
      'function nt(t)',
      'replaceWords: {',
      'brandmessage: A',
      '["#{할인금액}", "#{할인율}"].filter',
      '할인금액,할인율 변수는 숫자만 입력가능',
    ],
    coveredBy: ['coupon.recipient-variable-extraction'],
  },
  {
    id: 'validation.coupon.url-ban',
    area: 'validation',
    description: 'Bizgo coupon description applies no-URL validation, which is intentionally not adopted without an NHN requirement.',
    file: 'bizgoSdkChunk',
    needles: ['description', 'Wt()'],
    coveredBy: ['coupon.url-ban'],
  },
  {
    id: 'upload.image.original-file-rules',
    area: 'upload',
    description: 'Original image files are checked for extension, size, and minimum width before upload.',
    file: 'bizgoSdkChunk',
    needles: ['message: "가로 500px 이상 등록 가능합니다."', 'message: "용량은 최대 5MB까지 등록 가능합니다."', 'jpg', 'png'],
    coveredBy: ['image.upload-original-validation'],
  },
  {
    id: 'upload.image.aspect-options',
    area: 'upload',
    description: 'Image ratio options are exactly 2:1, 3:4, and 1:1 with type-specific restrictions.',
    file: 'bizgoSdkChunk',
    needles: ['label: "2:1", value: 2 / 1', 'label: "3:4", value: 3 / 4', 'label: "1:1", value: 1'],
    coveredBy: ['image.aspect-options'],
  },
  {
    id: 'upload.image.type-mapping',
    area: 'upload',
    description: 'Bizgo upload msgType distinguishes premium video and commerce, while NHN imageType uses the fixed NHN image type set.',
    file: 'bizgoSdkChunk',
    needles: ['PREMIUM_VIDEO: "PREMIUM_VIDEO"', 'COMMERCE: "COMMERCE"', 'WIDE_ITEM_LIST_FIRST', 'CAROUSEL_COMMERCE_INTRO'],
    coveredBy: ['image.upload-type-mapping'],
  },
  {
    id: 'editor.image-link-surface',
    area: 'editor',
    description: 'Image upload editor renders an image movement link field for image-link-capable types.',
    file: 'bizgoSdkChunk',
    needles: ['isImageLink', '이미지 이동 링크'],
    coveredBy: ['image.image-link-editor'],
  },
  {
    id: 'preview.renderer-map',
    area: 'preview',
    description: 'Preview renderer map covers all eight brand-message chat bubble types.',
    file: 'bizgoSdkChunk',
    needles: ['[X.TEXT]: Nu', '[X.IMAGE]: Tu', '[X.WIDE]: Ru', '[X.PREMIUM_VIDEO]: Qu', '[X.CAROUSEL_FEED]: Uu', '[X.WIDE_ITEM_LIST]: Vu', '[X.CAROUSEL_COMMERCE]: Hu', '[X.COMMERCE]: Zu'],
    coveredBy: [
      'preview.button-orientation',
      'preview.coupon-non-text-types',
      'wide-list.hero-shape',
      'premium-video.required-content-header-thumbnail',
      'commerce.price-and-text-rules',
      'carousel.tail-more-button',
      'carousel-commerce.price-and-intro-rules',
    ],
  },
  {
    id: 'preview.coupon.non-text-types',
    area: 'preview',
    description: 'Coupon preview is rendered in wide-list, premium video, commerce, and carousel contexts.',
    file: 'bizgoSdkChunk',
    needles: ['couponButton.isUseCouponButton', 'Vu', 'Qu', 'Zu', 'Hu'],
    coveredBy: ['preview.coupon-non-text-types'],
  },
  {
    id: 'preview.wide-list.hero-first-item',
    area: 'preview',
    description: 'Wide-list preview treats item 0 as a hero block and skips it in the compact row list.',
    file: 'bizgoSdkChunk',
    needles: ['t("wideList.list.0.title")', 'return o === 0 ? null'],
    coveredBy: ['wide-list.hero-shape'],
  },
  {
    id: 'preview.wide-list.centered-title',
    area: 'preview',
    description: 'Wide-list main title is centered.',
    file: 'bizgoSdkChunk',
    needles: ['t("wideList.mainTitle")', 'text-center'],
    coveredBy: ['wide-list.header-rules'],
  },
  {
    id: 'validation.wide-list.item-rules',
    area: 'validation',
    description: 'Wide-list item validation has first-item and rest-item specific title/link rules.',
    file: 'bizgoSdkChunk',
    needles: ['wideList.list.0.title', 'wideList.mainTitle', 'linkMobile'],
    coveredBy: ['wide-list.item-validation-rules', 'wide-list.header-rules'],
  },
  {
    id: 'editor.premium-video.availability',
    area: 'editor',
    description: 'Premium video is present in Bizgo type lists but restricted in option filtering.',
    file: 'bizgoSdkChunk',
    needles: ['PREMIUM_VIDEO', '프리미엄 동영상', 'messageType) !== We.PREMIUM_VIDEO'],
    coveredBy: ['premium-video.availability-surface'],
  },
  {
    id: 'editor.premium-video.fields',
    area: 'editor',
    description: 'Bizgo premium video marks more fields active; NHN treats content/header/thumbnail as optional around the required KakaoTV URL.',
    file: 'bizgoSdkChunk',
    needles: ['[X.PREMIUM_VIDEO]', 'isVideoLink: !0', 'isImageLink: !0', 'contentMaxLength: 76'],
    coveredBy: ['premium-video.required-content-header-thumbnail'],
  },
  {
    id: 'editor.commerce.price-fields',
    area: 'editor',
    description: 'Commerce exposes price, discount, product text, image link, and additional content fields; NHN does not require Bizgo price-variable UI.',
    file: 'bizgoSdkChunk',
    needles: ['isUsePriceVariable', 'discountType', 'additionalContent', 'discountPrice'],
    coveredBy: ['commerce.price-and-text-rules', 'carousel-commerce.price-and-intro-rules'],
  },
  {
    id: 'defaults.commerce.button',
    area: 'editor',
    description: 'Commerce default model starts with one WL button.',
    file: 'bizgoSdkChunk',
    needles: ['commerce: Dt', 'buttons: ['],
    coveredBy: ['commerce.default-button'],
  },
  {
    id: 'defaults.carousel-feed.button',
    area: 'editor',
    description: 'Carousel feed card default model starts with one WL button.',
    file: 'bizgoSdkChunk',
    needles: ['carouselFeeds: Rt', 'buttons: ['],
    coveredBy: ['carousel-feed.default-button'],
  },
  {
    id: 'editor.carousel.more-button',
    area: 'editor',
    description: 'Carousel feed and carousel commerce expose a moreButton/tail editor.',
    file: 'bizgoSdkChunk',
    needles: ['carouselFeeds.moreButton', 'carouselCommerce.moreButton', 'isMoreButton: !0'],
    coveredBy: ['carousel.tail-more-button'],
  },
  {
    id: 'editor.carousel-feed.item-content',
    area: 'validation',
    description: 'Carousel feed card content has max length and line-break validation.',
    file: 'bizgoSdkChunk',
    needles: ['[X.CAROUSEL_FEED]', 'contentMaxLength: 180', 'contentMaxLineBreak: 2'],
    coveredBy: ['carousel-feed.item-content-rules'],
  },
  {
    id: 'editor.carousel-commerce.intro-and-price',
    area: 'editor',
    description: 'Carousel commerce shares commerce pricing and intro image/link/content behavior.',
    file: 'bizgoSdkChunk',
    needles: ['carouselCommerce.intro', 'carouselCommerce.list', 'isUsePriceVariable', 'discountType'],
    coveredBy: ['carousel-commerce.price-and-intro-rules'],
  },
];

const sourceDocuments = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, filePath]) => {
      await access(filePath, fsConstants.R_OK);
      return [key, await readFile(filePath, 'utf8')];
    })
  )
);

const sourceResults = sourceAnchors.map((anchor) => {
  const content = sourceDocuments[anchor.file];
  const missing = anchor.needles.filter((needle) => !content.includes(needle));

  return {
    ...anchor,
    missing,
    status: missing.length ? 'source-drift' : 'covered',
  };
});

const knownFindingIds = new Set(parityChecks.map((check) => check.id));
const discoveryResults = buildDiscoveryResults(sourceDocuments, knownFindingIds);

const context = {
  ...sourceDocuments,
  discoveryResults,
  sourceResults,
};

const checkResults = parityChecks.map((check) => {
  const sourceDrift = check.sourceAnchors
    .map((id) => sourceResults.find((result) => result.id === id))
    .filter((result) => result && result.status !== 'covered');
  const passed = sourceDrift.length ? false : Boolean(check.passes(context));

  return {
    area: check.area,
    actual: check.actual,
    description: check.description,
    evidence: check.evidence,
    expected: check.expected,
    id: check.id,
    severity: check.severity,
    sourceAnchors: check.sourceAnchors,
    sourceDrift: sourceDrift.map((result) => ({
      id: result.id,
      missing: result.missing,
    })),
    status: sourceDrift.length ? 'source-drift' : passed ? 'match' : check.severity === 'decision' ? 'needs-decision' : 'mismatch',
  };
});

const summary = {
  generatedAt: new Date().toISOString(),
  sourceAnchorCount: sourceResults.length,
  sourceDriftCount: sourceResults.filter((result) => result.status === 'source-drift').length,
  discoveryProbeCount: discoveryResults.length,
  discoveryTriagedCount: discoveryResults.filter((result) => result.status === 'triaged').length,
  discoveryGapCount: discoveryResults.filter((result) => result.status === 'untriaged').length,
  discoverySourceDriftCount: discoveryResults.filter((result) => result.status === 'source-drift').length,
  checkCount: checkResults.length,
  matchCount: checkResults.filter((result) => result.status === 'match').length,
  mismatchCount: checkResults.filter((result) => result.status === 'mismatch').length,
  needsDecisionCount: checkResults.filter((result) => result.status === 'needs-decision').length,
  enforceResolution: shouldEnforceResolution,
};

if (shouldJson) {
  console.log(JSON.stringify({ summary, sourceResults, discoveryResults, checkResults }, null, 2));
} else {
  const textReport = renderReport(summary, sourceResults, discoveryResults, checkResults);
  console.log(textReport);

  if (reportPath) {
    await writeFile(reportPath, `${textReport}\n`, 'utf8');
  }
}

const hasDiscoveryFailure = summary.sourceDriftCount > 0
  || summary.discoverySourceDriftCount > 0
  || summary.discoveryGapCount > 0;
const hasResolutionFailure = summary.mismatchCount > 0 || summary.needsDecisionCount > 0;

if (!shouldReport && (hasDiscoveryFailure || (shouldEnforceResolution && hasResolutionFailure))) {
  process.exitCode = 1;
}

function buildDiscoveryResults(documents, knownFindingIdSet) {
  const probes = [
    ...extractBizgoTypeConfigProbes(documents.bizgoSdkChunk),
    ...staticDiscoveryProbes,
  ];

  return probes.map((probe) => {
    const content = probe.file ? documents[probe.file] ?? '' : '';
    const missing = probe.needles ? probe.needles.filter((needle) => !content.includes(needle)) : [];
    const inferredCoveredBy = probe.coveredBy ?? inferDiscoveryCoverage(probe);
    const unknownFindingRefs = inferredCoveredBy.filter((id) => !knownFindingIdSet.has(id));
    const coveredBy = inferredCoveredBy.filter((id) => knownFindingIdSet.has(id));

    return {
      area: probe.area,
      coveredBy,
      description: probe.description,
      id: probe.id,
      missing,
      source: probe.source,
      sourceValue: probe.sourceValue,
      status: missing.length
        ? 'source-drift'
        : coveredBy.length && !unknownFindingRefs.length
          ? 'triaged'
          : 'untriaged',
      unknownFindingRefs,
    };
  });
}

function extractBizgoTypeConfigProbes(sdkSource) {
  const typeConfigBlock = getAssignedObjectBlock(sdkSource, 'rt');
  const types = [
    'TEXT',
    'IMAGE',
    'WIDE',
    'CAROUSEL_FEED',
    'PREMIUM_VIDEO',
    'WIDE_ITEM_LIST',
    'COMMERCE',
    'CAROUSEL_COMMERCE',
  ];
  const fields = [
    { name: 'isHeader', type: 'boolean' },
    { name: 'isImage', type: 'boolean' },
    { name: 'isImageLink', type: 'boolean' },
    { name: 'isVideoLink', type: 'boolean' },
    { name: 'isContent', type: 'boolean' },
    { name: 'isProductName', type: 'boolean' },
    { name: 'isPriceInfo', type: 'boolean' },
    { name: 'isAdditionalInfo', type: 'boolean' },
    { name: 'contentMaxLength', type: 'number' },
    { name: 'contentMaxLineBreak', type: 'number' },
    { name: 'buttonMinLength', type: 'number' },
    { name: 'buttonMaxLength', type: 'number' },
    { name: 'buttonMaxTextLength', type: 'number' },
    { name: 'minFeed', type: 'number' },
    { name: 'maxFeed', type: 'number' },
    { name: 'minImage', type: 'number' },
    { name: 'maxImage', type: 'number' },
    { name: 'minCarousel', type: 'number' },
    { name: 'maxCarousel', type: 'number' },
    { name: 'couponContentMaxLength', type: 'number' },
    { name: 'isMoreButton', type: 'boolean' },
  ];
  const probes = [];

  if (!typeConfigBlock) {
    return [{
      area: 'config',
      description: 'Bizgo type config table could not be parsed.',
      file: 'bizgoSdkChunk',
      id: 'config.type-table.parse',
      needles: ['rt = {'],
      source: 'bizgo.type-config',
    }];
  }

  for (const type of types) {
    const block = objectBlock(typeConfigBlock, `[X.${type}]`);

    if (!block) {
      probes.push({
        area: 'config',
        description: `Bizgo type config is missing ${type}.`,
        file: 'bizgoSdkChunk',
        id: `config.${type}.missing`,
        needles: [`[X.${type}]`],
        source: 'bizgo.type-config',
      });
      continue;
    }

    for (const field of fields) {
      const value = extractConfigField(block, field);

      if (value === undefined) {
        continue;
      }

      probes.push({
        area: 'config',
        description: `Bizgo ${type} config sets ${field.name}=${String(value)}.`,
        id: `config.${type}.${field.name}`,
        source: 'bizgo.type-config',
        sourceValue: { field: field.name, type, value },
        coveredBy: inferTypeConfigCoverage(type, field.name),
      });
    }

    const buttonType = extractQuotedField(block, 'buttonType');
    if (buttonType) {
      probes.push({
        area: 'preview',
        description: `Bizgo ${type} preview buttonType is ${buttonType}.`,
        id: `config.${type}.mockup.buttonType`,
        source: 'bizgo.type-config.mockup',
        sourceValue: { field: 'mockup.buttonType', type, value: buttonType },
        coveredBy: ['preview.button-orientation'],
      });
    }

    for (const mockupField of ['isImage', 'isCommerce', 'isHeader', 'isVideo', 'isCarousel']) {
      const mockupValue = extractConfigField(block, { name: mockupField, type: 'boolean' }, 'mockup');
      if (mockupValue === undefined) continue;

      probes.push({
        area: 'preview',
        description: `Bizgo ${type} mockup sets ${mockupField}=${String(mockupValue)}.`,
        id: `config.${type}.mockup.${mockupField}`,
        source: 'bizgo.type-config.mockup',
        sourceValue: { field: `mockup.${mockupField}`, type, value: mockupValue },
        coveredBy: inferMockupCoverage(type, mockupField),
      });
    }
  }

  return probes;
}

function inferDiscoveryCoverage(probe) {
  const sourceValue = probe.sourceValue;

  if (!sourceValue) {
    return [];
  }

  if (sourceValue.field?.startsWith('mockup.')) {
    return inferMockupCoverage(sourceValue.type, sourceValue.field.replace('mockup.', ''));
  }

  return inferTypeConfigCoverage(sourceValue.type, sourceValue.field);
}

function inferTypeConfigCoverage(type, field) {
  const coverage = new Set();

  if (['isContent', 'contentMaxLength', 'contentMaxLineBreak'].includes(field)) {
    coverage.add('content.common-validation');
  }

  if (field === 'isHeader') {
    coverage.add('header.type-specific-surface-rules');
  }

  if (type === 'IMAGE' && field === 'contentMaxLength') {
    coverage.add('content.image-max-length');
  }

  if (field === 'isImageLink') {
    coverage.add('image.image-link-editor');
  }

  if (field === 'isImage') {
    coverage.add('image.upload-original-validation');
    coverage.add('image.aspect-options');
  }

  if (field === 'isVideoLink' || type === 'PREMIUM_VIDEO') {
    coverage.add('premium-video.required-content-header-thumbnail');
  }

  if (['buttonMinLength', 'buttonMaxLength'].includes(field)) {
    coverage.add('button.type-specific-count-rules');
  }

  if (field === 'buttonMaxTextLength') {
    coverage.add('button.type-specific-name-length');
  }

  if (field === 'couponContentMaxLength') {
    coverage.add('coupon.type-specific-description-limit');
  }

  if (field === 'isMoreButton') {
    coverage.add('carousel.tail-more-button');
  }

  if (['minFeed', 'maxFeed'].includes(field)) {
    coverage.add('carousel-feed.item-content-rules');
  }

  if (['minImage', 'maxImage'].includes(field)) {
    coverage.add('wide-list.item-validation-rules');
  }

  if (['minCarousel', 'maxCarousel'].includes(field)) {
    coverage.add('carousel-commerce.price-and-intro-rules');
  }

  if (['isProductName', 'isPriceInfo', 'isAdditionalInfo'].includes(field)) {
    coverage.add(type === 'CAROUSEL_COMMERCE'
      ? 'carousel-commerce.price-and-intro-rules'
      : 'commerce.price-and-text-rules');
  }

  if (type === 'WIDE_ITEM_LIST') {
    coverage.add('wide-list.item-validation-rules');
    if (field === 'isHeader') {
      coverage.add('wide-list.header-rules');
    }
  }

  if (type === 'CAROUSEL_FEED') {
    coverage.add('carousel-feed.item-content-rules');
    if (field === 'buttonMinLength') {
      coverage.add('carousel-feed.default-button');
    }
  }

  if (type === 'COMMERCE') {
    coverage.add('commerce.price-and-text-rules');
    if (field === 'buttonMinLength') {
      coverage.add('commerce.default-button');
    }
  }

  if (type === 'CAROUSEL_COMMERCE') {
    coverage.add('carousel-commerce.price-and-intro-rules');
  }

  return [...coverage];
}

function inferMockupCoverage(type, field) {
  const coverage = new Set(['preview.button-orientation']);

  if (type === 'WIDE_ITEM_LIST') {
    coverage.add('wide-list.hero-shape');
  }

  if (type === 'PREMIUM_VIDEO' || field === 'isVideo') {
    coverage.add('premium-video.required-content-header-thumbnail');
  }

  if (type === 'COMMERCE') {
    coverage.add('commerce.price-and-text-rules');
  }

  if (type === 'CAROUSEL_FEED') {
    coverage.add('carousel-feed.item-content-rules');
    coverage.add('carousel.tail-more-button');
  }

  if (type === 'CAROUSEL_COMMERCE') {
    coverage.add('carousel-commerce.price-and-intro-rules');
    coverage.add('carousel.tail-more-button');
  }

  return [...coverage];
}

function getAssignedObjectBlock(content, name) {
  const assignmentIndex = content.indexOf(`${name} = {`);

  if (assignmentIndex < 0) {
    return '';
  }

  const openIndex = content.indexOf('{', assignmentIndex);

  if (openIndex < 0) {
    return '';
  }

  let depth = 0;

  for (let index = openIndex; index < content.length; index += 1) {
    if (content[index] === '{') depth += 1;
    if (content[index] === '}') depth -= 1;
    if (depth === 0) return content.slice(openIndex + 1, index);
  }

  return '';
}

function extractConfigField(block, field, objectKey = '') {
  const source = objectKey ? objectBlock(block, objectKey) : block;

  if (!source) {
    return undefined;
  }

  const match = source.match(new RegExp(`${escapeRegExp(field.name)}:\\s*(${field.type === 'boolean' ? '!0|!1' : '\\d+'})`));

  if (!match) {
    return undefined;
  }

  return field.type === 'boolean' ? match[1] === '!0' : Number(match[1]);
}

function extractQuotedField(block, fieldName) {
  const match = block.match(new RegExp(`${escapeRegExp(fieldName)}:\\s*"([^"]+)"`));
  return match ? match[1] : '';
}

function hasAny(content, needles) {
  return needles.some((needle) => content.includes(needle));
}

function hasEvery(content, needles) {
  return needles.every((needle) => content.includes(needle));
}

function componentContains(content, functionName, needle) {
  const functionIndex = content.indexOf(`function ${functionName}`);

  if (functionIndex < 0) {
    return false;
  }

  const nextFunctionIndex = content.indexOf('\nfunction ', functionIndex + 1);
  const endIndex = nextFunctionIndex < 0 ? content.length : nextFunctionIndex;
  return content.slice(functionIndex, endIndex).includes(needle);
}

function objectBlock(content, objectKey) {
  const keyIndex = content.indexOf(`${objectKey}:`);

  if (keyIndex < 0) {
    return '';
  }

  const openIndex = content.indexOf('{', keyIndex);

  if (openIndex < 0) {
    return '';
  }

  let depth = 0;

  for (let index = openIndex; index < content.length; index += 1) {
    if (content[index] === '{') depth += 1;
    if (content[index] === '}') depth -= 1;
    if (depth === 0) return content.slice(openIndex + 1, index);
  }

  return '';
}

function cssRuleContains(css, selector, declarations) {
  const rule = getCssRule(css, selector);
  return Boolean(rule) && declarations.every((declaration) => rule.includes(declaration));
}

function getCssRule(css, selector) {
  let selectorIndex = css.indexOf(selector);

  while (selectorIndex >= 0) {
    const afterSelector = css.slice(selectorIndex + selector.length);

    if (/^\s*\{/.test(afterSelector)) {
      break;
    }

    selectorIndex = css.indexOf(selector, selectorIndex + selector.length);
  }

  if (selectorIndex < 0) {
    return '';
  }

  const openIndex = css.indexOf('{', selectorIndex);
  let depth = 0;

  for (let index = openIndex; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(openIndex + 1, index);
  }

  return '';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderReport(reportSummary, anchorResults, discoveryProbeResults, results) {
  const discoveryByArea = discoveryProbeResults.reduce((groups, result) => {
    const current = groups.get(result.area) ?? { total: 0, triaged: 0, sourceDrift: 0, untriaged: 0 };
    current.total += 1;
    if (result.status === 'triaged') current.triaged += 1;
    if (result.status === 'source-drift') current.sourceDrift += 1;
    if (result.status === 'untriaged') current.untriaged += 1;
    groups.set(result.area, current);
    return groups;
  }, new Map());
  const unresolvedDiscovery = discoveryProbeResults.filter((result) => result.status !== 'triaged');
  const lines = [
    '# Brand Message Bizgo Parity Audit',
    '',
    `Generated: ${reportSummary.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Source anchors: ${reportSummary.sourceAnchorCount - reportSummary.sourceDriftCount}/${reportSummary.sourceAnchorCount} covered`,
    `- Discovery probes: ${reportSummary.discoveryTriagedCount}/${reportSummary.discoveryProbeCount} triaged`,
    `- New/untriaged discovery candidates: ${reportSummary.discoveryGapCount}`,
    `- Discovery source drift: ${reportSummary.discoverySourceDriftCount}`,
    `- Checks: ${reportSummary.matchCount}/${reportSummary.checkCount} matched`,
    `- Mismatches: ${reportSummary.mismatchCount}`,
    `- Needs decision: ${reportSummary.needsDecisionCount}`,
    `- Resolution enforcement: ${reportSummary.enforceResolution ? 'on' : 'off'}`,
    '',
    '## Source Anchors',
    '',
  ];

  for (const result of anchorResults) {
    lines.push(`- ${formatStatus(result.status)} ${result.id}: ${result.description}`);
    if (result.missing.length) {
      lines.push(`  Missing: ${result.missing.join(', ')}`);
    }
  }

  lines.push('', '## Discovery Inventory', '');
  lines.push('The discovery layer inventories Bizgo source behaviors and verifies each source-derived probe is mapped to a known finding.');
  lines.push('');

  for (const [area, counts] of [...discoveryByArea.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    lines.push(`- ${area}: ${counts.triaged}/${counts.total} triaged, ${counts.untriaged} untriaged, ${counts.sourceDrift} source-drift`);
  }

  if (unresolvedDiscovery.length) {
    lines.push('', '### New Or Drifted Discovery Candidates', '');
    for (const result of unresolvedDiscovery) {
      lines.push(`- ${formatStatus(result.status)} ${result.id}: ${result.description}`);
      if (result.missing.length) {
        lines.push(`  Missing: ${result.missing.join(', ')}`);
      }
      if (result.unknownFindingRefs.length) {
        lines.push(`  Unknown finding refs: ${result.unknownFindingRefs.join(', ')}`);
      }
    }
  } else {
    lines.push('', 'No new untriaged Bizgo discovery candidates remain.');
  }

  lines.push('', '## Parity Checks', '');

  for (const result of results) {
    lines.push(`### ${formatStatus(result.status)} ${result.id}`);
    lines.push('');
    lines.push(`- Area: ${result.area}`);
    lines.push(`- Severity: ${result.severity}`);
    lines.push(`- Description: ${result.description}`);
    lines.push(`- Expected: ${result.expected}`);
    lines.push(`- Actual: ${result.actual}`);

    if (result.sourceDrift.length) {
      lines.push(`- Source drift: ${result.sourceDrift.map((item) => item.id).join(', ')}`);
    }

    if (result.evidence.length) {
      lines.push('- Evidence:');
      for (const evidence of result.evidence) {
        lines.push(`  - ${evidence}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

function formatStatus(status) {
  if (status === 'covered') return '[covered]';
  if (status === 'match') return '[match]';
  if (status === 'needs-decision') return '[needs-decision]';
  if (status === 'source-drift') return '[source-drift]';
  return '[mismatch]';
}
