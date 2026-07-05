#!/usr/bin/env node

import { constants as fsConstants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultBizgoWwwRoot = path.resolve(rootDir, '../bizgo/bizgo-brand-msg/www.bizgo.io');
const defaultBizgoCdnRoot = path.resolve(
  rootDir,
  '../bizgo/bizgo-brand-msg/cdn.bizgo.io/omni-front-sdk/prod'
);
const bizgoWwwRoot = process.env.BIZGO_BRAND_MESSAGE_ROOT
  ? path.resolve(process.env.BIZGO_BRAND_MESSAGE_ROOT)
  : defaultBizgoWwwRoot;
const bizgoCdnRoot = process.env.BIZGO_BRAND_MESSAGE_CDN_ROOT
  ? path.resolve(process.env.BIZGO_BRAND_MESSAGE_CDN_ROOT)
  : defaultBizgoCdnRoot;

const previewShellClass =
  'bg-[#ABC1D1] rounded-[20px] pt-[28px] pb-[10px] px-[16px] select-none [&_img]:pointer-events-none [&_img]:select-none max-h-[572px] overflow-y-auto min-h-[572px] max-h-[572px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

const files = {
  bizgoSendPage: path.join(
    bizgoWwwRoot,
    'pages/console/team/[teamSeq]/send/brand-message/index.vue'
  ),
  bizgoTypes: path.join(bizgoWwwRoot, 'types/domain/kakao.ts'),
  bizgoCapturedPage: path.join(
    bizgoWwwRoot,
    'console/team/3830/send/brand-message.html'
  ),
  bizgoSdkChunk: path.join(bizgoCdnRoot, 'chunks/brandMessageTemplate.js'),
  existingPreview: path.join(rootDir, 'src/components/ui/BrandMessagePreview.jsx'),
  existingSendForm: path.join(rootDir, 'src/components/ui/BrandMessageSendForm.jsx'),
  existingStyles: path.join(rootDir, 'src/styles/components.css'),
  harness: path.join(rootDir, 'src/playground/bizgo-brand-message/BizgoBrandMessageHarness.jsx'),
  playgroundRegistry: path.join(rootDir, 'src/playground/componentRegistry.jsx'),
  playgroundShell: path.join(rootDir, 'src/playground/Playground.jsx'),
  playgroundStyles: path.join(rootDir, 'src/playground/playground.css'),
};

const checks = [];

function check(name, predicate) {
  checks.push({ name, predicate });
}

function fail(message) {
  throw new Error(message);
}

function expectIncludes(content, needle, label) {
  if (!content.includes(needle)) {
    fail(`${label} is missing: ${needle}`);
  }
}

function expectNotIncludes(content, needle, label) {
  if (content.includes(needle)) {
    fail(`${label} must not include: ${needle}`);
  }
}

function cssRule(css, selector) {
  let selectorIndex = css.indexOf(selector);

  while (selectorIndex >= 0) {
    const afterSelector = css.slice(selectorIndex + selector.length);

    if (/^\s*\{/.test(afterSelector)) {
      break;
    }

    selectorIndex = css.indexOf(selector, selectorIndex + selector.length);
  }

  if (selectorIndex < 0) {
    fail(`CSS selector is missing: ${selector}`);
  }

  const openIndex = css.indexOf('{', selectorIndex);
  let depth = 0;

  for (let index = openIndex; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(openIndex + 1, index);
  }

  fail(`CSS selector is unterminated: ${selector}`);
}

function expectCss(css, selector, declarations) {
  const rule = cssRule(css, selector);

  for (const declaration of declarations) {
    expectIncludes(rule, declaration, `${selector} declaration`);
  }
}

async function expectReadable(filePath, label) {
  try {
    await access(filePath, fsConstants.R_OK);
  } catch {
    fail(`${label} is not readable at ${filePath}`);
  }
}

const [
  sendPage,
  kakaoTypes,
  sdkChunk,
  existingPreview,
  existingSendForm,
  existingStyles,
  harness,
  playgroundRegistry,
  playgroundShell,
  playgroundStyles,
] = await Promise.all([
  readFile(files.bizgoSendPage, 'utf8'),
  readFile(files.bizgoTypes, 'utf8'),
  readFile(files.bizgoSdkChunk, 'utf8'),
  readFile(files.existingPreview, 'utf8'),
  readFile(files.existingSendForm, 'utf8'),
  readFile(files.existingStyles, 'utf8'),
  readFile(files.harness, 'utf8'),
  readFile(files.playgroundRegistry, 'utf8'),
  readFile(files.playgroundShell, 'utf8'),
  readFile(files.playgroundStyles, 'utf8'),
]);

check('Bizgo source and SDK files are readable', async () => {
  await Promise.all([
    expectReadable(files.bizgoSendPage, 'Bizgo brand-message send page'),
    expectReadable(files.bizgoTypes, 'Bizgo Kakao domain types'),
    expectReadable(files.bizgoCapturedPage, 'Bizgo captured brand-message page'),
    expectReadable(files.bizgoSdkChunk, 'Bizgo omni-front-sdk brandMessageTemplate chunk'),
  ]);
});

check('Target playground harness files are readable', async () => {
  await Promise.all([
    expectReadable(files.harness, 'Bizgo playground harness'),
    expectReadable(files.playgroundRegistry, 'playground registry'),
    expectReadable(files.playgroundShell, 'playground shell'),
    expectReadable(files.playgroundStyles, 'playground stylesheet'),
  ]);
});

check('Bizgo BrandMessageType enum contains all display types', () => {
  expectIncludes(kakaoTypes, 'export enum BrandMessageType', 'BrandMessageType enum');

  for (const typeCode of ['FT', 'FI', 'FW', 'FL', 'FC', 'FP', 'FM', 'FA']) {
    expectIncludes(kakaoTypes, `${typeCode} = "${typeCode}"`, `BrandMessageType.${typeCode}`);
  }
});

check('Bizgo brandMessageTypeList contains all Korean labels', () => {
  for (const name of [
    '텍스트',
    '이미지',
    '와이드 이미지',
    '캐러셀 피드',
    '프리미엄 동영상',
    '와이드 리스트',
    '커머스',
    '캐러셀 커머스',
  ]) {
    expectIncludes(kakaoTypes, `name: "${name}"`, `brand message type name ${name}`);
  }
});

check('Bizgo host page exposes Omni bridge, events, and API anchors', () => {
  for (const needle of [
    'id="omni"',
    'useOmniSDK',
    'initOmni({',
    'page: "brand-message-template-send"',
    'fetchTemplateList',
    'fetchGetTemplate',
    'sendPageTemplateCompareState',
    'templateSendByTemplate',
    'templateSendABTest',
    'confirmSelectTemplate',
    'createBrandMessageTemplate',
    'addImage',
    'loadAddressBook',
    'addressExcelDownload',
    '/b/kko/template/bm/image',
    '/b/kko/template/bm/create-temp',
    '/b/kko/template/bm/create',
    '/b/kko/template/bm/${seq}',
    '/b/kko/template/bm/list-for-send',
    '/b/msg/send',
    '/b/msg/send-ab',
  ]) {
    expectIncludes(sendPage, needle, `Bizgo send page anchor ${needle}`);
  }
});

check('Bizgo SDK chunk contains the actual preview wrapper and renderer map', () => {
  expectIncludes(sdkChunk, previewShellClass, 'SDK exact preview shell class');

  for (const needle of [
    '[X.TEXT]: Nu',
    '[X.IMAGE]: Tu',
    '[X.WIDE]: Ru',
    '[X.PREMIUM_VIDEO]: Qu',
    '[X.CAROUSEL_FEED]: Uu',
    '[X.WIDE_ITEM_LIST]: Vu',
    '[X.CAROUSEL_COMMERCE]: Hu',
    '[X.COMMERCE]: Zu',
    'FT: "TEXT"',
    'FI: "IMAGE"',
    'FW: "WIDE"',
    'FL: "WIDE_ITEM_LIST"',
    'FC: "CAROUSEL_FEED"',
    'FP: "PREMIUM_VIDEO"',
    'FM: "COMMERCE"',
    'FA: "CAROUSEL_COMMERCE"',
    'contentMaxLength: 1300',
    'buttonMaxLength: 5',
    'minFeed: 2',
    'maxCarousel: 6',
    '예약시간은 현재시간 +10분 이후부터 가능합니다.',
    'templateSendByTemplate',
  ]) {
    expectIncludes(sdkChunk, needle, `SDK renderer/config anchor ${needle}`);
  }
});

check('Existing shared UI components were not repurposed for the Bizgo harness', () => {
  for (const needle of [
    'BIZGO_BRAND_MESSAGE_PREVIEW_SHELL_CLASS',
    'BIZGO_BRAND_MESSAGE_TYPE_CODE_TO_INTERNAL',
    'bg-[#ABC1D1] rounded-[20px] pt-[28px]',
  ]) {
    expectNotIncludes(existingPreview, needle, `existing BrandMessagePreview isolation ${needle}`);
    expectNotIncludes(existingSendForm, needle, `existing BrandMessageSendForm isolation ${needle}`);
  }

  const existingPhoneRule = cssRule(existingStyles, '.brand-message-preview-phone');
  expectIncludes(existingPhoneRule, 'background: #b2c7d9;', 'existing preview background');
  expectNotIncludes(existingPhoneRule, 'height: 572px;', 'existing preview must not be Bizgo fixed shell');
});

check('Playground registers separate Bizgo-derived preview and send-form routes', () => {
  for (const needle of [
    "id: 'bizgo-brand-message-preview'",
    "id: 'brand-message-send-form'",
    "name: 'BizgoBrandMessagePreview'",
    "name: 'BizgoBrandMessageSendForm'",
    "path: 'src/playground/bizgo-brand-message/BizgoBrandMessageHarness.jsx'",
    'BizgoBrandMessagePreviewPlayground',
    'BizgoBrandMessageSendFormPlayground',
    'bizgoBrandMessageControls',
    'getBizgoBrandMessagePlaygroundProps',
  ]) {
    expectIncludes(playgroundRegistry, needle, `playground route ${needle}`);
  }
});

check('Playground variables panel supports generated props and JSON controls', () => {
  for (const needle of [
    'const generatedProps = component.getProps?.(values) ?? values',
    'const currentProps = typeof component.getCurrentProps',
    'currentProps={currentProps}',
    'function getControlOptionValue(option)',
    'function getControlOptionLabel(option)',
    'getControlOptionLabel(option)',
    "control.type === 'textarea' || control.type === 'json'",
    'JSON.stringify(currentProps, null, 2)',
  ]) {
    expectIncludes(playgroundShell, needle, `playground rich props ${needle}`);
  }
});

check('Harness records the SDK-derived wrapper, source anchors, API endpoints, and host events', () => {
  for (const needle of [
    'BIZGO_BRAND_MESSAGE_PREVIEW_SHELL_CLASS',
    previewShellClass,
    'BIZGO_BRAND_MESSAGE_SOURCE_ANCHORS',
    'BIZGO_BRAND_MESSAGE_HOST_EVENTS',
    'BIZGO_BRAND_MESSAGE_API_ENDPOINTS',
    '../bizgo/bizgo-brand-msg/cdn.bizgo.io/omni-front-sdk/prod/chunks/brandMessageTemplate.js',
    'POST /b/kko/template/bm/image',
    'POST /b/msg/send-ab',
    'confirmSelectTemplate',
    'createBrandMessageTemplate',
  ]) {
    expectIncludes(harness, needle, `harness source contract ${needle}`);
  }
});

check('Harness models all Bizgo brand-message types and SDK constraints', () => {
  for (const needle of [
    "FT: 'TEXT'",
    "FI: 'IMAGE'",
    "FW: 'WIDE'",
    "FL: 'WIDE_ITEM_LIST'",
    "FC: 'CAROUSEL_FEED'",
    "FP: 'PREMIUM_VIDEO'",
    "FM: 'COMMERCE'",
    "FA: 'CAROUSEL_COMMERCE'",
    'contentMaxLength: 1300',
    'contentMaxLineBreak: 99',
    'buttonMaxLength: 5',
    'buttonMaxTextLength: 14',
    'minFeed: 2',
    'maxFeed: 6',
    'minCarousel: 2',
    'maxCarousel: 6',
    'minImage: 3',
    'maxImage: 4',
  ]) {
    expectIncludes(harness, needle, `harness type constraint ${needle}`);
  }
});

check('Harness implements preview renderers for all SDK mockup boxes', () => {
  for (const needle of [
    'function StandardPreview',
    'function WideListPreview',
    'function BizgoDragCarousel',
    'function CarouselFeedPreview',
    'function CarouselCommercePreview',
    '<BizgoDragCarousel>',
    'getSelectedSlideIndex',
    'snapByDragDirection',
    'dragState.startIndex + direction',
    'onPointerDown={handlePointerDown}',
    "model.chatBubbleType === 'CAROUSEL_FEED'",
    "model.chatBubbleType === 'CAROUSEL_COMMERCE'",
    "model.chatBubbleType === 'WIDE_ITEM_LIST'",
    "'TEXT', 'IMAGE', 'WIDE', 'PREMIUM_VIDEO', 'COMMERCE'",
    'BizgoBrandMessagePreview',
  ]) {
    expectIncludes(harness, needle, `harness preview renderer ${needle}`);
  }
});

check('Harness implements send-form payload and validation behavior', () => {
  for (const needle of [
    'getBizgoBrandMessageValidationIssues',
    'buildTemplatePayload',
    'buildSendPayload',
    'addressList',
    'reservedAt',
    'alternativeMessage',
    '예약시간은 현재시간 +10분 이후부터 가능합니다.',
    '번호 오류',
    '중복 번호',
    '변수 없음',
    'bm-template-submit-btn',
    'bm-send-test-btn',
    'bm-send-btn',
    'templateSendByTemplate',
    'createBrandMessageTemplate',
  ]) {
    expectIncludes(harness, needle, `harness send behavior ${needle}`);
  }
});

check('Harness exposes all required playground controls', () => {
  for (const needle of [
    'BIZGO_BRAND_MESSAGE_TYPE_OPTIONS',
    'BIZGO_BRAND_BUTTON_TYPE_OPTIONS',
    "{ label: '웹 링크', value: 'WL' }",
    "{ label: '비즈니스폼', value: 'BF' }",
    "options: BIZGO_BRAND_MESSAGE_TYPE_OPTIONS",
    "options: BIZGO_BRAND_BUTTON_TYPE_OPTIONS",
    'value={props.model.typeLabel}',
  ]) {
    expectIncludes(harness, needle, `Korean type label control ${needle}`);
  }

  for (const controlId of [
    'messageType',
    'channelName',
    'templateName',
    'content',
    'header',
    'imageScenario',
    'imageRatio',
    'itemCount',
    'useButtons',
    'buttonCount',
    'buttonType',
    'couponEnabled',
    'useMoreButton',
    'useIntro',
    'adult',
    'recipientScenario',
    'scheduleState',
    'alternativeEnabled',
    'sendNumber',
    'unsubscribePhoneNumber',
    'variablesJson',
  ]) {
    expectIncludes(harness, `id: '${controlId}'`, `control ${controlId}`);
  }
});

check('Playground CSS pins the Bizgo shell values without touching shared preview CSS', () => {
  expectCss(playgroundStyles, '.bizgo-bm-preview-shell', [
    'width: min(100%, 286px);',
    'min-height: 572px;',
    'max-height: 572px;',
    'overflow-y: auto;',
    'border-radius: 20px;',
    'background: #abc1d1;',
    'padding: 28px 16px 10px;',
    'user-select: none;',
    'scrollbar-width: none;',
  ]);
  expectCss(playgroundStyles, '.bizgo-bm-preview-shell::-webkit-scrollbar', [
    'display: none;',
  ]);
  expectCss(playgroundStyles, '.bizgo-bm-preview-shell img', [
    'pointer-events: none;',
    'user-select: none;',
  ]);
  expectCss(playgroundStyles, '.bizgo-bm-button', [
    'height: 32px;',
    'padding: 8px;',
  ]);
  expectCss(playgroundStyles, '.bizgo-bm-carousel', [
    'overflow-x: hidden;',
    'padding-bottom: 50px;',
    'cursor: grab;',
    'touch-action: pan-y;',
  ]);
  expectCss(playgroundStyles, '.bizgo-bm-carousel.is-dragging', [
    'cursor: grabbing;',
    'scroll-snap-type: none;',
  ]);
  expectIncludes(
    playgroundStyles,
    '.bizgo-bm-carousel-card {\n  flex: 0 0 200px;\n  width: 200px;\n  display: flex;\n  flex-direction: column;\n  min-height: 100%;\n  margin-top: 8px;\n  margin-bottom: 8px;',
    'carousel card spacing rule'
  );
  expectCss(playgroundStyles, '.bizgo-bm-carousel-unsubscribe', [
    'margin-right: 35px;',
  ]);
  expectCss(playgroundStyles, '.bizgo-bm-wide-title', [
    'margin-bottom: 16px;',
  ]);
  expectCss(playgroundStyles, '.bizgo-bm-wide-list', [
    'margin-top: 16px;',
  ]);
});

const failures = [];

for (const { name, predicate } of checks) {
  try {
    await predicate();
  } catch (error) {
    failures.push(`- ${name}: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error('Brand message playground contract check failed.');
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(
  `Brand message playground contract check passed (${checks.length} checks).`
);
