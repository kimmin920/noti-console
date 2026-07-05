#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const PHASE = '43-console-nav-pruning';
const REQUIRED_FILES = [
  `phases/${PHASE}/current-state-audit.md`,
  `phases/${PHASE}/console-nav-pruning-contract.md`,
  'src/features/console/consoleConfig.js',
  'src/features/console/routing.js',
  'src/features/console/ConsoleShells.jsx',
  'src/features/console/ConsolePages.jsx',
  'src/features/console/tabQuery.js',
  'src/app/domains/page.jsx',
  'src/app/domains/add/page.jsx',
  'src/app/domain-detail/page.jsx',
  'src/app/api-keys/page.jsx',
  'src/app/webhooks/page.jsx',
  'src/app/docs/page.jsx',
  'src/app/page.jsx',
];

const REMOVED_NAV_TEXT = ['도메인', 'API 키', '웹훅'];
const REMOVED_ROUTE_IDS = ['domains', 'domains-add', 'api-keys', 'webhooks'];
const REMOVED_SETTINGS_TABS = ['팀', 'SMTP', '수신거부 페이지', '문서'];
const REMOVED_SETTINGS_QUERY_VALUES = ['team', 'smtp', 'unsubscribe'];
const REDIRECT_ROUTES = [
  'src/app/domains/page.jsx',
  'src/app/domains/add/page.jsx',
  'src/app/domain-detail/page.jsx',
  'src/app/api-keys/page.jsx',
  'src/app/webhooks/page.jsx',
];

const sourceCache = new Map();

await checkRequiredFiles();
await checkPackageScript();
await checkNavConfig();
await checkRouting();
await checkSidebarShell();
await checkSettingsTabs();
await checkConsolePages();
await checkDirectRoutes();
await checkPreservedRoutes();

console.log('console nav pruning contract passed');

async function checkRequiredFiles() {
  for (const filePath of REQUIRED_FILES) {
    await readSource(filePath);
  }
}

async function checkPackageScript() {
  const packageJson = JSON.parse(await readSource('package.json'));
  assertEqual(
    packageJson.scripts?.['test:console-nav-pruning-contract'],
    'node scripts/check_console_nav_pruning_contract.mjs',
    'package.json exposes the console nav pruning contract script'
  );
}

async function checkNavConfig() {
  const source = await readSource('src/features/console/consoleConfig.js');

  for (const label of REMOVED_NAV_TEXT) {
    assertNotIncludes(source, label, `console config must not expose removed nav label ${label}`);
  }

  for (const id of REMOVED_ROUTE_IDS) {
    assertNotIncludes(source, `{ id: '${id}'`, `console navItems must not include ${id}`);
    assertNotIncludes(source, `${id}: {`, `console pageMeta must not keep dummy metadata for ${id}`);
  }

  assertIncludes(source, "{ id: 'admin', label: '관리', adminOnly: true }", 'admin nav remains operator-gated');
  assertIncludes(source, "docs: {", 'docs page metadata remains available');
}

async function checkRouting() {
  const source = await readSource('src/features/console/routing.js');

  for (const id of REMOVED_ROUTE_IDS) {
    assertNotIncludes(source, `'${id}'`, `routing must not normalize removed page id ${id}`);
  }

  assertNotIncludes(source, "startsWith('domains-')", 'domain subroute navigation grouping is removed');
  assertIncludes(source, "admin: '/admin/sender-resource-applications'", 'admin route remains available');
  assertIncludes(source, "docs: '/docs'", 'docs route remains available');
}

async function checkSidebarShell() {
  const source = await readSource('src/features/console/ConsoleShells.jsx');

  assertNotIncludes(source, 'workspace-switcher', 'sidebar workspace switcher is removed');
  assertNotIncludes(source, '워크스페이스 선택', 'workspace switcher accessible label is removed');
  assertNotIncludes(source, 'workspace-name', 'workspace switcher name is removed');
  assertNotIncludes(source, 'profileHref', 'sidebar account does not receive profile href');
  assertNotIncludes(source, '프로필 열기', 'sidebar account profile link is removed');
  assertNotIncludes(source, 'href={profileHref}', 'sidebar account is not a profile navigation link');
  assertIncludes(source, '<UserButton userProfileMode="modal" />', 'Clerk account control remains available');
  assertIncludes(source, 'useVisibleNavItems', 'sidebar and command palette still use gated nav items');
}

async function checkSettingsTabs() {
  const consolePages = await readSource('src/features/console/ConsolePages.jsx');
  const tabQuery = await readSource('src/features/console/tabQuery.js');
  const settingsTabs = extractArrayLiteral(consolePages, 'SETTINGS_TABS');
  const settingsQueryMap = extractObjectLiteral(tabQuery, 'SETTINGS_TAB_QUERY_VALUES');

  for (const tab of REMOVED_SETTINGS_TABS) {
    assertNotIncludes(settingsTabs, tab, `settings tabs must not include ${tab}`);
    assertNotIncludes(settingsQueryMap, tab, `settings tab query map must not include ${tab}`);
  }

  for (const value of REMOVED_SETTINGS_QUERY_VALUES) {
    assertNotIncludes(settingsQueryMap, `'${value}'`, `removed settings query value ${value} is not accepted`);
  }

  assertIncludes(settingsTabs, '사용량', 'usage tab remains');
  assertIncludes(settingsTabs, '발신 수단 관리', 'sender resources tab remains');
  assertIncludes(settingsTabs, '청구', 'billing tab remains');
  assertIncludes(settingsTabs, '연동', 'integrations tab remains');
}

async function checkConsolePages() {
  const source = await readSource('src/features/console/ConsolePages.jsx');

  assertNotIncludes(source, 'DomainsAddPage', 'domain add console page import/branch is removed');
  assertNotIncludes(source, 'DomainsPage', 'domain console page import/branch is removed');
  assertNotIncludes(source, "activePage === 'domains'", 'domain console branch is removed');
  assertNotIncludes(source, "activePage === 'domains-add'", 'domain add console branch is removed');
  assertNotIncludes(source, 'href="/webhooks"', 'docs no longer links to removed webhooks route');
}

async function checkDirectRoutes() {
  for (const filePath of REDIRECT_ROUTES) {
    const source = await readSource(filePath);
    assertIncludes(source, "import { redirect } from 'next/navigation';", `${filePath} imports redirect`);
    assertIncludes(source, "redirect('/message-send')", `${filePath} redirects to message-send`);
    assertNotIncludes(source, 'ConsoleRoute', `${filePath} does not render removed console route`);
    assertNotIncludes(source, 'DomainDetailPage', `${filePath} does not render removed domain detail page`);
  }
}

async function checkPreservedRoutes() {
  const docsRoute = await readSource('src/app/docs/page.jsx');
  const landingPage = await readSource('src/app/page.jsx');

  assertIncludes(docsRoute, 'pageId="docs"', 'docs route remains mounted');
  assertIncludes(landingPage, 'href="/docs"', 'public landing can still link to docs');
}

async function readSource(filePath) {
  if (!sourceCache.has(filePath)) {
    sourceCache.set(filePath, await readFile(filePath, 'utf8'));
  }
  return sourceCache.get(filePath);
}

function extractArrayLiteral(source, name) {
  const match = source.match(new RegExp(`const ${name} = \\[(.*?)\\];`, 's'));
  assert(match, `${name} array literal exists`);
  return match[1];
}

function extractObjectLiteral(source, name) {
  const match = source.match(new RegExp(`const ${name} = Object\\.freeze\\(\\{(.*?)\\}\\);`, 's'));
  assert(match, `${name} object literal exists`);
  return match[1];
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
