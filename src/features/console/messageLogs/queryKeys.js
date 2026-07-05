export const messageLogQueryKeys = {
  detail: (selection = {}) => {
    const { channel, requestId, recipientSeq } = selection ?? {};

    return [
      ...messageLogQueryKeys.detailRoot,
      channel,
      requestId,
      recipientSeq,
    ];
  },
  detailRoot: ['message-logs', 'detail'],
  groupDetail: (selection = {}) => {
    const { groupId, channel, demo, from, to } = selection ?? {};

    return [
      ...messageLogQueryKeys.groupDetailRoot,
      groupId,
      channel,
      demo,
      from,
      to,
    ];
  },
  groupDetailRoot: ['message-log-groups', 'detail'],
  groupList: (filters) => ['message-log-groups', 'list', filters],
  groupListRoot: ['message-log-groups', 'list'],
  groupRequestRecipients: (selection = {}) => {
    const { demo, groupId, page, pageSize, requestLocalId } = selection ?? {};

    return [
      ...messageLogQueryKeys.groupRequestRecipientsRoot,
      groupId,
      requestLocalId,
      demo,
      page,
      pageSize,
    ];
  },
  groupRequestRecipientsRoot: ['message-log-groups', 'request-recipients'],
  groupRequestFailures: (selection = {}) => {
    const { demo, groupId, page, pageSize, requestLocalId } = selection ?? {};

    return [
      ...messageLogQueryKeys.groupRequestFailuresRoot,
      groupId,
      requestLocalId,
      demo,
      page,
      pageSize,
    ];
  },
  groupRequestFailuresRoot: ['message-log-groups', 'request-failures'],
  groupRequestRecipientDetail: (selection = {}) => {
    const { groupId, recipientSeq, requestLocalId } = selection ?? {};

    return [
      ...messageLogQueryKeys.groupRequestRecipientDetailRoot,
      groupId,
      requestLocalId,
      recipientSeq,
    ];
  },
  groupRequestRecipientDetailRoot: ['message-log-groups', 'request-recipient-detail'],
  list: (filters) => ['message-logs', 'list', filters],
  listRoot: ['message-logs', 'list'],
};
