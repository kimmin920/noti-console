'use client';

import { Badge, DataTableV2 } from '../../../components/ui/index.js';
import {
  formatMessageReservationBatchLabel,
  formatMessageReservationBatchRecipientCount,
  formatMessageReservationBatchSuccessRate,
  formatMessageReservationDate,
  getMessageReservationBatchRowId,
  getMessageReservationBatchStatus,
  getMessageReservationRecipientRowId,
  getMessageReservationRecipientStatus,
} from './selectors.js';

export function BatchTable({ batches, onSelectBatch, selectedBatch }) {
  return (
    <DataTableV2
      actionsClassName=""
      columns={[
        { accessor: formatMessageReservationBatchLabel, header: '배치' },
        {
          accessor: (batch) => batch.providerRequestId || '-',
          header: '요청 ID',
          cell: ({ value }) => <span className="message-logs-mono">{value}</span>,
        },
        { accessor: formatMessageReservationBatchRecipientCount, header: '수신자' },
        {
          accessor: getMessageReservationBatchStatus,
          header: '상태',
          cell: ({ value }) => <Badge tone={value.tone}>{value.label}</Badge>,
        },
        { accessor: (batch) => formatMessageReservationDate(batch.requestDate), header: '예약일시' },
        { accessor: formatMessageReservationBatchSuccessRate, header: '성공률' },
      ]}
      data={batches}
      empty={<span className="admin-empty-row">표시할 배치 예약이 없습니다.</span>}
      fixed
      getRowId={getMessageReservationBatchRowId}
      rowActions={({ row }) => {
        const isSelected = row.providerRequestId === selectedBatch?.providerRequestId;

        return (
          <button
            aria-pressed={isSelected}
            className="message-reservation-detail-inline-action"
            onClick={() => onSelectBatch(row)}
            type="button"
          >
            수신자 보기
          </button>
        );
      }}
      rowClassName={({ row }) => (row.providerRequestId === selectedBatch?.providerRequestId ? 'is-selected' : '')}
      scrollClassName="message-reservation-detail-table-scroll"
      tableClassName="message-reservation-detail-batch-table"
      withShell={false}
    />
  );
}

export function RecipientTable({ isPending = false, loadingSlot = null, recipients }) {
  return (
    <DataTableV2
      columns={[
        {
          accessor: (recipient) => recipient.recipientNo || '-',
          header: '수신자',
          cell: ({ value }) => <span className="message-logs-mono">{value}</span>,
        },
        { accessor: 'recipientSeq', header: '순번' },
        { accessor: (recipient) => formatMessageReservationDate(recipient.requestDate), header: '예약일시' },
        {
          accessor: getMessageReservationRecipientStatus,
          header: '상태',
          cell: ({ value }) => <Badge tone={value.tone}>{value.label}</Badge>,
        },
        { accessor: (recipient) => recipient.resultMessage || recipient.resultCode || '-', header: '결과' },
      ]}
      data={isPending ? [] : recipients}
      empty={<span className="admin-empty-row">표시할 수신자가 없습니다.</span>}
      fixed
      getRowId={getMessageReservationRecipientRowId}
      loading={isPending}
      loadingSlot={loadingSlot}
      scrollClassName="message-reservation-detail-table-scroll"
      tableClassName="message-reservation-detail-recipient-table"
      withShell={false}
    />
  );
}

export function DetailPagination({ onPageChange, page, pageSize, total }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(total, currentPage * pageSize);

  return (
    <div className="message-reservation-detail-pagination">
      <span>{from}-{to} / {total}명</span>
      <div>
        <button disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} type="button">이전</button>
        <button disabled={currentPage >= pageCount} onClick={() => onPageChange(currentPage + 1)} type="button">다음</button>
      </div>
    </div>
  );
}
