'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Circle, FileText, RefreshCcw } from 'lucide-react';
import { PageHeader } from '../../../components/layout/index.js';
import { Button, DataTableV2, DatePickerPresets, FilterSelect, TablePagination, useToast } from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import { useMessageLogsExportMutation } from './mutations.js';
import { useMessageLogGroupsQuery } from './queries.js';
import { formatMessageLogGroupCounts, formatMessageLogDate, getChannelLabel, getDefaultMessageLogRange, getMessageLogGroupPageTotal, getMessageLogGroupDisplayPreview, getMessageLogGroupKindLabel, getMessageLogGroupResultSummary, getMessageLogGroupSentAt, getMessageLogGroupRowId, getMessageLogGroupSourceLabel, getMessageLogGroupStatus, getMessageLogFiltersFromSearchParams, MESSAGE_LOG_CHANNEL_OPTIONS, SMS_MESSAGE_TYPE_OPTIONS, toMessageLogQueryParams, toMessageLogUrlParams } from './selectors.js';
import { ConsoleLink, useConsoleNavigation } from '../ConsoleNavigationContext.jsx';
import { usePublClient } from '../../publClient/PublClientContext.jsx';
import { MessageLogsExportAction } from './MessageLogsExportAction.jsx';

export function MessageLogsPage() {
  const navigation = useConsoleNavigation();
  const publClient = usePublClient();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const searchParamText = searchParams.toString();
  const filters = useMemo(
    () => getMessageLogFiltersFromSearchParams(new URLSearchParams(searchParamText)),
    [searchParamText]
  );
  const queryFilters = useMemo(() => toMessageLogQueryParams(filters), [filters]);
  const groupsQuery = useMessageLogGroupsQuery(queryFilters);
  const exportMutation = useMessageLogsExportMutation();
  const groups = groupsQuery.data?.groups ?? [];
  const total = getMessageLogGroupPageTotal(groupsQuery.data);
  const mode = searchParams.get('mode') === 'embed' ? 'embed' : null;
  const datePickerMaxDate = useMemo(() => new Date(), []);
  const datePickerMinDate = useMemo(() => {
    const range = getDefaultMessageLogRange(datePickerMaxDate);
    const minDate = new Date(range.to);
    minDate.setDate(minDate.getDate() - 29);
    return minDate;
  }, [datePickerMaxDate]);

  function replaceFilters(nextFilters) {
    const nextChannel = nextFilters.channel ?? filters.channel;
    const nextParams = toMessageLogUrlParams({
      ...filters,
      ...nextFilters,
      messageType: nextChannel === 'sms' ? (nextFilters.messageType ?? filters.messageType) : 'all',
    }, mode);

    navigation.replace(`/logs?${nextParams.toString()}`);
  }

  async function exportLogs() {
    if (filters.demoCases) {
      showToast({
        description: '임시 케이스는 실제 발송기록이 아니어서 내보내지 않습니다.',
        title: '내보내기 제외',
        variant: 'default',
      });
      return;
    }

    try {
      const result = await exportMutation.mutateAsync({
        channel: queryFilters.channel,
        from: queryFilters.from,
        ...(queryFilters.messageType ? { messageType: queryFilters.messageType } : {}),
        to: queryFilters.to,
      });

      showToast({
        description: `${result.filename} 다운로드를 시작했습니다.`,
        title: '발송기록 내보내기 완료',
        variant: 'success',
      });
    } catch (error) {
      showToast({
        description: getRelayErrorMessage(error, '발송기록을 내보내지 못했습니다.'),
        title: '내보내기 실패',
        variant: 'critical',
      });
    }
  }

  return (
    <section className="page-frame message-logs-page">
      <PageHeader title="발송기록" />

      <div className="message-logs-toolbar">
        <div aria-label="발송 채널" className="message-log-channel-tabs" role="tablist">
          {MESSAGE_LOG_CHANNEL_OPTIONS.map((option) => (
            <button
              aria-selected={filters.channel === option.value}
              className={filters.channel === option.value ? 'is-active' : ''}
              key={option.value}
              onClick={() => replaceFilters({ channel: option.value, messageType: 'all', page: 1 })}
              role="tab"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <DatePickerPresets
          defaultRange={{ from: filters.from, to: filters.to }}
          key={`${filters.from.getTime()}-${filters.to.getTime()}`}
          maxDate={datePickerMaxDate}
          minDate={datePickerMinDate}
          onRangeChange={(range) => replaceFilters({ ...range, page: 1 })}
        />
        {filters.channel === 'sms' ? (
          <FilterSelect
            label="메시지 유형"
            onValueChange={(messageType) => replaceFilters({ messageType, page: 1 })}
            options={SMS_MESSAGE_TYPE_OPTIONS}
            value={filters.messageType}
          />
        ) : null}
        <Button
          disabled={groupsQuery.isFetching}
          onClick={() => groupsQuery.refetch()}
          variant="secondary"
        >
          <RefreshCcw aria-hidden="true" size={15} />
          새로고침
        </Button>
        <MessageLogsExportAction
          disabled={filters.demoCases || exportMutation.isPending}
          isPending={exportMutation.isPending}
          isPublEmbed={publClient.isPublEmbed}
          onExport={exportLogs}
        />
      </div>

      {groupsQuery.isError ? (
        <div className="message-send-api-status message-logs-status" data-tone="critical" role="alert">
          <span>{getRelayErrorMessage(groupsQuery.error, '발송기록을 불러오지 못했습니다.')}</span>
          <Button onClick={() => groupsQuery.refetch()}>다시 시도</Button>
        </div>
      ) : null}

      {filters.demoCases ? (
        <div className="message-send-api-status message-logs-status" role="status">
          <span>임시 케이스를 표시 중입니다. 실제 발송기록에는 저장되지 않습니다.</span>
        </div>
      ) : null}

      <DataTableV2
        actionsClassName="is-email-actions is-log-actions"
        columns={[
          {
            accessor: getMessageLogGroupSentAt,
            className: 'is-log-complete-date',
            header: '발송 시간',
            cell: ({ value }) => formatMessageLogDate(value),
          },
          {
            accessor: getMessageLogGroupDisplayPreview,
            className: 'is-log-content',
            header: '내용',
            cell: ({ value }) => <span className="resend-email-subject-text">{value}</span>,
          },
          { accessor: getMessageLogGroupSourceLabel, className: 'is-log-source', header: '발송 구분' },
          { accessor: (group) => getChannelLabel(group.channel), className: 'is-log-channel', header: '채널' },
          { accessor: getMessageLogGroupKindLabel, className: 'is-log-kind', header: '구분' },
          {
            accessor: (group) => group.senderLabel || '-',
            className: 'is-log-sender',
            header: '발신 리소스',
            cell: ({ value }) => <span className="message-logs-cell-strong">{value}</span>,
          },
          {
            accessor: formatMessageLogGroupCounts,
            className: 'is-log-recipients',
            header: '수신자',
            cell: ({ value }) => <span className="message-logs-counts">{value}</span>,
          },
          {
            accessor: getMessageLogGroupStatus,
            className: 'is-log-status',
            header: '접수',
            cell: ({ value }) => <MessageLogV2Status status={value} />,
          },
          {
            accessor: getMessageLogGroupResultSummary,
            className: 'is-log-result',
            header: '결과',
            cell: ({ value }) => <span className="message-log-result-summary">{value}</span>,
          },
        ]}
        data={groupsQuery.isPending ? [] : groups}
        empty={<span className="admin-empty-row">선택한 기간에 표시할 발송기록이 없습니다.</span>}
        getRowId={getMessageLogGroupRowId}
        loading={groupsQuery.isPending}
        loadingSlot={(
          <span className="admin-state-row">
            <Circle aria-hidden="true" size={18} />
            발송기록을 불러오는 중입니다.
          </span>
        )}
        renderPagination={() => (
          <TablePagination
            itemLabel="발송기록"
            onPageSizeChange={(pageSize) => replaceFilters({ page: 1, pageSize })}
            page={filters.page}
            pageSize={filters.pageSize}
            pageSizeOptions={[20, 50, 100]}
            total={total}
          />
        )}
        rowActions={({ row }) => (
          <div className="resend-email-actions">
            <ConsoleLink
              aria-label="발송 묶음 상세 보기"
              className="message-logs-action-trigger"
              href={getMessageLogGroupDetailHref({ filters, group: row, mode })}
              title="상세 보기"
            >
              <FileText aria-hidden="true" size={15} />
            </ConsoleLink>
          </div>
        )}
        shellClassName="message-logs-table-shell"
        tableClassName="message-logs-table-v2"
      />
    </section>
  );
}

function getMessageLogGroupDetailHref({ filters, group, mode }) {
  const params = toMessageLogUrlParams(filters, mode);
  return `/logs/${encodeURIComponent(group.id)}?${params.toString()}`;
}

function MessageLogV2Status({ label, status }) {
  return (
    <span className={`resend-email-status message-log-status-chip is-${getMessageLogV2StatusTone(status?.state)}`}>
      {label ?? status?.label ?? '상태 확인 불가'}
    </span>
  );
}

function getMessageLogV2StatusTone(state) {
  switch (state) {
    case 'success':
      return 'success';
    case 'failed':
    case 'partial':
      return 'failed';
    case 'pending':
      return 'pending';
    default:
      return 'unknown';
  }
}
