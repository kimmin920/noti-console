#!/usr/bin/env node

import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const CONTRACT_ONLY = process.argv.includes('--contract-only');
const PHASE = '33-message-log-provenance';
const CONTRACT_PATH = `phases/${PHASE}/message-log-provenance-contract.md`;
const PHASE_INDEX_PATH = `phases/${PHASE}/index.json`;
const TOP_LEVEL_INDEX_PATH = 'phases/index.json';
const PACKAGE_PATH = 'package.json';
const SCHEMA_PATH = 'src/db/schema.js';
const SERVICE_PATH = 'src/server/messageLogs/service.js';
const SELECTORS_PATH = 'src/features/console/messageLogs/selectors.js';
const CONSOLE_PAGES_PATH = 'src/features/console/ConsolePages.jsx';
const DEV_FIXTURES_PATH = 'src/server/messageLogs/devFixtures.js';
const SELECTOR_TEST_PATH = 'src/server/__tests__/messageLogSelectors.test.js';
const LEDGER_TEST_PATH = 'src/server/__tests__/messageLogLedgerService.test.js';
const STEP_PATHS = Array.from({ length: 4 }, (_, index) => `phases/${PHASE}/step${index}.md`);

const CONTRACT_CHECKS = [
  {
    name: 'existing data contract',
    patterns: [
      /without adding database schema, migrations/i,
      /`message_send_groups` source fields only/i,
      /`automation_event_deliveries`/,
      /`messageSendSourceTypeEnum` remains `manual \| automation`/i,
    ],
  },
  {
    name: 'source classification',
    patterns: [
      /sourceType === automation/,
      /sourceAutomationDeliveryId exists/,
      /sourceAutomationRuleId exists/,
      /`sourceExternalEventId` is metadata, not the primary automation classifier/i,
      /manual -> 직접 발송/,
      /automation -> 자동화/,
    ],
  },
  {
    name: 'source versus kind',
    patterns: [
      /Source and kind are separate UI concepts/i,
      /`sendTiming === scheduled` remains `구분: 예약`/,
      /`sendKind === bulk` remains `구분: 대량`/,
      /must not be reclassified as source types/i,
    ],
  },
  {
    name: 'public DTO and UI',
    patterns: [
      /`toPublicLedgerLogGroupDto` must include a `source` object/i,
      /type: 'automation'/,
      /automationRuleName: null/,
      /type: 'manual'/,
      /separate `발송 구분` column/i,
      /`자동화 정보` section only for automation source groups/i,
    ],
  },
  {
    name: 'fixtures tests exclusions qa',
    patterns: [
      /Add one message-log dev fixture/i,
      /sourceType: 'automation'/,
      /list\/detail DTOs include `source`/i,
      /Do not extend `messageSendSourceTypeEnum`/i,
      /Do not add `api`, `reservation`, `bulk`, or `system` as DB source types/i,
      /message-log-provenance-list-desktop\.png/i,
    ],
  },
];

const SCAFFOLD_CHECKS = [
  {
    path: PHASE_INDEX_PATH,
    name: 'phase index',
    patterns: [
      /"phase": "33-message-log-provenance"/,
      /"name": "contract-and-checker"/,
      /"name": "source-dto-and-selectors"/,
      /"name": "message-log-table-and-detail-ui"/,
      /"name": "tests-and-final-qa"/,
    ],
  },
  {
    path: TOP_LEVEL_INDEX_PATH,
    name: 'top-level phase registry',
    patterns: [
      /"dir": "33-message-log-provenance"/,
      /"status": "pending"/,
    ],
  },
  {
    path: PACKAGE_PATH,
    name: 'package script',
    patterns: [
      /"test:message-log-provenance-contract": "node scripts\/check_message_log_provenance_contract\.mjs"/,
    ],
  },
  {
    path: STEP_PATHS[0],
    name: 'step 0 contract-only checker',
    patterns: [
      /contract-and-checker/,
      /--contract-only/,
      /no-schema-change contract/i,
    ],
  },
  {
    path: STEP_PATHS[1],
    name: 'step 1 dto selectors',
    patterns: [
      /toPublicMessageLogSourceDto/,
      /getMessageLogGroupSourceLabel/,
      /getMessageLogGroupSourceDetailItems/,
      /sourceExternalEventId` as metadata/i,
    ],
  },
  {
    path: STEP_PATHS[2],
    name: 'step 2 table detail ui',
    patterns: [
      /separate `발송 구분` column/,
      /`자동화 정보` detail section only when/,
      /dev fixture with automation source metadata/i,
    ],
  },
  {
    path: STEP_PATHS[3],
    name: 'step 3 final qa',
    patterns: [
      /test:message-log-provenance-contract/,
      /message-log-provenance-detail-desktop\.png/,
      /message-log-provenance-auth-blocker\.txt/,
    ],
  },
];

const SCHEMA_CHECKS = [
  {
    name: 'source enum remains manual automation only',
    pattern: /messageSendSourceTypeEnum\s*=\s*pgEnum\('message_send_source_type',\s*\[\s*'manual',\s*'automation'\s*\]\)/,
  },
  {
    name: 'existing source fields remain available',
    patterns: [
      /sourceType: messageSendSourceTypeEnum\('source_type'\)/,
      /sourceEventKey: varchar\('source_event_key'/,
      /sourceExternalEventId: varchar\('source_external_event_id'/,
      /sourceChannelCode: varchar\('source_channel_code'/,
      /sourceAutomationRuleId: uuid\('source_automation_rule_id'\)/,
      /sourceAutomationDeliveryId: uuid\('source_automation_delivery_id'\)/,
    ],
  },
];

const IMPLEMENTATION_CHECKS = [
  {
    path: SERVICE_PATH,
    name: 'server source dto',
    patterns: [
      /function toPublicMessageLogSourceDto\(group\)/,
      /source: toPublicMessageLogSourceDto\(group\)/,
      /type: 'automation'/,
      /label: '자동화'/,
      /sourceEventKey/,
      /sourceExternalEventId/,
      /sourceChannelCode/,
      /sourceAutomationRuleId/,
      /automationRuleName: null/,
      /sourceAutomationDeliveryId/,
      /type: 'manual'/,
      /label: '직접 발송'/,
    ],
  },
  {
    path: SELECTORS_PATH,
    name: 'source selectors',
    patterns: [
      /export function getMessageLogGroupSourceLabel\(group\)/,
      /export function getMessageLogGroupSourceDetailItems\(group\)/,
      /source\??\.type === 'automation'/,
      /자동화/,
      /직접 발송/,
      /이벤트 키/,
      /외부 이벤트 ID/,
      /채널 코드/,
      /자동화 Rule ID/,
      /자동화 Delivery ID/,
    ],
  },
  {
    path: CONSOLE_PAGES_PATH,
    name: 'console provenance ui',
    patterns: [
      /getMessageLogGroupSourceLabel/,
      /getMessageLogGroupSourceDetailItems/,
      /header: '발송 구분'/,
      /label="발송 구분"/,
      /자동화 정보/,
      /sourceDetailItems\.length/,
    ],
  },
  {
    path: DEV_FIXTURES_PATH,
    name: 'automation provenance fixture',
    patterns: [
      /sourceType: 'automation'/,
      /sourceEventKey:/,
      /sourceExternalEventId:/,
      /sourceChannelCode:/,
      /sourceAutomationRuleId:/,
      /sourceAutomationDeliveryId:/,
    ],
  },
  {
    path: SELECTOR_TEST_PATH,
    name: 'selector tests',
    patterns: [
      /getMessageLogGroupSourceLabel/,
      /getMessageLogGroupSourceDetailItems/,
      /자동화/,
      /직접 발송/,
      /예약/,
      /대량/,
    ],
  },
  {
    path: LEDGER_TEST_PATH,
    name: 'ledger DTO tests',
    patterns: [
      /source:/,
      /sourceType: 'automation'/,
      /sourceAutomationDeliveryId/,
      /sourceAutomationRuleId/,
      /sourceExternalEventId/,
    ],
  },
];

const IMPLEMENTATION_FORBIDDEN_CHECKS = [
  {
    path: SERVICE_PATH,
    name: 'phase 33 does not join automation tables in service',
    patterns: [
      /automationEventDeliveries/,
      /automationRules/,
    ],
  },
  {
    path: SELECTORS_PATH,
    name: 'source selector does not reclassify kind',
    patterns: [
      /source\.type = 'reservation'/,
      /source\.type = 'bulk'/,
      /type: 'reservation'/,
      /type: 'bulk'/,
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

const schema = await readText(SCHEMA_PATH);
for (const check of SCHEMA_CHECKS) {
  if (check.pattern && !check.pattern.test(schema)) {
    failures.push(`${check.name}: missing ${check.pattern}`);
  }
  if (check.patterns) {
    assertPatterns(schema, check.patterns, check.name);
  }
}
await assertNoPhase33Migrations();

if (!CONTRACT_ONLY) {
  for (const check of IMPLEMENTATION_CHECKS) {
    const source = await readText(check.path);
    assertPatterns(source, check.patterns, check.name);
  }

  for (const check of IMPLEMENTATION_FORBIDDEN_CHECKS) {
    const source = await readText(check.path);
    const forbidden = check.patterns.filter((pattern) => pattern.test(source));
    if (forbidden.length) {
      failures.push(`${check.name}: forbidden ${forbidden.map(String).join(', ')}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Message log provenance contract check failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log('Message log provenance contract OK');
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

async function assertNoPhase33Migrations() {
  const drizzleDir = 'drizzle';
  let entries = [];

  try {
    entries = await readdir(drizzleDir, { recursive: true });
  } catch {
    return;
  }

  const suspicious = entries
    .map((entry) => String(entry))
    .filter((entry) => /provenance|message.*source|source.*type|automation.*source/i.test(path.basename(entry)));

  if (suspicious.length) {
    failures.push(`schema migrations: forbidden phase-33-looking migration files ${suspicious.join(', ')}`);
  }
}
