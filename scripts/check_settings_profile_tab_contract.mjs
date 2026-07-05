#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const PHASE = '44-settings-profile-tab';
const REQUIRED_FILES = [
  `phases/${PHASE}/current-state-audit.md`,
  `phases/${PHASE}/settings-profile-tab-contract.md`,
  'src/features/console/ConsolePages.jsx',
  'src/features/console/ConsoleShells.jsx',
  'src/features/console/consoleConfig.js',
  'src/features/console/routing.js',
  'src/features/console/tabQuery.js',
  'src/app/profile/page.jsx',
  'src/app/settings/page.jsx',
];

const sourceCache = new Map();

await checkRequiredFiles();
await checkPackageScript();
await checkSettingsTab();
await checkProfileRoute();
await checkSidebarAccount();
await checkNoBackendExpansion();

console.log('settings profile tab contract passed');

async function checkRequiredFiles() {
  for (const filePath of REQUIRED_FILES) {
    await readSource(filePath);
  }
}

async function checkPackageScript() {
  const packageJson = JSON.parse(await readSource('package.json'));
  assertEqual(
    packageJson.scripts?.['test:settings-profile-tab-contract'],
    'node scripts/check_settings_profile_tab_contract.mjs',
    'package.json exposes the settings profile tab contract script'
  );
}

async function checkSettingsTab() {
  const consolePages = await readSource('src/features/console/ConsolePages.jsx');
  const tabQuery = await readSource('src/features/console/tabQuery.js');
  const settingsTabs = extractArrayLiteral(consolePages, 'SETTINGS_TABS');
  const settingsQueryMap = extractObjectLiteral(tabQuery, 'SETTINGS_TAB_QUERY_VALUES');

  assertIncludes(settingsTabs, '프로필', 'settings tabs include profile');
  assertIncludes(settingsQueryMap, "프로필: 'profile'", 'settings query map supports profile deep link');
  assertIncludes(consolePages, "activeTab === '프로필' ? <ProfileSettingsContent /> : null", 'settings page renders profile content');
  assertIncludes(consolePages, 'function ProfileSettingsContent()', 'profile content is reusable inside settings');
  assertIncludes(consolePages, '<UserButton userProfileMode="modal" />', 'profile tab keeps Clerk account management');
  assertIncludes(consolePages, '<SignOutButton redirectUrl="/">', 'profile tab keeps logout action');
  assertNotIncludes(consolePages, "activePage === 'profile'", 'standalone profile console branch is removed');
}

async function checkProfileRoute() {
  const profileRoute = await readSource('src/app/profile/page.jsx');
  const routing = await readSource('src/features/console/routing.js');
  const consoleConfig = await readSource('src/features/console/consoleConfig.js');

  assertIncludes(profileRoute, "import { redirect } from 'next/navigation';", 'profile route imports redirect');
  assertIncludes(profileRoute, "redirect('/settings?tab=profile')", 'profile route redirects to settings profile tab');
  assertNotIncludes(profileRoute, 'ConsoleRoute', 'profile route no longer renders standalone console route');
  assertNotIncludes(routing, "profile: '/profile'", 'routing no longer maps standalone profile page');
  assertNotIncludes(routing, "'profile'", 'routing no longer accepts profile page id');
  assertNotIncludes(consoleConfig, 'profile: { title: ', 'console page metadata does not expose standalone profile');
}

async function checkSidebarAccount() {
  const source = await readSource('src/features/console/ConsoleShells.jsx');

  assertNotIncludes(source, 'profileHref', 'sidebar account does not receive a profile href');
  assertNotIncludes(source, '프로필 열기', 'sidebar account profile link is absent');
  assertNotIncludes(source, 'href={profileHref}', 'sidebar account details are not a link to profile');
  assertIncludes(source, '<UserButton userProfileMode="modal" />', 'sidebar keeps Clerk account menu');
  assertIncludes(source, 'aria-label="계정 이메일"', 'sidebar still exposes account identity');
}

async function checkNoBackendExpansion() {
  const schema = await readSource('src/db/schema.js');
  assertNotIncludes(schema, 'profile_settings', 'phase does not add profile settings schema');
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
