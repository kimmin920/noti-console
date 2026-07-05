import { relayGet, relayPost, withQuery } from '../messageSend/api.js';

const MESSAGE_RESERVATIONS_PATH = '/api/message-reservations';
const MESSAGE_RESERVATION_GROUPS_PATH = '/api/message-reservation-groups';

export function listMessageReservationGroups(filters) {
  return relayGet(withQuery(MESSAGE_RESERVATIONS_PATH, filters));
}

export function getMessageReservationGroupDetail({ channel, devMockReservations, from, groupId, to }) {
  return relayGet(withQuery(`${MESSAGE_RESERVATION_GROUPS_PATH}/${encodeURIComponent(groupId)}`, {
    channel,
    ...(devMockReservations ? { devMockReservations } : {}),
    from,
    to,
  }));
}

export function getMessageReservationBatchRecipients({
  channel,
  devMockReservations,
  from,
  groupId,
  page,
  pageSize,
  providerRequestId,
  to,
}) {
  return relayGet(withQuery(
    `${MESSAGE_RESERVATION_GROUPS_PATH}/${encodeURIComponent(groupId)}/batches/${encodeURIComponent(providerRequestId)}`,
    {
      channel,
      ...(devMockReservations ? { devMockReservations } : {}),
      from,
      page,
      pageSize,
      to,
    }
  ));
}

export function cancelMessageReservationGroup({ channel, devMockReservations, from, groupId, to }) {
  return relayPost(withQuery(`${MESSAGE_RESERVATION_GROUPS_PATH}/${encodeURIComponent(groupId)}/cancel`, {
    channel,
    ...(devMockReservations ? { devMockReservations } : {}),
    from,
    to,
  }), {});
}
