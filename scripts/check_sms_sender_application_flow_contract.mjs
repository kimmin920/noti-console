#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const phaseDir = '28-sms-sender-resource-application-redesign';
const contractScriptName = 'test:sms-sender-application-flow-contract';
const contractScriptCommand = 'node scripts/check_sms_sender_application_flow_contract.mjs';

const files = {
  self: fileURLToPath(import.meta.url),
  packageJson: path.join(rootDir, 'package.json'),
  phasesIndex: path.join(rootDir, 'phases/index.json'),
  domainsAdd: path.join(rootDir, 'src/components/domains/DomainsAdd.jsx'),
  domainsIndex: path.join(rootDir, 'src/components/domains/index.js'),
  kakaoChannelAdd: path.join(rootDir, 'src/components/sender-resources/KakaoChannelAdd.jsx'),
  kakaoChannelForm: path.join(rootDir, 'src/components/sender-resources/KakaoChannelForm.jsx'),
  kakaoChannelOtpStep: path.join(rootDir, 'src/components/sender-resources/KakaoChannelOtpStep.jsx'),
  kakaoChannelSummary: path.join(rootDir, 'src/components/sender-resources/KakaoChannelSummary.jsx'),
  senderResourcesIndex: path.join(rootDir, 'src/components/sender-resources/index.js'),
  smsSenderNumberAdd: path.join(rootDir, 'src/components/sender-resources/SmsSenderNumberAdd.jsx'),
  componentStyles: path.join(rootDir, 'src/styles/components.css'),
  playgroundRegistry: path.join(rootDir, 'src/playground/componentRegistry.jsx'),
  consolePages: path.join(rootDir, 'src/features/console/settings/SettingsPage.jsx'),
  mutations: path.join(rootDir, 'src/features/console/messageSend/mutations.js'),
  senderResourceService: path.join(rootDir, 'src/server/senderResources/service.js'),
  senderResourceApprovalTest: path.join(rootDir, 'src/server/__tests__/senderResourceApproval.test.js'),
};

const contractEnforcementStage = 'strict-final-route-step-4';

const finalUiStructureContract = {
  route: '/settings/sender-resources/sms/new',
  stepRailFamily: ['DomainAddHeader', 'DomainAddSteps', 'DomainStep'],
  newApplicationFlow: ['발신번호', '발신번호 증빙서류', '심사 접수'],
  allowedActionsBeforeCompletion: ['다음', '신청 제출'],
  noSeparateSubmitConfirmationScreen: 'no separate submit-confirmation screen',
};

const finalNewApplicationBehaviorContract = {
  headerDescription: '발신번호와 증빙서류를 확인한 뒤 운영자 심사로 접수합니다.',
  numberTypeControl: 'SegmentedControl',
  numberTypeLabels: ['개인번호', '회사번호'],
  normalizationAnchors: [
    'normalizeSenderNumberInput',
    '발신번호는 숫자 기준 8자리에서 11자리여야 합니다.',
    '존재하지 않는 번호 대역은 등록할 수 없습니다.',
  ],
  completedStepOneSummary: ['readonly summary', 'formatted number', 'number type'],
  lockedStepStatus: 'status="locked"',
  optionalEvidenceLabel: '선택',
  requiredEvidenceMarker: [
    'sender-number-evidence-required-star',
    'aria-label="필수"',
  ],
  acceptedInputExtensions: '.pdf,.jpg,.jpeg,.png',
  neutralCompletedPreviousSteps: [
    '.sms-sender-number-step.domain-step-completed .domain-step-card-gradient',
    '.sms-sender-evidence-step.domain-step-completed .domain-step-card-gradient',
    '.sms-sender-number-step.domain-step-completed .domain-step-card-inner',
    '.sms-sender-evidence-step.domain-step-completed .domain-step-card-inner',
  ],
  reviewPendingAfterMutation: ['submitted', 'review-pending', '심사 접수'],
};

const finalResubmissionBehaviorContract = {
  title: '발신번호 재신청',
  lockedStepOne: ['completed', 'locked', 'read-only'],
  activeStepTwo: ['rejectReason', '반려 사유'],
  rejectionNoticeSurface: 'Notice',
  reusableEvidenceState: '기존',
  replacementEvidenceState: '변경 예정',
  existingAdditionalEvidence: 'operator-supplement.pdf',
  partialReplacementRule: 'not forced to upload every document again',
  identityLock: ['same sender number', 'same sender number type'],
  reviewReceipt: '재신청이 심사 접수되었습니다.',
  resubmitAction: '재신청 제출',
};

const finalForbiddenActiveTargetPatterns = [
  'old two-panel SectionPanel flow',
  'message-preview panel',
  'domain schemas',
  'migrations',
  'new auth routes',
  'external API calls',
  'provider behavior',
  'src/playground import in production modules',
];

const finalActiveTargetForbiddenNeedles = [
  '<SmsSenderResourceApplicationForm',
  'function SmsSenderResourceApplicationForm',
  'sender-number-application-panel',
  'sender-number-application-form',
  '<SmsPreview',
  'SmsPreview',
  'message-preview',
  'message-send-preview',
  '제출 전 검토',
  'submit confirmation',
];

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

function expectNotIncludes(content, needle, label) {
  if (content.includes(needle)) {
    fail(`${label} must not include: ${needle}`);
  }
}

function getFunctionSlice(content, functionName) {
  const match = new RegExp(`function\\s+${functionName}\\s*\\(`).exec(content);

  if (!match) {
    return '';
  }

  const paramsOpenIndex = content.indexOf('(', match.index);

  if (paramsOpenIndex < 0) {
    return '';
  }

  let paramsDepth = 0;
  let paramsCloseIndex = -1;

  for (let index = paramsOpenIndex; index < content.length; index += 1) {
    if (content[index] === '(') paramsDepth += 1;
    if (content[index] === ')') paramsDepth -= 1;

    if (paramsDepth === 0) {
      paramsCloseIndex = index;
      break;
    }
  }

  if (paramsCloseIndex < 0) {
    return '';
  }

  const openIndex = content.indexOf('{', paramsCloseIndex);

  if (openIndex < 0) {
    return '';
  }

  let depth = 0;

  for (let index = openIndex; index < content.length; index += 1) {
    if (content[index] === '{') depth += 1;
    if (content[index] === '}') depth -= 1;

    if (depth === 0) {
      return content.slice(match.index, index + 1);
    }
  }

  return content.slice(match.index);
}

async function readOptional(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

async function listCodeFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const codeFiles = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'playground') {
        continue;
      }

      codeFiles.push(...await listCodeFiles(entryPath));
      continue;
    }

    if (/\.(js|jsx|mjs)$/.test(entry.name)) {
      codeFiles.push(entryPath);
    }
  }

  return codeFiles;
}

function collectImportSpecifiers(source) {
  const importSpecifiers = [];
  const staticImportPattern = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  const dynamicImportPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const pattern of [staticImportPattern, dynamicImportPattern]) {
    let match = pattern.exec(source);

    while (match) {
      importSpecifiers.push(match[1]);
      match = pattern.exec(source);
    }
  }

  return importSpecifiers;
}

const [
  self,
  packageJsonText,
  phasesIndexText,
  domainsAdd,
  domainsIndex,
  kakaoChannelAdd,
  kakaoChannelForm,
  kakaoChannelOtpStep,
  kakaoChannelSummary,
  senderResourcesIndex,
  smsSenderNumberAdd,
  componentStyles,
  playgroundRegistry,
  consolePages,
  mutations,
  senderResourceService,
  senderResourceApprovalTest,
] = await Promise.all([
  readFile(files.self, 'utf8'),
  readFile(files.packageJson, 'utf8'),
  readFile(files.phasesIndex, 'utf8'),
  readFile(files.domainsAdd, 'utf8'),
  readFile(files.domainsIndex, 'utf8'),
  readFile(files.kakaoChannelAdd, 'utf8'),
  readFile(files.kakaoChannelForm, 'utf8'),
  readFile(files.kakaoChannelOtpStep, 'utf8'),
  readFile(files.kakaoChannelSummary, 'utf8'),
  readFile(files.senderResourcesIndex, 'utf8'),
  readOptional(files.smsSenderNumberAdd),
  readFile(files.componentStyles, 'utf8'),
  readFile(files.playgroundRegistry, 'utf8'),
  readFile(files.consolePages, 'utf8'),
  readFile(files.mutations, 'utf8'),
  readFile(files.senderResourceService, 'utf8'),
  readFile(files.senderResourceApprovalTest, 'utf8'),
]);

const smsApplicationRouteSource = [
  getFunctionSlice(consolePages, 'SenderResourceApplicationPage'),
  getFunctionSlice(consolePages, 'SmsSenderResourceApplicationPage'),
].join('\n');
const legacySmsApplicationFormSource = getFunctionSlice(consolePages, 'SmsSenderResourceApplicationForm');
const routeUsesRedesignedComponent = smsApplicationRouteSource.includes('SmsSenderNumberAdd')
  || finalUiStructureContract.stepRailFamily.every((term) => smsApplicationRouteSource.includes(term));
const activeSmsApplicationSource = [
  smsApplicationRouteSource,
  routeUsesRedesignedComponent ? smsSenderNumberAdd : legacySmsApplicationFormSource,
].join('\n');
const smsSenderNumberInputStepSource = getFunctionSlice(smsSenderNumberAdd, 'SmsSenderNumberInputStep');
const smsSenderNumberCompletedStepSource = getFunctionSlice(smsSenderNumberAdd, 'SmsSenderNumberCompletedStep');
const smsEvidenceStepSource = getFunctionSlice(smsSenderNumberAdd, 'SmsEvidenceStep');
const smsEvidenceRowSource = getFunctionSlice(smsSenderNumberAdd, 'SmsEvidenceRow');
const smsAdditionalEvidenceRowSource = getFunctionSlice(smsSenderNumberAdd, 'SmsAdditionalEvidenceRow');
const smsReviewStepSource = getFunctionSlice(smsSenderNumberAdd, 'SmsReviewStep');
const smsApplicationPayloadSource = getFunctionSlice(smsSenderNumberAdd, 'buildSmsSenderNumberApplicationPayload');

check('package.json exposes the SMS sender application flow contract script', () => {
  const packageJson = JSON.parse(packageJsonText);

  if (packageJson.scripts?.[contractScriptName] !== contractScriptCommand) {
    fail(`${contractScriptName} must run "${contractScriptCommand}".`);
  }
});

check('phase is registered in the top-level phase index', () => {
  const phasesIndex = JSON.parse(phasesIndexText);
  const entry = phasesIndex.phases?.find((phase) => phase.dir === phaseDir);

  if (!entry) {
    fail(`${phaseDir} is not registered in phases/index.json.`);
  }
});

check('contract enforces the final production SMS sender application route', () => {
  expectIncludes(contractEnforcementStage, 'strict-final-route', 'contract enforcement stage');
  expectIncludes(self, 'strict-final-route-step-4', 'self contract stage marker');
});

check('final target UI structure is recorded in the checker', () => {
  for (const term of [
    finalUiStructureContract.route,
    ...finalUiStructureContract.stepRailFamily,
    ...finalUiStructureContract.newApplicationFlow,
    ...finalUiStructureContract.allowedActionsBeforeCompletion,
    finalUiStructureContract.noSeparateSubmitConfirmationScreen,
  ]) {
    expectIncludes(self, term, 'final UI structure contract term');
  }
});

check('final new-application behavior is recorded in the checker', () => {
  for (const term of [
    finalNewApplicationBehaviorContract.headerDescription,
    finalNewApplicationBehaviorContract.numberTypeControl,
    ...finalNewApplicationBehaviorContract.numberTypeLabels,
    ...finalNewApplicationBehaviorContract.normalizationAnchors,
    ...finalNewApplicationBehaviorContract.completedStepOneSummary,
    finalNewApplicationBehaviorContract.lockedStepStatus,
    finalNewApplicationBehaviorContract.optionalEvidenceLabel,
    ...finalNewApplicationBehaviorContract.requiredEvidenceMarker,
    finalNewApplicationBehaviorContract.acceptedInputExtensions,
    ...finalNewApplicationBehaviorContract.neutralCompletedPreviousSteps,
    ...finalNewApplicationBehaviorContract.reviewPendingAfterMutation,
  ]) {
    expectIncludes(self, term, 'final new-application behavior contract term');
  }
});

check('final resubmission behavior is recorded in the checker', () => {
  for (const term of [
    finalResubmissionBehaviorContract.title,
    ...finalResubmissionBehaviorContract.lockedStepOne,
    ...finalResubmissionBehaviorContract.activeStepTwo,
    finalResubmissionBehaviorContract.rejectionNoticeSurface,
    finalResubmissionBehaviorContract.reusableEvidenceState,
    finalResubmissionBehaviorContract.replacementEvidenceState,
    finalResubmissionBehaviorContract.existingAdditionalEvidence,
    finalResubmissionBehaviorContract.partialReplacementRule,
    ...finalResubmissionBehaviorContract.identityLock,
    finalResubmissionBehaviorContract.reviewReceipt,
    finalResubmissionBehaviorContract.resubmitAction,
  ]) {
    expectIncludes(self, term, 'final resubmission behavior contract term');
  }
});

check('final forbidden active-target patterns are recorded in the checker', () => {
  for (const term of finalForbiddenActiveTargetPatterns) {
    expectIncludes(self, term, 'final forbidden active-target contract term');
  }
});

check('domain/Kakao step rail primitives remain available for reuse', () => {
  for (const term of finalUiStructureContract.stepRailFamily) {
    expectIncludes(domainsAdd, `export function ${term}`, 'domain step rail primitive');
    expectIncludes(domainsIndex, term, 'domain step rail export');
  }

  expectIncludes(kakaoChannelAdd, 'DomainAddHeader', 'Kakao channel header primitive');
  expectIncludes(kakaoChannelAdd, 'DomainAddSteps', 'Kakao channel steps primitive');
  expectIncludes(kakaoChannelForm, 'DomainStep', 'Kakao channel information step primitive');
  expectIncludes(kakaoChannelOtpStep, 'DomainStep', 'Kakao channel OTP step primitive');
  expectIncludes(kakaoChannelSummary, 'DomainStep', 'Kakao channel completed step primitive');
});

check('SMS sender application component scaffold is exported and production-safe', () => {
  expectIncludes(smsSenderNumberAdd, 'export function SmsSenderNumberAdd', 'SMS sender component export');
  expectIncludes(smsSenderNumberAdd, 'Notice', 'SMS sender component shared notice surface');
  expectIncludes(smsSenderNumberAdd, 'DomainAddHeader', 'SMS sender component step rail header');
  expectIncludes(smsSenderNumberAdd, 'DomainAddSteps', 'SMS sender component step rail wrapper');
  expectIncludes(smsSenderNumberAdd, 'DomainStep', 'SMS sender component step primitive');
  expectIncludes(smsSenderNumberAdd, 'SegmentedControl', 'SMS sender component number type control');
  expectIncludes(smsSenderNumberAdd, 'SMS_SENDER_NUMBER_TYPE_OPTIONS', 'SMS sender number type options');
  expectIncludes(smsSenderNumberAdd, 'PERSONAL_SENDER_EVIDENCE_FILES', 'personal evidence definitions');
  expectIncludes(smsSenderNumberAdd, 'COMPANY_SENDER_EVIDENCE_FILES', 'company evidence definitions');
  expectIncludes(smsSenderNumberAdd, 'ADDITIONAL_SENDER_EVIDENCE_FILE', 'additional evidence definition');
  expectIncludes(smsSenderNumberAdd, 'SENDER_EVIDENCE_FILE_ACCEPT', 'accepted input extensions');
  expectNotIncludes(smsSenderNumberAdd, 'SENDER_EVIDENCE_FILE_ACCEPT_LABEL', 'visible accepted extension label');
  expectIncludes(smsSenderNumberAdd, 'normalizeSenderNumberInput', 'sender number normalization helper');
  expectIncludes(smsSenderNumberAdd, 'onSubmit?.(payload)', 'submission callback');
  expectIncludes(smsSenderNumberAdd, 'onBack?.()', 'back callback');
  for (const term of finalNewApplicationBehaviorContract.neutralCompletedPreviousSteps) {
    expectIncludes(componentStyles, term, 'SMS completed previous step neutral surface override');
  }
  expectIncludes(componentStyles, '.sms-sender-number-step.domain-step-completed .domain-step-dot', 'SMS completed number step neutral dot override');
  expectIncludes(componentStyles, '.sms-sender-evidence-step.domain-step-completed .domain-step-dot', 'SMS completed evidence step neutral dot override');
  expectNotIncludes(smsSenderNumberAdd, 'fetch(', 'SMS sender component direct API call');
  expectNotIncludes(smsSenderNumberAdd, 'relayPost', 'SMS sender component relay API call');
  expectNotIncludes(smsSenderNumberAdd, 'src/playground', 'SMS sender component playground import');

  for (const term of [
    'SmsSenderNumberAdd',
    'smsSenderNumberAddFixtures',
    'SMS_SENDER_NUMBER_TYPE_OPTIONS',
    'PERSONAL_SENDER_EVIDENCE_FILES',
    'COMPANY_SENDER_EVIDENCE_FILES',
    'ADDITIONAL_SENDER_EVIDENCE_FILE',
  ]) {
    expectIncludes(senderResourcesIndex, term, 'sender-resources public export');
  }
});

check('SMS sender new-application component implements the final step flow', () => {
  expectIncludes(smsSenderNumberAdd, "title={isResubmission ? '발신번호 재신청' : '발신번호 추가'}", 'new SMS application title');
  expectIncludes(
    smsSenderNumberAdd,
    finalNewApplicationBehaviorContract.headerDescription,
    'new SMS application ownership-before-review description'
  );

  expectIncludes(smsSenderNumberInputStepSource, 'title="발신번호"', 'SMS Step 1 title');
  expectIncludes(smsSenderNumberInputStepSource, 'SegmentedControl', 'SMS Step 1 segmented number type control');
  expectIncludes(smsSenderNumberInputStepSource, 'SMS_SENDER_NUMBER_TYPE_OPTIONS', 'SMS Step 1 type option source');
  expectNotIncludes(smsSenderNumberInputStepSource, '<select', 'SMS Step 1 native select');

  const inputCount = (smsSenderNumberInputStepSource.match(/DomainTextInput/g) ?? []).length;
  if (inputCount !== 1) {
    fail(`SMS Step 1 must render exactly one sender-number input, found ${inputCount}.`);
  }

  expectIncludes(smsSenderNumberInputStepSource, 'id="sms-sender-number-input"', 'SMS Step 1 input identity');
  expectIncludes(smsSenderNumberAdd, 'normalizeSenderNumberInput(sendNo)', 'SMS Step 1 normalized sender number state');
  expectIncludes(smsSenderNumberAdd, 'getSenderNumberInputIssue(sendNo)', 'SMS Step 1 validation helper');
  expectIncludes(smsApplicationPayloadSource, 'sendNo: formContext.sendNo', 'SMS payload uses normalized sender number');
  expectIncludes(smsSenderNumberInputStepSource, 'disabled={!canContinue}', 'SMS Step 1 next disabled until valid');

  expectIncludes(smsSenderNumberCompletedStepSource, 'status="completed"', 'SMS Step 1 completed status');
  expectIncludes(smsSenderNumberCompletedStepSource, 'readOnly', 'SMS Step 1 readonly summary');
  expectIncludes(smsSenderNumberCompletedStepSource, 'formatSmsSenderNumberForDisplay(sendNo)', 'SMS Step 1 formatted number summary');
  expectIncludes(smsSenderNumberCompletedStepSource, 'selectedNumberType.label', 'SMS Step 1 type summary');

  expectIncludes(smsSenderNumberAdd, '<DomainStepBody status="locked">', 'SMS locked future steps');
  expectIncludes(
    smsSenderNumberAdd,
    '<DomainStepHeading status="locked">발신번호 증빙서류</DomainStepHeading>',
    'SMS Step 2 locked before Step 1 completion'
  );
  expectIncludes(smsEvidenceStepSource, 'title="발신번호 증빙서류"', 'SMS Step 2 title');
  expectIncludes(smsEvidenceStepSource, '<Notice', 'SMS Step 2 notice surface');
  expectIncludes(smsEvidenceStepSource, 'title="반려 사유"', 'SMS Step 2 rejection notice title');
  expectIncludes(smsEvidenceStepSource, 'documents.map', 'SMS Step 2 renders selected required evidence rows');
  expectIncludes(smsEvidenceStepSource, 'SmsEvidenceRow', 'SMS Step 2 required evidence row component');
  expectIncludes(smsAdditionalEvidenceRowSource, 'ADDITIONAL_SENDER_EVIDENCE_FILE.label', 'SMS Step 2 additional evidence row');
  expectIncludes(
    smsAdditionalEvidenceRowSource,
    finalNewApplicationBehaviorContract.optionalEvidenceLabel,
    'SMS Step 2 optional additional evidence label'
  );
  expectIncludes(
    smsEvidenceRowSource,
    '<span aria-label="필수" className="sender-number-evidence-required-star">*</span>',
    'SMS Step 2 required evidence star-only marker'
  );
  expectNotIncludes(smsEvidenceRowSource, 'sender-number-evidence-requirement-label is-required', 'SMS Step 2 required evidence visible required label');
  expectNotIncludes(smsEvidenceRowSource, '필수<span', 'SMS Step 2 required evidence visible required text');
  expectNotIncludes(
    smsEvidenceStepSource,
    '필수 {completedRequiredEvidenceCount}/{requiredEvidenceCount} 완료',
    'SMS Step 2 required evidence count summary'
  );
  expectNotIncludes(smsSenderNumberAdd, 'PDF/JPG/JPEG/PNG · 5MB 이하', 'SMS Step 2 visible file policy text');
  expectIncludes(smsEvidenceRowSource, 'type="file"', 'SMS Step 2 evidence file input');
  expectIncludes(smsEvidenceRowSource, "displayFile ? '변경' : '파일 선택'", 'SMS Step 2 evidence replacement control');
  expectIncludes(smsEvidenceRowSource, '변경 예정', 'SMS Step 2 replacement pending state');
  expectIncludes(smsEvidenceRowSource, 'onRemove(document.id)', 'SMS Step 2 evidence removal control');
  expectIncludes(smsEvidenceStepSource, 'disabled={!evidenceReady || isSubmitting}', 'SMS Step 2 submit disabled until required files');
  expectIncludes(smsEvidenceStepSource, "isResubmission ? '재신청 제출' : '신청 제출'", 'SMS Step 2 submit action label');

  expectIncludes(
    smsReviewStepSource,
    '<DomainStepHeading status="locked">심사 접수</DomainStepHeading>',
    'SMS Step 3 locked before submission'
  );
  expectIncludes(smsSenderNumberAdd, "setStep('submitted')", 'SMS submission success advances to review step');
  expectIncludes(smsReviewStepSource, 'status="completed"', 'SMS Step 3 completed after submission');
  expectIncludes(smsReviewStepSource, 'data-state="review-pending"', 'SMS Step 3 review pending state');
  expectIncludes(smsReviewStepSource, 'data-submission-state', 'SMS Step 3 submitted state marker');
  expectIncludes(smsReviewStepSource, '신청이 심사 접수되었습니다.', 'SMS Step 3 review receipt copy');
  expectIncludes(smsReviewStepSource, '재신청이 심사 접수되었습니다.', 'SMS Step 3 resubmission review receipt copy');
  expectNotIncludes(smsSenderNumberAdd, 'onBack();', 'SMS component success path auto-navigation');
});

check('SMS sender application playground entry covers required scaffold states', () => {
  expectIncludes(playgroundRegistry, 'SmsSenderNumberAdd', 'SMS sender playground import');
  expectIncludes(playgroundRegistry, 'smsSenderNumberAddFixtures', 'SMS sender playground fixtures');
  expectIncludes(playgroundRegistry, "id: 'sms-sender-number-add'", 'SMS sender playground component id');

  for (const state of [
    'default',
    'numberCompleted',
    'partialEvidence',
    'rejectedResubmission',
    'submittedCompleted',
  ]) {
    expectIncludes(playgroundRegistry, state, 'SMS sender playground state');
  }

  expectIncludes(smsSenderNumberAdd, 'operator-supplement.pdf', 'SMS sender resubmission existing additional evidence fixture');
});

check('SMS sender application mutation remains multipart and query-invalidating', () => {
  expectIncludes(mutations, 'useSmsSenderApplicationMutation', 'SMS sender application mutation');
  expectIncludes(mutations, "relayPostForm('/api/sender-resources/sms/applications'", 'multipart SMS application mutation');
  expectIncludes(mutations, 'messageSendQueryKeys.senderResources', 'sender resource invalidation');
});

check('server resubmission policy preserves sender number and type while allowing partial evidence replacement', () => {
  expectIncludes(senderResourceService, 'async function resubmitRejectedSmsApplication', 'resubmission service path');
  expectIncludes(
    senderResourceService,
    'Rejected applications can only be resubmitted for the same sender number.',
    'same sender number guard'
  );
  expectIncludes(
    senderResourceService,
    'Rejected applications can only be resubmitted with the same sender number type.',
    'same sender number type guard'
  );
  expectIncludes(senderResourceService, 'existingEvidenceFiles', 'retained evidence validation');
  expectIncludes(senderResourceService, 'replacementDocumentTypes', 'replacement evidence selection');
  expectIncludes(senderResourceService, 'Evidence files must be PDF, JPG, JPEG, or PNG.', 'file extension policy');
  expectIncludes(senderResourceService, 'Evidence files must be 5MB or smaller.', 'file size policy');
});

check('server tests cover retained, replaced, and additional evidence resubmission', () => {
  expectIncludes(
    senderResourceApprovalTest,
    'resubmits rejected SMS applications while retaining, replacing, and adding evidence',
    'resubmission evidence test'
  );
  expectIncludes(senderResourceApprovalTest, 'id-card-revised.pdf', 'replacement file assertion');
  expectIncludes(senderResourceApprovalTest, 'supplement-1.pdf', 'additional evidence assertion');
});

check('production SMS application route renders the redesigned component', () => {
  expectIncludes(smsApplicationRouteSource, "type === 'sms'", 'SMS route selection');
  expectIncludes(smsApplicationRouteSource, 'SmsSenderResourceApplicationPage', 'SMS application page route');
  expectIncludes(smsApplicationRouteSource, '<SmsSenderNumberAdd', 'final production route redesigned SMS component');
  expectIncludes(smsApplicationRouteSource, 'handleSmsSenderApplicationSubmit', 'final production route submit bridge');
  expectNotIncludes(smsApplicationRouteSource, '<SmsSenderResourceApplicationForm', 'final production route');

  if (legacySmsApplicationFormSource) {
    fail('Legacy SmsSenderResourceApplicationForm must be removed from the production SMS application route.');
  }
});

check('strict final production-route checks run against the redesigned flow', () => {
  if (!routeUsesRedesignedComponent) {
    fail('The production SMS sender application route must render the redesigned SmsSenderNumberAdd flow.');
  }

  expectNotIncludes(smsSenderNumberAdd, 'SectionPanel', 'final active SMS application flow');

  for (const term of finalUiStructureContract.stepRailFamily) {
    expectIncludes(activeSmsApplicationSource, term, 'final SMS step rail usage');
  }

  for (const term of finalUiStructureContract.newApplicationFlow) {
    expectIncludes(activeSmsApplicationSource, term, 'final SMS step title');
  }

  for (const term of finalUiStructureContract.allowedActionsBeforeCompletion) {
    expectIncludes(activeSmsApplicationSource, term, 'final SMS pre-completion action');
  }

  for (const term of finalNewApplicationBehaviorContract.numberTypeLabels) {
    expectIncludes(activeSmsApplicationSource, term, 'final SMS number type label');
  }

  expectIncludes(activeSmsApplicationSource, 'SegmentedControl', 'final SMS segmented number type control');
  expectIncludes(activeSmsApplicationSource, 'readOnly', 'final SMS completed Step 1 readonly summary');
  expectIncludes(activeSmsApplicationSource, 'sender-number-evidence-required-star', 'final SMS required evidence red star marker');
  expectNotIncludes(activeSmsApplicationSource, 'is-required', 'final SMS visible required evidence label');
  expectNotIncludes(activeSmsApplicationSource, '필수<span', 'final SMS visible required evidence text');
  expectNotIncludes(activeSmsApplicationSource, '필수 {completedRequiredEvidenceCount}/{requiredEvidenceCount} 완료', 'final SMS required evidence count summary');
  expectNotIncludes(activeSmsApplicationSource, 'PDF/JPG/JPEG/PNG · 5MB 이하', 'final SMS visible evidence file policy');
  expectIncludes(activeSmsApplicationSource, 'submitted', 'final SMS submitted state');
  expectIncludes(activeSmsApplicationSource, '심사', 'final SMS review-pending state');
  expectNotIncludes(activeSmsApplicationSource, 'onBack();', 'final SMS submission success path');

  expectIncludes(activeSmsApplicationSource, '발신번호 재신청', 'final SMS resubmission title');
  expectIncludes(activeSmsApplicationSource, '<Notice', 'final SMS resubmission notice surface');
  expectIncludes(activeSmsApplicationSource, 'rejectReason', 'final SMS resubmission reject reason');
  expectIncludes(activeSmsApplicationSource, '기존', 'final SMS existing evidence state');
  expectIncludes(activeSmsApplicationSource, '변경 예정', 'final SMS replacement evidence state');
  expectIncludes(activeSmsApplicationSource, 'operator-supplement.pdf', 'final SMS existing additional evidence fixture');
  expectIncludes(activeSmsApplicationSource, '재신청이 심사 접수되었습니다.', 'final SMS resubmission receipt state');
  expectIncludes(activeSmsApplicationSource, 'applicationId', 'final SMS resubmission application identity');
  expectIncludes(activeSmsApplicationSource, 'senderNumberType', 'final SMS resubmission type identity');
  expectIncludes(activeSmsApplicationSource, 'sendNo', 'final SMS resubmission sender number identity');

  for (const needle of finalActiveTargetForbiddenNeedles) {
    expectNotIncludes(activeSmsApplicationSource, needle, 'final SMS active target');
  }
});

check('production modules do not import the development playground', async () => {
  const roots = [
    path.join(rootDir, 'src/app'),
    path.join(rootDir, 'src/components'),
    path.join(rootDir, 'src/features'),
    path.join(rootDir, 'src/server'),
  ];
  const productionFiles = (await Promise.all(roots.map(listCodeFiles))).flat()
    .filter((filePath) => !filePath.includes(`${path.sep}src${path.sep}playground${path.sep}`))
    .filter((filePath) => !filePath.includes(`${path.sep}src${path.sep}app${path.sep}playground${path.sep}`));

  for (const filePath of productionFiles) {
    const source = await readFile(filePath, 'utf8');
    const badImport = collectImportSpecifiers(source).find((specifier) => (
      specifier === 'src/playground'
      || specifier.startsWith('src/playground/')
      || specifier.includes('/playground/')
      || specifier.endsWith('/playground')
    ));

    if (badImport) {
      fail(`${path.relative(rootDir, filePath)} imports playground module ${badImport}.`);
    }
  }
});

const failures = [];

for (const { name, predicate } of checks) {
  try {
    await predicate();
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error('SMS sender application flow contract check failed.');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`SMS sender application flow contract check passed (${checks.length} checks, ${contractEnforcementStage}).`);
