#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { access, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const CONTRACT_ONLY = process.argv.includes('--contract-only');
const PHASE = '36-publ-event-contract-inspector';
const CONTRACT_PATH = `phases/${PHASE}/publ-event-contract-inspector-contract.md`;
const PHASE_INDEX_PATH = `phases/${PHASE}/index.json`;
const TOP_LEVEL_INDEX_PATH = 'phases/index.json';
const PACKAGE_PATH = 'package.json';
const PUBL_VIEWS_PATH = 'src/server/publEvents/views.js';
const PUBL_QUERY_PATH = 'src/features/console/publEvents/queries.js';
const CONSOLE_PAGES_PATH = 'src/features/console/ConsoleScreenOutlet.jsx';
const ROUTING_PATH = 'src/features/console/routing.js';
const CONSOLE_CONFIG_PATH = 'src/features/console/consoleConfig.js';
const API_DETAIL_ROUTE_PATH = 'src/app/api/publ-events/[eventKey]/route.js';
const APP_DETAIL_ROUTE_PATH = 'src/app/(console)/automations/publ-events/[eventKey]/page.jsx';
const DETAIL_PAGE_PATH = 'src/features/console/publEvents/PublEventDetailPage.jsx';
const DETAIL_SECTIONS_PATH = 'src/features/console/publEvents/PublEventDetailSections.jsx';
const DETAIL_MODEL_PATH = 'src/features/console/publEvents/publEventDetailModel.js';
const DETAIL_CSS_PATH = 'src/styles/publ-event-detail.css';
const FINAL_QA_PATH = `.omo/evidence/${PHASE}/final-qa.md`;

const CONTRACT_CHECKS = [
  {
    name: 'contract inspector product shape',
    patterns: [
      /read-only PUBL event detail experience/i,
      /contract inspector, not an editor/i,
      /Prefer one contract table plus row detail drawer over tabbed navigation/i,
      /Do not import or install Primer components/i,
      /Use existing project UI primitives/i,
    ],
  },
  {
    name: 'route and api contract',
    patterns: [
      /\/automations\/publ-events\/\[eventKey\]/,
      /GET \/api\/publ-events\/\[eventKey\]/,
      /Copy event key/i,
      /Create automation/i,
      /serviceStatus/,
    ],
  },
  {
    name: 'table and inspector contract',
    patterns: [
      /Render one variables table/i,
      /Do not use tabs for overview, variables, and\s+payload mapping/i,
      /Search filters label and alias/i,
      /All[\s\S]*Used[\s\S]*Required[\s\S]*Format/i,
      /dropdown filter pattern/i,
      /row detail drawer|right drawer/i,
      /Do not render a visible "detail" text button/i,
      /existing `\.\.\.` action menu pattern/i,
      /format rules based on parserPipeline|parserPipeline steps/i,
      /Do not invent arbitrary scores, progress, or readiness percentages/i,
    ],
  },
  {
    name: 'data boundary',
    patterns: [
      /List responses must keep hiding canonical prop internals/i,
      /Detail responses may include prop internals needed for inspection/i,
      /`rawPath`/,
      /`parserPipeline`/,
      /`sortOrder`/,
      /`sample` values must not be stored or displayed as canonical data/i,
      /`rules`, `defaultTemplate`, provider template metadata, and sender profile\s+metadata must not be exposed/i,
    ],
  },
  {
    name: 'out of scope and evidence',
    patterns: [
      /Adding schema, migrations, auth routes, external provider calls, or background\s+jobs/i,
      /Introducing TypeScript/i,
      /Importing production code from `src\/playground`/i,
      /final-qa\.md/,
    ],
  },
];

const SCAFFOLD_CHECKS = [
  {
    path: PHASE_INDEX_PATH,
    name: 'phase step index',
    patterns: [
      /"phase": "36-publ-event-contract-inspector"/,
      /"name": "contract-and-checker"/,
      /"name": "detail-api-and-view-model"/,
      /"name": "query-routing-and-list-entry"/,
      /"name": "contract-inspector-ui"/,
      /"name": "final-primer-resend-qa"/,
    ],
  },
  {
    path: TOP_LEVEL_INDEX_PATH,
    name: 'top-level phase registry',
    patterns: [
      /"dir": "36-publ-event-contract-inspector"/,
      /"status": "pending"/,
    ],
  },
  {
    path: PACKAGE_PATH,
    name: 'package script',
    patterns: [
      /"test:publ-event-contract-inspector-contract": "node scripts\/check_publ_event_contract_inspector_contract\.mjs"/,
    ],
  },
];

const DETAIL_API_CHECKS = [
  {
    path: API_DETAIL_ROUTE_PATH,
    name: 'PUBL event detail API route',
    patterns: [
      /export const runtime = 'nodejs'/,
      /export async function GET/,
      /eventKey/,
      /findEventByKey/,
      /listPropsByEventId/,
      /toPublEventDetailView/,
      /notFound|status:\s*404|404/,
    ],
  },
  {
    path: PUBL_VIEWS_PATH,
    name: 'PUBL event detail view model',
    patterns: [
      /export function toPublEventDetailView/,
      /rawPath/,
      /parserPipeline/,
      /sortOrder/,
      /parserStepCount/,
    ],
    forbidden: [
      /phoneCompatible/i,
      /phoneAlias/i,
    ],
  },
];

const QUERY_ROUTE_CHECKS = [
  {
    path: PUBL_QUERY_PATH,
    name: 'PUBL event detail query hook',
    patterns: [
      /detail:/,
      /usePublEventDetailQuery/,
      /encodeURIComponent\(eventKey\)/,
      /\/api\/publ-events\/\$\{encodedEventKey\}/,
    ],
  },
  {
    path: APP_DETAIL_ROUTE_PATH,
    name: 'PUBL event console route page',
    patterns: [
      /ConsoleRoute/,
      /publ-event-detail|publEventDetail|publ-event/,
      /eventKey/,
    ],
  },
  {
    path: CONSOLE_PAGES_PATH,
    name: 'ConsolePages detail route branch',
    patterns: [
      /publ-event-detail|publEventDetail/,
      /eventKey/,
    ],
  },
  {
    path: ROUTING_PATH,
    name: 'routing keeps automation context',
    patterns: [
      /publ-event-detail|publEventDetail/,
      /automations/,
    ],
  },
  {
    path: CONSOLE_CONFIG_PATH,
    name: 'console config keeps automation navigation',
    patterns: [
      /publ-event-detail|publEventDetail/,
      /automations/,
    ],
  },
];

const DETAIL_UI_CHECKS = [
  {
    path: DETAIL_PAGE_PATH,
    name: 'PUBL event detail UI',
    patterns: [
      /usePublEventDetailQuery/,
      /detailQuery\.isPending/,
      /detailQuery\.isError/,
      /status\s*===\s*404|isNotFound/,
      /PublEventEmptyProps/,
      /refetch/,
      /selectedVariable|selectedAlias|selectedVariableAlias/,
      /aria-label|aria-labelledby/,
      /row detail|Drawer|drawer/,
    ],
  },
  {
    path: DETAIL_SECTIONS_PATH,
    name: 'PUBL event variables table UI',
    patterns: [
      /DataTableV2/,
      /SearchField/,
      /FilterSelect/,
      /ActionMenu/,
      /IconButton/,
      /MoreHorizontal|Ellipsis/,
      /Drawer/,
      /onRowClick/,
      /rawPath/,
      /header:\s*['"]Alias['"]/,
      /header:\s*['"]Type['"]/,
      /header:\s*['"]포맷['"]/,
      /parserPipeline/,
      /getParserFormatLabel|formatParserStep/,
      /aria-label|aria-labelledby/,
      /drawer|Drawer/,
    ],
    forbidden: [
      /publ-event-variable-select/,
      /header:\s*['"]Raw path['"]/,
      />\s*상세\s*</,
      /phoneCompatible/i,
      /전화 후보/,
    ],
  },
  {
    path: DETAIL_MODEL_PATH,
    name: 'PUBL event detail UI model',
    patterns: [
      /PUBL_EVENT_VARIABLE_FILTERS/,
      /value:\s*['"]all['"][\s\S]*value:\s*['"]enabled['"][\s\S]*value:\s*['"]required['"][\s\S]*value:\s*['"]transformed['"]/,
      /category/,
      /locationType/,
      /sourceType/,
      /updatedAt/,
      /parserPipelinePropCount/,
      /compareVariablePriority|getVariablePriorityRank/,
      /sortOrder/,
    ],
    forbidden: [
      /phoneCompatible/i,
      /value:\s*['"]phone['"]/,
    ],
  },
  {
    path: DETAIL_CSS_PATH,
    name: 'PUBL event detail scoped CSS',
    patterns: [
      /publ-event-detail/,
      /border/,
      /font-family: var\(--font-mono\)|font-family:\s*var\(--font-mono\)/,
      /@media/,
    ],
    forbidden: [
      /gradient/i,
      /box-shadow:\s*0\s+0|glow/i,
      /backdrop-filter|glass/i,
    ],
  },
];

const FINAL_QA_CHECKS = [
  {
    path: FINAL_QA_PATH,
    name: 'final QA evidence',
    patterns: [
      /commands/i,
      /npm run test:publ-event-contract-inspector-contract/,
      /npm run lint && npm run build/,
      /viewport/i,
      /remaining risks|risks|blockers/i,
    ],
  },
];

const failures = [];

const phaseProgress = await readPhaseProgress();

await ensureFile(CONTRACT_PATH);
const contract = await readText(CONTRACT_PATH);
const normalizedContract = contract.replace(/\s+/g, ' ');
assertPatternGroups(normalizedContract, CONTRACT_CHECKS, 'contract');

for (const check of SCAFFOLD_CHECKS) {
  const source = await readText(check.path);
  assertPatterns(source, check.patterns, check.name);
}

await assertNoSchemaOrMigrationChanges();
await assertNoIntroducedTypeScript();
await assertProductionRoutesDoNotImportPlayground();
await assertNoPrimerPackageImports();
await assertPublListViewHidesCanonicalInternals();
await assertPublDetailDoesNotExposeIgnoredMetadata();
await assertNoForbiddenDetailTabs();
if (phaseProgress >= 3 || await fileExists(DETAIL_PAGE_PATH)) {
  await assertNoUnsupportedReadinessArtifacts();
}

if (!CONTRACT_ONLY) {
  if (phaseProgress >= 1 || await fileExists(API_DETAIL_ROUTE_PATH)) {
    await assertFileChecks(DETAIL_API_CHECKS);
  }

  if (phaseProgress >= 2 || await fileExists(APP_DETAIL_ROUTE_PATH)) {
    await assertFileChecks(QUERY_ROUTE_CHECKS);
  }

  if (phaseProgress >= 3 || await fileExists(DETAIL_PAGE_PATH)) {
    await assertFileChecks(DETAIL_UI_CHECKS);
  }

  if (phaseProgress >= 4 || await fileExists(FINAL_QA_PATH)) {
    await assertFileChecks([...DETAIL_API_CHECKS, ...QUERY_ROUTE_CHECKS, ...DETAIL_UI_CHECKS, ...FINAL_QA_CHECKS]);
  }
}

if (failures.length > 0) {
  console.error('PUBL event contract inspector check failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log('PUBL event contract inspector contract OK');
console.log(`contract=${CONTRACT_PATH}`);
console.log(`mode=${CONTRACT_ONLY ? 'contract-only' : 'default'}`);
console.log(`phaseProgress=${phaseProgress}`);

async function assertFileChecks(checks) {
  for (const check of checks) {
    const source = await readText(check.path);
    assertPatterns(source, check.patterns ?? [], check.name);
    assertForbiddenPatterns(source, check.forbidden ?? [], check.name);
  }
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

async function assertNoSchemaOrMigrationChanges() {
  const changedPaths = getGitChangedPaths();
  const forbidden = changedPaths.filter((filePath) => filePath === 'src/db/schema.js' || filePath.startsWith('drizzle/'));

  if (forbidden.length) {
    failures.push(`schema/migration changes are out of scope for ${PHASE}: ${forbidden.join(', ')}`);
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
  const routeFiles = (await listFiles('src/app'))
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
    ...(await listFiles('src/app/(console)/automations').catch(() => [])),
    ...(await listFiles('src/app/api/publ-events').catch(() => [])),
    ...(await listFiles('src/features/console/publEvents').catch(() => [])),
    CONSOLE_PAGES_PATH,
    ROUTING_PATH,
    CONSOLE_CONFIG_PATH,
  ]
    .filter((filePath, index, files) => files.indexOf(filePath) === index)
    .filter((filePath) => /\.(?:js|jsx|mjs)$/.test(filePath));

  for (const filePath of sourceFiles) {
    const source = await readText(filePath);

    if (importsPrimer(source)) {
      failures.push(`${filePath}: Primer package imports are out of scope for this feature`);
    }
  }

  const packageSource = await readText(PACKAGE_PATH);
  const packagePrimerDependency = /"@primer\/(?:react|primitives|octicons-react|brand|react-brand|behaviors)"\s*:/.exec(packageSource);

  if (packagePrimerDependency) {
    failures.push(`${PACKAGE_PATH}: Primer dependency ${packagePrimerDependency[0]} is out of scope`);
  }
}

async function assertPublListViewHidesCanonicalInternals() {
  const source = await readText(PUBL_VIEWS_PATH);
  const blocks = [
    ['toPublEventCatalogListView', getFunctionBlock(source, 'toPublEventCatalogListView')],
    ['toPublEventSummary', getFunctionBlock(source, 'toPublEventSummary')],
    ['toVariablePreview', getFunctionBlock(source, 'toVariablePreview')],
    ['toVariableOption', getFunctionBlock(source, 'toVariableOption')],
  ];

  for (const [name, block] of blocks) {
    if (!block) {
      failures.push(`${PUBL_VIEWS_PATH}: missing ${name}`);
      continue;
    }

    const forbidden = [
      /(^|[,{]\s*)rawPath\s*:/m,
      /(^|[,{]\s*)parserPipeline\s*:/m,
      /(^|[,{]\s*)parserPipelineJson\s*:/m,
    ].filter((pattern) => pattern.test(block));

    if (forbidden.length) {
      failures.push(`${PUBL_VIEWS_PATH}:${name}: list view exposes canonical prop internals ${forbidden.map(String).join(', ')}`);
    }
  }
}

async function assertPublDetailDoesNotExposeIgnoredMetadata() {
  const files = [PUBL_VIEWS_PATH, API_DETAIL_ROUTE_PATH];

  for (const filePath of files) {
    if (!(await fileExists(filePath))) continue;

    const source = await readText(filePath);
    const relevantSource = getFunctionBlock(source, 'toPublEventDetailView') || source;
    const forbidden = [
      /(^|[,{]\s*)sample\s*:/im,
      /(^|[,{]\s*)rules\s*:/im,
      /\bdefaultTemplate\b/i,
      /\bproviderTemplate(?:s|Links?)?\b/i,
      /\btemplateLinks?\b/i,
      /\bsenderProfile(?:Metadata)?\b/i,
    ].filter((pattern) => pattern.test(relevantSource));

    if (forbidden.length) {
      failures.push(`${filePath}: detail response code exposes ignored source metadata ${forbidden.map(String).join(', ')}`);
    }
  }
}

async function assertNoForbiddenDetailTabs() {
  const files = [
    ...(await listFiles('src/features/console/publEvents').catch(() => [])),
    CONSOLE_PAGES_PATH,
  ]
    .filter((filePath, index, allFiles) => allFiles.indexOf(filePath) === index)
    .filter((filePath) => /\.(?:js|jsx)$/.test(filePath));

  for (const filePath of files) {
    const source = await readText(filePath);
    const hasTabControl = /Tabs|TabList|tabList|role=["']tablist|SegmentedControl/i.test(source);
    const tabLabelHits = [
      /\bOverview\b/i,
      /\bVariables\b/i,
      /Payload\s+Mapping/i,
      /개요/,
      /페이로드\s*매핑/,
    ].filter((pattern) => pattern.test(source));

    if (hasTabControl && tabLabelHits.length >= 2) {
      failures.push(`${filePath}: detail page appears to use overview/variables/payload mapping tab labels`);
    }
  }
}

async function assertNoUnsupportedReadinessArtifacts() {
  const files = [
    DETAIL_PAGE_PATH,
    DETAIL_SECTIONS_PATH,
    DETAIL_MODEL_PATH,
    'src/features/console/publEvents/PublEventDetailChrome.jsx',
  ];
  const forbiddenPatterns = [
    /\breadiness(?:Score|Percent|Percentage)\b/i,
    /\bscore\b/i,
    /\bProgressBar\b|\bprogressbar\b|role=["']progressbar["']|aria-valuenow/i,
    /준비(?:도|율)|점수|퍼센트/i,
  ];

  for (const filePath of files) {
    if (!(await fileExists(filePath))) continue;

    const source = await readText(filePath);
    const forbidden = forbiddenPatterns.filter((pattern) => pattern.test(source));

    if (forbidden.length) {
      failures.push(`${filePath}: unsupported score/progress/readiness-percentage UI artifact ${forbidden.map(String).join(', ')}`);
    }
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

function getGitChangedPaths() {
  return getGitChanges().map((change) => change.path);
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
  return /from\s+['"]@primer\/(?:react|primitives|octicons-react|brand|react-brand|behaviors|components?)['"]/.test(source)
    || /import\(['"]@primer\/(?:react|primitives|octicons-react|brand|react-brand|behaviors|components?)['"]\)/.test(source);
}

function getFunctionBlock(source, functionName) {
  const declarationPattern = new RegExp(`(?:export\\s+)?function\\s+${functionName}\\s*\\(`);
  const declarationMatch = declarationPattern.exec(source);
  if (!declarationMatch) return '';

  const openBraceIndex = source.indexOf('{', declarationMatch.index);
  if (openBraceIndex === -1) return '';

  let depth = 0;

  for (let index = openBraceIndex; index < source.length; index += 1) {
    const character = source[index];

    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;

      if (depth === 0) {
        return source.slice(declarationMatch.index, index + 1);
      }
    }
  }

  return source.slice(declarationMatch.index);
}
