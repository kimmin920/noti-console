'use client';

import { useMemo, useState } from 'react';
import { Circle, RefreshCcw } from 'lucide-react';

import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FilterSelect,
  FormField,
  SectionPanel,
} from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import {
  useAdminLimitIncreaseRequestApproveMutation,
  useAdminLimitIncreaseRequestRejectMutation,
} from '../messageSend/mutations.js';
import { useAdminLimitIncreaseRequestsQuery } from '../messageSend/queries.js';
import {
  formatLimitCount,
  formatLimitDateTime,
  getLimitRequestStatusLabel,
  getLimitRequestStatusTone,
  getLimitRequestTargetLabel,
  LIMIT_REQUEST_STATUS_OPTIONS,
} from './limitIncreaseRequestLabels.js';

export function AdminLimitIncreaseRequestsPanel({ enabled = false }) {
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [reviewState, setReviewState] = useState(null);
  const filters = useMemo(() => ({
    status: statusFilter === 'all' ? undefined : statusFilter,
  }), [statusFilter]);
  const requestsQuery = useAdminLimitIncreaseRequestsQuery(filters, { enabled });
  const approveMutation = useAdminLimitIncreaseRequestApproveMutation();
  const rejectMutation = useAdminLimitIncreaseRequestRejectMutation();
  const requests = Array.isArray(requestsQuery.data?.requests) ? requestsQuery.data.requests : [];

  if (!enabled) return null;

  async function approveRequest(request) {
    try {
      await approveMutation.mutateAsync({
        requestId: request.id,
        payload: { reviewMemo: reviewState?.reviewMemo ?? '' },
      });
      setReviewState(null);
    } catch {
      // Dialog-level status renders the mutation error.
    }
  }

  async function rejectRequest(event) {
    event.preventDefault();
    if (!reviewState?.request || !reviewState.rejectReason.trim()) return;

    try {
      await rejectMutation.mutateAsync({
        requestId: reviewState.request.id,
        payload: {
          rejectReason: reviewState.rejectReason.trim(),
          reviewMemo: reviewState.reviewMemo.trim(),
        },
      });
      setReviewState(null);
    } catch {
      // Dialog-level status renders the mutation error.
    }
  }

  return (
    <SectionPanel
      className="admin-limit-requests-panel"
      description="운영자가 실제 한도를 수동 조정한 뒤 승인하거나, 사유를 남겨 반려합니다."
      title="한도 상향 신청"
    >
      <div className="admin-limit-requests-toolbar">
        <FilterSelect
          label="상태"
          onValueChange={setStatusFilter}
          options={LIMIT_REQUEST_STATUS_OPTIONS}
          value={statusFilter}
        />
        <Button disabled={requestsQuery.isFetching} onClick={() => requestsQuery.refetch()} variant="secondary">
          <RefreshCcw aria-hidden="true" size={15} />
          새로고침
        </Button>
      </div>

      {requestsQuery.isError ? (
        <div className="message-send-api-status settings-usage-status" data-tone="critical" role="alert">
          <span>{getRelayErrorMessage(requestsQuery.error, '한도 상향 신청을 불러오지 못했습니다.')}</span>
        </div>
      ) : null}

      {requestsQuery.isPending ? (
        <span className="admin-state-row">
          <Circle aria-hidden="true" size={18} />
          한도 상향 신청을 불러오는 중입니다.
        </span>
      ) : null}

      {!requestsQuery.isPending && requests.length === 0 ? (
        <p className="settings-usage-muted">조건에 맞는 한도 상향 신청이 없습니다.</p>
      ) : null}

      <div className="admin-limit-request-list">
        {requests.map((request) => (
          <article className="admin-limit-request-item" key={request.id}>
            <div className="admin-limit-request-main">
              <strong>{getLimitRequestTargetLabel(request)}</strong>
              <small>
                {request.user?.email ?? request.userId} · {formatLimitDateTime(request.createdAt)}
              </small>
            </div>
            <div className="admin-limit-request-meta">
              <span>{formatLimitCount(request.currentLimit)} → {formatLimitCount(request.requestedLimit)}</span>
              <Badge tone={getLimitRequestStatusTone(request.status)}>
                {getLimitRequestStatusLabel(request.status)}
              </Badge>
            </div>
            <div className="admin-limit-request-actions">
              <Button
                disabled={request.status !== 'submitted'}
                onClick={() => setReviewState({ mode: 'reject', rejectReason: '', request, reviewMemo: '' })}
                variant="danger"
              >
                반려
              </Button>
              <Button
                disabled={request.status !== 'submitted'}
                onClick={() => setReviewState({ mode: 'approve', rejectReason: '', request, reviewMemo: '' })}
                variant="primary"
              >
                승인
              </Button>
            </div>
          </article>
        ))}
      </div>

      <AdminLimitRequestReviewDialog
        approveError={approveMutation.isError
          ? getRelayErrorMessage(approveMutation.error, '승인하지 못했습니다.')
          : ''}
        approvePending={approveMutation.isPending}
        onApprove={approveRequest}
        onOpenChange={(open) => {
          if (!open) setReviewState(null);
        }}
        onReject={rejectRequest}
        onReviewStateChange={setReviewState}
        rejectError={rejectMutation.isError
          ? getRelayErrorMessage(rejectMutation.error, '반려하지 못했습니다.')
          : ''}
        rejectPending={rejectMutation.isPending}
        reviewState={reviewState}
      />
    </SectionPanel>
  );
}

function AdminLimitRequestReviewDialog({
  approveError,
  approvePending,
  onApprove,
  onOpenChange,
  onReject,
  onReviewStateChange,
  rejectError,
  rejectPending,
  reviewState,
}) {
  const request = reviewState?.request;
  const isReject = reviewState?.mode === 'reject';
  const pending = approvePending || rejectPending;

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(reviewState)}>
      <DialogContent className="limit-request-dialog">
        {request ? (
          <form onSubmit={isReject ? onReject : (event) => {
            event.preventDefault();
            onApprove(request);
          }}>
            <DialogHeader>
              <DialogTitle>{isReject ? '한도 신청 반려' : '한도 신청 승인'}</DialogTitle>
              <DialogDescription>
                {getLimitRequestTargetLabel(request)} · {formatLimitCount(request.currentLimit)} → {formatLimitCount(request.requestedLimit)}
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <FormField.Root>
                <FormField.Label htmlFor="limit-request-review-memo">운영자 메모</FormField.Label>
                <FormField.Control>
                  <FormField.Textarea
                    id="limit-request-review-memo"
                    onChange={(event) => onReviewStateChange((current) => ({ ...current, reviewMemo: event.target.value }))}
                    rows={3}
                    value={reviewState.reviewMemo}
                  />
                </FormField.Control>
              </FormField.Root>
              {isReject ? (
                <FormField.Root>
                  <FormField.Label htmlFor="limit-request-reject-reason" required>거절 사유</FormField.Label>
                  <FormField.Control>
                    <FormField.Textarea
                      id="limit-request-reject-reason"
                      onChange={(event) => onReviewStateChange((current) => ({ ...current, rejectReason: event.target.value }))}
                      rows={3}
                      value={reviewState.rejectReason}
                    />
                  </FormField.Control>
                </FormField.Root>
              ) : null}
              {approveError || rejectError ? <FormField.Error>{approveError || rejectError}</FormField.Error> : null}
            </DialogBody>
            <DialogFooter>
              <Button disabled={pending} onClick={() => onOpenChange(false)} type="button" variant="secondary">
                취소
              </Button>
              <Button disabled={pending || (isReject && !reviewState.rejectReason.trim())} type="submit" variant={isReject ? 'danger' : 'primary'}>
                {pending ? '처리 중' : isReject ? '반려' : '승인'}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
