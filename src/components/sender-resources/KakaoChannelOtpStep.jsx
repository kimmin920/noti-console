import { Check, CheckCircle2, Send } from 'lucide-react';
import { ConsoleLink } from '../../features/console/ConsoleNavigationContext.jsx';
import {
  DomainAddField,
  DomainStep,
  DomainStepBody,
  DomainStepHeading,
  DomainTextInput,
} from '../domains/index.js';

export function KakaoChannelOtpStep({
  error,
  form,
  onTokenChange,
  onVerifyOtp,
  requestState,
  verifyPending = false,
}) {
  if (!requestState) {
    return (
      <DomainStepBody className="domain-information-step kakao-channel-otp-step" status="not_started">
        <DomainStepHeading status="not_started">OTP 인증</DomainStepHeading>
      </DomainStepBody>
    );
  }

  return (
    <DomainStep
      className="domain-information-step kakao-channel-otp-step"
      description="카카오톡 비즈메시지로 받은 6자리 인증번호를 입력합니다."
      status={error ? 'failed' : 'pending'}
      title="OTP 인증"
    >
      <form className="kakao-channel-otp-form" onSubmit={onVerifyOtp}>
        {error ? <p className="kakao-channel-error" role="alert">{error}</p> : null}
        <DomainAddField htmlFor="kakao-token" label="인증 토큰">
          <DomainTextInput
            autoComplete="one-time-code"
            id="kakao-token"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => onTokenChange(event.target.value)}
            placeholder="123456"
            value={form.token}
          />
        </DomainAddField>
        <div className="domain-add-actions">
          <button className="domain-add-primary-button" disabled={verifyPending} type="submit">
            <Check aria-hidden="true" size={16} />
            <span>{verifyPending ? '인증 중' : '인증하기'}</span>
          </button>
        </div>
      </form>
    </DomainStep>
  );
}

export function KakaoChannelActivationStep({ verifyResult }) {
  if (!verifyResult?.sender) {
    return (
      <DomainStepBody status="not_started">
        <DomainStepHeading status="not_started">채널 활성화</DomainStepHeading>
      </DomainStepBody>
    );
  }

  return (
    <DomainStep
      description="인증이 완료되어 알림톡과 브랜드 메시지 발송에 사용할 수 있습니다."
      status="completed"
      title="채널 활성화"
    >
      <div className="domain-add-actions">
        <button className="domain-add-primary-button" type="button">
          <CheckCircle2 aria-hidden="true" size={16} />
          <span>연결된 채널 보기</span>
        </button>
        <ConsoleLink className="domain-add-secondary-button" href="/message-send?tab=alimtalk">
          <Send aria-hidden="true" size={16} />
          <span>메시지 보내기</span>
        </ConsoleLink>
      </div>
    </DomainStep>
  );
}
