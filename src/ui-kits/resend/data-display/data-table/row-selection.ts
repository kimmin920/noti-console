import { useCallback, useEffect, useMemo, useState } from 'react';

type RowSelectionCheckedState = boolean | 'indeterminate';

type RowSelectionChangeHandler = (selectedRowIds: readonly string[]) => void;

type UseRowSelectionOptions = {
  readonly defaultSelectedRowIds?: readonly string[] | undefined;
  readonly onSelectedRowIdsChange?: RowSelectionChangeHandler | undefined;
  readonly rowIds: readonly string[];
  readonly selectedRowIds?: readonly string[] | undefined;
};

type RowSelectionState = {
  readonly allRowsCheckboxState: RowSelectionCheckedState;
  readonly selectedRowIds: readonly string[];
  readonly selectedRowIdsSet: ReadonlySet<string>;
  readonly setAllRowsChecked: (checked: RowSelectionCheckedState) => void;
  readonly setRowChecked: (rowId: string, checked: RowSelectionCheckedState) => void;
};

function normalizeSelectedRowIds(rowIds: readonly string[], selectedRowIds: readonly string[]) {
  const selectedSet = new Set(selectedRowIds);
  return rowIds.filter((rowId) => selectedSet.has(rowId));
}

function getAllRowsCheckboxState(rowIds: readonly string[], selectedRowIds: readonly string[]) {
  if (rowIds.length === 0 || selectedRowIds.length === 0) return false;
  if (selectedRowIds.length === rowIds.length) return true;
  return 'indeterminate';
}

function useRowSelection({
  defaultSelectedRowIds = [],
  onSelectedRowIdsChange,
  rowIds,
  selectedRowIds,
}: UseRowSelectionOptions): RowSelectionState {
  const [internalSelectedRowIds, setInternalSelectedRowIds] = useState<readonly string[]>(
    () => normalizeSelectedRowIds(rowIds, defaultSelectedRowIds)
  );
  const selectedRowIdsValue = useMemo(
    () => normalizeSelectedRowIds(rowIds, selectedRowIds ?? internalSelectedRowIds),
    [internalSelectedRowIds, rowIds, selectedRowIds]
  );
  const selectedRowIdsSet = useMemo(() => new Set(selectedRowIdsValue), [selectedRowIdsValue]);

  useEffect(() => {
    if (selectedRowIds !== undefined) return;
    setInternalSelectedRowIds((current) => {
      const next = normalizeSelectedRowIds(rowIds, current);
      return next.length === current.length && next.every((rowId, index) => rowId === current[index])
        ? current
        : next;
    });
  }, [rowIds, selectedRowIds]);

  const commit = useCallback(
    (nextSelectedRowIds: readonly string[]) => {
      const nextValue = normalizeSelectedRowIds(rowIds, nextSelectedRowIds);
      if (selectedRowIds === undefined) setInternalSelectedRowIds(nextValue);
      onSelectedRowIdsChange?.(nextValue);
    },
    [onSelectedRowIdsChange, rowIds, selectedRowIds]
  );

  const setAllRowsChecked = useCallback(
    (checked: RowSelectionCheckedState) => {
      commit(checked === true ? rowIds : []);
    },
    [commit, rowIds]
  );

  const setRowChecked = useCallback(
    (rowId: string, checked: RowSelectionCheckedState) => {
      const nextSet = new Set(selectedRowIdsValue);
      if (checked === true) nextSet.add(rowId);
      else nextSet.delete(rowId);
      commit(rowIds.filter((candidateRowId) => nextSet.has(candidateRowId)));
    },
    [commit, rowIds, selectedRowIdsValue]
  );

  return {
    allRowsCheckboxState: getAllRowsCheckboxState(rowIds, selectedRowIdsValue),
    selectedRowIds: selectedRowIdsValue,
    selectedRowIdsSet,
    setAllRowsChecked,
    setRowChecked,
  };
}

export { useRowSelection };
export type { RowSelectionChangeHandler, RowSelectionCheckedState, RowSelectionState };
