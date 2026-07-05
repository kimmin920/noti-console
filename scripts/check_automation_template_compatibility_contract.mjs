#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const CONTRACT_PATH = 'phases/29-automation-rule-management/automation-template-compatibility-contract.md';

const REQUIRED_CHECKS = [
  {
    name: 'scope boundary',
    patterns: [
      /browser-managed PUBL automation rules/i,
      /documentation and validation only/i,
      /does not add browser rule APIs/i,
      /does not add .*schema changes/i,
      /durable template snapshots/i,
      /template-reference based/i,
    ],
  },
  {
    name: 'compatibility matrix',
    patterns: [
      /Compatibility Matrix/i,
      /`sms`\s+\|\s+`sms_send_no`\s+\|\s+`\/api\/templates\/sms`/,
      /`lms`\s+\|\s+`sms_send_no`\s+\|\s+`\/api\/templates\/sms`/,
      /`mms`\s+\|\s+`sms_send_no`\s+\|\s+`\/api\/templates\/sms`/,
      /`alimtalk`\s+\|\s+`kakao_sender_key`\s+\|\s+`\/api\/templates\/alimtalk`/,
      /`brand-message`\s+\|\s+`kakao_sender_key`\s+\|\s+`\/api\/templates\/brand`/,
      /SMS, LMS, and MMS are one SMS-family compatibility group/i,
      /Brand Message automation uses existing approved Brand Message templates/i,
      /must not register freestyle Brand Message templates/i,
    ],
  },
  {
    name: 'normalized DTO fields',
    patterns: [
      /Normalized Template Option DTO/i,
      /`templateCode`\s+\|\s+Required stable provider template identifier/i,
      /`templateSource`\s+\|\s+Optional source discriminator/i,
      /`displayName`\s+\|\s+Human-readable template name/i,
      /`providerStatusLabel`\s+\|\s+Human-readable provider\/status label/i,
      /`channel`\s+\|\s+Canonical send channel/i,
      /`templateTypeLabel`\s+\|\s+Compact type label/i,
      /`requiredVariableKeys`\s+\|\s+Deduplicated array of required template variable keys/i,
      /`optionalVariableKeys`\s+\|\s+Deduplicated array of optional template variable keys/i,
      /`previewSummary`\s+\|\s+Preview-safe summary fields only/i,
      /Do not store a composite UI `value` as the template code/i,
    ],
  },
  {
    name: 'DTO privacy exclusions',
    patterns: [
      /must not include message body snapshots/i,
      /rendered content/i,
      /template parameter values/i,
      /recipient values/i,
      /raw button links/i,
      /raw image URLs/i,
      /provider request payloads/i,
      /provider response payloads/i,
      /grouping keys/i,
      /NHN secrets/i,
    ],
  },
  {
    name: 'variable extraction rules',
    patterns: [
      /Variable Extraction/i,
      /prefer existing explicit metadata/i,
      /`requiredVariables`/,
      /`variables\[\]\.key`/,
      /explicit metadata exists, it is authoritative/i,
      /deduplicating in first-seen order/i,
      /Fallback parsing is allowed only when/i,
      /existing authenticated template services already expose/i,
      /SMS-family placeholders:\s+`##variable##`/i,
      /AlimTalk placeholders:\s+`#\{variable\}`/i,
      /Brand Message placeholders:\s+`#\{variable\}`/i,
      /must not fetch raw provider payloads/i,
      /must not persist parsed source text/i,
      /Runtime event values.*must never be persisted/i,
    ],
  },
  {
    name: 'alias mapping rule',
    patterns: [
      /Variable mappings stored for a rule are alias references only/i,
      /template variable key -> PUBL event-variable alias/i,
      /config hash must not contain resolved runtime values/i,
    ],
  },
  {
    name: 'server validation rules',
    patterns: [
      /Server Validation Rules/i,
      /Normalize `sendChannel` and find its compatibility row/i,
      /Require an active actor-authorized sender resource/i,
      /provider is `nhn`/i,
      /type matches the compatibility row/i,
      /Fetch or verify the template through the compatibility row's catalog endpoint/i,
      /Require a stable `templateCode`/i,
      /Require `templateSource` when/i,
      /Reject a template whose returned channel or subtype metadata contradicts/i,
      /Reject SMS-family rules that use `kakao_sender_key` resources/i,
      /Reject AlimTalk and Brand Message rules that use `sms_send_no` resources/i,
      /every `requiredVariableKeys` entry to have an event-variable alias mapping/i,
      /Reject mappings to unknown template variable keys/i,
      /Recompute the safe config hash/i,
      /must not call provider send APIs/i,
    ],
  },
  {
    name: 'UI reset rules',
    patterns: [
      /UI Reset Rules/i,
      /without mirroring query data into reducer state/i,
      /Changing `sendChannel` clears incompatible sender and template selections/i,
      /same required sender resource type may keep the sender only if it is still compatible/i,
      /Changing `sendChannel` always clears the selected template/i,
      /exact same `templateCode` and `templateSource`/i,
      /Changing sender clears selected template/i,
      /template-derived variable mappings/i,
      /validation readiness/i,
      /Changing template clears mappings/i,
      /The template picker is disabled until a compatible sender exists/i,
      /queries only the endpoint from the compatibility matrix/i,
      /must not leave a stale template selected/i,
    ],
  },
  {
    name: 'privacy boundary',
    patterns: [
      /Privacy Boundary/i,
      /may store only safe template metadata/i,
      /`sendChannel`/,
      /`templateCode`/,
      /Optional `templateSource`/,
      /Display\/status\/type labels/i,
      /Required and optional variable keys/i,
      /Alias-based variable mappings/i,
      /Safe validation reason codes/i,
      /They must not store/i,
      /Template body snapshots/i,
      /Rendered message content/i,
      /Template parameter values/i,
      /Runtime event values/i,
      /Dry-run sample payload values/i,
      /Raw recipient phone numbers/i,
      /Raw button links or raw image URLs/i,
      /Provider request bodies/i,
      /Provider response bodies/i,
      /Provider grouping keys/i,
      /NHN app keys, secret keys, or raw provider envelopes/i,
      /currently fetched authenticated template catalog data in memory/i,
      /not copied into automation-owned durable state/i,
    ],
  },
];

let contract;

try {
  contract = await readFile(CONTRACT_PATH, 'utf8');
} catch (error) {
  console.error(`Failed to read automation template compatibility contract at ${CONTRACT_PATH}: ${error.message}`);
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
  console.error('Automation template compatibility contract check failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log('Automation template compatibility contract OK');
console.log(`contract=${CONTRACT_PATH}`);
console.log(`checks=${REQUIRED_CHECKS.length}`);
