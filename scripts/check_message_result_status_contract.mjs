#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

import {
  getKakaoResultState,
  isKakaoFailureResult,
  isKakaoSuccessResult,
} from '../src/features/console/messageResults/kakaoResultCodes.js';
import {
  getSmsResultState,
  isSmsFailureResult,
  isSmsSuccessResult,
} from '../src/features/console/messageResults/smsResultCodes.js';
import {
  getMessageLogResultLabel,
  getMessageLogStatus,
} from '../src/features/console/messageLogs/selectors.js';
import { getMessageDeliverySummary } from '../src/features/console/messageSend/statusSummary.js';
import { buildMetricsSummary } from '../src/server/metrics/summary.js';

const REQUIRED_FILES = [
  'phases/39-message-result-status-hardening/current-state-audit.md',
  'phases/39-message-result-status-hardening/message-result-status-contract.md',
  'src/features/console/messageResults/smsResultCodes.js',
  'src/features/console/messageResults/kakaoResultCodes.js',
  'src/features/console/messageLogs/selectors.js',
  'src/features/console/messageSend/statusSummary.js',
  'src/server/messageLogs/service.js',
  'src/server/messageLogs/repository.js',
  'src/server/metrics/summary.js',
];

const sourceCache = new Map();

await checkRequiredFiles();
await checkPackageScript();
checkSmsResultContract();
checkKakaoResultContract();
checkLogSelectorContract();
checkSendSummaryContract();
checkMetricsContract();
await checkSourceGuardrails();

console.log('message result status contract passed');

async function checkRequiredFiles() {
  for (const filePath of REQUIRED_FILES) {
    await readSource(filePath);
  }
}

async function checkPackageScript() {
  const packageJson = JSON.parse(await readSource('package.json'));
  assertEqual(
    packageJson.scripts?.['test:message-result-status-contract'],
    'node scripts/check_message_result_status_contract.mjs',
    'package.json exposes the message result status contract script'
  );
}

function checkSmsResultContract() {
  assertEqual(getSmsResultState({ resultCode: '1000', status: 'FAILED' }), 'success', 'SMS success code wins');
  assertEqual(getSmsResultState({ resultCode: '3003', status: 'COMPLETED' }), 'failed', 'SMS failure code wins');
  assertEqual(getSmsResultState({ resultCode: '0', status: 'COMPLETED' }), 'pending', 'SMS neutral code is pending');
  assertEqual(getSmsResultState({ resultCode: null, status: 'COMPLETED' }), 'pending', 'SMS completed without result code is pending');
  assertEqual(getSmsResultState({ resultCode: null, status: '3' }), 'pending', 'SMS status 3 without result code is pending');
  assertEqual(getSmsResultState({ resultCode: null, status: 'FAILED_AD' }), 'failed', 'SMS explicit failure status is failed');
  assertEqual(isSmsSuccessResult({ resultCode: null, status: 'COMPLETED' }), false, 'SMS completed status is not success');
  assertEqual(isSmsFailureResult({ resultCode: '3003', status: 'COMPLETED' }), true, 'SMS failed code is failure');
}

function checkKakaoResultContract() {
  assertEqual(getKakaoResultState({ resultCode: 'MRC01', status: 'FAILED' }), 'success', 'Kakao MRC01 wins');
  assertEqual(getKakaoResultState({ resultCode: '1000', status: 'COMPLETED' }), 'success', 'Kakao 1000 alias wins');
  assertEqual(getKakaoResultState({ resultCode: '1030', status: 'COMPLETED' }), 'failed', 'Kakao failure code wins');
  assertEqual(getKakaoResultState({ resultCode: '0', status: 'COMPLETED' }), 'pending', 'Kakao neutral code is pending');
  assertEqual(getKakaoResultState({ resultCode: null, status: 'COMPLETED' }), 'pending', 'Kakao completed without result code is pending');
  assertEqual(getKakaoResultState({ resultCode: null, status: 'FAILED' }), 'failed', 'Kakao explicit failure status is failed');
  assertEqual(isKakaoSuccessResult({ resultCode: null, status: 'COMPLETED' }), false, 'Kakao completed status is not success');
  assertEqual(isKakaoFailureResult({ resultCode: '1030', status: 'COMPLETED' }), true, 'Kakao failed code is failure');
}

function checkLogSelectorContract() {
  const smsLog = { channel: 'sms', resultCode: null, status: 'COMPLETED' };
  const kakaoLog = { channel: 'alimtalk', resultCode: null, status: 'COMPLETED' };

  assertMatch(getMessageLogStatus(smsLog), { label: '처리 중', state: 'pending' }, 'SMS log completed/no-code is pending');
  assertMatch(getMessageLogStatus(kakaoLog), { label: '처리 중', state: 'pending' }, 'Kakao log completed/no-code is pending');
  assertEqual(getMessageLogResultLabel(smsLog), '-', 'SMS log completed/no-code has no success label');
  assertEqual(getMessageLogResultLabel(kakaoLog), '-', 'Kakao log completed/no-code has no success label');
}

function checkSendSummaryContract() {
  assertEqual(
    getMessageDeliverySummary('SMS', [{ channel: 'sms', resultCode: null, status: 'COMPLETED' }]).text,
    'SMS 발송 결과: 처리 중 1명',
    'SMS completed/no-code summary remains pending'
  );
  assertEqual(
    getMessageDeliverySummary('알림톡', [{ channel: 'alimtalk', resultCode: null, status: 'COMPLETED' }]).text,
    '알림톡 발송 결과: 처리 중 1명',
    'Kakao completed/no-code summary remains pending'
  );
}

function checkMetricsContract() {
  const generatedAt = new Date('2026-06-15T00:00:00.000Z');
  const summary = buildMetricsSummary({
    automationDeliveries: [],
    bulkRuns: [],
    filters: {
      channel: 'all',
      generatedAt,
      granularity: 'day',
      period: {
        from: new Date('2026-06-15T00:00:00.000Z'),
        granularity: 'day',
        range: 'custom',
        to: new Date('2026-06-15T23:59:59.999Z'),
      },
      source: 'all',
    },
    messageSendGroups: [
      {
        canceledCount: 0,
        channel: 'sms',
        createdAt: '2026-06-15T01:00:00.000Z',
        failedCount: 0,
        pendingCount: 1,
        resultState: 'not_synced',
        sourceType: 'manual',
        successCount: 0,
        totalRecipientCount: 1,
      },
    ],
    quotaBuckets: [],
  });

  assertEqual(summary.totals.successCount, 0, 'metrics does not invent success from pending ledger counts');
  assertEqual(summary.totals.pendingCount, 1, 'metrics preserves pending ledger counts');
  assertEqual(summary.totals.successRate, 0, 'metrics success rate remains zero without success count');
}

async function checkSourceGuardrails() {
  const smsSource = await readSource('src/features/console/messageResults/smsResultCodes.js');
  const kakaoSource = await readSource('src/features/console/messageResults/kakaoResultCodes.js');
  const metricsSource = await readSource('src/server/metrics/summary.js');

  assertNotIncludes(smsSource, 'SMS_SUCCESS_STATUSES', 'SMS helper must not keep success status fallback');
  assertNotIncludes(kakaoSource, "normalizedStatus === 'COMPLETED') return 'success'", 'Kakao helper must not keep completed status fallback');
  assertNotMatch(metricsSource, /\bCOMPLETED\b|\bisSmsSuccessResult\b|\bisKakaoSuccessResult\b/, 'metrics must not classify raw provider statuses');
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

function assertNotIncludes(source, text, message) {
  if (source.includes(text)) {
    throw new Error(`${message}: found ${JSON.stringify(text)}`);
  }
}

function assertNotMatch(source, pattern, message) {
  if (pattern.test(source)) {
    throw new Error(`${message}: matched ${pattern}`);
  }
}
