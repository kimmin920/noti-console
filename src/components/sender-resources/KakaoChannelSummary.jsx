import Image from 'next/image';
import { DomainStep } from '../domains/index.js';

export function KakaoChannelCompletedStep({ requestState }) {
  return (
    <DomainStep
      className="domain-information-step kakao-channel-information-step"
      status="completed"
      title="카카오 채널"
    >
      <div className="kakao-channel-readonly-field" id="completed-kakao-channel">
        <Image
          alt="KakaoTalk"
          className="kakao-channel-readonly-image"
          height={18}
          src="/static/icons/kakao-talk.png"
          width={18}
        />
        <div className="kakao-channel-readonly-copy kakao-channel-readonly-copy-inline">
          <strong>{requestState.plusFriendId}</strong>
          <span aria-hidden="true">·</span>
          <span>{requestState.phoneNo}</span>
        </div>
      </div>
    </DomainStep>
  );
}

export function KakaoChannelAside({
  form,
  requestState,
}) {
  const plusFriendId = requestState?.plusFriendId || form.plusFriendId || '@내채널ID';
  const phoneNo = requestState?.phoneNo || form.phoneNo || '01012345678';

  return (
    <aside aria-label="KakaoTalk preview" className="domain-email-preview kakao-channel-email-preview">
      <div className="domain-email-preview-header">
        <span className="domain-email-avatar">K</span>
        <div className="domain-email-meta">
          <div>
            <span className="domain-email-name">{plusFriendId}</span>
            <span className="domain-email-address">&lt;{phoneNo}&gt;</span>
          </div>
          <span className="domain-email-recipient">to KakaoTalk channel</span>
        </div>
      </div>
      <div className="domain-email-lines">
        <span />
        <span />
        <span />
      </div>
    </aside>
  );
}

export function KakaoChannelStatusList({ rows = [] }) {
  return (
    <dl className="kakao-channel-status-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
