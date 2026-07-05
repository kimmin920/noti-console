import { getRelayErrorMessage, relayGet, withQuery } from './api.js';
import { getMessageDeliverySummary } from './statusSummary.js';

export const MESSAGE_STATUS_POLL_INTERVAL_MS = 3000;
export const MESSAGE_STATUS_POLL_TIMEOUT_MS = 30000;
export const MESSAGE_STATUS_TOAST_ID = 'message-send-status-toast';

const MESSAGE_STATUS_POLL_ATTEMPTS =
  MESSAGE_STATUS_POLL_TIMEOUT_MS / MESSAGE_STATUS_POLL_INTERVAL_MS;

const deliveryToastVariantByTone = {
  critical: 'critical',
  neutral: 'default',
  success: 'success',
  warning: 'warning',
};

const deliveryToastTitleByTone = {
  critical: '발송 실패',
  neutral: '상태 확인',
  success: '발송 성공',
  warning: '발송 결과 확인',
};

export function showMessageStatusSubmitToast(showToast, channelLabel) {
  showToast({
    animation: 'spinner',
    description: '발송 요청을 전송하고 있습니다.',
    duration: 0,
    id: MESSAGE_STATUS_TOAST_ID,
    title: `${channelLabel} 전송 중...`,
  });
}

export function showMessageReservationAcceptedToast({
  channelLabel,
  onViewReservations,
  result,
  showToast,
}) {
  showToast(getReservationAcceptedToast(channelLabel, result, onViewReservations));
}

export function getReservationAcceptedToast(channelLabel, result, onViewReservations = () => {}) {
  return {
    action: {
      label: '예약 보기',
      onClick: onViewReservations,
    },
    description: getReservationAcceptedDescription(result),
    duration: 5000,
    id: MESSAGE_STATUS_TOAST_ID,
    title: `${channelLabel} 예약 접수됨`,
    variant: 'success',
  };
}

export function showMessageStatusResultToast({
  channelLabel,
  isCurrent = () => true,
  lookup,
  onFound = () => {},
  result,
  showToast,
}) {
  if (result?.state === 'rejected_by_provider') {
    showToast(getProviderRejectedToast(result));
    return;
  }

  if (!hasStatusLookup(lookup)) {
    showToast(getAcceptedWithoutLookupToast(channelLabel, result));
    return;
  }

  showToast(getStatusCheckingToast(channelLabel));
  pollMessageStatusToast({ channelLabel, isCurrent, lookup, onFound, showToast }).catch((error) => {
    if (!isCurrent()) {
      return;
    }

    showToast(getStatusLookupErrorToast(channelLabel, error));
  });
}

export function getMessageStatusPollAttemptCount() {
  return MESSAGE_STATUS_POLL_ATTEMPTS;
}

export function getDeliveryResultToast(channelLabel, logs) {
  const summary = getMessageDeliverySummary(channelLabel, logs);
  const tone = summary.tone ?? 'neutral';

  return {
    description: summary.text,
    id: MESSAGE_STATUS_TOAST_ID,
    title: `${deliveryToastTitleByTone[tone] ?? deliveryToastTitleByTone.neutral}`,
    variant: deliveryToastVariantByTone[tone] ?? 'default',
  };
}

export function getStatusTimeoutToast(channelLabel) {
  return {
    description: `${channelLabel} 발송 요청은 접수되었습니다. NHN 로그 반영을 아직 확인하지 못했습니다. 중복 발송하지 말고 잠시 후 로그에서 다시 확인해 주세요.`,
    duration: 10000,
    id: MESSAGE_STATUS_TOAST_ID,
    title: '상태 확인 대기',
    variant: 'warning',
  };
}

async function pollMessageStatusToast({
  channelLabel,
  isCurrent,
  lookup,
  onFound,
  showToast,
}) {
  const deadlineAt = Date.now() + MESSAGE_STATUS_POLL_TIMEOUT_MS;

  for (let attempt = 1; attempt <= MESSAGE_STATUS_POLL_ATTEMPTS; attempt += 1) {
    const delay = Math.min(MESSAGE_STATUS_POLL_INTERVAL_MS, Math.max(deadlineAt - Date.now(), 0));

    if (delay <= 0) {
      break;
    }

    await wait(delay);

    if (!isCurrent()) {
      return;
    }

    try {
      const statusResult = await fetchStatusBeforeDeadline(lookup, deadlineAt);

      if (!isCurrent()) {
        return;
      }

      if (statusResult.timedOut) {
        break;
      }

      const statusData = statusResult.data;

      if (statusData?.state === 'found') {
        showToast(getDeliveryResultToast(channelLabel, statusData.logs));
        try {
          onFound(statusData);
        } catch {
          // Cache refresh callbacks must not replace the delivery result toast.
        }
        return;
      }
    } catch (error) {
      if (!isCurrent()) {
        return;
      }

      showToast(getStatusLookupErrorToast(channelLabel, error));
      return;
    }

    if (attempt < MESSAGE_STATUS_POLL_ATTEMPTS) {
      showToast(getStatusCheckingToast(channelLabel));
    }
  }

  if (isCurrent()) {
    showToast(getStatusTimeoutToast(channelLabel));
  }
}

async function fetchStatusBeforeDeadline(lookup, deadlineAt) {
  const remaining = Math.max(deadlineAt - Date.now(), 0);

  if (remaining <= 0) {
    return { timedOut: true };
  }

  return Promise.race([
    relayGet(withQuery('/api/messages/status', lookup)).then((data) => ({ data, timedOut: false })),
    wait(remaining).then(() => ({ timedOut: true })),
  ]);
}

export function getStatusLookupErrorToast(channelLabel, error) {
  return {
    description: getRelayErrorMessage(error, '발송 상태를 확인하지 못했습니다.'),
    id: MESSAGE_STATUS_TOAST_ID,
    title: `${channelLabel} 상태 확인 실패`,
    variant: 'critical',
  };
}

export function getStatusCheckingToast(channelLabel) {
  return {
    animation: 'spinner',
    description: 'NHN 결과를 확인하는 중입니다.',
    duration: 0,
    id: MESSAGE_STATUS_TOAST_ID,
    title: `${channelLabel} 상태 확인 중...`,
  };
}

function getReservationAcceptedDescription(result) {
  const recipientCount = Number.parseInt(String(result?.recipientCount ?? ''), 10);

  if (!Number.isFinite(recipientCount) || recipientCount <= 0) {
    return '예약 요청이 접수되었습니다.';
  }

  return `${recipientCount.toLocaleString('ko-KR')}명 대상 예약 요청이 접수되었습니다.`;
}

function getProviderRejectedToast(result) {
  return {
    description: result.error?.message ?? '제공사가 발송 요청을 거절했습니다.',
    id: MESSAGE_STATUS_TOAST_ID,
    title: '제공사 발송 거절',
    variant: 'critical',
  };
}

function getAcceptedWithoutLookupToast(channelLabel, result) {
  if (result?.state === 'unknown_after_provider_call') {
    return {
      description: '제공사 응답을 확정하지 못했고 상태 조회 키도 없습니다. 중복 발송하지 말고 로그에서 직접 확인해 주세요.',
      duration: 10000,
      id: MESSAGE_STATUS_TOAST_ID,
      title: '제공사 처리 결과 확인 필요',
      variant: 'warning',
    };
  }

  return {
    description: `${result?.recipientCount ?? 0}명 대상 발송 요청이 접수되었습니다.`,
    id: MESSAGE_STATUS_TOAST_ID,
    title: `${channelLabel} 발송 요청 접수`,
    variant: 'success',
  };
}

function hasStatusLookup(lookup) {
  return Boolean(lookup?.channel && lookup?.senderResourceId && lookup?.clientRequestId);
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
