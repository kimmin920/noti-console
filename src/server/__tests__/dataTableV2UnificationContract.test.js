import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as ui from '../../components/ui/index.js';
import { DataTableV2 } from '../../components/ui-extensions/AppDataTable.jsx';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const unversionedTableName = 'Data' + 'Table';
const legacyVersionName = 'V' + '1';
const legacyExportPrefix = `DataTable${legacyVersionName}`;
const legacyShellClass = `table${'-'}shell`;
const legacyPlaygroundId = `id: '${'data-table'}',`;
const primitiveMemberPattern = /DataTableV2\.(Scroll|Root|Head|Body|Row|Header|Cell|SelectionCheckbox|BulkActionBar)\b/;

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(entryPath);
    if (entry.isFile()) return [entryPath];
    return [];
  });
}

describe('DataTable V2 unification contract', () => {
  it('exposes one public V2 table from the UI barrel', () => {
    expect(ui.DataTableV2).toBe(DataTableV2);
    expect(ui.DataTableV2View).toBeUndefined();
    expect(ui.DataTableV2Root).toBeUndefined();
    expect(ui.DataTableV2Scroll).toBeUndefined();
    expect(ui.DataTableV2Head).toBeUndefined();
    expect(ui.DataTableV2Body).toBeUndefined();
    expect(ui.DataTableV2Row).toBeUndefined();
    expect(ui.DataTableV2Header).toBeUndefined();
    expect(ui.DataTableV2Cell).toBeUndefined();
    expect(ui.DataTableV2SelectionCheckbox).toBeUndefined();
    expect(ui.DataTableV2BulkActionBar).toBeUndefined();
    expect(ui.DataTableV2BulkActionButton).toBeUndefined();
  });

  it('does not export legacy table contracts from the UI barrel', () => {
    expect(ui[unversionedTableName]).toBeUndefined();
    expect(ui[`${unversionedTableName}Root`]).toBeUndefined();
    expect(ui[`${unversionedTableName}Cell`]).toBeUndefined();
    expect(ui[legacyExportPrefix]).toBeUndefined();
    expect(ui[`${legacyExportPrefix}Root`]).toBeUndefined();
    expect(ui[`${legacyExportPrefix}Cell`]).toBeUndefined();
  });

  it('keeps legacy table source and shell classes out of UI primitives', () => {
    const uiDir = path.join(repoRoot, 'src/components/ui');
    const filePaths = listFiles(uiDir);

    expect(filePaths.some((filePath) => filePath.endsWith(`${unversionedTableName}.jsx`))).toBe(false);
    expect(filePaths.some((filePath) => filePath.endsWith(`${legacyExportPrefix}.jsx`))).toBe(false);

    const source = filePaths
      .map((filePath) => fs.readFileSync(filePath, 'utf8'))
      .join('\n');

    expect(source).not.toContain(legacyExportPrefix);
    expect(source).not.toMatch(new RegExp(`(^|[^A-Za-z0-9_-])${legacyShellClass}([^A-Za-z0-9_-]|$)`));
  });

  it('keeps only the V2 data table playground entry', () => {
    const registrySource = fs.readFileSync(path.join(repoRoot, 'src/playground/componentRegistry.jsx'), 'utf8');

    expect(registrySource).not.toContain(legacyPlaygroundId);
    expect(registrySource).toContain(`id: '${'data-table-v2'}',`);
    expect(registrySource).not.toContain(`id: '${'data-table-v2-view'}',`);
  });

  it('uses the canonical wrapper outside the UI implementation', () => {
    const appDirs = [
      path.join(repoRoot, 'src/components/domains'),
      path.join(repoRoot, 'src/features/console'),
      path.join(repoRoot, 'src/playground'),
    ];
    const offenders = appDirs
      .flatMap(listFiles)
      .filter((filePath) => filePath.endsWith('.jsx') || filePath.endsWith('.js'))
      .filter((filePath) => primitiveMemberPattern.test(fs.readFileSync(filePath, 'utf8')))
      .map((filePath) => path.relative(repoRoot, filePath));

    expect(offenders).toEqual([]);
  });
});
