#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

import { getSmsSenderNumberDuplicateIssue } from '../src/components/sender-resources/smsSenderNumberDuplicateGuard.js';

const PHASE = '40-sms-sender-duplicate-guard';
const REQUIRED_FILES = [
  `phases/${PHASE}/current-state-audit.md`,
  `phases/${PHASE}/sms-sender-duplicate-guard-contract.md`,
  'src/components/sender-resources/smsSenderNumberDuplicateGuard.js',
  'src/components/sender-resources/SmsSenderNumberAdd.jsx',
  'src/features/console/ConsolePages.jsx',
  'src/server/senderResources/service.js',
  'src/server/__tests__/senderResourceApproval.test.js',
];

const sourceCache = new Map();

await checkRequiredFiles();
await checkPackageScript();
checkDuplicateHelper();
await checkUiWiring();
await checkServerGuard();

console.log('sms sender duplicate guard contract passed');

async function checkRequiredFiles() {
  for (const filePath of REQUIRED_FILES) {
    await readSource(filePath);
  }
}

async function checkPackageScript() {
  const packageJson = JSON.parse(await readSource('package.json'));
  assertEqual(
    packageJson.scripts?.['test:sms-sender-duplicate-guard-contract'],
    'node scripts/check_sms_sender_duplicate_guard_contract.mjs',
    'package.json exposes the SMS sender duplicate guard contract script'
  );
}

function checkDuplicateHelper() {
  const senderResourcesData = {
    applications: [
      {
        id: 'app_submitted_1',
        requestedValue: '15446859',
        resourceType: 'sms_send_no',
        status: 'submitted',
      },
      {
        id: 'app_rejected_1',
        requestedValue: '01012345678',
        resourceType: 'sms_send_no',
        status: 'rejected',
      },
    ],
    resources: [
      {
        id: 'link_1',
        senderResourceId: 'resource_1',
        status: 'active',
        resource: {
          id: 'resource_1',
          status: 'active',
          type: 'sms_send_no',
          value: '0212345678',
        },
      },
    ],
  };

  assertMatch(
    getSmsSenderNumberDuplicateIssue({ senderResourcesData, sendNo: '1544-6859' }),
    {
      applicationId: 'app_submitted_1',
      type: 'submitted',
    },
    'submitted duplicate issue'
  );
  assertMatch(
    getSmsSenderNumberDuplicateIssue({ senderResourcesData, sendNo: '02-1234-5678' }),
    {
      resourceId: 'resource_1',
      type: 'registered',
    },
    'registered duplicate issue'
  );
  assertEqual(
    getSmsSenderNumberDuplicateIssue({
      currentApplicationId: 'app_submitted_1',
      senderResourcesData,
      sendNo: '1544-6859',
    }),
    null,
    'current resubmission application is not self-blocked'
  );
  assertEqual(
    getSmsSenderNumberDuplicateIssue({ senderResourcesData, sendNo: '010-1234-5678' }),
    null,
    'rejected application is not a new-form duplicate'
  );
}

async function checkUiWiring() {
  const componentSource = await readSource('src/components/sender-resources/SmsSenderNumberAdd.jsx');
  const pageSource = await readSource('src/features/console/ConsolePages.jsx');

  assertIncludes(componentSource, 'getSmsSenderNumberDuplicateIssue', 'SMS sender add component uses duplicate helper');
  assertIncludes(componentSource, 'duplicateIssue?.message', 'SMS sender add component renders duplicate issue copy');
  assertIncludes(componentSource, '!duplicateIssue', 'SMS sender add component disables continuation for duplicates');
  assertIncludes(componentSource, '기존 발신번호 신청/등록 내역을 확인 중입니다.', 'SMS sender add component has loading copy');
  assertIncludes(pageSource, 'senderResourcesData={senderResourcesQuery.data}', 'registration page passes sender resources data');
  assertIncludes(pageSource, 'duplicateCheckPending={senderResourcesQuery.isPending}', 'registration page passes duplicate loading state');
}

async function checkServerGuard() {
  const serviceSource = await readSource('src/server/senderResources/service.js');
  const testSource = await readSource('src/server/__tests__/senderResourceApproval.test.js');

  assertIncludes(serviceSource, 'assertSmsSenderNumberNotAlreadyRegistered', 'server has active registered-number guard');
  assertIncludes(serviceSource, 'repository.listUserSenderResources(userId)', 'server guard reads user sender resources');
  assertIncludes(serviceSource, '이미 등록된 발신번호입니다.', 'server guard returns registered duplicate message');
  assertIncludes(testSource, 'rejects SMS applications for already registered active sender numbers', 'server test covers active duplicate');
}

async function readSource(filePath) {
  if (!sourceCache.has(filePath)) {
    sourceCache.set(filePath, await readFile(filePath, 'utf8'));
  }
  return sourceCache.get(filePath);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertMatch(actual, expectedEntries, message) {
  for (const [key, expected] of Object.entries(expectedEntries)) {
    assertEqual(actual?.[key], expected, `${message} (${key})`);
  }
}

function assertIncludes(source, text, message) {
  if (!source.includes(text)) {
    throw new Error(`${message}: missing ${JSON.stringify(text)}`);
  }
}
