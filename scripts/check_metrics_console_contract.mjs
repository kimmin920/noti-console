#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

import { buildMetricsSummary } from '../src/server/metrics/summary.js';

const PHASE = '46-metrics-console-hardening';
const REQUIRED_FILES = [
  `phases/${PHASE}/current-state-audit.md`,
  `phases/${PHASE}/metrics-console-contract.md`,
  'src/app/(console)/metrics/page.jsx',
  'src/app/api/metrics/summary/route.js',
  'src/features/console/consoleConfig.js',
  'src/features/console/routing.js',
  'src/features/console/metrics/MetricsPage.jsx',
  'src/features/console/metrics/MetricsTrendChart.jsx',
  'src/features/console/metrics/api.js',
  'src/features/console/metrics/metricsFormatters.js',
  'src/features/console/metrics/queries.js',
  'src/server/metrics/repository.js',
  'src/server/metrics/service.js',
  'src/server/metrics/summary.js',
  'src/server/messageLogs/service.js',
  'src/server/nhn/kakaoBizmessageWebhookReceiver.js',
  'src/server/__tests__/kakaoBizmessageWebhookReceiver.test.js',
  'scripts/check_message_result_status_contract.mjs',
];

const sourceCache = new Map();

await checkRequiredFiles();
await checkPackageScript();
await checkRouteAndNavigation();
await checkFrontendContract();
await checkServerContract();
checkAggregationContract();

console.log('metrics console contract passed');

async function checkRequiredFiles() {
  for (const filePath of REQUIRED_FILES) {
    await readSource(filePath);
  }
}

async function checkPackageScript() {
  const packageJson = JSON.parse(await readSource('package.json'));
  assertEqual(
    packageJson.scripts?.['test:metrics-console-contract'],
    'node scripts/check_metrics_console_contract.mjs',
    'package.json exposes the metrics console contract script'
  );
}

async function checkRouteAndNavigation() {
  const route = await readSource('src/app/(console)/metrics/page.jsx');
  const apiRoute = await readSource('src/app/api/metrics/summary/route.js');
  const consoleConfig = await readSource('src/features/console/consoleConfig.js');
  const routing = await readSource('src/features/console/routing.js');

  assertIncludes(route, 'pageId="metrics"', 'metrics route renders the console metrics page');
  assertIncludes(apiRoute, 'createDefaultMetricsService', 'metrics API uses the default service');
  assertIncludes(apiRoute, "export const runtime = 'nodejs'", 'metrics summary route uses node runtime');
  assertIncludes(consoleConfig, "{ id: 'metrics', label: '메트릭' }", 'sidebar navigation exposes metrics');
  assertIncludes(consoleConfig, "metrics: { title: '메트릭' }", 'metrics metadata remains available');
  assertIncludes(routing, "metrics: '/metrics'", 'routing maps metrics page id to /metrics');
  assertIncludes(routing, "'metrics'", 'routing accepts metrics as a console page id');
}

async function checkFrontendContract() {
  const page = await readSource('src/features/console/metrics/MetricsPage.jsx');
  const chart = await readSource('src/features/console/metrics/MetricsTrendChart.jsx');
  const formatters = await readSource('src/features/console/metrics/metricsFormatters.js');
  const queries = await readSource('src/features/console/metrics/queries.js');
  const api = await readSource('src/features/console/metrics/api.js');
  const styles = await readSource('src/styles/components.css');

  assertIncludes(queries, 'useQuery', 'metrics reads summary through TanStack Query');
  assertIncludes(api, "const METRICS_SUMMARY_PATH = '/api/metrics/summary'", 'metrics client uses summary endpoint');

  for (const text of [
    '메트릭 기간',
    '메트릭 채널',
    '메트릭 출처',
    '발송 대상',
    '발송 성공률',
    '실패',
    '결과 대기',
    '확인 필요',
    '일자별 발송 결과',
    '확인 필요 항목',
    '채널별 발송 결과',
    '메트릭을 불러오지 못했습니다.',
    '채널별 결과를 확인하는 중입니다.',
    '선택한 기간에 채널별 발송 데이터가 없습니다.',
    '성공/실패는 NHN resultCode 기준',
    '결과 대기는 성공으로 계산하지 않음',
    'NHN 최종 resultCode가 아직 도착하지 않은 대상입니다.',
    '카카오 채널별 일 1,000건 기준',
    '사용량 설정',
  ]) {
    assertIncludes(page, text, `metrics page includes ${text}`);
  }

  for (const text of [
    'SMS',
    'LMS',
    'MMS',
    '알림톡',
    '브랜드 메시지',
    '최근 7일',
    '최근 15일',
    '최근 30일',
    '수동 발송',
    '자동화',
  ]) {
    assertIncludes(formatters, text, `metrics formatters include ${text}`);
  }

  assertIncludes(page, 'pendingCount', 'metrics page renders pending counts');
  assertIncludes(page, 'MetricsPendingNotice', 'metrics exposes pending counts as an auxiliary notice');
  assertIncludes(page, 'Number(pendingCount ?? 0) <= 0', 'pending notice is hidden when no pending results exist');
  assertNotMatch(page, /label="집계 중"|결과 코드 대기 대상/, 'pending is not rendered as a primary summary card');
  assertIncludes(page, 'hasBlockingError', 'metrics avoids zero-value dashboards on blocking API errors');
  assertIncludes(chart, '결과 대기', 'metrics chart exposes pending buckets accessibly');
  assertIncludes(chart, 'BarChart', 'metrics chart uses the shadcn/Recharts bar chart pattern');
  assertIncludes(chart, 'ChartContainer', 'metrics chart uses the shadcn chart container primitive');
  assertIncludes(chart, 'ChartTooltipContent', 'metrics chart exposes Recharts tooltip content');
  assertIncludes(chart, 'ChartLegendContent', 'metrics chart exposes a Recharts legend');
  assertIncludes(chart, 'getTrendXAxisTicks', 'metrics chart uses deterministic x-axis date ticks');
  assertIncludes(chart, 'getSteppedLabels(chartData, 2)', 'metrics chart shows 15-day labels at a predictable cadence');
  assertIncludes(chart, 'getSteppedLabels(chartData, 7, { includeLast: false })', 'metrics chart shows 30-day labels at a predictable weekly cadence');
  assertIncludes(chart, '`${year}. ${month}. ${day}.`', 'metrics tooltip title includes the full day');
  assertIncludes(chart, '취소', 'metrics chart keeps canceled recipients visible in the daily result');
  assertIncludes(chart, '첫 발송 만들기', 'metrics chart empty state offers a next action');
  assertIncludes(styles, 'grid-template-columns: repeat(4, minmax(0, 1fr))', 'summary grid keeps pending out of primary cards');
  assertIncludes(styles, 'grid-template-columns: repeat(4, minmax(0, 1fr))', 'mobile channel rows include pending count');
  assertIncludes(styles, '.chart-container', 'shadcn chart container is styled');
  assertIncludes(styles, '.chart-legend-content', 'chart legend is styled');
  assertIncludes(styles, '.chart-tooltip-content', 'chart tooltip is styled');
  assertIncludes(styles, '.metrics-trend-chart-container', 'metrics trend chart container has stable height');
  assertIncludes(styles, '.metrics-basis-strip', 'metrics basis strip is styled');
  assertIncludes(styles, '.metrics-pending-notice', 'metrics pending notice is styled');
}

async function checkServerContract() {
  const service = await readSource('src/server/metrics/service.js');
  const repository = await readSource('src/server/metrics/repository.js');
  const summary = await readSource('src/server/metrics/summary.js');
  const kakaoWebhook = await readSource('src/server/nhn/kakaoBizmessageWebhookReceiver.js');
  const kakaoWebhookTest = await readSource('src/server/__tests__/kakaoBizmessageWebhookReceiver.test.js');
  const messageResultContract = await readSource('scripts/check_message_result_status_contract.mjs');

  assertIncludes(service, 'normalizeMetricsQuery', 'metrics service normalizes query filters');
  assertIncludes(service, 'buildMetricsSummary', 'metrics service delegates aggregation to buildMetricsSummary');
  assertIncludes(repository, 'messageSendGroups.successCount', 'metrics repository reads ledger success counts');
  assertIncludes(repository, 'messageSendGroups.failedCount', 'metrics repository reads ledger failure counts');
  assertIncludes(repository, 'messageSendGroups.pendingCount', 'metrics repository reads ledger pending counts');
  assertIncludes(repository, 'messageSendGroups.resultState', 'metrics repository reads ledger result state');
  assertIncludes(summary, 'STATUS_ATTENTION_RESULT_STATES', 'metrics summary surfaces stale/error result attention');
  assertIncludes(kakaoWebhook, 'mapKakaoHookSnapshotState', 'kakao webhook has an explicit snapshot state mapper');
  assertIncludes(kakaoWebhook, "if (resultState === 'success') return 'S'", 'kakao webhook maps success state');
  assertIncludes(kakaoWebhook, "if (resultState === 'failed') return 'F'", 'kakao webhook maps failure state');
  assertIncludes(kakaoWebhook, 'return null', 'kakao webhook ignores pending result states');
  assertIncludes(kakaoWebhookTest, "resultCode: '0'", 'kakao webhook tests neutral result code');
  assertIncludes(kakaoWebhookTest, 'without treating neutral codes as failures', 'kakao webhook test covers neutral-code failure guard');
  assertIncludes(messageResultContract, 'metrics does not invent success from pending ledger counts', 'phase 39 contract protects metrics semantics');
  assertNotMatch(summary, /\bCOMPLETED\b|\bcompleted\b|\bisSmsSuccessResult\b|\bisKakaoSuccessResult\b/, 'metrics summary does not classify raw provider statuses');
}

function checkAggregationContract() {
  const generatedAt = new Date('2026-06-28T03:00:00.000Z');
  const summary = buildMetricsSummary({
    automationDeliveries: [
      { reasonCode: 'missing_template', status: 'unsent' },
      { reasonCode: null, status: 'sent' },
    ],
    bulkRuns: [
      { acceptedCount: 10, failedCount: 1, rejectedCount: 0, status: 'blocked', totalRecipients: 11, unknownCount: 0 },
    ],
    filters: {
      channel: 'all',
      generatedAt,
      granularity: 'day',
      period: {
        from: new Date('2026-06-28T00:00:00.000Z'),
        range: 'custom',
        to: generatedAt,
      },
      source: 'all',
    },
    messageSendGroups: [
      createGroup({ channel: 'sms', failedCount: 1, pendingCount: 2, sourceType: 'manual', successCount: 3, totalRecipientCount: 6 }),
      createGroup({ channel: 'alimtalk', failedCount: 1, pendingCount: 0, sourceType: 'automation', successCount: 4, totalRecipientCount: 5 }),
      createGroup({ channel: 'brand-message', failedCount: 1, pendingCount: 3, resultState: 'stale', sourceType: 'manual', successCount: 0, totalRecipientCount: 4 }),
    ],
    quotaBuckets: [
      { channel: 'sms', consumedCount: 920, quotaLimit: 1000, reservedCount: 20 },
    ],
  });

  assertMatch(summary.totals, {
    failedCount: 3,
    pendingCount: 5,
    recipientCount: 15,
    sendGroupCount: 3,
    successCount: 7,
  }, 'summary totals preserve ledger counts');
  assertNear(summary.totals.successRate, 7 / 15, 'summary success rate uses total recipients as denominator');
  assertIncludes(summary.alerts.map((alert) => alert.code).join(','), 'result_sync_attention', 'stale result alert is present');
  assertIncludes(summary.alerts.map((alert) => alert.code).join(','), 'automation_attention', 'automation attention alert is present');
  assertIncludes(summary.alerts.map((alert) => alert.code).join(','), 'sms_bulk_attention', 'bulk attention alert is present');
  assertIncludes(summary.alerts.map((alert) => alert.code).join(','), 'sms_quota_low', 'quota low alert is present');

  const sms = summary.channelBreakdown.find((row) => row.channel === 'sms');
  const alimtalk = summary.channelBreakdown.find((row) => row.channel === 'alimtalk');
  const brand = summary.channelBreakdown.find((row) => row.channel === 'brand-message');

  assertMatch(sms, { failedCount: 1, pendingCount: 2, recipientCount: 6, successCount: 3 }, 'sms breakdown preserves pending');
  assertMatch(alimtalk, { failedCount: 1, pendingCount: 0, recipientCount: 5, successCount: 4 }, 'alimtalk breakdown is present');
  assertMatch(brand, { failedCount: 1, pendingCount: 3, recipientCount: 4, successCount: 0 }, 'brand message breakdown is present');
  assertMatch(summary.timeSeries[0], { failedCount: 3, pendingCount: 5, recipientCount: 15, successCount: 7 }, 'time series preserves pending counts');
}

function createGroup(values = {}) {
  return {
    canceledCount: 0,
    channel: 'sms',
    createdAt: '2026-06-28T01:00:00.000Z',
    failedCount: 0,
    pendingCount: 0,
    resultState: 'synced',
    scheduledAt: null,
    sourceType: 'manual',
    successCount: 0,
    totalRecipientCount: 0,
    ...values,
  };
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

function assertIncludes(source, text, message) {
  if (!source.includes(text)) {
    throw new Error(`${message}: missing ${JSON.stringify(text)}`);
  }
}

function assertMatch(actual, expectedEntries, message) {
  if (!actual) {
    throw new Error(`${message}: missing object`);
  }
  for (const [key, expected] of Object.entries(expectedEntries)) {
    assertEqual(actual[key], expected, `${message} (${key})`);
  }
}

function assertNear(actual, expected, message) {
  if (Math.abs(Number(actual) - expected) > 0.000001) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

function assertNotMatch(source, pattern, message) {
  if (pattern.test(source)) {
    throw new Error(`${message}: matched ${pattern}`);
  }
}
