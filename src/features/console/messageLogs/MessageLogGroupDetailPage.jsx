'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useMessageLogGroupDetailQuery,
  useMessageLogGroupRequestFailuresQuery,
  useMessageLogGroupRequestRecipientDetailQuery,
} from './queries.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import {
  getMessageLogFiltersFromSearchParams,
  toMessageLogQueryParams,
  toMessageLogUrlParams,
} from './selectors.js';
import {
  MESSAGE_LOG_DETAIL_FAILURE_PAGE_SIZE,
  MessageLogDetailStatus,
  MessageLogGroupDetailHeader,
  MessageLogGroupDetailSummary,
  MessageLogGroupMetadata,
  MessageLogResultSection,
} from './MessageLogGroupDetailSections.jsx';
import { useToast } from '../../../components/ui/index.js';

const EMPTY_ROWS = [];

export function MessageLogGroupDetailPage({ groupId }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamText = searchParams.toString();
  const { showToast } = useToast();
  const mode = searchParams.get('mode') === 'embed' ? 'embed' : null;
  const filters = useMemo(
    () => getMessageLogFiltersFromSearchParams(new URLSearchParams(searchParamText)),
    [searchParamText]
  );
  const queryFilters = useMemo(() => toMessageLogQueryParams(filters), [filters]);
  const groupSelection = useMemo(() => ({
    channel: queryFilters.channel,
    demo: queryFilters.demo,
    from: queryFilters.from,
    groupId,
    to: queryFilters.to,
  }), [groupId, queryFilters]);
  const groupDetailQuery = useMessageLogGroupDetailQuery(groupSelection);
  const group = groupDetailQuery.data?.group ?? null;
  const requests = groupDetailQuery.data?.requests ?? EMPTY_ROWS;
  const requestedRequestLocalId = searchParams.get('requestLocalId');
  const activeRequest = useMemo(
    () => selectActiveRequest(requests, requestedRequestLocalId),
    [requestedRequestLocalId, requests]
  );
  const failurePage = normalizePositiveInteger(searchParams.get('failurePage'), 1);
  const selectedRecipientSeq = normalizePositiveInteger(searchParams.get('recipientSeq'), null);
  const requestFailuresSelection = useMemo(() => {
    if (!activeRequest) return null;

    return {
      demo: queryFilters.demo,
      groupId,
      page: failurePage,
      pageSize: MESSAGE_LOG_DETAIL_FAILURE_PAGE_SIZE,
      requestLocalId: activeRequest.id,
    };
  }, [activeRequest, failurePage, groupId, queryFilters.demo]);
  const requestFailuresQuery = useMessageLogGroupRequestFailuresQuery(requestFailuresSelection, {
    enabled: Boolean(activeRequest),
  });
  const failures = requestFailuresQuery.data?.failures ?? EMPTY_ROWS;
  const selectedFailure = useMemo(
    () => failures.find((failure) => Number(failure.recipientSeq) === Number(selectedRecipientSeq)) ?? null,
    [failures, selectedRecipientSeq]
  );
  const selectedRecipientIdentity = useMemo(() => {
    if (!activeRequest || !selectedRecipientSeq) return null;

    return {
      groupId,
      recipientSeq: selectedRecipientSeq,
      requestLocalId: activeRequest.id,
    };
  }, [activeRequest, groupId, selectedRecipientSeq]);
  const recipientDetailQuery = useMessageLogGroupRequestRecipientDetailQuery(selectedRecipientIdentity, {
    enabled: Boolean(selectedRecipientIdentity),
  });
  const listHref = useMemo(() => {
    const params = toMessageLogUrlParams(filters, mode);
    return `/logs?${params.toString()}`;
  }, [filters, mode]);
  const replaceDetailParams = useCallback((updates, options = {}) => {
    const params = new URLSearchParams(searchParamText);

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === '') {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }

    const query = params.toString();
    router.replace(`/logs/${encodeURIComponent(groupId)}${query ? `?${query}` : ''}`, {
      scroll: options.scroll ?? false,
    });
  }, [groupId, router, searchParamText]);

  useEffect(() => {
    if (!activeRequest || requestedRequestLocalId === activeRequest.id) return;

    replaceDetailParams({
      failurePage: 1,
      recipientSeq: null,
      requestLocalId: activeRequest.id,
    });
  }, [activeRequest, replaceDetailParams, requestedRequestLocalId]);

  function copyGroupId() {
    writeClipboard(groupId)
      .then(() => {
        showToast({
          description: groupId,
          title: '발송 묶음 ID를 복사했습니다.',
          variant: 'success',
        });
      })
      .catch(() => {
        showToast({
          description: '클립보드 권한을 확인해 주세요.',
          title: '복사하지 못했습니다.',
          variant: 'critical',
        });
      });
  }

  function selectRequest(request) {
    replaceDetailParams({
      failurePage: 1,
      recipientSeq: null,
      requestLocalId: request.id,
    });
  }

  function selectFailure(failure) {
    replaceDetailParams({ recipientSeq: failure.recipientSeq });
  }

  function changeFailurePage(nextPage) {
    replaceDetailParams({
      failurePage: Math.max(1, nextPage),
      recipientSeq: null,
    });
  }

  const selectedFailureWithDetail = recipientDetailQuery.data?.recipient
    ? {
        ...selectedFailure,
        detail: recipientDetailQuery.data.recipient,
        recipientNo: selectedFailure?.recipientNo ?? recipientDetailQuery.data.recipient.recipientNo,
      }
    : selectedFailure;
  const failuresTotal = Number(requestFailuresQuery.data?.total ?? failures.length);
  const failuresError = requestFailuresQuery.isError
    ? getRelayErrorMessage(requestFailuresQuery.error, '실패자 목록을 불러오지 못했습니다.')
    : null;
  const failuresLoading = Boolean(activeRequest)
    && (requestFailuresQuery.isPending || requestFailuresQuery.isFetching);

  return (
    <section className="page-frame message-log-detail-page">
      <div className="resend-detail-content message-log-detail-content" aria-labelledby="message-log-detail-title">
        <MessageLogGroupDetailHeader
          group={group}
          groupId={groupId}
          listHref={listHref}
          onCopyGroupId={copyGroupId}
        />

        {groupDetailQuery.isPending ? (
          <MessageLogDetailStatus
            copy="발송 묶음과 요청별 결과를 불러오는 중입니다."
            title="상세 정보를 불러오고 있습니다"
          />
        ) : null}

        {groupDetailQuery.isError ? (
          <MessageLogDetailStatus
            copy={getRelayErrorMessage(groupDetailQuery.error, '발송 묶음을 불러오지 못했습니다.')}
            onRetry={() => groupDetailQuery.refetch()}
            title="발송 묶음을 불러오지 못했습니다"
            tone="critical"
          />
        ) : null}

        {group ? (
          <>
            <MessageLogGroupDetailSummary group={group} />
            <MessageLogResultSection
              activeRequest={activeRequest}
              failurePage={failurePage}
              failures={failures}
              failuresError={failuresError}
              failuresLoading={failuresLoading}
              failuresTotal={failuresTotal}
              onFailurePageChange={changeFailurePage}
              onRequestChange={selectRequest}
              onSelectFailure={selectFailure}
              requests={requests}
              selectedFailure={selectedFailureWithDetail}
              selectedRecipientSeq={selectedRecipientSeq}
            />
            <MessageLogGroupMetadata group={group} requests={requests} />
          </>
        ) : null}
      </div>
    </section>
  );
}

function selectActiveRequest(requests, requestLocalId) {
  if (!requests.length) return null;

  const matchedRequest = requests.find((request) => request.id === requestLocalId);
  if (matchedRequest) return matchedRequest;

  return requests.find((request) => Number(request.failedCount ?? 0) > 0) ?? requests[0];
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

async function writeClipboard(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(String(value ?? ''));
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = String(value ?? '');
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
