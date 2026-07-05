import { describe, expect, it } from 'vitest';
import * as ui from '../../components/ui/index.js';
import { DataTableV2 } from '../../components/ui/DataTableV2.jsx';
import { DataTableV2Primitives } from '../../components/ui/DataTableV2Primitives.jsx';

describe('DataTable versions', () => {
  it('pins the UI barrel to the canonical TanStack-backed V2 table', () => {
    expect(ui.DataTableV2).toBe(DataTableV2);
    expect(ui.DataTableV2View).toBeUndefined();
    expect(ui.DataTableV2Root).toBeUndefined();
    expect(ui.DataTableV2Scroll).toBeUndefined();
    expect(ui.DataTableV2Cell).toBeUndefined();
    expect(ui.DataTableV2SelectionCheckbox).toBeUndefined();
    expect(ui.DataTableV2BulkActionBar).toBeUndefined();
    expect(ui.DataTableV2BulkActionButton).toBeUndefined();
  });

  it('keeps bulk action buttons available as the only public helper on the table', () => {
    expect(typeof ui.DataTableV2).toBe('function');
    expect(typeof ui.DataTableV2.BulkActionButton).toBe('function');
    expect(ui.DataTableV2.Root).toBeUndefined();
    expect(ui.DataTableV2.Row).toBeUndefined();
    expect(ui.DataTableV2.Cell).toBeUndefined();
  });

  it('keeps the internal primitive root behavior for the wrapper implementation', () => {
    const hoverRoot = DataTableV2Primitives.Root({ children: null, selectionVisibility: 'hover' });
    const defaultRoot = DataTableV2Primitives.Root({ children: null });

    expect(hoverRoot.props['data-selection-visibility']).toBe('hover');
    expect(hoverRoot.props.selectionVisibility).toBeUndefined();
    expect(defaultRoot.props['data-selection-visibility']).toBe('always');
  });

  it('does not expose the old unversioned table contract', () => {
    const legacyName = 'Data' + 'Table';

    expect(ui[legacyName]).toBeUndefined();
    expect(ui[`${legacyName}Root`]).toBeUndefined();
    expect(ui[`${legacyName}Cell`]).toBeUndefined();
  });
});
