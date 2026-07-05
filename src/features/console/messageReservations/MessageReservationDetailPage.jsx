'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Circle, Copy, RefreshCcw, Trash2 } from 'lucide-react';
import { Button, ConfirmationDialog, useToast } from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import { useMessageReservationCancelMutation } from './mutations.js';
import { BatchTable, DetailPagination, RecipientTable } from './MessageReservationDetailTables.jsx';
import {
  useMessageReservationBatchRecipientsQuery,
  useMessageReservationGroupDetailQuery,
} from './queries.js';
import {
  canCancelMessageReservationGroup,
  formatMessageReservationBatchLabel,
  formatMessageReservationDate,
  formatMessageReservationGroupCounts,
  formatMessageReservationRecipientCount,
  formatMessageReservationSuccessRate,
  getMessageReservationFiltersFromSearchParams,
  getMessageReservationManagementTitle,
  getMessageReservationGroupStatus,
  getReservationChannelLabel,
  toMessageReservationQueryParams,
  toMessageReservationUrlParams,
} from './selectors.js';

const BATCH_RECIPIENT_PAGE_SIZE = 50;

export function MessageReservationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const searchParamText = searchParams.toString();
  const groupId = typeof params?.groupId === 'string' ? params.groupId : '';
  const mode = searchParams.get('mode') === 'embed' ? 'embed' : null;
  const filters = useMemo(
    () => getMessageReservationFiltersFromSearchParams(new URLSearchParams(searchParamText)),
    [searchParamText]
  );
  const queryFilters = useMemo(() => toMessageReservationQueryParams(filters), [filters]);
  const detailSelection = useMemo(() => ({ ...queryFilters, groupId }), [groupId, queryFilters]);
  const detailQuery = useMessageReservationGroupDetailQuery(detailSelection);
  const cancelMutation = useMessageReservationCancelMutation();
  const [selectedProviderRequestId, setSelectedProviderRequestId] = useState(null);
  const [batchPage, setBatchPage] = useState(1);
  const group = detailQuery.data?.group;
  const batches = detailQuery.data?.batches ?? [];
  const selectedBatch = batches.find((batch) => batch.providerRequestId === selectedProviderRequestId) ?? batches[0] ?? null;
  const batchRecipientsSelection = selectedBatch?.providerRequestId
    ? {
        ...detailSelection,
        page: batchPage,
        pageSize: BATCH_RECIPIENT_PAGE_SIZE,
        providerRequestId: selectedBatch.providerRequestId,
      }
    : null;
  const batchRecipientsQuery = useMessageReservationBatchRecipientsQuery(batchRecipientsSelection);
  const backHref = `/reservations?${toMessageReservationUrlParams(filters, mode).toString()}`;

  async function copyReservationId() {
    const copyId = group?.id ?? groupId;
    await writeClipboard(copyId);
    showToast({ description: copyId, title: '예약 ID를 복사했습니다.', variant: 'success' });
  }

  async function cancelReservationGroup() {
    if (!group || !canCancelMessageReservationGroup(group)) return;

    const result = await cancelMutation.mutateAsync(detailSelection);
    showToast({
      description: `${result.canceledCount}건 취소 요청을 완료했습니다.`,
      title: '예약 취소 완료',
      variant: 'success',
    });
    detailQuery.refetch();
    batchRecipientsQuery.refetch();
  }

  return (
    <section className="page-frame message-reservation-detail-page">
      <button className="message-reservation-detail-back" onClick={() => router.push(backHref)} type="button">
        <ChevronLeft aria-hidden="true" size={15} />
        예약 목록
      </button>

      {detailQuery.isPending ? <DetailState text="예약 상세를 불러오는 중입니다." /> : null}
      {detailQuery.isError ? (
        <DetailError error={detailQuery.error} fallback="예약 상세를 불러오지 못했습니다." onRetry={() => detailQuery.refetch()} />
      ) : null}
      {group ? (
        <>
          <DetailHeader
            cancelMutation={cancelMutation}
            group={group}
            onCancel={cancelReservationGroup}
            onCopy={copyReservationId}
            onRefresh={() => {
              detailQuery.refetch();
              batchRecipientsQuery.refetch();
            }}
          />
          <DetailSummary group={group} />
          {group.groupType === 'bulk_run' ? (
            <BulkDetail
              batchPage={batchPage}
              batchRecipientsQuery={batchRecipientsQuery}
              batches={batches}
              onPageChange={setBatchPage}
              onSelectBatch={(batch) => {
                setSelectedProviderRequestId(batch.providerRequestId);
                setBatchPage(1);
              }}
              selectedBatch={selectedBatch}
            />
          ) : (
            <RecipientTable recipients={detailQuery.data?.recipients ?? []} />
          )}
        </>
      ) : null}
    </section>
  );
}

function DetailHeader({ cancelMutation, group, onCancel, onCopy, onRefresh }) {
  const status = getMessageReservationGroupStatus(group);

  return (
    <header className="message-reservation-detail-header">
      <div>
        <h1>{getMessageReservationManagementTitle(group)}</h1>
        <span className={`resend-email-status message-reservation-status-chip is-${status.state}`}>{status.label}</span>
      </div>
      <div className="message-reservation-detail-actions">
        <Button onClick={onRefresh} variant="secondary"><RefreshCcw aria-hidden="true" size={15} />새로고침</Button>
        <Button onClick={onCopy} variant="secondary"><Copy aria-hidden="true" size={15} />Copy ID</Button>
        {canCancelMessageReservationGroup(group) ? (
          <ConfirmationDialog
            cancelLabel="닫기"
            confirmLabel="예약 취소"
            description={`예약 중 수신자 ${group.reservedCount}건을 취소합니다.`}
            destructive
            onConfirm={onCancel}
            title="예약을 취소할까요?"
          >
            <Button disabled={cancelMutation.isPending} variant="danger">
              <Trash2 aria-hidden="true" size={15} />
              {cancelMutation.isPending ? '취소 중...' : '예약 취소'}
            </Button>
          </ConfirmationDialog>
        ) : null}
      </div>
    </header>
  );
}

function DetailSummary({ group }) {
  return (
    <div className="message-reservation-detail-summary">
      <DetailItem label="채널" value={getReservationChannelLabel(group.channel)} />
      <DetailItem label="발신 리소스" value={group.senderLabel} />
      <DetailItem label="수신자" value={formatMessageReservationRecipientCount(group)} />
      <DetailItem label="예약일시" value={formatMessageReservationDate(group.requestDate)} />
      <DetailItem label="성공률" value={formatMessageReservationSuccessRate(group)} />
      <DetailItem label="처리 현황" value={formatMessageReservationGroupCounts(group)} />
    </div>
  );
}

function BulkDetail({ batchPage, batchRecipientsQuery, batches, onPageChange, onSelectBatch, selectedBatch }) {
  const recipientsData = batchRecipientsQuery.data;

  return (
    <div className="message-reservation-detail-grid-layout">
      <section className="message-reservation-detail-panel">
        <h2>예약 배치</h2>
        <BatchTable batches={batches} onSelectBatch={onSelectBatch} selectedBatch={selectedBatch} />
      </section>
      <section className="message-reservation-detail-panel">
        <h2>{selectedBatch ? `${formatMessageReservationBatchLabel(selectedBatch)} 수신자` : '배치 수신자'}</h2>
        {batchRecipientsQuery.isError ? (
          <DetailError error={batchRecipientsQuery.error} fallback="배치 수신자를 불러오지 못했습니다." onRetry={() => batchRecipientsQuery.refetch()} />
        ) : (
          <RecipientTable
            isPending={batchRecipientsQuery.isPending}
            loadingSlot={<DetailState text="수신자를 불러오는 중입니다." />}
            recipients={recipientsData?.recipients ?? []}
          />
        )}
        <DetailPagination
          onPageChange={onPageChange}
          page={batchPage}
          pageSize={BATCH_RECIPIENT_PAGE_SIZE}
          total={recipientsData?.total ?? 0}
        />
      </section>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="message-reservation-detail-item">
      <span>{label}</span>
      <strong>{value === undefined || value === null || value === '' ? '-' : value}</strong>
    </div>
  );
}

function DetailState({ text }) {
  return (
    <span className="admin-state-row">
      <Circle aria-hidden="true" size={18} />
      {text}
    </span>
  );
}

function DetailError({ error, fallback, onRetry }) {
  return (
    <div className="message-send-api-status message-logs-status" data-tone="critical" role="alert">
      <span>{getRelayErrorMessage(error, fallback)}</span>
      <Button onClick={onRetry}>다시 시도</Button>
    </div>
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
