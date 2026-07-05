'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function getSelectionVisibility(selectionVisibility) {
  return selectionVisibility === 'hover' ? 'hover' : 'always';
}

function Root({ children, className = '', fixed = false, selectionVisibility = 'always', ...props }) {
  const normalizedSelectionVisibility = getSelectionVisibility(selectionVisibility);

  return (
    <table
      className={cx('resend-data-table', fixed && 'is-fixed', className)}
      data-selection-visibility={normalizedSelectionVisibility}
      {...props}
    >
      {children}
    </table>
  );
}

function Scroll({ children, className = '', ...props }) {
  return (
    <div className={cx('resend-data-table-scroll', className)} {...props}>
      {children}
    </div>
  );
}

function Head({ children, className = '', ...props }) {
  return <thead className={cx('resend-data-table-head', className)} {...props}>{children}</thead>;
}

function Body({ children, className = '', removeLastBorder = false, ...props }) {
  return (
    <tbody className={cx('resend-data-table-body', removeLastBorder && 'remove-last-border', className)} {...props}>
      {children}
    </tbody>
  );
}

function Row({ children, className = '', ...props }) {
  return <tr className={cx('resend-data-table-row', className)} {...props}>{children}</tr>;
}

function Header({ children, className = '', ...props }) {
  return <th className={cx('resend-data-table-header', className)} scope="col" {...props}>{children}</th>;
}

function Cell({ children, className = '', hasError = false, ...props }) {
  return (
    <td className={cx('resend-data-table-cell', hasError && 'has-error', className)} {...props}>
      {children}
    </td>
  );
}

function TableCell({ children, className = '', hasError = false, ...props }) {
  return (
    <Cell className={cx('resend-data-table-record-cell', className)} hasError={hasError} {...props}>
      {children}
    </Cell>
  );
}

function RecordValue({ compact = false, value }) {
  const max = compact ? 18 : 30;
  const display = useMemo(() => {
    if (value.length <= max) return { hidden: '', left: value, right: '' };

    const keep = max - 3;
    const leftLength = Math.ceil(keep / 2);
    const rightLength = Math.floor(keep / 2);

    return {
      hidden: value.slice(leftLength, -rightLength),
      left: value.slice(0, leftLength),
      right: value.slice(-rightLength),
    };
  }, [max, value]);

  if (!display.hidden) return value;

  return (
    <>
      {display.left}
      <span className="resend-data-table-copy-ellipsis">[...]</span>
      <span className="resend-data-table-copy-hidden">{display.hidden}</span>
      {display.right}
    </>
  );
}

async function writeClipboard(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand('copy');
    if (!copied) throw new Error('Copy command failed');
  } finally {
    document.body.removeChild(textarea);
  }
}

function CopyRecord({ children, className = '', compact = false, hasError = false, value }) {
  const [status, setStatus] = useState('idle');
  const isCopied = status === 'copied';
  const isFailed = status === 'failed';

  useEffect(() => {
    if (status === 'idle') return undefined;
    const timeout = window.setTimeout(() => setStatus('idle'), 1600);
    return () => window.clearTimeout(timeout);
  }, [status]);

  async function copyValue() {
    try {
      await writeClipboard(value);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <button
      aria-label={isCopied ? 'Copied' : `Copy ${value}`}
      className={cx(
        'resend-data-table-copy-record',
        hasError && 'has-error',
        isCopied && 'is-copied',
        isFailed && 'is-failed',
        className
      )}
      onClick={copyValue}
      title={value}
      translate="no"
      type="button"
    >
      <span className="resend-data-table-copy-value">
        {children ?? <RecordValue compact={compact} value={value} />}
      </span>
      <span className="resend-data-table-copy-icon" aria-hidden="true">
        {isCopied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.9} />}
      </span>
    </button>
  );
}

function LoadingCell({ className = '' }) {
  return <span className={cx('resend-data-table-loading-cell', className)} />;
}

function SelectionCheckbox({
  checked,
  className = '',
  indeterminate = false,
  label,
  onChange,
  onCheckedChange,
  onClick,
  ...props
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      aria-checked={indeterminate ? 'mixed' : undefined}
      aria-label={label}
      checked={checked}
      className={cx('resend-email-checkbox', className)}
      onChange={(event) => {
        onChange?.(event.target.checked, event);
        onCheckedChange?.(event.target.checked, event);
      }}
      onClick={onClick}
      type="checkbox"
      {...props}
    />
  );
}

function BulkActionBar({
  'aria-label': ariaLabel = 'Bulk actions',
  children,
  className = '',
  clearLabel = 'Clear selection',
  count = 0,
  countLabel,
  label = 'selected',
  onClear,
}) {
  if (count <= 0) return null;

  return (
    <div className={cx('resend-email-bulk-bar', className)} role="toolbar" aria-label={ariaLabel}>
      <span className="resend-email-bulk-count">{countLabel ?? `${count} ${label}`}</span>
      {children}
      {onClear ? (
        <button aria-label={clearLabel} className="is-icon" onClick={onClear} type="button">
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}

function BulkActionButton({ children, className = '', danger = false, icon = false, type = 'button', ...props }) {
  return (
    <button className={cx(danger && 'is-danger', icon && 'is-icon', className)} type={type} {...props}>
      {children}
    </button>
  );
}

function getColumnSize(id, compact = false) {
  if (compact) {
    return {
      name: 'is-name-compact',
      priority: 'is-small-compact',
      status: 'is-status-compact',
      toggle: 'is-toggle',
      ttl: 'is-small-compact',
      type: 'is-small-compact',
      value: 'is-value-compact',
    }[id] ?? '';
  }

  return {
    name: 'is-name',
    priority: 'is-small',
    status: 'is-status',
    toggle: 'is-toggle',
    ttl: 'is-small',
    type: 'is-type',
    value: 'is-value',
  }[id] ?? '';
}

export const DataTableV2Primitives = Object.assign(Root, {
  Body,
  BulkActionBar,
  BulkActionButton,
  Cell,
  CopyRecord,
  Head,
  Header,
  LoadingCell,
  Root,
  Row,
  Scroll,
  SelectionCheckbox,
  TableCell,
  getColumnSize,
});

export {
  Body as DataTableV2Body,
  BulkActionBar as DataTableV2BulkActionBar,
  BulkActionButton as DataTableV2BulkActionButton,
  Cell as DataTableV2Cell,
  CopyRecord as DataTableV2CopyRecord,
  Head as DataTableV2Head,
  Header as DataTableV2Header,
  LoadingCell as DataTableV2LoadingCell,
  Root as DataTableV2Root,
  Row as DataTableV2Row,
  Scroll as DataTableV2Scroll,
  SelectionCheckbox as DataTableV2SelectionCheckbox,
  TableCell as DataTableV2RecordCell,
  getColumnSize as getDataTableV2ColumnSize,
};
