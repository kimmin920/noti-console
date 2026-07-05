#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

import {
  buildAlimtalkTemplateCreatePayload,
  AlimtalkTemplateCreateValidationError,
} from '../src/features/console/alimtalkTemplates/alimtalkTemplateCreatePayload.js';

const PHASE = '41-template-create-flow';
const REQUIRED_FILES = [
  `phases/${PHASE}/current-state-audit.md`,
  `phases/${PHASE}/template-create-contract.md`,
  'src/features/console/alimtalkTemplates/alimtalkTemplateCreatePayload.js',
  'src/features/console/alimtalkTemplates/AlimtalkTemplateCreatePageNewDesign.jsx',
  'src/features/console/templates/TemplatePage.jsx',
  'src/features/console/messageSend/mutations.js',
  'src/app/api/templates/alimtalk/route.js',
  'src/app/api/templates/brand/route.js',
  'src/server/templates/service.js',
  'src/server/nhn/kakaoBizmessageClient.js',
  'src/server/__tests__/alimtalkTemplateCreatePayload.test.js',
  'src/server/__tests__/templateCatalog.test.js',
  'src/server/__tests__/nhnFoundation.test.js',
];

const sourceCache = new Map();

await checkRequiredFiles();
await checkPackageScript();
checkAlimtalkPayloadBuilder();
await checkAlimtalkCreateWiring();
await checkBrandCreateReuse();
await checkSmsCreateWiring();

console.log('template create contract passed');

async function checkRequiredFiles() {
  for (const filePath of REQUIRED_FILES) {
    await readSource(filePath);
  }
}

async function checkPackageScript() {
  const packageJson = JSON.parse(await readSource('package.json'));
  assertEqual(
    packageJson.scripts?.['test:template-create-contract'],
    'node scripts/check_template_create_contract.mjs',
    'package.json exposes the template create contract script'
  );
}

function checkAlimtalkPayloadBuilder() {
  const payload = buildAlimtalkTemplateCreatePayload({
    buttons: [{ buttonName: '자세히', buttonType: 'WL', linkMo: 'https://example.com/#{orderNo}' }],
    emphasizeType: 'NONE',
    extraText: '고객센터 09:00-18:00',
    templateCode: 'ORDER_READY',
    templateContent: '주문 #{orderNo} 접수 완료',
    templateName: '주문 접수 안내',
  }, {
    senderResourceId: 'kakao_resource_1',
  });

  assertMatch(payload, {
    senderResourceId: 'kakao_resource_1',
    templateCode: 'ORDER_READY',
    templateName: '주문 접수 안내',
    templateMessageType: 'EX',
    templateEmphasizeType: 'NONE',
  }, 'AlimTalk create payload basic fields');
  assertEqual(payload.buttons[0].type, 'WL', 'AlimTalk create payload normalizes button type');
  assertEqual(payload.buttons[0].name, '자세히', 'AlimTalk create payload normalizes button name');

  assertThrows(
    () => buildAlimtalkTemplateCreatePayload({
      emphasizeType: 'IMAGE',
      imageFileData: 'local-data',
      templateCode: 'IMAGE_TEMPLATE',
      templateContent: '이미지 안내',
      templateName: '이미지 안내',
    }, {
      senderResourceId: 'kakao_resource_1',
    }),
    AlimtalkTemplateCreateValidationError,
    'local image templates are blocked until provider image upload exists'
  );
}

async function checkAlimtalkCreateWiring() {
  const createPage = await readSource('src/features/console/alimtalkTemplates/AlimtalkTemplateCreatePageNewDesign.jsx');
  const templateApiSource = await readSource('src/features/console/templates/api.js');
  const templateQuerySource = await readSource('src/features/console/templates/queries.js');
  const routeSource = await readSource('src/app/api/templates/alimtalk/route.js');
  const serviceSource = await readSource('src/server/templates/service.js');
  const kakaoClientSource = await readSource('src/server/nhn/kakaoBizmessageClient.js');
  const templatePageSource = await readSource('src/features/console/templates/TemplatePage.jsx');

  assertIncludes(createPage, 'useSenderResourcesQuery()', 'AlimTalk create page loads sender resources');
  assertIncludes(createPage, 'useAlimtalkTemplateCreateMutation()', 'AlimTalk create page uses create mutation');
  assertIncludes(createPage, 'buildAlimtalkTemplateCreatePayload(submissionTemplate', 'AlimTalk create page builds provider payload');
  assertIncludes(createPage, 'createTemplateMutation.mutateAsync(payload)', 'AlimTalk create page submits create mutation');
  assertIncludes(createPage, '템플릿 코드', 'AlimTalk create page asks for template code');
  assertIncludes(createPage, '알림톡 템플릿을 등록했습니다.', 'AlimTalk create page renders create success');

  assertIncludes(templateApiSource, 'export function createAlimtalkTemplate(payload)', 'AlimTalk template API create helper exists');
  assertIncludes(templateApiSource, "relayPost('/api/templates/alimtalk', payload)", 'AlimTalk create API posts to route');
  assertIncludes(templateQuerySource, 'export function useAlimtalkTemplateCreateMutation(options = {})', 'AlimTalk create mutation exists');
  assertIncludes(templateQuerySource, 'mutationFn: createAlimtalkTemplate', 'AlimTalk create mutation uses template API helper');
  assertIncludes(templateQuerySource, 'messageSendQueryKeys.alimtalkTemplates(senderResourceId)', 'AlimTalk create mutation invalidates message-send templates');
  assertIncludes(templateQuerySource, 'templateQueryKeys.alimtalkCatalog', 'AlimTalk create mutation invalidates template catalog');

  assertIncludes(routeSource, 'export async function POST(request)', 'AlimTalk template route exposes POST');
  assertIncludes(routeSource, 'parseRelayRequest(request)', 'AlimTalk template route parses payload');
  assertIncludes(routeSource, 'createDefaultTemplateCatalogService().createAlimtalkTemplate', 'AlimTalk template route calls service');

  assertIncludes(serviceSource, 'async createAlimtalkTemplate({ actorUserId, payload = {} })', 'template service exposes AlimTalk create');
  assertIncludes(serviceSource, 'normalizeAlimtalkTemplateCreatePayload(payload)', 'template service normalizes AlimTalk payload');
  assertIncludes(serviceSource, 'kakaoClient.createAlimtalkTemplate({', 'template service calls provider create');
  assertIncludes(serviceSource, 'senderKey: resource.value', 'template service uses authorized sender resource value');
  assertIncludes(serviceSource, 'createAlimtalkTemplate: (...args) => getClient().createAlimtalkTemplate(...args)', 'lazy Kakao client exposes AlimTalk create');

  assertIncludes(kakaoClientSource, 'createAlimtalkTemplate: ({ senderKey, body }) =>', 'NHN Kakao client implements AlimTalk create');
  assertIncludes(kakaoClientSource, 'request(`${appRoot}/senders/${encodeURIComponent(senderKey)}/templates`,', 'NHN Kakao client uses AlimTalk template endpoint');
  assertIncludes(kakaoClientSource, "method: 'POST'", 'NHN Kakao client posts AlimTalk template create');

  assertIncludes(templatePageSource, '/templates/alimtalk/new?', 'template list passes selected sender resource to AlimTalk create');
}

async function checkBrandCreateReuse() {
  const brandRouteSource = await readSource('src/app/api/templates/brand/route.js');
  const mutationSource = await readSource('src/features/console/messageSend/mutations.js');
  const consolePagesSource = await readSource('src/features/console/ConsolePages.jsx');
  const templatePageSource = await readSource('src/features/console/templates/TemplatePage.jsx');

  assertIncludes(brandRouteSource, 'export async function POST(request)', 'Brand Message route still exposes POST');
  assertIncludes(brandRouteSource, 'createDefaultTemplateCatalogService().createBrandTemplate', 'Brand Message route still calls create service');
  assertIncludes(mutationSource, 'export function useBrandTemplateCreateMutation()', 'Brand Message create mutation remains available');
  assertIncludes(consolePagesSource, 'brandTemplateCreateMutation.mutateAsync(payload)', 'Brand Message composer keeps template registration');
  assertIncludes(templatePageSource, '/templates/brand/new', 'Brand Message template list opens the dedicated registration page');
}

async function checkSmsCreateWiring() {
  const templatePageSource = await readSource('src/features/console/templates/TemplatePage.jsx');
  const contractDoc = await readSource(`phases/${PHASE}/template-create-contract.md`);

  assertIncludes(templatePageSource, "if (activeTab === 'SMS')", 'SMS template tab handles create action');
  assertIncludes(templatePageSource, "/templates/sms/new", 'SMS template list opens the dedicated registration page');
  assertIncludes(contractDoc, 'SMS: implemented through `/templates/sms/new`.', 'contract documents SMS template create route');
}

async function readSource(filePath) {
  if (!sourceCache.has(filePath)) {
    sourceCache.set(filePath, await readFile(filePath, 'utf8'));
  }
  return sourceCache.get(filePath);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(source, text, message) {
  if (!source.includes(text)) {
    throw new Error(`${message}: missing ${JSON.stringify(text)}`);
  }
}

function assertMatch(actual, expectedEntries, message) {
  for (const [key, expected] of Object.entries(expectedEntries)) {
    assertEqual(actual?.[key], expected, `${message} (${key})`);
  }
}

function assertThrows(fn, ExpectedError, message) {
  try {
    fn();
  } catch (error) {
    if (error instanceof ExpectedError) {
      return;
    }

    throw new Error(`${message}: unexpected error ${error?.constructor?.name ?? error}`);
  }

  throw new Error(`${message}: expected throw`);
}
