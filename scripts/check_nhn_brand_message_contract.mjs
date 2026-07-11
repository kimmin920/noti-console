#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const files = {
  self: fileURLToPath(import.meta.url),
  frontendApiDoc: path.join(rootDir, 'docs/NHN_RELAY_FRONTEND_API.md'),
  packageJson: path.join(rootDir, 'package.json'),
  phasesIndex: path.join(rootDir, 'phases/index.json'),
  playgroundIndexPage: path.join(rootDir, 'src/app/playground/page.dev.jsx'),
  playgroundHarnessPage: path.join(rootDir, 'src/app/playground/harness-rules/page.dev.jsx'),
  playgroundComponentPage: path.join(rootDir, 'src/app/playground/[sectionId]/[componentId]/page.dev.jsx'),
  playgroundShell: path.join(rootDir, 'src/playground/Playground.jsx'),
  playgroundRegistry: path.join(rootDir, 'src/playground/componentRegistry.jsx'),
  templateRoute: path.join(rootDir, 'src/app/api/templates/brand/route.js'),
  consolePages: path.join(rootDir, 'src/features/console/messageSend/MessageSendPage.jsx'),
  brandForm: path.join(rootDir, 'src/components/ui/BrandMessageSendForm.jsx'),
  payloadBuilder: path.join(rootDir, 'src/features/console/messageSend/payloads.js'),
  mutations: path.join(rootDir, 'src/features/console/messageSend/mutations.js'),
  messageService: path.join(rootDir, 'src/server/messages/service.js'),
  templateService: path.join(rootDir, 'src/server/templates/service.js'),
  kakaoClient: path.join(rootDir, 'src/server/nhn/kakaoBizmessageClient.js'),
};

const phaseDir = '17-nhn-brand-message-console-preview';
const playgroundRoute = '/playground/ui/brand-message-preview';

// Final ratchet target: later phase steps should make these terms inactive in
// brand-message production targets. Step 0 only records the target list.
const finalForbiddenActiveTargetTerms = [
  'BizgoBrandMessagePreview',
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
];

const requiredNhnDraftFields = [
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

const requiredNhnImageUploadTypes = [
  'IMAGE',
  'WIDE_IMAGE',
  'MAIN_WIDE_ITEMLIST_IMAGE',
  'NORMAL_WIDE_ITEMLIST_IMAGE',
  'CAROUSEL_FEED_IMAGE',
  'CAROUSEL_COMMERCE_IMAGE',
];

const expectedBrandContentModes = [
  ['TEXT', 'required'],
  ['IMAGE', 'required'],
  ['WIDE', 'required'],
  ['WIDE_ITEM_LIST', 'hidden'],
  ['CAROUSEL_FEED', 'hidden'],
  ['PREMIUM_VIDEO', 'optional'],
  ['COMMERCE', 'hidden'],
  ['CAROUSEL_COMMERCE', 'hidden'],
];

const productionForbiddenBizgoEnumValues = ['FT', 'FI', 'FW', 'FC', 'FP', 'FL', 'FM', 'FA'];

const expectedContractTerms = {
  finalForbiddenActiveTargetTerms,
  requiredNhnDraftFields,
  requiredNhnImageUploadTypes,
};

const brandCouponVariableFlowInventory = {
  resolvedFindings: [
    {
      id: 'current-editor.free-form-coupon-variable-name',
      status: 'resolved',
      source: 'src/components/ui/BrandMessageSendForm.jsx BrandMessageCouponPanel',
      current: 'The production coupon editor no longer exposes a free-form variable-name input labeled 변수명 with placeholder #{쿠폰변수}.',
      target: 'Coupon editing uses fixed coupon type selection and fixed-value entry.',
    },
  ],
  targetEditor: {
    behavior: 'coupon type selection plus fixed-value mode',
    optionValues: [
      'discountPriceCoupon',
      'discountRateCoupon',
      'shippingDiscountCoupon',
      'freeProductNameCoupon',
      'productNameUpCoupon',
    ],
    optionTitles: [
      '#{할인금액}원 할인 쿠폰',
      '#{할인율}% 할인 쿠폰',
      '배송비 할인 쿠폰',
      '#{상품명} 무료 쿠폰',
      '#{상품명} UP 쿠폰',
    ],
  },
  targetRelayBoundary: {
    dynamicTitlePlaceholders: ['#{할인금액}', '#{할인율}', '#{상품명}'],
    templateRepresentation: 'template/basic sends carry coupon title templates while concrete values cross as recipient templateParameter values.',
    freestyleRepresentation: 'freestyle sends must use literal coupon titles; unresolved coupon placeholders must not be sent to NHN.',
    freestylePerRecipientExpansion: 'out-of-scope',
  },
  acceptedNhnDifferences: [
    {
      id: 'coupon-link-optionality',
      decision: 'NHN accepts linkMo or an alimtalk=coupon:// Android/iOS scheme for coupon connection.',
      differsFromBizgo: 'Bizgo requires linkMobile in its editor validation.',
    },
  ],
};

const brandTemplateRegistrationInventory = {
  targetProviderEndpoint: {
    method: 'POST',
    path: '/brand-message/v1.0/appkeys/{appkey}/senders/{senderKey}/templates',
    localRelayRoute: 'POST /api/templates/brand',
  },
  implementationAnchors: [
    {
      id: 'nhn-client.create-brand-template-method',
      status: 'resolved',
      targetFile: 'src/server/nhn/kakaoBizmessageClient.js',
      requiredSymbol: 'createBrandTemplate',
      note: 'Provider client exposes Brand Message template registration.',
    },
    {
      id: 'template-service.create-brand-template-flow',
      status: 'resolved',
      targetFile: 'src/server/templates/service.js',
      requiredSymbol: 'createBrandTemplate',
      note: 'Template catalog service resolves the active Kakao sender resource and calls the provider without storing template content.',
    },
    {
      id: 'composer.registration-payload-builder',
      status: 'resolved',
      targetFile: 'src/features/console/messageSend/payloads.js',
      requiredSymbol: 'buildBrandTemplateRegistrationPayload',
      note: 'Composer builds a provider-safe template registration payload separate from send-recipient validation.',
    },
    {
      id: 'composer.registration-mutation',
      status: 'resolved',
      targetFile: 'src/features/console/messageSend/mutations.js',
      requiredSymbol: 'useBrandTemplateCreateMutation',
      note: 'Mutation invalidates Brand Message template queries for the active sender resource.',
    },
  ],
  scope: {
    draftMode: 'freestyle',
    persistenceBoundary: 'must not persist template content locally',
    allowedTemplateFields: [
      'senderResourceId',
      'templateName',
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
    ],
    forbiddenSendOnlyFields: [
      'clientRequestId',
      'recipients',
      'recipientList',
      'fallback',
      'requestDate',
      'scheduledAt',
      'senderGroupingKey',
      'recipientGroupingKey',
      'reservation',
      'sendLog',
      'statsId',
      'targeting',
      'pushAlarm',
      'unsubscribeNo',
      'unsubscribeAuthNo',
      'resellerCode',
    ],
  },
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

function expectListIncludesEvery(list, expected, label) {
  const missing = expected.filter((item) => !list.includes(item));

  if (missing.length > 0) {
    fail(`${label} is missing: ${missing.join(', ')}`);
  }
}

function expectNoQuotedTerms(content, terms, label) {
  for (const term of terms) {
    const pattern = new RegExp(`['"]${term}['"]`);

    if (pattern.test(content)) {
      fail(`${label} must not use Bizgo enum value ${term} as a quoted production value.`);
    }
  }
}

function expectJsonArrayIncludesEntry(jsonText, arrayKey, predicate, label) {
  const parsed = JSON.parse(jsonText);
  const entries = parsed[arrayKey];

  if (!Array.isArray(entries) || !entries.some(predicate)) {
    fail(`${label} is missing.`);
  }
}

function extractFunctionBody(content, functionName, label) {
  const declaration = `function ${functionName}`;
  const exportDeclaration = `export ${declaration}`;
  const start = content.indexOf(exportDeclaration) >= 0
    ? content.indexOf(exportDeclaration)
    : content.indexOf(declaration);

  if (start < 0) {
    fail(`${label} is missing ${functionName}.`);
  }

  const bodyStart = content.indexOf('{', start);

  if (bodyStart < 0) {
    fail(`${label} has no body for ${functionName}.`);
  }

  let depth = 0;

  for (let index = bodyStart; index < content.length; index += 1) {
    const character = content[index];

    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;

      if (depth === 0) {
        return content.slice(bodyStart + 1, index);
      }
    }
  }

  fail(`${label} has an unterminated body for ${functionName}.`);
}

async function collectProductionSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const sourceFiles = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, fullPath).split(path.sep).join('/');

    if (entry.isDirectory()) {
      if (relativePath === 'src/playground' || relativePath.startsWith('src/playground/')) {
        continue;
      }

      if (relativePath === 'src/app/playground' || relativePath.startsWith('src/app/playground/')) {
        continue;
      }

      sourceFiles.push(...await collectProductionSourceFiles(fullPath));
      continue;
    }

    if (entry.isFile() && /\.(?:js|jsx|mjs)$/.test(entry.name)) {
      sourceFiles.push(fullPath);
    }
  }

  return sourceFiles;
}

const [
  contractSource,
  frontendApiDoc,
  packageJson,
  phasesIndex,
  playgroundIndexPage,
  playgroundHarnessPage,
  playgroundComponentPage,
  playgroundShell,
  playgroundRegistry,
  templateRoute,
  consolePages,
  brandForm,
  payloadBuilder,
  mutations,
  messageService,
  templateService,
  kakaoClient,
] = await Promise.all([
  readFile(files.self, 'utf8'),
  readFile(files.frontendApiDoc, 'utf8'),
  readFile(files.packageJson, 'utf8'),
  readFile(files.phasesIndex, 'utf8'),
  readFile(files.playgroundIndexPage, 'utf8'),
  readFile(files.playgroundHarnessPage, 'utf8'),
  readFile(files.playgroundComponentPage, 'utf8'),
  readFile(files.playgroundShell, 'utf8'),
  readFile(files.playgroundRegistry, 'utf8'),
  readFile(files.templateRoute, 'utf8'),
  readFile(files.consolePages, 'utf8'),
  readFile(files.brandForm, 'utf8'),
  readFile(files.payloadBuilder, 'utf8'),
  readFile(files.mutations, 'utf8'),
  readFile(files.messageService, 'utf8'),
  readFile(files.templateService, 'utf8'),
  readFile(files.kakaoClient, 'utf8'),
]);

const productionSourceFiles = await collectProductionSourceFiles(path.join(rootDir, 'src'));
const productionSourceContents = await Promise.all(
  productionSourceFiles.map(async (file) => ({
    file,
    content: await readFile(file, 'utf8'),
  }))
);

check('package script is registered', () => {
  const parsed = JSON.parse(packageJson);
  const command = parsed.scripts?.['test:nhn-brand-message-contract'];

  if (command !== 'node scripts/check_nhn_brand_message_contract.mjs') {
    fail('package.json must define test:nhn-brand-message-contract.');
  }
});

check('phase remains registered', () => {
  expectJsonArrayIncludesEntry(
    phasesIndex,
    'phases',
    (phase) => phase?.dir === phaseDir,
    `phase ${phaseDir}`
  );
});

check('playground dev routes avoid optional catch-all fallback rendering', () => {
  expectIncludes(playgroundIndexPage, "import Playground from '@/playground/Playground.jsx';", 'playground index page');
  expectIncludes(
    playgroundIndexPage,
    "<Playground initialRoute={{ mode: 'component', sectionId: null, componentId: null }} />",
    'playground index route render'
  );
  expectIncludes(playgroundHarnessPage, "import Playground from '@/playground/Playground.jsx';", 'playground harness page');
  expectIncludes(
    playgroundHarnessPage,
    "<Playground initialRoute={{ mode: 'rules', sectionId: null, componentId: null }} />",
    'playground harness route render'
  );
  expectIncludes(playgroundComponentPage, "import Playground from '@/playground/Playground.jsx';", 'playground component page');
  expectIncludes(playgroundComponentPage, 'const { sectionId, componentId } = await params;', 'playground component route params');
  expectIncludes(
    playgroundComponentPage,
    "<Playground initialRoute={{ mode: 'component', sectionId, componentId }} />",
    'playground component route render'
  );
});

check(`${playgroundRoute} is exposed in the registry`, () => {
  expectIncludes(playgroundRegistry, "id: 'ui'", 'playground UI section');
  expectIncludes(playgroundRegistry, "id: 'brand-message-preview'", 'brand-message preview entry');
  expectIncludes(playgroundRegistry, "name: 'NhnBrandMessagePreview'", 'brand-message preview active name');
  expectIncludes(playgroundRegistry, "path: 'src/components/ui/BrandMessagePreview.jsx'", 'brand-message preview path');
  expectIncludes(playgroundRegistry, '<NhnBrandMessagePreview', 'brand-message preview render');
  expectIncludes(playgroundRegistry, 'getCurrentProps: getNhnBrandPreviewProps', 'brand-message current props projection');
  expectIncludes(playgroundRegistry, 'templateParameter: {}', 'brand-message NHN draft props');
  expectIncludes(playgroundShell, 'href={`/playground/${item.id}/${entry.id}`}', 'playground route href');
  expectIncludes(playgroundShell, 'findPlaygroundComponent(route.sectionId, route.componentId)', 'playground route lookup');
  expectIncludes(playgroundShell, 'currentProps={currentProps}', 'playground current props render');
});

check('production brand-message tab renders the NHN preview from the canonical draft', () => {
  expectIncludes(consolePages, 'NhnBrandMessagePreview', 'production NHN brand preview import');
  expectIncludes(consolePages, '<BrandMessageSendForm', 'production brand-message form');
  expectIncludes(consolePages, 'value={brandFormValue}', 'production brand-message form canonical draft value');
  expectIncludes(consolePages, '<NhnBrandMessagePreview', 'production brand-message NHN preview render');
  expectIncludes(consolePages, 'carouselTarget={brandCarouselPreviewTarget}', 'production brand-message carousel preview target');
  expectIncludes(consolePages, 'senderProfiles={alimtalkSenderProfiles}', 'production brand-message preview sender profiles');
  expectIncludes(consolePages, 'templates={brandTemplates}', 'production brand-message preview templates');
});

check('production brand-message send flow keeps validation, upload, payload, and mutation stages', () => {
  expectIncludes(consolePages, 'const issues = getBrandMessageValidationIssues(brandFormValue);', 'brand validation stage');
  expectIncludes(consolePages, 'const nextBrandMessage = await uploadBrandImagesIfNeeded(brandFormValue);', 'brand image upload stage');
  expectIncludes(consolePages, 'const payload = buildBrandMessageSendPayload(nextBrandMessage, { templates: brandTemplates });', 'brand payload stage');
  expectIncludes(consolePages, 'const result = await brandMessageSendMutation.mutateAsync(payload);', 'brand mutation stage');
});

check('brand-message form declares canonical NHN content modes', () => {
  expectIncludes(brandForm, 'export const brandChatBubbleTypeConfig = {', 'brand-message type config');

  for (const [type, mode] of expectedBrandContentModes) {
    const entryPattern = new RegExp(`${type}: \\{[\\s\\S]*?contentMode: '${mode}'[\\s\\S]*?\\n  \\},`);

    if (!entryPattern.test(brandForm)) {
      fail(`brandChatBubbleTypeConfig must map ${type} to contentMode ${mode}.`);
    }
  }

  expectIncludes(brandForm, "contentLabel: '영상 소개 문구'", 'premium video content label');
  expectIncludes(brandForm, 'shouldShowBrandContentField(message.chatBubbleType)', 'conditional content field rendering');
  expectIncludes(brandForm, 'patch.content = \'\';', 'hidden content type switch clearing');
});

check('brand-message payload builder omits hidden top-level content modes', () => {
  expectIncludes(payloadBuilder, "const BRAND_CONTENT_HIDDEN_TYPES = new Set(['WIDE_ITEM_LIST', 'COMMERCE', 'CAROUSEL_FEED', 'CAROUSEL_COMMERCE']);", 'hidden content type set');
  expectIncludes(payloadBuilder, 'if (BRAND_CONTENT_HIDDEN_TYPES.has(chatBubbleType)) {', 'hidden content omission branch');
  expectIncludes(payloadBuilder, "const BRAND_CONTENT_REQUIRED_TYPES = new Set(['TEXT', 'IMAGE', 'WIDE']);", 'required content type set');
  expectIncludes(payloadBuilder, "const BRAND_ADDITIONAL_CONTENT_TYPES = new Set(['COMMERCE']);", 'commerce additionalContent type set');
});

check('production brand-message code keeps NHN values instead of Bizgo payload/model enums', () => {
  expectNoQuotedTerms(brandForm, productionForbiddenBizgoEnumValues, 'BrandMessageSendForm.jsx');
  expectNoQuotedTerms(payloadBuilder, productionForbiddenBizgoEnumValues, 'messageSend payload builder');
});

check('brand-message client uses NHN brand endpoints', () => {
  expectIncludes(kakaoClient, 'sendBrandFreestyleMessage', 'NHN brand freestyle client method');
  expectIncludes(kakaoClient, 'sendBrandBasicMessage', 'NHN brand basic client method');
  expectIncludes(kakaoClient, '${brandRoot}/freestyle-messages', 'NHN brand freestyle endpoint');
  expectIncludes(kakaoClient, '${brandRoot}/basic-messages', 'NHN brand basic endpoint');
});

check('production send path uses NHN brand client methods', () => {
  expectIncludes(messageService, 'async sendBrandMessage', 'brand-message send service');
  expectIncludes(messageService, 'kakaoClient.sendBrandFreestyleMessage', 'brand freestyle send method');
  expectIncludes(messageService, 'kakaoClient.sendBrandBasicMessage', 'brand basic send method');
  expectIncludes(messageService, 'sendPayload.mode === BRAND_FREESTYLE_MODE', 'brand send mode switch');
  expectIncludes(messageService, 'callProvider: () => sendMethod(providerRequest.body, { idempotencyKey })', 'brand provider call');
});

check('final ratchet target terms are recorded in this contract', () => {
  expectListIncludesEvery(expectedContractTerms.finalForbiddenActiveTargetTerms, [
    'BizgoBrandMessagePreview',
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
  ], 'final forbidden active-target terms');
});

check('required NHN draft fields are recorded in this contract', () => {
  expectListIncludesEvery(expectedContractTerms.requiredNhnDraftFields, [
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
  ], 'required NHN draft fields');
});

check('NHN image upload types are recorded in this contract', () => {
  expectListIncludesEvery(expectedContractTerms.requiredNhnImageUploadTypes, [
    'IMAGE',
    'WIDE_IMAGE',
    'MAIN_WIDE_ITEMLIST_IMAGE',
    'NORMAL_WIDE_ITEMLIST_IMAGE',
    'CAROUSEL_FEED_IMAGE',
    'CAROUSEL_COMMERCE_IMAGE',
  ], 'required NHN image upload types');
});

check('contract source contains the final target names literally', () => {
  for (const list of Object.values(expectedContractTerms)) {
    for (const term of list) {
      expectIncludes(contractSource, `'${term}'`, 'contract source literal target');
    }
  }
});

check('brand-message coupon variable flow inventory records resolved and target behavior', () => {
  const [resolvedFinding] = brandCouponVariableFlowInventory.resolvedFindings;

  if (resolvedFinding?.status !== 'resolved') {
    fail('coupon variable flow inventory must record the free-form variable editor as resolved.');
  }

  expectListIncludesEvery(
    brandCouponVariableFlowInventory.targetEditor.optionValues,
    [
      'discountPriceCoupon',
      'discountRateCoupon',
      'shippingDiscountCoupon',
      'freeProductNameCoupon',
      'productNameUpCoupon',
    ],
    'coupon target option values'
  );
  expectListIncludesEvery(
    brandCouponVariableFlowInventory.targetEditor.optionTitles,
    [
      '#{할인금액}원 할인 쿠폰',
      '#{할인율}% 할인 쿠폰',
      '배송비 할인 쿠폰',
      '#{상품명} 무료 쿠폰',
      '#{상품명} UP 쿠폰',
    ],
    'coupon target option titles'
  );
  expectListIncludesEvery(
    brandCouponVariableFlowInventory.targetRelayBoundary.dynamicTitlePlaceholders,
    ['#{할인금액}', '#{할인율}', '#{상품명}'],
    'coupon target title placeholders'
  );

  if (brandCouponVariableFlowInventory.targetRelayBoundary.freestylePerRecipientExpansion !== 'out-of-scope') {
    fail('freestyle per-recipient coupon expansion must stay recorded as out-of-scope.');
  }

  expectIncludes(
    brandCouponVariableFlowInventory.acceptedNhnDifferences[0]?.decision ?? '',
    'alimtalk=coupon://',
    'accepted coupon link decision'
  );
});

check('coupon variable flow inventory is explicitly source-literal', () => {
  for (const term of [
    'current-editor.free-form-coupon-variable-name',
    'coupon type selection plus fixed-value mode',
    'templateParameter',
    'freestyle sends must use literal coupon titles',
    'alimtalk=coupon://',
  ]) {
    expectIncludes(contractSource, term, 'coupon flow inventory literal target');
  }
});

check('brand-message template registration inventory records provider and relay endpoints', () => {
  const target = brandTemplateRegistrationInventory.targetProviderEndpoint;

  if (target.method !== 'POST') {
    fail('brand template registration provider endpoint must be recorded as POST.');
  }

  if (target.path !== '/brand-message/v1.0/appkeys/{appkey}/senders/{senderKey}/templates') {
    fail('brand template registration provider endpoint path is not recorded.');
  }

  if (target.localRelayRoute !== 'POST /api/templates/brand') {
    fail('brand template registration local relay route is not recorded.');
  }

  expectIncludes(frontendApiDoc, '### POST /api/templates/brand', 'frontend API Brand Message template registration section');
  expectIncludes(
    frontendApiDoc,
    '`POST /brand-message/v1.0/appkeys/{appkey}/senders/{senderKey}/templates`',
    'frontend API Brand Message provider template endpoint'
  );
});

check('brand-message template registration route exposes POST relay creation', () => {
  expectIncludes(templateRoute, 'export async function POST(request)', 'Brand Message template route POST handler');
  expectIncludes(templateRoute, 'parseRelayRequest(request)', 'Brand Message template route request parsing');
  expectIncludes(
    templateRoute,
    'createDefaultTemplateCatalogService().createBrandTemplate',
    'Brand Message template route service call'
  );
  expectIncludes(templateRoute, 'status: 201', 'Brand Message template route create status');
});

check('brand-message template registration provider client method is implemented', () => {
  expectIncludes(kakaoClient, 'createBrandTemplate: ({ senderKey, body }) =>', 'NHN createBrandTemplate client method');
  expectIncludes(
    kakaoClient,
    'request(`${brandRoot}/senders/${encodeURIComponent(senderKey)}/templates`,',
    'NHN createBrandTemplate endpoint'
  );
  expectIncludes(kakaoClient, "method: 'POST'", 'NHN createBrandTemplate HTTP method');
});

check('template catalog service exposes createBrandTemplate with active Kakao sender authorization', () => {
  expectIncludes(templateService, 'async createBrandTemplate({ actorUserId, payload = {} })', 'template service createBrandTemplate method');
  expectIncludes(templateService, 'normalizeBrandTemplateCreatePayload(payload)', 'template service create payload normalization');
  expectIncludes(templateService, 'requireActiveUserSenderResource({', 'template service active sender-resource authorization');
  expectIncludes(
    templateService,
    'resourceType: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY',
    'template service Kakao sender resource authorization'
  );
  expectIncludes(templateService, 'kakaoClient.createBrandTemplate({', 'template service provider call');
  expectIncludes(templateService, 'senderKey: resource.value', 'template service provider sender key mapping');
  expectIncludes(templateService, 'createBrandTemplate: (...args) => getClient().createBrandTemplate(...args)', 'lazy client createBrandTemplate exposure');
});

check('brand-message template registration frontend payload and validation paths are separate from send recipients', () => {
  const sendValidationBody = extractFunctionBody(
    brandForm,
    'getBrandMessageValidationIssues',
    'BrandMessageSendForm.jsx'
  );
  const registrationValidationBody = extractFunctionBody(
    brandForm,
    'getBrandMessageTemplateRegistrationIssues',
    'BrandMessageSendForm.jsx'
  );

  expectIncludes(payloadBuilder, 'export function buildBrandTemplateRegistrationPayload', 'brand registration payload builder');
  expectIncludes(payloadBuilder, "mode: 'freestyle'", 'brand registration payload freestyle mode boundary');
  expectIncludes(
    payloadBuilder,
    'getBrandFreestyleProviderFields(message, chatBubbleType)',
    'brand registration payload provider-field reuse'
  );
  expectIncludes(brandForm, 'export function getBrandMessageTemplateRegistrationIssues', 'brand registration validation helper');

  if (!sendValidationBody.includes("field: 'recipient'")) {
    fail('send validation must still include the recipient validation path.');
  }

  if (registrationValidationBody.includes("field: 'recipient'") || registrationValidationBody.includes('message.recipient')) {
    fail('template-registration validation must not use the send-recipient validation path.');
  }

  if (registrationValidationBody === sendValidationBody) {
    fail('template-registration validation must be distinct from send validation.');
  }
});

check('brand-message template registration mutation invalidates Brand Message template queries', () => {
  expectIncludes(mutations, 'export function useBrandTemplateCreateMutation()', 'Brand Message template create mutation');
  expectIncludes(mutations, "relayPost('/api/templates/brand', payload)", 'Brand Message template create mutation route');
  expectIncludes(mutations, 'onSuccess: (_template, payload) =>', 'Brand Message template create mutation success hook');
  expectIncludes(mutations, 'messageSendQueryKeys.brandTemplates(senderResourceId)', 'Brand Message template create mutation invalidation key');
  expectIncludes(mutations, 'queryClient.invalidateQueries', 'Brand Message template create mutation invalidates queries');
});

check('brand-message composer exposes the template registration action', () => {
  expectIncludes(consolePages, 'getBrandMessageTemplateRegistrationIssues(brandFormValue)', 'composer registration validation call');
  expectIncludes(consolePages, 'buildBrandTemplateRegistrationPayload(nextBrandMessage', 'composer registration payload build');
  expectIncludes(consolePages, 'brandTemplateCreateMutation.mutateAsync(payload)', 'composer registration mutation call');
  expectIncludes(consolePages, '템플릿으로 등록', 'composer template registration label');
});

check('production modules do not import src/playground', () => {
  const importPattern = /\b(?:from|import)\s*(?:\([^)]*)?['"](?:@\/playground|src\/playground|(?:\.\.?\/)+playground)\b|require\(\s*['"](?:@\/playground|src\/playground|(?:\.\.?\/)+playground)\b/;
  const offenders = productionSourceContents
    .filter(({ content }) => importPattern.test(content))
    .map(({ file }) => path.relative(rootDir, file).split(path.sep).join('/'));

  if (offenders.length > 0) {
    fail(`production modules import src/playground: ${offenders.join(', ')}`);
  }
});

check('brand-message template registration implementation anchors are resolved inventory', () => {
  const anchors = brandTemplateRegistrationInventory.implementationAnchors;

  if (!anchors.every((finding) => finding.status === 'resolved')) {
    fail('brand template registration implementation anchors must be resolved inventory after implementation.');
  }

  expectListIncludesEvery(
    anchors.map((finding) => finding.requiredSymbol),
    [
      'createBrandTemplate',
      'buildBrandTemplateRegistrationPayload',
      'useBrandTemplateCreateMutation',
    ],
    'brand template registration resolved implementation symbols'
  );
  expectIncludes(contractSource, 'createBrandTemplate', 'contract source createBrandTemplate inventory literal');
  expectIncludes(contractSource, 'buildBrandTemplateRegistrationPayload', 'contract source registration payload inventory literal');
  expectIncludes(contractSource, 'useBrandTemplateCreateMutation', 'contract source registration mutation inventory literal');
});

check('brand-message template registration scope records freestyle-only non-persistence boundary', () => {
  const scope = brandTemplateRegistrationInventory.scope;

  if (scope.draftMode !== 'freestyle') {
    fail('brand template registration must remain scoped to freestyle drafts.');
  }

  expectIncludes(
    scope.persistenceBoundary,
    'must not persist template content locally',
    'brand template registration persistence boundary'
  );
  expectListIncludesEvery(
    scope.allowedTemplateFields,
    ['senderResourceId', 'templateName', 'chatBubbleType', 'content', 'image', 'carousel', 'buttons', 'coupon'],
    'brand template registration allowed fields'
  );
  expectListIncludesEvery(
    scope.forbiddenSendOnlyFields,
    ['clientRequestId', 'recipients', 'fallback', 'requestDate', 'senderGroupingKey', 'recipientGroupingKey'],
    'brand template registration forbidden send-only fields'
  );
  expectIncludes(frontendApiDoc, 'Registration is scoped to freestyle drafts.', 'frontend API freestyle-only registration rule');
  expectIncludes(frontendApiDoc, 'must not persist Brand Message template content', 'frontend API template-content persistence rule');
});

const failures = [];

for (const { name, predicate } of checks) {
  try {
    predicate();
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error('NHN brand-message contract check failed.');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`NHN brand-message contract check passed (${checks.length} checks).`);
