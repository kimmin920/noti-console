#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const CONTRACT_PATH = 'phases/27-automation-open-api/automation-open-api-contract.md';

const REQUIRED_CHECKS = [
  {
    name: 'public endpoint',
    patterns: [/POST \/api\/open\/v1\/publ\/events/, /only public endpoint in this phase/i],
  },
  {
    name: 'required channelCode mapping key',
    patterns: [/`channelCode`/, /always required/i, /business\/user\s+mapping key/i],
  },
  {
    name: 'required externalEventId idempotency',
    patterns: [/`externalEventId`/, /required non-empty string for idempotency/i, /400 invalid_payload/],
  },
  {
    name: 'raw-body HMAC contract',
    patterns: [
      /raw request body/i,
      /x-publ-timestamp/,
      /x-publ-signature/,
      /PUBL_OPEN_API_WEBHOOK_SECRET/,
      /five minutes/i,
    ],
  },
  {
    name: 'runtime payload merge',
    patterns: [
      /runtime event payload passed to the PUBL resolver/i,
      /`payload`\s+merged with the envelope fields/i,
      /`eventKey`/,
      /`channelCode`/,
      /`externalEventId`/,
      /`occurredAt`/,
    ],
  },
  {
    name: 'targetPhoneNumber runtime requirement',
    patterns: [/`targetPhoneNumber` is runtime-required/i, /source catalog row marks it optional/i],
  },
  {
    name: 'unknown channel behavior',
    patterns: [
      /Unknown `channelCode`/,
      /422/,
      /`unknown_channel_code`/,
      /do not store a user-facing row/i,
      /do not store the unknown-channel event payload/i,
    ],
  },
  {
    name: 'ignored no-rule behavior',
    patterns: [
      /no active automation rule/i,
      /202/,
      /`ignored_no_rule`/,
      /do not store a user-facing row/i,
      /do not store the rule-less event payload/i,
    ],
  },
  {
    name: 'unsent behavior',
    patterns: [
      /202/,
      /`unsent`/,
      /Missing sender resource/i,
      /Missing template/i,
      /Missing registration/i,
      /payload data that is needed for later send/i,
    ],
  },
  {
    name: 'encrypted payload storage boundary',
    patterns: [
      /encrypted short-lived server data/i,
      /retention window/i,
      /purge path/i,
      /browser-visible JSON/i,
    ],
  },
  {
    name: 'sensitive storage prohibition',
    patterns: [
      /Do not store raw recipient phone numbers/i,
      /raw event payloads/i,
      /message bodies/i,
      /rendered content/i,
      /template parameter values/i,
      /provider request bodies/i,
      /provider response bodies/i,
    ],
  },
  {
    name: 'rule CRUD out of scope',
    patterns: [
      /Rule creation\/editing UI and public management APIs are out of scope/i,
      /Rules are seed\/admin-managed for this phase/i,
    ],
  },
  {
    name: 'template-reference rule scope',
    patterns: [
      /Rules are template-reference based/i,
      /sender resource references/i,
      /template codes/i,
      /variable mappings/i,
      /SMS automation sends resolve provider template content at dispatch time/i,
      /AlimTalk and Brand Message automation sends are template-mode only/i,
    ],
  },
  {
    name: 'delivery unique key',
    patterns: [
      /Store one delivery row per `channelMappingId \+ externalEventId \+ automationRuleId`/,
      /delivery unique key/i,
      /duplicate retry/i,
      /must not dispatch again/i,
    ],
  },
  {
    name: 'message_send_groups automation metadata',
    patterns: [/message_send_groups/, /automation source metadata/i, /must not include raw event payload/i],
  },
];

let contract;

try {
  contract = await readFile(CONTRACT_PATH, 'utf8');
} catch (error) {
  console.error(`Failed to read automation Open API contract at ${CONTRACT_PATH}: ${error.message}`);
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
  console.error('Automation Open API contract check failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log('Automation Open API contract OK');
console.log(`contract=${CONTRACT_PATH}`);
console.log(`checks=${REQUIRED_CHECKS.length}`);
