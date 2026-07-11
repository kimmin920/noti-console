#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';

const PHASE = '31-automation-unified-builder-no-readiness';
const CONTRACT_PATH = `phases/${PHASE}/automation-unified-builder-no-readiness-contract.md`;
const PHASE_INDEX_PATH = `phases/${PHASE}/index.json`;
const TOP_LEVEL_INDEX_PATH = 'phases/index.json';
const PACKAGE_PATH = 'package.json';
const PHASE_29_CONTRACT_PATH = 'phases/29-automation-rule-management/automation-rule-management-contract.md';
const PHASE_30_CONTRACT_PATH = 'phases/30-automation-builder-message-flow/automation-builder-message-flow-contract.md';
const AUTOMATION_RULE_EDITOR_FORM_PATH = 'src/features/console/automations/AutomationRuleEditorForm.jsx';
const AUTOMATION_RULE_EDITOR_CONTROLS_PATH = 'src/features/console/automations/AutomationRuleEditorControls.jsx';
const AUTOMATION_RULE_EDITOR_CONTROLLER_PATH = 'src/features/console/automations/useAutomationRuleEditorController.js';
const AUTOMATION_API_CLIENT_PATH = 'src/features/console/automations/apiClient.js';
const AUTOMATION_QUERIES_PATH = 'src/features/console/automations/queries.js';
const AUTOMATION_VALIDATE_ROUTE_PATH = 'src/app/api/automations/rules/[ruleId]/validate/route.js';
const AUTOMATION_RULES_ROUTE_PATH = 'src/server/automations/rulesRoute.js';
const AUTOMATION_SERVICE_PATH = 'src/server/automations/service.js';
const AUTOMATION_REPOSITORY_PATH = 'src/server/automations/repository.js';
const CONSOLE_CONFIG_PATH = 'src/features/console/consoleConfig.js';
const CONSOLE_PAGES_PATH = 'src/features/console/automations/AutomationRulesTable.jsx';
const COMPONENTS_CSS_PATH = 'src/styles/components.css';
const STEP_PATHS = Array.from({ length: 6 }, (_, index) => `phases/${PHASE}/step${index}.md`);
const DELETED_PRODUCTION_UI_PATHS = [
  'src/features/console/automations/AutomationRuleConditionCooldown.jsx',
  'src/features/console/automations/AutomationRuleDryRunPanel.jsx',
  'src/features/console/automations/AutomationRuleExecutionPanel.jsx',
  'src/features/console/automations/AutomationRuleLifecycleActions.jsx',
  'src/features/console/automations/AutomationRuleValidationChecklist.jsx',
  'src/features/console/automations/automationRuleExecutionModel.js',
];

const CONTRACT_CHECKS = [
  {
    name: 'supersession scope',
    patterns: [
      /supersedes the automation editor portions of phases/i,
      /`29-automation-rule-management`/,
      /`30-automation-builder-message-flow`/,
      /Automation create and edit use one editor screen/i,
      /Edit mode is create mode with the saved rule values prefilled/i,
    ],
  },
  {
    name: 'flow order',
    patterns: [
      /Basic info/i,
      /Custom event card/i,
      /Messages action card/i,
      /Send message\/template\/variable card/i,
    ],
  },
  {
    name: 'superseded behavior',
    patterns: [
      /Builder renders only in create mode/i,
      /Edit mode uses lower fallback forms/i,
      /Basic info appears below the builder/i,
      /visible `Automation builder` section wrapper/i,
      /`저장 전 점검` summary\/sidebar panel/i,
      /product-facing validation\/readiness, dry-run, activation/i,
      /automation table exposes a `검증` column/i,
    ],
  },
  {
    name: 'unified layout requirements',
    patterns: [
      /Create starts from `DEFAULT_AUTOMATION_RULE_DRAFT`/,
      /Edit starts from `createDraftFromAutomationRule\(rule\)`/,
      /must not use `showBuilderPreview = !editing`/,
      /`showDetailedEditorSections = editing`/,
      /must not render lower duplicate sections named `Trigger event`, `Send configuration`, or `Variable mapping`/,
      /Basic info renders first/i,
      /same page width as Basic info/i,
      /page-scoped CSS overrides/i,
    ],
  },
  {
    name: 'state ownership and callbacks',
    patterns: [
      /`editor\.state\.draft\.eventDefinitionId`/,
      /`editor\.state\.draft\.sendChannel`/,
      /`editor\.sendConfiguration`/,
      /`editor\.mappingPolicy`/,
      /`changeEventDefinition\(eventDefinitionId\)`/,
      /`changeSendFamilyValue\(family\)`/,
      /`selectTemplateObject\(template\)`/,
      /must not keep durable copies/i,
    ],
  },
  {
    name: 'removed surfaces',
    patterns: [
      /`저장 전 점검`/,
      /`AutomationValidationSummary`/,
      /Validation\/readiness status/i,
      /Dry-run panel/i,
      /Activation controls/i,
      /Condition editor/i,
      /Cooldown editor/i,
      /Recipient selector/i,
      /targetPhoneNumber/,
    ],
  },
  {
    name: 'save ux',
    patterns: [
      /Removing `저장 전 점검` does not remove validation/i,
      /field\/card that owns the missing value/i,
      /submit error toast/i,
      /must not be silently disabled only because hidden validation errors exist/i,
      /disabled while a request is pending/i,
      /edit mode may disable save when nothing is dirty/i,
    ],
  },
  {
    name: 'readiness removal',
    patterns: [
      /`readiness` is not a product-facing DTO field/i,
      /`validationSnapshotJson`/,
      /`validatedConfigHash`/,
      /`lastValidatedAt`/,
      /browser `\/validate` action/i,
      /New browser editor flows must not write validation snapshots/i,
      /database columns may remain until a later migration phase/i,
    ],
  },
  {
    name: 'server guards',
    patterns: [
      /Server safety does not depend on a previous browser validation snapshot/i,
      /Create, update, enable, and dispatch/i,
      /sender\/template\/variable compatibility guard/i,
      /must fail with safe reason codes/i,
      /must not call provider send APIs/i,
      /enabled-rule conflict rule remains/i,
    ],
  },
  {
    name: 'table and qa',
    patterns: [
      /must not render a `검증` column/i,
      /Table search must not index readiness labels/i,
      /Create screen with Basic info first/i,
      /Edit screen using the same layout/i,
      /No `Automation builder` section heading/i,
      /No lower duplicate forms/i,
      /No `저장 전 점검`/i,
      /No `검증` table column/i,
    ],
  },
];

const STEP_CHECKS = [
  {
    path: STEP_PATHS[0],
    name: 'step 0 reconciles contracts',
    patterns: [
      /contract-reconciliation/i,
      /Update the phase 29 rule-management contract\/checker/i,
      /Update the phase 30 builder message-flow contract\/checker/i,
      /test:automation-unified-builder-no-readiness-contract/i,
    ],
  },
  {
    path: STEP_PATHS[1],
    name: 'step 1 unifies layout',
    patterns: [
      /Render `BasicInfoSection` first/i,
      /Render the builder flow for both create and edit/i,
      /Remove `showBuilderPreview = !editing`/i,
      /Remove `showDetailedEditorSections = editing`/i,
      /Remove the visible `Automation builder` section title\/wrapper/i,
      /same width as Basic info/i,
      /Extend the phase 31 checker with code-level assertions/i,
    ],
  },
  {
    path: STEP_PATHS[2],
    name: 'step 2 removes checklist with inline errors',
    patterns: [
      /Remove the `저장 전 점검` sidebar/i,
      /Remove `AutomationValidationSummary`/i,
      /not silently disabled only because hidden validation errors exist/i,
      /field\/card inline errors or a\s+submit error toast/i,
      /Extend the phase 31 checker with code-level assertions/i,
    ],
  },
  {
    path: STEP_PATHS[3],
    name: 'step 3 removes readiness client surfaces',
    patterns: [
      /automation data table has no `검증` column/i,
      /Remove readiness chips and readiness labels/i,
      /Remove validation\/readiness status UI/i,
      /Remove validation mutation\/client API usage/i,
      /product UI paths do not\s+contain `readiness`/i,
      /Extend the phase 31 checker/i,
    ],
  },
  {
    path: STEP_PATHS[4],
    name: 'step 4 converts server guards',
    patterns: [
      /Remove the browser `\/validate` action route\/handler/i,
      /Remove `validateAutomationRule`/i,
      /Stop returning `readiness`/i,
      /Stop writing `validationSnapshotJson`, `validatedConfigHash`, and\s+`lastValidatedAt`/i,
      /Replace `assertAutomationRuleHasFreshValidation\(\)`/i,
      /Leave validation DB columns/i,
      /Extend the phase 31 checker/i,
    ],
  },
  {
    path: STEP_PATHS[5],
    name: 'step 5 final qa',
    patterns: [
      /final-qa-and-evidence/i,
      /automation-unified-builder-create-desktop\.png/i,
      /automation-unified-builder-edit-prefilled-desktop\.png/i,
      /automation-unified-builder-create-mobile\.png/i,
      /`Automation builder`/i,
      /`저장 전 점검`/i,
      /`검증` table column/i,
      /final-qa\.md/i,
    ],
  },
];

const CROSS_FILE_CHECKS = [
  {
    path: PHASE_29_CONTRACT_PATH,
    name: 'phase 29 superseded',
    patterns: [
      /Phase 31 Supersession/i,
      /`31-automation-unified-builder-no-readiness`/i,
      /browser DTOs, tables, and editor UI must not expose readiness/i,
      /must not expose validation\/readiness as a separate product status/i,
    ],
  },
  {
    path: PHASE_30_CONTRACT_PATH,
    name: 'phase 30 superseded',
    patterns: [
      /Phase 31 Supersession/i,
      /`31-automation-unified-builder-no-readiness` supersedes this contract/i,
      /Builder is create-only while edit mode keeps lower fallback sections/i,
      /Unified Builder Primary Surface/i,
      /must not render in create or edit mode/i,
      /`저장 전 점검` summary panel do not render/i,
    ],
  },
  {
    path: PHASE_INDEX_PATH,
    name: 'phase step index',
    patterns: [
      /"phase": "31-automation-unified-builder-no-readiness"/,
      /"name": "contract-reconciliation"/,
      /"name": "unified-editor-builder-layout"/,
      /"name": "inline-save-errors-without-checklist"/,
      /"name": "remove-readiness-client-surfaces"/,
      /"name": "server-guards-without-validation-state"/,
      /"name": "final-qa-and-evidence"/,
    ],
  },
  {
    path: TOP_LEVEL_INDEX_PATH,
    name: 'top-level phase index',
    patterns: [
      /"dir": "31-automation-unified-builder-no-readiness"/,
      /"status": "pending"/,
    ],
  },
  {
    path: PACKAGE_PATH,
    name: 'package script',
    patterns: [
      /"test:automation-unified-builder-no-readiness-contract": "node scripts\/check_automation_unified_builder_no_readiness_contract\.mjs"/,
    ],
  },
];

const CODE_CHECKS = [
  {
    path: AUTOMATION_RULE_EDITOR_FORM_PATH,
    name: 'editor form unified builder layout',
    patterns: [
      /function AutomationBuilderFlow\(\{ editor, validation \}\)/,
      /<BasicInfoSection editor=\{editor\} validation=\{editor\.inlineErrors\} \/> <AutomationBuilderFlow editor=\{editor\} validation=\{editor\.inlineErrors\} \/>/,
      /selectedEventId \? getAutomationRuleSendFamily\(editor\.state\.draft\.sendChannel\) : ''/,
      /<AutomationTriggerNode .*onEventChange=\{handleEventChange\}.*selectedEventId=\{selectedEventId\}/,
      /<AutomationActionList .*groups=\{automationBuilderSendActionGroups\}.*onActionSelect=\{handleActionSelect\}/,
      /<AutomationSendMessageNode .*onSenderResourceChange=\{editor\.changeSenderResourceValue\}.*onSmsChannelChange=\{editor\.changeSmsChannelValue\}.*onTemplateSelect=\{editor\.selectTemplateObject\}.*onVariableMappingChange=\{editor\.changeVariableMapping\}/,
    ],
  },
  {
    path: COMPONENTS_CSS_PATH,
    name: 'editor page scoped builder width overrides',
    patterns: [
      /\.automation-rule-editor-page \.automation-rule-builder-preview-flow \{[^}]*justify-items: stretch/,
      /\.automation-rule-editor-page \.automation-rule-builder-preview \.automation-rule-builder-preview-trigger \{[^}]*width: 100%/,
      /\.automation-rule-editor-page \.automation-rule-builder-preview \.automation-rule-builder-preview-action-list \{[^}]*width: 100%/,
      /\.automation-rule-editor-page \.automation-rule-builder-preview \.automation-rule-builder-preview-message-node \{[^}]*width: 100%/,
    ],
  },
  {
    path: AUTOMATION_RULE_EDITOR_FORM_PATH,
    name: 'editor inline validation wiring',
    patterns: [
      /<BasicInfoSection editor=\{editor\} validation=\{editor\.inlineErrors\} \/> <AutomationBuilderFlow editor=\{editor\} validation=\{editor\.inlineErrors\} \/>/,
      /<AutomationTriggerNode .*validationMessage=\{validation\.event\}/,
      /<AutomationActionList .*validationMessage=\{validation\.action\}/,
      /<AutomationSendMessageNode .*validation=\{validation\}/,
    ],
  },
  {
    path: AUTOMATION_RULE_EDITOR_CONTROLLER_PATH,
    name: 'editor save validates on submit without hidden-disable',
    patterns: [
      /const saveDisabled = pending \|\| \(editing && !dirty\);/,
      /if \(validationErrors\.length > 0\) \{ dispatch\(\{ error: '필수 항목을 확인하세요\.', type: AUTOMATION_RULE_EDITOR_ACTIONS\.SUBMIT_FAILED \}\);/,
      /showToast\(\{ description: validationErrors\[0\], title: '자동화 저장 불가', variant: 'error' \}\);/,
      /inlineErrors/,
    ],
  },
  {
    path: CONSOLE_CONFIG_PATH,
    name: 'automation table columns exclude validation',
    patterns: [
      /columns: \['이름', '상태', '이벤트', '템플릿', '수정일'\]/,
    ],
  },
  {
    path: AUTOMATION_SERVICE_PATH,
    name: 'server enable uses inline config guard',
    patterns: [
      /async enableAutomationRule\(\{ actorUserId, ruleId \} = \{\}\)/,
      /const normalized = await normalizeAutomationRuleManagementConfig\(\{ actorUserId, automationRepository, existingRule, payload: \{\}, templateService, \}\);/,
      /const validation = await evaluateAutomationRuleConfig\(\{ actorUserId, automationRepository, config: normalized\.config, templateService, \}\);/,
      /assertAutomationRuleValidationSuccess\(validation\);/,
      /delete safeRule\.validationSnapshotJson;/,
    ],
  },
];

const FORBIDDEN_CODE_CHECKS = [
  {
    path: AUTOMATION_RULE_EDITOR_FORM_PATH,
    name: 'removed create/edit layout gates and duplicate sections',
    patterns: [
      /showBuilderPreview\s*=\s*!editing/,
      /showDetailedEditorSections\s*=\s*editing/,
      /function AutomationBuilderPreviewSection/,
      /function TriggerEventSection/,
      /function SendConfigurationSection/,
      /AutomationEventDefinitionSelect/,
      /AutomationMappingPolicySections/,
      /AutomationSendConfigurationSection/,
      /AUTOMATION_RULE_EDITOR_SECTION_IDS/,
      /title="Automation builder"/,
      /title="Trigger event"/,
      /title="Send configuration"/,
    ],
  },
  {
    path: AUTOMATION_RULE_EDITOR_FORM_PATH,
    name: 'removed save checklist panel from editor form',
    patterns: [
      /AutomationValidationSummary/,
      /저장 전 점검/,
      /automation-rule-editor-sidebar/,
      /editor\.validationErrors/,
    ],
  },
  {
    path: AUTOMATION_RULE_EDITOR_CONTROLS_PATH,
    name: 'removed validation summary component export',
    patterns: [
      /AutomationValidationSummary/,
      /AutomationValidationIssue/,
      /automation-rule-editor-check/,
    ],
  },
  {
    path: AUTOMATION_RULE_EDITOR_CONTROLLER_PATH,
    name: 'removed hidden validation save disabling',
    patterns: [
      /saveDisabled\s*=\s*pending\s*\|\|\s*validationErrors\.length/,
      /saveDisabled\s*=\s*pending\s*\|\|[^;\n]*validationErrors\.length\s*>\s*0/,
      /if \(saveDisabled\) return;/,
    ],
  },
  {
    path: CONSOLE_PAGES_PATH,
    name: 'automation table removed validation readiness surface',
    patterns: [
      /readiness/,
      /staleValidation/,
      /검증/,
      /automation-readiness/,
    ],
  },
  {
    path: AUTOMATION_API_CLIENT_PATH,
    name: 'removed validation browser API client',
    patterns: [
      /validateAutomationRule/,
      /\/validate/,
    ],
  },
  {
    path: AUTOMATION_QUERIES_PATH,
    name: 'removed validation browser mutation',
    patterns: [
      /validateAutomationRule\(/,
      /validateAutomationRule,/,
      /useAutomationRuleValidateMutation/,
    ],
  },
  {
    path: AUTOMATION_RULES_ROUTE_PATH,
    name: 'removed validation browser route handler',
    patterns: [
      /handleAutomationRuleValidateRequest/,
      /action: 'validateAutomationRule'/,
    ],
  },
  {
    path: AUTOMATION_SERVICE_PATH,
    name: 'removed validation snapshot service state',
    patterns: [
      /async validateAutomationRule/,
      /assertAutomationRuleHasFreshValidation/,
      /deriveAutomationRuleReadiness/,
      /readiness:/,
      /validationSnapshotJson:/,
      /validatedConfigHash:/,
      /lastValidatedAt:/,
      /STALE_VALIDATION/,
    ],
  },
];

const BLOCK_FORBIDDEN_CODE_CHECKS = [
  {
    path: AUTOMATION_REPOSITORY_PATH,
    name: 'browser-safe rule fields exclude validation state',
    startMarker: 'const BROWSER_SAFE_RULE_FIELDS = [',
    endMarker: '];',
    patterns: [
      /validationSnapshotJson/,
      /validatedConfigHash/,
      /lastValidatedAt/,
    ],
  },
  {
    path: AUTOMATION_REPOSITORY_PATH,
    name: 'browser-safe revision fields exclude validation state',
    startMarker: 'const BROWSER_SAFE_REVISION_FIELDS = [',
    endMarker: '];',
    patterns: [
      /validationSnapshotJson/,
    ],
  },
  {
    path: AUTOMATION_REPOSITORY_PATH,
    name: 'revision insert no longer writes validation snapshot',
    startMarker: 'async createAutomationRuleRevision',
    endMarker: 'return toAutomationRuleRevisionDto(revision);',
    patterns: [
      /validationSnapshotJson:/,
    ],
  },
];

async function readText(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read ${path}: ${error.message}`);
  }
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function findMissingPatterns(text, checks) {
  const normalized = text.replace(/\s+/g, ' ');
  const failures = [];

  for (const check of checks) {
    const missing = check.patterns.filter((pattern) => !pattern.test(normalized));

    if (missing.length > 0) {
      failures.push(`${check.name}: missing ${missing.map((pattern) => pattern.toString()).join(', ')}`);
    }
  }

  return failures;
}

function findForbiddenPatterns(text, checks) {
  const failures = [];

  for (const check of checks) {
    const forbidden = check.patterns.filter((pattern) => pattern.test(text));

    if (forbidden.length > 0) {
      failures.push(`${check.name}: forbidden ${forbidden.map((pattern) => pattern.toString()).join(', ')}`);
    }
  }

  return failures;
}

function findForbiddenPatternsInBlocks(text, checks) {
  const failures = [];

  for (const check of checks) {
    const start = text.indexOf(check.startMarker);

    if (start < 0) {
      failures.push(`${check.name}: missing block start ${check.startMarker}`);
      continue;
    }

    const end = text.indexOf(check.endMarker, start + check.startMarker.length);

    if (end < 0) {
      failures.push(`${check.name}: missing block end ${check.endMarker}`);
      continue;
    }

    const block = text.slice(start, end + check.endMarker.length);
    const forbidden = check.patterns.filter((pattern) => pattern.test(block));

    if (forbidden.length > 0) {
      failures.push(`${check.name}: forbidden ${forbidden.map((pattern) => pattern.toString()).join(', ')}`);
    }
  }

  return failures;
}

const failures = [];

try {
  const contract = await readText(CONTRACT_PATH);
  failures.push(...findMissingPatterns(contract, CONTRACT_CHECKS));

  for (const stepCheck of STEP_CHECKS) {
    const step = await readText(stepCheck.path);
    failures.push(...findMissingPatterns(step, [stepCheck]));
  }

  for (const crossCheck of CROSS_FILE_CHECKS) {
    const text = await readText(crossCheck.path);
    failures.push(...findMissingPatterns(text, [crossCheck]));
  }

  for (const codeCheck of CODE_CHECKS) {
    const text = await readText(codeCheck.path);
    failures.push(...findMissingPatterns(text, [codeCheck]));
  }

  for (const forbiddenCheck of FORBIDDEN_CODE_CHECKS) {
    const text = await readText(forbiddenCheck.path);
    failures.push(...findForbiddenPatterns(text, [forbiddenCheck]));
  }

  for (const blockForbiddenCheck of BLOCK_FORBIDDEN_CODE_CHECKS) {
    const text = await readText(blockForbiddenCheck.path);
    failures.push(...findForbiddenPatternsInBlocks(text, [blockForbiddenCheck]));
  }

  for (const deletedPath of DELETED_PRODUCTION_UI_PATHS) {
    if (await fileExists(deletedPath)) {
      failures.push(`deleted production UI path still exists: ${deletedPath}`);
    }
  }

  if (await fileExists(AUTOMATION_VALIDATE_ROUTE_PATH)) {
    failures.push(`validation route still exists: ${AUTOMATION_VALIDATE_ROUTE_PATH}`);
  }
} catch (error) {
  failures.push(error.message);
}

if (failures.length > 0) {
  console.error('Automation unified builder no-readiness contract check failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log('Automation unified builder no-readiness contract OK');
console.log(`contract=${CONTRACT_PATH}`);
console.log(`steps=${STEP_PATHS.length}`);
console.log(`checks=${CONTRACT_CHECKS.length + STEP_CHECKS.length + CROSS_FILE_CHECKS.length + CODE_CHECKS.length + FORBIDDEN_CODE_CHECKS.length}`);
