'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { PageHeader } from '../../../components/layout/index.js';
import { Button, DataTableV2, SelectPill } from '../../../components/ui/index.js';
import { MetricsTrendChart } from './MetricsTrendChart.jsx';
import {
  formatMetricDate,
  formatMetricNumber,
  formatMetricPercent,
  getMetricsChannelLabel,
  METRICS_CHANNEL_OPTIONS,
  METRICS_RANGE_OPTIONS,
  METRICS_SOURCE_OPTIONS,
} from './metricsFormatters.js';
import { useMetricsSummaryQuery } from './queries.js';

const EMPTY_TOTALS = {
  canceledCount: 0,
  failedCount: 0,
  pendingCount: 0,
  recipientCount: 0,
  sendGroupCount: 0,
  successCount: 0,
  successRate: 0,
};

const CHANNEL_COLUMNS = [
  {
    accessor: (row) => getMetricsChannelLabel(row.channel),
    header: '채널',
  },
  {
    accessor: (row) => `${formatMetricNumber(row.recipientCount)}명`,
    header: '발송 대상',
  },
  {
    accessor: (row) => `${formatMetricNumber(row.successCount)}명`,
    header: '성공',
  },
  {
    accessor: (row) => `${formatMetricNumber(row.failedCount)}명`,
    header: '실패',
  },
  {
    accessor: (row) => `${formatMetricNumber(row.pendingCount)}명`,
    header: '결과 대기',
  },
  {
    accessor: (row) => formatMetricPercent(row.successRate),
    header: '성공률',
  },
];

export function MetricsPage({ meta }) {
  const [range, setRange] = useState('15d');
  const [channel, setChannel] = useState('all');
  const [source, setSource] = useState('all');
  const filters = useMemo(() => ({ channel, range, source }), [channel, range, source]);
  const summaryQuery = useMetricsSummaryQuery(filters);
  const summary = summaryQuery.data;
  const totals = summary?.totals ?? EMPTY_TOTALS;
  const alerts = summary?.alerts ?? [];
  const channelBreakdown = summary?.channelBreakdown ?? [];
  const loading = summaryQuery.isPending;
  const hasBlockingError = summaryQuery.isError && !summary;

  return (
    <section className="page-frame metrics-page-v2">
      <PageHeader title={meta.title} />
      <div className="toolbar compact-toolbar metrics-page-toolbar">
        <SelectPill aria-label="메트릭 기간" onValueChange={setRange} options={METRICS_RANGE_OPTIONS} value={range} />
        <SelectPill aria-label="메트릭 채널" onValueChange={setChannel} options={METRICS_CHANNEL_OPTIONS} value={channel} />
        <SelectPill aria-label="메트릭 출처" onValueChange={setSource} options={METRICS_SOURCE_OPTIONS} value={source} />
        <Button
          className="metrics-refresh-button"
          disabled={summaryQuery.isFetching}
          onClick={() => summaryQuery.refetch()}
          variant="secondary"
        >
          <RefreshCcw aria-hidden="true" size={15} />
          새로고침
        </Button>
        <span className="metrics-generated-at">
          기준 {formatMetricDate(summary?.generatedAt)}
        </span>
      </div>

      <MetricsBasisStrip loading={loading} quota={summary?.quota} />
      <MetricsPendingNotice loading={loading} pendingCount={totals.pendingCount} />

      {summaryQuery.isError ? (
        <div className="metrics-state-panel" role="alert">
          메트릭을 불러오지 못했습니다.
          <Button onClick={() => summaryQuery.refetch()} variant="secondary">다시 시도</Button>
        </div>
      ) : null}

      {hasBlockingError ? null : (
        <>
          <div className="metrics-grid metrics-summary-grid">
            <MetricCard label="발송 대상" loading={loading} value={`${formatMetricNumber(totals.recipientCount)}명`} />
            <MetricCard
              caption={`${formatMetricNumber(totals.successCount)}명 성공`}
              label="발송 성공률"
              loading={loading}
              value={formatMetricPercent(totals.successRate)}
            />
            <MetricCard
              caption="실패 또는 거절된 대상"
              label="실패"
              loading={loading}
              tone="critical"
              value={`${formatMetricNumber(totals.failedCount)}명`}
            />
            <MetricCard
              caption={alerts.length > 0 ? '조치가 필요한 항목' : '현재 조치 없음'}
              label="확인 필요"
              loading={loading}
              tone={alerts.length > 0 ? 'warning' : 'neutral'}
              value={`${formatMetricNumber(alerts.length)}건`}
            />
          </div>

          <div className="metrics-dashboard-grid">
            <section className="metrics-panel metrics-chart-panel-v2">
              <MetricsPanelHeader eyebrow="최근 추이" title="일자별 발송 결과" />
              <MetricsTrendChart data={summary?.timeSeries ?? []} loading={loading} />
            </section>
            <section className="metrics-panel metrics-alert-panel">
              <MetricsPanelHeader eyebrow="운영 경고" title="확인 필요 항목" />
              <MetricsAlerts alerts={alerts} loading={loading} />
            </section>
          </div>

          <section className="metrics-panel">
            <MetricsPanelHeader eyebrow="채널" title="채널별 발송 결과" />
            <DataTableV2
              columns={CHANNEL_COLUMNS}
              data={channelBreakdown}
              empty="선택한 기간에 채널별 발송 데이터가 없습니다."
              getRowId={(row) => row.channel}
              loading={loading}
              shellClassName="metrics-table-shell-v2"
              tableClassName="metrics-table-v2"
            />
            <ChannelBreakdownList loading={loading} rows={channelBreakdown} />
          </section>
        </>
      )}
    </section>
  );
}

function MetricsBasisStrip({ loading, quota }) {
  return (
    <div aria-label="메트릭 집계 기준" className="metrics-basis-strip">
      <span>성공/실패는 NHN resultCode 기준</span>
      <span>결과 대기는 성공으로 계산하지 않음</span>
      <span>{getSmsQuotaLabel(quota?.sms, loading)}</span>
      <span>카카오 채널별 일 1,000건 기준</span>
      <a href="/settings?tab=usage">사용량 설정</a>
    </div>
  );
}

function MetricsPendingNotice({ loading, pendingCount }) {
  if (loading || Number(pendingCount ?? 0) <= 0) return null;

  return (
    <div className="metrics-pending-notice" role="status">
      <strong>결과 대기 {formatMetricNumber(pendingCount)}명</strong>
      <span>NHN 최종 resultCode가 아직 도착하지 않은 대상입니다.</span>
    </div>
  );
}

function MetricCard({ caption, label, loading, tone = 'neutral', value }) {
  return (
    <div className={`metric-card metrics-card-tone-${tone}`}>
      <span>{label}</span>
      <strong>{loading ? '...' : value}</strong>
      <small>{caption ?? '선택 기간 기준'}</small>
    </div>
  );
}

function MetricsPanelHeader({ eyebrow, title }) {
  return (
    <header className="metrics-panel-header">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
    </header>
  );
}

function getSmsQuotaLabel(smsQuota, loading) {
  if (loading) return '문자 월 한도 확인 중';
  if (!smsQuota) return '문자 월 한도는 사용량에서 관리';

  const used = Number(smsQuota.consumed ?? 0) + Number(smsQuota.reserved ?? 0);
  return `문자 월 ${formatMetricNumber(smsQuota.limit)}건 중 ${formatMetricNumber(used)}건 사용/예약`;
}

function MetricsAlerts({ alerts, loading }) {
  if (loading) return <p className="metrics-muted-text">운영 경고를 확인하는 중입니다.</p>;
  if (!alerts.length) return <p className="metrics-muted-text">현재 확인이 필요한 항목이 없습니다.</p>;

  return (
    <div className="metrics-alert-list">
      {alerts.map((alert) => (
        <a className="metrics-alert-row" href={alert.href} key={alert.code}>
          <AlertTriangle aria-hidden="true" size={16} />
          <span>{alert.message}</span>
        </a>
      ))}
    </div>
  );
}

function ChannelBreakdownList({ loading, rows }) {
  if (loading) {
    return (
      <div aria-label="채널별 발송 결과 요약" className="metrics-channel-list">
        <p className="metrics-muted-text">채널별 결과를 확인하는 중입니다.</p>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div aria-label="채널별 발송 결과 요약" className="metrics-channel-list">
        <p className="metrics-muted-text">선택한 기간에 채널별 발송 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div aria-label="채널별 발송 결과 요약" className="metrics-channel-list" role="list">
      {rows.map((row) => (
        <article className="metrics-channel-row" key={row.channel} role="listitem">
          <div className="metrics-channel-row-main">
            <strong>{getMetricsChannelLabel(row.channel)}</strong>
            <span aria-label={`성공률 ${formatMetricPercent(row.successRate)}`}>
              {formatMetricPercent(row.successRate)}
            </span>
          </div>
          <dl className="metrics-channel-row-stats">
            <div>
              <dt>대상</dt>
              <dd>{formatMetricNumber(row.recipientCount)}명</dd>
            </div>
            <div>
              <dt>성공</dt>
              <dd>{formatMetricNumber(row.successCount)}명</dd>
            </div>
            <div>
              <dt>실패</dt>
              <dd>{formatMetricNumber(row.failedCount)}명</dd>
            </div>
            <div>
              <dt>결과 대기</dt>
              <dd>{formatMetricNumber(row.pendingCount)}명</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
