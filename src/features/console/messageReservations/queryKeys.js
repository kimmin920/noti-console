export const messageReservationQueryKeys = {
  batchRecipients: (selection = {}) => {
    const {
      channel,
      devMockReservations,
      from,
      groupId,
      page,
      pageSize,
      providerRequestId,
      to,
    } = selection ?? {};

    return [
      ...messageReservationQueryKeys.batchRecipientsRoot,
      groupId,
      providerRequestId,
      channel,
      from,
      to,
      page,
      pageSize,
      devMockReservations,
    ];
  },
  batchRecipientsRoot: ['message-reservation-groups', 'batch-recipients'],
  groupDetail: (selection = {}) => {
    const { channel, devMockReservations, from, groupId, to } = selection ?? {};

    return [
      ...messageReservationQueryKeys.groupDetailRoot,
      groupId,
      channel,
      from,
      to,
      devMockReservations,
    ];
  },
  groupDetailRoot: ['message-reservation-groups', 'detail'],
  groupList: (filters) => ['message-reservations', 'list', filters],
  groupListRoot: ['message-reservations', 'list'],
};
