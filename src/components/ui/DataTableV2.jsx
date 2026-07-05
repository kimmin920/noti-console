'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { DataTableV2Primitives } from './DataTableV2Primitives.jsx';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function getColumnId(column, index) {
  return column.id ?? column.accessorKey ?? (typeof column.accessor === 'string' ? column.accessor : `column-${index}`);
}

function getClassValue(value, context) {
  return typeof value === 'function' ? value(context) : value;
}

function normalizeColumn(column, index) {
  const id = getColumnId(column, index);
  const accessorKey = column.accessorKey ?? (typeof column.accessor === 'string' ? column.accessor : undefined);
  const accessorFn = column.accessorFn ?? (typeof column.accessor === 'function' ? column.accessor : undefined);

  return {
    id,
    ...(accessorKey ? { accessorKey } : {}),
    ...(accessorFn ? { accessorFn } : {}),
    header: column.header ?? column.label ?? id,
    cell(context) {
      if (column.cell) {
        return column.cell({
          ...context,
          row: context.row.original,
          rowModel: context.row,
          value: context.getValue(),
        });
      }

      return context.getValue() ?? '';
    },
    enableSorting: column.enableSorting ?? false,
    meta: {
      cellProps: column.cellProps,
      cellClassName: column.cellClassName ?? column.className,
      headerProps: column.headerProps,
      headerClassName: column.headerClassName ?? column.className,
    },
  };
}

function getSelectionLabel(label, fallback, context) {
  if (typeof label === 'function') return label(context);
  return label ?? fallback;
}

function LoadingRows({ columnCount, columns, rowCount }) {
  return Array.from({ length: rowCount }, (_, rowIndex) => (
    <DataTableV2Primitives.Row key={`data-table-v2-loading-${rowIndex}`}>
      {Array.from({ length: columnCount }, (_, columnIndex) => (
        <DataTableV2Primitives.Cell className={columns[columnIndex]?.columnDef.meta?.cellClassName} key={columnIndex}>
          <DataTableV2Primitives.LoadingCell />
        </DataTableV2Primitives.Cell>
      ))}
    </DataTableV2Primitives.Row>
  ));
}

function DataTableV2Component({
  actionsHeaderClassName,
  actionsClassName = 'is-email-actions',
  bodyProps,
  bulkActionBarProps,
  bulkActions,
  className = '',
  columns,
  data,
  empty = 'No results.',
  fixed = false,
  getRowId,
  getRowProps,
  headProps,
  initialPageSize = 40,
  loading = false,
  loadingRows = 8,
  loadingSlot,
  onRowClick,
  onSelectedRowsChange,
  pagination = false,
  renderPagination,
  rowActions,
  rowClassName,
  rootProps,
  scrollClassName = '',
  scrollProps,
  selectAllLabel,
  selectable = false,
  selectedRowLabel,
  selectionLayout = selectable ? 'resend-edge' : 'none',
  selectionVisibility = 'always',
  shellBaseClassName = 'resend-email-table-shell',
  shellClassName = '',
  shellProps,
  scrollBaseClassName = 'resend-email-table-scroll',
  tableClassName = '',
  tableBaseClassName = 'resend-email-table',
  withShell = true,
}) {
  const [rowSelection, setRowSelection] = useState({});
  const [paginationState, setPaginationState] = useState({ pageIndex: 0, pageSize: initialPageSize });
  const tableColumns = useMemo(() => columns.map(normalizeColumn), [columns]);
  const usesInlineSelection = selectable && selectionLayout === 'inline';
  const usesEdgeSelection = selectable && selectionLayout === 'resend-edge';
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns function handlers by design; this client wrapper keeps them local.
  const table = useReactTable({
    columns: tableColumns,
    data,
    enableRowSelection: selectable,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    onRowSelectionChange: setRowSelection,
    state: pagination
      ? { pagination: paginationState, rowSelection }
      : { rowSelection },
    ...(pagination ? {
      getPaginationRowModel: getPaginationRowModel(),
      onPaginationChange: setPaginationState,
    } : {}),
  });
  const visibleColumns = table.getVisibleLeafColumns();
  const rows = table.getRowModel().rows;
  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
  const columnCount = visibleColumns.length + (usesInlineSelection ? 1 : 0) + (rowActions ? 1 : 0);

  useEffect(() => {
    onSelectedRowsChange?.(selectedRows, rowSelection);
  }, [onSelectedRowsChange, rowSelection, selectedRows]);

  function clearSelection() {
    setRowSelection({});
  }

  const resolvedActionsHeaderClassName = actionsHeaderClassName ?? actionsClassName;

  const tableBlock = (
    <DataTableV2Primitives.Scroll className={cx(scrollBaseClassName, scrollClassName)} {...scrollProps}>
      <DataTableV2Primitives.Root
        className={cx(tableBaseClassName, tableClassName, className)}
        fixed={fixed}
        selectionVisibility={selectionVisibility}
        {...rootProps}
        data-has-selection={selectedRows.length > 0 ? 'true' : undefined}
      >
          <DataTableV2Primitives.Head {...headProps}>
            {table.getHeaderGroups().map((headerGroup) => (
              <DataTableV2Primitives.Row key={headerGroup.id}>
                {usesInlineSelection ? (
                  <DataTableV2Primitives.Header className="table-select">
                    <DataTableV2Primitives.SelectionCheckbox
                      checked={table.getIsAllPageRowsSelected()}
                      indeterminate={table.getIsSomePageRowsSelected()}
                      label={getSelectionLabel(selectAllLabel, 'Select all rows', { table })}
                      onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                    />
                  </DataTableV2Primitives.Header>
                ) : null}
                {headerGroup.headers.map((header, index) => {
                  const headerContext = header.getContext();
                  const content = header.isPlaceholder ? null : flexRender(header.column.columnDef.header, headerContext);
                  const headerProps = getClassValue(header.column.columnDef.meta?.headerProps, headerContext) ?? {};
                  const { className: headerPropClassName, ...extraHeaderProps } = headerProps;
                  const headerClassName = cx(header.column.columnDef.meta?.headerClassName, headerPropClassName);

                  return (
                    <DataTableV2Primitives.Header className={headerClassName} key={header.id} {...extraHeaderProps}>
                      {usesEdgeSelection && index === 0 ? (
                        <span className="resend-email-header-check">
                          <span className={`resend-email-select-all-slot ${selectedRows.length > 0 ? 'is-selected' : ''}`}>
                            <DataTableV2Primitives.SelectionCheckbox
                              checked={table.getIsAllPageRowsSelected()}
                              indeterminate={table.getIsSomePageRowsSelected()}
                              label={getSelectionLabel(selectAllLabel, 'Select all rows', { table })}
                              onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                            />
                          </span>
                          {content}
                        </span>
                      ) : content}
                    </DataTableV2Primitives.Header>
                  );
                })}
                {rowActions ? <DataTableV2Primitives.Header className={resolvedActionsHeaderClassName} /> : null}
              </DataTableV2Primitives.Row>
            ))}
          </DataTableV2Primitives.Head>
          <DataTableV2Primitives.Body {...bodyProps}>
            {loading ? (
              loadingSlot ? (
                <DataTableV2Primitives.Row>
                  <DataTableV2Primitives.Cell colSpan={columnCount}>{loadingSlot}</DataTableV2Primitives.Cell>
                </DataTableV2Primitives.Row>
              ) : (
                <LoadingRows columnCount={columnCount} columns={visibleColumns} rowCount={loadingRows} />
              )
            ) : rows.length ? (
              rows.map((row) => {
                const rowContext = { row: row.original, rowModel: row, table };
                const rowProps = getClassValue(getRowProps, rowContext) ?? {};
                const { className: rowPropClassName, onClick: rowPropOnClick, ...extraRowProps } = rowProps;

                return (
                  <DataTableV2Primitives.Row
                    className={cx(rowPropClassName, getClassValue(rowClassName, rowContext))}
                    data-selected={row.getIsSelected() ? 'true' : undefined}
                    key={row.id}
                    onClick={
                      rowPropOnClick || onRowClick
                        ? (event) => {
                          rowPropOnClick?.(event);
                          onRowClick?.(rowContext);
                        }
                        : undefined
                    }
                    {...extraRowProps}
                  >
                    {usesInlineSelection ? (
                      <DataTableV2Primitives.Cell className="table-select">
                        <DataTableV2Primitives.SelectionCheckbox
                          checked={row.getIsSelected()}
                          label={getSelectionLabel(selectedRowLabel, `Select ${row.id}`, { row: row.original, rowModel: row })}
                          onCheckedChange={(checked) => row.toggleSelected(checked)}
                          onClick={(event) => event.stopPropagation()}
                        />
                      </DataTableV2Primitives.Cell>
                    ) : null}
                    {row.getVisibleCells().map((cell, index) => {
                      const cellContext = cell.getContext();
                      const content = flexRender(cell.column.columnDef.cell, cellContext);
                      const cellProps = getClassValue(cell.column.columnDef.meta?.cellProps, {
                        ...cellContext,
                        row: row.original,
                        rowModel: row,
                        value: cell.getValue(),
                      }) ?? {};
                      const { className: cellPropClassName, ...extraCellProps } = cellProps;
                      const cellClassName = cx(cell.column.columnDef.meta?.cellClassName, cellPropClassName);

                      return (
                        <DataTableV2Primitives.Cell className={cellClassName} key={cell.id} {...extraCellProps}>
                          {usesEdgeSelection && index === 0 ? (
                            <div className="resend-email-recipient-cell">
                              <span className={`resend-email-row-check ${row.getIsSelected() ? 'is-selected' : ''}`}>
                                <DataTableV2Primitives.SelectionCheckbox
                                  checked={row.getIsSelected()}
                                  label={getSelectionLabel(selectedRowLabel, `Select ${row.id}`, { row: row.original, rowModel: row })}
                                  onCheckedChange={(checked) => row.toggleSelected(checked)}
                                  onClick={(event) => event.stopPropagation()}
                                />
                              </span>
                              {content}
                            </div>
                          ) : content}
                        </DataTableV2Primitives.Cell>
                      );
                    })}
                    {rowActions ? (
                      <DataTableV2Primitives.Cell className={actionsClassName}>
                        {rowActions({ row: row.original, rowModel: row, table })}
                      </DataTableV2Primitives.Cell>
                    ) : null}
                  </DataTableV2Primitives.Row>
                );
              })
            ) : (
              <DataTableV2Primitives.Row>
                <DataTableV2Primitives.Cell colSpan={columnCount}>{empty}</DataTableV2Primitives.Cell>
              </DataTableV2Primitives.Row>
            )}
          </DataTableV2Primitives.Body>
        </DataTableV2Primitives.Root>
      </DataTableV2Primitives.Scroll>
  );
  const actionBlock = (
    <>
      {selectable && bulkActions ? (
        <DataTableV2Primitives.BulkActionBar
          count={selectedRows.length}
          onClear={clearSelection}
          {...(getClassValue(bulkActionBarProps, { clearSelection, selectedRows, table }) ?? {})}
        >
          {bulkActions({ clearSelection, selectedRows, table })}
        </DataTableV2Primitives.BulkActionBar>
      ) : null}
      {renderPagination ? renderPagination({ table }) : null}
    </>
  );

  if (!withShell) {
    return (
      <>
        {tableBlock}
        {actionBlock}
      </>
    );
  }

  return (
    <div className={cx(shellBaseClassName, shellClassName)} {...shellProps}>
      {tableBlock}
      {actionBlock}
    </div>
  );
}

export const DataTableV2 = Object.assign(DataTableV2Component, {
  BulkActionButton: DataTableV2Primitives.BulkActionButton,
});
