import {
  getSmsBulkSendRunResultHref,
  isSmsBulkReservationRun,
} from './reservationRouting.js';

export function getSmsBulkSendRunToastView(run, { formatNumber = String } = {}) {
  if (!run?.id) {
    return null;
  }

  const status = run.status ?? run.state;
  const accepted = run.acceptedRecipientCount ?? run.acceptedRecipients ?? 0;
  const total = run.totalRecipientCount ?? run.totalRecipients ?? 0;
  const isReservation = isSmsBulkReservationRun(run);

  if (status === 'queued' || status === 'running') {
    return {
      animation: 'spinner',
      description: isReservation
        ? `${formatNumber(accepted)} / ${formatNumber(total)}명 NHN 예약 등록`
        : `${formatNumber(accepted)} / ${formatNumber(total)}명 접수`,
      duration: 0,
      key: `${run.id}:${status}:${accepted}:${total}`,
      title: isReservation ? 'SMS 예약 등록 중' : 'SMS 발송 접수 중',
    };
  }

  if (status === 'completed') {
    return {
      actionLabel: isReservation ? '예약 보기' : '발송 결과 보기',
      description: isReservation ? `${formatNumber(total)}명 예약 등록 완료` : `${formatNumber(total)}명 접수 완료`,
      key: `${run.id}:${status}:${accepted}:${total}`,
      resultHref: getSmsBulkSendRunResultHref(run),
      title: isReservation ? 'SMS 예약 등록 완료' : 'SMS 발송 요청 접수 완료',
      variant: 'success',
    };
  }

  if (status === 'blocked' || status === 'failed') {
    return {
      actionLabel: isReservation ? '예약 보기' : '발송 결과 보기',
      description: run.error?.message ?? '일부 배치 접수를 중단했습니다.',
      key: `${run.id}:${status}:${accepted}:${total}`,
      resultHref: getSmsBulkSendRunResultHref(run),
      title: getTerminalBulkRunTitle(status, isReservation),
      variant: status === 'blocked' ? 'warning' : 'critical',
    };
  }

  return null;
}

function getTerminalBulkRunTitle(status, isReservation) {
  if (status === 'blocked') {
    return isReservation ? 'SMS 예약 등록 확인 필요' : 'SMS 발송 확인 필요';
  }

  return isReservation ? 'SMS 예약 등록 중단' : 'SMS 발송 중단';
}
