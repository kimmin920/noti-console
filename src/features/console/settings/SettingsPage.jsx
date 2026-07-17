'use client';

import { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, Circle } from 'lucide-react';
import { PageHeader } from '../../../components/layout/index.js';
import { SmsSenderNumberAdd } from '../../../components/sender-resources/index.js';
import { Button, SegmentedControl, SectionPanel, useToast } from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import { formatSettingsPhoneNumber } from '../senderResourceLabels.js';
import { useSmsSenderApplicationMutation } from '../messageSend/mutations.js';
import { useSenderResourcesQuery } from '../messageSend/queries.js';
import { KakaoChannelConnectPage } from '../KakaoChannelConnectPage.jsx';
import { buildTabQueryHref, getSettingsTabFromQuery, getSettingsTabQueryValue } from '../tabQuery.js';
import { ProfileSettingsContent } from './ProfileSettingsContent.jsx';
import { SenderResourceSettingsContent } from './UsageSettingsContent.jsx';

import {
  ADDITIONAL_SENDER_EVIDENCE_FILE,
  COMPANY_SENDER_EVIDENCE_FILES,
  PERSONAL_SENDER_EVIDENCE_FILES,
  SMS_SENDER_RESOURCE_TYPE,
} from './senderResourceApplicationConfig.js';
import { useConsoleNavigation } from '../ConsoleNavigationContext.jsx';

const SETTINGS_TABS = ['발신 수단 관리', '청구', '연동', '프로필'];
const SETTINGS_SENDER_RESOURCE_TAB = '발신 수단 관리';
const SETTINGS_SENDER_RESOURCE_QUERY = 'sender-resources';

function getVisibleSettingsTabs(isPublEmbed) {
  return isPublEmbed ? SETTINGS_TABS.filter((tab) => tab !== '프로필') : SETTINGS_TABS;
}
export function SettingsPage() {
  const navigation = useConsoleNavigation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPublEmbed = navigation.mode === 'embed';
  const visibleSettingsTabs = getVisibleSettingsTabs(isPublEmbed);
  const [activeTab, setActiveTab] = useState(() => getSettingsTabFromQuery(searchParams, visibleSettingsTabs));

  function handleActiveTabChange(nextTab) {
    setActiveTab(nextTab);
    navigation.replace(
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
        items={visibleSettingsTabs}
        onValueChange={handleActiveTabChange}
        value={activeTab}
      />
      {activeTab === SETTINGS_SENDER_RESOURCE_TAB ? <SenderResourceSettingsContent /> : null}
      {activeTab === '프로필' && !isPublEmbed ? <ProfileSettingsContent /> : null}
      {activeTab !== SETTINGS_SENDER_RESOURCE_TAB && (activeTab !== '프로필' || isPublEmbed) ? (
        <SettingsPlaceholder title={activeTab} />
      ) : null}
    </section>
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
  const navigation = useConsoleNavigation();
  const isSms = type === 'sms';

  function goBackToSenderResources() {
    navigation.push(`/settings?tab=${SETTINGS_SENDER_RESOURCE_QUERY}&type=${type}`);
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
        privacyConsentAccepted: payload.privacyConsentAccepted,
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
  privacyConsentAccepted,
  senderNumberType,
  sendNo,
}) {
  const formData = new FormData();
  const evidenceDescriptors = [];

  formData.append('payload', JSON.stringify({
    ...(applicationId ? { applicationId } : {}),
    evidenceFiles: evidenceDescriptors,
    privacyConsentAccepted,
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
    privacyConsentAccepted,
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
