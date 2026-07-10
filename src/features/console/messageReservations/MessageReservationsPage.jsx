'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Circle, Copy, Ellipsis, Eye, Trash2 } from 'lucide-react';
import { PageHeader } from '../../../components/layout/index.js';
import {
  Badge,
  Button,
  ConfirmationDialog,
  DataTableV2,
  DatePickerPresets,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  SegmentedControl,
  useToast,
} from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import { useConsoleNavigation } from '../ConsoleNavigationContext.jsx';
import { useMessageReservationCancelMutation } from './mutations.js';
import {
  useMessageReservationGroupDetailQuery,
  useMessageReservationGroupsQuery,
} from './queries.js';
import {
  MESSAGE_RESERVATION_CHANNEL_OPTIONS,
  MESSAGE_RESERVATION_DATE_PRESETS,
  canCancelMessageReservationGroup,
  formatMessageReservationBatchLabel,
  formatMessageReservationBatchRecipientCount,
  formatMessageReservationBatchResult,
  formatMessageReservationBatchSuccessRate,
  formatMessageReservationDate,
  formatMessageReservationGroupCounts,
  getMessageReservationManagementTitle,
  formatMessageReservationRecipientCount,
  formatMessageReservationSuccessRate,
  getDefaultMessageReservationRange,
  getMessageReservationFiltersFromSearchParams,
  getMessageReservationBatchRowId,
  getMessageReservationBatchStatus,
  getMessageReservationGroupRowId,
  getMessageReservationGroupStatus,
  getMessageReservationPageTotal,
  getMessageReservationRecipientRowId,
  getMessageReservationRecipientStatus,
  getReservationChannelLabel,
  toMessageReservationQueryParams,
  toMessageReservationUrlParams,
} from './selectors.js';

const EMPTY_RESERVATION_GROUPS = [];

export function MessageReservationsPage() {
  const navigation = useConsoleNavigation();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const searchParamText = searchParams.toString();
  const filters = useMemo(
    () => getMessageReservationFiltersFromSearchParams(new URLSearchParams(searchParamText)),
    [searchParamText]
  );
  const queryFilters = useMemo(() => toMessageReservationQueryParams(filters), [filters]);
  const groupsQuery = useMessageReservationGroupsQuery(queryFilters);
  const cancelMutation = useMessageReservationCancelMutation();
  const [selectedGroupIdentity, setSelectedGroupIdentity] = useState(null);
  const [pendingCancelGroup, setPendingCancelGroup] = useState(null);
  const [openMenuGroupId, setOpenMenuGroupId] = useState(null);
  const groupDetailQuery = useMessageReservationGroupDetailQuery(selectedGroupIdentity);
  const mode = searchParams.get('mode') === 'embed' ? 'embed' : null;
  const shouldShowStatusPreviewGroups = process.env.NODE_ENV !== 'production'
    && searchParams.get('statusPreview') === '1';
  const today = useMemo(() => startOfDay(new Date()), []);
  const datePickerMinDate = today;
  const datePickerMaxDate = useMemo(() => addDays(today, 59), [today]);
  const statusPreviewGroups = useMemo(
    () => (shouldShowStatusPreviewGroups ? getMessageReservationStatusPreviewGroups(today) : []),
    [shouldShowStatusPreviewGroups, today]
  );
  const sourceGroups = groupsQuery.data?.groups ?? EMPTY_RESERVATION_GROUPS;
  const groups = groupsQuery.isPending ? EMPTY_RESERVATION_GROUPS : [...statusPreviewGroups, ...sourceGroups];
  const total = getMessageReservationPageTotal(groupsQuery.data)
    + (groupsQuery.isPending ? 0 : statusPreviewGroups.length);

  function replaceFilters(nextFilters) {
    const nextParams = toMessageReservationUrlParams({
      ...filters,
      ...nextFilters,
    }, mode);

    closeGroupDetail();
    setPendingCancelGroup(null);
    setOpenMenuGroupId(null);
    navigation.replace(`/reservations?${nextParams.toString()}`);
  }

  function openGroupDetail(group) {
    if (group?.isPreview) return;

    setOpenMenuGroupId(null);
    navigation.push(`/reservations/${encodeURIComponent(group.id)}?${toMessageReservationUrlParams(filters, mode).toString()}`);
  }

  function closeGroupDetail() {
    setSelectedGroupIdentity(null);
  }

  async function cancelReservationGroup(group) {
    if (!group || group.isPreview || !canCancelMessageReservationGroup(group) || cancelMutation.isPending) {
      return;
    }

    try {
      setOpenMenuGroupId(null);
      const result = await cancelMutation.mutateAsync(getGroupIdentity(group, queryFilters));
      setPendingCancelGroup(null);
      showToast({
        description: `${result.canceledCount}건 취소 요청을 완료했습니다.`,
        title: '예약 취소 완료',
        variant: 'success',
      });
      groupsQuery.refetch();
      if (isSameGroupIdentity(selectedGroupIdentity, group)) {
        groupDetailQuery.refetch();
      }
    } catch (error) {
      showToast({
        description: getRelayErrorMessage(error, '예약 취소 요청을 처리하지 못했습니다.'),
        title: '예약 취소 실패',
        variant: 'critical',
      });
    }
  }

  async function copyReservationId(group) {
    const copyId = getReservationCopyId(group);
    if (!copyId) return;

    try {
      await writeClipboard(copyId);
      setOpenMenuGroupId(null);
      showToast({
        description: copyId,
        title: '예약 ID를 복사했습니다.',
        variant: 'success',
      });
    } catch {
      showToast({
        description: '클립보드에 예약 ID를 복사하지 못했습니다.',
        title: '복사 실패',
        variant: 'critical',
      });
    }
  }

  return (
    <section className="page-frame message-logs-page message-reservations-page">
      <PageHeader title="예약" />

      <div className="message-logs-toolbar">
        <DatePickerPresets
          defaultRange={{ from: filters.from, to: filters.to }}
          key={`${filters.from.getTime()}-${filters.to.getTime()}`}
          maxDate={datePickerMaxDate}
          minDate={datePickerMinDate}
          onRangeChange={(range) => replaceFilters({ ...range, page: 1 })}
          presets={MESSAGE_RESERVATION_DATE_PRESETS}
          referenceDate={today}
        />
        <SegmentedControl
          className="message-reservations-channel-tabs"
          items={MESSAGE_RESERVATION_CHANNEL_OPTIONS}
          onValueChange={(channel) => replaceFilters({ channel, page: 1 })}
          value={filters.channel}
        />
      </div>

      {groupsQuery.isError ? (
        <div className="message-send-api-status message-logs-status" data-tone="critical" role="alert">
          <span>{getRelayErrorMessage(groupsQuery.error, '예약 현황을 불러오지 못했습니다.')}</span>
          <Button onClick={() => groupsQuery.refetch()}>다시 시도</Button>
        </div>
      ) : null}

      <DataTableV2
        actionsClassName="is-email-actions is-reservation-actions"
        columns={[
          {
            accessor: getMessageReservationManagementTitle,
            className: 'is-reservation-content',
            header: '관리용 제목',
            cell: ({ value }) => <span className="resend-email-subject-text">{value}</span>,
          },
          { accessor: (group) => getReservationChannelLabel(group.channel), className: 'is-reservation-channel', header: '채널' },
          {
            accessor: (group) => group.senderLabel || '-',
            className: 'is-reservation-sender',
            header: '발신 리소스',
            cell: ({ value }) => <span className="message-reservations-sender">{value}</span>,
          },
          {
            accessor: formatMessageReservationRecipientCount,
            className: 'is-reservation-recipients',
            header: '수신자',
            cell: ({ value }) => <span className="message-reservations-count">{value}</span>,
          },
          {
            accessor: getMessageReservationGroupStatus,
            className: 'is-reservation-status',
            header: '상태',
            cell: ({ value }) => <MessageReservationV2Status status={value} />,
          },
          {
            accessor: (group) => formatMessageReservationDate(group.requestDate),
            className: 'is-reservation-date',
            header: '예약일시',
          },
          {
            accessor: formatMessageReservationSuccessRate,
            className: 'is-reservation-rate',
            header: '성공률',
            cell: ({ value }) => <span className="message-reservations-rate">{value}</span>,
          },
        ]}
        data={groupsQuery.isPending ? [] : groups}
        empty={<span className="admin-empty-row">선택한 기간에 표시할 예약이 없습니다.</span>}
        getRowId={getMessageReservationGroupRowId}
        loading={groupsQuery.isPending}
        loadingSlot={(
          <span className="admin-state-row">
            <Circle aria-hidden="true" size={18} />
            예약 현황을 불러오는 중입니다.
          </span>
        )}
        renderPagination={() => (
          <MessageReservationsV2Pagination
            onPageChange={(page) => replaceFilters({ page })}
            onPageSizeChange={(pageSize) => replaceFilters({ page: 1, pageSize })}
            page={filters.page}
            pageSize={filters.pageSize}
            pageSizeOptions={[20, 50, 100]}
            total={total}
          />
        )}
        rowActions={({ row }) => {
          const rowId = getMessageReservationGroupRowId(row);

          return (
            <MessageReservationRowActions
              cancelMutation={cancelMutation}
              group={row}
              isOpen={openMenuGroupId === rowId}
              onCancelClick={(nextGroup) => {
                setOpenMenuGroupId(null);
                setPendingCancelGroup(nextGroup);
              }}
              onCopyRequestId={copyReservationId}
              onOpenChange={(open) => setOpenMenuGroupId(open ? rowId : null)}
              onOpenDetail={openGroupDetail}
            />
          );
        }}
        shellClassName="message-reservations-table-shell"
        tableClassName="message-reservations-table-v2"
      />

      <ConfirmationDialog
        cancelLabel="닫기"
        confirmLabel="예약 취소"
        description={pendingCancelGroup
          ? `${getReservationChannelLabel(pendingCancelGroup.channel)} 예약 ${getReservationDisplayId(pendingCancelGroup)}의 예약 중 수신자 ${pendingCancelGroup.reservedCount}건을 취소합니다.`
          : ''}
        destructive
        onConfirm={() => cancelReservationGroup(pendingCancelGroup)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCancelGroup(null);
          }
        }}
        open={Boolean(pendingCancelGroup)}
        title="예약을 취소할까요?"
      />

      <MessageReservationGroupDetailDrawer
        cancelMutation={cancelMutation}
        groupDetailQuery={groupDetailQuery}
        onCancelGroup={cancelReservationGroup}
        onClose={closeGroupDetail}
        selectedGroup={selectedGroupIdentity}
      />
    </section>
  );
}

function MessageReservationRowActions({
  cancelMutation,
  group,
  isOpen,
  onCancelClick,
  onCopyRequestId,
  onOpenChange,
  onOpenDetail,
}) {
  return (
    <div className="resend-email-actions">
      <DropdownMenu onOpenChange={onOpenChange} open={isOpen}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="예약 작업"
            className="message-reservations-action-trigger"
            type="button"
          >
            <Ellipsis size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="resend-email-menu message-reservations-row-menu"
          sideOffset={4}
        >
          {!group.isPreview ? (
            <DropdownMenuItem onSelect={() => onOpenDetail(group)}>
              <Eye aria-hidden="true" size={14} />
              상세보기
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => onCopyRequestId(group)}>
            <Copy aria-hidden="true" size={14} />
            Copy ID
          </DropdownMenuItem>
          {!group.isPreview && canCancelMessageReservationGroup(group) ? (
            <DropdownMenuItem
              className="is-danger"
              disabled={cancelMutation.isPending}
              onSelect={() => onCancelClick(group)}
            >
              <Trash2 aria-hidden="true" size={14} />
              예약 취소
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function MessageReservationV2Status({ status }) {
  return (
    <span className={`resend-email-status message-reservation-status-chip is-${getReservationV2StatusTone(status?.state)}`}>
      {status?.label ?? '상태 확인 불가'}
    </span>
  );
}

function MessageReservationsV2Pagination({
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  pageSizeOptions,
  total,
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(total, currentPage * pageSize);

  return (
    <div className="resend-email-pagination message-reservations-v2-pagination">
      <p>
        <strong>{from}-{to}</strong>
        <span> / {total}건</span>
        <span> - </span>
        <select
          aria-label="페이지당 예약 수"
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          value={pageSize}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>{option}개</option>
          ))}
        </select>
      </p>
      <div>
        <button disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} type="button">
          이전
        </button>
        <button disabled={currentPage >= pageCount} onClick={() => onPageChange(currentPage + 1)} type="button">
          다음
        </button>
      </div>
    </div>
  );
}

function getMessageReservationStatusPreviewGroups(today) {
  return [
    {
      aggregateState: 'reserved',
      channel: 'sms',
      counts: { recipientCount: 12, reservedCount: 12 },
      label: '예약됨',
      templateCode: '-',
    },
    {
      aggregateState: 'sending',
      channel: 'alimtalk',
      counts: { recipientCount: 8, sendingCount: 8 },
      label: '발송 중',
      templateCode: 'ALIMTALK_STATUS_PREVIEW',
    },
    {
      aggregateState: 'completed',
      channel: 'brand-message',
      counts: { completedCount: 19, failedCount: 1, recipientCount: 20 },
      label: '완료됨',
      templateCode: 'BRAND_STATUS_PREVIEW',
    },
    {
      aggregateState: 'canceled',
      channel: 'sms',
      counts: { canceledCount: 10, recipientCount: 10 },
      label: '취소됨',
      templateCode: '-',
    },
    {
      aggregateState: 'failed',
      channel: 'alimtalk',
      counts: { failedCount: 9, recipientCount: 9 },
      label: '실패',
      templateCode: 'ALIMTALK_STATUS_FAIL',
    },
    {
      aggregateState: 'unknown',
      channel: 'brand-message',
      counts: { pendingCount: 6, recipientCount: 6 },
      label: '상태 확인 불가',
      templateCode: 'BRAND_STATUS_UNKNOWN',
    },
  ].map((preview, index) => ({
    aggregateState: preview.aggregateState,
    canceledCount: preview.counts.canceledCount ?? 0,
    channel: preview.channel,
    completedCount: preview.counts.completedCount ?? 0,
    contentPreview: `상태 칩 목업 - ${preview.label}`,
    failedCount: preview.counts.failedCount ?? 0,
    id: `status-preview-${preview.aggregateState}`,
    isPreview: true,
    pendingCount: preview.counts.pendingCount ?? 0,
    recipientCount: preview.counts.recipientCount,
    requestDate: getStatusPreviewRequestDate(today, index),
    requestId: `status-preview-${preview.aggregateState}`,
    reservedCount: preview.counts.reservedCount ?? 0,
    senderLabel: '상태 칩 목업',
    senderResourceId: 'status-preview-sender',
    sendingCount: preview.counts.sendingCount ?? 0,
    templateCode: preview.templateCode,
  }));
}

function getStatusPreviewRequestDate(today, index) {
  const nextDate = addDays(today, index + 1);
  nextDate.setHours(10 + index, 0, 0, 0);
  return nextDate.toISOString();
}

function getReservationV2StatusTone(state) {
  switch (state) {
    case 'reserved':
      return 'reserved';
    case 'sending':
      return 'sending';
    case 'completed':
      return 'completed';
    case 'canceled':
      return 'canceled';
    case 'failed':
      return 'failed';
    default:
      return 'unknown';
  }
}

function MessageReservationGroupDetailDrawer({
  cancelMutation,
  groupDetailQuery,
  onCancelGroup,
  onClose,
  selectedGroup,
}) {
  const group = groupDetailQuery.data?.group;
  const batches = groupDetailQuery.data?.batches ?? [];
  const recipients = groupDetailQuery.data?.recipients ?? [];
  const groupStatus = group ? getMessageReservationGroupStatus(group) : null;
  const groupDescription = selectedGroup?.displayId
    ? `${getReservationChannelLabel(selectedGroup.rowChannel ?? selectedGroup.channel)} / ${selectedGroup.displayId}`
    : '예약 상세를 불러옵니다.';

  return (
    <Drawer onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }} open={Boolean(selectedGroup)}>
      <DrawerContent className="message-log-drawer">
        <DrawerHeader>
          <DrawerTitle>예약 상세</DrawerTitle>
          <DrawerDescription>{groupDescription}</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          {groupDetailQuery.isPending ? (
            <span className="admin-state-row">
              <Circle aria-hidden="true" size={18} />
              예약 상세를 불러오는 중입니다.
            </span>
          ) : null}

          {groupDetailQuery.isError ? (
            <div className="message-send-api-status message-logs-status" data-tone="critical" role="alert">
              <span>{getRelayErrorMessage(groupDetailQuery.error, '예약 상세를 불러오지 못했습니다.')}</span>
              <Button onClick={() => groupDetailQuery.refetch()}>다시 시도</Button>
            </div>
          ) : null}

          {group ? (
            <>
              <div className="message-log-detail-grid">
                <MessageReservationDetailItem label="채널" value={getReservationChannelLabel(group.channel)} />
                <MessageReservationDetailItem label="상태" value={groupStatus?.label ?? '-'} />
                <MessageReservationDetailItem label="성공률" value={formatMessageReservationSuccessRate(group)} />
                <MessageReservationDetailItem label="발신 리소스" value={group.senderLabel} />
                <MessageReservationDetailItem label="수신자" value={formatMessageReservationRecipientCount(group)} />
                <MessageReservationDetailItem label="처리 현황" value={formatMessageReservationGroupCounts(group)} />
                <MessageReservationDetailItem label="관리용 제목" value={getMessageReservationManagementTitle(group)} />
                <MessageReservationDetailItem label="요청 ID" value={group.representativeRequestId ?? group.requestId ?? group.id} />
                <MessageReservationDetailItem label="템플릿" value={group.templateCode || '-'} />
                <MessageReservationDetailItem label="예약일시" value={formatMessageReservationDate(group.requestDate)} />
              </div>

              {group.groupType === 'bulk_run' ? (
                <MessageReservationBatchTable batches={batches} />
              ) : (
                <MessageReservationRecipientTable recipients={recipients} />
              )}

              <div className="message-log-detail-json">
                <span>내용</span>
                <pre>{group.contentPreview || '-'}</pre>
              </div>

              {cancelMutation.isError ? (
                <div className="message-send-api-status message-logs-status" data-tone="critical" role="alert">
                  <span>{getRelayErrorMessage(cancelMutation.error, '예약 취소 요청을 처리하지 못했습니다.')}</span>
                </div>
              ) : null}
            </>
          ) : null}
        </DrawerBody>
        <DrawerFooter>
          <Button onClick={onClose}>닫기</Button>
          {group && !group.isPreview && canCancelMessageReservationGroup(group) ? (
            <ConfirmationDialog
              cancelLabel="닫기"
              confirmLabel="예약 취소"
              description={`${getReservationChannelLabel(group.channel)} 예약 ${getReservationDisplayId(group)}의 예약 중 수신자 ${group.reservedCount}건을 취소합니다.`}
              destructive
              onConfirm={() => onCancelGroup(group)}
              title="예약을 취소할까요?"
            >
              <Button disabled={cancelMutation.isPending} variant="danger">
                <Trash2 aria-hidden="true" size={15} />
                {cancelMutation.isPending ? '취소 중...' : '예약 취소'}
              </Button>
            </ConfirmationDialog>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function MessageReservationBatchTable({ batches }) {
  return (
    <section className="message-log-detail-section">
      <h3>예약 배치</h3>
      <DataTableV2
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
            className: 'is-recipient-status',
            header: '상태',
            cell: ({ value }) => <Badge tone={value.tone}>{value.label}</Badge>,
          },
          {
            accessor: (batch) => formatMessageReservationDate(batch.requestDate),
            className: 'is-recipient-date',
            header: '예약일시',
          },
          { accessor: formatMessageReservationBatchSuccessRate, header: '성공률' },
          { accessor: formatMessageReservationBatchResult, header: '결과' },
        ]}
        data={batches}
        empty={<span className="admin-empty-row">표시할 배치 예약이 없습니다.</span>}
        fixed
        getRowId={getMessageReservationBatchRowId}
        scrollClassName="message-log-recipient-table"
        tableClassName="message-log-recipient-data-table"
        withShell={false}
      />
    </section>
  );
}

function MessageReservationRecipientTable({ recipients }) {
  return (
    <section className="message-log-detail-section">
      <h3>예약 수신자</h3>
      <DataTableV2
        columns={[
          {
            accessor: (recipient) => recipient.recipientNo || '-',
            header: '수신자',
            cell: ({ value }) => <span className="message-logs-mono">{value}</span>,
          },
          { accessor: 'recipientSeq', className: 'is-recipient-seq', header: '순번' },
          {
            accessor: (recipient) => formatMessageReservationDate(recipient.requestDate),
            className: 'is-recipient-date',
            header: '예약일시',
          },
          {
            accessor: getMessageReservationRecipientStatus,
            className: 'is-recipient-status',
            header: '상태',
            cell: ({ value }) => <Badge tone={value.tone}>{value.label}</Badge>,
          },
          { accessor: (recipient) => recipient.resultMessage || recipient.resultCode || '-', header: '결과' },
        ]}
        data={recipients}
        empty={<span className="admin-empty-row">표시할 수신자 예약이 없습니다.</span>}
        fixed
        getRowId={getMessageReservationRecipientRowId}
        scrollClassName="message-log-recipient-table"
        tableClassName="message-log-recipient-data-table"
        withShell={false}
      />
    </section>
  );
}

function MessageReservationDetailItem({ label, value }) {
  return (
    <div className="message-log-detail-item">
      <span>{label}</span>
      <strong>{value === undefined || value === null || value === '' ? '-' : value}</strong>
    </div>
  );
}

function getGroupIdentity(group, queryFilters) {
  return {
    channel: queryFilters.channel,
    ...(queryFilters.devMockReservations ? { devMockReservations: queryFilters.devMockReservations } : {}),
    displayId: getReservationDisplayId(group),
    from: queryFilters.from,
    groupId: group.id,
    rowChannel: group.channel,
    to: queryFilters.to,
  };
}

function isSameGroupIdentity(identity, group) {
  return Boolean(
    identity?.groupId === group?.id
  );
}

function getReservationCopyId(group) {
  if (group?.groupType === 'bulk_run') {
    return group.id;
  }

  return group?.requestId ?? group?.representativeRequestId ?? group?.id;
}

function getReservationDisplayId(group) {
  return group?.requestId ?? group?.representativeRequestId ?? group?.id ?? '-';
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

function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}
