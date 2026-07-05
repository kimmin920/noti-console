import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as ui from '../../components/ui/index.js';
import { DataTableV2 } from '../../components/ui/DataTableV2.jsx';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('DataTableV2 generic wrapper contract', () => {
  it('exports the TanStack wrapper as the canonical public V2 table', () => {
    expect(typeof DataTableV2).toBe('function');
    expect(ui.DataTableV2).toBe(DataTableV2);
    expect(ui.DataTableV2.Root).toBeUndefined();
  });

  it('keeps the generic wrapper backed by TanStack Table and the Resend edge checkbox pattern', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/components/ui/DataTableV2.jsx'), 'utf8');

    expect(source).toContain('@tanstack/react-table');
    expect(source).toContain('useReactTable');
    expect(source).toContain('flexRender');
    expect(source).toContain('selectionLayout');
    expect(source).toContain('resend-email-row-check');
    expect(source).toContain('resend-email-select-all-slot');
  });

  it('uses the canonical playground entry instead of a parallel view entry', () => {
    const registrySource = fs.readFileSync(path.join(repoRoot, 'src/playground/componentRegistry.jsx'), 'utf8');

    expect(registrySource).toContain(`id: '${'data-table-v2'}',`);
    expect(registrySource).not.toContain(`id: '${'data-table-v2-view'}',`);
    expect(registrySource).toContain('EmailDataTableV2Demo');
  });
});
