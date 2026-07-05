'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Circle } from 'lucide-react';

import {
  Badge,
  Button,
  PropertyRow,
  SectionPanel,
  SplitSection,
  useToast,
} from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import {
  useLimitIncreaseRequestCreateMutation,
} from '../messageSend/mutations.js';
import {
  useLimitIncreaseRequestsQuery,
  useSenderResourcesQuery,
} from '../messageSend/queries.js';
import { useMetricsSummaryQuery } from '../metrics/queries.js';
import {
  formatLimitCount,
  formatLimitDateTime,
  getLimitRequestScopeLabel,
  getLimitRequestStatusLabel,
  getLimitRequestStatusTone,
  getLimitRequestTargetLabel,
} from './limitIncreaseRequestLabels.js';
import { LimitRequestDialog } from './UsageLimitRequestDialog.jsx';
import {
  buildRequestOptions,
  getActiveKakaoResources,
  getKakaoLimitRows,
  getSmsLimitRows,
} from './usageLimitRows.js';

const INITIAL_FORM = {
  reason: '',
  requestedLimit: '',
  target: 'sms',
};

export function UsageSettingsContent() {
  const { showToast } = useToast();
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const metricsQuery = useMetricsSummaryQuery(useMemo(() => ({ channel: 'sms', range: '30d', source: 'all' }), []));
  const senderResourcesQuery = useSenderResourcesQuery();
  const limitRequestsQuery = useLimitIncreaseRequestsQuery();
  const createMutation = useLimitIncreaseRequestCreateMutation();
  const smsQuota = metricsQuery.data?.quota?.sms ?? null;
  const kakaoResources = useMemo(() => getActiveKakaoResources(senderResourcesQuery.data), [senderResourcesQuery.data]);
  const requestOptions = useMemo(() => buildRequestOptions({ kakaoResources, smsQuota }), [kakaoResources, smsQuota]);
  const selectedOption = requestOptions.find((option) => option.value === form.target) ?? requestOptions[0];
  const hasKakaoRequestOption = requestOptions.some((option) => option.channel !== 'sms');
  const requestError = createMutation.isError
    ? getRelayErrorMessage(createMutation.error, '한도 상향 신청을 제출하지 못했습니다.')
    : '';

  async function submitLimitRequest(event) {
    event.preventDefault();

    if (!selectedOption || createMutation.isPending) return;

    try {
      await createMutation.mutateAsync({
        channel: selectedOption.channel,
        currentLimit: selectedOption.currentLimit,
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

  function openLimitRequestDialog(targetGroup) {
    setForm({
      ...INITIAL_FORM,
      target: getInitialRequestTarget(requestOptions, targetGroup),
    });
    createMutation.reset();
    setRequestDialogOpen(true);
  }

  return (
    <div className="settings-usage-stack">
      <LimitSection
        action={<Button onClick={() => openLimitRequestDialog('sms')} variant="secondary">한도 상향 신청</Button>}
        copy="문자는 사용자 기준 월 단위 한도로 관리합니다. 대량 발송 예약은 사용량에 포함되어 월 한도에서 차감됩니다."
        rows={getSmsLimitRows(smsQuota, metricsQuery.isPending)}
        tableLabel="문자"
        tableMeta="월 단위"
        title="문자 발송 한도"
      />

      <LimitSection
        action={(
          <Button disabled={!hasKakaoRequestOption} onClick={() => openLimitRequestDialog('kakao')} variant="secondary">
            한도 상향 신청
          </Button>
        )}
        copy="카카오 비즈채널마다 알림톡과 브랜드메시지 각각 일 1,000건 기본 한도를 적용합니다."
        rows={getKakaoLimitRows(kakaoResources, senderResourcesQuery.isPending)}
        tableLabel="카카오 채널"
        tableMeta={kakaoResources.length ? `${kakaoResources.length}개 채널` : '채널별 일 한도'}
        title="카카오 채널 한도"
      />

      <LimitRequestHistory
        error={limitRequestsQuery.isError
          ? getRelayErrorMessage(limitRequestsQuery.error, '신청 내역을 불러오지 못했습니다.')
          : ''}
        loading={limitRequestsQuery.isPending}
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

function getInitialRequestTarget(requestOptions, targetGroup) {
  if (targetGroup === 'kakao') {
    return requestOptions.find((option) => option.channel !== 'sms')?.value ?? INITIAL_FORM.target;
  }

  return INITIAL_FORM.target;
}

function LimitSection({ action, copy, rows, tableLabel, tableMeta, title }) {
  return (
    <SplitSection action={action} copy={copy} tableLabel={tableLabel} tableMeta={tableMeta} title={title}>
      {rows.map((row) => (
        <PropertyRow
          detail={row.detail}
          icon={<Circle size={18} />}
          key={row.id}
          label={row.label}
          trailing={<ChevronDown size={15} />}
          value={row.value}
        />
      ))}
    </SplitSection>
  );
}

function LimitRequestHistory({ error, loading, onRetry, requests }) {
  return (
    <SectionPanel
      className="limit-request-history-panel"
      description="운영자가 확인한 뒤 실제 한도 조정 결과를 승인 또는 반려 상태로 남깁니다."
      title="한도 상향 신청 내역"
    >
      {error ? (
        <div className="message-send-api-status settings-usage-status" data-tone="critical" role="alert">
          <span>{error}</span>
          <Button onClick={onRetry} variant="secondary">다시 시도</Button>
        </div>
      ) : null}
      {loading ? <p className="settings-usage-muted">신청 내역을 불러오는 중입니다.</p> : null}
      {!loading && requests.length === 0 ? (
        <p className="settings-usage-muted">아직 접수된 한도 상향 신청이 없습니다.</p>
      ) : null}
      <div className="limit-request-list">
        {requests.map((request) => (
          <article className="limit-request-item" key={request.id}>
            <div>
              <strong>{getLimitRequestTargetLabel(request)}</strong>
              <small>{getLimitRequestScopeLabel(request.limitScope)} · {formatLimitDateTime(request.createdAt)}</small>
            </div>
            <div className="limit-request-item-meta">
              <span>{formatLimitCount(request.currentLimit)} → {formatLimitCount(request.requestedLimit)}</span>
              <Badge tone={getLimitRequestStatusTone(request.status)}>
                {getLimitRequestStatusLabel(request.status)}
              </Badge>
            </div>
            {request.rejectReason ? <p>거절 사유: {request.rejectReason}</p> : null}
          </article>
        ))}
      </div>
    </SectionPanel>
  );
}
