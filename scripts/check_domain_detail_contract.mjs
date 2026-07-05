#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultReferenceHtml = path.resolve(
  rootDir,
  '../resends-clone/refs/resend/domain-detail/resend.com/domains/f6a0e4ae-8a5c-46e7-9507-a83fb3295ee4.html'
);

const referenceHtmlPath = process.env.DOMAIN_DETAIL_REF_HTML || defaultReferenceHtml;

const files = {
  component: path.join(rootDir, 'src/components/domains/DomainDetailRecords.jsx'),
  data: path.join(rootDir, 'src/components/domains/domainDetailData.js'),
  page: path.join(rootDir, 'src/components/domains/DomainDetail.jsx'),
  styles: path.join(rootDir, 'src/styles/domain-detail.css'),
};

const sourceContracts = [
  ['source tablist spacing', 'role="tablist" class="flex gap-2 items-center p-1 -ml-1 mb-4"'],
  ['source Records tab selected', 'data-active="" data-orientation="horizontal" aria-disabled="false" tabindex="-1" role="tab" aria-selected="true"'],
  ['source Configuration tab unselected', 'data-orientation="horizontal" aria-disabled="false" tabindex="-1" role="tab" aria-selected="false"'],
  ['source tab pill size', 'h-8 rounded-xl px-3">Records</button>'],
  ['source tabpanel', 'role="tabpanel" tabindex="0" data-index="-1" class="outline-hidden"'],
  ['source records panel frame', 'class="relative rounded-3xl border border-gray-3 p-6"'],
  ['source accent bar', 'class="absolute left-0 top-[22px] h-8 w-1 rounded-br-md rounded-tr-md bg-gray-3"'],
  ['source records header', 'class="mb-4 md:flex items-center justify-between"><h3 class="text-xl tracking-[-0.16px] text-emphasis font-bold">DNS Records</h3>'],
  ['source tutorial action', 'aria-label="Tutorial"'],
  ['source forward instructions action', 'aria-label="Forward instructions"'],
  ['source Domain Verification spacing', 'class="text-base text-emphasis font-bold mt-8 flex flex-auto gap-3 items-center">Domain Verification</h2>'],
  ['source record title spacing', 'class="text-sm text-emphasis font-bold mt-4 flex flex-auto gap-3 items-center"><a class="group flex items-center justify-center gap-1"'],
  ['source table shell spacing', 'class="mt-4 overflow-x-auto"'],
  ['source table layout', 'class="m-0 w-max min-w-full border-separate border-spacing-0 border-none p-0 text-left md:w-full table-fixed"'],
  ['source Enable Sending divider', 'class="min-h-px w-full bg-interactive-hover my-8"'],
  ['source Enable Sending checked switch', 'id="sending-toggle" role="switch" aria-checked="true"'],
];

const checks = [];

function check(name, predicate) {
  checks.push({ name, predicate });
}

function fail(message) {
  throw new Error(message);
}

function expectIncludes(content, needle, label) {
  if (!content.includes(needle)) {
    fail(`${label} is missing: ${needle}`);
  }
}

function countMatches(content, needle) {
  return content.split(needle).length - 1;
}

function cssRule(css, selector) {
  let selectorIndex = css.indexOf(selector);

  while (selectorIndex >= 0) {
    const afterSelector = css.slice(selectorIndex + selector.length);

    if (/^\s*\{/.test(afterSelector)) {
      break;
    }

    selectorIndex = css.indexOf(selector, selectorIndex + selector.length);
  }

  if (selectorIndex < 0) {
    fail(`CSS selector is missing: ${selector}`);
  }

  const openIndex = css.indexOf('{', selectorIndex);
  let depth = 0;

  for (let index = openIndex; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(openIndex + 1, index);
  }

  fail(`CSS selector is unterminated: ${selector}`);
}

function expectCss(css, selector, declarations) {
  const rule = cssRule(css, selector);

  for (const declaration of declarations) {
    expectIncludes(rule, declaration, `${selector} declaration`);
  }
}

const [referenceHtml, component, data, page, styles] = await Promise.all([
  readFile(referenceHtmlPath, 'utf8'),
  readFile(files.component, 'utf8'),
  readFile(files.data, 'utf8'),
  readFile(files.page, 'utf8'),
  readFile(files.styles, 'utf8'),
]);

for (const [label, sourceContract] of sourceContracts) {
  check(label, () => expectIncludes(referenceHtml, sourceContract, label));
}

check('DomainTabs keeps exactly one selected tab', () => {
  expectIncludes(component, 'role="tablist"', 'DomainTabs role');
  expectIncludes(component, 'role="tab"', 'DomainTabs tab role');
  expectIncludes(component, 'data-active=""', 'DomainTabs active marker');
  if (countMatches(component, 'aria-selected="true"') !== 1) {
    fail('DomainTabs must have exactly one aria-selected="true" tab.');
  }
  if (countMatches(component, 'aria-selected="false"') !== 1) {
    fail('DomainTabs must have exactly one aria-selected="false" tab.');
  }
  if (component.includes('aria-current="page"')) {
    fail('DomainTabs must use tab selected state, not aria-current page state.');
  }
});

check('Records panel preserves source DOM details', () => {
  for (const needle of [
    'role="tabpanel"',
    'className="resend-records-section"',
    'className="resend-records-accent"',
    'aria-label="Tutorial"',
    'aria-label="Forward instructions"',
    'className="resend-record-section-divider"',
    'id="sending-toggle"',
    'aria-checked="true"',
    'className="resend-switch is-checked"',
  ]) {
    expectIncludes(component, needle, 'records panel implementation');
  }
});

check('Domain detail ordering keeps tabs before records panel', () => {
  const tabsIndex = page.indexOf('<DomainTabs />');
  const recordsIndex = page.indexOf('<DnsRecords />');

  if (tabsIndex < 0 || recordsIndex < 0 || tabsIndex > recordsIndex) {
    fail('DomainDetailPage must render DomainTabs immediately before DnsRecords.');
  }
});

check('Documentation anchors match source page', () => {
  for (const anchor of ['what-are-dkim-records', 'what-are-spf-records', 'what-are-dmarc-records']) {
    expectIncludes(data, `introduction#${anchor}`, `source docs anchor ${anchor}`);
  }
});

check('Tab spacing and selected state CSS is pinned', () => {
  expectCss(styles, '.resend-domain-tabs', [
    'gap: 8px;',
    'margin: 0 0 16px -4px;',
    'padding: 4px;',
  ]);
  expectCss(styles, '.resend-domain-tabs button', [
    'height: 32px;',
    'border-radius: 12px;',
    'padding: 0 12px;',
  ]);
  expectCss(styles, '.resend-domain-tabs button[data-active]', [
    'background: var(--rd-control);',
    'color: var(--rd-text);',
  ]);
});

check('Records panel frame and accent CSS is pinned', () => {
  expectCss(styles, '.resend-records-section', [
    'position: relative;',
    'border: 1px solid #d7d7d7;',
    'border-radius: 24px;',
    'padding: 24px;',
  ]);
  expectCss(styles, '.resend-records-accent', [
    'position: absolute;',
    'top: 22px;',
    'left: 0;',
    'width: 4px;',
    'height: 32px;',
    'border-bottom-right-radius: 6px;',
    'border-top-right-radius: 6px;',
    'background: #d7d7d7;',
  ]);
});

check('Records subsection spacing and table layout CSS is pinned', () => {
  expectCss(styles, '.resend-records-header', ['margin-bottom: 16px;']);
  expectCss(styles, '.resend-records-header h3', [
    'font-size: 20px;',
    'letter-spacing: 0;',
    'line-height: 28px;',
  ]);
  expectCss(styles, '.resend-record-section-divider', [
    'min-height: 1px;',
    'margin: 32px 0;',
  ]);
  expectCss(styles, '.resend-record-title', ['margin: 16px 0 0;']);
  expectCss(styles, '.resend-dns-table-shell', [
    'overflow-x: auto;',
    'margin-top: 16px;',
  ]);
  expectIncludes(styles, '@media (min-width: 1024px)', 'desktop table width breakpoint');
  for (const width of ['width: 280px;', 'width: 320px;', 'width: 80px;', 'width: 140px;']) {
    expectIncludes(styles, width, `desktop table column ${width}`);
  }
});

const failures = [];

for (const { name, predicate } of checks) {
  try {
    predicate();
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error('Domain detail contract check failed.');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Domain detail contract check passed (${checks.length} checks).`);
