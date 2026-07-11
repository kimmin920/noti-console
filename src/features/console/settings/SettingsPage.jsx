'use client';

import { useMemo, useState } from 'react';
import { Show, SignOutButton, UserButton, useUser } from '@clerk/nextjs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Circle, MoreHorizontal, Plus } from 'lucide-react';
import { PageHeader } from '../../../components/layout/index.js';
import { SmsSenderNumberAdd } from '../../../components/sender-resources/index.js';
import { Badge, Button, IconButton, SegmentedControl, PropertyRow, SectionPanel, SplitSection, useToast } from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import { formatSettingsPhoneNumber } from '../senderResourceLabels.js';
import { getSettingsSenderResourceRows } from '../senderResourceSettingsRows.js';
import { useSmsSenderApplicationMutation } from '../messageSend/mutations.js';
import { useSenderResourcesQuery } from '../messageSend/queries.js';
import { KakaoChannelConnectPage } from '../KakaoChannelConnectPage.jsx';
import { buildTabQueryHref, getSettingsTabFromQuery, getSettingsTabQueryValue } from '../tabQuery.js';
import { UsageSettingsContent } from './UsageSettingsContent.jsx';

import {
  ADDITIONAL_SENDER_EVIDENCE_FILE,
  COMPANY_SENDER_EVIDENCE_FILES,
  KAKAO_SENDER_RESOURCE_TYPE,
  PERSONAL_SENDER_EVIDENCE_FILES,
  SMS_SENDER_RESOURCE_TYPE,
} from './senderResourceApplicationConfig.js';

function ProfileSettingsContent() {
  const { isLoaded, user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? '';
  const displayEmail = isLoaded ? email : '불러오는 중';
  const externalAccount = user?.externalAccounts?.[0];
  const providerName = externalAccount?.provider
    ? externalAccount.provider.replace(/^oauth_/, '').replace(/^saml_/, '').toUpperCase()
    : 'Clerk';

  return (
    <div className="profile-stack">
      <section className="profile-card profile-email-card" aria-labelledby="profile-email-title">
        <div className="profile-card-heading">
          <h2 id="profile-email-title" className="profile-section-title">내 이메일</h2>
        </div>
        <form className="profile-email-form">
          <div className="profile-field-wrap">
            <label className="profile-label" htmlFor="profile-email">이메일 주소</label>
            <div className="profile-input-wrap">
              <input id="profile-email" type="email" value={displayEmail} readOnly />
            </div>
          </div>
          <div className="profile-card-actions">
            <UserButton userProfileMode="modal" />
            <p className="profile-card-action-note">이메일과 보안 설정은 Clerk 계정 메뉴에서 관리합니다.</p>
          </div>
        </form>
      </section>

      <section className="profile-card profile-auth-card" aria-labelledby="profile-auth-title">
        <div className="profile-card-heading">
          <h2 id="profile-auth-title" className="profile-section-title">인증</h2>
        </div>
        <div className="profile-card-copy">
          <p>현재 로그인 세션과 연결된 인증 상태입니다.</p>
        </div>
        <Show when="signed-in">
          <div className="auth-account-row">
            <div className="auth-provider">
              <span className="auth-provider-icon" aria-hidden="true">
                <AuthProviderIcon providerName={providerName} />
              </span>
              <div>
                <p className="auth-provider-name">{providerName}</p>
                <p className="auth-provider-email">{displayEmail}</p>
              </div>
            </div>
            <p className="auth-date">Clerk 세션 활성</p>
            <IconButton icon={MoreHorizontal} label="더 많은 작업" />
          </div>
        </Show>
        <div className="profile-card-actions profile-auth-actions">
          <UserButton userProfileMode="modal" />
          <SignOutButton redirectUrl="/">
            <Button variant="secondary">로그아웃</Button>
          </SignOutButton>
        </div>
      </section>
    </div>
  );
}

function AuthProviderIcon({ providerName }) {
  return providerName === 'GOOGLE' ? <GoogleIcon /> : <Circle size={18} />;
}

function GoogleIcon() {
  return (
    <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#google-icon-clip)">
        <path d="M19.8094 12.1497C19.8094 11.4942 19.7562 11.0158 19.6411 10.5198H12.1558V13.4784H16.5495C16.4609 14.2137 15.9826 15.321 14.9195 16.0651L14.9046 16.1641L17.2714 17.9976L17.4353 18.0139C18.9412 16.6232 19.8094 14.5769 19.8094 12.1497Z" fill="currentColor" />
        <path d="M12.1557 19.945C14.3083 19.945 16.1153 19.2363 17.4353 18.0139L14.9195 16.065C14.2463 16.5345 13.3427 16.8623 12.1557 16.8623C10.0474 16.8623 8.25806 15.4716 7.6202 13.5493L7.5267 13.5573L5.06575 15.4618L5.03357 15.5513C6.34459 18.1556 9.03754 19.945 12.1557 19.945Z" fill="currentColor" fillOpacity="0.6" />
        <path d="M7.62023 13.5494C7.45193 13.0533 7.35453 12.5218 7.35453 11.9726C7.35453 11.4233 7.45193 10.8918 7.61138 10.3958L7.60692 10.2901L5.11514 8.35498L5.03361 8.39376C4.49327 9.47449 4.18323 10.6881 4.18323 11.9726C4.18323 13.257 4.49327 14.4706 5.03361 15.5513L7.62023 13.5494Z" fill="currentColor" />
        <path d="M12.1557 7.08269C13.6527 7.08269 14.6626 7.72934 15.2384 8.26974L17.4884 6.07286C16.1065 4.7884 14.3083 4 12.1557 4C9.03754 4 6.34459 5.78937 5.03357 8.39371L7.61134 10.3957C8.25806 8.47347 10.0474 7.08269 12.1557 7.08269Z" fill="currentColor" fillOpacity="0.6" />
      </g>
      <defs>
        <clipPath id="google-icon-clip">
          <rect fill="white" height="16" transform="translate(4 4)" width="16" />
        </clipPath>
      </defs>
    </svg>
  );
}

const SETTINGS_TABS = ['사용량', '발신 수단 관리', '청구', '연동', '프로필'];
const SETTINGS_SENDER_RESOURCE_TAB = '발신 수단 관리';
const SETTINGS_SENDER_RESOURCE_QUERY = 'sender-resources';
export function SettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => getSettingsTabFromQuery(searchParams, SETTINGS_TABS));

  function handleActiveTabChange(nextTab) {
    setActiveTab(nextTab);
    router.replace(
      buildTabQueryHref({
        pathname,
        searchParams,
        tabQueryValue: getSettingsTabQueryValue(nextTab),
      }),
      { scroll: false }
    );
  }

  return (
    <section className="page-frame settings-page">
      <PageHeader title="설정" />
      <SegmentedControl
        items={SETTINGS_TABS}
        onValueChange={handleActiveTabChange}
        value={activeTab}
      />
      {activeTab === '사용량' ? <UsageSettingsContent /> : null}
      {activeTab === SETTINGS_SENDER_RESOURCE_TAB ? <SenderResourceSettings /> : null}
      {activeTab === '프로필' ? <ProfileSettingsContent /> : null}
      {activeTab !== '사용량' && activeTab !== SETTINGS_SENDER_RESOURCE_TAB && activeTab !== '프로필' ? (
        <SettingsPlaceholder title={activeTab} />
      ) : null}
    </section>
  );
}

function SenderResourceSettings() {
  const router = useRouter();
  const { showToast } = useToast();
  const senderResourcesQuery = useSenderResourcesQuery();
  const smsResources = getSettingsSenderResourceRows(senderResourcesQuery.data, SMS_SENDER_RESOURCE_TYPE);
  const kakaoResources = getSettingsSenderResourceRows(senderResourcesQuery.data, KAKAO_SENDER_RESOURCE_TYPE);

  function showPendingToast(title) {
    showToast({
      description: '신청/연결 폼과 저장 API는 다음 단계에서 연결합니다.',
      title,
    });
  }

  return (
    <>
      <SenderResourceSection
        actionLabel="번호 추가"
        copy="SMS/LMS/MMS 발송에 사용할 승인된 발신번호를 관리합니다."
        emptyLabel="등록된 발신번호가 없습니다"
        limitLabel="번호별 한도"
        loading={senderResourcesQuery.isPending}
        onAction={() => router.push('/settings/sender-resources/sms/new')}
        onDefaultSelect={() => showPendingToast('기본 발신번호')}
        onResubmit={(item) => router.push(`/settings/sender-resources/sms/new?applicationId=${encodeURIComponent(item.applicationId)}`)}
        resources={smsResources}
        title="발신번호"
      />
      <div className="section-divider" />
      <SenderResourceSection
        actionLabel="채널 추가"
        copy="알림톡 발송에 사용할 카카오 채널과 sender key를 관리합니다."
        emptyLabel="연결된 카카오 채널이 없습니다"
        limitLabel="채널별 한도"
        loading={senderResourcesQuery.isPending}
        onAction={() => router.push('/settings/sender-resources/kakao/new')}
        onDefaultSelect={() => showPendingToast('기본 카카오 채널')}
        onResubmit={() => showPendingToast('카카오 채널 재신청')}
        resources={kakaoResources}
        title="카카오 채널"
      />
      {senderResourcesQuery.isError ? (
        <div className="message-send-api-status settings-resource-status" data-tone="critical" role="alert">
          <span>{getRelayErrorMessage(senderResourcesQuery.error, '발신 수단을 불러오지 못했습니다.')}</span>
          <Button onClick={() => senderResourcesQuery.refetch()}>다시 시도</Button>
        </div>
      ) : null}
    </>
  );
}

function SenderResourceSection({
  actionLabel,
  copy,
  emptyLabel,
  limitLabel,
  loading,
  onAction,
  onDefaultSelect,
  onResubmit,
  resources,
  title,
}) {
  return (
    <SplitSection
      action={(
        <Button onClick={onAction} variant="primary">
          <Plus aria-hidden="true" size={15} />
          {actionLabel}
        </Button>
      )}
      className="sender-resource-section"
      copy={copy}
      tableLabel={`사용 가능한 ${title}`}
      tableMeta={limitLabel}
      title={title}
    >
      {loading ? (
        <PropertyRow
          icon={<Circle size={18} />}
          label="불러오는 중입니다"
          value="대기"
        />
      ) : resources.length ? (
        resources.map((item) => (
          <SenderResourceRow
            item={item}
            key={item.linkId}
            onDefaultSelect={onDefaultSelect}
            onResubmit={onResubmit}
          />
        ))
      ) : (
        <PropertyRow
          icon={<Circle size={18} />}
          label={emptyLabel}
          value="추가 필요"
        />
      )}
    </SplitSection>
  );
}

function SenderResourceRow({ item, onDefaultSelect, onResubmit }) {
  return (
    <PropertyRow
      className="sender-resource-row"
      detail={item.statusLabel}
      icon={<Circle size={18} />}
      label={(
        <span className="sender-resource-label">
          <span className="sender-resource-label-text">{item.label}</span>
          {item.isDefault ? <Badge className="sender-resource-default-badge" tone="green">기본</Badge> : null}
        </span>
      )}
      trailing={item.isPendingApplication ? (
        <Badge>검수 대기</Badge>
      ) : item.isRejectedApplication ? (
        <span className="sender-resource-row-actions">
          <Badge tone="critical">반려됨</Badge>
          <button
            className="sender-resource-default-button"
            onClick={() => onResubmit?.(item)}
            type="button"
          >
            재신청
          </button>
        </span>
      ) : !item.isDefault ? (
        <button
          className="sender-resource-default-button"
          onClick={onDefaultSelect}
          type="button"
        >
          기본 설정
        </button>
      ) : null}
      value={item.limitLabel}
    />
  );
}

function SettingsPlaceholder({ title }) {
  return (
    <div className="settings-placeholder">
      <h2>{title}</h2>
      <p>이 설정 영역은 아직 연결되지 않았습니다.</p>
    </div>
  );
}

export function SenderResourceApplicationPage({ type }) {
  const router = useRouter();
  const isSms = type === 'sms';

  function goBackToSenderResources() {
    router.push(`/settings?tab=${SETTINGS_SENDER_RESOURCE_QUERY}&type=${type}`);
  }

  if (isSms) {
    return <SmsSenderResourceApplicationPage onBack={goBackToSenderResources} />;
  }

  return <KakaoChannelConnectPage onBack={goBackToSenderResources} />;
}

function SmsSenderResourceApplicationPage({ onBack }) {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const resubmitApplicationId = searchParams.get('applicationId');
  const smsSenderApplicationMutation = useSmsSenderApplicationMutation();
  const senderResourcesQuery = useSenderResourcesQuery();
  const resubmitApplication = useMemo(() => {
    const applications = Array.isArray(senderResourcesQuery.data?.applications)
      ? senderResourcesQuery.data.applications
      : [];

    return applications.find((application) => (
      application.id === resubmitApplicationId
      && application.resourceType === SMS_SENDER_RESOURCE_TYPE
      && application.status === 'rejected'
    )) ?? null;
  }, [resubmitApplicationId, senderResourcesQuery.data]);

  if (resubmitApplicationId && senderResourcesQuery.isPending) {
    return (
      <section className="page-frame settings-page sender-resource-application-page">
        <PageHeader title="발신번호 재신청" />
        <button
          className="sender-resource-back-button"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={15} />
          발신 수단 관리
        </button>
        <SectionPanel title="기존 신청을 불러오는 중입니다">
          <span className="admin-state-row">
            <Circle aria-hidden="true" size={18} />
            반려된 신청과 제출 서류를 확인하고 있습니다.
          </span>
        </SectionPanel>
      </section>
    );
  }

  if (resubmitApplicationId && !resubmitApplication) {
    return (
      <section className="page-frame settings-page sender-resource-application-page">
        <PageHeader title="발신번호 재신청" />
        <button
          className="sender-resource-back-button"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={15} />
          발신 수단 관리
        </button>
        <SectionPanel
          description="반려된 신청을 찾을 수 없거나 이미 재신청/승인 처리되었습니다."
          footer={<Button onClick={onBack} variant="secondary">돌아가기</Button>}
          title="재신청할 수 없습니다"
        />
      </section>
    );
  }

  async function handleSmsSenderApplicationSubmit(payload) {
    const isResubmission = Boolean(payload.applicationId);
    const senderNumberType = payload.senderNumberType;

    smsSenderApplicationMutation.reset();

    try {
      await smsSenderApplicationMutation.mutateAsync(buildSenderNumberApplicationFormData({
        additionalEvidenceFiles: payload.additionalEvidenceFiles,
        applicationId: payload.applicationId,
        documents: getSmsSenderApplicationEvidenceDocuments(senderNumberType),
        evidenceFiles: payload.evidenceFiles,
        sendNo: payload.sendNo,
        senderNumberType,
      }));
      showToast({
        description: `${formatSettingsPhoneNumber(payload.sendNo)} · ${getSenderNumberTypeLabel(senderNumberType)}`,
        title: isResubmission ? '발신번호 재신청 완료' : '발신번호 신청 완료',
      });
    } catch (error) {
      throw new Error(getRelayErrorMessage(
        error,
        isResubmission ? '발신번호 재신청을 제출하지 못했습니다.' : '발신번호 신청을 제출하지 못했습니다.'
      ));
    }
  }

  return (
    <SmsSenderNumberAdd
      key={resubmitApplication?.id ?? 'new-application'}
      onBack={onBack}
      onSubmit={handleSmsSenderApplicationSubmit}
      duplicateCheckPending={senderResourcesQuery.isPending}
      resubmitApplication={resubmitApplication}
      senderResourcesData={senderResourcesQuery.data}
      submitPending={smsSenderApplicationMutation.isPending}
    />
  );
}

function buildSenderNumberApplicationFormData({
  additionalEvidenceFiles = [],
  applicationId,
  documents,
  evidenceFiles,
  senderNumberType,
  sendNo,
}) {
  const formData = new FormData();
  const evidenceDescriptors = [];

  formData.append('payload', JSON.stringify({
    ...(applicationId ? { applicationId } : {}),
    evidenceFiles: evidenceDescriptors,
    senderNumberType,
    sendNo,
  }));

  documents.forEach((document) => {
    const evidence = evidenceFiles[document.id];

    if (evidence?.file) {
      evidenceDescriptors.push({ documentType: document.id });
      formData.append(document.id, evidence.file, evidence.name);
    }
  });

  additionalEvidenceFiles.forEach((evidence) => {
    if (evidence?.file) {
      evidenceDescriptors.push({ documentType: ADDITIONAL_SENDER_EVIDENCE_FILE.id });
      formData.append(ADDITIONAL_SENDER_EVIDENCE_FILE.id, evidence.file, evidence.name);
    }
  });

  formData.set('payload', JSON.stringify({
    ...(applicationId ? { applicationId } : {}),
    evidenceFiles: evidenceDescriptors,
    senderNumberType,
    sendNo,
  }));

  return formData;
}

function getSmsSenderApplicationEvidenceDocuments(senderNumberType) {
  return senderNumberType === 'personal'
    ? PERSONAL_SENDER_EVIDENCE_FILES
    : COMPANY_SENDER_EVIDENCE_FILES;
}
