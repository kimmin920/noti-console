export function shouldShowSmsReservationAcceptedToast(payload, result) {
  return Boolean(payload?.requestDate) && result?.state === 'accepted_by_provider';
}

export function getReservationsHrefForChannel(channel) {
  return `/reservations?channel=${encodeURIComponent(getReservationTabChannel(channel))}`;
}

export function isSmsBulkReservationRun(run) {
  return Boolean(run?.isReservation || run?.requestDate);
}

export function getSmsBulkSendRunResultHref(run) {
  if (isSmsBulkReservationRun(run)) {
    return run?.actions?.reservationsHref ?? getReservationsHrefForChannel(run?.channel);
  }

  return run?.actions?.logsHref ?? '/logs';
}

function getReservationTabChannel(channel) {
  if (channel === 'alimtalk' || channel === 'brand-message') {
    return channel;
  }

  return 'sms';
}
