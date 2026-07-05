'use client';

import { useState } from 'react';
import { Ellipsis, MailOpen, Trash2 } from 'lucide-react';
import { DataTableV2 } from '../components/ui/index.js';

const STATUSES = ['delivered', 'opened', 'clicked', 'bounced', 'failed', 'queued'];
const STATUS_META = {
  bounced: { label: 'Bounced', tone: 'warning' },
  clicked: { label: 'Clicked', tone: 'blue' },
  delivered: { label: 'Delivered', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  opened: { label: 'Opened', tone: 'blue' },
  queued: { label: 'Queued', tone: 'muted' },
};
const NAMES = ['alex', 'claire', 'devon', 'erika', 'fran', 'gavin', 'hana', 'ivan'];
const DOMAINS = ['acme.co', 'linear.app', 'orbit.dev', 'plain.com'];
const SUBJECTS = ['Your login link', 'Usage report is ready', 'New team invite', 'Broadcast scheduled'];

function createEmails(total) {
  return Array.from({ length: total }, (_, index) => {
    const suffix = String(index + 17).padStart(3, '0');
    return {
      id: `em_view_${index + 1}`,
      recipient: `${NAMES[index % NAMES.length]}.${suffix}@${DOMAINS[(index * 3) % DOMAINS.length]}`,
      sentAt: index < 6 ? `${index * 7 + 4}m ago` : `${Math.floor(index / 6)}h ago`,
      status: STATUSES[(index * 5) % STATUSES.length],
      subject: `${SUBJECTS[(index * 7) % SUBJECTS.length]} #${suffix}`,
    };
  });
}

function EmailStatus({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.queued;
  return <span className={`resend-email-status is-${meta.tone}`}>{meta.label}</span>;
}

function GenericPagination({ table, totalRows }) {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageCount = table.getPageCount();

  return (
    <div className="resend-email-pagination">
      <p>
        Page {pageIndex + 1} - {pageCount} of {totalRows} emails -
        <select
          aria-label="Rows per page"
          onChange={(event) => table.setPageSize(Number(event.target.value))}
          value={pageSize}
        >
          {[20, 40, 80].map((value) => (
            <option key={value} value={value}>
              {value} items
            </option>
          ))}
        </select>
      </p>
      <div>
        <button disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} type="button">
          Newer
        </button>
        <button disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} type="button">
          Older
        </button>
      </div>
    </div>
  );
}

export function EmailDataTableV2Demo({ loading = false, totalRows = 128 }) {
  const [rows, setRows] = useState(() => createEmails(totalRows));
  const [menuId, setMenuId] = useState(null);
  const columns = [
    {
      accessor: 'recipient',
      className: 'is-email-to',
      header: 'To',
      cell: ({ row, value }) => (
        <a
          className="resend-email-link"
          href={`/emails/${row.id}`}
          onClick={(event) => event.preventDefault()}
        >
          {value}
        </a>
      ),
    },
    {
      accessor: 'status',
      className: 'is-email-status-column',
      header: 'Status',
      cell: ({ value }) => <EmailStatus status={value} />,
    },
    {
      accessor: 'subject',
      className: 'is-email-subject',
      header: 'Subject',
      cell: ({ value }) => <div className="resend-email-subject-text">{value}</div>,
    },
    { accessor: 'sentAt', className: 'is-email-sent', header: 'Sent' },
  ];

  function deleteRows(selectedRows, clearSelection) {
    const selectedIds = new Set(selectedRows.map((row) => row.id));
    setRows((current) => current.filter((row) => !selectedIds.has(row.id)));
    clearSelection();
    setMenuId(null);
  }

  return (
    <DataTableV2
      actionsClassName="is-email-actions"
      bulkActions={({ clearSelection, selectedRows }) => (
        <>
          <DataTableV2.BulkActionButton onClick={clearSelection}>
            <MailOpen size={14} />
            Mark as read
          </DataTableV2.BulkActionButton>
          <DataTableV2.BulkActionButton danger onClick={() => deleteRows(selectedRows, clearSelection)}>
            <Trash2 size={14} />
            Delete
            <kbd>Backspace</kbd>
          </DataTableV2.BulkActionButton>
        </>
      )}
      columns={columns}
      data={rows}
      empty={<span className="admin-empty-row">No emails found.</span>}
      getRowId={(row) => row.id}
      initialPageSize={40}
      loading={loading}
      loadingRows={8}
      pagination
      renderPagination={({ table }) => <GenericPagination table={table} totalRows={rows.length} />}
      rowActions={({ row }) => (
        <div className="resend-email-actions">
          <button
            aria-expanded={menuId === row.id}
            aria-label={`Actions for ${row.recipient}`}
            onClick={() => setMenuId(menuId === row.id ? null : row.id)}
            type="button"
          >
            <Ellipsis size={16} />
          </button>
          {menuId === row.id ? (
            <div className="resend-email-menu">
              <button onClick={() => setMenuId(null)} type="button">View details</button>
              <button onClick={() => navigator.clipboard?.writeText(row.id)} type="button">Copy ID</button>
              <button onClick={() => deleteRows([row], () => {})} type="button">Delete</button>
            </div>
          ) : null}
        </div>
      )}
      selectable
      selectAllLabel="Select all emails on this page"
      selectedRowLabel={({ row }) => `Select ${row.recipient}`}
      selectionLayout="resend-edge"
      tableClassName="resend-email-table-v2"
    />
  );
}
