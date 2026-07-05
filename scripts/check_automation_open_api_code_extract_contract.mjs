#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

import {
  buildPublOpenApiExample,
  PUBL_OPEN_API_ENDPOINT_PATH,
  PUBL_OPEN_API_SECRET_ENV_VAR,
} from '../src/features/console/automations/openApiCodeExampleModel.js';

const PHASE = '48-automation-open-api-code-extract';
const REQUIRED_FILES = [
  `phases/${PHASE}/current-state-audit.md`,
  `phases/${PHASE}/automation-open-api-code-extract-contract.md`,
  'phases/27-automation-open-api/automation-open-api-contract.md',
  'scripts/check_automation_open_api_contract.mjs',
  'src/app/api/open/v1/publ/events/route.js',
  'src/server/automations/openApiAuth.js',
  'src/server/automations/openApiRoute.js',
  'src/features/console/automations/openApiCodeExampleModel.js',
  'src/features/console/automations/PublOpenApiExampleDrawer.jsx',
  'src/features/console/automations/AutomationRuleDetailPage.jsx',
  'src/features/console/automations/AutomationRuleDetailSections.jsx',
  'src/features/console/automations/automationRuleDetailModel.js',
  'src/features/console/automations/AutomationRuleEditorForm.jsx',
  'src/features/console/automations/builder/AutomationTriggerNode.jsx',
  'src/app/automations/[ruleId]/page.jsx',
  'src/app/automations/[ruleId]/edit/page.jsx',
  'src/features/console/ConsolePages.jsx',
  'src/features/console/routing.js',
  'src/features/console/publEvents/PublEventDetailChrome.jsx',
  'src/features/console/publEvents/PublEventDetailPage.jsx',
  'src/components/ui/CodeBlock.jsx',
  'src/components/ui/CopyButton.jsx',
  'src/components/ui/CopyableSlot.jsx',
  'src/components/docs/CodeGroup.jsx',
  'src/styles/components.css',
];

const FORBIDDEN_EXAMPLE_PATTERNS = [
  /Authorization:\s*Bearer/i,
  /RESEND_API_KEY/,
  /provider request/i,
  /provider response/i,
  /rendered content/i,
  /raw event payload/i,
  /010[-\d]/,
  /\+82\s?10[-\d]/,
  /82-10[-\d]/,
];

const sourceCache = new Map();

await checkRequiredFiles();
await checkPackageScripts();
await checkContractDocs();
await checkExistingOpenApiRouteStillLocked();
await checkExampleModel();
await checkDrawerUi();
await checkPublEventDetailIntegration();
await checkAutomationRuleDetailIntegration();
await checkAutomationBuilderExclusion();

console.log('automation open api code extract contract passed');

async function checkRequiredFiles() {
  for (const filePath of REQUIRED_FILES) {
    await readSource(filePath);
  }
}

async function checkPackageScripts() {
  const packageJson = JSON.parse(await readSource('package.json'));

  assertEqual(
    packageJson.scripts?.['test:automation-open-api-contract'],
    'node scripts/check_automation_open_api_contract.mjs',
    'package.json exposes the existing Open API contract script'
  );
  assertEqual(
    packageJson.scripts?.['test:automation-open-api-code-extract-contract'],
    'node scripts/check_automation_open_api_code_extract_contract.mjs',
    'package.json exposes the code extract contract script'
  );
}

async function checkContractDocs() {
  const contract = await readSource(`phases/${PHASE}/automation-open-api-code-extract-contract.md`);
  const phase27Contract = await readSource('phases/27-automation-open-api/automation-open-api-contract.md');

  for (const text of [
    'POST',
    '/api/open/v1/publ/events',
    'x-publ-timestamp',
    'x-publ-signature',
    'PUBL_OPEN_API_WEBHOOK_SECRET',
    '${timestamp}.${rawBody}',
    'cURL',
    'fetch',
    'raw event payloads',
    'Raw recipient phone numbers',
  ]) {
    assertIncludes(contract, text, `phase 48 contract includes ${text}`);
  }

  assertIncludes(phase27Contract, 'POST /api/open/v1/publ/events', 'phase 48 references the existing phase 27 endpoint contract');
  assertIncludes(phase27Contract, 'Do not store raw recipient phone numbers', 'phase 27 privacy boundary remains present');
}

async function checkExistingOpenApiRouteStillLocked() {
  const route = await readSource('src/app/api/open/v1/publ/events/route.js');
  const auth = await readSource('src/server/automations/openApiAuth.js');
  const openApiRoute = await readSource('src/server/automations/openApiRoute.js');

  assertIncludes(route, 'export async function POST(request)', 'public route remains POST-only');
  assertIncludes(route, 'const rawBody = await request.text();', 'public route reads raw body once');
  assertIncludes(route, 'handlePublOpenApiEventRequest', 'public route delegates to Open API handler');
  assertIncludes(auth, 'PUBL_OPEN_API_WEBHOOK_SECRET', 'signature auth uses the expected secret env var');
  assertIncludes(auth, "`${timestamp}.${rawBody ?? ''}`", 'signature input uses timestamp and raw body');
  assertIncludes(openApiRoute, 'normalizeOpenApiServiceResult', 'public response remains normalized');
  assertNotIncludes(openApiRoute, 'resolveRelayActor', 'public Open API route does not use browser actor auth');
}

async function checkExampleModel() {
  assertEqual(PUBL_OPEN_API_ENDPOINT_PATH, '/api/open/v1/publ/events', 'model exposes the locked endpoint path');
  assertEqual(PUBL_OPEN_API_SECRET_ENV_VAR, 'PUBL_OPEN_API_WEBHOOK_SECRET', 'model exposes the safe env var name');

  const example = buildPublOpenApiExample({
    event: {
      eventKey: 'order.created',
      props: [
        { alias: 'targetPhoneNumber', enabled: true, required: true, type: 'text' },
        { alias: 'orderId', enabled: true, required: true, type: 'text' },
        { alias: 'totalAmount', enabled: true, required: false, type: 'number' },
      ],
    },
  });

  assertEqual(example.method, 'POST', 'example method');
  assertEqual(example.endpointPath, '/api/open/v1/publ/events', 'example endpoint path');
  assertEqual(example.secretEnvVar, 'PUBL_OPEN_API_WEBHOOK_SECRET', 'example secret env var');
  assertEqual(example.headers['Content-Type'], 'application/json', 'example content type');
  assertIncludes(example.headers, 'x-publ-timestamp', 'example timestamp header');
  assertIncludes(example.headers, 'x-publ-signature', 'example signature header');
  assertEqual(example.requestEnvelope.eventKey, 'order.created', 'example uses current event key');
  assertIncludes(example.requestEnvelope.payload, 'targetPhoneNumber', 'example includes runtime phone alias as placeholder key');
  assertEqual(example.requestEnvelope.payload.targetPhoneNumber, '<recipient-phone-from-your-system>', 'example uses recipient placeholder');

  const allSnippetText = `${example.snippets.curl}\n${example.snippets.fetch}`;
  for (const text of [
    'curl -X POST',
    'fetch(endpoint',
    '/api/open/v1/publ/events',
    'x-publ-timestamp',
    'x-publ-signature',
    'PUBL_OPEN_API_WEBHOOK_SECRET',
    'createHmac',
    'timestamp}.${body',
    'order.created',
    'channelCode',
    'externalEventId',
  ]) {
    assertIncludes(allSnippetText, text, `generated snippets include ${text}`);
  }

  for (const pattern of FORBIDDEN_EXAMPLE_PATTERNS) {
    assertNotMatches(allSnippetText, pattern, `generated snippets avoid ${pattern}`);
  }
}

async function checkDrawerUi() {
  const drawer = await readSource('src/features/console/automations/PublOpenApiExampleDrawer.jsx');
  const model = await readSource('src/features/console/automations/openApiCodeExampleModel.js');
  const styles = await readSource('src/styles/components.css');

  for (const text of [
    'buildPublOpenApiExample',
    'CodeGroup',
    'CopyableSlot',
    'DrawerContent',
    'API 예시',
    'cURL',
    'fetch',
    'example.headers',
    'example.secretEnvVar',
  ]) {
    assertIncludes(drawer, text, `drawer includes ${text}`);
  }

  for (const text of [
    'x-publ-timestamp',
    'x-publ-signature',
    'PUBL_OPEN_API_WEBHOOK_SECRET',
  ]) {
    assertIncludes(model, text, `model includes ${text}`);
  }

  assertIncludes(styles, '.publ-open-api-example-drawer', 'drawer styles exist');
  assertIncludes(styles, '.publ-open-api-example-meta', 'drawer metadata grid styles exist');
  assertIncludes(styles, '--docs-line', 'drawer scopes CodeGroup docs variables');
}

async function checkPublEventDetailIntegration() {
  const page = await readSource('src/features/console/publEvents/PublEventDetailPage.jsx');
  const chrome = await readSource('src/features/console/publEvents/PublEventDetailChrome.jsx');

  assertIncludes(page, "import { PublOpenApiExampleDrawer } from '../automations/PublOpenApiExampleDrawer.jsx';", 'PUBL detail imports API example drawer');
  assertIncludes(page, 'openApiExampleOpen', 'PUBL detail controls drawer open state');
  assertIncludes(page, '<PublOpenApiExampleDrawer', 'PUBL detail renders API example drawer');
  assertIncludes(page, 'event={editorDetail}', 'PUBL detail passes current event metadata');
  assertIncludes(chrome, 'onOpenApiExample', 'PUBL detail header accepts API example action');
  assertIncludes(chrome, 'API 예시', 'PUBL detail header exposes API example button');
}

async function checkAutomationBuilderExclusion() {
  const form = await readSource('src/features/console/automations/AutomationRuleEditorForm.jsx');
  const trigger = await readSource('src/features/console/automations/builder/AutomationTriggerNode.jsx');

  assertIncludes(trigger, "apiDrawerLabel = 'Open API drawer'", 'trigger retains Open API affordance');
  assertIncludes(trigger, 'onApiDrawerClick', 'trigger exposes click handler');
  assertIncludes(form, 'showApiButton={false}', 'automation editor hides Open API examples from the creation flow');
  assertNotIncludes(form, "import { PublOpenApiExampleDrawer } from './PublOpenApiExampleDrawer.jsx';", 'automation editor does not import API example drawer');
  assertNotIncludes(form, 'apiExampleOpen', 'automation editor does not control drawer open state');
  assertNotIncludes(form, 'onApiDrawerClick={() => setApiExampleOpen(true)}', 'automation trigger does not open drawer');
  assertNotIncludes(form, 'event={editor.mappingPolicy.selectedEvent}', 'automation editor does not pass selected event to drawer');
  assertNotIncludes(form, '<PublOpenApiExampleDrawer', 'automation editor does not render API example drawer');
}

async function checkAutomationRuleDetailIntegration() {
  const detailPage = await readSource('src/features/console/automations/AutomationRuleDetailPage.jsx');
  const detailSections = await readSource('src/features/console/automations/AutomationRuleDetailSections.jsx');
  const editorForm = await readSource('src/features/console/automations/AutomationRuleEditorForm.jsx');
  const consolePages = await readSource('src/features/console/ConsolePages.jsx');
  const detailRoute = await readSource('src/app/automations/[ruleId]/page.jsx');
  const editRoute = await readSource('src/app/automations/[ruleId]/edit/page.jsx');
  const routing = await readSource('src/features/console/routing.js');

  assertIncludes(detailRoute, 'pageId="automations-detail"', 'automation rule dynamic route opens read-only detail');
  assertIncludes(editRoute, 'pageId="automations-edit"', 'automation edit route is split under /edit');
  assertIncludes(routing, "'automations-detail'", 'automation detail page id is registered');
  assertIncludes(consolePages, "activePage === 'automations-detail'", 'console renders automation detail page');
  assertIncludes(consolePages, '<AutomationRuleDetailPage />', 'console uses automation detail component');
  assertIncludes(consolePages, "router.push(`/automations/${encodeURIComponent(row.id)}`)", 'row click opens detail route');
  assertIncludes(consolePages, "router.push(`/automations/${encodeURIComponent(row.id)}/edit`)", 'row action edit opens edit route');
  assertIncludes(detailPage, '<PublOpenApiExampleDrawer', 'automation detail renders API example drawer');
  assertIncludes(detailPage, 'usePublEventDetailQuery(eventKey', 'automation detail fetches event spec metadata');
  assertIncludes(detailSections, 'Open API', 'automation detail header exposes Open API action');
  assertNotIncludes(detailSections, 'Open API 스펙', 'automation detail content does not duplicate the Open API spec card');
  assertIncludes(detailSections, 'automation-rule-detail-operational-summary', 'automation detail places operational metadata above the editor clone');
  assertIncludes(detailSections, 'automation-rule-detail-readonly-editor', 'automation detail renders the editor layout in readonly mode');
  assertIncludes(detailSections, 'automation-rule-detail-readonly-flow', 'automation detail content follows the read-only editor flow');
  assertIncludes(detailSections, 'href={`/automations/${encodedRuleId}/edit`}', 'automation detail exposes edit link');
  assertIncludes(editorForm, 'automation-rule-detail-header automation-rule-editor-header', 'edit form header matches detail header structure');
  assertIncludes(editorForm, "const backLabel = editing ? '자동화 상세' : '자동화 목록';", 'edit form returns to detail while create returns to list');
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
  if (typeof source === 'string') {
    if (!source.includes(text)) {
      throw new Error(`${message}: missing ${JSON.stringify(text)}`);
    }
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(source, text)) {
    throw new Error(`${message}: missing key ${JSON.stringify(text)}`);
  }
}

function assertNotIncludes(source, text, message) {
  if (source.includes(text)) {
    throw new Error(`${message}: found ${JSON.stringify(text)}`);
  }
}

function assertNotMatches(source, pattern, message) {
  if (pattern.test(source)) {
    throw new Error(`${message}: matched ${pattern}`);
  }
}
