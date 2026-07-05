'use client';

import { RefreshCcw } from 'lucide-react';
import { KakaoChannelAddPage } from '../../components/sender-resources/index.js';
import { Button } from '../../components/ui/index.js';
import { getRelayErrorMessage } from './messageSend/api.js';
import {
  useKakaoConnectRequestMutation,
  useKakaoConnectVerifyMutation,
} from './messageSend/mutations.js';
import { useKakaoConnectBootstrapQuery } from './messageSend/queries.js';

const EMPTY_KAKAO_LIST = [];
export function KakaoChannelConnectPage({ onBack }) {
  const bootstrapQuery = useKakaoConnectBootstrapQuery();
  const requestMutation = useKakaoConnectRequestMutation();
  const verifyMutation = useKakaoConnectVerifyMutation();
  const categories = Array.isArray(bootstrapQuery.data?.categories)
    ? bootstrapQuery.data.categories
    : EMPTY_KAKAO_LIST;
  const existingChannels = Array.isArray(bootstrapQuery.data?.existingChannels)
    ? bootstrapQuery.data.existingChannels
    : EMPTY_KAKAO_LIST;

  function requestOtp(payload) {
    return requestMutation.mutateAsync(payload);
  }

  function verifyOtp({ plusFriendId, requestState, token }) {
    return verifyMutation.mutateAsync({
      applicationId: requestState.applicationId,
      plusFriendId,
      token,
    });
  }

  return (
    <>
      {bootstrapQuery.isError ? (
        <div className="message-send-api-status settings-resource-status" data-tone="critical" role="alert">
          <span>{getRelayErrorMessage(bootstrapQuery.error, '카카오 채널 등록 정보를 불러오지 못했습니다.')}</span>
          <Button onClick={() => bootstrapQuery.refetch()}>
            <RefreshCcw aria-hidden="true" size={14} />
            다시 시도
          </Button>
        </div>
      ) : null}
      <KakaoChannelAddPage
        categories={categories}
        existingChannels={existingChannels}
        getErrorMessage={getRelayErrorMessage}
        onBack={onBack}
        onRequestOtp={requestOtp}
        onVerifyOtp={verifyOtp}
      />
    </>
  );
}
