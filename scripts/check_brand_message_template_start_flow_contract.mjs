#!/usr/bin/env node

import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const CONTRACT_ONLY = process.argv.includes('--contract-only');
const PHASE = '34-brand-message-template-start-flow';
const CONTRACT_PATH = `phases/${PHASE}/template-start-flow-contract.md`;
const PHASE_INDEX_PATH = `phases/${PHASE}/index.json`;
const TOP_LEVEL_INDEX_PATH = 'phases/index.json';
const PACKAGE_PATH = 'package.json';
const BRAND_FORM_PATH = 'src/components/ui/BrandMessageSendForm.jsx';
const PAYLOAD_PATH = 'src/features/console/messageSend/payloads.js';
const DEFAULTS_TEST_PATH = 'src/server/__tests__/brandMessageConsoleDefaults.test.js';
const PAYLOAD_TEST_PATH = 'src/server/__tests__/messageSendPayloads.test.js';
const SCHEMA_PATH = 'src/db/schema.js';
const STEP_PATHS = Array.from({ length: 4 }, (_, index) => `phases/${PHASE}/step${index}.md`);

const CONTRACT_CHECKS = [
  {
    name: 'two user intents',
    patterns: [
      /Send template as-is/i,
      /Start from template/i,
      /mode: 'freestyle'/,
      /templateCode: ''/,
      /templateParameter: \{\}/,
      /imageParameters: \{\}/,
      /videoParameter: null/,
    ],
  },
  {
    name: 'preserved context and copy matrix',
    patterns: [
      /senderProfileId/,
      /recipient/,
      /scheduledAt/,
      /fallbackEnabled/,
      /pushAlarm/,
      /CAROUSEL_FEED/,
      /CAROUSEL_COMMERCE/,
      /COMMERCE/,
      /WIDE_ITEM_LIST/,
    ],
  },
  {
    name: 'variable materialization',
    patterns: [
      /current `message\.templateParameter\[key\]`/,
      /`template\.templateParameter\[key\]`/,
      /`variables\[\]\.fallbackValue`|variables\[\]\.fallbackValue/,
      /preserve the original `#\{key\}` token/i,
      /`unresolvedVariables`/,
    ],
  },
  {
    name: 'must not',
    patterns: [
      /Do not add database schema/i,
      /Do not introduce TypeScript/i,
      /Do not import from `src\/playground`/i,
      /Do not change SMS or Alimtalk/i,
      /Do not remove the existing provider-template send flow/i,
    ],
  },
];

const SCAFFOLD_CHECKS = [
  {
    path: PHASE_INDEX_PATH,
    name: 'phase index',
    patterns: [
      /"phase": "34-brand-message-template-start-flow"/,
      /"name": "contract-and-checker"/,
      /"name": "template-to-freestyle-draft-helper"/,
      /"name": "composer-start-action-wiring"/,
      /"name": "final-payload-and-browser-qa"/,
    ],
  },
  {
    path: TOP_LEVEL_INDEX_PATH,
    name: 'top-level phase registry',
    patterns: [
      /"dir": "34-brand-message-template-start-flow"/,
      /"status": "pending"|"status": "completed"/,
    ],
  },
  {
    path: PACKAGE_PATH,
    name: 'package script',
    patterns: [
      /"test:brand-message-template-start-flow-contract": "node scripts\/check_brand_message_template_start_flow_contract\.mjs"/,
    ],
  },
  {
    path: STEP_PATHS[0],
    name: 'step 0 contract-only checker',
    patterns: [
      /contract-and-checker/,
      /--contract-only/,
      /no-schema\/no-provider-call contract/i,
      /npm run lint && npm run build/,
    ],
  },
  {
    path: STEP_PATHS[1],
    name: 'step 1 draft helper',
    patterns: [
      /createBrandMessageDraftFromTemplate/,
      /unresolvedVariables/,
      /unsupportedFields/,
      /npm run lint && npm run build/,
    ],
  },
  {
    path: STEP_PATHS[2],
    name: 'step 2 composer wiring',
    patterns: [
      /provider-template selection behavior/,
      /start-from-template code path/,
      /normal editable Brand Message composer/i,
      /npm run lint && npm run build/,
    ],
  },
  {
    path: STEP_PATHS[3],
    name: 'step 3 final qa',
    patterns: [
      /test:brand-message-template-start-flow-contract/,
      /final-qa\.md/,
      /browser route\(s\) checked/i,
      /npm run lint && npm run build/,
    ],
  },
];

const IMPLEMENTATION_CHECKS = [
  {
    path: BRAND_FORM_PATH,
    name: 'production draft helper',
    patterns: [
      /export function createBrandMessageDraftFromTemplate\(template, currentMessage = \{\}\)/,
      /unresolvedVariables: \[\.\.\.unresolvedVariableKeys\]/,
      /unsupportedFields/,
      /mode: 'freestyle'/,
      /templateCode: ''/,
      /templateParameter: \{\}/,
      /imageParameters: \{\}/,
      /videoParameter: null/,
      /normalizeBrandTemplateButtons/,
      /template-carousel-\$\{index \+ 1\}-button/,
    ],
  },
  {
    path: BRAND_FORM_PATH,
    name: 'composer start action',
    patterns: [
      /function handleTemplateStart\(template\)/,
      /function BrandTemplateSelectionAction/,
      /function renderBrandTemplateDialogCard\(\{ isSelected, key, onSelect, template \}\)/,
      /function renderBrandTemplateDialogToolbarAction/,
      /createBrandMessageDraftFromTemplate\(template, message\)/,
      /handleTemplateStart\(dialogSelectedTemplate\)/,
      /복사해서 편집/,
      /selectionMode="deferred"/,
      /renderTemplateCard=\{renderBrandTemplateDialogCard\}/,
    ],
  },
  {
    path: PAYLOAD_PATH,
    name: 'provider template send path remains',
    patterns: [
      /message\.mode === 'template' \|\| message\.templateCode/,
      /mode: 'template'/,
      /templateCode/,
      /templateParameter/,
      /mode: 'freestyle'/,
    ],
  },
  {
    path: DEFAULTS_TEST_PATH,
    name: 'draft helper and ui tests',
    patterns: [
      /createBrandMessageDraftFromTemplate/,
      /converts a variable-free WIDE template into a freestyle draft/,
      /materializes Brand Message template variables/,
      /preserves unresolved Brand Message template variables/,
      /copies carousel templates with editable item button IDs/,
      /renders Brand Message template picker cards as selectable previews/,
      /renders Brand Message template picker with a toolbar action after selection/,
      /템플릿 사용/,
    ],
  },
  {
    path: PAYLOAD_TEST_PATH,
    name: 'payload tests',
    patterns: [
      /sends a Brand Message started from a template through the freestyle payload branch/,
      /payload\.mode\)\.toBe\('freestyle'\)/,
      /not\.toHaveProperty\('templateCode'\)/,
      /builds an NHN template brand-message payload with recipient parameters/,
      /payload\)\.toEqual\(\{[\s\S]*mode: 'template'/,
    ],
  },
];

const failures = [];

await ensureFile(CONTRACT_PATH);
const contract = await readText(CONTRACT_PATH);
const normalizedContract = contract.replace(/\s+/g, ' ');
assertPatternGroups(normalizedContract, CONTRACT_CHECKS, 'contract');

for (const check of SCAFFOLD_CHECKS) {
  const source = await readText(check.path);
  assertPatterns(source, check.patterns, check.name);
}

await assertNoSchemaOrProviderExpansion();

if (!CONTRACT_ONLY) {
  for (const check of IMPLEMENTATION_CHECKS) {
    const source = await readText(check.path);
    assertPatterns(source, check.patterns, check.name);
  }
}

if (failures.length > 0) {
  console.error('Brand Message template start flow contract check failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log('Brand Message template start flow contract OK');
console.log(`contract=${CONTRACT_PATH}`);
console.log(`mode=${CONTRACT_ONLY ? 'contract-only' : 'final'}`);

async function ensureFile(filePath) {
  try {
    await access(filePath);
  } catch {
    failures.push(`${filePath}: missing file`);
  }
}

async function readText(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    failures.push(`${filePath}: ${error.message}`);
    return '';
  }
}

function assertPatternGroups(source, checks, prefix) {
  for (const check of checks) {
    assertPatterns(source, check.patterns, `${prefix}: ${check.name}`);
  }
}

function assertPatterns(source, patterns, name) {
  const missing = patterns.filter((pattern) => !pattern.test(source));

  if (missing.length) {
    failures.push(`${name}: missing ${missing.map(String).join(', ')}`);
  }
}

async function assertNoSchemaOrProviderExpansion() {
  const schema = await readText(SCHEMA_PATH);

  if (/template_start|start_flow|brand_message_template_start/i.test(schema)) {
    failures.push('schema: must not add template-start-flow fields');
  }

  await assertNoSuspiciousFiles('drizzle', /template.*start|start.*template|brand.*template.*draft/i);
  await assertNoSuspiciousFiles('src/app/api', /template.*start|start.*template|brand.*template.*draft/i);
  await assertNoSuspiciousFiles('src', /template.*start|start.*template|brand.*template.*draft/i, /\.(ts|tsx)$/);
}

async function assertNoSuspiciousFiles(root, namePattern, extensionPattern = null) {
  let entries = [];

  try {
    entries = await readdir(root, { recursive: true });
  } catch {
    return;
  }

  const suspicious = entries
    .map((entry) => String(entry))
    .filter((entry) => namePattern.test(path.basename(entry)))
    .filter((entry) => !extensionPattern || extensionPattern.test(entry));

  if (suspicious.length) {
    failures.push(`${root}: forbidden phase implementation files ${suspicious.join(', ')}`);
  }
}
