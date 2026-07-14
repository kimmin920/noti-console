'use client';

import { useMemo } from 'react';
import { X } from 'lucide-react';
import {
  CopyRecord as ResendCopyRecord,
  DataTable,
} from '../../ui-kits/resend/data-display/data-table';
import { Checkbox } from '../../ui-kits/resend/primitives/checkbox';
import { AppButton } from './AppButton.jsx';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function getSelectionVisibility(selectionVisibility) {
  return selectionVisibility === 'hover' ? 'hover' : 'always';
}

function Root({ children, className = '', fixed = false, selectionVisibility = 'always', ...props }) {
  const normalizedSelectionVisibility = getSelectionVisibility(selectionVisibility);

  return (
    <DataTable.Root
      className={cx('resend-data-table', className)}
      fixed={fixed}
      data-selection-visibility={normalizedSelectionVisibility}
      {...props}
    >
      {children}
    </DataTable.Root>
  );
}

function Scroll({ children, className = '', ...props }) {
  return (
    <div className={cx('resend-data-table-scroll', className)} {...props}>
      {children}
    </div>
  );
}

function Head({ className = '', ...props }) {
  return <DataTable.Head className={cx('resend-data-table-head', className)} {...props} />;
}

function Body({ children, className = '', removeLastBorder = false, ...props }) {
  return (
    <DataTable.Body className={cx('resend-data-table-body', className)} removeLastBorder={removeLastBorder} {...props}>
      {children}
    </DataTable.Body>
  );
}

function Row({ className = '', ...props }) {
  return <DataTable.Row className={cx('resend-data-table-row', className)} {...props} />;
}

function Header({ className = '', ...props }) {
  return <DataTable.Header className={cx('resend-data-table-header', className)} {...props} />;
}

function Cell({ children, className = '', hasError = false, ...props }) {
  return (
    <DataTable.Cell className={cx('resend-data-table-cell', hasError && 'has-error', className)} {...props}>
      {children}
    </DataTable.Cell>
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

function CopyRecord({ children, className = '', compact = false, hasError = false, value }) {
  return (
    <ResendCopyRecord
      className={cx(hasError && 'has-error', className)}
      title={value}
      translate="no"
      value={value}
    >
      {children ?? <RecordValue compact={compact} value={value} />}
    </ResendCopyRecord>
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
  return (
    <Checkbox
      aria-label={label}
      checked={indeterminate ? 'indeterminate' : checked}
      className={className}
      indeterminate={indeterminate}
      onCheckedChange={(nextChecked) => {
        const resolvedChecked = nextChecked === true;
        onChange?.(resolvedChecked, { target: { checked: resolvedChecked } });
        onCheckedChange?.(resolvedChecked, { target: { checked: resolvedChecked } });
      }}
      onClick={onClick}
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
    <AppButton className={cx(icon && 'is-icon', className)} type={type} variant={danger ? 'danger' : 'secondary'} {...props}>
      {children}
    </AppButton>
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
