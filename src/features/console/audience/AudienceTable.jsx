'use client';

import { useMemo } from 'react';
import { Ban, Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { ActionMenu, ActionMenuContent, ActionMenuItem, ActionMenuSeparator, ActionMenuTrigger, ConfirmationDialog, DataTableV2, IconButton, useToast } from '../../../components/ui/index.js';

const SELECTABLE_TABLE_PAGE_SIZE_OPTIONS = [40, 80, 120];

function getStatusTone(cell) {
  if (['활성', '성공'].includes(cell)) {
    return 'green';
  }

  if (['초안', '대기', '없음'].includes(cell)) {
    return 'neutral';
  }

  return undefined;
}

export function SelectableDataTable({ table }) {
  const { showToast } = useToast();
  const [firstColumn, ...otherColumns] = table.columns;
  const isRecipientTable = firstColumn === '수신자';
  const rows = useMemo(
    () => table.rows.map((cells) => ({ cells, id: cells.join('|') })),
    [table.rows]
  );
  const columns = [
    {
      accessor: (row) => row.cells[0],
      className: 'is-email-to',
      header: firstColumn,
      cell: ({ value }) => {
        const tone = getStatusTone(value);

        return (
          <span className="resend-email-subject-text">
            {tone ? <span className={`badge ${tone}`}>{value}</span> : value}
          </span>
        );
      },
    },
    ...otherColumns.map((column, index) => ({
      accessor: (row) => row.cells[index + 1],
      header: column,
      cell: ({ value }) => {
        const tone = getStatusTone(value);
        return tone ? <span className={`badge ${tone}`}>{value}</span> : value;
      },
    })),
  ];

  function notifyBulkAction(action, selectedRows, clearSelection) {
    showToast({
      description: '선택한 테이블 항목에 작업이 적용되었습니다.',
      title: `${selectedRows.length}개 항목 ${action}`,
      variant: 'success',
    });
    clearSelection();
  }

  return (
    <DataTableV2
      actionsClassName="is-email-actions table-actions"
      actionsHeaderClassName="is-email-actions"
      bulkActionBarProps={({ selectedRows }) => ({
        'aria-label': '선택 항목 작업',
        clearLabel: '선택 해제',
        countLabel: `${selectedRows.length}개 선택됨`,
      })}
      bulkActions={({ clearSelection, selectedRows }) => (
        <>
          <DataTableV2.BulkActionButton onClick={() => notifyBulkAction('비활성화됨', selectedRows, clearSelection)}>
          <Ban size={14} />
          비활성화
          </DataTableV2.BulkActionButton>
          <ConfirmationDialog
            confirmLabel="삭제"
            description="선택한 항목을 목록에서 제거합니다. 이 작업은 되돌릴 수 없습니다."
            destructive
            onConfirm={() => notifyBulkAction('삭제됨', selectedRows, clearSelection)}
            title="선택 항목 삭제?"
          >
            <DataTableV2.BulkActionButton danger>
              <Trash2 size={14} />
              삭제
            </DataTableV2.BulkActionButton>
          </ConfirmationDialog>
        </>
      )}
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      initialPageSize={SELECTABLE_TABLE_PAGE_SIZE_OPTIONS[0]}
      pagination={isRecipientTable}
      renderPagination={isRecipientTable ? ({ table: dataTable }) => (
        <SelectableDataTablePagination
          itemLabel="수신자"
          table={dataTable}
          total={rows.length}
          unit="명"
        />
      ) : undefined}
      rowActions={({ row }) => (
        <RowActionMenu
          label={row.cells[0]}
          onAction={(action) => showToast({
            description: `${row.cells[0]} 항목에 작업이 적용되었습니다.`,
            title: `${row.cells[0]} ${action}`,
            variant: action === '삭제됨' ? 'critical' : 'success',
          })}
        />
      )}
      selectable
      selectAllLabel="모든 행 선택"
      selectedRowLabel={({ row }) => `${row.cells[0]} 선택`}
      shellClassName="console-data-table-shell"
      tableClassName="console-data-table-v2"
    />
  );
}

function SelectableDataTablePagination({
  itemLabel,
  pageSizeOptions = SELECTABLE_TABLE_PAGE_SIZE_OPTIONS,
  table,
  total,
  unit = '개',
}) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = Math.max(table.getPageCount(), 1);
  const currentPage = Math.min(pageIndex + 1, pageCount);
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(total, currentPage * pageSize);

  function changePageSize(event) {
    table.setPageSize(Number(event.target.value));
    table.setPageIndex(0);
  }

  return (
    <div className="resend-email-pagination console-data-table-pagination">
      <p>
        <strong>{from}-{to}</strong>
        <span> / {total.toLocaleString('ko-KR')}{unit}</span>
        <span> - </span>
        <select
          aria-label={`페이지당 ${itemLabel} 수`}
          onChange={changePageSize}
          value={pageSize}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>{option}개</option>
          ))}
        </select>
      </p>
      <div>
        <button disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} type="button">
          이전
        </button>
        <button disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} type="button">
          다음
        </button>
      </div>
    </div>
  );
}

function RowActionMenu({ label, onAction }) {
  return (
    <ActionMenu>
      <ActionMenuTrigger asChild>
        <IconButton icon={MoreHorizontal} label={`${label} 작업 더보기`} />
      </ActionMenuTrigger>
      <ActionMenuContent align="end">
        <ActionMenuItem leadingVisual={<Copy size={16} />} onSelect={() => onAction('복제됨')}>
          복제
        </ActionMenuItem>
        <ActionMenuItem leadingVisual={<Pencil size={16} />} onSelect={() => onAction('이름 변경됨')}>
          이름 변경
        </ActionMenuItem>
        <ActionMenuSeparator />
        <ConfirmationDialog
          confirmLabel="삭제"
          description={`${label} 항목을 목록에서 제거합니다. 이 작업은 되돌릴 수 없습니다.`}
          destructive
          onConfirm={() => onAction('삭제됨')}
          title={`${label} 삭제?`}
        >
          <ActionMenuItem leadingVisual={<Trash2 size={16} />} variant="danger">
            삭제
          </ActionMenuItem>
        </ConfirmationDialog>
      </ActionMenuContent>
    </ActionMenu>
  );
}
