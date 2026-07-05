#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const CONTRACT_PATH = 'phases/30-automation-builder-message-flow/automation-builder-message-flow-contract.md';

const REQUIRED_CHECKS = [
  {
    name: 'phase 31 supersession',
    patterns: [
      /Phase 31 Supersession/i,
      /`31-automation-unified-builder-no-readiness` supersedes this contract/i,
      /Builder is create-only while edit mode keeps lower fallback sections/i,
      /Basic info remains below the builder/i,
      /save-readiness sidebar remains outside the builder/i,
      /Product-facing validation, dry-run, and activation controls may appear/i,
      /One generic `AutomationSendMessageNode` with channel adapters/i,
      /Value-based controller callbacks/i,
      /Fixed `targetPhoneNumber` recipient alias/i,
    ],
  },
  {
    name: 'actual template data path retained',
    patterns: [
      /must use the existing automation send configuration data path/i,
      /`useAutomationSendConfiguration\(draft\)`/,
      /`useSmsTemplatesQuery`/,
      /`useAlimtalkTemplatesQuery`/,
      /`useBrandTemplatesQuery`/,
      /must not add duplicate template fetch logic/i,
      /not copied into the editor reducer/i,
    ],
  },
  {
    name: 'value callback retained',
    patterns: [
      /Value-Based Controller Callbacks/i,
      /`changeSendFamilyValue\(family\)`/,
      /`changeSenderResourceValue\(senderResourceId\)`/,
      /`changeSmsChannelValue\(sendChannel\)`/,
      /`selectTemplateObject\(template\)`/,
      /All paths must dispatch the same reducer actions/i,
    ],
  },
  {
    name: 'unified builder primary surface',
    patterns: [
      /Unified Builder Primary Surface/i,
      /In automation creation and editing, the builder is the primary editing surface/i,
      /Edit mode is the same screen as create mode with the persisted rule draft prefilled/i,
      /must not render in create or edit mode/i,
      /Basic info renders above the builder flow/i,
      /The save-readiness sidebar and `저장 전 점검` summary panel do not render/i,
      /Loading, empty, and error states .* from `editor\.sendConfiguration`/i,
    ],
  },
  {
    name: 'excluded UI retained',
    patterns: [
      /Fixed Recipient Alias/i,
      /`targetPhoneNumber`/,
      /must not show a recipient selector/i,
      /Explicit UI Exclusions/i,
      /Condition editor/i,
      /Cooldown editor/i,
      /Validation panel/i,
      /Dry-run panel/i,
      /Activation controls/i,
      /must not surface validation\/readiness, dry-run, activation, condition, or cooldown controls/i,
    ],
  },
  {
    name: 'email residue retained',
    patterns: [
      /Email Residue Removal/i,
      /`defaultAutomationSendEmailTemplates`/,
      /`defaultAutomationSendEmailVariables`/,
      /`defaultVerifiedDomainNames`/,
      /`SendEmailSettingsForm`/,
      /`DraftTemplateNotice`/,
      /`Publish`/,
      /`Subject`/,
      /`from`/,
      /`replyTo`/,
      /`verifiedDomainNames`/,
      /component names, props, user-facing labels, and data models must describe message sending/i,
    ],
  },
  {
    name: 'phase 31 owns code assertions',
    patterns: [
      /Phase `31-automation-unified-builder-no-readiness` owns the new code-level assertions/i,
      /Phase 31 must assert `AutomationRuleEditorForm` derives the selected builder action/i,
      /Phase 31 must assert production editor UI does not render recipient selector/i,
      /Phase 31 must keep those code-level assertions active/i,
    ],
  },
];

const FORBIDDEN_CONFLICTS = [
  /The existing lower sections remain available in edit mode until/i,
  /Basic info and the save-readiness sidebar remain outside the builder/i,
  /must not render in create mode because they duplicate the same work/i,
  /showBuilderPreview = !editing/,
  /showDetailedEditorSections = editing/,
];

let contract;

try {
  contract = await readFile(CONTRACT_PATH, 'utf8');
} catch (error) {
  console.error(`Failed to read automation builder message-flow contract at ${CONTRACT_PATH}: ${error.message}`);
  process.exit(1);
}

const failures = [];
const normalizedContract = contract.replace(/\s+/g, ' ');

for (const check of REQUIRED_CHECKS) {
  const missing = check.patterns.filter((pattern) => !pattern.test(normalizedContract));

  if (missing.length > 0) {
    failures.push(`${check.name}: missing ${missing.map((pattern) => pattern.toString()).join(', ')}`);
  }
}

const forbidden = FORBIDDEN_CONFLICTS.filter((pattern) => pattern.test(contract));
if (forbidden.length > 0) {
  failures.push(`stale phase-30 conflict text: forbidden ${forbidden.map((pattern) => pattern.toString()).join(', ')}`);
}

if (failures.length > 0) {
  console.error('Automation builder message-flow contract check failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log('Automation builder message-flow contract OK');
console.log(`contract=${CONTRACT_PATH}`);
console.log(`checks=${REQUIRED_CHECKS.length}`);
