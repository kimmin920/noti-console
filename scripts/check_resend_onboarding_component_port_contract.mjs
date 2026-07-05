import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const contractOnly = args.has('--contract-only');
const sourceOnly = args.has('--source-only');
const componentOnly = args.has('--component-only');

const phaseDir = 'phases/39-resend-onboarding-component-port';
const componentDir = 'src/components/onboarding';
const requiredPhaseFiles = [
  'index.json',
  'resend-onboarding-component-port-contract.md',
  'step0.md',
  'step1.md',
  'step2.md',
  'step3.md',
  'step4.md',
];

const requiredComponentFiles = [
  'index.js',
  'OnboardingShell.jsx',
  'OnboardingSidebar.jsx',
  'OnboardingStepCard.jsx',
  'OnboardingCodePanel.jsx',
  'OnboardingChannelSelector.jsx',
  'OnboardingStepActions.jsx',
  'OnboardingTabs.jsx',
  'OnboardingTaskList.jsx',
  'OnboardingResourceCard.jsx',
  'OnboardingActionButton.jsx',
  'onboarding.module.css',
];

const requiredExports = [
  'OnboardingShell',
  'OnboardingSidebar',
  'OnboardingStepCard',
  'OnboardingCodePanel',
  'OnboardingChannelSelector',
  'OnboardingChannelSummary',
  'OnboardingStepActions',
  'OnboardingTabs',
  'OnboardingTaskList',
  'OnboardingResourceCard',
  'OnboardingActionButton',
  'createMessagingOnboardingData',
];

const requiredContractPhrases = [
  'src/components/onboarding/',
  'source-inventory.md',
  'OnboardingShell',
  'OnboardingSidebar',
  'OnboardingCodePanel',
  'OnboardingTabs',
  'OnboardingTaskList',
  'OnboardingResourceCard',
  'Copy controls must write',
  'Do not add TypeScript files',
  'Do not commit raw HAR',
  'development-only preview',
];

const forbiddenSourcePatterns = [
  /https:\/\/resend\.com\/_next\//,
  /https:\/\/fp\.resend\.com\//,
  /https:\/\/api\.reo\.dev\//,
  /document\.cookie/,
  /localStorage\./,
  /sessionStorage\./,
  /Authorization\s*:\s*\S+/i,
  /Bearer\s+[A-Za-z0-9._-]+/,
  /re_[A-Za-z0-9]{12,}/,
];

const requiredSourceInventoryPhrases = [
  '## Capture Method',
  '## Page Identity',
  '## Layout Regions',
  '## Component Inventory',
  '## CSS And Token Inventory',
  '## Asset Inventory',
  '## Interactive Controls',
  '## Responsive Behavior',
  '## Microinteractions',
  '## Source To Local Component Mapping',
  '## Sanitization',
  '## Out Of Scope',
];

const requiredFinalQaPhrases = [
  '## Contract Traceability',
  '## Desktop Viewport',
  '## Mobile Viewport',
  '## Code Tab Switch',
  '## Copy Feedback',
  '## Keyboard Focus',
  '## Layout Integrity',
  '## Commands',
];

function rel(...segments) {
  return path.join(root, ...segments);
}

function readText(relativePath) {
  return fs.readFileSync(rel(relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(rel(relativePath));
}

function fail(message) {
  throw new Error(message);
}

function assertFile(relativePath) {
  if (!exists(relativePath)) {
    fail(`Missing required file: ${relativePath}`);
  }
}

function assertContains(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    fail(`${label} must contain: ${needle}`);
  }
}

function assertMatches(haystack, pattern, label) {
  if (!pattern.test(haystack)) {
    fail(`${label} must match: ${pattern}`);
  }
}

function listFilesRecursive(relativeDir) {
  const absoluteDir = rel(relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];

  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const child = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return listFilesRecursive(child);
    return child;
  });
}

for (const file of requiredPhaseFiles) {
  assertFile(path.join(phaseDir, file));
}

const contract = readText(path.join(phaseDir, 'resend-onboarding-component-port-contract.md'));
for (const phrase of requiredContractPhrases) {
  assertContains(contract, phrase, 'Resend onboarding component port contract');
}

const phaseIndex = JSON.parse(readText(path.join(phaseDir, 'index.json')));
if (phaseIndex.phase !== '39-resend-onboarding-component-port') {
  fail('Phase index must use phase "39-resend-onboarding-component-port".');
}
if (!Array.isArray(phaseIndex.steps) || phaseIndex.steps.length !== 5) {
  fail('Phase index must define exactly five steps.');
}

const topIndex = JSON.parse(readText('phases/index.json'));
if (!topIndex.phases?.some((phase) => phase.dir === '39-resend-onboarding-component-port')) {
  fail('phases/index.json must register 39-resend-onboarding-component-port.');
}

if (contractOnly) {
  console.log('Resend onboarding component port contract scaffolding OK.');
  process.exit(0);
}

assertFile(path.join(phaseDir, 'source-inventory.md'));
const sourceInventoryText = readText(path.join(phaseDir, 'source-inventory.md'));
for (const phrase of requiredSourceInventoryPhrases) {
  assertContains(sourceInventoryText, phrase, `${phaseDir}/source-inventory.md`);
}

for (const pattern of forbiddenSourcePatterns) {
  if (pattern.test(sourceInventoryText)) {
    fail(`Forbidden sensitive/source pattern found in source inventory: ${pattern}`);
  }
}

if (sourceOnly) {
  console.log('Resend onboarding source inventory OK.');
  process.exit(0);
}

for (const file of requiredComponentFiles) {
  assertFile(path.join(componentDir, file));
}

assertFile(path.join(phaseDir, 'implementation-notes.md'));

const componentFiles = listFilesRecursive(componentDir);
const typeScriptFiles = componentFiles.filter((file) => /\.(ts|tsx|mts|cts)$/.test(file));
if (typeScriptFiles.length > 0) {
  fail(`Do not add TypeScript files for this port: ${typeScriptFiles.join(', ')}`);
}

const componentText = componentFiles
  .filter((file) => /\.(js|jsx|css|md)$/.test(file))
  .map((file) => `${file}\n${readText(file)}`)
  .join('\n\n');

const indexText = readText(path.join(componentDir, 'index.js'));
for (const exportName of requiredExports) {
  assertContains(indexText, exportName, `${componentDir}/index.js`);
}

for (const pattern of forbiddenSourcePatterns) {
  if (pattern.test(componentText)) {
    fail(`Forbidden sensitive/source pattern found in onboarding component files: ${pattern}`);
  }
}

if (/from ['"](?:\.\.\/)*playground|src\/playground/.test(componentText)) {
  fail('Production onboarding components must not import from src/playground.');
}

const cssText = readText(path.join(componentDir, 'onboarding.module.css'));
const cssLower = cssText.toLowerCase();
for (const classAnchor of ['shell', 'sidebar', 'stepcard', 'channelselector', 'channeloptioncard', 'codepanel', 'tabs', 'resourcecard', 'actionbutton']) {
  assertContains(cssLower, classAnchor, `${componentDir}/onboarding.module.css`);
}

const codePanelText = readText(path.join(componentDir, 'OnboardingCodePanel.jsx'));
for (const phrase of [
  'navigator.clipboard?.writeText',
  "document.execCommand('copy')",
  "setCopyState('copied')",
  "setCopyState('failed')",
  'data-active-example={activeValue}',
  'data-copy-state={copyState}',
  'aria-live="polite"',
  'hidden={!isSelected}',
  'data-selected={isSelected ? true : undefined}',
]) {
  assertContains(codePanelText, phrase, `${componentDir}/OnboardingCodePanel.jsx`);
}

const tabsText = readText(path.join(componentDir, 'OnboardingTabs.jsx'));
for (const phrase of [
  'resolveActiveValue',
  'role="tablist"',
  'role="tab"',
  'aria-selected={isSelected}',
  'aria-controls={panelId}',
  'tabIndex={isSelected ? 0 : -1}',
  'disabled={item.disabled}',
  'data-active={isSelected ? true : undefined}',
  'requestAnimationFrame',
  'ArrowRight',
  'ArrowLeft',
  'Home',
  'End',
]) {
  assertContains(tabsText, phrase, `${componentDir}/OnboardingTabs.jsx`);
}

const sidebarText = readText(path.join(componentDir, 'OnboardingSidebar.jsx'));
for (const phrase of [
  'data-state={state}',
  'aria-current={item.active ?',
  'aria-disabled={item.disabled || undefined}',
  "item.disabled ? 'disabled' : item.active ? 'active' : 'idle'",
]) {
  assertContains(sidebarText, phrase, `${componentDir}/OnboardingSidebar.jsx`);
}

const stepCardText = readText(path.join(componentDir, 'OnboardingStepCard.jsx'));
for (const phrase of [
  'data-status={status}',
  'completed: Check',
  'current: Radio',
  'pending: Circle',
]) {
  assertContains(stepCardText, phrase, `${componentDir}/OnboardingStepCard.jsx`);
}

const channelSelectorText = readText(path.join(componentDir, 'OnboardingChannelSelector.jsx'));
for (const phrase of [
  'role="radiogroup"',
  'type="radio"',
  'checked={selected}',
  'data-state={state}',
  'aria-live="polite"',
  'OnboardingChannelRequirementList',
  'OnboardingChannelSummary',
]) {
  assertContains(channelSelectorText, phrase, `${componentDir}/OnboardingChannelSelector.jsx`);
}

const resourceCardText = readText(path.join(componentDir, 'OnboardingResourceCard.jsx'));
for (const phrase of [
  'data-state={state}',
  'aria-disabled={disabled || undefined}',
  "disabled ? 'disabled' : 'idle'",
]) {
  assertContains(resourceCardText, phrase, `${componentDir}/OnboardingResourceCard.jsx`);
}

for (const phrase of [
  '.sidebarItem:not(.sidebarItemDisabled):hover',
  '.sidebarItem:focus-visible',
  '.sidebarItemActive',
  '.sidebarItemDisabled:hover',
  '.stepCard_completed .stepCardStatus',
  '.stepCard_current .stepCardStatus',
  '.stepCard_pending .stepCardStatus',
  '.channelOptionCard:hover',
  '.channelOptionCard:focus-within',
  '.channelOptionCard[data-state="selected"]',
  '.channelRequirementList',
  '.channelSummary',
  '.copyControl[data-copy-state="copied"]',
  '.copyControl[data-copy-state="failed"]',
  '.tab:disabled',
  '.resourceCardDisabled:hover',
]) {
  assertContains(cssText, phrase, `${componentDir}/onboarding.module.css`);
}

assertMatches(codePanelText, /useState\('idle'\)/, `${componentDir}/OnboardingCodePanel.jsx`);
assertMatches(tabsText, /event\.key === 'ArrowRight'[\s\S]*event\.preventDefault\(\)/, `${componentDir}/OnboardingTabs.jsx`);

if (componentOnly) {
  console.log('Resend onboarding component port implementation anchors OK.');
  process.exit(0);
}

assertFile(path.join(phaseDir, 'final-qa.md'));
const finalQaText = readText(path.join(phaseDir, 'final-qa.md'));
for (const phrase of requiredFinalQaPhrases) {
  assertContains(finalQaText, phrase, `${phaseDir}/final-qa.md`);
}
for (const pattern of forbiddenSourcePatterns) {
  if (pattern.test(finalQaText)) {
    fail(`Forbidden sensitive/source pattern found in final QA: ${pattern}`);
  }
}

const previewText = [
  ...listFilesRecursive('src/playground'),
  ...listFilesRecursive('src/app/playground'),
]
  .filter((file) => /\.(js|jsx)$/.test(file))
  .map((file) => readText(file))
  .join('\n');

if (!previewText.includes('components/onboarding') && !previewText.includes('OnboardingShell')) {
  fail('A development-only playground preview must import and render onboarding components.');
}

console.log('Resend onboarding component port contract OK.');
