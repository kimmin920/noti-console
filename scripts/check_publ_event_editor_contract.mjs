#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { access, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const CONTRACT_ONLY = process.argv.includes('--contract-only');
const PHASE = '37-publ-event-editor';
const CONTRACT_PATH = `phases/${PHASE}/publ-event-editor-contract.md`;
const PHASE_INDEX_PATH = `phases/${PHASE}/index.json`;
const TOP_LEVEL_INDEX_PATH = 'phases/index.json';
const PACKAGE_PATH = 'package.json';
const API_DETAIL_ROUTE_PATH = 'src/app/api/publ-events/[eventKey]/route.js';
const PUBL_REPOSITORY_PATH = 'src/server/publEvents/repository.js';
const PUBL_SERVICE_PATH = 'src/server/publEvents/service.js';
const PUBL_VIEWS_PATH = 'src/server/publEvents/views.js';
const PUBL_QUERY_PATH = 'src/features/console/publEvents/queries.js';
const DETAIL_PAGE_PATH = 'src/features/console/publEvents/PublEventDetailPage.jsx';
const DETAIL_CHROME_PATH = 'src/features/console/publEvents/PublEventDetailChrome.jsx';
const DETAIL_SECTIONS_PATH = 'src/features/console/publEvents/PublEventDetailSections.jsx';
const DETAIL_MODEL_PATH = 'src/features/console/publEvents/publEventDetailModel.js';
const DETAIL_CSS_PATH = 'src/styles/publ-event-detail.css';
const SERVER_EDITOR_TEST_PATH = 'src/server/__tests__/publEventEditor.test.js';
const SERVER_RESOLUTION_TEST_PATH = 'src/server/__tests__/publEventResolution.test.js';
const SERVER_VIEW_TEST_PATH = 'src/server/__tests__/publEventViews.test.js';
const CLIENT_EDITOR_MODEL_TEST_PATH = 'src/server/__tests__/publEventEditorModel.test.js';
const FINAL_QA_PATH = `.omo/evidence/${PHASE}/final-qa.md`;
const PARSER_STEP_TYPE_PATTERNS = [
  /fallback/,
  /firstItem/,
  /mapTemplate/,
  /join/,
  /dateFormat/,
  /currencyFormat/,
  /phoneFormat/,
  /truncate/,
  /replace/,
];

const CONTRACT_CHECKS = [
  {
    name: 'editor product scope',
    patterns: [
      /operator-only editor/i,
      /edit event metadata without changing `eventKey`/i,
      /Add, edit, and delete variable props/i,
      /Do not add the seed catalog concept/i,
      /Do not connect default Kakao templates to events/i,
      /Do not add schema, migrations, provider calls, workers, external APIs/i,
    ],
  },
  {
    name: 'data and runtime contract',
    patterns: [
      /Existing `eventKey` is immutable/i,
      /`rawPath`[\s\S]*`alias`[\s\S]*`label`[\s\S]*`type`[\s\S]*`required`[\s\S]*`enabled`/i,
      /`seed`[\s\S]*`removable`[\s\S]*default provider template links/i,
      /`enabled === true && required === true`/i,
      /A fallback satisfies the required check/i,
      /variable-key collision logic/i,
    ],
  },
  {
    name: 'permission and dangerous change contract',
    patterns: [
      /Mutation APIs are operator-only/i,
      /reject non-operator actors with `FORBIDDEN`/i,
      /Editing an existing raw path requires an explicit unlock action/i,
      /CHANGE_RAW_PATH/,
      /Editing an existing alias requires an explicit unlock action/i,
      /CHANGE_ALIAS/,
      /DELETE_PROP/,
    ],
  },
  {
    name: 'api payload contract',
    patterns: [
      /PATCH \/api\/publ-events\/\[eventKey\]/,
      /"baseUpdatedAt"/,
      /"event"/,
      /"props"/,
      /"deletedAliases"/,
      /"dangerousChangeConfirmations"/,
      /"originalAlias"/,
      /STALE_PUBL_EVENT_EDITOR_DRAFT/,
      /full-replacement props payload/i,
    ],
  },
  {
    name: 'ui and final qa contract',
    patterns: [
      /read-only detail experience remains the default/i,
      /Operator sees an edit action/i,
      /Event edit form has `eventKey` disabled/i,
      /Do not show parser step-count labels such as `1STEP`/i,
      /final-qa\.md/,
      /source import can\s+overwrite operator edits/i,
    ],
  },
];

const SCAFFOLD_CHECKS = [
  {
    path: PHASE_INDEX_PATH,
    name: 'phase step index',
    patterns: [
      /"phase": "37-publ-event-editor"/,
      /"name": "contract-and-checker"/,
      /"name": "server-editor-service-and-api"/,
      /"name": "client-mutations-and-editor-state"/,
      /"name": "event-and-variable-editor-ui"/,
      /"name": "integration-validation-and-edge-states"/,
      /"name": "final-editor-qa"/,
    ],
  },
  {
    path: TOP_LEVEL_INDEX_PATH,
    name: 'top-level phase registry',
    patterns: [
      /"dir": "37-publ-event-editor"/,
      /"status": "pending"/,
    ],
  },
  {
    path: PACKAGE_PATH,
    name: 'package script',
    patterns: [
      /"test:publ-event-editor-contract": "node scripts\/check_publ_event_editor_contract\.mjs"/,
    ],
  },
];

const SERVER_EDITOR_TEST_PATTERNS = [
  /baseUpdatedAt/,
  /event:\s*\{/,
  /eventKey/,
  /displayName/,
  /category/,
  /serviceStatus/,
  /locationType/,
  /locationId/,
  /sourceType/,
  /actionType/,
  /props:\s*\[/,
  /originalAlias/,
  /deletedAliases/,
  /dangerousChangeConfirmations/,
  /CHANGE_RAW_PATH/,
  /CHANGE_ALIAS/,
  /DELETE_PROP/,
  /operator.*update|update.*operator|operator can update|updates event metadata/i,
  /non-operator|FORBIDDEN/i,
  /eventKey.*cannot|immutable eventKey|rejects.*eventKey/i,
  /stale.*baseUpdatedAt|baseUpdatedAt.*stale|STALE_PUBL_EVENT_EDITOR_DRAFT/i,
  /unsupported.*field/i,
  /duplicate.*alias/i,
  /label-derived|variable-key collision|variable_key_collision|label.*collision/i,
  /add.*prop|new prop/i,
  /edit.*prop|existing prop.*update|updates existing prop/i,
  /delete.*prop|existing prop.*deleted/i,
  /rawPath.*unlock|unlock.*rawPath/i,
  /alias.*unlock|unlock.*alias/i,
  /omitted existing prop|omitted.*DELETE_PROP/i,
  /required.*enabled|enabled.*required/i,
  /parser pipeline|parserPipeline/i,
  /forbidden source metadata|sample|defaultTemplate|providerTemplate/i,
];

const SERVER_RESOLUTION_TEST_PATTERNS = [
  /disabled.*required|required.*disabled/i,
  /enabled.*required.*fallback|fallback.*enabled.*required/i,
  /enabled.*required.*block|blocks.*enabled.*required|missing.*required/i,
  /rawPath/,
];

const CLIENT_MODEL_TEST_PATTERNS = [
  /draft/i,
  /dirty/i,
  /add.*prop|new prop/i,
  /edit.*prop|update.*prop/i,
  /delete.*prop/i,
  /rawPath.*unlock|unlock.*rawPath/i,
  /alias.*unlock|unlock.*alias/i,
  /baseUpdatedAt/,
  /dangerousChangeConfirmations/,
  /deletedAliases/,
  /variable-key collision|variable_key_collision|label.*collision/i,
];

const FINAL_QA_PATTERNS = [
  /commands run|commands/i,
  /npm run test:server/i,
  /npm run test:publ-event-editor-contract/i,
  /npm run lint && npm run build/i,
  /browser URLs|URLs checked/i,
  /viewport/i,
  /read-only|read mode/i,
  /edit mode/i,
  /rawPath unlock/i,
  /delete confirmation/i,
  /remaining risks|risks/i,
  /source catalog import can overwrite operator edits|source import can\s+overwrite operator edits/i,
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

await assertNoSchemaOrMigrationChanges();
await assertNoIntroducedTypeScript();
await assertProductionRoutesDoNotImportPlayground();
await assertNoPrimerPackageImports();
await assertEditorDoesNotIntroduceForbiddenConcepts();
await assertNoParserStepCountCopy();

if (!CONTRACT_ONLY) {
  await assertServerEditorImplementation();
  await assertClientMutationImplementation();
  await assertEditorUiImplementation();
  await assertIntegrationHardening();

  if (phaseProgress >= 5) {
    await assertFinalQaEvidence();
  }
}

if (failures.length > 0) {
  console.error('PUBL event editor contract check failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log('PUBL event editor contract OK');
console.log(`contract=${CONTRACT_PATH}`);
console.log(`mode=${CONTRACT_ONLY ? 'contract-only' : 'default'}`);
console.log(`phaseProgress=${phaseProgress}`);

async function assertServerEditorImplementation() {
  const routeSource = await readText(API_DETAIL_ROUTE_PATH);
  const serverSource = await readImplementationSource([
    'src/server/publEvents',
    API_DETAIL_ROUTE_PATH,
  ]);
  const repositorySource = await readText(PUBL_REPOSITORY_PATH);
  const serviceSource = await readText(PUBL_SERVICE_PATH);

  assertPatterns(routeSource, [
    /export const runtime = 'nodejs'/,
    /export async function PATCH/,
    /resolveRelayActor/,
    /eventKey/,
    /toPublEventDetailView/,
  ], 'PUBL event editor PATCH route');

  assertPatterns(serverSource, [
    /baseUpdatedAt/,
    /deletedAliases/,
    /dangerousChangeConfirmations/,
    /CHANGE_RAW_PATH/,
    /CHANGE_ALIAS/,
    /DELETE_PROP/,
    /STALE_PUBL_EVENT_EDITOR_DRAFT/,
    /RELAY_ERROR_CODES\.FORBIDDEN|code:\s*RELAY_ERROR_CODES\.FORBIDDEN|FORBIDDEN/,
    /isOperator|requirePublEventEditorPermission|requireOperator/,
    /normalizeTemplateLabelKey|variable.*collision|label.*collision/i,
  ], 'PUBL event editor server mutation helpers');
  assertPatterns(serverSource, PARSER_STEP_TYPE_PATTERNS, 'PUBL event editor parser step types');

  assertEventKeyImmutable(serverSource);
  assertRepositoryMutationsAreTransactional(repositorySource);
  assertRequiredPayloadRuntimeSemantics(serviceSource);
  await assertPublDetailDoesNotExposeIgnoredMetadata();
  await assertServerEditorTests();
}

async function assertClientMutationImplementation() {
  const querySource = await readText(PUBL_QUERY_PATH);
  const clientSource = await readImplementationSource([
    'src/features/console/publEvents',
  ]);

  assertPatterns(querySource, [
    /useMutation/,
    /useQueryClient/,
    /PATCH/,
    /\/api\/publ-events\/\$\{encodedEventKey\}/,
    /invalidateQueries|setQueryData/,
    /publEventQueryKeys\.catalog|queryKey:\s*publEventQueryKeys\.catalog/,
    /publEventQueryKeys\.detail|detail:\s*\(/,
  ], 'PUBL event editor client mutation hook');

  assertPatterns(clientSource, [
    /baseUpdatedAt/,
    /deletedAliases/,
    /dangerousChangeConfirmations/,
    /CHANGE_RAW_PATH/,
    /CHANGE_ALIAS/,
    /DELETE_PROP/,
    /dirty|isDirty/i,
    /rawPath.*unlock|unlock.*rawPath/i,
    /alias.*unlock|unlock.*alias/i,
    /variable.*collision|label.*collision/i,
  ], 'PUBL event editor client state model');

  const modelTestSource = await readText(CLIENT_EDITOR_MODEL_TEST_PATH);
  assertPatterns(modelTestSource, CLIENT_MODEL_TEST_PATTERNS, 'PUBL event editor model tests');
}

async function assertEditorUiImplementation() {
  const uiSource = await readImplementationSource([
    DETAIL_PAGE_PATH,
    DETAIL_CHROME_PATH,
    DETAIL_SECTIONS_PATH,
    DETAIL_MODEL_PATH,
    DETAIL_CSS_PATH,
  ]);

  assertPatterns(uiSource, [
    /mode=edit|mode:\s*['"]edit['"]|editMode|isEditing/i,
    /isOperator|canEdit|operator/i,
    /editDenied|운영자 권한이 필요합니다/,
    /eventKey/,
    /disabled|readOnly/,
    /Add variable|변수 추가|add variable/i,
    /ConfirmationDialog/,
    /dirty|discard|discardDialogOpen|변경사항을 버릴까요|저장하지/i,
    /rawPath.*unlock|unlock.*rawPath|Raw path/i,
    /alias.*unlock|unlock.*alias/i,
    /잠금 해제/,
    /required|필수/,
    /enabled|사용/,
    /fallback/i,
    /format|포맷|가공 없음|날짜 표시|금액 표시|항목 문구 만들기|여러 값을 합치기/i,
    /중간 결과가 비면 대체값|첫 번째 값만 사용|전화번호 표시|글자 수 자르기|문구 바꾸기/i,
    /stale|STALE_PUBL_EVENT_EDITOR_DRAFT|baseUpdatedAt|다시 불러오기/i,
    /pending|isPending|saving|저장 중/i,
    /저장 전 확인이 필요합니다|fieldErrors|getPropFieldError/i,
    /변수를 삭제할까요|deleteTarget/i,
  ], 'PUBL event editor UI');
  assertPatterns(uiSource, PARSER_STEP_TYPE_PATTERNS, 'PUBL event editor UI parser step options');

  assertEventKeyInputIsReadOnly(uiSource);
  assertVariableEditActionEntersEditor(uiSource);
  assertForbiddenPatterns(uiSource, [
    /gradient/i,
    /box-shadow:\s*0\s+0|glow/i,
    /backdrop-filter|glass/i,
    /1\s*STEP/i,
  ], 'PUBL event editor UI');
}

async function assertIntegrationHardening() {
  await assertServerEditorTests();
  await assertClientMutationImplementation();
  await assertEditorUiImplementation();
}

async function assertFinalQaEvidence() {
  const source = await readText(FINAL_QA_PATH);
  assertPatterns(source, FINAL_QA_PATTERNS, 'final QA evidence');
}

async function assertServerEditorTests() {
  const editorTestSource = await readText(SERVER_EDITOR_TEST_PATH);
  const resolutionTestSource = await readText(SERVER_RESOLUTION_TEST_PATH);
  const viewTestSource = await readText(SERVER_VIEW_TEST_PATH);

  assertPatterns(editorTestSource, SERVER_EDITOR_TEST_PATTERNS, 'PUBL event editor server tests');
  assertPatterns(resolutionTestSource, SERVER_RESOLUTION_TEST_PATTERNS, 'PUBL event runtime required/fallback tests');
  assertPatterns(viewTestSource, [
    /not\.toContain\(['"]IGNORED_TEMPLATE['"]\)|not\.toHaveProperty\(['"]defaultTemplate['"]\)/,
    /not\.toContain\(['"]IGNORED_PROVIDER_TEMPLATE['"]\)|providerTemplate/i,
  ], 'PUBL event detail privacy tests');
}

async function assertNoSchemaOrMigrationChanges() {
  const changedPaths = getGitChangedPaths();
  const forbidden = changedPaths.filter((filePath) => (
    filePath === 'src/db/schema.js'
    || filePath === 'drizzle.config.js'
    || filePath.startsWith('drizzle/')
  ));

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
    ...(await listFiles('src').catch(() => [])),
    ...(await listFiles('scripts').catch(() => [])),
  ]
    .filter((filePath) => /\.(?:js|jsx|mjs)$/.test(filePath));

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

async function assertEditorDoesNotIntroduceForbiddenConcepts() {
  const sourceFiles = await getEditorImplementationFiles();
  const checks = [
    [/(\b|_)seed(?:Catalog|ed|s)?\b/i, 'seed catalog concept'],
    [/\bremovable\b/i, 'removable prop concept'],
    [/\bdefaultTemplate\b|\bdefaultTemplates\b|default\s+(?:provider\s+)?template|기본\s*템플릿/i, 'default template concept'],
    [/\bproviderTemplate(?:s|Links?)?\b|\btemplateLinks?\b/i, 'provider template link concept'],
  ];

  for (const filePath of sourceFiles) {
    const source = await readText(filePath);

    for (const [pattern, description] of checks) {
      if (pattern.test(source)) {
        failures.push(`${filePath}: editor introduces forbidden ${description}`);
      }
    }
  }
}

async function assertNoParserStepCountCopy() {
  const sourceFiles = await getEditorImplementationFiles();

  for (const filePath of sourceFiles) {
    const source = await readText(filePath);
    const hasStepCountCopy = /\b\d+\s*STEP\b|\$\{[^}]+\}\s*STEP\b|STEP\s*\$\{|\bSTEP\s*개\b/i.test(source);

    if (hasStepCountCopy) {
      failures.push(`${filePath}: parser format UI must not show step-count copy such as 1STEP`);
    }
  }
}

async function assertPublDetailDoesNotExposeIgnoredMetadata() {
  const source = await readText(PUBL_VIEWS_PATH);
  const detailBlock = getFunctionBlock(source, 'toPublEventDetailView') || source;
  const forbidden = [
    /(^|[,{]\s*)rules\s*:/im,
    /\bdefaultTemplate\b/i,
    /\bproviderTemplate(?:s|Links?)?\b/i,
    /\btemplateLinks?\b/i,
    /\bsenderProfile(?:Metadata)?\b/i,
  ].filter((pattern) => pattern.test(detailBlock));

  if (forbidden.length) {
    failures.push(`${PUBL_VIEWS_PATH}: detail response exposes ignored source metadata ${forbidden.map(String).join(', ')}`);
  }
}

function assertEventKeyImmutable(source) {
  const comparesBodyEventKeyToRoute = /(?:event|payload|body)\.event(?:\?\.|\.)eventKey[\s\S]{0,180}(?:!==|!=)[\s\S]{0,180}eventKey/.test(source)
    || /eventKey[\s\S]{0,180}(?:!==|!=)[\s\S]{0,180}(?:event|payload|body)\.event(?:\?\.|\.)eventKey/.test(source);
  const rejectsMutation = /immutable eventKey|eventKey.*immutable|eventKey.*cannot|cannot.*eventKey|rename.*event/i.test(source);

  if (!comparesBodyEventKeyToRoute || !rejectsMutation) {
    failures.push('PUBL event editor server mutation must reject editable/mutable eventKey changes for existing events');
  }
}

function assertRepositoryMutationsAreTransactional(repositorySource) {
  assertPatterns(repositorySource, [
    /transaction\s*\(/,
    /update\(publEventDefinitions\)|\.update\(publEventDefinitions\)/,
    /insert\(publEventPropDefinitions\)|\.insert\(publEventPropDefinitions\)/,
    /delete\(publEventPropDefinitions\)|\.delete\(publEventPropDefinitions\)/,
  ], 'PUBL event repository transactional mutation methods');
}

function assertRequiredPayloadRuntimeSemantics(serviceSource) {
  const block = getFunctionBlock(serviceSource, 'resolvePublEventPayload');

  if (!block) {
    failures.push(`${PUBL_SERVICE_PATH}: missing resolvePublEventPayload`);
    return;
  }

  if (/if\s*\(\s*prop\.required\s*&&\s*rawMissing\s*\)/.test(block)) {
    failures.push(`${PUBL_SERVICE_PATH}: required validation still ignores enabled and fallback semantics`);
  }

  if (!/(prop\.enabled\s*(?:===\s*true)?\s*&&\s*prop\.required|prop\.required\s*(?:===\s*true)?\s*&&\s*prop\.enabled)/.test(block)) {
    failures.push(`${PUBL_SERVICE_PATH}: required validation must require enabled and required props`);
  }

  if (!/(fallback\s*!=\s*null|fallback\s*!==\s*null|fallback\s*===\s*null|fallback\s*==\s*null)/.test(block)) {
    failures.push(`${PUBL_SERVICE_PATH}: required validation must treat a non-null fallback as satisfying missing raw values`);
  }

  if (!/rawPath:\s*prop\.rawPath/.test(block)) {
    failures.push(`${PUBL_SERVICE_PATH}: required validation errors must include missing rawPath`);
  }
}

function assertEventKeyInputIsReadOnly(uiSource) {
  const eventKeyInputPattern = /<(?:TextField|input|select|textarea)[^>]*(?:name|id|label)=["']eventKey["'][^>]*>/gi;
  const matches = [...uiSource.matchAll(eventKeyInputPattern)];

  for (const match of matches) {
    if (!/disabled|readOnly/.test(match[0])) {
      failures.push('PUBL event editor eventKey control must be disabled or read-only');
    }
  }
}

function assertVariableEditActionEntersEditor(uiSource) {
  assertPatterns(uiSource, [
    /requestVariableEdit/,
    /findEditorVariable/,
    /originalAlias/,
    /setVariableDrawer\(\{\s*mode:\s*['"]edit['"],\s*propKey:\s*getPropKey\(variable\)/,
    /router\.push\(getDetailHref\(\{\s*editor:\s*['"]edit['"]\s*\}\)\)/,
  ], 'PUBL event variable edit action');
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

async function getEditorImplementationFiles() {
  const files = [
    ...(await listFiles('src/app/api/publ-events').catch(() => [])),
    ...(await listFiles('src/app/automations').catch(() => [])),
    ...(await listFiles('src/server/publEvents').catch(() => [])),
    ...(await listFiles('src/features/console/publEvents').catch(() => [])),
    DETAIL_CSS_PATH,
  ];

  return files
    .filter((filePath, index, allFiles) => allFiles.indexOf(filePath) === index)
    .filter((filePath) => /\.(?:js|jsx|mjs|css)$/.test(filePath));
}

async function readImplementationSource(paths) {
  const files = [];

  for (const sourcePath of paths) {
    if (!(await fileExists(sourcePath))) continue;

    const sourceStat = await stat(sourcePath);
    if (sourceStat.isDirectory()) {
      files.push(...(await listFiles(sourcePath)));
    } else {
      files.push(sourcePath);
    }
  }

  const sourceParts = [];
  const uniqueFiles = files
    .filter((filePath, index, allFiles) => allFiles.indexOf(filePath) === index)
    .filter((filePath) => /\.(?:js|jsx|mjs|css)$/.test(filePath));

  for (const filePath of uniqueFiles) {
    sourceParts.push(`\n/* ${filePath} */\n${await readText(filePath)}`);
  }

  return sourceParts.join('\n');
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
  return /from\s+['"]@primer\/(?:react|primitives|octicons-react|octicons|brand|react-brand|behaviors|components?)['"]/.test(source)
    || /import\(['"]@primer\/(?:react|primitives|octicons-react|octicons|brand|react-brand|behaviors|components?)['"]\)/.test(source);
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
