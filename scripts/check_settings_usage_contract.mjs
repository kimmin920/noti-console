#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';

const PHASE = '42-settings-usage-limit-requests';
const REQUIRED_FILES = [
  `phases/${PHASE}/current-state-audit.md`,
  `phases/${PHASE}/settings-usage-contract.md`,
  'src/features/console/settings/UsageSettingsContent.jsx',
  'src/features/console/settings/AdminLimitIncreaseRequestsPanel.jsx',
  'src/features/console/settings/limitIncreaseRequestLabels.js',
  'src/features/console/messageSend/queryKeys.js',
  'src/features/console/messageSend/queries.js',
  'src/features/console/messageSend/mutations.js',
  'src/app/api/limit-increase-requests/route.js',
  'src/app/api/admin/limit-increase-requests/route.js',
  'src/app/api/admin/limit-increase-requests/[id]/approve/route.js',
  'src/app/api/admin/limit-increase-requests/[id]/reject/route.js',
  'src/server/limitIncreaseRequests/service.js',
  'src/server/limitIncreaseRequests/repository.js',
  'src/server/__tests__/limitIncreaseRequests.test.js',
  'src/db/schema.js',
];

const sourceCache = new Map();

await checkRequiredFiles();
await checkPackageScript();
await checkUsageCopyAndLimits();
await checkFrontendWiring();
await checkBackendWiring();
await checkSchemaAndMigration();

console.log('settings usage contract passed');

async function checkRequiredFiles() {
  for (const filePath of REQUIRED_FILES) {
    await readSource(filePath);
  }
}

async function checkPackageScript() {
  const packageJson = JSON.parse(await readSource('package.json'));
  assertEqual(
    packageJson.scripts?.['test:settings-usage-contract'],
    'node scripts/check_settings_usage_contract.mjs',
    'package.json exposes the settings usage contract script'
  );
}

async function checkUsageCopyAndLimits() {
  const usageSource = await readSource('src/features/console/settings/UsageSettingsContent.jsx');
  const consoleSource = await readSource('src/features/console/ConsolePages.jsx');

  assertNotIncludes(usageSource, 'Resend API', 'usage tab must not mention Resend API');
  assertNotIncludes(usageSource, 'SMTP 인터페이스', 'usage tab must not mention SMTP interface');
  assertNotIncludes(usageSource, '이메일을 앱에 연동', 'usage tab must not keep email integration copy');
  assertNotIncludes(usageSource, '트랜잭션', 'usage tab must not keep transaction title');
  assertNotIncludes(consoleSource, 'copy="Resend API 또는 SMTP 인터페이스를 사용해 이메일을 앱에 연동하세요."', 'old usage placeholder is removed');

  assertIncludes(usageSource, '문자는 사용자 기준 월 단위 한도로 관리합니다.', 'SMS monthly limit copy exists');
  assertIncludes(usageSource, '월 단위', 'SMS monthly scope is represented');
  assertIncludes(usageSource, '카카오 비즈채널마다 알림톡과 브랜드메시지 각각 일 1,000건', 'Kakao per-channel daily copy exists');
  assertIncludes(usageSource, '일 1,000건', 'Kakao daily 1000 limit is represented');
  assertIncludes(usageSource, 'senderResourceId', 'Kakao request can target a sender resource channel');
  assertNotIncludes(usageSource, '업그레이드', 'usage limit actions use request copy instead of upgrade copy');
  assertIncludes(usageSource, "openLimitRequestDialog('sms')", 'SMS limit action opens dialog with SMS selected');
  assertIncludes(usageSource, "openLimitRequestDialog('kakao')", 'Kakao limit action opens dialog with Kakao selected');
}

async function checkFrontendWiring() {
  const usageSource = await readSource('src/features/console/settings/UsageSettingsContent.jsx');
  const queryKeys = await readSource('src/features/console/messageSend/queryKeys.js');
  const queries = await readSource('src/features/console/messageSend/queries.js');
  const mutations = await readSource('src/features/console/messageSend/mutations.js');
  const adminPanel = await readSource('src/features/console/settings/AdminLimitIncreaseRequestsPanel.jsx');
  const adminTabs = await readSource('src/features/console/settings/AdminRequestTabs.jsx');
  const consoleSource = await readSource('src/features/console/ConsolePages.jsx');

  assertIncludes(usageSource, 'useLimitIncreaseRequestsQuery()', 'usage page reads user limit requests');
  assertIncludes(usageSource, 'useLimitIncreaseRequestCreateMutation()', 'usage page submits limit requests');
  assertIncludes(usageSource, 'rejectReason', 'usage page renders rejection reason');
  assertIncludes(usageSource, 'useMetricsSummaryQuery', 'usage page reads existing quota summary');

  assertIncludes(queryKeys, 'limitIncreaseRequests', 'query keys include user limit requests');
  assertIncludes(queryKeys, 'adminLimitIncreaseRequestsRoot', 'query keys include admin limit requests root');
  assertIncludes(queries, 'export function useLimitIncreaseRequestsQuery', 'user limit request query exists');
  assertIncludes(queries, "relayGet('/api/limit-increase-requests')", 'user query calls request route');
  assertIncludes(queries, 'export function useAdminLimitIncreaseRequestsQuery', 'admin limit request query exists');
  assertIncludes(mutations, 'export function useLimitIncreaseRequestCreateMutation', 'user create mutation exists');
  assertIncludes(mutations, "relayPost('/api/limit-increase-requests', payload)", 'user create mutation posts to route');
  assertIncludes(mutations, 'export function useAdminLimitIncreaseRequestApproveMutation', 'admin approve mutation exists');
  assertIncludes(mutations, 'export function useAdminLimitIncreaseRequestRejectMutation', 'admin reject mutation exists');
  assertIncludes(adminPanel, 'useAdminLimitIncreaseRequestsQuery', 'admin panel reads limit requests');
  assertIncludes(adminPanel, 'useAdminLimitIncreaseRequestApproveMutation', 'admin panel approves limit requests');
  assertIncludes(adminPanel, 'useAdminLimitIncreaseRequestRejectMutation', 'admin panel rejects limit requests');
  assertIncludes(adminPanel, 'rejectReason', 'admin panel collects rejection reason');
  assertIncludes(adminTabs, '한도 상향 신청', 'admin tabs include limit requests');
  assertIncludes(adminTabs, '발신번호 신청', 'admin tabs include sender number applications');
  assertIncludes(consoleSource, 'activeAdminTab', 'admin page tracks the active request tab');
  assertIncludes(consoleSource, 'ADMIN_REQUEST_TAB_VALUES.LIMIT_REQUESTS', 'admin page renders the limit request tab panel');
  assertIncludes(consoleSource, 'ADMIN_REQUEST_TAB_VALUES.SENDER_APPLICATIONS', 'admin page renders the sender application tab panel');
}

async function checkBackendWiring() {
  const service = await readSource('src/server/limitIncreaseRequests/service.js');
  const repository = await readSource('src/server/limitIncreaseRequests/repository.js');
  const userRoute = await readSource('src/app/api/limit-increase-requests/route.js');
  const adminRoute = await readSource('src/app/api/admin/limit-increase-requests/route.js');
  const approveRoute = await readSource('src/app/api/admin/limit-increase-requests/[id]/approve/route.js');
  const rejectRoute = await readSource('src/app/api/admin/limit-increase-requests/[id]/reject/route.js');
  const tests = await readSource('src/server/__tests__/limitIncreaseRequests.test.js');

  assertIncludes(userRoute, 'export async function GET(request)', 'user request route exposes GET');
  assertIncludes(userRoute, 'export async function POST(request)', 'user request route exposes POST');
  assertIncludes(userRoute, 'createDefaultLimitIncreaseRequestService()', 'user route uses service');
  assertIncludes(adminRoute, 'listAdminRequests', 'admin route lists requests');
  assertIncludes(approveRoute, 'approveRequest', 'admin approve route exists');
  assertIncludes(rejectRoute, 'rejectRequest', 'admin reject route exists');

  assertIncludes(service, 'async createRequest({ actorUserId, payload = {} })', 'service creates user requests');
  assertIncludes(service, 'async listAdminRequests({ actorUserId, query = {} })', 'service lists admin requests');
  assertIncludes(service, 'async approveRequest({ actorUserId, requestId, payload = {} })', 'service approves requests');
  assertIncludes(service, 'async rejectRequest({ actorUserId, requestId, payload = {} })', 'service rejects requests');
  assertIncludes(service, 'normalizeRequiredString(payload.rejectReason', 'reject reason is required');
  assertIncludes(service, 'requireOperator(repository, actorUserId)', 'admin actions require operator access');
  assertIncludes(service, 'KAKAO_DAILY_DEFAULT_LIMIT', 'Kakao daily default limit is server-owned');
  assertNotMatch(service, /recipient|messageBody|providerResponseBody|providerRequestBody/, 'service does not store prohibited message/provider payload fields');

  assertIncludes(repository, 'limitIncreaseRequests', 'repository uses limit increase request table');
  assertIncludes(repository, 'createAuditLog', 'repository can audit operator/user actions');
  assertIncludes(tests, 'creates SMS monthly limit requests', 'server test covers SMS create');
  assertIncludes(tests, 'creates Kakao channel daily limit requests', 'server test covers Kakao create');
  assertIncludes(tests, 'requires a rejection reason', 'server test covers rejection reason');
}

async function checkSchemaAndMigration() {
  const schema = await readSource('src/db/schema.js');
  const migrations = await readdir('drizzle');

  assertIncludes(schema, 'export const limitIncreaseRequestStatusEnum', 'schema declares request status enum');
  assertIncludes(schema, 'export const limitIncreaseRequestScopeEnum', 'schema declares request scope enum');
  assertIncludes(schema, 'export const limitIncreaseRequests = pgTable', 'schema declares request table');
  assertIncludes(schema, 'rejectReason: varchar', 'schema stores reject reason separately');
  assertIncludes(schema, 'requestedLimit: integer', 'schema stores requested limit');
  assertIncludes(schema, 'limitIncreaseRequestsRelations', 'schema declares request relations');

  const migrationFiles = migrations.filter((fileName) => fileName.endsWith('.sql'));
  const migrationContents = await Promise.all(
    migrationFiles.map(async (fileName) => readFile(`drizzle/${fileName}`, 'utf8'))
  );
  assert(
    migrationContents.some((content) => content.includes('CREATE TABLE "limit_increase_requests"')),
    'migration creates limit_increase_requests table'
  );
}

async function readSource(filePath) {
  if (!sourceCache.has(filePath)) {
    sourceCache.set(filePath, await readFile(filePath, 'utf8'));
  }
  return sourceCache.get(filePath);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
