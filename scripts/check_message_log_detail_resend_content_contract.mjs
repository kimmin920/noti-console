#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const REQUIRED_FILES = [
  'phases/51-message-log-detail-resend-content-redesign/resend-content-design-contract.md',
  'src/app/logs/[groupId]/page.jsx',
  'src/features/console/routing.js',
  'src/features/console/consoleConfig.js',
  'src/features/console/ConsolePages.jsx',
  'src/features/console/messageLogs/MessageLogGroupDetailPage.jsx',
  'src/features/console/messageLogs/MessageLogGroupDetailSections.jsx',
  'src/server/messageLogs/repository.js',
  'src/server/messageLogs/service.js',
  'src/server/messageLogs/devFixtures.js',
  'src/server/messages/smsBulkSimulationLogRecipientViews.js',
  'src/styles/components.css',
];

const sourceCache = new Map();

await checkRequiredFiles();
await checkPackageScript();
await checkRoutingContract();
await checkListNavigationContract();
await checkDetailPageContract();
await checkFailureRecipientNumberContract();
await checkStyleContract();

console.log('message log detail resend content contract passed');

async function checkRequiredFiles() {
  for (const filePath of REQUIRED_FILES) {
    await readSource(filePath);
  }
}

async function checkPackageScript() {
  const packageJson = JSON.parse(await readSource('package.json'));
  assertEqual(
    packageJson.scripts?.['test:message-log-detail-resend-content-contract'],
    'node scripts/check_message_log_detail_resend_content_contract.mjs',
    'package.json exposes the message-log detail contract script'
  );
}

async function checkRoutingContract() {
  const appRoute = await readSource('src/app/logs/[groupId]/page.jsx');
  const routing = await readSource('src/features/console/routing.js');
  const config = await readSource('src/features/console/consoleConfig.js');
  const consolePages = await readSource('src/features/console/ConsolePages.jsx');

  assertIncludes(appRoute, 'pageId="log-detail"', 'log detail route renders ConsoleRoute with log-detail page id');
  assertIncludes(appRoute, 'pageProps={{ logDetail: { groupId } }}', 'log detail route passes group id page props');
  assertIncludes(routing, "'log-detail': '/logs'", 'routing maps log-detail to logs path');
  assertIncludes(routing, "normalizedPageId === 'log-detail'", 'routing keeps log-detail under logs navigation');
  assertIncludes(config, "'log-detail': { title: '발송 묶음 상세' }", 'console config has log-detail metadata');
  assertIncludes(consolePages, "activePage === 'log-detail'", 'ConsolePages handles log-detail page');
  assertIncludes(consolePages, '<MessageLogGroupDetailPage groupId={logDetail.groupId} />', 'ConsolePages renders the dedicated detail page');
}

async function checkListNavigationContract() {
  const consolePages = await readSource('src/features/console/ConsolePages.jsx');

  assertIncludes(consolePages, 'getMessageLogGroupDetailHref({ filters, group: row, mode })', 'log list row action preserves list filters');
  assertIncludes(consolePages, "return `/logs/${encodeURIComponent(group.id)}?${params.toString()}`", 'log list row action links to group detail route');
  assertNotIncludes(consolePages, 'function MessageLogGroupDetailDrawer', 'legacy message-log detail drawer has been removed');
  assertNotIncludes(consolePages, '<MessageLogGroupDetailDrawer', 'log list no longer renders the detail drawer');
}

async function checkDetailPageContract() {
  const page = await readSource('src/features/console/messageLogs/MessageLogGroupDetailPage.jsx');
  const sections = await readSource('src/features/console/messageLogs/MessageLogGroupDetailSections.jsx');

  assertIncludes(page, 'resend-detail-content message-log-detail-content', 'detail page uses the resend detail content container');
  assertIncludes(page, 'useMessageLogGroupRequestFailuresQuery', 'detail page loads failures through the failure endpoint');
  assertIncludes(page, 'requestLocalId', 'detail page keeps active request in URL state');
  assertIncludes(page, 'recipientSeq', 'detail page keeps selected failed recipient in URL state');
  assertIncludes(sections, 'message-log-result-section', 'detail page has a first-class result section');
  assertIncludes(sections, '수신번호', 'failure table exposes the recipient number column');
  assertIncludes(sections, '실패 사유', 'failure table exposes the failure reason column');
  assertIncludes(sections, '결과 코드', 'failure table exposes the raw result code column');
  assertIncludes(sections, '저장된 결과 스냅샷 기준', 'result section explains the data basis succinctly');
  assertNotIncludes(sections, 'detail?.contentPreview', 'selected recipient detail must not show group preview text as message content');
  assertNotIncludes(page, 'useMessageLogGroupRequestRecipientsQuery', 'detail page must not fetch full recipient pages for the failure table');
  assertNotIncludes(page, 'DrawerContent', 'detail page must not be drawer-based');
  assertNotIncludes(sections, 'message-log-request-rail', 'detail page must not use the rejected request rail layout');
}

async function checkFailureRecipientNumberContract() {
  const repository = await readSource('src/server/messageLogs/repository.js');
  const service = await readSource('src/server/messageLogs/service.js');
  const devFixtures = await readSource('src/server/messageLogs/devFixtures.js');
  const simulation = await readSource('src/server/messages/smsBulkSimulationLogRecipientViews.js');

  assertIncludes(repository, 'failedRecipientNos', 'result snapshot stores failed recipient numbers when available');
  assertIncludes(repository, 'recipientNo: normalized.failedRecipientNos?.[String(index + 1)] ?? null', 'failed snapshot entries expose failed recipient numbers');
  assertNotIncludes(repository, 'recipientNo: normalized.recipientNos?.[index] ?? null', 'failed snapshot entries must not read obsolete recipientNos arrays');
  assertIncludes(service, 'recipientNo: failure.recipientNo ?? null', 'ledger failure DTO includes recipient number');
  assertIncludes(service, 'listMessageLogDemoCaseRequestFailures', 'demo failure endpoint is wired through message log service');
  assertIncludes(service, 'getMessageLogDemoCaseRequestRecipientDetail', 'demo local recipient detail is wired through message log service');
  assertIncludes(devFixtures, 'listMessageLogDemoCaseRequestFailures', 'demo fixtures expose request failure rows');
  assertIncludes(devFixtures, 'getDemoRecipientNo(sequence)', 'demo fixture failures include raw recipient numbers');
  assertIncludes(devFixtures, 'getDemoMessageContent(definition)', 'demo recipient detail uses a real sample message body instead of the case title');
  assertIncludes(simulation, 'recipientNo: getSimulationRecipientNo', 'SMS simulation failures include raw recipient numbers');
}

async function checkStyleContract() {
  const css = await readSource('src/styles/components.css');

  assertIncludes(css, '.message-log-detail-content', 'message log detail content styles exist');
  assertIncludes(css, '.message-log-detail-summary', 'message log summary follows detail summary layout');
  assertIncludes(css, '.message-log-detail-failure-table', 'failure table has dedicated table styling');
  assertIncludes(css, '.message-log-selected-recipient', 'selected failed recipient panel is styled inline');
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

function assertNotIncludes(source, text, message) {
  if (source.includes(text)) {
    throw new Error(`${message}: found ${JSON.stringify(text)}`);
  }
}
