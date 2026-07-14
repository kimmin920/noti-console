import { MessageCircle, Plus } from 'lucide-react';
import {
  DomainAddField,
  DomainExternalLink,
  DomainIconButton,
  DomainStep,
  DomainTextInput,
} from '../domains/index.js';
import { KakaoChannelAside } from './KakaoChannelSummary.jsx';

export function KakaoChannelInformationStep({
  categoryCode,
  categoryState,
  error,
  form,
  onFieldChange,
  onLargeCategoryChange,
  onMiddleCategoryChange,
  onRequestOtp,
  onSmallCategoryChange,
  requestPending = false,
}) {
  return (
    <DomainStep
      className="domain-information-step kakao-channel-information-step"
      description="알림톡과 브랜드 메시지를 발송할 카카오 채널 정보를 입력합니다."
      status="pending"
      title="카카오 채널"
    >
      <div className="domain-information-layout">
        <form className="domain-add-form kakao-channel-form" onSubmit={onRequestOtp}>
          {error ? <p className="kakao-channel-error" role="alert">{error}</p> : null}
          <aside aria-label="카카오톡 채널 생성 안내" className="kakao-channel-creation-guide">
            <p>발신 프로필을 등록하려면 카카오톡 채널이 생성되어야 합니다. 카카오톡 홈페이지에서 카카오톡 채널을 생성하세요.</p>
            <DomainExternalLink href="https://center-pf.kakao.com/">
              카카오톡 채널 생성 바로 가기
            </DomainExternalLink>
            <p className="kakao-channel-creation-guide-note">
              <strong>(참고)</strong> 발신 프로필을 등록하려면 카카오톡 채널 등록 후 비즈니스 인증을 받아야 합니다.
            </p>
          </aside>
          <div className="kakao-channel-contact-grid">
            <DomainAddField htmlFor="kakao-plus-friend-id" label="카카오 채널 ID">
              <div className="domain-add-input-with-action">
                <DomainTextInput
                  autoComplete="off"
                  id="kakao-plus-friend-id"
                  onChange={(event) => onFieldChange('plusFriendId', event.target.value)}
                  placeholder="@내채널ID"
                  required
                  value={form.plusFriendId}
                />
                <DomainIconButton label="카카오 채널 ID 형식">
                  <MessageCircle aria-hidden="true" size={16} />
                </DomainIconButton>
              </div>
            </DomainAddField>
            <DomainAddField htmlFor="kakao-phone-no" label="관리자 휴대폰">
              <DomainTextInput
                autoComplete="off"
                id="kakao-phone-no"
                inputMode="numeric"
                onChange={(event) => onFieldChange('phoneNo', event.target.value)}
                placeholder="01012345678"
                required
                value={form.phoneNo}
              />
            </DomainAddField>
          </div>

          <KakaoCategorySelectGrid
            categoryState={categoryState}
            form={form}
            onLargeCategoryChange={onLargeCategoryChange}
            onMiddleCategoryChange={onMiddleCategoryChange}
            onSmallCategoryChange={onSmallCategoryChange}
          />

          <div className="domain-add-actions">
            <button className="domain-add-primary-button" disabled={requestPending} type="submit">
              <Plus aria-hidden="true" size={16} />
              <span>{requestPending ? '등록 중' : '채널 등록하기'}</span>
            </button>
          </div>
        </form>
        <KakaoChannelAside form={form} />
      </div>
    </DomainStep>
  );
}

function KakaoCategorySelectGrid({
  categoryState,
  form,
  onLargeCategoryChange,
  onMiddleCategoryChange,
  onSmallCategoryChange,
}) {
  return (
    <div className="kakao-connect-category-grid">
      <KakaoCategorySelect
        disabled={false}
        id="kakao-large-category"
        label="카테고리"
        onChange={onLargeCategoryChange}
        options={categoryState.largeOptions}
        placeholder="카테고리 선택"
        value={form.largeCategoryCode}
      />
      {categoryState.selectedLarge ? (
        <KakaoCategorySelect
          className="kakao-channel-category-reveal"
          disabled={false}
          id="kakao-middle-category"
          label="중분류"
          onChange={onMiddleCategoryChange}
          options={categoryState.middleOptions}
          placeholder="중분류 선택"
          value={form.middleCategoryCode}
        />
      ) : null}
      {categoryState.selectedMiddle ? (
        <KakaoCategorySelect
          className="kakao-channel-category-reveal"
          disabled={false}
          id="kakao-small-category"
          label="소분류"
          onChange={onSmallCategoryChange}
          options={categoryState.smallOptions}
          placeholder="소분류 선택"
          value={form.smallCategoryCode}
        />
      ) : null}
    </div>
  );
}

function KakaoCategorySelect({ className = '', disabled, id, label, onChange, options, placeholder, value }) {
  const field = (
    <DomainAddField htmlFor={id} label={label}>
      <select
        className="domain-add-input kakao-channel-select"
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>{option.label}</option>
        ))}
      </select>
    </DomainAddField>
  );

  return className ? <div className={className}>{field}</div> : field;
}
