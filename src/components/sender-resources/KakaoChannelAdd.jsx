'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { DomainAddHeader, DomainAddSteps } from '../domains/index.js';
import {
  defaultKakaoConnectForm,
  kakaoConnectCategories,
  kakaoExistingChannels,
} from './kakaoChannelData.js';
import { KakaoChannelInformationStep } from './KakaoChannelForm.jsx';
import { KakaoChannelActivationStep, KakaoChannelOtpStep } from './KakaoChannelOtpStep.jsx';
import { KakaoChannelCompletedStep } from './KakaoChannelSummary.jsx';
import {
  createKakaoRequestState,
  createKakaoRequestStateFromHandlerResult,
  createKakaoVerifiedSender,
  createKakaoVerifyResultFromHandlerResult,
  getDefaultKakaoConnectErrorMessage,
  mergeKakaoChannels,
} from './kakaoChannelConnectResult.js';
import {
  buildResolvedKakaoCategoryCode,
  getKakaoCategoryState,
  normalizeKakaoPhone,
  normalizeKakaoPlusFriendId,
} from './kakaoChannelUtils.js';

function getInitialState({ initialStatus, prefilled }) {
  if (initialStatus === 'default' || initialStatus === 'prefilled') {
    return { requestState: null, verifyResult: null };
  }

  const requestState = createKakaoRequestState(prefilled);

  if (initialStatus === 'verified') {
    return {
      requestState,
      verifyResult: {
        message: '채널 연결을 완료했습니다.',
        sender: createKakaoVerifiedSender(requestState),
      },
    };
  }

  return {
    requestState,
    verifyResult: null,
  };
}

export function KakaoChannelAddPage({
  categories = kakaoConnectCategories,
  defaultForm = defaultKakaoConnectForm,
  existingChannels = kakaoExistingChannels,
  getErrorMessage = getDefaultKakaoConnectErrorMessage,
  initialStatus = 'default',
  onBack,
  onRequestOtp,
  onVerifyOtp,
}) {
  const [form, setForm] = useState(() => (
    initialStatus === 'default'
      ? {
          ...defaultKakaoConnectForm,
          largeCategoryCode: '',
          middleCategoryCode: '',
          phoneNo: '',
          plusFriendId: '',
          smallCategoryCode: '',
        }
      : defaultForm
  ));
  const initialConnectState = useMemo(
    () => getInitialState({ initialStatus, prefilled: defaultForm }),
    [defaultForm, initialStatus]
  );
  const [requestState, setRequestState] = useState(initialConnectState.requestState);
  const [verifyResult, setVerifyResult] = useState(initialConnectState.verifyResult);
  const [error, setError] = useState(initialStatus === 'rejected' ? '인증 토큰이 일치하지 않습니다.' : '');
  const [connectedChannels, setConnectedChannels] = useState(() => (
    initialConnectState.verifyResult?.sender
      ? [initialConnectState.verifyResult.sender]
      : []
  ));
  const [requestPending, setRequestPending] = useState(false);
  const [verifyPending, setVerifyPending] = useState(false);
  const categoryState = getKakaoCategoryState(categories, form);
  const categoryCode = buildResolvedKakaoCategoryCode(form);
  const channels = useMemo(
    () => mergeKakaoChannels(connectedChannels, existingChannels),
    [connectedChannels, existingChannels]
  );
  const isVerified = Boolean(verifyResult?.sender);

  function resetConnectionState() {
    setError('');
    setRequestState(null);
    setVerifyResult(null);
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value, token: '' }));
    resetConnectionState();
  }

  function updateLargeCategory(value) {
    setForm((current) => ({
      ...current,
      largeCategoryCode: value,
      middleCategoryCode: '',
      smallCategoryCode: '',
      token: '',
    }));
    resetConnectionState();
  }

  function updateMiddleCategory(value) {
    setForm((current) => ({ ...current, middleCategoryCode: value, smallCategoryCode: '', token: '' }));
    resetConnectionState();
  }

  function updateSmallCategory(value) {
    setForm((current) => ({ ...current, smallCategoryCode: value, token: '' }));
    resetConnectionState();
  }

  async function requestOtp(event) {
    event.preventDefault();

    if (requestPending) {
      return;
    }

    const plusFriendId = normalizeKakaoPlusFriendId(form.plusFriendId);
    const phoneNo = normalizeKakaoPhone(form.phoneNo);

    if (!plusFriendId || !phoneNo || categoryCode.length !== 11) {
      setError('채널 ID, 관리자 휴대폰, 소분류까지의 카테고리를 모두 입력해 주세요.');
      return;
    }

    const nextRequestState = { categoryCode, message: '관리자 휴대폰으로 6자리 인증 토큰을 발송했습니다.', phoneNo, plusFriendId };

    setError('');
    setRequestPending(true);

    try {
      const result = await onRequestOtp?.(nextRequestState);
      setForm((current) => ({ ...current, phoneNo, plusFriendId, token: '' }));
      setRequestState(createKakaoRequestStateFromHandlerResult(result, nextRequestState));
      setVerifyResult(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'OTP 요청을 완료하지 못했습니다.'));
    } finally {
      setRequestPending(false);
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();

    if (verifyPending) {
      return;
    }

    if (!requestState) {
      setError('먼저 인증 토큰을 요청해 주세요.');
      return;
    }

    if (!/^\d{6}$/.test(form.token.trim())) {
      setError('휴대폰으로 받은 6자리 숫자 토큰을 입력해 주세요.');
      return;
    }

    setError('');
    setVerifyPending(true);

    try {
      const token = Number(form.token);
      const result = await onVerifyOtp?.({ plusFriendId: requestState.plusFriendId, requestState, token });
      const nextResult = createKakaoVerifyResultFromHandlerResult(result, requestState, channels.length === 0);
      const { sender } = nextResult;

      setVerifyResult(nextResult);
      setConnectedChannels((current) => [sender, ...current.filter((item) => item.plusFriendId !== sender.plusFriendId)]);
    } catch (verifyError) {
      setError(getErrorMessage(verifyError, 'OTP 인증을 완료하지 못했습니다.'));
    } finally {
      setVerifyPending(false);
    }
  }

  return (
    <section className="page-frame domain-add-page kakao-channel-add-page">
      <DomainAddHeader
        description="발신프로필 등록 요청 후 관리자 휴대폰으로 받은 OTP를 인증합니다."
        title="카카오 채널 추가"
      />
      {onBack ? (
        <button className="sender-resource-back-button kakao-channel-back-button" onClick={onBack} type="button">
          <ChevronLeft aria-hidden="true" size={15} />
          발신 수단 관리
        </button>
      ) : null}
      <DomainAddSteps>
        {requestState ? (
          <KakaoChannelCompletedStep requestState={requestState} />
        ) : (
          <KakaoChannelInformationStep
            categoryCode={categoryCode}
            categoryState={categoryState}
            error={error}
            form={form}
            onFieldChange={updateField}
            onLargeCategoryChange={updateLargeCategory}
            onMiddleCategoryChange={updateMiddleCategory}
            onRequestOtp={requestOtp}
            onSmallCategoryChange={updateSmallCategory}
            requestPending={requestPending}
          />
        )}
        {!isVerified ? (
          <KakaoChannelOtpStep
            error={requestState ? error : ''}
            form={form}
            onTokenChange={(value) => setForm((current) => ({ ...current, token: value.replace(/[^\d]/g, '') }))}
            onVerifyOtp={verifyOtp}
            requestState={requestState}
            verifyPending={verifyPending}
          />
        ) : null}
        <KakaoChannelActivationStep verifyResult={verifyResult} />
      </DomainAddSteps>
    </section>
  );
}
