import {
  buildResolvedKakaoCategoryCode,
  normalizeKakaoPhone,
  normalizeKakaoPlusFriendId,
} from './kakaoChannelUtils.js';

export function createKakaoRequestState(form) {
  return {
    categoryCode: buildResolvedKakaoCategoryCode(form),
    message: '관리자 휴대폰으로 6자리 인증 토큰을 발송했습니다.',
    phoneNo: normalizeKakaoPhone(form.phoneNo),
    plusFriendId: normalizeKakaoPlusFriendId(form.plusFriendId),
  };
}

export function createKakaoVerifiedSender(requestState, isDefault = true) {
  return {
    createdAt: '2026-06-04',
    id: 'sender-profile-preview',
    isDefault,
    plusFriendId: requestState.plusFriendId,
    senderKey: 'sender-key-preview-001',
    senderProfileType: 'alimtalk',
    status: 'ACTIVE',
  };
}

export function createKakaoRequestStateFromHandlerResult(result, requestState) {
  return {
    ...requestState,
    applicationId: result?.requestState?.applicationId ?? result?.application?.id ?? result?.applicationId,
    message: result?.message ?? result?.requestState?.message ?? requestState.message,
  };
}

export function createKakaoVerifyResultFromHandlerResult(result, requestState, isDefault) {
  if (result?.verifyResult?.sender) {
    return result.verifyResult;
  }

  const sender = createKakaoVerifiedSenderFromResult(result, requestState, isDefault);

  return {
    message: result?.message ?? 'NHN 응답의 senderKey를 저장했습니다.',
    sender,
  };
}

export function getDefaultKakaoConnectErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function mergeKakaoChannels(primaryChannels, existingChannels) {
  const seen = new Set();

  return [...primaryChannels, ...existingChannels].filter((channel) => {
    const key = channel.senderKey ?? channel.plusFriendId ?? channel.id;

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function createKakaoVerifiedSenderFromResult(result, requestState, isDefault) {
  const resource = result?.resource ?? result?.sender ?? result?.verifyResult?.sender;

  if (!resource) {
    return createKakaoVerifiedSender(requestState, isDefault);
  }

  return {
    createdAt: resource.createdAt ?? new Date().toISOString(),
    id: resource.id ?? resource.senderResourceId ?? resource.senderKey ?? 'sender-profile-connected',
    isDefault: Boolean(resource.isDefault ?? isDefault),
    plusFriendId: resource.plusFriendId ?? resource.displayName ?? requestState.plusFriendId,
    senderKey: resource.senderKey ?? resource.value ?? '-',
    senderProfileType: resource.senderProfileType ?? 'alimtalk',
    status: resource.status ?? 'ACTIVE',
  };
}
