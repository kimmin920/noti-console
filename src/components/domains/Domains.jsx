'use client';

import { ChevronDown, Code2, Download, MoreHorizontal, Plus, Search } from 'lucide-react';
import Image from 'next/image';
import { DataTableV2 } from '../ui/index.js';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export const defaultDomainColumns = [
  { id: 'name', label: 'Domain', className: 'domains-table-column-domain' },
  { id: 'status', label: 'Status', className: 'domains-table-column-status' },
  { id: 'region', label: 'Region', className: 'domains-table-column-region' },
  { id: 'created', label: 'Created', className: 'domains-table-column-created' },
  { id: 'actions', label: '', className: 'domains-table-column-actions' },
];

export const defaultDomainEmptyState = {
  actionLabel: 'Add domain',
  description: 'Verify a domain by adding a DNS record and start sending and receiving emails from your own address.',
  title: 'No domains yet',
};

export function DomainsPage({
  addHref = '/domains/add',
  columns = defaultDomainColumns,
  domains = [],
  emptyState = defaultDomainEmptyState,
  isLoading = false,
  title = 'Domains',
}) {
  return (
    <DomainsRoot>
      <DomainsHeader title={title}>
        <DomainsActionButton href={addHref}>
          <Plus aria-hidden="true" size={16} />
          Add domain
        </DomainsActionButton>
        <DomainsIconButton icon={Code2} label="Open API drawer" />
      </DomainsHeader>
      <DomainsToolbar>
        <DomainsSearchInput placeholder="Search..." />
        <div className="domains-filter-grid">
          <DomainsFilterSelect aria-label="Filter domains by status" />
          <DomainsFilterSelect aria-label="Filter domains by region" />
        </div>
        <DomainsExportButton />
      </DomainsToolbar>
      {isLoading ? (
        <DomainsTableSkeleton columns={columns} />
      ) : domains.length > 0 ? (
        <DomainsTable columns={columns} rows={domains} />
      ) : (
        <DomainsEmptyState actionHref={addHref} {...emptyState} />
      )}
    </DomainsRoot>
  );
}

export function DomainsRoot({ children, className = '', ...props }) {
  return (
    <section className={cx('page-frame domains-page', className)} {...props}>
      {children}
    </section>
  );
}

export function DomainsHeader({ children, className = '', title = 'Domains', ...props }) {
  return (
    <div className={cx('domains-header', className)} {...props}>
      <h1>{title}</h1>
      <div className="domains-header-actions">{children}</div>
    </div>
  );
}

export function DomainsToolbar({ children, className = '', ...props }) {
  return (
    <div className={cx('domains-toolbar', className)} {...props}>
      {children}
    </div>
  );
}

export function DomainsSearchInput({ className = '', placeholder = 'Search...', ...props }) {
  return (
    <label className={cx('domains-search-field', className)}>
      <span className="visually-hidden">Search domains</span>
      <span aria-hidden="true" className="domains-search-icon">
        <Search size={16} />
      </span>
      <input placeholder={placeholder} type="text" {...props} />
    </label>
  );
}

export function DomainsFilterSelect({
  children = '',
  className = '',
  label = '',
  type = 'button',
  ...props
}) {
  const visibleLabel = children || label;

  return (
    <button className={cx('domains-select-trigger', className)} type={type} {...props}>
      <span>{visibleLabel}</span>
      <ChevronDown aria-hidden="true" size={16} />
    </button>
  );
}

export function DomainsActionButton({
  children,
  className = '',
  href,
  type = 'button',
  ...props
}) {
  const classNames = cx('domains-button domains-button-primary', className);

  if (href) {
    return (
      <a className={classNames} href={href} {...props}>
        {children}
      </a>
    );
  }

  return (
    <button className={classNames} type={type} {...props}>
      {children}
    </button>
  );
}

export function DomainsIconButton({ children, className = '', icon: Icon, label, type = 'button', ...props }) {
  return (
    <button aria-label={label} className={cx('domains-icon-button', className)} type={type} {...props}>
      {Icon ? <Icon aria-hidden="true" size={18} /> : null}
      {children}
    </button>
  );
}

export function DomainsExportButton({ className = '', label = 'Export', ...props }) {
  return (
    <DomainsIconButton
      className={cx('domains-export-button', className)}
      icon={Download}
      label={label}
      {...props}
    >
      <span>{label}</span>
    </DomainsIconButton>
  );
}

export function DomainsTable({ columns = defaultDomainColumns, rows = [], className = '', ...props }) {
  const actionColumn = columns.find((column) => column.id === 'actions');
  const dataColumns = columns
    .filter((column) => column.id !== 'actions')
    .map((column) => ({
      accessor: (row) => row[column.id] ?? '',
      className: column.className,
      header: column.label,
      id: column.id,
      cell: ({ row, value }) => {
        if (column.id === 'status') {
          return value ? <DomainsStatusBadge status={value}>{value}</DomainsStatusBadge> : null;
        }

        if (column.id === 'name') return row.name;

        return value;
      },
    }));

  return (
    <DataTableV2
      actionsClassName={actionColumn?.className ?? ''}
      columns={dataColumns}
      data={rows}
      getRowId={(row) => row.id ?? row.name}
      headProps={{ className: 'domains-table-head' }}
      rowActions={actionColumn ? ({ row }) => (
        <DomainsIconButton icon={MoreHorizontal} label={`Open ${row.name} actions`} />
      ) : undefined}
      scrollBaseClassName=""
      scrollClassName={cx('domains-table-shell', className)}
      tableBaseClassName=""
      tableClassName="domains-table-v2"
      withShell={false}
      {...props}
    />
  );
}

export function DomainsTableSkeleton({ columns = defaultDomainColumns, rowCount = 15 }) {
  const rows = Array.from({ length: rowCount }, (_, index) => index);

  return (
    <DataTableV2
      columns={columns.map((column) => ({
        accessor: () => column.id,
        className: column.className,
        header: column.label,
        id: column.id,
        cell: () => <DomainsSkeletonBar />,
      }))}
      data={rows}
      getRowId={(row) => String(row)}
      headProps={{ className: 'domains-table-head' }}
      rootProps={{ 'aria-busy': 'true' }}
      scrollBaseClassName=""
      scrollClassName="domains-table-shell"
      tableBaseClassName=""
      tableClassName="domains-table-v2"
      withShell={false}
    />
  );
}

export function DomainsSkeletonBar() {
  return (
    <div aria-hidden="true" className="domains-skeleton-cell">
      <div className="domains-skeleton-bar" />
    </div>
  );
}

export function DomainsStatusBadge({ children, className = '', status = '' }) {
  return (
    <span className={cx('domains-status-badge', status.toLowerCase().replaceAll(' ', '-'), className)}>
      {children}
    </span>
  );
}

export function DomainsEmptyState({
  actionHref = '/domains/add',
  actionLabel = 'Add domain',
  description = defaultDomainEmptyState.description,
  imageAlt = '',
  imageSrc = '/static/features/domains/domains-light-fallback.webp',
  title = 'No domains yet',
}) {
  return (
    <div className="domains-empty-state">
      <div className="domains-empty-content">
        <DomainsEmptyGraphic imageAlt={imageAlt} imageSrc={imageSrc} />
        <h2>{title}</h2>
        <span>{description}</span>
        <div className="domains-empty-actions">
          <DomainsActionButton href={actionHref}>
            <Plus aria-hidden="true" size={16} />
            {actionLabel}
          </DomainsActionButton>
        </div>
      </div>
    </div>
  );
}

export function DomainsEmptyGraphic({ imageAlt = '', imageSrc }) {
  return (
    <div className="domains-empty-graphic">
      <div aria-hidden="true" className="domains-empty-graphic-glow" />
      <div className="domains-empty-graphic-frame">
        <Image
          alt={imageAlt}
          className="domains-empty-graphic-image"
          height={120}
          src={imageSrc}
          width={120}
        />
      </div>
    </div>
  );
}

DomainsTable.Skeleton = DomainsTableSkeleton;
