const CHANNEL_LABELS = Object.freeze({
  alimtalk: '카카오 채널',
  'brand-message': '카카오 채널',
  sms: '문자',
});
const LIMIT_SCOPE_LABELS = Object.freeze({
  daily_channel: '채널별 일 한도',
  monthly: '월 한도',
});

export function getLimitScope(channel) {
  return channel === 'sms' ? 'monthly' : 'daily_channel';
}

export function toLimitRequestDto({ request, senderResource = null, user = null }) {
  return {
    id: request.id,
    userId: request.userId,
    channel: request.channel,
    channelLabel: CHANNEL_LABELS[request.channel] ?? request.channel,
    limitScope: request.limitScope,
    limitScopeLabel: LIMIT_SCOPE_LABELS[request.limitScope] ?? request.limitScope,
    senderResourceId: request.senderResourceId,
    senderResource: senderResource ? toSenderResourceDto(senderResource) : null,
    currentLimit: request.currentLimit,
    requestedLimit: request.requestedLimit,
    reason: request.reason,
    status: request.status,
    reviewedBy: request.reviewedBy,
    reviewedAt: request.reviewedAt,
    reviewMemo: request.reviewMemo,
    rejectReason: request.rejectReason,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    user: user ? toUserDto(user) : undefined,
  };
}

function toSenderResourceDto(resource) {
  return {
    id: resource.id,
    resourceRef: resource.resourceRef,
    provider: resource.provider,
    type: resource.type,
    value: resource.value,
    displayName: resource.displayName,
    status: resource.status,
    providerStatus: resource.providerStatus,
    metadataJson: resource.metadataJson,
    quotaLimit: resource.quotaLimit,
  };
}

function toUserDto(user) {
  return {
    id: user.id,
    userRef: user.userRef,
    email: user.email,
    name: user.name,
    status: user.status,
  };
}
