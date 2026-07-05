#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const files = {
  brandForm: path.join(rootDir, 'src/components/ui/BrandMessageSendForm.jsx'),
  brandPreview: path.join(rootDir, 'src/components/ui/BrandMessageTemplateCardPreview.jsx'),
  cards: path.join(rootDir, 'src/features/console/templates/TemplateCardList.jsx'),
  dialogAdapters: path.join(rootDir, 'src/components/ui/MessageTemplateDialogAdapters.jsx'),
  kakaoPreview: path.join(rootDir, 'src/components/ui/KakaoTemplateCardPreview.jsx'),
  mapper: path.join(rootDir, 'src/features/console/templates/templateCards.js'),
  page: path.join(rootDir, 'src/features/console/templates/TemplatePage.jsx'),
  queries: path.join(rootDir, 'src/features/console/templates/queries.js'),
  route: path.join(rootDir, 'src/app/api/templates/alimtalk/route.js'),
  smsRoute: path.join(rootDir, 'src/app/api/templates/sms/route.js'),
  service: path.join(rootDir, 'src/server/templates/service.js'),
  styles: path.join(rootDir, 'src/styles/components.css'),
  toolbar: path.join(rootDir, 'src/features/console/templates/TemplateListToolbar.jsx'),
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

const [
  brandForm,
  brandPreview,
  cards,
  dialogAdapters,
  kakaoPreview,
  mapper,
  page,
  queries,
  route,
  smsRoute,
  service,
  styles,
  toolbar,
] = await Promise.all([
  readFile(files.brandForm, 'utf8'),
  readFile(files.brandPreview, 'utf8'),
  readFile(files.cards, 'utf8'),
  readFile(files.dialogAdapters, 'utf8'),
  readFile(files.kakaoPreview, 'utf8'),
  readFile(files.mapper, 'utf8'),
  readFile(files.page, 'utf8'),
  readFile(files.queries, 'utf8'),
  readFile(files.route, 'utf8'),
  readFile(files.smsRoute, 'utf8'),
  readFile(files.service, 'utf8'),
  readFile(files.styles, 'utf8'),
  readFile(files.toolbar, 'utf8'),
]);

check('Template page uses actual sender resources and template catalog query', () => {
  for (const needle of [
    'useSenderResourcesQuery',
    'useTemplateCatalogQuery',
    'templateName: deferredSearchQuery.trim()',
    "templateStatus: activeTab === '알림톡' ? statusFilter : undefined",
    'getTemplateLookupSenderResourceId({',
    'senderResourceId: templateLookupSenderResourceId',
    'getTemplateCardItems(templateQuery.data?.templates ?? [])',
    'getTemplateSenderResourceOptions(senderResourcesQuery.data, activeTab)',
    'const isTemplateListLoading = senderResourcesQuery.isPending || isTemplateLoading;',
    'activeTab={activeTab}',
    'isLoading={isTemplateListLoading}',
    '!isTemplateListLoading ? (',
    'getTemplateCreateAction({ activeTab, meta, router })',
    '<PageHeader action={createAction.label} onAction={createAction.onClick} title={meta.title} />',
    "activeTab !== '알림톡'",
    "router.push('/templates/alimtalk/new')",
  ]) {
    expectIncludes(page, needle, 'template page');
  }

  for (const needle of [
    'mockTemplateData',
    'getMockTemplatesForTab',
    'deletedTemplateIds',
  ]) {
    expectNotIncludes(page, needle, 'template page');
  }
});

check('Template query sends NHN-supported filters', () => {
  for (const needle of [
    'ALIMTALK_TEMPLATE_STATUS_OPTIONS',
    "{ label: '승인', value: 'TSC03', tone: 'green' }",
    "{ label: '검수중', value: 'TSC02', tone: 'blue' }",
    "{ label: '반려', value: 'TSC04', tone: 'red' }",
    "{ label: '요청', value: 'TSC01', tone: 'yellow' }",
    '...(templateName ? { templateName } : {})',
    "channelPath === 'alimtalk' && templateStatus ? { templateStatus } : {}",
  ]) {
    expectIncludes(queries, needle, 'template query hook');
  }
});

check('Toolbar is controlled and exposes search, status, and sender filters', () => {
  for (const needle of [
    'onSearchChange',
    'onStatusChange',
    'onSenderResourceChange',
    'placeholder="템플릿 이름 검색"',
    'className="template-status-filter"',
    'className="template-sender-filter"',
    'showStatusFilter',
  ]) {
    expectIncludes(toolbar, needle, 'template toolbar');
  }
});

check('SMS API route forwards templateName to the service', () => {
  expectIncludes(smsRoute, "templateName: searchParams.get('templateName')", 'SMS template route');
});

check('AlimTalk API route forwards templateStatus to the service', () => {
  for (const needle of [
    "templateName: searchParams.get('templateName')",
    "templateStatus: searchParams.get('templateStatus')",
  ]) {
    expectIncludes(route, needle, 'AlimTalk template route');
  }
});

check('Template service validates and forwards official AlimTalk status codes', () => {
  for (const needle of [
    "new Set(['TSC01', 'TSC02', 'TSC03', 'TSC04'])",
    'normalizeAlimtalkTemplateStatus(requestedQuery?.templateStatus)',
    'templateStatus,',
    "...pickTemplateQuery(requestedQuery, ['templateCode', 'templateName'])",
    "...pickTemplateQuery(requestedQuery, ['categoryId', 'templateName'])",
    'isListableAlimtalkTemplate(template, templateStatus)',
    'isCommonAlimtalkSenderKey(resource.value, commonAlimtalkSources)',
    'shouldListCommonAlimtalkTemplates(query)',
    "!== 'TSC04'",
    'templateStatus must be TSC01, TSC02, TSC03, or TSC04.',
  ]) {
    expectIncludes(service, needle, 'template catalog service');
  }
});

check('Cards render API template records with the original action menu', () => {
  for (const needle of [
    'export function TemplateCardList',
    'function TemplateCard(',
    'function TemplateCardMenu(',
    'function TemplateDeleteDialog(',
    'activeTab',
    'template.imageUrl',
    'TemplatePreviewFallback',
    'template-card-preview-surface',
    'draggable="false"',
    'isAlimtalkTemplatePreview',
    'KakaoTemplateCardPreview',
    'BrandMessageTemplateCardPreview',
    'isBrandMessageTemplatePreview',
    'template.statusTone',
    'template.codeMetaLabel',
    'template-card-alias-separator',
    'template-card-code-meta',
    'isLoading = false',
    'TemplateCardSkeletonGrid',
    'aria-busy="true"',
    'template-card-skeleton',
    'ActionMenu',
    'ActionMenuTrigger',
    'ActionMenuSeparator',
    'template-card-menu-trigger',
    'template-card-menu-content',
    '상세 보기',
    '편집',
    '이름 변경',
    '복제',
    '삭제',
    '템플릿 삭제',
    '이 템플릿을 삭제하시겠습니까?',
  ]) {
    expectIncludes(cards, needle, 'template card list');
  }

  for (const needle of [
    'export function BrandMessageTemplateCardPreview',
    'BrandMessagePreviewMessage',
    'getBrandTemplateBody',
    'getBrandTemplateType',
    'template-card-brand-preview-shell',
    'template-card-brand-preview',
    'is-carousel',
  ]) {
    expectIncludes(brandPreview, needle, 'Brand Message template card preview');
  }

  for (const needle of [
    'function BrandMessageTemplateDialogCard',
    'template-card-preview-surface template-card-preview-surface--brand-dialog',
    '<BrandMessageTemplateCardPreview template={template} />',
  ]) {
    expectIncludes(dialogAdapters, needle, 'Brand Message template dialog card');
  }

  expectNotIncludes(brandPreview, 'NhnBrandMessagePreview', 'Brand Message template card preview');

  for (const needle of [
    'export function KakaoTemplateCardPreview',
    'TemplateAlimtalkPreviewActions',
    'template-card-preview-fallback--alimtalk',
    'template-card-kakao-preview',
    'template-card-kakao-bubble',
    'template-card-kakao-buttons',
    'getTemplateAlimtalkActions',
    'renderTemplatePreviewText',
  ]) {
    expectIncludes(kakaoPreview, needle, 'Kakao template card preview');
  }

  for (const needle of [
    'copyTemplateCardValue',
    '코드 복사',
    '이름 복사',
    'onDelete',
  ]) {
    expectNotIncludes(cards, needle, 'template card list');
  }
});

check('Card mapper supports NHN status codes and provider fields', () => {
  for (const needle of [
    'providerStatusCode',
    'TSC01',
    'TSC02',
    'TSC03',
    'TSC04',
    "'공통'",
    'COMMON_TEMPLATE_SOURCE',
    'codeMetaLabel',
    'template.templateName',
    'template.templateImageUrl',
    'template.buttons',
    'template.channel',
    'template.quickReplies',
  ]) {
    expectIncludes(mapper, needle, 'template card mapper');
  }
});

check('Template list CSS supports status filter, API errors, and body fallback preview', () => {
  expectCss(styles, '.template-list-toolbar', [
    'display: flex;',
    'flex-wrap: wrap;',
    'gap: 8px;',
    'margin-bottom: 16px;',
  ]);
  expectCss(styles, '.template-list-toolbar .template-status-filter', [
    'min-width: 136px;',
  ]);
  expectCss(styles, '.template-list-status[data-tone="critical"]', [
    'border-color: rgba(180, 35, 24, 0.24);',
    'background: rgba(180, 35, 24, 0.05);',
    'color: var(--red);',
  ]);
  expectCss(styles, '.template-card-preview-text', [
    'white-space: pre-wrap;',
    '-webkit-line-clamp: 6;',
  ]);
  expectCss(styles, '.template-card-preview-fallback--alimtalk', [
    'background: #b2c7d9;',
    'padding: 18px;',
  ]);
  expectCss(styles, '.template-card-kakao-preview', [
    'width: min(100%, 260px);',
    'gap: 8px;',
  ]);
  expectCss(styles, '.template-card-kakao-bubble', [
    'background: var(--white);',
    'box-shadow: 0 1px 4px rgba(0, 0, 0, 0.13);',
  ]);
  expectCss(styles, '.template-card-kakao-text', [
    'white-space: pre-wrap;',
    '-webkit-line-clamp: 6;',
  ]);
  expectCss(styles, '.template-card-kakao-bubble--with-actions .template-card-kakao-text', [
    '-webkit-line-clamp: 4;',
  ]);
  expectCss(styles, '.template-card-kakao-buttons', [
    'border-top: 1px solid #e8e8e8;',
    'padding-top: 7px;',
  ]);
  expectCss(styles, '.template-card-kakao-button', [
    'color: #1a73e8;',
    'white-space: nowrap;',
  ]);
  expectCss(styles, '.template-card-brand-preview-shell', [
    'overflow: auto;',
    'justify-items: center;',
    'background: #abc1d1;',
    'padding: 18px 12px;',
    'scrollbar-gutter: stable both-edges;',
  ]);
  expectCss(styles, '.template-card-brand-preview', [
    'width: min(100%, 260px);',
    'justify-self: center;',
  ]);
  expectCss(styles, '.template-card-brand-preview.is-carousel', [
    'width: min(100%, 320px);',
  ]);
  expectCss(styles, '.template-card-brand-preview.is-carousel .brand-message-preview-carousel', [
    'width: 100%;',
    'column-gap: 12px;',
    'overscroll-behavior-x: contain;',
    'touch-action: pan-x;',
  ]);
  expectCss(styles, '.email-send-form-template-card--brand .template-card-brand-preview.is-carousel', [
    'width: min(100%, 280px);',
  ]);
  expectCss(styles, '.template-card-brand-preview.is-carousel .brand-message-preview-carousel-slide', [
    'flex: 0 0 min(216px, 82%);',
    'padding-left: 0;',
  ]);
  expectCss(styles, '.template-card-brand-preview.is-carousel .brand-message-preview-carousel-card-wrap', [
    'width: min(100%, 200px) !important;',
  ]);
  expectCss(styles, '.template-card-status.badge.blue', [
    'background: rgba(37, 99, 235, 0.1);',
    'color: #1d4ed8;',
  ]);
  expectCss(styles, '.template-card-alias-separator', [
    'font-size: 12px;',
    'line-height: 18px;',
  ]);
  expectCss(styles, '.template-card-code-meta', [
    'max-width: 180px;',
    'text-overflow: ellipsis;',
  ]);
  expectCss(styles, '.template-skeleton-block', [
    'display: block;',
    'overflow: hidden;',
    'background: #eceff1;',
  ]);
  expectCss(styles, '.template-skeleton-block::after', [
    'transform: translateX(-100%);',
    'animation: template-skeleton-shimmer 1.4s ease-in-out infinite;',
  ]);
  expectCss(styles, '.template-skeleton-preview-window', [
    'inset: 48px 48px 0;',
    'border-radius: 16px 16px 0 0;',
  ]);
  expectIncludes(styles, '@keyframes template-skeleton-shimmer', 'template list CSS');
});

const failures = [];

for (const { name, predicate } of checks) {
  try {
    await predicate();
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error('Template list contract check failed.');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Template list contract check passed (${checks.length} checks).`);
