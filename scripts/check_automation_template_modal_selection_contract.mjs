#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';

const PHASE = '32-automation-template-modal-selection';
const CONTRACT_PATH = `phases/${PHASE}/automation-template-modal-selection-contract.md`;
const PHASE_INDEX_PATH = `phases/${PHASE}/index.json`;
const TOP_LEVEL_INDEX_PATH = 'phases/index.json';
const PACKAGE_PATH = 'package.json';
const MESSAGE_TEMPLATE_ADAPTERS_PATH = 'src/components/ui/MessageTemplateDialogAdapters.jsx';
const EMAIL_SEND_FORM_PATH = 'src/components/ui/EmailSendForm.jsx';
const SMS_SEND_FORM_PATH = 'src/components/ui/SmsSendForm.jsx';
const ALIMTALK_SEND_FORM_PATH = 'src/components/ui/AlimtalkSendForm.jsx';
const BRAND_SEND_FORM_PATH = 'src/components/ui/BrandMessageSendForm.jsx';
const UI_INDEX_PATH = 'src/components/ui/index.js';
const MESSAGE_MAPPERS_PATH = 'src/features/console/messageSend/mappers.js';
const MESSAGE_QUERIES_PATH = 'src/features/console/messageSend/queries.js';
const SEND_CONFIGURATION_PATH = 'src/features/console/automations/AutomationRuleSendConfiguration.jsx';
const EDITOR_FORM_PATH = 'src/features/console/automations/AutomationRuleEditorForm.jsx';
const EDITOR_CONTROLLER_PATH = 'src/features/console/automations/useAutomationRuleEditorController.js';
const DRAFT_REDUCER_PATH = 'src/features/console/automations/ruleEditorDraftReducer.js';
const SEND_MESSAGE_NODE_PATH = 'src/features/console/automations/builder/AutomationSendMessageNode.jsx';
const MESSAGE_SETTINGS_FORM_PATH = 'src/features/console/automations/builder/AutomationMessageSettingsForm.jsx';

const CONTRACT_CHECKS = [
  {
    name: 'modal UX',
    patterns: [
      /choosing a Messages action opens a template selection modal immediately/i,
      /`EmailSendFormTemplateDialog`/,
      /`trigger=\{null\}`/,
      /moves directly to the selected send-message node with settings on the left and preview on the right/i,
      /`템플릿 변경`/,
      /`발송 채널 변경`/,
      /no longer renders the inline production `TemplatePicker` flow/i,
    ],
  },
  {
    name: 'lookup scope separation',
    patterns: [
      /Template lookup scope and the actual `senderResourceId` are separate concepts/i,
      /`모두`/,
      /`공통 \(@비주오 \+ @publ\)`/,
      /Selecting a common template must not write a common `senderResourceId`/i,
    ],
  },
  {
    name: 'actual sender resource',
    patterns: [
      /actual sender used for saving and dispatch/i,
      /Actual Kakao sender options use the user's registered sendable Kakao resources/i,
      /matches a common template lookup source such as `@비주오`/i,
      /Common template lookup sources such as `@비주오` and `@publ` remain grouped/i,
      /exactly one compatible actual sender resource/i,
      /zero compatible actual sender resources/i,
      /Changing the actual sender resource must not clear/i,
    ],
  },
  {
    name: 'state ownership',
    patterns: [
      /`useAutomationSendConfiguration\(draft\)` owns sender options/i,
      /`changeSendFamilyValue\(family\)`/,
      /`changeSenderResourceValue\(senderResourceId\)`/,
      /`changeSmsChannelValue\(sendChannel\)`/,
      /`selectTemplateObject\(template\)`/,
      /does not set `senderResourceId`/,
      /Lower duplicate forms/,
      /`저장 전 점검`/,
    ],
  },
];

const FILE_CHECKS = [
  {
    path: PHASE_INDEX_PATH,
    name: 'phase step index',
    patterns: [
      /"phase": "32-automation-template-modal-selection"/,
      /"name": "contract-and-checker"/,
      /"name": "shared-template-dialog-adapters"/,
      /"name": "template-scope-vs-sender-resource"/,
      /"name": "automation-modal-builder-flow"/,
      /"name": "final-qa-and-evidence"/,
    ],
  },
  {
    path: TOP_LEVEL_INDEX_PATH,
    name: 'top-level phase registry',
    patterns: [
      /"dir": "32-automation-template-modal-selection"/,
      /"status": "pending"/,
    ],
  },
  {
    path: PACKAGE_PATH,
    name: 'package script',
    patterns: [
      /"test:automation-template-modal-selection-contract": "node scripts\/check_automation_template_modal_selection_contract\.mjs"/,
    ],
  },
  {
    path: MESSAGE_TEMPLATE_ADAPTERS_PATH,
    name: 'shared template dialog adapters',
    patterns: [
      /export function getSmsTemplateDialogItems/,
      /export function getAlimtalkTemplateDialogItems/,
      /export function AlimtalkTemplateDialogCard/,
      /export function getBrandTemplateDialogItems/,
      /export function BrandMessageTemplateDialogCard/,
      /KakaoTemplateCardPreview/,
      /BrandMessageTemplateCardPreview/,
    ],
  },
  {
    path: EMAIL_SEND_FORM_PATH,
    name: 'controlled template dialog support',
    patterns: [
      /beforePicker/,
      /trigger !== null/,
      /\{beforePicker\}/,
      /EmailSendFormTemplatePicker/,
    ],
  },
  {
    path: UI_INDEX_PATH,
    name: 'ui exports adapters',
    patterns: [
      /MessageTemplateDialogAdapters\.jsx/,
    ],
  },
  {
    path: MESSAGE_MAPPERS_PATH,
    name: 'scope and sender mappers',
    patterns: [
      /export function getAutomationKakaoSenderProfiles/,
      /return getAlimtalkSenderProfiles\(data\);/,
      /export function getSmsTemplateLookupScopes/,
      /export function getKakaoTemplateLookupScopes/,
      /!isCommonKakaoSenderProfile/,
      /label: '공통 \(@비주오 \+ @publ\)'/,
      /type: 'common'/,
    ],
  },
  {
    path: MESSAGE_QUERIES_PATH,
    name: 'plural template queries',
    patterns: [
      /useQueries/,
      /export function useSmsTemplatesQueries/,
      /export function useAlimtalkTemplatesQueries/,
      /export function useBrandTemplatesQueries/,
      /function useTemplateQueries/,
    ],
  },
  {
    path: SEND_CONFIGURATION_PATH,
    name: 'automation send configuration',
    patterns: [
      /getAutomationKakaoSenderProfiles/,
      /templateScopes/,
      /useSmsTemplatesQueries/,
      /useAlimtalkTemplatesQueries/,
      /useBrandTemplatesQueries/,
      /getTemplateLookupEntries/,
      /__automationTemplateScopeKeys/,
      /__automationTemplateLookupSenderResourceId/,
      /family !== 'sms' && isCommonTemplate/,
    ],
  },
  {
    path: EDITOR_FORM_PATH,
    name: 'action opens modal',
    patterns: [
      /const \[templateDialogOpen, setTemplateDialogOpen\] = useState\(false\)/,
      /function handleActionSelect\(action\)/,
      /editor\.changeSendFamilyValue\(action\.family\)/,
      /setTemplateDialogOpen\(true\)/,
      /templateDialogOpen=\{templateDialogOpen\}/,
      /onTemplateDialogOpenChange=\{setTemplateDialogOpen\}/,
    ],
  },
  {
    path: EDITOR_CONTROLLER_PATH,
    name: 'value callbacks and sender default',
    patterns: [
      /sendConfiguration\.senderOptions\.length !== 1/,
      /CHANGE_SENDER_RESOURCE/,
      /function changeSenderResourceValue\(senderResourceId\)/,
      /function selectTemplateObject\(template\)/,
      /getPersistedSendChannel/,
      /getTemplateSource/,
    ],
  },
  {
    path: SEND_MESSAGE_NODE_PATH,
    name: 'automation node uses modal',
    patterns: [
      /EmailSendFormTemplateDialog/,
      /trigger=\{null\}/,
      /AutomationTemplateScopeFilter/,
      /filterTemplatesByScope/,
      /getDialogTemplates/,
      /setTemplateDialogOpen\(false\)/,
      /automation-message-node-compose/,
      /onChangeTemplate=\{openTemplateDialog\}/,
      /템플릿 선택/,
    ],
  },
  {
    path: MESSAGE_SETTINGS_FORM_PATH,
    name: 'settings stays sender and variables',
    patterns: [
      /발신 리소스/,
      /문자 유형/,
      /AutomationSetVariables/,
    ],
  },
];

const FORBIDDEN_CHECKS = [
  {
    path: SEND_MESSAGE_NODE_PATH,
    name: 'send node must not import inline TemplatePicker',
    patterns: [
      /from ['"]\.\/TemplatePicker\.jsx['"]/,
      /<TemplatePicker/,
    ],
  },
  {
    path: MESSAGE_SETTINGS_FORM_PATH,
    name: 'settings must not contain duplicate template selector',
    patterns: [
      /템플릿 선택/,
      /onTemplateSelect/,
      /TemplatePicker/,
    ],
  },
];

const BLOCK_CHECKS = [
  {
    path: EDITOR_CONTROLLER_PATH,
    name: 'selectTemplateObject does not set senderResourceId',
    pattern: /function selectTemplateObject\(template\) \{[\s\S]*?\n  \}/,
    forbidden: /senderResourceId/,
  },
  {
    path: DRAFT_REDUCER_PATH,
    name: 'CHANGE_SENDER_RESOURCE preserves selected template',
    pattern: /case AUTOMATION_RULE_EDITOR_ACTIONS\.CHANGE_SENDER_RESOURCE:[\s\S]*?case AUTOMATION_RULE_EDITOR_ACTIONS\.CHANGE_SMS_CHANNEL:/,
    forbidden: /templateCode|templateSource|variableMappingJsonText/,
  },
];

const ADAPTER_IMPORT_CHECKS = [
  [SMS_SEND_FORM_PATH, /MessageTemplateDialogAdapters\.jsx/, /function getSmsTemplateDialogItems/],
  [ALIMTALK_SEND_FORM_PATH, /MessageTemplateDialogAdapters\.jsx/, /function getAlimtalkTemplateDialogItems|function AlimtalkTemplateDialogCard/],
  [BRAND_SEND_FORM_PATH, /MessageTemplateDialogAdapters\.jsx/, /function getBrandTemplateDialogItems|function BrandMessageTemplateDialogCard/],
];

const failures = [];

await ensureFile(CONTRACT_PATH);
await ensureFile(MESSAGE_TEMPLATE_ADAPTERS_PATH);

const contract = await readText(CONTRACT_PATH);
const normalizedContract = contract.replace(/\s+/g, ' ');

for (const check of CONTRACT_CHECKS) {
  assertPatterns(normalizedContract, check.patterns, `contract: ${check.name}`);
}

for (const check of FILE_CHECKS) {
  const source = await readText(check.path);
  assertPatterns(source, check.patterns, check.name);
}

for (const check of FORBIDDEN_CHECKS) {
  const source = await readText(check.path);
  const forbidden = check.patterns.filter((pattern) => pattern.test(source));

  if (forbidden.length) {
    failures.push(`${check.name}: forbidden ${forbidden.map(String).join(', ')}`);
  }
}

for (const check of BLOCK_CHECKS) {
  const source = await readText(check.path);
  const match = source.match(check.pattern);

  if (!match) {
    failures.push(`${check.name}: could not find expected block ${check.pattern}`);
    continue;
  }

  if (check.forbidden.test(match[0])) {
    failures.push(`${check.name}: forbidden ${check.forbidden} inside block`);
  }
}

for (const [path, requiredImport, forbiddenLocalFunction] of ADAPTER_IMPORT_CHECKS) {
  const source = await readText(path);

  if (!requiredImport.test(source)) {
    failures.push(`${path}: missing shared adapter import`);
  }

  if (forbiddenLocalFunction.test(source)) {
    failures.push(`${path}: still defines template dialog adapter locally`);
  }
}

if (failures.length > 0) {
  console.error('Automation template modal selection contract check failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log('Automation template modal selection contract OK');
console.log(`contract=${CONTRACT_PATH}`);
console.log(`checks=${CONTRACT_CHECKS.length + FILE_CHECKS.length + FORBIDDEN_CHECKS.length + BLOCK_CHECKS.length + ADAPTER_IMPORT_CHECKS.length}`);

async function ensureFile(path) {
  try {
    await access(path);
  } catch {
    failures.push(`${path}: missing file`);
  }
}

async function readText(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    failures.push(`${path}: ${error.message}`);
    return '';
  }
}

function assertPatterns(source, patterns, name) {
  const missing = patterns.filter((pattern) => !pattern.test(source));

  if (missing.length) {
    failures.push(`${name}: missing ${missing.map(String).join(', ')}`);
  }
}
