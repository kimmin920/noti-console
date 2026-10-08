'use client';

import {
  AlertTriangle,
  ChevronLeft,
  Copy,
  FileText,
} from 'lucide-react';
import {
  Badge,
  Button,
  DataTableV2,
  TablePagination,
} from '../../../components/ui/index.js';
import {
  formatMessageLogDate,
  formatMessageLogGroupCounts,
  getChannelLabel,
  getMessageLogFailureReason,
  getMessageLogGroupDisplayPreview,
  getMessageLogGroupKindLabel,
  getMessageLogGroupProviderSummary,
  getMessageLogGroupSourceDetailItems,
  getMessageLogGroupSourceLabel,
  getMessageLogGroupStatus,
  getMessageLogStatus,
} from './selectors.js';
import { ConsoleLink } from '../ConsoleNavigationContext.jsx';

export const MESSAGE_LOG_DETAIL_FAILURE_PAGE_SIZE = 100;

export function MessageLogGroupDetailHeader({
  group,
  groupId,
  listHref,
  onCopyGroupId,
}) {
  const channelLabel = group ? getChannelLabel(group.channel) : '발송기록';
  const title = group ? getMessageLogGroupDisplayPreview(group) : groupId;

  return (
    <header className="resend-domain-header message-log-detail-header">
      <div className="resend-domain-status-icon message-log-detail-icon" aria-hidden="true">
        <FileText size={34} strokeWidth={1.6} />
      </div>
      <div className="resend-domain-title message-log-detail-title">
        <span>{channelLabel}</span>
        <h1 id="message-log-detail-title" title={title}>{title}</h1>
      </div>
      <div className="resend-domain-actions message-log-detail-actions">
        <ConsoleLink aria-label="발송기록 목록으로 돌아가기" className="resend-icon-button" href={listHref}>
          <ChevronLeft aria-hidden="true" size={16} />
        </ConsoleLink>
        <button aria-label="발송 묶음 ID 복사" className="resend-icon-button" onClick={onCopyGroupId} type="button">
          <Copy aria-hidden="true" size={15} />
        </button>
      </div>
    </header>
  );
}

export function MessageLogGroupDetailSummary({ group }) {
  const groupStatus = getMessageLogGroupStatus(group);
  const items = [
    { label: '상태', tone: toBadgeTone(groupStatus?.tone), value: groupStatus?.label ?? '-' },
    { label: '수신자', value: formatMessageLogGroupCounts(group) },
    { label: '결과', value: formatMessageLogDetailResultSummary(group) },
    { label: '발송 시간', value: formatMessageLogDate(group.requestDate) },
  ];

  return (
    <dl className="resend-domain-summary message-log-detail-summary">
      {items.map((item) => (
        <div className="resend-domain-summary-item" key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            {item.tone ? <Badge tone={item.tone}>{item.value}</Badge> : <span>{item.value}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function MessageLogDetailStatus({
  copy,
  onRetry,
  title,
  tone = 'neutral',
}) {
  return (
    <div className="template-detail-status message-log-detail-status" data-tone={tone} role={tone === 'critical' ? 'alert' : 'status'}>
      <h2>{title}</h2>
      <p>{copy}</p>
      {onRetry ? <button className="resend-auto-configure" onClick={onRetry} type="button">다시 시도</button> : null}
    </div>
  );
}

export function MessageLogResultSection({
  activeRequest,
  failurePage,
  failures,
  failuresError,
  failuresLoading,
  failuresTotal,
  onFailurePageChange,
  onRequestChange,
  onSelectFailure,
  requests,
  selectedFailure,
  selectedRecipientSeq,
}) {
  const requestFailureCount = Number(activeRequest?.failedCount ?? 0);
  const emptyCopy = getFailureEmptyCopy({ activeRequest, requestFailureCount });

  return (
    <section
      aria-labelledby="message-log-result-heading"
      className="resend-records-section message-log-result-section"
    >
      <div className="resend-records-accent" aria-hidden="true" />
      <div className="resend-records-header message-log-result-header">
        <div>
          <h3 id="message-log-result-heading">발송 결과</h3>
          <p>저장된 결과 스냅샷 기준으로 실패 수신자를 표시합니다.</p>
        </div>
        {activeRequest ? (
          <span className="message-log-result-count">
            실패 {requestFailureCount.toLocaleString('ko-KR')}명
          </span>
        ) : null}
      </div>

      {requests.length > 0 ? (
        <div className="resend-domain-tabs-root message-log-request-tabs-root" data-orientation="horizontal">
          <div className="resend-domain-tabs message-log-request-tabs" role="tablist" aria-label="발송 요청">
            {requests.map((request) => {
              const active = activeRequest?.id === request.id;
              return (
                <button
                  aria-selected={active}
                  data-active={active ? '' : undefined}
                  key={request.id}
                  onClick={() => onRequestChange(request)}
                  role="tab"
                  type="button"
                >
                  <span>{formatMessageLogRequestLabel(request)}</span>
                  <small>실패 {Number(request.failedCount ?? 0).toLocaleString('ko-KR')}</small>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {failuresError ? (
        <div className="message-log-inline-alert" role="alert">
          <AlertTriangle aria-hidden="true" size={16} />
          <span>{failuresError}</span>
        </div>
      ) : null}

      <DataTableV2
        actionsClassName="is-failure-action"
        actionsHeaderClassName="is-failure-action"
        columns={[
          {
            accessor: (failure) => failure.recipientNo || '-',
            cell: ({ value }) => <code className="message-log-detail-mono">{value}</code>,
            className: 'is-failure-recipient',
            header: '수신번호',
          },
          {
            accessor: 'recipientSeq',
            className: 'is-failure-seq',
            header: '순번',
          },
          {
            accessor: (failure) => failure.requestLabel || formatMessageLogRequestLabel(activeRequest),
            className: 'is-failure-request',
            header: '요청',
          },
          {
            accessor: getFailureReasonText,
            cellProps: ({ value }) => ({ title: value }),
            className: 'is-failure-reason',
            header: '실패 사유',
          },
          {
            accessor: (failure) => failure.resultCode || '-',
            cell: ({ value }) => <code className="message-log-detail-mono">{value}</code>,
            className: 'is-failure-code',
            header: '결과 코드',
          },
        ]}
        data={failures}
        empty={<span className="admin-empty-row">{emptyCopy}</span>}
        fixed
        getRowId={getMessageLogFailureRowId}
        getRowProps={({ row }) => ({
          'data-current': Number(row.recipientSeq) === Number(selectedRecipientSeq) ? 'true' : undefined,
        })}
        loading={failuresLoading}
        loadingSlot={<span className="admin-state-row">실패자 목록을 불러오는 중입니다.</span>}
        onRowClick={({ row }) => onSelectFailure(row)}
        rowActions={({ row }) => (
          <Button
            onClick={(event) => {
              event.stopPropagation();
              onSelectFailure(row);
            }}
            variant={Number(row.recipientSeq) === Number(selectedRecipientSeq) ? 'primary' : 'secondary'}
          >
            보기
          </Button>
        )}
        scrollClassName="message-log-detail-table-shell"
        tableClassName="message-log-detail-failure-table"
        withShell={false}
      />

      {failuresTotal > MESSAGE_LOG_DETAIL_FAILURE_PAGE_SIZE ? (
        <TablePagination
          itemLabel="실패"
          onPageSizeChange={() => onFailurePageChange(1)}
          page={failurePage}
          pageSize={MESSAGE_LOG_DETAIL_FAILURE_PAGE_SIZE}
          pageSizeOptions={[MESSAGE_LOG_DETAIL_FAILURE_PAGE_SIZE]}
          total={failuresTotal}
          unit="건"
        />
      ) : null}

      <MessageLogSelectedRecipientPanel
        detail={selectedFailure?.detail}
        failure={selectedFailure}
        selectedRecipientSeq={selectedRecipientSeq}
      />
    </section>
  );
}

export function MessageLogSelectedRecipientPanel({
  detail,
  failure,
  selectedRecipientSeq,
}) {
  const row = detail ?? failure;

  if (!selectedRecipientSeq || !row) {
    return null;
  }

  const status = detail ? getMessageLogStatus(detail) : { label: '실패', tone: 'critical' };
  const providerDetail = detail?.detail ?? {};
  const reason = getFailureReasonText(row);
  const content = providerDetail.content || '-';
  const recipientNo = providerDetail.recipientNo || row.recipientNo || '-';

  return (
    <div className="message-log-selected-recipient">
      <div className="message-log-selected-recipient-header">
        <h4>선택 수신자</h4>
        <span>{Number(selectedRecipientSeq).toLocaleString('ko-KR')}번</span>
      </div>
      <dl className="message-log-selected-recipient-grid">
        <MessageLogDetailItem label="수신번호" mono value={recipientNo} />
        <MessageLogDetailItem label="상태" value={status?.label ?? '-'} />
        <MessageLogDetailItem label="결과 코드" mono value={row.resultCode ?? '-'} />
        <MessageLogDetailItem label="실패 사유" value={reason} />
      </dl>
      <div className="message-log-detail-json">
        <span>내용</span>
        <pre>{content}</pre>
      </div>
    </div>
  );
}

export function MessageLogGroupMetadata({ group, requests }) {
  const sourceDetailItems = getMessageLogGroupSourceDetailItems(group);
  const items = [
    { label: '채널', value: getChannelLabel(group.channel) },
    { label: '발송 구분', value: getMessageLogGroupSourceLabel(group) },
    { label: '발신 리소스', value: group.senderLabel },
    { label: '구분', value: getMessageLogGroupKindLabel(group) },
    { label: '접수', value: getMessageLogGroupProviderSummary(group) },
    { label: '발송 요청 수', value: requests.length || group.providerRequestCount },
    { label: '묶음 ID', mono: true, value: group.id },
  ];

  return (
    <section
      aria-labelledby="message-log-metadata-heading"
      className="resend-records-section message-log-metadata-section"
    >
      <div className="resend-records-accent" aria-hidden="true" />
      <div className="resend-records-header">
        <h3 id="message-log-metadata-heading">발송 정보</h3>
      </div>
      <dl className="message-log-detail-definition-list">
        {items.map((item) => (
          <MessageLogDetailItem key={item.label} label={item.label} mono={item.mono} value={item.value} />
        ))}
      </dl>
      {sourceDetailItems.length > 0 ? (
        <>
          <div className="resend-record-section-divider" />
          <dl className="message-log-detail-definition-list">
            {sourceDetailItems.map((item) => (
              <MessageLogDetailItem key={item.label} label={item.label} value={item.value} />
            ))}
          </dl>
        </>
      ) : null}
    </section>
  );
}

export function MessageLogDetailItem({ label, mono = false, value }) {
  const displayValue = value === undefined || value === null || value === '' ? '-' : value;

  return (
    <div className="message-log-detail-definition-item">
      <dt>{label}</dt>
      <dd className={mono ? 'message-log-detail-mono' : undefined}>{displayValue}</dd>
    </div>
  );
}

export function formatMessageLogRequestLabel(request) {
  const sequence = Number(request?.sequence ?? 0);
  return sequence > 0 ? `요청 ${sequence.toLocaleString('ko-KR')}` : '요청';
}

export function getMessageLogFailureRowId(failure) {
  return [
    failure?.groupId,
    failure?.requestLocalId,
    failure?.recipientSeq,
  ].filter(Boolean).join(':');
}

export function getFailureReasonText(failure) {
  return getMessageLogFailureReason(failure) || failure?.resultMessage || failure?.resultCode || '실패';
}

function getFailureEmptyCopy({ activeRequest, requestFailureCount }) {
  if (!activeRequest) {
    return '표시할 발송 요청이 없습니다.';
  }

  if (requestFailureCount > 0) {
    return '저장된 실패자 번호가 없습니다.';
  }

  if (Number(activeRequest.pendingCount ?? 0) > 0) {
    return '아직 실패자가 확정되지 않았습니다.';
  }

  return '이 요청에는 실패자가 없습니다.';
}

function toBadgeTone(tone) {
  if (tone === 'green') return 'green';
  if (tone === 'critical') return 'critical';
  if (tone === 'warning') return 'yellow';
  return tone ? 'neutral' : null;
}

function formatMessageLogDetailResultSummary(group) {
  const successCount = Number(group?.successCount ?? 0);
  const failedCount = Number(group?.failedCount ?? 0);
  const canceledCount = Number(group?.canceledCount ?? 0);
  const pendingCount = Number(group?.pendingCount ?? 0);
  const parts = [
    `성공 ${successCount.toLocaleString('ko-KR')}`,
    `실패 ${failedCount.toLocaleString('ko-KR')}`,
  ];

  if (canceledCount > 0) {
    parts.push(`취소 ${canceledCount.toLocaleString('ko-KR')}`);
  }

  if (pendingCount > 0) {
    parts.push(`대기 ${pendingCount.toLocaleString('ko-KR')}`);
  }

  return parts.join(' · ');
}
