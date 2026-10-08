'use client';

import { useMemo, useState } from 'react';
import { MoreHorizontal, RefreshCcw, X } from 'lucide-react';
import { ActionMenu, ActionMenuContent, ActionMenuItem, ActionMenuTrigger, Badge, DataTableV2, IconButton, TablePagination, useToast } from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import { AutomationTableLoadError } from './AutomationTableLoadError.jsx';
import { useAutomationUnsentDeliveriesQuery, useAutomationUnsentDismissMutation, useAutomationUnsentResendMutation } from './queries.js';

const AUTOMATION_UNSENT_QUERY_LIMIT = 100;

const AUTOMATION_UNSENT_PAGE_SIZE_OPTIONS = [20, 50, 100];

const AUTOMATION_SEND_CHANNEL_LABELS = {
  alimtalk: '알림톡',
  'brand-message': '브랜드 메시지',
  lms: 'LMS',
  mms: 'MMS',
  sms: 'SMS',
};

const AUTOMATION_UNSENT_REASON_LABELS = {
  dispatch_failed: '발송 처리 실패',
  dispatch_validation_failed: '발송 조건 확인 필요',
  missing_registration: '발신 등록 필요',
  missing_rule: '자동화 규칙 필요',
  missing_sender_resource: '발신 수단 필요',
  missing_target_phone: '수신자 정보 필요',
  missing_template: '템플릿 확인 필요',
  missing_template_code: '템플릿 코드 필요',
  payload_validation_failed: '이벤트 데이터 보완 필요',
  provider_rejected: '제공자 거부',
  provider_unknown: '제공자 결과 미확인',
  unsupported_send_channel: '지원하지 않는 채널',
};

export function AutomationUnsentTable({ table: tableConfig }) {
  const { showToast } = useToast();
  const queryFilters = useMemo(() => ({ limit: AUTOMATION_UNSENT_QUERY_LIMIT }), []);
  const unsentQuery = useAutomationUnsentDeliveriesQuery(queryFilters);
  const resendMutation = useAutomationUnsentResendMutation();
  const dismissMutation = useAutomationUnsentDismissMutation();
  const [bulkAction, setBulkAction] = useState(null);
  const rows = Array.isArray(unsentQuery.data?.deliveries) ? unsentQuery.data.deliveries : [];
  const bulkPending = bulkAction !== null;
  const columns = useMemo(
    () => {
      const headers = tableConfig.columns ?? ['이벤트', '채널 코드', '발송 채널', '수신자', '사유', '수신 시각'];

      return [
        {
          accessor: (row) => row.eventDisplayName ?? row.eventKey,
          className: 'is-automation-unsent-event',
          header: headers[0],
          cell: ({ row }) => <AutomationUnsentEventCell delivery={row} />,
        },
        {
          accessor: (row) => row.channelCode,
          className: 'is-automation-unsent-channel-code',
          header: headers[1],
          cell: ({ value }) => <AutomationUnsentCode value={value} />,
        },
        {
          accessor: (row) => row.sendChannel,
          className: 'is-automation-unsent-send-channel',
          header: headers[2],
          cell: ({ value }) => (
            <Badge tone="neutral">
              {formatAutomationSendChannel(value)}
            </Badge>
          ),
        },
        {
          accessor: (row) => row.maskedRecipient,
          className: 'is-automation-unsent-recipient',
          header: headers[3],
          cell: ({ value }) => value || '없음',
        },
        {
          accessor: (row) => row.reasonCode,
          className: 'is-automation-unsent-reason',
          header: headers[4],
          cell: ({ row }) => <AutomationUnsentReasonCell delivery={row} />,
        },
        {
          accessor: (row) => row.receivedAt,
          className: 'is-automation-unsent-received',
          header: headers[5],
          cell: ({ value }) => formatAutomationUnsentDate(value),
        },
      ];
    },
    [tableConfig.columns]
  );

  async function resendDelivery(row) {
    try {
      const result = await resendMutation.mutateAsync({ deliveryId: row.id });
      const nextStatus = result?.delivery?.status;
      const reason = result?.delivery?.reasonCode ?? result?.sendResult?.reasonCode;

      showToast({
        description: nextStatus === 'sent'
          ? '자동화 발송 요청이 다시 접수되었습니다.'
          : `${getAutomationUnsentReasonLabel(reason)} 상태로 남아 있습니다.`,
        title: nextStatus === 'sent' ? '미발송 재시도 완료' : '미발송 재시도 보류',
        variant: nextStatus === 'sent' ? 'success' : 'warning',
      });
    } catch (error) {
      showToast({
        description: getRelayErrorMessage(error, '미발송 항목을 다시 발송하지 못했습니다.'),
        title: '미발송 재시도 실패',
        variant: 'critical',
      });
    }
  }

  async function dismissDelivery(row) {
    try {
      await dismissMutation.mutateAsync({ deliveryId: row.id });
      showToast({
        description: '미발송 목록에서 삭제했습니다.',
        title: '미발송 항목 삭제',
        variant: 'success',
      });
    } catch (error) {
      showToast({
        description: getRelayErrorMessage(error, '미발송 항목을 삭제하지 못했습니다.'),
        title: '미발송 삭제 실패',
        variant: 'critical',
      });
    }
  }

  async function resendSelectedDeliveries(selectedRows, clearSelection) {
    if (bulkPending || selectedRows.length === 0) return;

    setBulkAction('resend');

    let sentCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    try {
      for (const row of selectedRows) {
        try {
          const result = await resendMutation.mutateAsync({ deliveryId: row.id });

          if (result?.delivery?.status === 'sent') {
            sentCount += 1;
          } else {
            pendingCount += 1;
          }
        } catch {
          failedCount += 1;
        }
      }

      if (sentCount > 0 || pendingCount > 0) {
        clearSelection();
      }

      showToast({
        description: formatAutomationUnsentBulkResult({
          failedCount,
          pendingCount,
          pendingLabel: '보류',
          successCount: sentCount,
          successLabel: '재발송 접수',
        }),
        title: failedCount > 0 ? '선택 미발송 재시도 결과' : '선택 미발송 재시도 완료',
        variant: failedCount > 0 ? 'critical' : pendingCount > 0 ? 'warning' : 'success',
      });
    } finally {
      setBulkAction(null);
    }
  }

  async function dismissSelectedDeliveries(selectedRows, clearSelection) {
    if (bulkPending || selectedRows.length === 0) return;

    setBulkAction('dismiss');

    let dismissedCount = 0;
    let failedCount = 0;

    try {
      for (const row of selectedRows) {
        try {
          await dismissMutation.mutateAsync({ deliveryId: row.id });
          dismissedCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      if (dismissedCount > 0) {
        clearSelection();
      }

      showToast({
        description: formatAutomationUnsentBulkResult({
          failedCount,
          successCount: dismissedCount,
          successLabel: '삭제',
        }),
        title: failedCount > 0 ? '선택 미발송 삭제 결과' : '선택 미발송 삭제 완료',
        variant: failedCount > 0 ? 'critical' : 'success',
      });
    } finally {
      setBulkAction(null);
    }
  }

  if (unsentQuery.isError && rows.length === 0) {
    return (
      <AutomationTableLoadError
        message={getRelayErrorMessage(unsentQuery.error, '미발송 자동화 항목을 불러오지 못했습니다.')}
        onRetry={() => unsentQuery.refetch()}
        title="미발송 항목 로드 실패"
      />
    );
  }

  return (
    <DataTableV2
      actionsClassName="is-email-actions is-automation-unsent-actions table-actions"
      actionsHeaderClassName="is-email-actions is-automation-unsent-actions"
      bulkActionBarProps={({ selectedRows }) => ({
        'aria-label': '선택 미발송 항목 작업',
        clearLabel: '선택 해제',
        countLabel: `${selectedRows.length}개 선택됨`,
      })}
      bulkActions={({ clearSelection, selectedRows }) => (
        <>
          <DataTableV2.BulkActionButton
            disabled={bulkPending}
            onClick={() => resendSelectedDeliveries(selectedRows, clearSelection)}
          >
            <RefreshCcw size={14} />
            재발송
          </DataTableV2.BulkActionButton>
          <DataTableV2.BulkActionButton
            danger
            disabled={bulkPending}
            onClick={() => dismissSelectedDeliveries(selectedRows, clearSelection)}
          >
            <X size={14} />
            삭제
          </DataTableV2.BulkActionButton>
        </>
      )}
      columns={columns}
      data={rows}
      empty="표시할 미발송 항목이 없습니다."
      getRowId={(row) => row.id}
      initialPageSize={20}
      loading={unsentQuery.isLoading}
      loadingRows={6}
      loadingSlot={<span className="automation-unsent-loading" role="status">미발송 항목을 불러오는 중입니다.</span>}
      pagination
      renderPagination={({ table: dataTable }) => (
        <TablePagination
          itemLabel="미발송"
          pageSizeOptions={AUTOMATION_UNSENT_PAGE_SIZE_OPTIONS}
          table={dataTable}
          total={rows.length}
        />
      )}
      rowActions={({ row }) => (
        <AutomationUnsentRowActions
          disabled={bulkPending}
          dismissPending={dismissMutation.isPending && dismissMutation.variables?.deliveryId === row.id}
          onDismiss={() => dismissDelivery(row)}
          onResend={() => resendDelivery(row)}
          resendPending={resendMutation.isPending && resendMutation.variables?.deliveryId === row.id}
          row={row}
        />
      )}
      selectable
      selectAllLabel="모든 미발송 항목 선택"
      selectedRowLabel={({ row }) => `${row.eventDisplayName || row.eventKey || row.id} 선택`}
      selectionVisibility="hover"
      shellClassName="automation-unsent-data-table-shell"
      tableClassName="automation-unsent-data-table"
    />
  );
}

function formatAutomationUnsentBulkResult({
  failedCount = 0,
  pendingCount = 0,
  pendingLabel = '보류',
  successCount = 0,
  successLabel,
}) {
  const parts = [];

  if (successCount > 0) parts.push(`${successCount}건 ${successLabel}`);
  if (pendingCount > 0) parts.push(`${pendingCount}건 ${pendingLabel}`);
  if (failedCount > 0) parts.push(`${failedCount}건 실패`);

  return parts.length > 0 ? parts.join(', ') : '처리할 미발송 항목이 없습니다.';
}

function AutomationUnsentEventCell({ delivery }) {
  const primary = delivery.eventDisplayName || delivery.eventKey || '이벤트';

  return (
    <span className="automation-unsent-event-cell">
      <span className="automation-unsent-event-name">{primary}</span>
      <span className="automation-unsent-event-key" title={delivery.eventKey} translate="no">
        {delivery.eventKey || '-'}
      </span>
    </span>
  );
}

function AutomationUnsentCode({ value }) {
  return (
    <span className="automation-unsent-code" title={value} translate="no">
      {value || '-'}
    </span>
  );
}

function AutomationUnsentReasonCell({ delivery }) {
  const reasonCode = delivery.reasonCode ?? '';

  return (
    <span className="automation-unsent-reason-cell">
      <span className="automation-unsent-reason-label">{getAutomationUnsentReasonLabel(reasonCode)}</span>
      {reasonCode ? (
        <span className="automation-unsent-reason-code" translate="no">
          {reasonCode}
        </span>
      ) : null}
    </span>
  );
}

function AutomationUnsentRowActions({
  disabled = false,
  dismissPending,
  onDismiss,
  onResend,
  resendPending,
  row,
}) {
  const actionsDisabled = disabled || resendPending || dismissPending;
  const labelSource = row.eventDisplayName || row.eventKey || row.id;

  return (
    <div className="automation-unsent-action-buttons">
      <ActionMenu>
        <ActionMenuTrigger asChild>
          <IconButton
            disabled={actionsDisabled}
            icon={MoreHorizontal}
            label={`${labelSource} 작업 더보기`}
          />
        </ActionMenuTrigger>
        <ActionMenuContent align="end">
          <ActionMenuItem
            disabled={actionsDisabled}
            leadingVisual={<RefreshCcw size={16} />}
            onSelect={onResend}
          >
            재발송
          </ActionMenuItem>
          <ActionMenuItem
            disabled={actionsDisabled}
            leadingVisual={<X size={16} />}
            onSelect={onDismiss}
            variant="danger"
          >
            삭제
          </ActionMenuItem>
        </ActionMenuContent>
      </ActionMenu>
    </div>
  );
}

function formatAutomationSendChannel(value) {
  return AUTOMATION_SEND_CHANNEL_LABELS[value] ?? value ?? '-';
}

function getAutomationUnsentReasonLabel(reasonCode) {
  return AUTOMATION_UNSENT_REASON_LABELS[reasonCode] ?? '확인 필요';
}

function formatAutomationUnsentDate(value) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(date);
}
