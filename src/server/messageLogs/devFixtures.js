import { CHANNELS } from '../relay/constants.js';

const DEMO_QUERY_VALUE = 'cases';
const DEMO_GROUP_PREFIX = 'dev-log-case-';
const DEMO_REQUEST_PREFIX = 'dev-log-request-';
const DEMO_PROVIDER_REQUEST_PREFIX = 'dev-provider-request-';
const SMS_CHANNELS = [CHANNELS.SMS, CHANNELS.LMS, CHANNELS.MMS];
const SUCCESS_CODE_BY_CHANNEL = {
  [CHANNELS.ALIMTALK]: 'MRC01',
  [CHANNELS.BRAND_MESSAGE]: 'MRC01',
  [CHANNELS.LMS]: '1000',
  [CHANNELS.MMS]: '1000',
  [CHANNELS.SMS]: '1000',
};

export function isMessageLogDemoCasesQuery(query = {}) {
  return process.env.NODE_ENV !== 'production' && normalizeString(query.demo).toLowerCase() === DEMO_QUERY_VALUE;
}

export function isMessageLogDemoGroupId(groupId) {
  return process.env.NODE_ENV !== 'production' && normalizeString(groupId).startsWith(DEMO_GROUP_PREFIX);
}

export function isMessageLogDemoRequestLocalId(requestLocalId) {
  return process.env.NODE_ENV !== 'production' && normalizeString(requestLocalId).startsWith(DEMO_REQUEST_PREFIX);
}

export function isMessageLogDemoProviderRequestId(providerRequestId) {
  return process.env.NODE_ENV !== 'production' && normalizeString(providerRequestId).startsWith(DEMO_PROVIDER_REQUEST_PREFIX);
}

export function listMessageLogDemoCaseGroups({
  channel,
  from = null,
  messageType = null,
  now = new Date(),
  page = 1,
  pageSize = 20,
  to = null,
}) {
  const groups = buildDemoCases(now)
    .filter((item) => !item.definition.hiddenFromList)
    .filter((item) => isDemoGroupInListChannel(item.group, channel, messageType))
    .filter((item) => isDemoGroupSentInRange(item.group, { from, now, to }))
    .map((item) => item.group)
    .sort(compareGroupsDesc);
  const offset = (page - 1) * pageSize;
  const pageGroups = groups.slice(offset, offset + pageSize);

  return {
    channel,
    demo: true,
    from: toIsoOrNull(from),
    to: toIsoOrNull(to),
    page,
    pageSize,
    hasNextPage: offset + pageGroups.length < groups.length,
    total: groups.length,
    groups: pageGroups,
  };
}

export function getMessageLogDemoCaseDetail({ channel = null, groupId, now = new Date() } = {}) {
  const demoCase = findDemoCaseByGroupId(groupId, now);

  if (!demoCase || (channel && !isDemoGroupInListChannel(demoCase.group, channel, null))) {
    return null;
  }

  return {
    demo: true,
    group: demoCase.group,
    requests: demoCase.requests,
    recipients: [],
  };
}

export function listMessageLogDemoCaseRequestRecipients({
  groupId,
  now = new Date(),
  page = 1,
  pageSize = 100,
  requestLocalId,
} = {}) {
  const demoCase = findDemoCaseByGroupId(groupId, now);
  const request = demoCase?.requests.find((item) => item.id === requestLocalId);

  if (!demoCase || !request) {
    return null;
  }

  const recipients = demoCase.recipientsByRequestId.get(requestLocalId) ?? [];
  const offset = (page - 1) * pageSize;
  const pageRecipients = recipients.slice(offset, offset + pageSize);

  return {
    demo: true,
    page,
    pageSize,
    total: recipients.length,
    hasNextPage: offset + pageRecipients.length < recipients.length,
    request,
    recipients: pageRecipients,
  };
}

export function listMessageLogDemoCaseRequestFailures({
  groupId,
  now = new Date(),
  page = 1,
  pageSize = 100,
  requestLocalId,
} = {}) {
  const demoCase = findDemoCaseByGroupId(groupId, now);
  const request = demoCase?.requests.find((item) => item.id === requestLocalId);

  if (!demoCase || !request) {
    return null;
  }

  const failures = createDemoRecipients({
    countMode: 'full',
    createdAt: parseDate(demoCase.group.createdAt) ?? now,
    definition: demoCase.definition,
    request,
    resultSyncedAt: parseDate(demoCase.group.resultSyncedAt),
  })
    .filter((recipient) => getDemoRecipientState(demoCase.definition, request, recipient.recipientSeq) === 'failed')
    .map((recipient) => ({
      groupId,
      requestLocalId: request.id,
      requestSequence: request.sequence,
      requestLabel: formatDemoRequestLabel(request),
      channel: demoCase.group.channel,
      recipientSeq: recipient.recipientSeq,
      recipientNo: recipient.recipientNo,
      resultCode: recipient.resultCode,
      resultCodeLabel: null,
      resultMessage: recipient.resultMessage,
    }));
  const offset = (page - 1) * pageSize;
  const pageFailures = failures.slice(offset, offset + pageSize);

  return {
    demo: true,
    page,
    pageSize,
    total: failures.length,
    hasNextPage: offset + pageFailures.length < failures.length,
    request,
    failures: pageFailures,
  };
}

export function getMessageLogDemoCaseRecipientDetail({
  channel,
  now = new Date(),
  providerRequestId,
  recipientSeq,
} = {}) {
  const normalizedSeq = Number(recipientSeq);

  for (const demoCase of buildDemoCases(now)) {
    if (demoCase.group.channel !== channel) continue;

    for (const recipients of demoCase.recipientsByRequestId.values()) {
      const recipient = recipients.find((item) => (
        item.requestId === providerRequestId && Number(item.recipientSeq) === normalizedSeq
      ));

      if (recipient) {
        return {
          ...recipient,
          detail: {
            content: recipient.content,
            recipientNo: recipient.recipientNo,
          },
        };
      }
    }
  }

  return null;
}

export function getMessageLogDemoCaseRequestRecipientDetail({
  groupId,
  now = new Date(),
  recipientSeq,
  requestLocalId,
} = {}) {
  const demoCase = findDemoCaseByGroupId(groupId, now);
  const request = demoCase?.requests.find((item) => item.id === requestLocalId);
  const normalizedSeq = Number(recipientSeq);

  if (
    !demoCase
    || !request
    || !Number.isSafeInteger(normalizedSeq)
    || normalizedSeq < 1
    || normalizedSeq > Number(request.recipientCount ?? 0)
  ) {
    return null;
  }

  const recipient = createDemoRecipient({
    createdAt: parseDate(demoCase.group.createdAt) ?? now,
    definition: demoCase.definition,
    request,
    resultSyncedAt: parseDate(demoCase.group.resultSyncedAt),
    sequence: normalizedSeq,
  });

  return {
    demo: true,
    request,
    recipient: {
      ...recipient,
      groupId,
      requestLocalId: request.id,
      detail: {
        content: recipient.content,
        recipientNo: recipient.recipientNo,
      },
    },
  };
}

export function getMessageLogDemoCaseSyncResult({ groupId, now = new Date() } = {}) {
  const demoCase = findDemoCaseByGroupId(groupId, now);

  if (!demoCase) {
    return null;
  }

  return {
    demo: true,
    state: 'completed',
    syncedRequestCount: demoCase.requests.filter((request) => request.canFetchRecipients).length,
    errorCount: 0,
    group: demoCase.group,
  };
}

export function getMessageLogDemoCaseResendResult({ providerRequestId } = {}) {
  if (!isMessageLogDemoProviderRequestId(providerRequestId)) {
    return null;
  }

  return {
    demo: true,
    state: 'accepted',
    message: '임시 케이스는 실제로 재발송하지 않습니다.',
  };
}

function buildDemoCases(now) {
  return DEMO_CASE_DEFINITIONS.map((definition, index) => createDemoCase({
    definition,
    index,
    now,
  }));
}

const DEMO_CASE_DEFINITIONS = [
  {
    key: 'sms-completed-without-result-code',
    channel: CHANNELS.SMS,
    title: '39번 검수 - SMS 완료 상태, 결과 코드 없음',
    sendKind: 'basic',
    totalRecipientCount: 2,
    providerState: 'accepted',
    resultState: 'syncing',
    pendingCount: 2,
    hiddenFromList: true,
    resultPattern: ['completed-no-result', 'completed-no-result'],
  },
  {
    key: 'alimtalk-completed-without-result-code',
    channel: CHANNELS.ALIMTALK,
    title: '39번 검수 - 알림톡 완료 상태, 결과 코드 없음',
    sendKind: 'basic',
    totalRecipientCount: 2,
    providerState: 'accepted',
    resultState: 'syncing',
    pendingCount: 2,
    hiddenFromList: true,
    resultPattern: ['completed-no-result', 'completed-no-result'],
  },
  {
    key: 'sms-basic-unsynced',
    channel: CHANNELS.SMS,
    title: '일반 SMS - 접수 완료, 결과 미확인',
    sendKind: 'basic',
    totalRecipientCount: 1,
    providerState: 'accepted',
    resultState: 'not_synced',
    resultPattern: ['pending'],
  },
  {
    key: 'sms-basic-syncing',
    channel: CHANNELS.SMS,
    title: '일반 SMS - 결과 확인 중',
    sendKind: 'basic',
    totalRecipientCount: 12,
    providerState: 'accepted',
    resultState: 'syncing',
    pendingCount: 12,
    resultPattern: ['pending', 'pending', 'success'],
  },
  {
    key: 'sms-bulk-success',
    channel: CHANNELS.SMS,
    title: '대량 SMS - 전체 성공',
    sendKind: 'bulk',
    totalRecipientCount: 1000,
    providerState: 'accepted',
    resultState: 'synced',
    successCount: 1000,
    resultPattern: ['success', 'success', 'success'],
  },
  {
    key: 'lms-bulk-partial',
    channel: CHANNELS.LMS,
    title: '대량 LMS - 성공/실패/대기 혼합',
    sendKind: 'bulk',
    totalRecipientCount: 3000,
    providerState: 'accepted',
    resultState: 'partially_synced',
    successCount: 2880,
    failedCount: 24,
    pendingCount: 96,
    requests: [
      { accepted: true, recipientCount: 1000, successCount: 980, failedCount: 8, pendingCount: 12 },
      { accepted: true, recipientCount: 1000, successCount: 970, failedCount: 10, pendingCount: 20 },
      { accepted: true, recipientCount: 1000, successCount: 930, failedCount: 6, pendingCount: 64 },
    ],
    resultPattern: ['success', 'failed', 'pending'],
  },
  {
    key: 'mms-bulk-canceled',
    channel: CHANNELS.MMS,
    title: '대량 MMS - 취소 포함',
    sendKind: 'bulk',
    totalRecipientCount: 100,
    providerState: 'accepted',
    resultState: 'synced',
    successCount: 92,
    failedCount: 5,
    canceledCount: 3,
    resultPattern: ['success', 'failed', 'canceled'],
  },
  {
    key: 'sms-bulk-partial-accepted',
    channel: CHANNELS.SMS,
    title: '대량 SMS - 일부 접수',
    sendKind: 'bulk',
    totalRecipientCount: 2500,
    providerRequestCount: 3,
    acceptedRequestCount: 2,
    providerState: 'partial',
    resultState: 'not_synced',
    requests: [
      { accepted: true, recipientCount: 1000 },
      { accepted: true, recipientCount: 1000 },
      { providerState: 'failed', recipientCount: 500 },
    ],
    resultPattern: ['pending'],
  },
  {
    key: 'sms-scheduled-sent',
    channel: CHANNELS.SMS,
    title: '예약 SMS - 발송 완료',
    sendKind: 'bulk',
    sendTiming: 'scheduled',
    scheduledOffsetMinutes: -45,
    totalRecipientCount: 300,
    providerState: 'accepted',
    resultState: 'synced',
    successCount: 300,
    resultPattern: ['success', 'success', 'success'],
  },
  {
    key: 'sms-scheduled-queued',
    channel: CHANNELS.SMS,
    title: '일반 SMS - 접수 대기',
    sendKind: 'bulk',
    totalRecipientCount: 450,
    providerState: 'queued',
    resultState: 'not_synced',
    requests: [{ providerState: 'queued', recipientCount: 450 }],
    resultPattern: ['pending'],
  },
  {
    key: 'sms-scheduled-canceled',
    channel: CHANNELS.SMS,
    title: '일반 SMS - 취소됨',
    sendKind: 'bulk',
    totalRecipientCount: 120,
    providerState: 'canceled',
    resultState: 'not_synced',
    canceledCount: 120,
    requests: [{ providerState: 'canceled', recipientCount: 120, canceledCount: 120 }],
    resultPattern: ['canceled'],
  },
  {
    key: 'sms-provider-failed',
    channel: CHANNELS.SMS,
    title: '일반 SMS - 접수 실패',
    sendKind: 'basic',
    totalRecipientCount: 1,
    providerState: 'failed',
    resultState: 'error',
    failedCount: 1,
    requests: [{ providerState: 'failed', recipientCount: 1, failedCount: 1 }],
    resultPattern: ['failed'],
  },
  {
    key: 'sms-provider-unknown',
    channel: CHANNELS.SMS,
    title: '일반 SMS - 확인 필요',
    sendKind: 'basic',
    totalRecipientCount: 1,
    providerState: 'unknown',
    resultState: 'stale',
    pendingCount: 1,
    requests: [{ providerState: 'unknown', resultState: 'stale', recipientCount: 1, pendingCount: 1 }],
    resultPattern: ['pending'],
  },
  {
    key: 'alimtalk-basic-unsynced',
    channel: CHANNELS.ALIMTALK,
    title: '알림톡 - 접수 완료, 결과 미확인',
    sendKind: 'basic',
    sourceType: 'automation',
    sourceEventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
    sourceExternalEventId: 'dev-automation-event-0001',
    sourceChannelCode: 'publ-demo-vvee-001',
    sourceAutomationRuleId: '11111111-1111-4111-8111-111111111111',
    sourceAutomationDeliveryId: '22222222-2222-4222-8222-222222222222',
    totalRecipientCount: 1,
    providerState: 'accepted',
    resultState: 'not_synced',
    resultPattern: ['pending'],
  },
  {
    key: 'alimtalk-bulk-partial',
    channel: CHANNELS.ALIMTALK,
    title: '알림톡 - 성공/실패/대기 혼합',
    sendKind: 'bulk',
    totalRecipientCount: 1000,
    providerState: 'accepted',
    resultState: 'partially_synced',
    successCount: 930,
    failedCount: 20,
    pendingCount: 50,
    resultPattern: ['success', 'failed', 'pending'],
  },
  {
    key: 'alimtalk-scheduled-queued',
    channel: CHANNELS.ALIMTALK,
    title: '알림톡 - 접수 대기',
    sendKind: 'bulk',
    totalRecipientCount: 300,
    providerState: 'queued',
    resultState: 'not_synced',
    requests: [{ providerState: 'queued', recipientCount: 300 }],
    resultPattern: ['pending'],
  },
  {
    key: 'alimtalk-provider-failed',
    channel: CHANNELS.ALIMTALK,
    title: '알림톡 - 접수 실패',
    sendKind: 'basic',
    totalRecipientCount: 1,
    providerState: 'rejected',
    resultState: 'error',
    failedCount: 1,
    requests: [{ providerState: 'rejected', recipientCount: 1, failedCount: 1 }],
    resultPattern: ['failed'],
  },
  {
    key: 'brand-success',
    channel: CHANNELS.BRAND_MESSAGE,
    title: '브랜드 메시지 - 전체 성공',
    sendKind: 'bulk',
    totalRecipientCount: 1000,
    providerState: 'accepted',
    resultState: 'synced',
    successCount: 1000,
    resultPattern: ['success', 'success', 'success'],
  },
  {
    key: 'brand-partial',
    channel: CHANNELS.BRAND_MESSAGE,
    title: '브랜드 메시지 - 일부 실패',
    sendKind: 'bulk',
    totalRecipientCount: 1000,
    providerState: 'accepted',
    resultState: 'partially_synced',
    successCount: 940,
    failedCount: 60,
    resultPattern: ['success', 'failed', 'failed'],
  },
  {
    key: 'brand-provider-failed',
    channel: CHANNELS.BRAND_MESSAGE,
    title: '브랜드 메시지 - 접수 실패',
    sendKind: 'basic',
    totalRecipientCount: 1,
    providerState: 'failed',
    resultState: 'error',
    failedCount: 1,
    requests: [{ providerState: 'failed', recipientCount: 1, failedCount: 1 }],
    resultPattern: ['failed'],
  },
];

function createDemoCase({ definition, index, now }) {
  const createdAt = addMinutes(now, -5 - index * 7);
  const scheduledAt = definition.sendTiming === 'scheduled'
    ? addMinutes(now, definition.scheduledOffsetMinutes ?? 120)
    : null;
  const resultSyncedAt = hasResultSyncTime(definition.resultState) ? addMinutes(createdAt, 4) : null;
  const internalRequests = createDemoRequests({
    createdAt,
    definition,
    resultSyncedAt,
  });
  const requests = internalRequests.map(toPublicRequest);
  const group = {
    id: `${DEMO_GROUP_PREFIX}${definition.key}`,
    channel: definition.channel,
    sendKind: definition.sendKind ?? 'basic',
    sendTiming: definition.sendTiming ?? 'immediate',
    managementTitle: definition.title,
    senderLabel: getDemoSenderLabel(definition.channel),
    source: getDemoSource(definition),
    totalRecipientCount: definition.totalRecipientCount,
    recipientCount: definition.totalRecipientCount,
    providerRequestCount: definition.providerRequestCount ?? internalRequests.length,
    acceptedRequestCount: definition.acceptedRequestCount ?? internalRequests.filter((request) => request.providerState === 'accepted').length,
    providerState: definition.providerState,
    resultState: definition.resultState,
    successCount: definition.successCount ?? 0,
    failedCount: definition.failedCount ?? 0,
    pendingCount: definition.pendingCount ?? 0,
    canceledCount: definition.canceledCount ?? 0,
    resultSyncedAt: toIsoOrNull(resultSyncedAt),
    resultFinalizedAt: toIsoOrNull(definition.resultState === 'synced' ? resultSyncedAt : null),
    scheduledAt: toIsoOrNull(scheduledAt),
    createdAt: toIsoOrNull(createdAt),
    expiresAt: toIsoOrNull(addDays(createdAt, 90)),
    requestDate: toIsoOrNull(scheduledAt ?? createdAt),
    receiveDate: toIsoOrNull(resultSyncedAt),
    aggregateState: getAggregateState(definition),
  };
  const recipientsByRequestId = new Map(internalRequests.map((request) => [
    request.id,
    createDemoRecipients({
      createdAt,
      definition,
      request,
      resultSyncedAt,
    }),
  ]));

  return {
    definition,
    group,
    requests,
    recipientsByRequestId,
  };
}

function getDemoSource(definition) {
  if (definition.sourceType === 'automation') {
    return {
      type: 'automation',
      label: '자동화',
      eventKey: definition.sourceEventKey ?? null,
      externalEventId: definition.sourceExternalEventId ?? null,
      channelCode: definition.sourceChannelCode ?? null,
      automationRuleId: definition.sourceAutomationRuleId ?? null,
      automationRuleName: null,
      automationDeliveryId: definition.sourceAutomationDeliveryId ?? null,
    };
  }

  return {
    type: 'manual',
    label: '직접 발송',
  };
}

function toPublicRequest(request) {
  const { providerRequestId: _providerRequestId, ...publicRequest } = request;
  return publicRequest;
}

function createDemoRequests({ createdAt, definition, resultSyncedAt }) {
  const requestDefinitions = definition.requests ?? [{
    accepted: definition.providerState === 'accepted',
    recipientCount: definition.totalRecipientCount,
    successCount: definition.successCount ?? 0,
    failedCount: definition.failedCount ?? 0,
    pendingCount: definition.pendingCount ?? 0,
    canceledCount: definition.canceledCount ?? 0,
  }];

  return requestDefinitions.map((requestDefinition, index) => {
    const providerState = requestDefinition.providerState
      ?? (requestDefinition.accepted === false ? 'failed' : definition.providerState === 'partial' ? 'accepted' : definition.providerState);
    const providerRequestId = providerState === 'accepted'
      ? `${DEMO_PROVIDER_REQUEST_PREFIX}${definition.key}-${index + 1}`
      : null;

    return {
      id: `${DEMO_REQUEST_PREFIX}${definition.key}-${index + 1}`,
      sequence: index + 1,
      recipientCount: requestDefinition.recipientCount,
      providerState,
      resultState: requestDefinition.resultState ?? definition.resultState,
      successCount: requestDefinition.successCount ?? 0,
      failedCount: requestDefinition.failedCount ?? 0,
      pendingCount: requestDefinition.pendingCount ?? 0,
      canceledCount: requestDefinition.canceledCount ?? 0,
      resultSyncedAt: toIsoOrNull(hasResultSyncTime(requestDefinition.resultState ?? definition.resultState) ? resultSyncedAt : null),
      resultFinalizedAt: toIsoOrNull((requestDefinition.resultState ?? definition.resultState) === 'synced' ? resultSyncedAt : null),
      nextSyncAt: toIsoOrNull((requestDefinition.resultState ?? definition.resultState) === 'not_synced' ? addMinutes(createdAt, 15) : null),
      createdAt: toIsoOrNull(createdAt),
      canFetchRecipients: Boolean(providerRequestId && providerState === 'accepted'),
      providerRequestId,
    };
  });
}

function createDemoRecipients({ countMode = 'preview', createdAt, definition, request, resultSyncedAt }) {
  if (!request.providerRequestId || request.providerState !== 'accepted') {
    if (countMode !== 'full' || Number(request.failedCount ?? 0) <= 0) {
      return [];
    }
  }

  const rowCount = countMode === 'full'
    ? Number(request.recipientCount ?? 0)
    : (definition.resultPattern ?? ['pending']).length;

  return Array.from({ length: rowCount }, (_, index) =>
    createDemoRecipient({
      createdAt,
      definition,
      request,
      resultSyncedAt,
      sequence: index + 1,
    })
  );
}

function createDemoRecipient({ createdAt, definition, request, resultSyncedAt, sequence }) {
  const state = getDemoRecipientState(definition, request, sequence);
  const result = getRecipientResult(definition.channel, state);
  const receiveDate = state === 'pending' ? null : resultSyncedAt ?? addMinutes(createdAt, 5);

  return {
    id: `${definition.channel}:${request.providerRequestId ?? request.id}:${sequence}`,
    channel: definition.channel,
    requestId: request.providerRequestId,
    requestLocalId: request.id,
    recipientSeq: sequence,
    senderLabel: getDemoSenderLabel(definition.channel),
    recipientNo: getDemoRecipientNo(sequence),
    content: getDemoMessageContent(definition),
    contentPreview: definition.title,
    templateCode: isKakaoChannel(definition.channel) ? 'DEMO_TEMPLATE' : null,
    requestDate: toIsoOrNull(createdAt),
    receiveDate: toIsoOrNull(receiveDate),
    status: result.status,
    resultCode: result.resultCode,
    resultMessage: result.resultMessage,
  };
}

function getDemoRecipientState(definition, request, sequence) {
  const pattern = definition.resultPattern ?? ['pending'];

  if (pattern.includes('completed-no-result')) {
    return pattern[(sequence - 1) % pattern.length] ?? 'pending';
  }

  const successCount = Number(request.successCount ?? 0);
  const failedCount = Number(request.failedCount ?? 0);
  const canceledCount = Number(request.canceledCount ?? 0);
  const pendingCount = Number(request.pendingCount ?? 0);
  const countedTotal = successCount + failedCount + canceledCount + pendingCount;

  if (countedTotal > 0) {
    if (sequence <= successCount) return 'success';
    if (sequence <= successCount + failedCount) return 'failed';
    if (sequence <= successCount + failedCount + canceledCount) return 'canceled';
    return 'pending';
  }

  return pattern[(sequence - 1) % pattern.length] ?? 'pending';
}

function getDemoRecipientNo(sequence) {
  return `010${String(1000 + sequence - 1).padStart(4, '0')}${String(2000 + sequence - 1).padStart(4, '0')}`;
}

function getDemoMessageContent(definition) {
  if (definition.channel === CHANNELS.ALIMTALK) {
    return '안녕하세요 #{고객명}님, 요청하신 알림톡 안내입니다. 자세한 내용은 마이페이지에서 확인해 주세요.';
  }

  if (definition.channel === CHANNELS.BRAND_MESSAGE) {
    return '새로운 혜택 안내드립니다. 오늘 등록된 브랜드 메시지 샘플 본문입니다.';
  }

  if (definition.channel === CHANNELS.LMS || definition.channel === CHANNELS.MMS) {
    return '안녕하세요. 예약하신 서비스 이용 안내드립니다.\n확인 후 문의가 필요하시면 고객센터로 연락해 주세요.';
  }

  return '안녕하세요. 요청하신 SMS 안내 메시지입니다.';
}

function formatDemoRequestLabel(request) {
  const sequence = Number(request?.sequence ?? 0);
  return sequence > 0 ? `요청 ${sequence}` : '요청';
}

function getRecipientResult(channel, state) {
  if (state === 'completed-no-result') {
    return {
      status: isKakaoChannel(channel) ? 'COMPLETED' : 'COMPLETED',
      resultCode: null,
      resultMessage: null,
    };
  }

  if (state === 'success') {
    return {
      status: isKakaoChannel(channel) ? 'COMPLETED' : '3',
      resultCode: SUCCESS_CODE_BY_CHANNEL[channel],
      resultMessage: '성공',
    };
  }

  if (state === 'failed') {
    return {
      status: isKakaoChannel(channel) ? 'FAILED' : '5',
      resultCode: isKakaoChannel(channel) ? 'MRC02' : '2001',
      resultMessage: '실패 예시',
    };
  }

  if (state === 'canceled') {
    return {
      status: 'CANCELED',
      resultCode: 'CANCEL',
      resultMessage: '취소됨',
    };
  }

  return {
    status: isKakaoChannel(channel) ? 'SENDING' : '2',
    resultCode: null,
    resultMessage: '대기 중',
  };
}

function findDemoCaseByGroupId(groupId, now) {
  return buildDemoCases(now).find((item) => item.group.id === groupId) ?? null;
}

function isDemoGroupInListChannel(group, channel, messageType) {
  if (channel === CHANNELS.SMS) {
    return messageType ? group.channel === messageType : SMS_CHANNELS.includes(group.channel);
  }

  return group.channel === channel;
}

function isDemoGroupSentInRange(group, { from, now, to }) {
  const sentAt = parseDate(group.scheduledAt ?? group.createdAt);
  if (!sentAt || sentAt > now) return false;
  if (from && sentAt < from) return false;
  if (to && sentAt > to) return false;
  return true;
}

function getDemoSenderLabel(channel) {
  if (channel === CHANNELS.ALIMTALK) return '알림톡 발신 채널';
  if (channel === CHANNELS.BRAND_MESSAGE) return '브랜드 발신 채널';
  return '대표 문자 발신번호';
}

function getAggregateState(definition) {
  if (['canceled', 'failed', 'rejected', 'blocked'].includes(definition.providerState)) return 'failed';
  if (definition.providerState === 'unknown' || ['stale', 'error'].includes(definition.resultState)) return 'partial';
  if (['not_synced', 'syncing'].includes(definition.resultState)) return 'pending';

  const failedCount = Number(definition.failedCount ?? 0) + Number(definition.canceledCount ?? 0);
  const pendingCount = Number(definition.pendingCount ?? 0);
  const successCount = Number(definition.successCount ?? 0);
  const recipientCount = Number(definition.totalRecipientCount ?? 0);

  if (recipientCount > 0 && successCount === recipientCount) return 'success';
  if (recipientCount > 0 && failedCount === recipientCount) return 'failed';

  return [successCount, failedCount, pendingCount].filter((count) => count > 0).length > 1 ? 'partial' : 'pending';
}

function hasResultSyncTime(resultState) {
  return ['partially_synced', 'synced', 'stale', 'error'].includes(resultState);
}

function compareGroupsDesc(left, right) {
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function isKakaoChannel(channel) {
  return channel === CHANNELS.ALIMTALK || channel === CHANNELS.BRAND_MESSAGE;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoOrNull(value) {
  return value ? new Date(value).toISOString() : null;
}

function normalizeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}
