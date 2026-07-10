import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

import { auditConsoleNavigationLiterals } from '../../../scripts/audit_console_navigation_literals.mjs';

describe('console navigation literal audit', () => {
  it('fails on direct same-origin console router literals in feature and component files', () => {
    const root = makeFixtureRoot();
    writeFileSync(join(root, 'Feature.jsx'), "router.push('/templates')\n");
    mkdirSync(join(root, 'components'));
    writeFileSync(join(root, 'components', 'Button.jsx'), "<a href=\"/automations/new\">New</a>\n");

    const violations = auditConsoleNavigationLiterals({ roots: [root] });

    expect(violations.map((violation) => violation.href)).toEqual(['/templates', '/automations/new']);
  });

  it('allows API downloads and generic command palette caller-provided href execution', () => {
    const root = makeFixtureRoot();
    writeFileSync(join(root, 'Allowed.jsx'), [
      '<a href="/api/message-logs/export">export</a>',
      '<a href="/api/admin/sender-resource-applications/app/evidence-files/file/download">download</a>',
      'window.location.href = command.href;',
    ].join('\n'));

    expect(auditConsoleNavigationLiterals({ roots: [root] })).toEqual([]);
  });
});

function makeFixtureRoot() {
  const root = join(tmpdir(), `console-navigation-audit-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}
