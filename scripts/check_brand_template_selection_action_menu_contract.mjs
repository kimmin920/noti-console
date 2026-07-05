#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const PHASE = '35-brand-template-selection-action-menu';

const CHECKS = [
  {
    name: 'package script',
    path: 'package.json',
    required: [
      /"test:brand-template-selection-action-menu-contract": "node scripts\/check_brand_template_selection_action_menu_contract\.mjs"/,
    ],
  },
  {
    name: 'top-level phase registry',
    path: 'phases/index.json',
    required: [
      /"dir": "35-brand-template-selection-action-menu"/,
      /"status": "pending"|"status": "completed"/,
    ],
  },
  {
    name: 'phase index',
    path: `phases/${PHASE}/index.json`,
    required: [
      /"phase": "35-brand-template-selection-action-menu"/,
      /"name": "contract-and-source-check"/,
      /"name": "shared-template-picker-deferred-selection"/,
      /"name": "brand-message-action-menu-wiring"/,
      /"name": "visual-and-final-qa"/,
    ],
  },
  {
    name: 'contract',
    path: `phases/${PHASE}/template-selection-action-menu-contract.md`,
    required: [
      /cards select only/i,
      /single toolbar action/i,
      /deferred selection/i,
      /그대로 사용/,
      /복사해서 편집/,
      /npm run lint && npm run build/,
    ],
  },
  {
    name: 'step files',
    path: `phases/${PHASE}/step0.md`,
    required: [/contract-and-source-check/, /test:brand-template-selection-action-menu-contract/],
  },
  {
    name: 'shared template dialog deferred mode',
    path: 'src/components/ui/EmailSendForm.jsx',
    required: [
      /initialSelectedTemplateId = ''/,
      /selectionMode = 'immediate'/,
      /renderToolbarAction/,
      /filterTemplateDialogItems/,
      /handleTemplateQueryChange/,
      /isSelectionVisible/,
      /onQueryChange/,
      /toolbarAction=\{toolbarAction\}/,
      /data-selected=\{isSelected \? 'true' : undefined\}/,
    ],
  },
  {
    name: 'brand message action menu wiring',
    path: 'src/components/ui/BrandMessageSendForm.jsx',
    required: [
      /function BrandTemplateSelectionAction/,
      /className="brand-template-selection-action-trigger"/,
      /renderBrandTemplateDialogToolbarAction/,
      /initialSelectedTemplateId=\{selectedTemplateDialogId\}/,
      /selectionMode="deferred"/,
      /그대로 사용/,
      /복사해서 편집/,
      /handleTemplateSelect\(dialogSelectedTemplate\)/,
      /handleTemplateStart\(dialogSelectedTemplate\)/,
    ],
    forbidden: [
      /onStart=\{\(\) => handleTemplateStartFromPicker\(template\)\}/,
      /function handleTemplateStartFromPicker/,
    ],
  },
  {
    name: 'brand template dialog card is selectable only',
    path: 'src/components/ui/MessageTemplateDialogAdapters.jsx',
    required: [
      /export function BrandMessageTemplateDialogCard\(\{ cardKey, isSelected = false, onSelect, template \}\)/,
      /aria-label=\{`\$\{template\.name\} 템플릿 선택`\}/,
      /aria-pressed=\{isSelected\}/,
      /data-selected=\{isSelected \? 'true' : undefined\}/,
    ],
    forbidden: [
      /ActionMenu/,
      /template-card-action-row/,
      /template-card-action-menu/,
      /템플릿 사용 메뉴/,
      /onStart/,
    ],
  },
  {
    name: 'styles move action to toolbar',
    path: 'src/styles/components.css',
    required: [
      /\.email-send-form-template-toolbar/,
      /\.email-send-form-template-toolbar-action/,
      /\.brand-template-selection-action-trigger/,
      /\.brand-template-selection-action-menu\.action-menu-content/,
      /\.email-send-form-template-card--brand\[data-selected="true"\] \{/,
      /background: var\(--control\)/,
      /@media \(max-width: 640px\)/,
    ],
    forbidden: [
      /\.template-card-action-row/,
      /\.template-card-action-menu-trigger/,
      /\.email-send-form-template-card--brand-actions/,
      /\.email-send-form-template-card--brand\[data-selected="true"\] \.template-card-preview-frame/,
    ],
  },
  {
    name: 'server tests cover picker contract',
    path: 'src/server/__tests__/brandMessageConsoleDefaults.test.js',
    required: [
      /renders Brand Message template picker cards as selectable previews/,
      /renders Brand Message template picker with a toolbar action after selection/,
      /EmailSendFormTemplatePicker/,
      /aria-pressed="true"/,
      /brand-template-selection-action-trigger/,
    ],
    forbidden: [
      /템플릿 사용 메뉴/,
      /onStart: \(\) => \{\}/,
    ],
  },
];

const failures = [];

for (const check of CHECKS) {
  const source = await readText(check.path);
  assertPatterns(source, check.required ?? [], check.name);
  assertForbiddenPatterns(source, check.forbidden ?? [], check.name);
}

for (const step of [1, 2, 3]) {
  const source = await readText(`phases/${PHASE}/step${step}.md`);
  assertPatterns(source, [/npm run lint && npm run build/], `step ${step}`);
}

if (failures.length > 0) {
  console.error(`Brand template selection action menu contract failed (${failures.length})`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Brand template selection action menu contract passed');

async function readText(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    failures.push(`${path}: unable to read (${error.message})`);
    return '';
  }
}

function assertPatterns(source, patterns, label) {
  for (const pattern of patterns) {
    if (!pattern.test(source)) {
      failures.push(`${label}: missing ${pattern}`);
    }
  }
}

function assertForbiddenPatterns(source, patterns, label) {
  for (const pattern of patterns) {
    if (pattern.test(source)) {
      failures.push(`${label}: forbidden ${pattern}`);
    }
  }
}
