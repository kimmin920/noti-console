'use client';

import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

export function TablePagination({
  className = '',
  itemLabel = '항목',
  page,
  pageSize,
  pageSizeOptions = [20, 50, 100],
  table,
  total = 0,
  unit = '개',
  onPageChange,
  onPageSizeChange,
}) {
  const tablePagination = table?.getState?.().pagination;
  const resolvedPageSize = tablePagination?.pageSize ?? pageSize ?? pageSizeOptions[0];
  const pageCount = table
    ? Math.max(table.getPageCount(), 1)
    : Math.max(1, Math.ceil(total / resolvedPageSize));
  const pageNumber = table
    ? Math.min((tablePagination?.pageIndex ?? 0) + 1, pageCount)
    : Math.min(Math.max(page ?? 1, 1), pageCount);
  const canPreviousPage = table ? table.getCanPreviousPage() : pageNumber > 1;
  const canNextPage = table ? table.getCanNextPage() : pageNumber < pageCount;

  function changePage(nextPage) {
    const resolvedNextPage = Math.min(Math.max(nextPage, 1), pageCount);

    if (table) {
      table.setPageIndex(resolvedNextPage - 1);
    }

    onPageChange?.(resolvedNextPage);
  }

  function changePageSize(event) {
    const nextPageSize = Number(event.target.value);

    if (table) {
      table.setPageSize(nextPageSize);
      table.setPageIndex(0);
    }

    onPageSizeChange?.(nextPageSize);
  }

  return (
    <div className={['automation-table-pagination', className].filter(Boolean).join(' ')}>
      <span>
        {pageNumber.toLocaleString('ko-KR')} / {pageCount.toLocaleString('ko-KR')} 페이지
        <span className="automation-table-pagination-separator" aria-hidden="true">·</span>
        총 {total.toLocaleString('ko-KR')}{unit} {itemLabel}
        <span className="automation-table-pagination-separator" aria-hidden="true">·</span>
        <span className="automation-page-size-select">
          <select aria-label={`페이지당 ${itemLabel} 수`} onChange={changePageSize} value={resolvedPageSize}>
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>{option}개씩 보기</option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={14} />
        </span>
      </span>
      {pageCount > 1 ? (
        <span className="automation-table-pagination-actions">
          <button
            aria-label="이전 페이지"
            disabled={!canPreviousPage}
            onClick={() => changePage(pageNumber - 1)}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={14} />
          </button>
          <button
            aria-label="다음 페이지"
            disabled={!canNextPage}
            onClick={() => changePage(pageNumber + 1)}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={14} />
          </button>
        </span>
      ) : null}
    </div>
  );
}
