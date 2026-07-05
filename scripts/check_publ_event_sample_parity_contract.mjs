#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { access, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const CONTRACT_ONLY = process.argv.includes('--contract-only');
const PHASE = '38-publ-event-prop-sample-parity';
const CONTRACT_PATH = `phases/${PHASE}/publ-event-prop-sample-parity-contract.md`;
const PHASE_INDEX_PATH = `phases/${PHASE}/index.json`;
const TOP_LEVEL_INDEX_PATH = 'phases/index.json';
const PACKAGE_PATH = 'package.json';
const CHECKER_PATH = 'scripts/check_publ_event_sample_parity_contract.mjs';
const PHASE_37_CHECKER_PATH = 'scripts/check_publ_event_editor_contract.mjs';
const SOURCE_ROOT = '/Users/kimi/Desktop/side-projects/nhn-notification';
const SOURCE_PRISMA_PATH = `${SOURCE_ROOT}/packages/database/prisma/schema.prisma`;
const SOURCE_CATALOG_PATH = `${SOURCE_ROOT}/apps/api/src/v2/publ-events/publ-events.catalog.ts`;
const SOURCE_DTO_PATH = `${SOURCE_ROOT}/apps/api/src/v2/publ-events/v2-publ-events.dto.ts`;
const SOURCE_SERVICE_PATH = `${SOURCE_ROOT}/apps/api/src/v2/publ-events/v2-publ-events.service.ts`;
const SCHEMA_PATH = 'src/db/schema.js';
const IMPORTER_PATH = 'src/server/publEvents/importer.js';
const REPOSITORY_PATH = 'src/server/publEvents/repository.js';
const SERVICE_PATH = 'src/server/publEvents/service.js';
const VIEWS_PATH = 'src/server/publEvents/views.js';
const DETAIL_MODEL_PATH = 'src/features/console/publEvents/publEventDetailModel.js';
const EDITOR_PAYLOAD_PATH = 'src/features/console/publEvents/publEventEditorPayload.js';
const EDITOR_STATE_PATH = 'src/features/console/publEvents/publEventEditorState.js';
const DETAIL_SECTIONS_PATH = 'src/features/console/publEvents/PublEventDetailSections.jsx';
const FINAL_EVIDENCE_PATHS = [
  `.omo/evidence/${PHASE}/source-sample-inventory.md`,
  `.omo/evidence/${PHASE}/ui-sample-column.md`,
  `.omo/evidence/${PHASE}/final-qa.md`,
];

const CONTRACT_CHECKS = [
  {
    name: 'source-faithful sample goal',
    patterns: [
      /Bring `sample` back into PUBL event prop definitions/i,
      /source-faithful\s+`nhn-notification` behavior/i,
      /not a new formatter, runtime resolver, or inference feature/i,
      /nullable example value stored with each prop/i,
    ],
  },
  {
    name: 'source anchors',
    patterns: [
      /schema\.prisma` defines prop `sample String\?`/i,
      /PublEventPropSeed\.sample\?: string/i,
      /sample\?: string/i,
      /sample: nullableText\(prop\.sample\)/i,
      /sample: prop\.sample/i,
    ],
  },
  {
    name: 'data and runtime contract',
    patterns: [
      /Add nullable `sample` to `publ_event_prop_definitions`/i,
      /Importer normalization reads `sample`/i,
      /Detail and editor DTOs expose `props\[\]\.sample`/i,
      /Runtime PUBL variable resolution does not use `sample`/i,
      /Required validation remains based on `enabled=true`, `required=true`, payload\s+rawPath presence, and fallback/i,
    ],
  },
  {
    name: 'ui and negative assertions',
    patterns: [
      /variable data table shows a `Sample` column/i,
      /Variable detail drawer shows `sample`/i,
      /Variable edit drawer includes an editable `sample` field/i,
      /`sample` is generated or inferred/i,
      /required validation treats `sample` as fallback/i,
      /phase 37 contract\/checker still forbids `sample`/i,
    ],
  },
  {
    name: 'final evidence',
    patterns: [
      /source-sample-inventory\.md/,
      /ui-sample-column\.md/,
      /final-qa\.md/,
    ],
  },
];

const SCAFFOLD_CHECKS = [
  {
    path: PHASE_INDEX_PATH,
    name: 'phase step index',
    patterns: [
      /"phase": "38-publ-event-prop-sample-parity"/,
      /"name": "source-contract-and-checker"/,
      /"name": "schema-import-persistence"/,
      /"name": "api-editor-model-sample-flow"/,
      /"name": "sample-ui-table-and-drawer"/,
      /"name": "source-sample-backfill-and-final-qa"/,
    ],
  },
  {
    path: TOP_LEVEL_INDEX_PATH,
    name: 'top-level phase registry',
    patterns: [
      /"dir": "38-publ-event-prop-sample-parity"/,
      /"status": "pending"/,
    ],
  },
  {
    path: PACKAGE_PATH,
    name: 'package script',
    patterns: [
      /"test:publ-event-sample-parity-contract": "node scripts\/check_publ_event_sample_parity_contract\.mjs"/,
    ],
  },
];

const SOURCE_ANCHOR_CHECKS = [
  {
    path: SOURCE_PRISMA_PATH,
    name: 'source Prisma prop model',
    block: 'model PublEventPropDefinition',
    patterns: [
      /\bsample\s+String\?/,
    ],
  },
  {
    path: SOURCE_CATALOG_PATH,
    name: 'source catalog prop seed',
    patterns: [
      /export type PublEventPropSeed\s*=\s*\{[\s\S]*sample\?: string;/,
      /function prop\([\s\S]*sample\?: string[\s\S]*\): PublEventPropSeed/,
      /sample,\s*\n\s*\.\.\.options/,
    ],
  },
  {
    path: SOURCE_DTO_PATH,
    name: 'source DTO sample exposure',
    block: 'export class V2PublEventPropDto',
    patterns: [
      /@ApiProperty\(\{ required: false \}\)[\s\S]*sample\?: string;/,
    ],
  },
  {
    path: SOURCE_SERVICE_PATH,
    name: 'source service sample persistence and return',
    patterns: [
      /sample:\s*this\.nullableText\(prop\.sample\)/,
      /sample:\s*prop\.sample/,
    ],
  },
];

const FINAL_FILE_CHECKS = [
  {
    path: IMPORTER_PATH,
    minProgress: 1,
    name: 'PUBL event importer sample read',
    patterns: [
      /sample:\s*readOptionalString\(prop,\s*['"]sample['"]\)/,
    ],
  },
  {
    path: SERVICE_PATH,
    minProgress: 2,
    name: 'PUBL event editor service sample payload',
    patterns: [
      /PROP_EDITOR_FIELDS[\s\S]*['"]sample['"]/,
      /sample:\s*normalizeNullableString\(prop\.sample,\s*`props\[\$\{index\}\]\.sample`\)/,
    ],
  },
  {
    path: VIEWS_PATH,
    minProgress: 2,
    name: 'PUBL event detail view sample exposure',
    patterns: [
      /function toDetailProp[\s\S]*sample:\s*prop\?\.sample\s*\?\?\s*null/,
    ],
  },
  {
    path: DETAIL_MODEL_PATH,
    minProgress: 2,
    name: 'PUBL event detail model sample normalization',
    patterns: [
      /sample:\s*prop\?\.sample\s*\?\?\s*['"]{2}/,
    ],
  },
  {
    path: EDITOR_STATE_PATH,
    minProgress: 2,
    name: 'PUBL event editor state sample draft',
    patterns: [
      /PROP_FIELDS[\s\S]*['"]sample['"]/,
      /sample:\s*prop\.sample\s*\?\?\s*['"]{2}/,
    ],
  },
  {
    path: EDITOR_PAYLOAD_PATH,
    minProgress: 2,
    name: 'PUBL event editor payload sample serialization',
    patterns: [
      /sample:\s*nullableString\(prop\.sample\)/,
    ],
  },
  {
    path: DETAIL_SECTIONS_PATH,
    minProgress: 3,
    name: 'PUBL event sample table and drawers',
    patterns: [
      /header:\s*['"]Sample['"]/,
      /Definition label=["']Sample["'] value=\{variable\.sample\}/,
      /id=["']publ-event-variable-sample["']/,
      /label=["']Sample["']/,
      /updateField\(['"]sample['"],\s*value\)/,
    ],
  },
];

const failures = [];
const phaseProgress = await readPhaseProgress();

await ensureFile(CONTRACT_PATH);
const contract = await readText(CONTRACT_PATH);
assertPatternGroups(contract.replace(/\s+/g, ' '), CONTRACT_CHECKS, 'contract');

for (const check of SCAFFOLD_CHECKS) {
  const source = await readText(check.path);
  assertPatterns(source, check.patterns, check.name);
}

await assertSourceAnchors();
await assertNoForbiddenSampleGeneration();
await assertRuntimeDoesNotUseSample();
await assertNoIntroducedTypeScript();
await assertProductionRoutesDoNotImportPlayground();
await assertNoPrimerPackageImports();

if (!CONTRACT_ONLY) {
  await assertSchemaSampleColumn();
  await assertMigrationAddsSampleColumn();
  await assertRepositorySamplePersistence();
  await assertFileChecks(FINAL_FILE_CHECKS.filter((check) => phaseProgress >= (check.minProgress ?? 2)));

  if (phaseProgress >= 2) {
    await assertPhase37NoLongerForbidsSample();
  }

  if (phaseProgress >= 4 || await anyFileExists(FINAL_EVIDENCE_PATHS)) {
    await assertFinalEvidence();
  }
}

if (failures.length > 0) {
  console.error('PUBL event sample parity contract check failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log('PUBL event sample parity contract OK');
console.log(`contract=${CONTRACT_PATH}`);
console.log(`mode=${CONTRACT_ONLY ? 'contract-only' : 'default'}`);
console.log(`phaseProgress=${phaseProgress}`);

async function assertSourceAnchors() {
  for (const check of SOURCE_ANCHOR_CHECKS) {
    const source = await readText(check.path);
    const checkedSource = check.block ? getNamedBlock(source, check.block) : source;

    if (check.block && !checkedSource) {
      failures.push(`${check.path}: missing ${check.block}`);
      continue;
    }

    assertPatterns(checkedSource, check.patterns, check.name);
  }
}

async function assertSchemaSampleColumn() {
  const source = await readText(SCHEMA_PATH);
  const tableBlock = getFunctionLikeBlock(source, 'export const publEventPropDefinitions = pgTable');

  if (!tableBlock) {
    failures.push(`${SCHEMA_PATH}: missing publEventPropDefinitions table`);
    return;
  }

  assertPatterns(tableBlock, [
    /sample:\s*(?:varchar|text)\(['"]sample['"]/,
  ], 'PUBL event prop schema sample column');

  if (/sample:\s*(?:varchar|text)\(['"]sample['"][\s\S]{0,120}\.notNull\(/.test(tableBlock)) {
    failures.push(`${SCHEMA_PATH}: publEventPropDefinitions.sample must be nullable`);
  }
}

async function assertMigrationAddsSampleColumn() {
  const migrationFiles = (await listFiles('drizzle').catch(() => []))
    .filter((filePath) => filePath.endsWith('.sql'));

  let matched = false;
  for (const filePath of migrationFiles) {
    const source = await readText(filePath);
    if (
      /ALTER TABLE\s+"publ_event_prop_definitions"\s+ADD COLUMN\s+"sample"/i.test(source)
      || /ALTER TABLE\s+publ_event_prop_definitions\s+ADD COLUMN\s+sample/i.test(source)
    ) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    failures.push('drizzle/: missing migration that adds nullable sample to publ_event_prop_definitions');
  }
}

async function assertRepositorySamplePersistence() {
  const source = await readText(REPOSITORY_PATH);
  const checks = [
    ['toPropRow', /sample:\s*prop\.sample/],
    ['toPropUpdateRow', /sample:\s*prop\.sample/],
    ['toEditorPropUpdateRow', /sample:\s*prop\.sample/],
    ['fromPropRow', /sample:\s*row\.sample/],
  ];

  for (const [functionName, pattern] of checks) {
    const block = getFunctionBlock(source, functionName);
    if (!block) {
      failures.push(`${REPOSITORY_PATH}: missing ${functionName}`);
      continue;
    }

    assertPatterns(block, [pattern], `${REPOSITORY_PATH}:${functionName} sample preservation`);
  }
}

async function assertPhase37NoLongerForbidsSample() {
  const source = await readText(PHASE_37_CHECKER_PATH);
  const forbiddenBlocks = [
    getFunctionBlock(source, 'assertPublDetailDoesNotExposeIgnoredMetadata'),
    getSourceSliceAround(source, 'PUBL event detail privacy tests'),
  ].filter(Boolean);

  for (const block of forbiddenBlocks) {
    if (/\bsample\b/i.test(block)) {
      failures.push(`${PHASE_37_CHECKER_PATH}: phase 37 checker still forbids sample metadata`);
    }
  }
}

async function assertNoForbiddenSampleGeneration() {
  const sourceFiles = await getLocalCodeFiles();
  const forbiddenPatterns = [
    [/\binferSample\b/, 'inferSample helper'],
    [/\bgenerateSample\b/, 'generateSample helper'],
    [/\bsample(?:From|For)(?:RawPath|Type|Fallback|Label|Parser)\b/i, 'sample derivation helper'],
    [/\b(?:infer|generate|derive)[A-Za-z0-9_]*Sample\b/i, 'sample inference helper'],
    [/\bsample\s*:[^\n]*(?:rawPath|propType|\btype\b|fallback|parserPipeline|label)/, 'sample derived from another prop field'],
    [/\bconst\s+sample\s*=[^\n]*(?:rawPath|propType|\btype\b|fallback|parserPipeline|label)/, 'sample derived from another prop field'],
  ];

  for (const filePath of sourceFiles) {
    const source = await readText(filePath);
    for (const [pattern, description] of forbiddenPatterns) {
      if (pattern.test(source)) {
        failures.push(`${filePath}: forbidden ${description}`);
      }
    }
  }
}

async function assertRuntimeDoesNotUseSample() {
  const source = await readText(SERVICE_PATH);
  const runtimeBlocks = [
    ['resolvePublEventPayload', getFunctionBlock(source, 'resolvePublEventPayload')],
    ['normalizeProps', getFunctionBlock(source, 'normalizeProps')],
    ['applyParserPipeline', getFunctionBlock(source, 'applyParserPipeline')],
    ['applyParserStep', getFunctionBlock(source, 'applyParserStep')],
  ];

  for (const [name, block] of runtimeBlocks) {
    if (!block) {
      failures.push(`${SERVICE_PATH}: missing ${name}`);
      continue;
    }

    if (/\bsample\b/i.test(block)) {
      failures.push(`${SERVICE_PATH}:${name}: runtime payload resolution must not read sample`);
    }
  }
}

async function assertNoIntroducedTypeScript() {
  const introduced = getGitChanges()
    .filter((change) => change.status.includes('A') || change.status.includes('?') || change.status.includes('C'))
    .map((change) => change.path)
    .filter((filePath) => /\.(?:ts|tsx|mts|cts)$/.test(filePath) && !/\.d\.ts$/.test(filePath));

  if (introduced.length) {
    failures.push(`TypeScript implementation files are out of scope for ${PHASE}: ${introduced.join(', ')}`);
  }
}

async function assertProductionRoutesDoNotImportPlayground() {
  const routeFiles = (await listFiles('src/app').catch(() => []))
    .filter((filePath) => /\.(?:js|jsx|mjs)$/.test(filePath))
    .filter((filePath) => !filePath.endsWith('.dev.jsx'))
    .filter((filePath) => !filePath.includes('/playground/'));

  for (const filePath of routeFiles) {
    const source = await readText(filePath);

    if (importsPlayground(source)) {
      failures.push(`${filePath}: production route imports from src/playground`);
    }
  }
}

async function assertNoPrimerPackageImports() {
  const sourceFiles = [
    ...(await listFiles('src').catch(() => [])),
    ...(await listFiles('scripts').catch(() => [])),
  ].filter((filePath) => /\.(?:js|jsx|mjs)$/.test(filePath));

  for (const filePath of sourceFiles) {
    const source = await readText(filePath);

    if (importsPrimer(source)) {
      failures.push(`${filePath}: Primer package imports are out of scope`);
    }
  }

  const packageSource = await readText(PACKAGE_PATH);
  const packagePrimerDependency = /"@primer\/(?:react|primitives|octicons-react|octicons|brand|react-brand|behaviors|components?)"\s*:/.exec(packageSource);

  if (packagePrimerDependency) {
    failures.push(`${PACKAGE_PATH}: Primer dependency ${packagePrimerDependency[0]} is out of scope`);
  }
}

async function assertFileChecks(checks) {
  for (const check of checks) {
    const source = await readText(check.path);
    assertPatterns(source, check.patterns ?? [], check.name);
    assertForbiddenPatterns(source, check.forbidden ?? [], check.name);
  }
}

async function assertFinalEvidence() {
  for (const filePath of FINAL_EVIDENCE_PATHS) {
    await ensureFile(filePath);
    const source = await readText(filePath);
    assertPatterns(source, [/sample/i], `${filePath} evidence`);
  }
}

async function getLocalCodeFiles() {
  const roots = [
    'src/app',
    'src/server',
    'src/features',
    'src/components',
    'scripts',
  ];
  const files = [];

  for (const root of roots) {
    files.push(...(await listFiles(root).catch(() => [])));
  }

  return files
    .filter((filePath, index, allFiles) => allFiles.indexOf(filePath) === index)
    .filter((filePath) => /\.(?:js|jsx|mjs)$/.test(filePath))
    .filter((filePath) => filePath !== CHECKER_PATH);
}

async function readPhaseProgress() {
  const source = await readText(PHASE_INDEX_PATH);
  if (!source) return 0;

  try {
    const index = JSON.parse(source);
    const steps = Array.isArray(index?.steps) ? index.steps : [];
    let progress = 0;

    for (const step of steps) {
      const stepNumber = Number(step?.step);
      if (!Number.isInteger(stepNumber)) continue;

      if (step.status === 'completed' || step.started_at || step.completed_at) {
        progress = Math.max(progress, stepNumber);
      }
    }

    return progress;
  } catch (error) {
    failures.push(`${PHASE_INDEX_PATH}: invalid JSON (${error.message})`);
    return 0;
  }
}

async function ensureFile(filePath) {
  try {
    await access(filePath);
  } catch {
    failures.push(`${filePath}: missing file`);
  }
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function anyFileExists(filePaths) {
  for (const filePath of filePaths) {
    if (await fileExists(filePath)) return true;
  }

  return false;
}

async function readText(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    failures.push(`${filePath}: ${error.message}`);
    return '';
  }
}

async function listFiles(rootPath) {
  const rootStat = await stat(rootPath);
  if (!rootStat.isDirectory()) return [rootPath];

  const entries = await readdir(rootPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
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

function assertForbiddenPatterns(source, patterns, name) {
  const forbidden = patterns.filter((pattern) => pattern.test(source));

  if (forbidden.length) {
    failures.push(`${name}: forbidden ${forbidden.map(String).join(', ')}`);
  }
}

function getGitChanges() {
  try {
    const output = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
      encoding: 'utf8',
    });

    return output
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map((line) => {
        const status = line.slice(0, 2);
        const rawPath = line.slice(3);
        const renameMarker = ' -> ';
        const normalizedPath = rawPath.includes(renameMarker)
          ? rawPath.slice(rawPath.indexOf(renameMarker) + renameMarker.length)
          : rawPath;

        return { path: normalizedPath, status };
      });
  } catch (error) {
    failures.push(`git status failed: ${error.message}`);
    return [];
  }
}

function importsPlayground(source) {
  return /import\s+(?:[\s\S]*?\s+from\s+)?['"][^'"]*(?:src\/|@\/|\.\.?\/)+playground(?:\/|['"])/.test(source)
    || /import\(['"][^'"]*(?:src\/|@\/|\.\.?\/)+playground(?:\/|['"])/.test(source);
}

function importsPrimer(source) {
  return /from\s+['"]@primer\/(?:react|primitives|octicons-react|octicons|brand|react-brand|behaviors|components?)['"]/.test(source)
    || /import\(['"]@primer\/(?:react|primitives|octicons-react|octicons|brand|react-brand|behaviors|components?)['"]\)/.test(source);
}

function getNamedBlock(source, blockStart) {
  const startIndex = source.indexOf(blockStart);
  if (startIndex === -1) return '';

  const openBraceIndex = source.indexOf('{', startIndex);
  if (openBraceIndex === -1) return '';

  return getBalancedBlock(source, startIndex, openBraceIndex);
}

function getFunctionLikeBlock(source, marker) {
  const startIndex = source.indexOf(marker);
  if (startIndex === -1) return '';

  const openParenIndex = source.indexOf('(', startIndex);
  if (openParenIndex === -1) return '';

  return getBalancedBlock(source, startIndex, openParenIndex, '(', ')');
}

function getFunctionBlock(source, functionName) {
  const declarationPattern = new RegExp(`(?:export\\s+)?function\\s+${functionName}\\s*\\(`);
  const declarationMatch = declarationPattern.exec(source);
  if (!declarationMatch) return '';

  const openBraceIndex = source.indexOf('{', declarationMatch.index);
  if (openBraceIndex === -1) return '';

  return getBalancedBlock(source, declarationMatch.index, openBraceIndex);
}

function getBalancedBlock(source, startIndex, openIndex, openCharacter = '{', closeCharacter = '}') {
  let depth = 0;

  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];

    if (character === openCharacter) {
      depth += 1;
    } else if (character === closeCharacter) {
      depth -= 1;

      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  return source.slice(startIndex);
}

function getSourceSliceAround(source, text) {
  const index = source.indexOf(text);
  if (index === -1) return '';

  return source.slice(Math.max(0, index - 800), Math.min(source.length, index + 800));
}
