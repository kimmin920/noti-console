#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const CONTRACT_PATH = 'phases/29-automation-rule-management/automation-rule-management-contract.md';

const REQUIRED_CHECKS = [
  {
    name: 'production single-event scope',
    patterns: [
      /production-ready single-event automation rule manager/i,
      /one PUBL event definition/i,
      /`publ_channel_mappings\.channelCode`/,
      /template-based message/i,
      /SMS, LMS, or MMS/i,
      /AlimTalk/i,
      /Brand Message/i,
      /browser CRUD/i,
      /Phase `31-automation-unified-builder-no-readiness` supersedes/i,
      /product-facing validation\/readiness, dry-run, activation, condition, and cooldown editor surfaces/i,
      /Server-side configuration guards/i,
      /dispatch-time enforcement/i,
    ],
  },
  {
    name: 'phase 31 supersession',
    patterns: [
      /Phase 31 Supersession/i,
      /authoritative contract for the automation editor/i,
      /Readiness states such as `needs_validation`, `valid`, and `invalid`/i,
      /browser `\/validate` action and validation mutation/i,
      /Validation summary\/sidebar UI such as `저장 전 점검`/i,
      /Dry-run panels and sample event inputs/i,
      /Activation controls embedded in the editor/i,
      /Condition and cooldown editor sections/i,
      /save, enable, and dispatch may be blocked by server-side guard checks/i,
      /must not expose validation\/readiness as a separate product status/i,
    ],
  },
  {
    name: 'out-of-scope workflow features',
    patterns: [
      /Multi-step workflow graphs/i,
      /Wait-for-event steps/i,
      /Delayed queues/i,
      /Quiet-hours scheduling/i,
      /A\/B testing/i,
      /Freeform message body automation/i,
    ],
  },
  {
    name: 'privacy exclusions',
    patterns: [
      /raw event payloads/i,
      /raw recipient phone numbers/i,
      /rendered messages/i,
      /template parameter values/i,
      /provider request bodies/i,
      /provider response bodies/i,
      /must not store sample payload values/i,
    ],
  },
  {
    name: 'lifecycle without product readiness',
    patterns: [
      /Stored `status` remains exactly/i,
      /enabled\s+disabled\s+archived/i,
      /Do not expand the existing `automation_rules\.status` enum/i,
      /Draft, valid, and invalid readiness are no longer product-facing states/i,
      /Legacy validation columns may remain/i,
      /browser DTOs, tables, and editor UI must not expose readiness/i,
      /compute a safe config hash internally/i,
      /Enable is allowed only when the current persisted configuration passes/i,
      /reject invalid enable requests directly/i,
      /Archive is irreversible through browser UI/i,
    ],
  },
  {
    name: 'condition policy allow-list',
    patterns: [
      /Conditions support only an `all` list of clauses/i,
      /event-variable aliases/i,
      /equals\s+not_equals\s+exists\s+contains\s+gt\s+gte\s+lt\s+lte\s+in/i,
      /Arbitrary JavaScript/i,
      /SQL/i,
      /regex source strings/i,
      /nested boolean expression groups are forbidden/i,
    ],
  },
  {
    name: 'cooldown target-hash rule',
    patterns: [
      /Cooldown is evaluated before provider dispatch/i,
      /automationRuleId \+ targetRefHash/,
      /server-produced hash/i,
      /If cooldown is enabled and target hashing cannot be produced, validation fails before enable/i,
      /dispatch must not call provider send APIs/i,
      /safe unsent reason/i,
    ],
  },
  {
    name: 'dry-run supersession boundary',
    patterns: [
      /Dry Run Supersession/i,
      /removes dry-run from the automation editor product surface/i,
      /must not expose sample event payload inputs or dry-run results/i,
      /server-internal dry-run helper remains temporarily/i,
      /must keep the original privacy boundary/i,
      /must not call provider send APIs/i,
      /may resolve:[\s\S]*Event variables/i,
      /Target mapping/i,
      /Condition results/i,
      /Cooldown eligibility/i,
      /Template variable coverage/i,
      /Activation blockers/i,
      /must not persist sample payload/i,
      /sample recipient/i,
      /must avoid raw recipient numbers/i,
      /raw template parameter values/i,
      /masked recipient/i,
      /presence booleans/i,
      /short masked previews/i,
    ],
  },
  {
    name: 'compatibility matrix',
    patterns: [
      /Compatibility Matrix/i,
      /`sms`\s+\|\s+`sms_send_no`\s+\|\s+SMS template lookup/,
      /`lms`\s+\|\s+`sms_send_no`\s+\|\s+SMS template lookup/,
      /`mms`\s+\|\s+`sms_send_no`\s+\|\s+SMS template lookup/,
      /`alimtalk`\s+\|\s+`kakao_sender_key`\s+\|\s+AlimTalk template lookup/,
      /`brand-message`\s+\|\s+`kakao_sender_key`\s+\|\s+Brand Message template lookup/,
      /Channel changes reset incompatible sender and template selections/i,
      /Server validation must reject incompatible sender\/template selections/i,
    ],
  },
  {
    name: 'concurrency rule',
    patterns: [
      /Only one enabled rule may exist for a `userId \+ eventDefinitionId` pair/i,
      /Concurrent enable requests/i,
      /leave exactly one enabled rule/i,
      /transaction/i,
      /database-level uniqueness/i,
      /one request succeeds/i,
      /conflict response/i,
    ],
  },
  {
    name: 'audit and revision boundary',
    patterns: [
      /Create, update, enable, disable, and archive actions/i,
      /historical validate action may exist only in legacy revision records/i,
      /new browser editor flows must not create validate revisions/i,
      /safe audit or revision evidence/i,
      /Revision snapshots may store only safe configuration metadata/i,
      /Template codes/i,
      /Variable mappings by alias/i,
      /Condition clauses by alias/i,
      /Cooldown and activation policy settings/i,
      /must not store sample payload values/i,
      /raw phone numbers/i,
      /rendered content/i,
      /provider request bodies/i,
      /provider response bodies/i,
    ],
  },
  {
    name: 'dispatch enforcement',
    patterns: [
      /Dispatch must enforce the same constraints as validation/i,
      /compatibility, condition, cooldown, target, sender-resource, or template checks/i,
      /must not call provider send APIs/i,
      /Unknown channel events and rule-less events must not store raw payloads/i,
      /legacy enabled data/i,
      /safe unsent reason/i,
    ],
  },
];

let contract;

try {
  contract = await readFile(CONTRACT_PATH, 'utf8');
} catch (error) {
  console.error(`Failed to read automation rule management contract at ${CONTRACT_PATH}: ${error.message}`);
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

if (failures.length > 0) {
  console.error('Automation rule management contract check failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log('Automation rule management contract OK');
console.log(`contract=${CONTRACT_PATH}`);
console.log(`checks=${REQUIRED_CHECKS.length}`);
