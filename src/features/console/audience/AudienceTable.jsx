'use client';

import { useMemo, useState } from 'react';
import { Ban, Copy, MoreHorizontal, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { PageHeader } from '../../../components/layout/index.js';
import { ActionMenu, ActionMenuContent, ActionMenuItem, ActionMenuSeparator, ActionMenuTrigger, ConfirmationDialog, DataTableV2, EmptyState, IconButton, SearchField, SegmentedControl, useToast } from '../../../components/ui/index.js';
import { usePublMessageRecipients } from '../../publClient/usePublMessageRecipients.js';

const SELECTABLE_TABLE_PAGE_SIZE_OPTIONS = [40, 80, 120];

export function PublAudiencePage() {
  const [activeTab, setActiveTab] = useState('contacts');
  const [searchValue, setSearchValue] = useState('');
  const publRecipients = usePublMessageRecipients();
  const contactsSourceState = publRecipients.contactsSourceState;
  const normalizedSearch = searchValue.trim().toLocaleLowerCase('ko-KR');
  const rows = publRecipients.contacts.filter((contact) => (
    !normalizedSearch
    || [contact.label, contact.detail, contact.externalId]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('ko-KR')
      .includes(normalizedSearch)
  ));

  return (
    <section className="page-frame publ-audience-page">
      <PageHeader title="수신자" />
      <SegmentedControl
        items={[
          { label: 'Publ 수신자', value: 'contacts' },
          { label: 'Publ 세그먼트', value: 'segments' },
        ]}
        onValueChange={setActiveTab}
        value={activeTab}
      />

      {activeTab === 'contacts' ? (
        <>
          <div className="publ-audience-toolbar">
            <SearchField
              aria-label="Publ 수신자 검색"
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="이름, 전화번호, Publ ID 검색"
              value={searchValue}
            />
          </div>
          <DataTableV2
            columns={[
              { accessor: 'label', header: '수신자' },
              { accessor: 'value', cell: ({ value }) => <code>{value}</code>, header: '휴대폰' },
              { accessor: (row) => row.externalId || '-', cell: ({ value }) => <code>{value}</code>, header: 'Publ ID' },
            ]}
            data={rows}
            empty={<span className="admin-empty-row">{getPublAudienceEmptyMessage(contactsSourceState, normalizedSearch)}</span>}
            getRowId={(row) => row.externalId || row.value}
            loading={contactsSourceState === 'loading'}
            loadingSlot={<span className="admin-state-row">Publ 수신자를 불러오는 중입니다.</span>}
            pagination
            tableClassName="console-data-table-v2 publ-audience-data-table"
          />
        </>
      ) : (
        <EmptyState
          copy="Publ 세그먼트 SDK 권한이 추가되면 이 화면에서 조회하고 발송 대상으로 선택할 수 있습니다."
          icon={Sparkles}
          title="Publ 세그먼트 연동 준비 중"
        />
      )}
    </section>
  );
}

function getPublAudienceEmptyMessage(state, searchValue) {
  if (state === 'permission-denied') return 'Publ 수신자 조회 권한이 없습니다';
  if (state === 'error') return 'Publ 수신자를 불러오지 못했습니다.';
  if (searchValue) return '검색 조건에 맞는 Publ 수신자가 없습니다.';
  return '전화번호가 등록된 Publ 수신자가 없습니다.';
}

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
