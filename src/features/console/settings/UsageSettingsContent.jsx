'use client';

import { useMemo, useState } from 'react';
import { Circle, Plus } from 'lucide-react';

import {
  Badge,
  Button,
  DataTableV2,
  PropertyRow,
  SplitSection,
  useToast,
} from '../../../components/ui/index.js';
import { useConsoleNavigation } from '../ConsoleNavigationContext.jsx';
import { getRelayErrorMessage } from '../messageSend/api.js';
import {
  useLimitIncreaseRequestCreateMutation,
} from '../messageSend/mutations.js';
import {
  useLimitIncreaseRequestsQuery,
  useSenderResourcesQuery,
} from '../messageSend/queries.js';
import { getSettingsSenderResourceRows } from '../senderResourceSettingsRows.js';
import {
  formatLimitCount,
  formatLimitDateTime,
  getLimitRequestScopeLabel,
  getLimitRequestStatusLabel,
  getLimitRequestStatusTone,
  getLimitRequestTargetLabel,
} from './limitIncreaseRequestLabels.js';
import {
  KAKAO_SENDER_RESOURCE_TYPE,
  SMS_SENDER_RESOURCE_TYPE,
} from './senderResourceApplicationConfig.js';
import { LimitRequestDialog } from './UsageLimitRequestDialog.jsx';
import {
  buildRequestOptions,
  getActiveKakaoResources,
  getActiveSmsResources,
} from './usageLimitRows.js';

const INITIAL_FORM = {
  reason: '',
  requestedLimit: '',
  target: '',
};
const LIMIT_REQUEST_HISTORY_COLUMNS = [
  {
    accessor: (request) => getLimitRequestTargetLabel(request),
    className: 'is-limit-request-target',
    header: '신청 대상',
    cell: ({ row }) => <LimitRequestTargetCell request={row} />,
  },
  {
    accessor: (request) => request.requestedLimit,
    className: 'is-limit-request-change',
    header: '한도 변경',
    cell: ({ row }) => <LimitRequestChangeCell request={row} />,
  },
  {
    accessor: (request) => request.reason,
    className: 'is-limit-request-reason',
    header: '신청 사유',
    cell: ({ row }) => <LimitRequestReasonCell request={row} />,
  },
  {
    accessor: (request) => request.createdAt,
    className: 'is-limit-request-created-at',
    header: '신청일',
    cell: ({ value }) => formatLimitDateTime(value),
  },
  {
    accessor: (request) => request.status,
    className: 'is-limit-request-status',
    header: '상태',
    cell: ({ value }) => (
      <Badge tone={getLimitRequestStatusTone(value)}>
        {getLimitRequestStatusLabel(value)}
      </Badge>
    ),
  },
];

export function SenderResourceSettingsContent() {
  const navigation = useConsoleNavigation();
  const { showToast } = useToast();
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const senderResourcesQuery = useSenderResourcesQuery();
  const limitRequestsQuery = useLimitIncreaseRequestsQuery();
  const createMutation = useLimitIncreaseRequestCreateMutation();
  const smsResources = getSettingsSenderResourceRows(senderResourcesQuery.data, SMS_SENDER_RESOURCE_TYPE);
  const kakaoResourceRows = getSettingsSenderResourceRows(senderResourcesQuery.data, KAKAO_SENDER_RESOURCE_TYPE);
  const activeSmsResources = useMemo(() => getActiveSmsResources(senderResourcesQuery.data), [senderResourcesQuery.data]);
  const kakaoResources = useMemo(() => getActiveKakaoResources(senderResourcesQuery.data), [senderResourcesQuery.data]);
  const requestOptions = useMemo(
    () => buildRequestOptions({ kakaoResources, smsResources: activeSmsResources }),
    [activeSmsResources, kakaoResources]
  );
  const selectedOption = requestOptions.find((option) => option.value === form.target) ?? requestOptions[0];
  const requestError = createMutation.isError
    ? getRelayErrorMessage(createMutation.error, '한도 상향 신청을 제출하지 못했습니다.')
    : '';

  async function submitLimitRequest(event) {
    event.preventDefault();

    if (!selectedOption || createMutation.isPending) return;

    try {
      await createMutation.mutateAsync({
        channel: selectedOption.channel,
        reason: form.reason,
        requestedLimit: Number(form.requestedLimit),
        senderResourceId: selectedOption.senderResourceId,
      });
      showToast({
        description: selectedOption.label,
        title: '한도 상향 신청을 접수했습니다',
      });
      setForm(INITIAL_FORM);
      setRequestDialogOpen(false);
    } catch {
      // The dialog renders the API error next to the form actions.
    }
  }

  function openLimitRequestDialog() {
    setForm(INITIAL_FORM);
    createMutation.reset();
    setRequestDialogOpen(true);
  }

  function showPendingToast(title) {
    showToast({
      description: '신청/연결 폼과 저장 API는 다음 단계에서 연결합니다.',
      title,
    });
  }

  return (
    <div className="settings-sender-resource-stack">
      <SenderResourceSection
        actionLabel="번호 추가"
        copy="등록한 발신번호마다 기본 월 1,000건 한도를 적용합니다."
        emptyLabel="등록된 발신번호가 없습니다"
        loading={senderResourcesQuery.isPending}
        onAction={() => navigation.push('/settings/sender-resources/sms/new')}
        onDefaultSelect={() => showPendingToast('기본 발신번호')}
        onResubmit={(item) => navigation.push(`/settings/sender-resources/sms/new?applicationId=${encodeURIComponent(item.applicationId)}`)}
        quotaKind="sms"
        resources={smsResources}
        tableLabel="등록된 발신번호"
        title="발신번호"
      />

      <div className="section-divider" />

      <SenderResourceSection
        actionLabel="채널 추가"
        copy="카카오 비즈채널마다 일 1,000건 기본 한도를 표시하며, 알림톡과 브랜드메시지 한도는 함께 조정됩니다."
        emptyLabel="연결된 카카오 채널이 없습니다"
        loading={senderResourcesQuery.isPending}
        onAction={() => navigation.push('/settings/sender-resources/kakao/new')}
        onDefaultSelect={() => showPendingToast('기본 카카오 채널')}
        onResubmit={() => showPendingToast('카카오 채널 재신청')}
        quotaKind="kakao"
        resources={kakaoResourceRows}
        tableLabel="연결된 카카오 채널"
        title="카카오 채널"
      />

      {senderResourcesQuery.isError ? (
        <div className="message-send-api-status settings-resource-status" data-tone="critical" role="alert">
          <span>{getRelayErrorMessage(senderResourcesQuery.error, '발신 수단을 불러오지 못했습니다.')}</span>
          <Button onClick={() => senderResourcesQuery.refetch()}>다시 시도</Button>
        </div>
      ) : null}

      <div className="section-divider settings-limit-history-divider" />

      <LimitRequestHistory
        error={limitRequestsQuery.isError
          ? getRelayErrorMessage(limitRequestsQuery.error, '신청 내역을 불러오지 못했습니다.')
          : ''}
        loading={limitRequestsQuery.isPending}
        onLimitRequest={openLimitRequestDialog}
        onRetry={() => limitRequestsQuery.refetch()}
        requests={limitRequestsQuery.data?.requests ?? []}
      />

      <LimitRequestDialog
        error={requestError}
        form={form}
        onFormChange={setForm}
        onOpenChange={(open) => {
          setRequestDialogOpen(open);
          if (!open) createMutation.reset();
        }}
        onSubmit={submitLimitRequest}
        open={requestDialogOpen}
        pending={createMutation.isPending}
        requestOptions={requestOptions}
        selectedOption={selectedOption}
      />
    </div>
  );
}

function SenderResourceSection({
  actionLabel,
  copy,
  emptyLabel,
  loading,
  onAction,
  onDefaultSelect,
  onResubmit,
  quotaKind,
  resources,
  tableLabel,
  title,
}) {
  return (
    <SplitSection
      action={(
        <Button onClick={onAction} variant="primary">
          <Plus aria-hidden="true" size={15} />
          {actionLabel}
        </Button>
      )}
      className="sender-resource-section"
      copy={copy}
      tableLabel={tableLabel}
      tableMeta="발송 한도"
      title={title}
    >
      {loading ? (
        <PropertyRow
          icon={<Circle size={18} />}
          label="불러오는 중입니다"
          value="대기"
        />
      ) : resources.length ? (
        resources.map((item) => (
          <SenderResourceRow
            item={item}
            key={item.linkId}
            onDefaultSelect={onDefaultSelect}
            onResubmit={onResubmit}
            quotaKind={quotaKind}
          />
        ))
      ) : (
        <PropertyRow
          icon={<Circle size={18} />}
          label={emptyLabel}
          value="추가 필요"
        />
      )}
    </SplitSection>
  );
}

function SenderResourceRow({
  item,
  onDefaultSelect,
  onResubmit,
  quotaKind,
}) {
  const isApplication = item.isPendingApplication || item.isRejectedApplication;

  return (
    <PropertyRow
      className="sender-resource-row"
      detail={item.statusLabel}
      icon={<Circle size={18} />}
      label={(
        <span className="sender-resource-label">
          <span className="sender-resource-label-text">{item.label}</span>
          {item.isDefault ? <Badge className="sender-resource-default-badge" tone="green">기본</Badge> : null}
        </span>
      )}
      trailing={item.isPendingApplication ? (
        <Badge>검수 대기</Badge>
      ) : item.isRejectedApplication ? (
        <span className="sender-resource-row-actions">
          <Badge tone="critical">반려됨</Badge>
          <button
            className="sender-resource-default-button"
            onClick={() => onResubmit?.(item)}
            type="button"
          >
            재신청
          </button>
        </span>
      ) : !item.isDefault ? (
        <button
          className="sender-resource-default-button"
          onClick={onDefaultSelect}
          type="button"
        >
          기본 설정
        </button>
      ) : null}
      value={isApplication
        ? item.limitLabel
        : <SenderResourceLimit item={item} quotaKind={quotaKind} />}
    />
  );
}

function SenderResourceLimit({ item, quotaKind }) {
  const value = formatLimitCount(item.quotaLimit);

  if (quotaKind === 'kakao') {
    return (
      <span aria-label={`해당 카카오 채널의 일 발송 한도 ${value}. 알림톡과 브랜드메시지 상향 시 함께 조정됨`} className="sender-resource-limit-group is-kakao">
        <SenderResourceLimitItem label="일 한도" value={value} />
      </span>
    );
  }

  return (
    <span aria-label={`해당 발신번호의 월 발송 한도 ${value}`} className="sender-resource-limit-group is-sms">
      <SenderResourceLimitItem label="월 한도" value={value} />
    </span>
  );
}

function SenderResourceLimitItem({ label, value }) {
  return (
    <span className="sender-resource-limit-item">
      <span>{label}</span>
      <span>{value}</span>
    </span>
  );
}

function LimitRequestHistory({ error, loading, onLimitRequest, onRetry, requests }) {
  return (
    <section className="limit-request-history-section" aria-labelledby="limit-request-history-title">
      <div className="limit-request-history-heading">
        <div>
          <h2 id="limit-request-history-title">한도 상향 신청</h2>
          <p>운영자가 확인한 뒤 실제 한도 조정 결과를 승인 또는 반려 상태로 남깁니다.</p>
        </div>
        <Button className="limit-request-history-action" onClick={onLimitRequest} variant="primary">
          <Plus aria-hidden="true" size={15} />
          상향신청
        </Button>
      </div>
      {error ? (
        <div className="message-send-api-status settings-usage-status" data-tone="critical" role="alert">
          <span>{error}</span>
          <Button onClick={onRetry} variant="secondary">다시 시도</Button>
        </div>
      ) : null}
      <DataTableV2
        columns={LIMIT_REQUEST_HISTORY_COLUMNS}
        data={requests}
        empty="아직 접수된 한도 상향 신청이 없습니다."
        fixed
        getRowId={(request) => request.id}
        loading={loading}
        loadingRows={3}
        loadingSlot={<span className="limit-request-history-loading" role="status">신청 내역을 불러오는 중입니다.</span>}
        shellClassName="limit-request-history-data-table-shell"
        tableClassName="limit-request-history-data-table"
      />
    </section>
  );
}

function LimitRequestTargetCell({ request }) {
  return (
    <span className="limit-request-history-target-cell">
      <span>{getLimitRequestTargetLabel(request)}</span>
      <small>{getLimitRequestScopeLabel(request.limitScope)}</small>
    </span>
  );
}

function LimitRequestChangeCell({ request }) {
  return (
    <span className="limit-request-history-change-cell">
      <span>{formatLimitCount(request.currentLimit)}</span>
      <span aria-hidden="true">→</span>
      <strong>{formatLimitCount(request.requestedLimit)}</strong>
    </span>
  );
}

function LimitRequestReasonCell({ request }) {
  return (
    <span className="limit-request-history-reason-cell">
      <span title={request.reason}>{request.reason || '-'}</span>
      {request.rejectReason ? <small title={request.rejectReason}>반려 사유: {request.rejectReason}</small> : null}
    </span>
  );
}
