'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from './IconButton.jsx';

export function Pagination({
  className = '',
  defaultPage = 1,
  defaultPageSize,
  label = 'items',
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  pageSizeOptions = [15, 40, 80, 120],
  showCount = true,
  total = 0,
}) {
  const [uncontrolledPage, setUncontrolledPage] = useState(defaultPage);
  const [uncontrolledPageSize, setUncontrolledPageSize] = useState(defaultPageSize ?? pageSizeOptions[0]);
  const currentPage = page ?? uncontrolledPage;
  const currentPageSize = pageSize ?? uncontrolledPageSize;
  const pageCount = Math.max(1, Math.ceil(total / currentPageSize));
  const visibleRange = useMemo(() => {
    if (total === 0) return '0';
    const from = (currentPage - 1) * currentPageSize + 1;
    const to = Math.min(total, currentPage * currentPageSize);
    return `${from}-${to}`;
  }, [currentPage, currentPageSize, total]);

  function setPage(nextPage) {
    const boundedPage = Math.min(Math.max(nextPage, 1), pageCount);

    if (page === undefined) {
      setUncontrolledPage(boundedPage);
    }

    onPageChange?.(boundedPage);
  }

  function setSize(nextSize) {
    if (pageSize === undefined) {
      setUncontrolledPageSize(nextSize);
    }

    if (page === undefined) {
      setUncontrolledPage(1);
    }

    onPageSizeChange?.(nextSize);
  }

  return (
    <nav className={['pagination', className].filter(Boolean).join(' ')} aria-label={`${label} 페이지`}>
      {showCount ? (
        <p>
          <strong>{visibleRange}</strong>
          <span> / {total} {label}</span>
        </p>
      ) : null}
      <label className="pagination-size">
        표시
        <select
          onChange={(event) => setSize(Number(event.target.value))}
          value={currentPageSize}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <div className="pagination-actions">
        <IconButton
          disabled={currentPage <= 1}
          icon={ChevronLeft}
          label="이전 페이지"
          onClick={() => setPage(currentPage - 1)}
        />
        <span>{currentPage} / {pageCount}</span>
        <IconButton
          disabled={currentPage >= pageCount}
          icon={ChevronRight}
          label="다음 페이지"
          onClick={() => setPage(currentPage + 1)}
        />
      </div>
    </nav>
  );
}
