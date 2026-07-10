'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Show, SignOutButton, UserButton, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Circle,
  Copy,
  Download,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { CodeGroup, DocsCallout, DocsCard, DocsCardGrid, DocsSection } from '../../components/docs/index.js';
import { ApiCodeDrawer, PageHeader, Toolbar } from '../../components/layout/index.js';
import { SmsSenderNumberAdd } from '../../components/sender-resources/index.js';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  ActionMenu,
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionMenuTrigger,
  AlimtalkPreview,
  AlimtalkSendForm,
  Badge,
  BrandMessageSendForm,
  Button,
  ConfirmationDialog,
  DataTableV2,
  DatePickerPresets,
  defaultAlimtalkSendFormValue,
  defaultBrandMessageSendFormValue,
  defaultSmsSendFormValue,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  EmptyState,
  FilterSelect,
  FormField,
  getSmsSendFormMessageType,
  getBrandMessageTemplateRegistrationIssues,
  getBrandMessageValidationIssues,
  IconButton,
  NhnBrandMessagePreview,
  Panel,
  SearchField,
  SegmentedControl,
  PropertyRow,
  SectionPanel,
  SplitSection,
  SmsPreview,
  SmsSendForm,
  Tooltip,
  useToast,
} from '../../components/ui/index.js';
import { getRelayErrorMessage } from './messageSend/api.js';
import {
  DEV_SMS_BULK_SIMULATION_SENDER_ID,
  DEV_SMS_BULK_SIMULATION_SENDER_OPTION,
  getDevSmsBulkSimulationConfig,
  getSmsBulkSimulationPayloadMessage,
  toSmsBulkSimulationRunPayload,
} from './messageSend/bulkSimulation.js';
import {
  getAlimtalkSenderProfiles,
  getResolvedSenderOptionValue,
  getSmsSenderOptions,
  getTemplateOptions,
} from './messageSend/mappers.js';
import { formatSettingsPhoneNumber } from './senderResourceLabels.js';
import { getSettingsSenderResourceRows } from './senderResourceSettingsRows.js';
import {
  useAdminSenderResourceApplicationApproveMutation,
  useAdminSenderResourceApplicationRejectMutation,
  useAdminSmsSendNoLookupMutation,
  useAlimtalkSendMutation,
  useBrandImageUploadMutation,
  useBrandMessageSendMutation,
  useBrandTemplateCreateMutation,
  useSmsBulkSendRunMutation,
  useSmsSenderApplicationMutation,
  useSmsSendMutation,
} from './messageSend/mutations.js';
import {
  applyBrandImageUploadResult,
  buildAlimtalkSendPayload,
  buildBrandImageUploadFormData,
  buildBrandMessageSendPayload,
  buildBrandTemplateRegistrationPayload,
  buildSmsSendPayload,
  getBrandImageUploadTargets,
  MessageSendValidationError,
} from './messageSend/payloads.js';
import {
  useAdminSenderResourceApplicationsQuery,
  useAlimtalkTemplatesQuery,
  useBrandTemplatesQuery,
  useCurrentActorQuery,
  useSenderResourcesQuery,
  useActiveSmsBulkSendRunsQuery,
  useSmsTemplatesQuery,
} from './messageSend/queries.js';
import {
  useAutomationRuleArchiveMutation,
  useAutomationRuleDisableMutation,
  useAutomationRuleEnableMutation,
  useAutomationRulesQuery,
  useAutomationUnsentDeliveriesQuery,
  useAutomationUnsentDismissMutation,
  useAutomationUnsentResendMutation,
} from './automations/queries.js';
import {
  MESSAGE_STATUS_TOAST_ID,
  showMessageReservationAcceptedToast,
  showMessageStatusResultToast,
  showMessageStatusSubmitToast,
} from './messageSend/statusToast.js';
import { getBrandImageUploadFailureMessage } from './messageSend/uploadErrors.js';
import {
  getReservationsHrefForChannel,
  shouldShowSmsReservationAcceptedToast,
} from './messageSend/reservationRouting.js';
import { getSmsBulkSendRunToastView } from './messageSend/smsBulkSendRunToast.js';
import { KakaoChannelConnectPage } from './KakaoChannelConnectPage.jsx';
import { AutomationRuleDetailPage } from './automations/AutomationRuleDetailPage.jsx';
import { AutomationRuleEditorPage } from './automations/AutomationRuleEditorPage.jsx';
import { useMessageLogsExportMutation } from './messageLogs/mutations.js';
import { useMessageLogGroupsQuery } from './messageLogs/queries.js';
import { messageLogQueryKeys } from './messageLogs/queryKeys.js';
import { MessageLogGroupDetailPage } from './messageLogs/MessageLogGroupDetailPage.jsx';
import { MessageReservationsPage } from './messageReservations/MessageReservationsPage.jsx';
import { MessageReservationDetailPage } from './messageReservations/MessageReservationDetailPage.jsx';
import { MetricsPage } from './metrics/MetricsPage.jsx';
import { usePublEventsQuery } from './publEvents/queries.js';
import { PublEventCreatePage } from './publEvents/PublEventCreatePage.jsx';
import { PublEventDetailPage } from './publEvents/PublEventDetailPage.jsx';
import { usePublMessageRecipients } from '../publClient/usePublMessageRecipients.js';
import { usePublClient } from '../publClient/PublClientContext.jsx';
import { TemplateDetailPage } from './templates/TemplateDetailPage.jsx';
import { TemplatePage } from './templates/TemplatePage.jsx';
import { BrandTemplateCreatePage } from './templates/BrandTemplateCreatePage.jsx';
import { ConsoleLink, useConsoleNavigation } from './ConsoleNavigationContext.jsx';
import { SmsTemplateCreatePage } from './templates/SmsTemplateCreatePage.jsx';
import {
  formatMessageLogGroupCounts,
  formatMessageLogDate,
  getChannelLabel,
  getDefaultMessageLogRange,
  getMessageLogGroupPageTotal,
  getMessageLogGroupDisplayPreview,
  getMessageLogGroupKindLabel,
  getMessageLogGroupResultSummary,
  getMessageLogGroupSentAt,
  getMessageLogGroupRowId,
  getMessageLogGroupSourceLabel,
  getMessageLogGroupStatus,
  getMessageLogFiltersFromSearchParams,
  MESSAGE_LOG_CHANNEL_OPTIONS,
  SMS_MESSAGE_TYPE_OPTIONS,
  toMessageLogQueryParams,
  toMessageLogUrlParams,
} from './messageLogs/selectors.js';
import { DEFAULT_CONSOLE_PAGE_ID } from './routing.js';
import {
  buildTabQueryHref,
  getMessageSendTabFromQuery,
  getMessageSendTabQueryValue,
  getSettingsTabFromQuery,
  getSettingsTabQueryValue,
} from './tabQuery.js';
import { AlimtalkTemplateCreatePageNewDesign as AlimtalkTemplateCreatePage } from './alimtalkTemplates/AlimtalkTemplateCreatePageNewDesign.jsx';
import { AdminLimitIncreaseRequestsPanel } from './settings/AdminLimitIncreaseRequestsPanel.jsx';
import { AdminRequestTabs, ADMIN_REQUEST_TAB_VALUES } from './settings/AdminRequestTabs.jsx';
import { UsageSettingsContent } from './settings/UsageSettingsContent.jsx';

const BRAND_TEMPLATE_REGISTRATION_NAME_MAX_LENGTH = 200;

function getStatusTone(cell) {
  if (['활성', '성공'].includes(cell)) {
    return 'green';
  }

  if (['초안', '대기', '없음'].includes(cell)) {
    return 'neutral';
  }

  return undefined;
}

export function ConsolePages({ activePage, meta, onDocs, pageProps }) {
  const publClient = usePublClient();
  let page = <ConsolePage key={activePage} meta={meta} onDocs={onDocs} />;
  const automationDetail = pageProps?.automationDetail;
  const templateDetail = pageProps?.templateDetail;
  const publEventDetail = pageProps?.publEventDetail;
  const reservationDetail = pageProps?.reservationDetail;
  const logDetail = pageProps?.logDetail;

  if (activePage === DEFAULT_CONSOLE_PAGE_ID) {
    page = <MessageSendPage meta={meta} onDocs={onDocs} />;
  } else if (activePage === 'audience' && publClient.isPublEmbed) {
    page = <PublAudiencePage />;
  } else if (activePage === 'settings') {
    page = <SettingsPage />;
  } else if (activePage === 'settings-sender-sms-new') {
    page = <SenderResourceApplicationPage type="sms" />;
  } else if (activePage === 'settings-sender-kakao-new') {
    page = <SenderResourceApplicationPage type="kakao" />;
  } else if (activePage === 'automations-new') {
    page = <AutomationRuleEditorPage mode="create" />;
  } else if (activePage === 'automations-detail' && automationDetail) {
    page = <AutomationRuleDetailPage ruleId={automationDetail.ruleId} />;
  } else if (activePage === 'automations-edit' && automationDetail) {
    page = <AutomationRuleEditorPage mode="edit" ruleId={automationDetail.ruleId} />;
  } else if (activePage === 'publ-event-detail' && publEventDetail) {
    page = <PublEventDetailPage eventKey={publEventDetail.eventKey} />;
  } else if (activePage === 'publ-event-new') {
    page = <PublEventCreatePage />;
  } else if (activePage === 'templates-sms-new') {
    page = <SmsTemplateCreatePage />;
  } else if (activePage === 'templates-alimtalk-new') {
    page = <AlimtalkTemplateCreatePage />;
  } else if (activePage === 'templates-brand-new') {
    page = <BrandTemplateCreatePage />;
  } else if (activePage === 'admin' || activePage === 'admin-sender-resource-applications') {
    page = <AdminSenderResourceApplicationsPage />;
  } else if (activePage === 'docs') {
    page = <DocsPage meta={meta} />;
  } else if (activePage === 'metrics') {
    page = <MetricsPage meta={meta} />;
  } else if (activePage === 'reservations') {
    page = <MessageReservationsPage />;
  } else if (activePage === 'reservation-detail' && reservationDetail) {
    page = <MessageReservationDetailPage groupId={reservationDetail.groupId} />;
  } else if (activePage === 'logs') {
    page = <MessageLogsPage />;
  } else if (activePage === 'log-detail' && logDetail) {
    page = <MessageLogGroupDetailPage groupId={logDetail.groupId} />;
  } else if (activePage === 'templates') {
    page = <TemplatePage meta={meta} />;
  } else if (activePage === 'templates-detail' && templateDetail) {
    page = (
      <TemplateDetailPage
        channel={templateDetail.channel}
        query={templateDetail.query}
        templateCode={templateDetail.templateCode}
      />
    );
  }

  return (
    <>
      <SmsBulkSendRunWatcher />
      {page}
    </>
  );
}

function PublAudiencePage() {
  const [activeTab, setActiveTab] = useState('contacts');
  const [searchValue, setSearchValue] = useState('');
  const publRecipients = usePublMessageRecipients();
  const contactsSourceState = publRecipients.contactsSourceState;
  const normalizedSearch = searchValue.trim().toLocaleLowerCase('ko-KR');
  const rows = publRecipients.contacts.filter((contact) => (
    !normalizedSearch
    || [contact.label, contact.detail, contact.externalId]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('ko-KR')
      .includes(normalizedSearch)
  ));

  return (
    <section className="page-frame publ-audience-page">
      <PageHeader title="수신자" />
      <SegmentedControl
        items={[
          { label: 'Publ 수신자', value: 'contacts' },
          { label: 'Publ 세그먼트', value: 'segments' },
        ]}
        onValueChange={setActiveTab}
        value={activeTab}
      />

      {activeTab === 'contacts' ? (
        <>
          <div className="publ-audience-toolbar">
            <SearchField
              aria-label="Publ 수신자 검색"
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="이름, 전화번호, Publ ID 검색"
              value={searchValue}
            />
          </div>
          <DataTableV2
            columns={[
              { accessor: 'label', header: '수신자' },
              {
                accessor: 'value',
                cell: ({ value }) => <code>{value}</code>,
                header: '휴대폰',
              },
              {
                accessor: (row) => row.externalId || '-',
                cell: ({ value }) => <code>{value}</code>,
                header: 'Publ ID',
              },
            ]}
            data={rows}
            empty={(
              <span className="admin-empty-row">
                {getPublAudienceEmptyMessage(contactsSourceState, normalizedSearch)}
              </span>
            )}
            getRowId={(row) => row.externalId || row.value}
            loading={contactsSourceState === 'loading'}
            loadingSlot={<span className="admin-state-row">Publ 수신자를 불러오는 중입니다.</span>}
            pagination
            tableClassName="console-data-table-v2 publ-audience-data-table"
          />
        </>
      ) : (
        <EmptyState
          copy="Publ 세그먼트 SDK 권한이 추가되면 이 화면에서 조회하고 발송 대상으로 선택할 수 있습니다."
          icon={Sparkles}
          title="Publ 세그먼트 연동 준비 중"
        />
      )}
    </section>
  );
}

function getPublAudienceEmptyMessage(state, searchValue) {
  if (state === 'permission-denied') return 'Publ 수신자 조회 권한이 없습니다';
  if (state === 'error') return 'Publ 수신자를 불러오지 못했습니다.';
  if (searchValue) return '검색 조건에 맞는 Publ 수신자가 없습니다.';
  return '전화번호가 등록된 Publ 수신자가 없습니다.';
}

function SmsBulkSendRunWatcher() {
  const navigation = useConsoleNavigation();
  const { showToast } = useToast();
  const statusPollingRunRef = useRef(0);
  const toastRef = useRef(null);
  const activeSmsBulkRunsQuery = useActiveSmsBulkSendRunsQuery();
  const activeSmsBulkRun = useMemo(
    () => getVisibleSmsBulkSendRun(activeSmsBulkRunsQuery.data),
    [activeSmsBulkRunsQuery.data]
  );

  useEffect(() => {
    showSmsBulkSendRunToast({
      navigation,
      run: activeSmsBulkRun,
      showToast,
      statusPollingRunRef,
      toastRef,
    });
  }, [activeSmsBulkRun, navigation, showToast]);

  return null;
}

function MessageSendPage({ meta, onDocs }) {
  const router = useRouter();
  const navigation = useConsoleNavigation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamText = searchParams.toString();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const publRecipients = usePublMessageRecipients();
  const [activeTab, setActiveTab] = useState(() => getMessageSendTabFromQuery(searchParams, meta.tabs));
  const [alimtalkMessage, setAlimtalkMessage] = useState(() => ({
    ...defaultAlimtalkSendFormValue,
    fallbackSenderNumber: '',
    recipient: [],
    senderProfileId: '',
    templateId: '',
  }));
  const [brandMessage, setBrandMessage] = useState(defaultBrandMessageSendFormValue);
  const [brandCarouselPreviewTarget, setBrandCarouselPreviewTarget] = useState(null);
  const [brandTemplateRegistrationOpen, setBrandTemplateRegistrationOpen] = useState(false);
  const [brandTemplateRegistrationName, setBrandTemplateRegistrationName] = useState('');
  const [brandTemplateRegistrationNameError, setBrandTemplateRegistrationNameError] = useState('');
  const [smsMessage, setSmsMessage] = useState(() => ({
    ...defaultSmsSendFormValue,
    recipient: [],
    senderNumber: '',
    unsubscribeNumber: '',
  }));
  const [variablePanelRoot, setVariablePanelRoot] = useState(null);
  const brandFormRef = useRef(null);
  const statusPollingRunRef = useRef(0);
  const opensDocs = meta.emptyButton === '문서 보기';
  const isMessageComposer = activeTab === 'SMS' || activeTab === '알림톡' || activeTab === '브랜드 메시지';
  const alimtalkSendMutation = useAlimtalkSendMutation();
  const brandImageUploadMutation = useBrandImageUploadMutation();
  const brandMessageSendMutation = useBrandMessageSendMutation();
  const brandTemplateCreateMutation = useBrandTemplateCreateMutation();
  const smsBulkSendRunMutation = useSmsBulkSendRunMutation();
  const smsSendMutation = useSmsSendMutation();
  const senderResourcesQuery = useSenderResourcesQuery();
  const smsBulkSimulationConfig = useMemo(
    () => getDevSmsBulkSimulationConfig(new URLSearchParams(searchParamText)),
    [searchParamText]
  );
  const smsSenderOptions = useMemo(
    () => getSmsSenderOptions(senderResourcesQuery.data),
    [senderResourcesQuery.data]
  );
  const smsSenderOptionsForForm = useMemo(() => (
    smsBulkSimulationConfig && smsSenderOptions.length === 0
      ? [DEV_SMS_BULK_SIMULATION_SENDER_OPTION]
      : smsSenderOptions
  ), [smsBulkSimulationConfig, smsSenderOptions]);
  const alimtalkSenderProfiles = useMemo(
    () => getAlimtalkSenderProfiles(senderResourcesQuery.data),
    [senderResourcesQuery.data]
  );
  const smsFormValue = useMemo(() => ({
    ...smsMessage,
    senderNumber: smsMessage.senderNumber || smsSenderOptionsForForm[0]?.value || '',
  }), [smsMessage, smsSenderOptionsForForm]);
  const smsTemplateSenderResourceId = smsFormValue.senderNumber === DEV_SMS_BULK_SIMULATION_SENDER_ID
    ? ''
    : smsFormValue.senderNumber;
  const smsTemplatesQuery = useSmsTemplatesQuery(smsTemplateSenderResourceId);
  const smsTemplates = useMemo(
    () => getTemplateOptions(smsTemplatesQuery.data),
    [smsTemplatesQuery.data]
  );
  const messageSendTypeStatus = activeTab === 'SMS'
    ? getSmsSendFormMessageType(smsFormValue)
    : '';
  const isSmsBulkSimulationMode = activeTab === 'SMS' && Boolean(smsBulkSimulationConfig);
  const activeSmsBulkRunsQuery = useActiveSmsBulkSendRunsQuery({
    enabled: activeTab === 'SMS',
  });
  const activeSmsBulkRun = useMemo(
    () => getVisibleSmsBulkSendRun(activeSmsBulkRunsQuery.data),
    [activeSmsBulkRunsQuery.data]
  );
  const alimtalkSenderProfileId = getResolvedSenderOptionValue(alimtalkMessage.senderProfileId, alimtalkSenderProfiles);
  const alimtalkTemplatesQuery = useAlimtalkTemplatesQuery(alimtalkSenderProfileId);
  const alimtalkTemplates = useMemo(
    () => getTemplateOptions(alimtalkTemplatesQuery.data),
    [alimtalkTemplatesQuery.data]
  );
  const alimtalkFormValue = useMemo(() => ({
    ...alimtalkMessage,
    fallbackSenderNumber: alimtalkMessage.fallbackSenderNumber || smsSenderOptions[0]?.value || '',
    senderProfileId: alimtalkSenderProfileId,
    templateId: alimtalkMessage.templateId || alimtalkTemplates[0]?.value || '',
  }), [alimtalkMessage, alimtalkSenderProfileId, alimtalkTemplates, smsSenderOptions]);
  const brandSenderProfileId = getResolvedSenderOptionValue(brandMessage.senderProfileId, alimtalkSenderProfiles);
  const brandTemplatesQuery = useBrandTemplatesQuery(brandSenderProfileId);
  const brandTemplates = useMemo(
    () => getTemplateOptions(brandTemplatesQuery.data),
    [brandTemplatesQuery.data]
  );
  const brandFormValue = useMemo(() => ({
    ...brandMessage,
    fallbackSenderNumber: brandMessage.fallbackSenderNumber || smsSenderOptions[0]?.value || '',
    senderProfileId: brandSenderProfileId,
  }), [brandMessage, brandSenderProfileId, smsSenderOptions]);

  useEffect(() => () => {
    statusPollingRunRef.current += 1;
  }, []);

  function handleActiveTabChange(nextTab) {
    setActiveTab(nextTab);
    router.replace(
      buildTabQueryHref({
        pathname,
        searchParams,
        tabQueryValue: getMessageSendTabQueryValue(nextTab),
      }),
      { scroll: false }
    );
  }

  function getRecipientSummary(value) {
    if (Array.isArray(value)) {
      if (!value.length) {
        return '';
      }

      const allRecipient = value.find((item) => item?.value === 'all');
      if (allRecipient) {
        return allRecipient.label || '전체 연락처';
      }

      return `${value.length}명`;
    }

    if (value && typeof value === 'object') {
      return value.label ?? value.value ?? '';
    }

    return value === 'all' ? '전체 연락처' : value;
  }

  function getActiveRecipientSummary() {
    if (activeTab === '알림톡') {
      return getRecipientSummary(alimtalkMessage.recipient);
    }

    if (activeTab === '브랜드 메시지') {
      return getRecipientSummary(brandMessage.recipient);
    }

    return getRecipientSummary(smsMessage.recipient);
  }

  function saveMessageDraft() {
    showToast({
      description: `현재 입력한 ${activeTab} 내용이 초안으로 저장되었습니다.`,
      title: '임시저장 완료',
      variant: 'success',
    });
  }

  function openBrandTemplateRegistrationDialog() {
    setBrandTemplateRegistrationNameError('');
    setBrandTemplateRegistrationOpen(true);
  }

  function closeBrandTemplateRegistrationDialog() {
    setBrandTemplateRegistrationOpen(false);
    setBrandTemplateRegistrationName('');
    setBrandTemplateRegistrationNameError('');
  }

  function handleBrandTemplateRegistrationOpenChange(nextOpen) {
    if (!nextOpen && (brandImageUploadMutation.isPending || brandTemplateCreateMutation.isPending)) {
      return;
    }

    if (nextOpen) {
      setBrandTemplateRegistrationOpen(true);
      return;
    }

    closeBrandTemplateRegistrationDialog();
  }

  function handleBrandTemplateRegistrationNameChange(event) {
    const nextName = event.target.value;

    setBrandTemplateRegistrationName(nextName);

    if (brandTemplateRegistrationNameError) {
      setBrandTemplateRegistrationNameError(getBrandTemplateRegistrationNameIssue(nextName));
    }
  }

  async function registerBrandTemplate(event) {
    event.preventDefault();

    if (brandMessageSendMutation.isPending || brandImageUploadMutation.isPending || brandTemplateCreateMutation.isPending) {
      return;
    }

    const nameIssue = getBrandTemplateRegistrationNameIssue(brandTemplateRegistrationName);

    if (nameIssue) {
      setBrandTemplateRegistrationNameError(nameIssue);
      return;
    }

    const issues = getBrandMessageTemplateRegistrationIssues(brandFormValue);

    if (issues.length) {
      showSendErrorToast(
        showToast,
        new MessageSendValidationError(issues[0].message, {
          code: 'BRAND_TEMPLATE_REGISTRATION_INVALID',
          title: '템플릿 등록 설정 필요',
        }),
        '템플릿 등록 실패'
      );
      return;
    }

    try {
      const nextBrandMessage = await uploadBrandImagesIfNeeded(brandFormValue);
      const payload = buildBrandTemplateRegistrationPayload(nextBrandMessage, {
        templateName: brandTemplateRegistrationName,
      });
      const result = await brandTemplateCreateMutation.mutateAsync(payload);

      if (nextBrandMessage !== brandFormValue) {
        setBrandMessage(nextBrandMessage);
      }

      showToast({
        description: getBrandTemplateRegistrationSuccessDescription(result),
        title: '템플릿 등록 완료',
        variant: 'success',
      });
      closeBrandTemplateRegistrationDialog();
    } catch (error) {
      if (error instanceof MessageSendValidationError && isBrandTemplateRegistrationNameError(error)) {
        setBrandTemplateRegistrationNameError(error.message);
      }

      showSendErrorToast(showToast, error, '템플릿 등록 실패');
    }
  }

  function openAudiencePage() {
    navigation.push('/audience');
  }

  function openSenderResourcePage(type) {
    if (type === 'sms') {
      navigation.push('/settings/sender-resources/sms/new');
      return;
    }

    if (type === 'kakao') {
      navigation.push('/settings/sender-resources/kakao/new');
      return;
    }

    navigation.push('/settings?tab=sender-resources');
  }

  function beginStatusPollingRun(channelLabel) {
    statusPollingRunRef.current += 1;
    showMessageStatusSubmitToast(showToast, channelLabel);
    return statusPollingRunRef.current;
  }

  function isCurrentStatusPollingRun(runId) {
    return statusPollingRunRef.current === runId;
  }

  function refreshMessageLogQueriesAfterStatusFound() {
    queryClient.invalidateQueries({ queryKey: messageLogQueryKeys.groupListRoot });
    queryClient.invalidateQueries({ queryKey: messageLogQueryKeys.groupDetailRoot });
    queryClient.invalidateQueries({ queryKey: messageLogQueryKeys.groupRequestRecipientsRoot });
    queryClient.invalidateQueries({ queryKey: messageLogQueryKeys.groupRequestFailuresRoot });
    queryClient.invalidateQueries({ queryKey: messageLogQueryKeys.groupRequestRecipientDetailRoot });
    queryClient.invalidateQueries({ queryKey: messageLogQueryKeys.listRoot });
    queryClient.invalidateQueries({ queryKey: messageLogQueryKeys.detailRoot });
  }

  async function sendMessage() {
    if (activeTab === 'SMS') {
      if (smsSendMutation.isPending || isActiveSmsBulkSendRun(activeSmsBulkRun)) {
        return;
      }

      let statusPollingRunId = null;

      try {
        const payloadMessage = smsBulkSimulationConfig
          ? getSmsBulkSimulationPayloadMessage(smsFormValue)
          : smsFormValue;
        const payload = buildSmsSendPayload(payloadMessage, { templates: smsTemplates });

        if (smsBulkSimulationConfig) {
          statusPollingRunId = beginStatusPollingRun('SMS');
          await smsBulkSendRunMutation.mutateAsync(toSmsBulkSimulationRunPayload(payload, smsBulkSimulationConfig));
          return;
        }

        if (isSmsBulkSendRunPayload(payload)) {
          statusPollingRunId = beginStatusPollingRun('SMS');
          await smsBulkSendRunMutation.mutateAsync(toSmsBulkSendRunPayload(payload));
          return;
        }

        statusPollingRunId = beginStatusPollingRun('SMS');
        const result = await smsSendMutation.mutateAsync(payload);

        if (shouldShowSmsReservationAcceptedToast(payload, result)) {
          showMessageReservationAcceptedToast({
            channelLabel: 'SMS',
            onViewReservations: () => navigation.push(getReservationsHrefForChannel(payload.channel)),
            result,
            showToast,
          });
          return;
        }

        showMessageStatusResultToast({
          channelLabel: 'SMS',
          isCurrent: () => isCurrentStatusPollingRun(statusPollingRunId),
          lookup: result.lookup,
          onFound: refreshMessageLogQueriesAfterStatusFound,
          result,
          showToast,
        });
      } catch (error) {
        if (statusPollingRunId) {
          statusPollingRunRef.current += 1;
        }

        showSendErrorToast(showToast, error, 'SMS 발송 실패', {
          id: statusPollingRunId ? MESSAGE_STATUS_TOAST_ID : undefined,
        });
      }

      return;
    }

    if (activeTab === '알림톡') {
      if (alimtalkSendMutation.isPending) {
        return;
      }

      let statusPollingRunId = null;

      try {
        const payload = buildAlimtalkSendPayload(alimtalkFormValue, { templates: alimtalkTemplates });
        statusPollingRunId = beginStatusPollingRun('알림톡');
        const result = await alimtalkSendMutation.mutateAsync(payload);

        showMessageStatusResultToast({
          channelLabel: '알림톡',
          isCurrent: () => isCurrentStatusPollingRun(statusPollingRunId),
          lookup: result.lookup,
          onFound: refreshMessageLogQueriesAfterStatusFound,
          result,
          showToast,
        });
      } catch (error) {
        if (statusPollingRunId) {
          statusPollingRunRef.current += 1;
        }

        showSendErrorToast(showToast, error, '알림톡 발송 실패', {
          id: statusPollingRunId ? MESSAGE_STATUS_TOAST_ID : undefined,
        });
      }

      return;
    }

    if (activeTab === '브랜드 메시지') {
      if (brandMessageSendMutation.isPending || brandImageUploadMutation.isPending || brandTemplateCreateMutation.isPending) {
        return;
      }

      const issues = getBrandMessageValidationIssues(brandFormValue);

      if (issues.length) {
        brandFormRef.current?.revealValidation();
        showToast({
          description: issues[0].message,
          title: '브랜드 메시지 설정 필요',
        });
        return;
      }

      let statusPollingRunId = null;

      try {
        const nextBrandMessage = await uploadBrandImagesIfNeeded(brandFormValue);
        const payload = buildBrandMessageSendPayload(nextBrandMessage, { templates: brandTemplates });

        if (nextBrandMessage !== brandFormValue) {
          setBrandMessage(nextBrandMessage);
        }

        statusPollingRunId = beginStatusPollingRun('브랜드 메시지');
        const result = await brandMessageSendMutation.mutateAsync(payload);

        showMessageStatusResultToast({
          channelLabel: '브랜드 메시지',
          isCurrent: () => isCurrentStatusPollingRun(statusPollingRunId),
          lookup: result.lookup,
          onFound: refreshMessageLogQueriesAfterStatusFound,
          result,
          showToast,
        });
      } catch (error) {
        if (statusPollingRunId) {
          statusPollingRunRef.current += 1;
        }

        showSendErrorToast(showToast, error, '브랜드 메시지 발송 실패', {
          id: statusPollingRunId ? MESSAGE_STATUS_TOAST_ID : undefined,
        });
      }
      return;
    }

    const recipientLabel = getActiveRecipientSummary();

    showToast({
      description: `${recipientLabel || '선택한 수신자'} 대상으로 발송 요청을 준비했습니다.`,
      title: `${activeTab} 발송 준비`,
      variant: 'success',
    });
  }

  async function uploadBrandImagesIfNeeded(message) {
    const uploadTargets = getBrandImageUploadTargets(message);
    let nextMessage = message;

    for (const uploadTarget of uploadTargets) {
      let uploadResult;

      try {
        uploadResult = await brandImageUploadMutation.mutateAsync(
          buildBrandImageUploadFormData({
            file: uploadTarget.file,
            imageType: uploadTarget.imageType,
            senderResourceId: message.senderProfileId,
          })
        );
      } catch (error) {
        throw new MessageSendValidationError(
          getBrandImageUploadFailureMessage({ error, target: uploadTarget }),
          { code: 'BRAND_IMAGE_UPLOAD_FAILED', title: '브랜드 이미지 업로드 실패' }
        );
      }

      nextMessage = applyBrandImageUploadResult(nextMessage, uploadTarget, uploadResult);
    }

    return nextMessage;
  }

  const activeSendPending = isActiveSendPending(activeTab, {
    alimtalkSendMutation,
    brandImageUploadMutation,
    brandMessageSendMutation,
    brandTemplateCreateMutation,
    smsBulkSendRunMutation,
    smsSendMutation,
  }) || isActiveSmsBulkSendRun(activeSmsBulkRun);
  const brandTemplateRegistrationPending = brandImageUploadMutation.isPending || brandTemplateCreateMutation.isPending;
  const brandTemplateRegistrationDisabled = brandMessageSendMutation.isPending || brandTemplateRegistrationPending;
  const isBrandTemplateRegistrationOperationPending = activeTab === '브랜드 메시지'
    && brandTemplateRegistrationOpen
    && brandTemplateRegistrationPending;
  const activeActionPendingMessage = isBrandTemplateRegistrationOperationPending
    ? '브랜드 메시지 템플릿을 등록 중입니다. 입력한 내용은 그대로 유지됩니다.'
    : `${activeTab} 발송 요청을 전송 중입니다. 입력한 내용은 그대로 유지됩니다.`;
  const activeSendButtonLabel = isBrandTemplateRegistrationOperationPending
    ? '등록 중...'
    : activeSendPending
      ? '발송 중...'
      : '발송하기';

  return (
    <section className="page-frame">
      <PageHeader title={meta.title} />
      <div className="message-send-tabs-row">
        <SegmentedControl
          items={meta.tabs}
          onValueChange={handleActiveTabChange}
          value={activeTab}
        />
        {isMessageComposer ? (
          <div className="message-send-actions">
            {messageSendTypeStatus ? (
              <span className="message-send-type-status">{messageSendTypeStatus}</span>
            ) : null}
            <Button onClick={saveMessageDraft}>
              임시저장
            </Button>
            {activeTab === '브랜드 메시지' ? (
              <Button
                disabled={brandTemplateRegistrationDisabled}
                onClick={openBrandTemplateRegistrationDialog}
              >
                템플릿으로 등록
              </Button>
            ) : null}
            <Button
              disabled={activeSendPending}
              onClick={sendMessage}
              variant="primary"
            >
              {activeSendButtonLabel}
            </Button>
          </div>
        ) : null}
      </div>
      {activeSendPending ? (
        <div className="message-send-api-status" role="status">
          <span>{activeActionPendingMessage}</span>
        </div>
      ) : null}
      <Dialog
        onOpenChange={handleBrandTemplateRegistrationOpenChange}
        open={brandTemplateRegistrationOpen}
      >
        <DialogContent className="brand-template-registration-dialog" size="small">
          <form onSubmit={registerBrandTemplate}>
            <DialogHeader>
              <DialogTitle>템플릿으로 등록</DialogTitle>
              <DialogDescription>
                현재 프리스타일 브랜드 메시지 초안을 발신 채널 템플릿으로 등록합니다.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <FormField.Root>
                <FormField.Label
                  error={brandTemplateRegistrationNameError}
                  htmlFor="brand-template-registration-name"
                  required
                  requiredLabel="필수"
                >
                  템플릿 이름
                </FormField.Label>
                <FormField.Control>
                  <FormField.Input
                    aria-invalid={brandTemplateRegistrationNameError ? 'true' : undefined}
                    autoComplete="off"
                    disabled={brandTemplateRegistrationPending}
                    id="brand-template-registration-name"
                    onChange={handleBrandTemplateRegistrationNameChange}
                    placeholder="예: 6월 브랜드 안내"
                    value={brandTemplateRegistrationName}
                  />
                  {brandTemplateRegistrationNameError ? (
                    <FormField.Error>{brandTemplateRegistrationNameError}</FormField.Error>
                  ) : (
                    <FormField.Help>등록 후 템플릿 목록이 새로고침됩니다. 초안은 프리스타일 상태로 유지됩니다.</FormField.Help>
                  )}
                  <FormField.Counter
                    current={Array.from(brandTemplateRegistrationName.trim()).length}
                    invalid={Boolean(brandTemplateRegistrationNameError)}
                    max={BRAND_TEMPLATE_REGISTRATION_NAME_MAX_LENGTH}
                  />
                </FormField.Control>
              </FormField.Root>
            </DialogBody>
            <DialogFooter>
              <Button
                disabled={brandTemplateRegistrationPending}
                onClick={closeBrandTemplateRegistrationDialog}
              >
                취소
              </Button>
              <Button
                disabled={brandTemplateRegistrationPending}
                type="submit"
                variant="primary"
              >
                {brandTemplateRegistrationPending ? '등록 중...' : '등록'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {(activeTab === 'SMS' || activeTab === '알림톡' || activeTab === '브랜드 메시지') && !isSmsBulkSimulationMode ? (
        <MessageSendApiStatus
          activeTab={activeTab}
          hasAlimtalkSender={alimtalkSenderProfiles.length > 0}
          hasBrandSender={alimtalkSenderProfiles.length > 0}
          hasSmsSender={smsSenderOptions.length > 0}
          onSenderRetry={senderResourcesQuery.refetch}
          onTemplateRetry={
            activeTab === 'SMS'
              ? smsTemplatesQuery.refetch
              : activeTab === '브랜드 메시지'
                ? brandTemplatesQuery.refetch
                : alimtalkTemplatesQuery.refetch
          }
          senderResourcesQuery={senderResourcesQuery}
          templateQuery={
            activeTab === 'SMS'
              ? smsTemplatesQuery
              : activeTab === '브랜드 메시지'
                ? brandTemplatesQuery
                : alimtalkTemplatesQuery
          }
        />
      ) : null}
      {activeTab === 'SMS' ? (
        <Panel className="message-send-compose-panel message-send-sms-panel" padded={false}>
          <div className="message-send-compose-layout message-send-sms-layout">
            <SmsSendForm
              onChange={setSmsMessage}
              onRecipientCreate={publRecipients.isPublEmbed ? undefined : openAudiencePage}
              onSenderNumberCreate={() => openSenderResourcePage('sms')}
              recipientContacts={publRecipients.contacts}
              recipientCreateLabel={publRecipients.isPublEmbed ? undefined : '수신자 추가하기'}
              recipientSelectProps={publRecipients.selectProps}
              recipients={publRecipients.options}
              senderNumberCreateLabel="발신번호 추가하기"
              senderNumbers={smsSenderOptionsForForm}
              templates={smsTemplates}
              value={smsFormValue}
              variablePanelRoot={variablePanelRoot}
            />
            <SmsPreview senderNumbers={smsSenderOptionsForForm} value={smsFormValue} />
            <div className="message-variable-panel-root" ref={setVariablePanelRoot} />
          </div>
        </Panel>
      ) : activeTab === '알림톡' ? (
        <Panel className="message-send-compose-panel message-send-alimtalk-panel" padded={false}>
          <div className="message-send-compose-layout message-send-alimtalk-layout">
            <AlimtalkSendForm
              fallbackSenderNumbers={smsSenderOptions}
              onChange={setAlimtalkMessage}
              onFallbackSenderNumberCreate={() => openSenderResourcePage('sms')}
              onRecipientCreate={publRecipients.isPublEmbed ? undefined : openAudiencePage}
              onSenderProfileCreate={() => openSenderResourcePage('kakao')}
              recipientContacts={publRecipients.contacts}
              recipientCreateLabel={publRecipients.isPublEmbed ? undefined : '수신자 추가하기'}
              recipientSelectProps={publRecipients.selectProps}
              recipients={publRecipients.options}
              senderProfileCreateLabel="발신채널 추가하기"
              senderProfiles={alimtalkSenderProfiles}
              templates={alimtalkTemplates}
              value={alimtalkFormValue}
              variablePanelRoot={variablePanelRoot}
            />
            <AlimtalkPreview
              senderProfiles={alimtalkSenderProfiles}
              templates={alimtalkTemplates}
              value={alimtalkFormValue}
            />
            <div className="message-variable-panel-root" ref={setVariablePanelRoot} />
          </div>
        </Panel>
      ) : activeTab === '브랜드 메시지' ? (
        <Panel className="message-send-compose-panel message-send-brand-panel" padded={false}>
          <div className="message-send-compose-layout message-send-brand-layout">
            <div className="message-send-brand-form-column">
              <BrandMessageSendForm
                fallbackSenderNumbers={smsSenderOptions}
                onChange={setBrandMessage}
                onCarouselPreviewTargetChange={setBrandCarouselPreviewTarget}
                onFallbackSenderNumberCreate={() => openSenderResourcePage('sms')}
                onSenderProfileCreate={() => openSenderResourcePage('kakao')}
                ref={brandFormRef}
                recipientContacts={publRecipients.contacts}
                recipientSelectProps={publRecipients.selectProps}
                recipients={publRecipients.options}
                senderProfileCreateLabel="발신채널 추가하기"
                senderProfiles={alimtalkSenderProfiles}
                templates={brandTemplates}
                value={brandFormValue}
                variablePanelRoot={variablePanelRoot}
              />
            </div>
            <div className="message-variable-panel-root" ref={setVariablePanelRoot} />
            <div className="message-send-brand-preview-column">
              <NhnBrandMessagePreview
                carouselTarget={brandCarouselPreviewTarget}
                senderProfiles={alimtalkSenderProfiles}
                templates={brandTemplates}
                value={brandFormValue}
              />
            </div>
          </div>
        </Panel>
      ) : (
        <Panel className="message-send-panel" padded={false}>
          <EmptyState
            action={meta.emptyButton}
            copy={meta.emptyCopy}
            icon={Sparkles}
            onAction={opensDocs ? onDocs : undefined}
            title={meta.emptyTitle}
          />
        </Panel>
      )}
    </section>
  );
}

function getBrandTemplateRegistrationNameIssue(value) {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return '템플릿 이름을 입력해 주세요.';
  }

  if (Array.from(normalized).length > BRAND_TEMPLATE_REGISTRATION_NAME_MAX_LENGTH) {
    return `템플릿 이름은 ${BRAND_TEMPLATE_REGISTRATION_NAME_MAX_LENGTH.toLocaleString()}자 이하여야 합니다.`;
  }

  return '';
}

function isBrandTemplateRegistrationNameError(error) {
  return error?.code === 'BRAND_TEMPLATE_NAME_REQUIRED'
    || error?.code === 'BRAND_TEMPLATE_NAME_TOO_LONG';
}

function getBrandTemplateRegistrationSuccessDescription(result) {
  const templateCode = result?.templateCode ?? result?.template?.templateCode;

  return templateCode
    ? `템플릿 코드 ${templateCode}로 등록되었습니다.`
    : '템플릿이 등록되었습니다.';
}

function isActiveSendPending(activeTab, {
  alimtalkSendMutation,
  brandImageUploadMutation,
  brandMessageSendMutation,
  brandTemplateCreateMutation,
  smsBulkSendRunMutation,
  smsSendMutation,
}) {
  return (activeTab === 'SMS' && (smsSendMutation.isPending || smsBulkSendRunMutation.isPending))
    || (activeTab === '알림톡' && alimtalkSendMutation.isPending)
    || (
      activeTab === '브랜드 메시지'
      && (brandImageUploadMutation.isPending || brandMessageSendMutation.isPending || brandTemplateCreateMutation.isPending)
    );
}

function isSmsBulkSendRunPayload(payload) {
  return Array.isArray(payload?.recipients) && payload.recipients.length > 1000;
}

function toSmsBulkSendRunPayload(payload) {
  const { clientRequestId, ...bulkPayload } = payload;

  return bulkPayload;
}

function getVisibleSmsBulkSendRun(data) {
  const runs = Array.isArray(data?.runs) ? data.runs : [];
  const visibleRun = runs.find(isActiveSmsBulkSendRun)
    ?? runs.find((run) => run?.status === 'completed' && isRecentSmsBulkSendRun(run))
    ?? runs.find((run) => (run?.status === 'blocked' || run?.status === 'failed') && isRecentSmsBulkSendRun(run));

  return visibleRun ?? null;
}

function isRecentSmsBulkSendRun(run) {
  const timestamp = Date.parse(run?.completedAt ?? run?.finishedAt ?? run?.createdAt ?? '');

  return Number.isFinite(timestamp) && Date.now() - timestamp < 30 * 60 * 1000;
}

function isActiveSmsBulkSendRun(run) {
  return run?.status === 'queued' || run?.status === 'running' || run?.state === 'queued' || run?.state === 'running';
}

function showSmsBulkSendRunToast({ navigation, run, showToast, statusPollingRunRef, toastRef }) {
  const view = getSmsBulkSendRunToastView(run, { formatNumber });

  if (!view) {
    return;
  }

  if (toastRef.current === view.key) {
    return;
  }

  toastRef.current = view.key;

  if (view.animation === 'spinner') {
    showToast({
      animation: view.animation,
      description: view.description,
      duration: view.duration,
      id: MESSAGE_STATUS_TOAST_ID,
      title: view.title,
    });
    return;
  }

  if (view.variant === 'success') {
    showToast({
      action: {
        label: view.actionLabel,
        onClick: () => {
          statusPollingRunRef.current += 1;
          navigation.push(view.resultHref);
        },
      },
      description: view.description,
      id: MESSAGE_STATUS_TOAST_ID,
      title: view.title,
      variant: 'success',
    });
    return;
  }

  showToast({
    action: {
      label: view.actionLabel,
      onClick: () => {
        statusPollingRunRef.current += 1;
        navigation.push(view.resultHref);
      },
    },
    description: view.description,
    id: MESSAGE_STATUS_TOAST_ID,
    title: view.title,
    variant: view.variant,
  });
}

function showSendErrorToast(showToast, error, fallbackTitle, options = {}) {
  if (error instanceof MessageSendValidationError) {
    showToast({
      description: error.message,
      id: options.id,
      title: error.title,
      variant: error.code === 'AD_SMS_UNSUPPORTED' ? 'default' : 'critical',
    });
    return;
  }

  const status = error?.status;
  const title = status === 401
    ? '로그인 필요'
    : status === 403
      ? '발송 권한 필요'
      : fallbackTitle;

  showToast({
    description: getRelayErrorMessage(error, '요청을 처리할 수 없습니다.'),
    id: options.id,
    title,
    variant: status === 401 ? 'default' : 'critical',
  });
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('ko-KR');
}

function MessageSendApiStatus({
  activeTab,
  hasAlimtalkSender,
  hasBrandSender,
  hasSmsSender,
  onSenderRetry,
  onTemplateRetry,
  senderResourcesQuery,
  templateQuery,
}) {
  if (senderResourcesQuery.isPending) {
    return (
      <div className="message-send-api-status" role="status">
        <span>발신 수단을 불러오는 중입니다.</span>
      </div>
    );
  }

  if (senderResourcesQuery.isError) {
    return (
      <div className="message-send-api-status" data-tone="critical" role="alert">
        <span>{getRelayErrorMessage(senderResourcesQuery.error, '발신 수단을 불러오지 못했습니다.')}</span>
        <Button onClick={() => onSenderRetry?.()}>다시 시도</Button>
      </div>
    );
  }

  if (activeTab === 'SMS' && !hasSmsSender) {
    return (
      <div className="message-send-api-status" role="status">
        <span>승인된 발신번호가 없습니다. 발신번호를 등록하면 SMS/LMS/MMS를 발송할 수 있습니다.</span>
      </div>
    );
  }

  if (activeTab === '알림톡' && !hasAlimtalkSender) {
    return (
      <div className="message-send-api-status" role="status">
        <span>연결된 알림톡 채널이 없습니다. 채널을 연결하면 알림톡을 발송할 수 있습니다.</span>
      </div>
    );
  }

  if (activeTab === '브랜드 메시지' && !hasBrandSender) {
    return (
      <div className="message-send-api-status" role="status">
        <span>연결된 브랜드 발신 채널이 없습니다. 카카오 채널을 연결하면 브랜드 메시지를 발송할 수 있습니다.</span>
      </div>
    );
  }

  if (templateQuery.isPending) {
    return (
      <div className="message-send-api-status" role="status">
        <span>{activeTab} 템플릿을 불러오는 중입니다.</span>
      </div>
    );
  }

  if (templateQuery.isError) {
    return (
      <div className="message-send-api-status" data-tone="critical" role="alert">
        <span>{getRelayErrorMessage(templateQuery.error, `${activeTab} 템플릿을 불러오지 못했습니다.`)}</span>
        <Button onClick={() => onTemplateRetry?.()}>다시 시도</Button>
      </div>
    );
  }

  return null;
}

function MessageLogsPage() {
  const navigation = useConsoleNavigation();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const searchParamText = searchParams.toString();
  const filters = useMemo(
    () => getMessageLogFiltersFromSearchParams(new URLSearchParams(searchParamText)),
    [searchParamText]
  );
  const queryFilters = useMemo(() => toMessageLogQueryParams(filters), [filters]);
  const groupsQuery = useMessageLogGroupsQuery(queryFilters);
  const exportMutation = useMessageLogsExportMutation();
  const publClient = usePublClient();
  const groups = groupsQuery.data?.groups ?? [];
  const total = getMessageLogGroupPageTotal(groupsQuery.data);
  const mode = searchParams.get('mode') === 'embed' ? 'embed' : null;
  const datePickerMaxDate = useMemo(() => new Date(), []);
  const datePickerMinDate = useMemo(() => {
    const range = getDefaultMessageLogRange(datePickerMaxDate);
    const minDate = new Date(range.to);
    minDate.setDate(minDate.getDate() - 29);
    return minDate;
  }, [datePickerMaxDate]);

  function replaceFilters(nextFilters) {
    const nextChannel = nextFilters.channel ?? filters.channel;
    const nextParams = toMessageLogUrlParams({
      ...filters,
      ...nextFilters,
      messageType: nextChannel === 'sms' ? (nextFilters.messageType ?? filters.messageType) : 'all',
    }, mode);

    navigation.replace(`/logs?${nextParams.toString()}`);
  }

  async function exportLogs() {
    if (filters.demoCases) {
      showToast({
        description: '임시 케이스는 실제 발송기록이 아니어서 내보내지 않습니다.',
        title: '내보내기 제외',
        variant: 'default',
      });
      return;
    }

    try {
      const result = await exportMutation.mutateAsync({
        channel: queryFilters.channel,
        from: queryFilters.from,
        ...(queryFilters.messageType ? { messageType: queryFilters.messageType } : {}),
        to: queryFilters.to,
      });

      showToast({
        description: `${result.filename} 다운로드를 시작했습니다.`,
        title: '발송기록 내보내기 완료',
        variant: 'success',
      });
    } catch (error) {
      showToast({
        description: getRelayErrorMessage(error, '발송기록을 내보내지 못했습니다.'),
        title: '내보내기 실패',
        variant: 'critical',
      });
    }
  }

  return (
    <section className="page-frame message-logs-page">
      <PageHeader title="발송기록" />

      <div className="message-logs-toolbar">
        <div aria-label="발송 채널" className="message-log-channel-tabs" role="tablist">
          {MESSAGE_LOG_CHANNEL_OPTIONS.map((option) => (
            <button
              aria-selected={filters.channel === option.value}
              className={filters.channel === option.value ? 'is-active' : ''}
              key={option.value}
              onClick={() => replaceFilters({ channel: option.value, messageType: 'all', page: 1 })}
              role="tab"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <DatePickerPresets
          defaultRange={{ from: filters.from, to: filters.to }}
          key={`${filters.from.getTime()}-${filters.to.getTime()}`}
          maxDate={datePickerMaxDate}
          minDate={datePickerMinDate}
          onRangeChange={(range) => replaceFilters({ ...range, page: 1 })}
        />
        {filters.channel === 'sms' ? (
          <FilterSelect
            label="메시지 유형"
            onValueChange={(messageType) => replaceFilters({ messageType, page: 1 })}
            options={SMS_MESSAGE_TYPE_OPTIONS}
            value={filters.messageType}
          />
        ) : null}
        <Button
          disabled={groupsQuery.isFetching}
          onClick={() => groupsQuery.refetch()}
          variant="secondary"
        >
          <RefreshCcw aria-hidden="true" size={15} />
          새로고침
        </Button>
        {publClient.isPublEmbed ? null : (
          <Button
            disabled={filters.demoCases || exportMutation.isPending}
            onClick={exportLogs}
            variant="secondary"
          >
            <Download aria-hidden="true" size={15} />
            {exportMutation.isPending ? '내보내는 중…' : 'CSV 내보내기'}
          </Button>
        )}
      </div>

      {groupsQuery.isError ? (
        <div className="message-send-api-status message-logs-status" data-tone="critical" role="alert">
          <span>{getRelayErrorMessage(groupsQuery.error, '발송기록을 불러오지 못했습니다.')}</span>
          <Button onClick={() => groupsQuery.refetch()}>다시 시도</Button>
        </div>
      ) : null}

      {filters.demoCases ? (
        <div className="message-send-api-status message-logs-status" role="status">
          <span>임시 케이스를 표시 중입니다. 실제 발송기록에는 저장되지 않습니다.</span>
        </div>
      ) : null}

      <DataTableV2
        actionsClassName="is-email-actions is-log-actions"
        columns={[
          {
            accessor: getMessageLogGroupSentAt,
            className: 'is-log-complete-date',
            header: '발송 시간',
            cell: ({ value }) => formatMessageLogDate(value),
          },
          {
            accessor: getMessageLogGroupDisplayPreview,
            className: 'is-log-content',
            header: '내용',
            cell: ({ value }) => <span className="resend-email-subject-text">{value}</span>,
          },
          { accessor: getMessageLogGroupSourceLabel, className: 'is-log-source', header: '발송 구분' },
          { accessor: (group) => getChannelLabel(group.channel), className: 'is-log-channel', header: '채널' },
          { accessor: getMessageLogGroupKindLabel, className: 'is-log-kind', header: '구분' },
          {
            accessor: (group) => group.senderLabel || '-',
            className: 'is-log-sender',
            header: '발신 리소스',
            cell: ({ value }) => <span className="message-logs-cell-strong">{value}</span>,
          },
          {
            accessor: formatMessageLogGroupCounts,
            className: 'is-log-recipients',
            header: '수신자',
            cell: ({ value }) => <span className="message-logs-counts">{value}</span>,
          },
          {
            accessor: getMessageLogGroupStatus,
            className: 'is-log-status',
            header: '접수',
            cell: ({ value }) => <MessageLogV2Status status={value} />,
          },
          {
            accessor: getMessageLogGroupResultSummary,
            className: 'is-log-result',
            header: '결과',
            cell: ({ value }) => <span className="message-log-result-summary">{value}</span>,
          },
        ]}
        data={groupsQuery.isPending ? [] : groups}
        empty={<span className="admin-empty-row">선택한 기간에 표시할 발송기록이 없습니다.</span>}
        getRowId={getMessageLogGroupRowId}
        loading={groupsQuery.isPending}
        loadingSlot={(
          <span className="admin-state-row">
            <Circle aria-hidden="true" size={18} />
            발송기록을 불러오는 중입니다.
          </span>
        )}
        renderPagination={() => (
          <MessageLogsV2Pagination
            onPageChange={(page) => replaceFilters({ page })}
            onPageSizeChange={(pageSize) => replaceFilters({ page: 1, pageSize })}
            page={filters.page}
            pageSize={filters.pageSize}
            pageSizeOptions={[20, 50, 100]}
            total={total}
          />
        )}
        rowActions={({ row }) => (
          <div className="resend-email-actions">
            <ConsoleLink
              aria-label="발송 묶음 상세 보기"
              className="message-logs-action-trigger"
              href={getMessageLogGroupDetailHref({ filters, group: row, mode })}
              title="상세 보기"
            >
              <FileText aria-hidden="true" size={15} />
            </ConsoleLink>
          </div>
        )}
        shellClassName="message-logs-table-shell"
        tableClassName="message-logs-table-v2"
      />
    </section>
  );
}

function getMessageLogGroupDetailHref({ filters, group, mode }) {
  const params = toMessageLogUrlParams(filters, mode);
  return `/logs/${encodeURIComponent(group.id)}?${params.toString()}`;
}

function MessageLogV2Status({ label, status }) {
  return (
    <span className={`resend-email-status message-log-status-chip is-${getMessageLogV2StatusTone(status?.state)}`}>
      {label ?? status?.label ?? '상태 확인 불가'}
    </span>
  );
}

function MessageLogsV2Pagination({
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  pageSizeOptions,
  total,
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(total, currentPage * pageSize);

  return (
    <div className="resend-email-pagination message-logs-v2-pagination">
      <p>
        <strong>{from}-{to}</strong>
        <span> / {total}건</span>
        <span> - </span>
        <select
          aria-label="페이지당 발송기록 수"
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          value={pageSize}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>{option}개</option>
          ))}
        </select>
      </p>
      <div>
        <button disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} type="button">
          이전
        </button>
        <button disabled={currentPage >= pageCount} onClick={() => onPageChange(currentPage + 1)} type="button">
          다음
        </button>
      </div>
    </div>
  );
}

function getMessageLogV2StatusTone(state) {
  switch (state) {
    case 'success':
      return 'success';
    case 'failed':
    case 'partial':
      return 'failed';
    case 'pending':
      return 'pending';
    default:
      return 'unknown';
  }
}

function ConsolePage({ meta, onDocs }) {
  const navigation = useConsoleNavigation();
  const [activeTab, setActiveTab] = useState(() => getConsolePageTabValue(meta.tabs?.[0]));
  const isAutomationsPage = meta.variant === 'automations';
  const activeView = {
    ...meta,
    ...(meta.tabViews?.[activeTab] ?? {}),
  };
  const activeTableVariant = activeView.table?.variant;
  const shouldShowToolbar = !isAutomationsPage;
  const toolbarClassName = [
    isAutomationsPage && 'automations-toolbar',
    activeTableVariant === 'publ-events' && 'publ-events-toolbar',
    activeTableVariant === 'automation-unsent' && 'automation-unsent-toolbar',
  ].filter(Boolean).join(' ');
  const opensDocs = activeView.emptyButton === '문서 보기';
  const opensTemplateCreate = activeView.action === '템플릿 생성';
  const opensAutomationCreate = activeView.action === '자동화 생성';
  const opensPublEventCreate = activeView.action === '이벤트 생성';
  const openTemplateCreatePage = opensTemplateCreate
    ? () => navigation.push('/templates/alimtalk/new')
    : undefined;
  const openAutomationCreatePage = opensAutomationCreate
    ? () => navigation.push('/automations/new')
    : undefined;
  const openPublEventCreatePage = opensPublEventCreate
    ? () => navigation.push('/automations/publ-events/new')
    : undefined;
  const openActionPage = openTemplateCreatePage ?? openAutomationCreatePage ?? openPublEventCreatePage;

  return (
    <section className={['page-frame', isAutomationsPage && 'automations-page'].filter(Boolean).join(' ')}>
      <PageHeader action={isAutomationsPage ? undefined : activeView.action} onAction={openTemplateCreatePage} title={meta.title} />
      {meta.tabs ? (
        isAutomationsPage ? (
          <div className="automations-tabs-row">
            <SegmentedControl
              items={meta.tabs}
              onValueChange={setActiveTab}
              value={activeTab}
            />
            <div className="automations-header-actions">
              {activeView.action ? (
                <Button onClick={openActionPage} variant="primary">
                  <Plus size={15} />
                  {activeView.action}
                </Button>
              ) : null}
              <ApiCodeDrawer />
            </div>
          </div>
        ) : (
          <SegmentedControl
            items={meta.tabs}
            onValueChange={setActiveTab}
            value={activeTab}
          />
        )
      ) : null}
      {shouldShowToolbar ? (
        <Toolbar
          className={toolbarClassName}
          filters={activeView.filters}
          showExport
        />
      ) : null}
      {activeView.table ? (
        activeTableVariant === 'automations' ? (
          <AutomationDataTable table={activeView.table} />
        ) : activeTableVariant === 'automation-unsent' ? (
          <AutomationUnsentDataTable table={activeView.table} />
        ) : activeTableVariant === 'publ-events' ? (
          <PublEventsDataTable table={activeView.table} />
        ) : (
          <SelectableDataTable table={activeView.table} />
        )
      ) : (
        <EmptyState
          action={activeView.emptyButton}
          copy={activeView.emptyCopy}
          icon={Sparkles}
          onAction={opensDocs ? onDocs : openActionPage}
          title={activeView.emptyTitle}
        />
      )}
    </section>
  );
}

function getConsolePageTabValue(tab) {
  if (typeof tab === 'object' && tab !== null) {
    return tab.value;
  }

  return tab ?? '';
}

const AUTOMATION_STATUS_LABELS = {
  archived: '보관됨',
  disabled: '비활성화',
  enabled: '활성화',
};

const SELECTABLE_TABLE_PAGE_SIZE_OPTIONS = [40, 80, 120];
const PUBL_EVENT_TABLE_PAGE_SIZE_OPTIONS = [30, 60, 120];
const PUBL_EVENT_VARIABLE_CHIP_GAP = 4;
const PUBL_EVENT_VARIABLE_COLLAPSED_ROW_LIMIT = 2;
const AUTOMATION_RULE_QUERY_LIMIT = 200;
const AUTOMATION_RULE_PAGE_SIZE_OPTIONS = [20, 50, 100];
const AUTOMATION_UNSENT_QUERY_LIMIT = 100;
const AUTOMATION_UNSENT_PAGE_SIZE_OPTIONS = [20, 50, 100];

const AUTOMATION_RULE_STATUS_OPTIONS = [
  { label: '모든 상태', value: 'all' },
  { label: '활성화', tone: 'green', value: 'enabled' },
  { label: '비활성화', tone: 'neutral', value: 'disabled' },
  { label: '보관됨', tone: 'neutral', value: 'archived' },
];

const AUTOMATION_SEND_CHANNEL_LABELS = {
  alimtalk: '알림톡',
  'brand-message': '브랜드 메시지',
  lms: 'LMS',
  mms: 'MMS',
  sms: 'SMS',
};

const AUTOMATION_UNSENT_REASON_LABELS = {
  dispatch_failed: '발송 처리 실패',
  dispatch_validation_failed: '발송 조건 확인 필요',
  missing_registration: '발신 등록 필요',
  missing_rule: '자동화 규칙 필요',
  missing_sender_resource: '발신 수단 필요',
  missing_target_phone: '수신자 정보 필요',
  missing_template: '템플릿 확인 필요',
  missing_template_code: '템플릿 코드 필요',
  payload_validation_failed: '이벤트 데이터 보완 필요',
  provider_rejected: '제공자 거부',
  provider_unknown: '제공자 결과 미확인',
  unsupported_send_channel: '지원하지 않는 채널',
};

function PublEventsDataTable({ table: tableConfig }) {
  const navigation = useConsoleNavigation();
  const publEventsQuery = usePublEventsQuery();
  const automationQueryFilters = useMemo(() => ({ limit: AUTOMATION_RULE_QUERY_LIMIT }), []);
  const automationRulesQuery = useAutomationRulesQuery(automationQueryFilters);
  const catalog = publEventsQuery.data ?? {};
  const rows = useMemo(
    () => (Array.isArray(catalog.events) ? catalog.events : []),
    [catalog.events]
  );
  const automationRules = useMemo(
    () => (Array.isArray(automationRulesQuery.data?.rules) ? automationRulesQuery.data.rules : []),
    [automationRulesQuery.data]
  );
  const automationStateByEventKey = useMemo(
    () => buildPublEventAutomationStateByEventKey(rows, automationRules),
    [automationRules, rows]
  );
  const columns = useMemo(
    () => {
      const headers = tableConfig.columns ?? ['이벤트', '사용중 변수', '자동화'];

      return [
        {
          accessor: (row) => row.displayName,
          className: 'is-publ-event-name',
          header: headers[0],
          cell: ({ row }) => <PublEventNameCell event={row} />,
        },
        {
          accessor: (row) => row.locationId || '',
          className: 'is-publ-event-location',
          header: headers[1],
          cell: ({ row }) => <PublEventLocationCell event={row} />,
        },
        {
          accessor: (row) => getPublEventUsedVariables(row).length,
          className: 'is-publ-event-variables',
          header: headers[2],
          cell: ({ row }) => <PublEventVariableChipsCell event={row} />,
        },
        {
          accessor: (row) => automationStateByEventKey.get(row.eventKey)?.sortRank ?? 3,
          className: 'is-publ-event-automation',
          header: headers[3],
          cell: ({ row }) => (
            <PublEventAutomationCell
              error={automationRulesQuery.isError}
              loading={automationRulesQuery.isLoading}
              state={automationStateByEventKey.get(row.eventKey)}
            />
          ),
        },
      ];
    },
    [automationRulesQuery.isError, automationRulesQuery.isLoading, automationStateByEventKey, tableConfig.columns]
  );

  if (publEventsQuery.isError && rows.length === 0) {
    return (
      <PublEventLoadError
        message={getRelayErrorMessage(publEventsQuery.error, 'PUBL 이벤트를 불러오지 못했습니다.')}
        onRetry={() => publEventsQuery.refetch()}
      />
    );
  }

  return (
    <DataTableV2
      columns={columns}
      data={rows}
      empty="표시할 PUBL 이벤트가 없습니다."
      fixed
      getRowId={(row) => row.id ?? row.eventKey}
      initialPageSize={30}
      loading={publEventsQuery.isLoading}
      loadingRows={8}
      pagination
      renderPagination={({ table: dataTable }) => (
        <PublEventTablePagination table={dataTable} total={rows.length} />
      )}
      rowActions={({ row }) => (
        <Button
          aria-label={`${row.displayName || row.eventKey} 상세 보기`}
          className="publ-event-detail-action"
          onClick={() => navigation.push(buildPublEventDetailHref(row.eventKey))}
        >
          상세
        </Button>
      )}
      actionsClassName="is-publ-event-actions"
      actionsHeaderClassName="is-publ-event-actions"
      shellClassName="publ-event-data-table-shell"
      tableClassName="publ-event-data-table"
    />
  );
}

function AutomationUnsentDataTable({ table: tableConfig }) {
  const { showToast } = useToast();
  const queryFilters = useMemo(() => ({ limit: AUTOMATION_UNSENT_QUERY_LIMIT }), []);
  const unsentQuery = useAutomationUnsentDeliveriesQuery(queryFilters);
  const resendMutation = useAutomationUnsentResendMutation();
  const dismissMutation = useAutomationUnsentDismissMutation();
  const [bulkAction, setBulkAction] = useState(null);
  const rows = Array.isArray(unsentQuery.data?.deliveries) ? unsentQuery.data.deliveries : [];
  const bulkPending = bulkAction !== null;
  const columns = useMemo(
    () => {
      const headers = tableConfig.columns ?? ['이벤트', '채널 코드', '발송 채널', '수신자', '사유', '수신 시각'];

      return [
        {
          accessor: (row) => row.eventDisplayName ?? row.eventKey,
          className: 'is-automation-unsent-event',
          header: headers[0],
          cell: ({ row }) => <AutomationUnsentEventCell delivery={row} />,
        },
        {
          accessor: (row) => row.channelCode,
          className: 'is-automation-unsent-channel-code',
          header: headers[1],
          cell: ({ value }) => <AutomationUnsentCode value={value} />,
        },
        {
          accessor: (row) => row.sendChannel,
          className: 'is-automation-unsent-send-channel',
          header: headers[2],
          cell: ({ value }) => (
            <Badge tone="neutral">
              {formatAutomationSendChannel(value)}
            </Badge>
          ),
        },
        {
          accessor: (row) => row.maskedRecipient,
          className: 'is-automation-unsent-recipient',
          header: headers[3],
          cell: ({ value }) => value || '없음',
        },
        {
          accessor: (row) => row.reasonCode,
          className: 'is-automation-unsent-reason',
          header: headers[4],
          cell: ({ row }) => <AutomationUnsentReasonCell delivery={row} />,
        },
        {
          accessor: (row) => row.receivedAt,
          className: 'is-automation-unsent-received',
          header: headers[5],
          cell: ({ value }) => formatAutomationUnsentDate(value),
        },
      ];
    },
    [tableConfig.columns]
  );

  async function resendDelivery(row) {
    try {
      const result = await resendMutation.mutateAsync({ deliveryId: row.id });
      const nextStatus = result?.delivery?.status;
      const reason = result?.delivery?.reasonCode ?? result?.sendResult?.reasonCode;

      showToast({
        description: nextStatus === 'sent'
          ? '자동화 발송 요청이 다시 접수되었습니다.'
          : `${getAutomationUnsentReasonLabel(reason)} 상태로 남아 있습니다.`,
        title: nextStatus === 'sent' ? '미발송 재시도 완료' : '미발송 재시도 보류',
        variant: nextStatus === 'sent' ? 'success' : 'warning',
      });
    } catch (error) {
      showToast({
        description: getRelayErrorMessage(error, '미발송 항목을 다시 발송하지 못했습니다.'),
        title: '미발송 재시도 실패',
        variant: 'critical',
      });
    }
  }

  async function dismissDelivery(row) {
    try {
      await dismissMutation.mutateAsync({ deliveryId: row.id });
      showToast({
        description: '미발송 목록에서 삭제했습니다.',
        title: '미발송 항목 삭제',
        variant: 'success',
      });
    } catch (error) {
      showToast({
        description: getRelayErrorMessage(error, '미발송 항목을 삭제하지 못했습니다.'),
        title: '미발송 삭제 실패',
        variant: 'critical',
      });
    }
  }

  async function resendSelectedDeliveries(selectedRows, clearSelection) {
    if (bulkPending || selectedRows.length === 0) return;

    setBulkAction('resend');

    let sentCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    try {
      for (const row of selectedRows) {
        try {
          const result = await resendMutation.mutateAsync({ deliveryId: row.id });

          if (result?.delivery?.status === 'sent') {
            sentCount += 1;
          } else {
            pendingCount += 1;
          }
        } catch {
          failedCount += 1;
        }
      }

      if (sentCount > 0 || pendingCount > 0) {
        clearSelection();
      }

      showToast({
        description: formatAutomationUnsentBulkResult({
          failedCount,
          pendingCount,
          pendingLabel: '보류',
          successCount: sentCount,
          successLabel: '재발송 접수',
        }),
        title: failedCount > 0 ? '선택 미발송 재시도 결과' : '선택 미발송 재시도 완료',
        variant: failedCount > 0 ? 'critical' : pendingCount > 0 ? 'warning' : 'success',
      });
    } finally {
      setBulkAction(null);
    }
  }

  async function dismissSelectedDeliveries(selectedRows, clearSelection) {
    if (bulkPending || selectedRows.length === 0) return;

    setBulkAction('dismiss');

    let dismissedCount = 0;
    let failedCount = 0;

    try {
      for (const row of selectedRows) {
        try {
          await dismissMutation.mutateAsync({ deliveryId: row.id });
          dismissedCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      if (dismissedCount > 0) {
        clearSelection();
      }

      showToast({
        description: formatAutomationUnsentBulkResult({
          failedCount,
          successCount: dismissedCount,
          successLabel: '삭제',
        }),
        title: failedCount > 0 ? '선택 미발송 삭제 결과' : '선택 미발송 삭제 완료',
        variant: failedCount > 0 ? 'critical' : 'success',
      });
    } finally {
      setBulkAction(null);
    }
  }

  if (unsentQuery.isError && rows.length === 0) {
    return (
      <PublEventLoadError
        message={getRelayErrorMessage(unsentQuery.error, '미발송 자동화 항목을 불러오지 못했습니다.')}
        onRetry={() => unsentQuery.refetch()}
        title="미발송 항목 로드 실패"
      />
    );
  }

  return (
    <DataTableV2
      actionsClassName="is-email-actions is-automation-unsent-actions table-actions"
      actionsHeaderClassName="is-email-actions is-automation-unsent-actions"
      bulkActionBarProps={({ selectedRows }) => ({
        'aria-label': '선택 미발송 항목 작업',
        clearLabel: '선택 해제',
        countLabel: `${selectedRows.length}개 선택됨`,
      })}
      bulkActions={({ clearSelection, selectedRows }) => (
        <>
          <DataTableV2.BulkActionButton
            disabled={bulkPending}
            onClick={() => resendSelectedDeliveries(selectedRows, clearSelection)}
          >
            <RefreshCcw size={14} />
            재발송
          </DataTableV2.BulkActionButton>
          <DataTableV2.BulkActionButton
            danger
            disabled={bulkPending}
            onClick={() => dismissSelectedDeliveries(selectedRows, clearSelection)}
          >
            <X size={14} />
            삭제
          </DataTableV2.BulkActionButton>
        </>
      )}
      columns={columns}
      data={rows}
      empty="표시할 미발송 항목이 없습니다."
      getRowId={(row) => row.id}
      initialPageSize={20}
      loading={unsentQuery.isLoading}
      loadingRows={6}
      loadingSlot={<span className="automation-unsent-loading" role="status">미발송 항목을 불러오는 중입니다.</span>}
      pagination
      renderPagination={({ table: dataTable }) => (
        <AutomationUnsentTablePagination table={dataTable} total={rows.length} />
      )}
      rowActions={({ row }) => (
        <AutomationUnsentRowActions
          disabled={bulkPending}
          dismissPending={dismissMutation.isPending && dismissMutation.variables?.deliveryId === row.id}
          onDismiss={() => dismissDelivery(row)}
          onResend={() => resendDelivery(row)}
          resendPending={resendMutation.isPending && resendMutation.variables?.deliveryId === row.id}
          row={row}
        />
      )}
      selectable
      selectAllLabel="모든 미발송 항목 선택"
      selectedRowLabel={({ row }) => `${row.eventDisplayName || row.eventKey || row.id} 선택`}
      selectionVisibility="hover"
      shellClassName="automation-unsent-data-table-shell"
      tableClassName="automation-unsent-data-table"
    />
  );
}

function formatAutomationUnsentBulkResult({
  failedCount = 0,
  pendingCount = 0,
  pendingLabel = '보류',
  successCount = 0,
  successLabel,
}) {
  const parts = [];

  if (successCount > 0) parts.push(`${successCount}건 ${successLabel}`);
  if (pendingCount > 0) parts.push(`${pendingCount}건 ${pendingLabel}`);
  if (failedCount > 0) parts.push(`${failedCount}건 실패`);

  return parts.length > 0 ? parts.join(', ') : '처리할 미발송 항목이 없습니다.';
}

function AutomationUnsentEventCell({ delivery }) {
  const primary = delivery.eventDisplayName || delivery.eventKey || '이벤트';

  return (
    <span className="automation-unsent-event-cell">
      <span className="automation-unsent-event-name">{primary}</span>
      <span className="automation-unsent-event-key" title={delivery.eventKey} translate="no">
        {delivery.eventKey || '-'}
      </span>
    </span>
  );
}

function AutomationUnsentCode({ value }) {
  return (
    <span className="automation-unsent-code" title={value} translate="no">
      {value || '-'}
    </span>
  );
}

function AutomationUnsentReasonCell({ delivery }) {
  const reasonCode = delivery.reasonCode ?? '';

  return (
    <span className="automation-unsent-reason-cell">
      <span className="automation-unsent-reason-label">{getAutomationUnsentReasonLabel(reasonCode)}</span>
      {reasonCode ? (
        <span className="automation-unsent-reason-code" translate="no">
          {reasonCode}
        </span>
      ) : null}
    </span>
  );
}

function AutomationUnsentRowActions({
  disabled = false,
  dismissPending,
  onDismiss,
  onResend,
  resendPending,
  row,
}) {
  const actionsDisabled = disabled || resendPending || dismissPending;
  const labelSource = row.eventDisplayName || row.eventKey || row.id;

  return (
    <div className="automation-unsent-action-buttons">
      <ActionMenu>
        <ActionMenuTrigger asChild>
          <IconButton
            disabled={actionsDisabled}
            icon={MoreHorizontal}
            label={`${labelSource} 작업 더보기`}
          />
        </ActionMenuTrigger>
        <ActionMenuContent align="end">
          <ActionMenuItem
            disabled={actionsDisabled}
            leadingVisual={<RefreshCcw size={16} />}
            onSelect={onResend}
          >
            재발송
          </ActionMenuItem>
          <ActionMenuItem
            disabled={actionsDisabled}
            leadingVisual={<X size={16} />}
            onSelect={onDismiss}
            variant="danger"
          >
            삭제
          </ActionMenuItem>
        </ActionMenuContent>
      </ActionMenu>
    </div>
  );
}

function AutomationUnsentTablePagination({ table, total }) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = Math.max(table.getPageCount(), 1);
  const pageNumber = Math.min(pageIndex + 1, pageCount);

  function changePageSize(event) {
    table.setPageSize(Number(event.target.value));
    table.setPageIndex(0);
  }

  return (
    <div className="automation-table-pagination automation-unsent-table-pagination">
      <span>
        페이지 {pageNumber} - {pageCount} / {formatPublEventNumber(total)}개 미발송 -{' '}
        <span className="automation-page-size-select">
          <select aria-label="페이지당 미발송 항목 수" onChange={changePageSize} value={pageSize}>
            {AUTOMATION_UNSENT_PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}개</option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={14} />
        </span>
      </span>
    </div>
  );
}

function formatAutomationSendChannel(value) {
  return AUTOMATION_SEND_CHANNEL_LABELS[value] ?? value ?? '-';
}

function getAutomationUnsentReasonLabel(reasonCode) {
  return AUTOMATION_UNSENT_REASON_LABELS[reasonCode] ?? '확인 필요';
}

function formatAutomationUnsentDate(value) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(date);
}

function PublEventLoadError({ message, onRetry, title = 'PUBL 이벤트 로드 실패' }) {
  return (
    <div className="publ-event-load-error" role="alert">
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      <Button onClick={onRetry}>
        <RefreshCcw aria-hidden="true" size={14} />
        다시 시도
      </Button>
    </div>
  );
}

function PublEventNameCell({ event }) {
  return (
    <span className="publ-event-name-cell">
      <span className="publ-event-name-row">
        <span className="publ-event-name-text">{event.displayName || event.eventKey}</span>
      </span>
      <span className="publ-event-key" title={event.eventKey} translate="no">
        {event.eventKey || '-'}
      </span>
    </span>
  );
}

function PublEventLocationCell({ event }) {
  const location = normalizePublEventVariableText(event?.locationId);

  return (
    <span className="publ-event-location-cell" title={location || 'location 없음'} translate="no">
      {location || '-'}
    </span>
  );
}

function PublEventVariableChipsCell({ event }) {
  const variables = getPublEventUsedVariables(event);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const [visibleVariableCount, setVisibleVariableCount] = useState(variables.length);
  const cellRef = useRef(null);
  const measureRef = useRef(null);
  const variableLayoutKey = variables.map((variable) => (
    `${variable.key}:${variable.displayName}:${variable.required ? 'required' : 'optional'}`
  )).join('|');

  useEffect(() => {
    const cell = cellRef.current;
    const measure = measureRef.current;

    if (!cell || !measure || variables.length === 0) {
      setCanExpand(false);
      setExpanded(false);
      setVisibleVariableCount(variables.length);
      return undefined;
    }

    let frameId = null;

    const getRowCount = (itemWidths, maxWidth) => {
      return itemWidths.reduce((rowState, itemWidth) => {
        const nextLineWidth = rowState.lineWidth === 0
          ? itemWidth
          : rowState.lineWidth + PUBL_EVENT_VARIABLE_CHIP_GAP + itemWidth;

        if (nextLineWidth <= maxWidth || rowState.lineWidth === 0) {
          return {
            lineWidth: nextLineWidth,
            rows: rowState.rows,
          };
        }

        return {
          lineWidth: itemWidth,
          rows: rowState.rows + 1,
        };
      }, { lineWidth: 0, rows: 1 }).rows;
    };

    const updateVisibleVariables = () => {
      const maxWidth = Math.floor(cell.getBoundingClientRect().width);
      const chipElements = Array.from(measure.querySelectorAll('[data-publ-variable-measure="chip"]'));
      const moreElement = measure.querySelector('[data-publ-variable-measure="more"]');

      if (maxWidth <= 0 || chipElements.length === 0 || !moreElement) {
        return;
      }

      const chipWidths = chipElements.map((chip) => Math.ceil(chip.getBoundingClientRect().width));
      const moreWidth = Math.ceil(moreElement.getBoundingClientRect().width);

      if (getRowCount(chipWidths, maxWidth) <= PUBL_EVENT_VARIABLE_COLLAPSED_ROW_LIMIT) {
        setCanExpand(false);
        setExpanded(false);
        setVisibleVariableCount(variables.length);
        return;
      }

      let nextVisibleCount = 0;

      for (let count = 0; count <= chipWidths.length; count += 1) {
        const candidateWidths = [...chipWidths.slice(0, count), moreWidth];
        const candidateRows = getRowCount(candidateWidths, maxWidth);

        if (candidateRows > PUBL_EVENT_VARIABLE_COLLAPSED_ROW_LIMIT) {
          break;
        }

        nextVisibleCount = count;
      }

      setCanExpand(true);
      setVisibleVariableCount(Math.min(nextVisibleCount, variables.length));
    };

    const scheduleUpdate = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(updateVisibleVariables);
    };

    scheduleUpdate();

    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleUpdate);
    observer?.observe(cell);
    observer?.observe(measure);
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      observer?.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [variableLayoutKey, variables.length]);

  if (variables.length === 0) {
    return <span className="publ-event-variable-empty">사용중 변수 없음</span>;
  }

  const variableSummary = variables.map((variable) => (
    variable.required ? `${variable.displayName} 필수` : variable.displayName
  )).join(', ');
  const cellClassName = [
    'publ-event-variable-cell',
    canExpand ? 'is-overflowing' : '',
    expanded ? 'is-expanded' : '',
  ].filter(Boolean).join(' ');
  const visibleVariables = expanded
    ? variables
    : variables.slice(0, visibleVariableCount);
  const toggleLabel = expanded ? '접기' : '더보기';

  const handleToggleExpanded = (interactionEvent) => {
    interactionEvent.stopPropagation();
    setExpanded((current) => !current);
  };

  return (
    <span
      aria-label={`사용중 변수 ${formatPublEventNumber(variables.length)}개: ${variableSummary}`}
      className={cellClassName}
      ref={cellRef}
      title={variableSummary}
    >
      <span className="publ-event-variable-list">
        {visibleVariables.map((variable) => (
          <span
            className={`publ-event-variable-chip ${variable.required ? 'is-required' : ''}`}
            key={variable.key}
            title={variable.required ? `${variable.displayName} 필수` : variable.displayName}
          >
            <span className="publ-event-variable-chip-label" translate="no">{variable.displayName}</span>
            {variable.required ? (
              <span aria-label="필수" className="publ-event-variable-required">*</span>
            ) : null}
          </span>
        ))}
        {canExpand ? (
          <button
            aria-expanded={expanded}
            className="publ-event-variable-more"
            onClick={handleToggleExpanded}
            type="button"
          >
            {toggleLabel}
          </button>
        ) : null}
      </span>
      <span aria-hidden="true" className="publ-event-variable-measure" ref={measureRef}>
        {variables.map((variable) => (
          <span
            className={`publ-event-variable-chip ${variable.required ? 'is-required' : ''}`}
            data-publ-variable-measure="chip"
            key={variable.key}
          >
            <span className="publ-event-variable-chip-label" translate="no">{variable.displayName}</span>
            {variable.required ? (
              <span className="publ-event-variable-required">*</span>
            ) : null}
          </span>
        ))}
        <span className="publ-event-variable-more" data-publ-variable-measure="more">
          더보기
        </span>
      </span>
    </span>
  );
}

function PublEventAutomationCell({ error, loading, state }) {
  const resolvedState = getPublEventAutomationCellState({ error, loading, state });
  const hasSecondary = Boolean(resolvedState.secondary);

  return (
    <span className="publ-event-automation-cell">
      <span className={`publ-event-automation-chip is-${resolvedState.tone}`}>
        {resolvedState.label}
      </span>
      {hasSecondary ? (
        <span className="publ-event-automation-secondary" title={resolvedState.secondary}>
          {resolvedState.secondary}
        </span>
      ) : null}
    </span>
  );
}

function getPublEventUsedVariables(event) {
  const source = Array.isArray(event?.variableOptions)
    ? event.variableOptions
    : Array.isArray(event?.variablePreview)
      ? event.variablePreview
      : [];
  const seenKeys = new Set();
  const variables = [];

  source.forEach((variable, index) => {
    const alias = normalizePublEventVariableText(variable?.alias);
    const label = normalizePublEventVariableText(variable?.label);
    const displayName = alias || label;

    if (!displayName) return;

    const dedupeKey = `${alias || label}`.toLowerCase();

    if (seenKeys.has(dedupeKey)) return;

    seenKeys.add(dedupeKey);
    variables.push({
      displayName,
      key: `${dedupeKey}-${index}`,
      required: variable?.required === true,
    });
  });

  return variables;
}

function buildPublEventAutomationStateByEventKey(events, rules) {
  const eventKeyById = new Map();
  const eventKeys = new Set();
  const rulesByEventKey = new Map();

  events.forEach((event) => {
    const eventKey = normalizePublEventVariableText(event?.eventKey);

    if (!eventKey) return;

    eventKeys.add(eventKey);
    rulesByEventKey.set(eventKey, []);

    if (event?.id !== undefined && event?.id !== null) {
      eventKeyById.set(String(event.id), eventKey);
    }
  });

  rules.forEach((rule) => {
    const ruleEventId = rule?.eventDefinitionId === undefined || rule?.eventDefinitionId === null
      ? ''
      : String(rule.eventDefinitionId);
    const ruleEventKey = normalizePublEventVariableText(rule?.eventDefinition?.eventKey);
    const matchedEventKey = eventKeyById.get(ruleEventId) || (eventKeys.has(ruleEventKey) ? ruleEventKey : '');

    if (!matchedEventKey) return;

    rulesByEventKey.get(matchedEventKey)?.push(rule);
  });

  return new Map(
    Array.from(rulesByEventKey.entries()).map(([eventKey, eventRules]) => [
      eventKey,
      getPublEventAutomationState(eventRules),
    ])
  );
}

function getPublEventAutomationState(rules) {
  const connectedRules = rules.filter((rule) => rule?.status !== 'archived');
  const enabledRules = connectedRules.filter((rule) => rule?.status === 'enabled');

  if (enabledRules.length > 0) {
    const primaryRule = enabledRules[0];

    return {
      label: '활성화됨',
      secondary: getPublEventAutomationRuleSummary(primaryRule, enabledRules.length),
      sortRank: 0,
      tone: 'enabled',
    };
  }

  if (connectedRules.length > 0) {
    const primaryRule = connectedRules[0];

    return {
      label: '연결됨',
      secondary: getPublEventAutomationRuleSummary(primaryRule, connectedRules.length),
      sortRank: 1,
      tone: 'connected',
    };
  }

  return {
    label: '연결 없음',
    secondary: '',
    sortRank: 2,
    tone: 'none',
  };
}

function getPublEventAutomationCellState({ error, loading, state }) {
  if (loading) {
    return {
      label: '확인 중',
      secondary: '자동화 조회 중',
      tone: 'loading',
    };
  }

  if (error) {
    return {
      label: '확인 불가',
      secondary: '자동화 조회 실패',
      tone: 'unknown',
    };
  }

  return state ?? {
    label: '연결 없음',
    secondary: '',
    tone: 'none',
  };
}

function getPublEventAutomationRuleSummary(rule, count) {
  if (count > 1) {
    return `${formatPublEventNumber(count)}개 자동화`;
  }

  return normalizePublEventVariableText(rule?.name) || '자동화 1개';
}

function normalizePublEventVariableText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildPublEventDetailHref(eventKey) {
  return `/automations/publ-events/${encodeURIComponent(String(eventKey ?? ''))}`;
}

function PublEventTablePagination({ table, total }) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = Math.max(table.getPageCount(), 1);
  const pageNumber = Math.min(pageIndex + 1, pageCount);

  function changePageSize(event) {
    table.setPageSize(Number(event.target.value));
    table.setPageIndex(0);
  }

  return (
    <div className="automation-table-pagination publ-event-table-pagination">
      <span>
        페이지 {pageNumber} - {pageCount} / {formatPublEventNumber(total)}개 이벤트 -{' '}
        <span className="automation-page-size-select">
          <select aria-label="페이지당 이벤트 수" onChange={changePageSize} value={pageSize}>
            {PUBL_EVENT_TABLE_PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}개</option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={14} />
        </span>
      </span>
    </div>
  );
}

function formatPublEventNumber(value) {
  return Number(value ?? 0).toLocaleString('ko-KR');
}

function AutomationDataTable({ table: tableConfig }) {
  const navigation = useConsoleNavigation();
  const { showToast } = useToast();
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const queryFilters = useMemo(
    () => ({
      limit: AUTOMATION_RULE_QUERY_LIMIT,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [statusFilter]
  );
  const rulesQuery = useAutomationRulesQuery(queryFilters);
  const enableMutation = useAutomationRuleEnableMutation();
  const disableMutation = useAutomationRuleDisableMutation();
  const archiveMutation = useAutomationRuleArchiveMutation();
  const rows = useMemo(
    () => (Array.isArray(rulesQuery.data?.rules) ? rulesQuery.data.rules : []),
    [rulesQuery.data]
  );
  const filteredRows = useMemo(
    () => filterAutomationRules(rows, searchValue),
    [rows, searchValue]
  );
  const columns = useMemo(
    () => {
      const headers = tableConfig.columns ?? ['이름', '상태', '이벤트', '템플릿'];

      return [
        {
          accessor: (row) => row.name,
          className: 'is-automation-name',
          header: headers[0],
          cell: ({ row }) => <AutomationNameCell rule={row} />,
        },
        {
          accessor: (row) => row.status,
          className: 'is-automation-status',
          header: headers[1],
          cell: ({ value }) => <AutomationStatusChip status={value} />,
        },
        {
          accessor: (row) => row.eventDefinition?.displayName ?? row.eventDefinition?.eventKey,
          className: 'is-automation-event',
          header: headers[2],
          cell: ({ row }) => <AutomationRuleEventCell rule={row} />,
        },
        {
          accessor: (row) => row.templateCode,
          className: 'is-automation-template',
          header: headers[3],
          cell: ({ row }) => <AutomationRuleTemplateCell rule={row} />,
        },
      ];
    },
    [tableConfig.columns]
  );
  const mutationPending = enableMutation.isPending || disableMutation.isPending || archiveMutation.isPending;
  const emptyMessage = searchValue.trim() || statusFilter !== 'all'
    ? '조건에 맞는 자동화가 없습니다.'
    : '아직 자동화 규칙이 없습니다.';

  function openAutomationDetail(row) {
    navigation.push(`/automations/${encodeURIComponent(row.id)}`);
  }

  function openAutomationEdit(row) {
    navigation.push(`/automations/${encodeURIComponent(row.id)}/edit`);
  }

  async function enableRule(row) {
    try {
      const result = await enableMutation.mutateAsync({ ruleId: row.id });
      showToast({
        description: `${result?.rule?.name ?? row.name} 규칙이 이벤트 수신 시 발송됩니다.`,
        title: '자동화 활성화',
        variant: 'success',
      });
    } catch (error) {
      showToast({
        description: getRelayErrorMessage(error, '자동화를 활성화하지 못했습니다.'),
        title: '자동화 활성화 실패',
        variant: 'critical',
      });
    }
  }

  async function disableRule(row) {
    try {
      const result = await disableMutation.mutateAsync({ ruleId: row.id });
      showToast({
        description: `${result?.rule?.name ?? row.name} 규칙이 발송을 멈췄습니다.`,
        title: '자동화 비활성화',
        variant: 'success',
      });
    } catch (error) {
      showToast({
        description: getRelayErrorMessage(error, '자동화를 비활성화하지 못했습니다.'),
        title: '자동화 비활성화 실패',
        variant: 'critical',
      });
    }
  }

  async function archiveRule(row) {
    try {
      const result = await archiveMutation.mutateAsync({ ruleId: row.id });
      showToast({
        description: `${result?.rule?.name ?? row.name} 규칙을 보관했습니다.`,
        title: '자동화 보관',
        variant: 'success',
      });
    } catch (error) {
      showToast({
        description: getRelayErrorMessage(error, '자동화를 보관하지 못했습니다.'),
        title: '자동화 보관 실패',
        variant: 'critical',
      });
    }
  }

  if (rulesQuery.isError && rows.length === 0) {
    return (
      <PublEventLoadError
        message={getRelayErrorMessage(rulesQuery.error, '자동화 규칙을 불러오지 못했습니다.')}
        onRetry={() => rulesQuery.refetch()}
        title="자동화 규칙 로드 실패"
      />
    );
  }

  return (
    <div className="automation-rules-list">
      <div className="automation-rules-list-toolbar">
        <SearchField
          aria-label="자동화 이름, 이벤트, 발신 수단, 템플릿 검색"
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="이름, 이벤트, 템플릿 검색"
          value={searchValue}
        />
        <FilterSelect
          className="automation-status-filter"
          label="상태"
          onValueChange={setStatusFilter}
          options={AUTOMATION_RULE_STATUS_OPTIONS}
          value={statusFilter}
        />
      </div>
      <DataTableV2
        actionsClassName="is-email-actions is-automation-actions table-actions"
        actionsHeaderClassName="is-email-actions is-automation-actions"
        columns={columns}
        data={filteredRows}
        empty={emptyMessage}
        getRowId={(row) => row.id}
        getRowProps={({ row }) => ({
          'aria-label': `${row.name || '이름 없는 자동화'} 자동화 상세 보기`,
          className: 'is-clickable',
          onClick: (event) => {
            if (shouldIgnoreAutomationRowNavigation(event)) return;
            openAutomationDetail(row);
          },
          onKeyDown: (event) => {
            if (event.key !== 'Enter' || shouldIgnoreAutomationRowNavigation(event)) return;
            openAutomationDetail(row);
          },
          role: 'link',
          tabIndex: 0,
        })}
        initialPageSize={AUTOMATION_RULE_PAGE_SIZE_OPTIONS[0]}
        loading={rulesQuery.isLoading}
        loadingRows={6}
        loadingSlot={<span className="automation-unsent-loading" role="status">자동화 규칙을 불러오는 중입니다.</span>}
        onRowClick={({ row }) => openAutomationDetail(row)}
        pagination
        renderPagination={({ table: dataTable }) => (
          <AutomationTablePagination table={dataTable} total={filteredRows.length} />
        )}
        rowActions={({ row }) => (
          <AutomationRuleRowActions
            archivePending={archiveMutation.isPending && archiveMutation.variables?.ruleId === row.id}
            disabled={mutationPending}
            disablePending={disableMutation.isPending && disableMutation.variables?.ruleId === row.id}
            enablePending={enableMutation.isPending && enableMutation.variables?.ruleId === row.id}
            onArchive={() => archiveRule(row)}
            onDisable={() => disableRule(row)}
            onEdit={() => openAutomationEdit(row)}
            onEnable={() => enableRule(row)}
            row={row}
          />
        )}
        selectable
        selectAllLabel="모든 자동화 선택"
        selectedRowLabel={({ row }) => `${row.name} 선택`}
        selectionVisibility="hover"
        shellClassName="automation-data-table-shell"
        tableClassName="automation-data-table automation-rules-data-table"
      />
    </div>
  );
}

function shouldIgnoreAutomationRowNavigation(event) {
  const target = event.target;
  if (!(target instanceof Element)) return false;

  return Boolean(target.closest(
    'a, button, input, select, textarea, [role="button"], [role="menuitem"], [data-automation-row-action]'
  ));
}

function filterAutomationRules(rows, searchValue) {
  const normalizedSearch = normalizeAutomationSearchValue(searchValue);

  if (!normalizedSearch) return rows;

  return rows.filter((row) => getAutomationRuleSearchText(row).includes(normalizedSearch));
}

function getAutomationRuleSearchText(rule) {
  return [
    rule.name,
    rule.eventDefinition?.displayName,
    rule.eventDefinition?.eventKey,
    rule.sendChannel,
    formatAutomationSendChannel(rule.sendChannel),
    rule.senderResource?.displayName,
    rule.senderResource?.type,
    rule.templateCode,
    rule.templateSource,
    rule.status,
    AUTOMATION_STATUS_LABELS[rule.status],
  ]
    .filter(Boolean)
    .map(normalizeAutomationSearchValue)
    .join(' ');
}

function normalizeAutomationSearchValue(value) {
  return String(value ?? '').trim().toLocaleLowerCase('ko-KR');
}

function AutomationRuleRowActions({
  archivePending,
  disabled,
  disablePending,
  enablePending,
  onArchive,
  onDisable,
  onEdit,
  onEnable,
  row,
}) {
  const archived = row.status === 'archived';
  const enabled = row.status === 'enabled';
  const actionsDisabled = disabled || archivePending || disablePending || enablePending;

  return (
    <div
      className="automation-unsent-action-buttons"
      data-automation-row-action
      onClick={(event) => event.stopPropagation()}
    >
      <ActionMenu>
        <ActionMenuTrigger asChild>
          <IconButton
            disabled={actionsDisabled}
            icon={MoreHorizontal}
            label={`${row.name} 작업 더보기`}
          />
        </ActionMenuTrigger>
        <ActionMenuContent align="end">
          <ActionMenuItem
            leadingVisual={<Pencil size={16} />}
            onSelect={onEdit}
          >
            편집
          </ActionMenuItem>
          {enabled ? (
            <ActionMenuItem
              disabled={actionsDisabled || archived}
              leadingVisual={<Ban size={16} />}
              onSelect={onDisable}
            >
              비활성화
            </ActionMenuItem>
          ) : (
            <ActionMenuItem
              disabled={actionsDisabled || archived}
              leadingVisual={<CheckCircle2 size={16} />}
              onSelect={onEnable}
            >
              활성화
            </ActionMenuItem>
          )}
          <ActionMenuSeparator />
          <ConfirmationDialog
            confirmLabel="보관"
            description={`${row.name} 자동화를 보관합니다. 보관된 규칙은 다시 활성화할 수 없습니다.`}
            destructive
            onConfirm={onArchive}
            title={`${row.name} 보관?`}
          >
            <ActionMenuItem
              disabled={actionsDisabled || archived}
              leadingVisual={<Trash2 size={16} />}
              variant="danger"
            >
              보관
            </ActionMenuItem>
          </ConfirmationDialog>
        </ActionMenuContent>
      </ActionMenu>
    </div>
  );
}

function AutomationNameCell({ rule }) {
  return (
    <span className="automation-name-cell">
      <AutomationRowIcon />
      <span className="automation-name-copy">
        <span className="automation-name-text">{rule.name || '이름 없는 자동화'}</span>
      </span>
    </span>
  );
}

function AutomationRuleEventCell({ rule }) {
  const eventName = rule.eventDefinition?.displayName || rule.eventDefinition?.eventKey || '이벤트';

  return (
    <span className="automation-rule-stack-cell">
      <span className="automation-rule-primary">{eventName}</span>
    </span>
  );
}

function AutomationRuleTemplateCell({ rule }) {
  return (
    <span className="automation-rule-stack-cell">
      <span className="automation-rule-primary">
        <Badge tone="neutral">{formatAutomationSendChannel(rule.sendChannel)}</Badge>
      </span>
      <span className="automation-rule-code" title={rule.templateCode} translate="no">
        {rule.templateCode || '-'}
      </span>
    </span>
  );
}

function AutomationStatusChip({ status }) {
  const normalizedStatus = ['archived', 'enabled'].includes(status) ? status : 'disabled';

  return (
    <span className={`automation-status-chip is-${normalizedStatus}`}>
      {AUTOMATION_STATUS_LABELS[normalizedStatus]}
    </span>
  );
}

function AutomationTablePagination({ table, total }) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = Math.max(table.getPageCount(), 1);
  const pageNumber = Math.min(pageIndex + 1, pageCount);

  function changePageSize(event) {
    table.setPageSize(Number(event.target.value));
    table.setPageIndex(0);
  }

  return (
    <div className="automation-table-pagination">
      <span>
        페이지 {pageNumber} - {pageCount} / {total.toLocaleString('ko-KR')}개 자동화 -{' '}
        <span className="automation-page-size-select">
          <select aria-label="페이지당 자동화 수" onChange={changePageSize} value={pageSize}>
            {AUTOMATION_RULE_PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}개</option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={14} />
        </span>
      </span>
    </div>
  );
}

function AutomationRowIcon() {
  return (
    <span aria-hidden="true" className="automation-row-icon">
      <svg className="automation-row-icon-frame" fill="none" height="32" viewBox="0 0 32 32" width="32">
        <rect className="automation-row-icon-bg" height="32" rx="11" width="32" />
        <rect className="automation-row-icon-border" height="30" rx="10" width="30" x="1" y="1" />
        <g className="automation-row-icon-grid">
          <path d="M5.5 1v30M10.5 1v30M15.5 1v30M20.5 1v30M25.5 1v30" />
          <path d="M1 5.5h30M1 10.5h30M1 15.5h30M1 20.5h30M1 25.5h30" />
          <path d="M11 1h4v4h-4zM26 1h4v4h-4zM1 11h4v4H1zM21 11h4v4h-4zM26 16h4v4h-4zM6 21h4v4H6zM21 21h4v4h-4zM11 26h4v4h-4z" />
        </g>
      </svg>
      <svg className="automation-row-icon-mark" fill="currentColor" height="17" viewBox="0 0 32 32" width="17">
        <path
          clipRule="evenodd"
          d="M6 3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm0 2.5a.5.5 0 0 0-.5.5v6c0 .28.22.5.5.5h6a.5.5 0 0 0 .5-.5V6a.5.5 0 0 0-.5-.5H6ZM20 17h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Zm0 2.5a.5.5 0 0 0-.5.5v6c0 .28.22.5.5.5h6a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 0-.5-.5h-6ZM8 15v5a4 4 0 0 0 4 4h5v-2.5h-5a1.5 1.5 0 0 1-1.5-1.5v-5H8Z"
          fillRule="evenodd"
        />
      </svg>
    </span>
  );
}

function SelectableDataTable({ table }) {
  const { showToast } = useToast();
  const [firstColumn, ...otherColumns] = table.columns;
  const isRecipientTable = firstColumn === '수신자';
  const rows = useMemo(
    () => table.rows.map((cells) => ({ cells, id: cells.join('|') })),
    [table.rows]
  );
  const columns = [
    {
      accessor: (row) => row.cells[0],
      className: 'is-email-to',
      header: firstColumn,
      cell: ({ value }) => {
        const tone = getStatusTone(value);

        return (
          <span className="resend-email-subject-text">
            {tone ? <span className={`badge ${tone}`}>{value}</span> : value}
          </span>
        );
      },
    },
    ...otherColumns.map((column, index) => ({
      accessor: (row) => row.cells[index + 1],
      header: column,
      cell: ({ value }) => {
        const tone = getStatusTone(value);
        return tone ? <span className={`badge ${tone}`}>{value}</span> : value;
      },
    })),
  ];

  function notifyBulkAction(action, selectedRows, clearSelection) {
    showToast({
      description: '선택한 테이블 항목에 작업이 적용되었습니다.',
      title: `${selectedRows.length}개 항목 ${action}`,
      variant: 'success',
    });
    clearSelection();
  }

  return (
    <DataTableV2
      actionsClassName="is-email-actions table-actions"
      actionsHeaderClassName="is-email-actions"
      bulkActionBarProps={({ selectedRows }) => ({
        'aria-label': '선택 항목 작업',
        clearLabel: '선택 해제',
        countLabel: `${selectedRows.length}개 선택됨`,
      })}
      bulkActions={({ clearSelection, selectedRows }) => (
        <>
          <DataTableV2.BulkActionButton onClick={() => notifyBulkAction('비활성화됨', selectedRows, clearSelection)}>
          <Ban size={14} />
          비활성화
          </DataTableV2.BulkActionButton>
          <ConfirmationDialog
            confirmLabel="삭제"
            description="선택한 항목을 목록에서 제거합니다. 이 작업은 되돌릴 수 없습니다."
            destructive
            onConfirm={() => notifyBulkAction('삭제됨', selectedRows, clearSelection)}
            title="선택 항목 삭제?"
          >
            <DataTableV2.BulkActionButton danger>
              <Trash2 size={14} />
              삭제
            </DataTableV2.BulkActionButton>
          </ConfirmationDialog>
        </>
      )}
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      initialPageSize={SELECTABLE_TABLE_PAGE_SIZE_OPTIONS[0]}
      pagination={isRecipientTable}
      renderPagination={isRecipientTable ? ({ table: dataTable }) => (
        <SelectableDataTablePagination
          itemLabel="수신자"
          table={dataTable}
          total={rows.length}
          unit="명"
        />
      ) : undefined}
      rowActions={({ row }) => (
        <RowActionMenu
          label={row.cells[0]}
          onAction={(action) => showToast({
            description: `${row.cells[0]} 항목에 작업이 적용되었습니다.`,
            title: `${row.cells[0]} ${action}`,
            variant: action === '삭제됨' ? 'critical' : 'success',
          })}
        />
      )}
      selectable
      selectAllLabel="모든 행 선택"
      selectedRowLabel={({ row }) => `${row.cells[0]} 선택`}
      shellClassName="console-data-table-shell"
      tableClassName="console-data-table-v2"
    />
  );
}

function SelectableDataTablePagination({
  itemLabel,
  pageSizeOptions = SELECTABLE_TABLE_PAGE_SIZE_OPTIONS,
  table,
  total,
  unit = '개',
}) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = Math.max(table.getPageCount(), 1);
  const currentPage = Math.min(pageIndex + 1, pageCount);
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(total, currentPage * pageSize);

  function changePageSize(event) {
    table.setPageSize(Number(event.target.value));
    table.setPageIndex(0);
  }

  return (
    <div className="resend-email-pagination console-data-table-pagination">
      <p>
        <strong>{from}-{to}</strong>
        <span> / {total.toLocaleString('ko-KR')}{unit}</span>
        <span> - </span>
        <select
          aria-label={`페이지당 ${itemLabel} 수`}
          onChange={changePageSize}
          value={pageSize}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>{option}개</option>
          ))}
        </select>
      </p>
      <div>
        <button disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} type="button">
          이전
        </button>
        <button disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} type="button">
          다음
        </button>
      </div>
    </div>
  );
}

function RowActionMenu({ label, onAction }) {
  return (
    <ActionMenu>
      <ActionMenuTrigger asChild>
        <IconButton icon={MoreHorizontal} label={`${label} 작업 더보기`} />
      </ActionMenuTrigger>
      <ActionMenuContent align="end">
        <ActionMenuItem leadingVisual={<Copy size={16} />} onSelect={() => onAction('복제됨')}>
          복제
        </ActionMenuItem>
        <ActionMenuItem leadingVisual={<Pencil size={16} />} onSelect={() => onAction('이름 변경됨')}>
          이름 변경
        </ActionMenuItem>
        <ActionMenuSeparator />
        <ConfirmationDialog
          confirmLabel="삭제"
          description={`${label} 항목을 목록에서 제거합니다. 이 작업은 되돌릴 수 없습니다.`}
          destructive
          onConfirm={() => onAction('삭제됨')}
          title={`${label} 삭제?`}
        >
          <ActionMenuItem leadingVisual={<Trash2 size={16} />} variant="danger">
            삭제
          </ActionMenuItem>
        </ConfirmationDialog>
      </ActionMenuContent>
    </ActionMenu>
  );
}

function DocsPage({ meta }) {
  const navigation = useConsoleNavigation();
  const snippets = [
    {
      code: `curl -X POST https://api.resend.com/emails \\
  -H "Authorization: Bearer $RESEND_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"from":"onboarding@example.com","to":"user@example.com","subject":"Hello","html":"<p>Welcome</p>"}'`,
      label: 'cURL',
      language: 'bash',
      value: 'curl',
    },
    {
      code: `await resend.emails.send({
  from: 'onboarding@example.com',
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Welcome</p>',
});`,
      label: 'Node.js',
      language: 'javascript',
      value: 'node',
    },
  ];

  return (
    <section className="page-frame docs-page">
      <PageHeader title={meta.title} />
      <div className="docs-shell docs-light">
        <aside className="docs-page-sidebar" aria-label="문서 탐색">
          <Accordion defaultValue="sending">
            <AccordionItem value="sending">
              <AccordionTrigger>Sending</AccordionTrigger>
              <AccordionContent>
                <a href="#send-message">Send message</a>
                <a href="#events">Events</a>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="resources">
              <AccordionTrigger>Resources</AccordionTrigger>
              <AccordionContent>
                <a href="#next-steps">Next steps</a>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>

        <article className="docs-mdx-content docs-page-content">
          <DocsSection id="send-message" title="Send message">
            <p>Use a verified sender, recipient, subject, and body to create a transactional message.</p>
            <DocsCallout title="Sender required" variant="info">
              <p>Messages need a verified sender before production traffic is accepted.</p>
            </DocsCallout>
            <CodeGroup defaultValue="curl" items={snippets} />
          </DocsSection>

          <DocsSection id="events" title="Events">
            <p>Webhook events describe delivery changes such as sent, delivered, opened, bounced, and complained.</p>
            <DocsCallout title="Retries" variant="tip">
              <p>Keep webhook handlers idempotent so repeated delivery attempts can be processed safely.</p>
            </DocsCallout>
          </DocsSection>

          <DocsSection id="next-steps" title="Next steps">
            <DocsCardGrid>
              <DocsCard href={navigation.href('/message-send')} meta="Console" title="메시지 발송">
                문자와 카카오 메시지 발송 화면으로 이동합니다.
              </DocsCard>
              <DocsCard href={navigation.href('/logs')} meta="Dashboard" title="발송기록">
                발송 요청과 전달 결과를 확인합니다.
              </DocsCard>
            </DocsCardGrid>
          </DocsSection>
        </article>

        <aside className="docs-page-toc" aria-label="On this page">
          <strong>On this page</strong>
          <a href="#send-message">Send message</a>
          <a href="#events">Events</a>
          <a href="#next-steps">Next steps</a>
        </aside>
      </div>
    </section>
  );
}

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

function getVisibleSettingsTabs(isPublEmbed) {
  return isPublEmbed ? SETTINGS_TABS.filter((tab) => tab !== '프로필') : SETTINGS_TABS;
}
const SMS_SENDER_RESOURCE_TYPE = 'sms_send_no';
const KAKAO_SENDER_RESOURCE_TYPE = 'kakao_sender_key';
const PERSONAL_SENDER_EVIDENCE_FILES = [
  {
    helpLines: [
      '통신사에 따라 가입사실확인서, 서비스 이용증명서 등 다른 이름으로 발급될 수 있습니다.',
      '등록하려는 번호의 이용 사실과 가입자 정보가 확인되는 문서를 준비해 주세요.',
      '숨김 처리된 정보가 없어야 하며, 최근 3개월 이내 발급된 서류만 등록할 수 있습니다.',
    ],
    description: '최근 3개월 이내 발급된 서류만 등록할 수 있습니다.',
    helpTitle: '어떤 문서인가요?',
    id: 'telecom_certificate',
    label: '통신서비스 이용증명원',
  },
  {
    helpLines: [
      '번호 사용에 대한 동의를 확인하는 문서입니다.',
      '번호 명의자와 실제 이용 주체가 다를 때 특히 중요합니다.',
      '서명 또는 날인이 필요한 양식을 사용 중이라면 서명 완료본을 업로드해 주세요.',
    ],
    description: '발신번호 사용에 대한 동의 내용을 확인할 수 있는 문서를 업로드하세요.',
    helpTitle: '무엇을 확인하나요?',
    id: 'consent_document',
    label: '이용승낙서',
  },
  {
    helpLines: [
      '개인 번호는 본인 확인을 위해 번호 소유자의 신분증 사본이 필요합니다.',
      '주민등록번호 뒷자리는 반드시 마스킹된 상태여야 합니다.',
      '이름과 생년월일 앞자리 등 필요한 정보만 보이도록 편집한 뒤 제출해 주세요.',
    ],
    description: '번호 소유자의 신분증 사본을 업로드하세요. 주민등록번호 뒷자리는 반드시 가려 주세요.',
    helpTitle: '제출 시 주의사항',
    id: 'id_card_copy',
    label: '신분증 사본',
  },
];
const COMPANY_SENDER_EVIDENCE_FILES = [
  {
    helpLines: [
      '통신사에 따라 가입사실확인서, 서비스 이용증명서 등 다른 이름으로 발급될 수 있습니다.',
      '등록하려는 번호의 이용 사실과 가입자 정보가 확인되는 문서를 준비해 주세요.',
      '숨김 처리된 정보가 없어야 하며, 최근 3개월 이내 발급된 서류만 등록할 수 있습니다.',
    ],
    description: '최근 3개월 이내 발급된 서류만 등록할 수 있습니다.',
    helpTitle: '어떤 문서인가요?',
    id: 'telecom_certificate',
    label: '통신서비스 이용증명원',
  },
  {
    helpLines: [
      '번호 사용에 대한 동의를 확인하는 문서입니다.',
      '번호 명의자와 실제 이용 주체가 다를 때 특히 중요합니다.',
      '서명 또는 날인이 필요한 양식을 사용 중이라면 서명 완료본을 업로드해 주세요.',
    ],
    description: '발신번호 사용에 대한 동의 내용을 확인할 수 있는 문서를 업로드하세요.',
    helpTitle: '무엇을 확인하나요?',
    id: 'consent_document',
    label: '이용승낙서',
  },
  {
    helpLines: [
      '발신번호 명의 사업자의 정보를 확인하는 문서입니다.',
      '사업자명과 사업자등록번호가 확인되는 사본을 준비해 주세요.',
    ],
    description: '번호 명의자의 사업자등록증을 업로드하세요.',
    helpTitle: '무엇을 확인하나요?',
    id: 'business_registration',
    label: '번호 명의 사업자등록증',
  },
  {
    helpLines: [
      '번호 명의 사업자와 신청 사업자 간의 관계를 확인하는 문서입니다.',
      '계약서, 위임장, 관계 확인 공문처럼 번호 사용 권한을 설명할 수 있는 문서를 준비해 주세요.',
    ],
    description: '번호 명의 사업자와 신청 사업자 간의 관계를 확인할 수 있는 문서를 업로드하세요.',
    helpTitle: '어떤 문서인가요?',
    id: 'relationship_proof',
    label: '사업자와 타사 간 관계 확인 문서',
  },
];
const ADDITIONAL_SENDER_EVIDENCE_FILE = {
  helpLines: [
    '운영자가 보완을 요청한 추가 자료를 제출할 때 사용합니다.',
    '기존 필수 서류는 유지되며, 필요한 서류만 변경하거나 보완 자료를 더 올릴 수 있습니다.',
  ],
  description: '보완 요청을 받은 추가 자료가 있다면 업로드하세요.',
  helpTitle: '언제 사용하나요?',
  id: 'additional_document',
  label: '기타서류',
};
const ADMIN_APPLICATION_STATUS_OPTIONS = [
  { label: '검수 대기', value: 'submitted' },
  { label: '전체', value: 'all' },
  { label: '승인됨', value: 'approved' },
  { label: '반려됨', value: 'rejected' },
];
const EVIDENCE_DOCUMENT_LABELS = {
  telecom_certificate: '통신서비스 이용증명원',
  consent_document: '이용승낙서',
  id_card_copy: '신분증 사본',
  business_registration: '번호 명의 사업자등록증',
  relationship_proof: '사업자와 타사 간 관계 확인 문서',
  additional_document: '추가서류',
};

function AdminSenderResourceApplicationsPage() {
  const { showToast } = useToast();
  const [activeAdminTab, setActiveAdminTab] = useState(ADMIN_REQUEST_TAB_VALUES.LIMIT_REQUESTS);
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const actorQuery = useCurrentActorQuery();
  const queryFilters = useMemo(() => ({
    resourceType: SMS_SENDER_RESOURCE_TYPE,
    status: statusFilter === 'all' ? undefined : statusFilter,
  }), [statusFilter]);
  const applicationsQuery = useAdminSenderResourceApplicationsQuery(queryFilters, {
    enabled: actorQuery.data?.user?.isOperator === true
      && activeAdminTab === ADMIN_REQUEST_TAB_VALUES.SENDER_APPLICATIONS,
  });
  const lookupMutation = useAdminSmsSendNoLookupMutation();
  const approveMutation = useAdminSenderResourceApplicationApproveMutation();
  const rejectMutation = useAdminSenderResourceApplicationRejectMutation();
  const applications = useMemo(() => (
    Array.isArray(applicationsQuery.data?.applications) ? applicationsQuery.data.applications : []
  ), [applicationsQuery.data]);
  const filteredApplications = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return applications;
    }

    return applications.filter((application) => {
      const haystack = [
        application.requestedValue,
        application.user?.email,
        application.user?.name,
        application.user?.userRef,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [applications, searchTerm]);
  const selectedApplication = applications.find((application) => application.id === selectedApplicationId) ?? null;
  const lookupResult = lookupMutation.data;
  const canApprove = Boolean(
    selectedApplication
    && selectedApplication.status === 'submitted'
    && lookupResult?.usable
    && !approveMutation.isPending
  );
  const pageError = applicationsQuery.isError
    ? getRelayErrorMessage(applicationsQuery.error, '신청 목록을 불러오지 못했습니다.')
    : '';
  const actorError = actorQuery.isError
    ? getRelayErrorMessage(actorQuery.error, '현재 계정 정보를 확인하지 못했습니다.')
    : '';

  function changeAdminTab(nextTab) {
    setActiveAdminTab(nextTab);
    closeApplication();
  }

  function openApplication(application) {
    setSelectedApplicationId(application.id);
    setRejectDialogOpen(false);
    setRejectReason('');
    lookupMutation.reset();
    approveMutation.reset();
    rejectMutation.reset();
  }

  function closeApplication() {
    setSelectedApplicationId(null);
    setRejectDialogOpen(false);
    setRejectReason('');
    lookupMutation.reset();
    approveMutation.reset();
    rejectMutation.reset();
  }

  async function lookupNhnSendNo() {
    if (!selectedApplication || lookupMutation.isPending) {
      return;
    }

    await lookupMutation.mutateAsync(selectedApplication.id).catch(() => {});
  }

  async function approveApplication() {
    if (!selectedApplication || !canApprove) {
      return;
    }

    try {
      await approveMutation.mutateAsync({
        applicationId: selectedApplication.id,
        payload: {},
      });
      showToast({
        description: formatSettingsPhoneNumber(selectedApplication.requestedValue),
        title: '발신번호를 승인했습니다',
      });
      closeApplication();
    } catch {
      // The drawer renders the mutation error near the action buttons.
    }
  }

  async function rejectApplication(event) {
    event.preventDefault();

    if (!selectedApplication || !rejectReason.trim() || rejectMutation.isPending) {
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        applicationId: selectedApplication.id,
        payload: {
          rejectReason: rejectReason.trim(),
        },
      });
      showToast({
        description: formatSettingsPhoneNumber(selectedApplication.requestedValue),
        title: '발신번호 신청을 반려했습니다',
      });
      closeApplication();
    } catch {
      // The dialog renders the mutation error below the textarea.
    }
  }

  if (actorQuery.isPending) {
    return (
      <section className="page-frame admin-sender-page">
        <PageHeader title="신청 관리" />
        <Panel className="admin-state-panel">
          <span className="admin-state-row">
            <Circle aria-hidden="true" size={18} />
            관리자 권한을 확인하는 중입니다.
          </span>
        </Panel>
      </section>
    );
  }

  if (actorQuery.data?.user && !actorQuery.data.user.isOperator) {
    return (
      <section className="page-frame admin-sender-page">
        <PageHeader title="신청 관리" />
        <EmptyState
          copy="이 화면은 운영자 권한이 있는 계정에서만 사용할 수 있습니다."
          icon={ShieldCheck}
          title="관리자 권한이 필요합니다"
        />
      </section>
    );
  }

  return (
    <section className="page-frame admin-sender-page">
      <PageHeader title="신청 관리" />

      <AdminRequestTabs onValueChange={changeAdminTab} value={activeAdminTab} />

      {actorError ? (
        <div className="message-send-api-status admin-sender-status" data-tone="critical" role="alert">
          <span>{actorError}</span>
          <Button onClick={() => actorQuery.refetch()}>다시 시도</Button>
        </div>
      ) : null}

      {activeAdminTab === ADMIN_REQUEST_TAB_VALUES.LIMIT_REQUESTS ? (
        <div className="admin-request-tab-panel" role="tabpanel">
          <AdminLimitIncreaseRequestsPanel enabled={actorQuery.data?.user?.isOperator === true} />
        </div>
      ) : null}

      {activeAdminTab === ADMIN_REQUEST_TAB_VALUES.SENDER_APPLICATIONS ? (
        <div className="admin-request-tab-panel" role="tabpanel">
          <div className="admin-sender-toolbar">
            <SearchField
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="번호, 이메일, 이름 검색"
              value={searchTerm}
            />
            <FilterSelect
              label="상태"
              onValueChange={setStatusFilter}
              options={ADMIN_APPLICATION_STATUS_OPTIONS}
              value={statusFilter}
            />
            <Button
              disabled={applicationsQuery.isFetching}
              onClick={() => applicationsQuery.refetch()}
              variant="secondary"
            >
              <RefreshCcw aria-hidden="true" size={15} />
              새로고침
            </Button>
          </div>

          {pageError ? (
            <div className="message-send-api-status admin-sender-status" data-tone="critical" role="alert">
              <span>{pageError}</span>
              <Button onClick={() => applicationsQuery.refetch()}>다시 시도</Button>
            </div>
          ) : null}

          <DataTableV2
            actionsClassName="is-email-actions table-actions"
            actionsHeaderClassName="is-email-actions"
            columns={[
              {
                accessor: (application) => formatSettingsPhoneNumber(application.requestedValue),
                header: '발신번호',
                cell: ({ value }) => <strong>{value}</strong>,
              },
              { accessor: (application) => getSenderNumberTypeLabel(application.senderNumberType), header: '유형' },
              {
                accessor: (application) => application,
                header: '신청자',
                cell: ({ value: application }) => (
                  <span className="admin-table-user">
                    <strong>{application.user?.email ?? '이메일 없음'}</strong>
                    <small>{application.user?.name || application.user?.userRef || application.userId}</small>
                  </span>
                ),
              },
              {
                accessor: (application) => application.status,
                header: '상태',
                cell: ({ value }) => (
                  <Badge tone={getAdminApplicationStatusTone(value)}>
                    {getAdminApplicationStatusLabel(value)}
                  </Badge>
                ),
              },
              { accessor: (application) => formatAdminDateTime(application.createdAt), header: '신청일' },
            ]}
            data={applicationsQuery.isPending ? [] : filteredApplications}
            empty={<span className="admin-empty-row">조건에 맞는 신청이 없습니다.</span>}
            getRowId={(application) => application.id}
            loading={applicationsQuery.isPending}
            loadingSlot={(
              <span className="admin-state-row">
                <Circle aria-hidden="true" size={18} />
                신청 목록을 불러오는 중입니다.
              </span>
            )}
            rowActions={({ row }) => (
              <Button onClick={() => openApplication(row)} variant="secondary">
                검토
              </Button>
            )}
            shellClassName="admin-sender-table-shell"
            tableClassName="admin-sender-table"
          />
        </div>
      ) : null}

      <AdminSenderApplicationDrawer
        application={selectedApplication}
        approveError={approveMutation.isError
          ? getRelayErrorMessage(approveMutation.error, '승인하지 못했습니다.')
          : ''}
        approvePending={approveMutation.isPending}
        canApprove={canApprove}
        lookupError={lookupMutation.isError
          ? getRelayErrorMessage(lookupMutation.error, 'NHN 발신번호 상태를 조회하지 못했습니다.')
          : ''}
        lookupPending={lookupMutation.isPending}
        lookupResult={lookupResult}
        onApprove={approveApplication}
        onClose={closeApplication}
        onLookup={lookupNhnSendNo}
        onRejectOpen={() => {
          rejectMutation.reset();
          setRejectReason('');
          setRejectDialogOpen(true);
        }}
        rejectPending={rejectMutation.isPending}
      />

      <AdminRejectDialog
        error={rejectMutation.isError
          ? getRelayErrorMessage(rejectMutation.error, '반려하지 못했습니다.')
          : ''}
        onOpenChange={setRejectDialogOpen}
        onReasonChange={setRejectReason}
        onSubmit={rejectApplication}
        open={rejectDialogOpen}
        pending={rejectMutation.isPending}
        reason={rejectReason}
      />
    </section>
  );
}

function AdminSenderApplicationDrawer({
  application,
  approveError,
  approvePending,
  canApprove,
  lookupError,
  lookupPending,
  lookupResult,
  onApprove,
  onClose,
  onLookup,
  onRejectOpen,
  rejectPending,
}) {
  const isSubmitted = application?.status === 'submitted';
  const approvalHint = getApprovalHint({ application, lookupResult, lookupPending });
  const evidenceFiles = Array.isArray(application?.evidenceFiles) ? application.evidenceFiles : [];
  const primaryEvidenceFiles = evidenceFiles.filter((file) => file.documentType !== 'additional_document');
  const additionalEvidenceFiles = evidenceFiles.filter((file) => file.documentType === 'additional_document');

  return (
    <Drawer open={Boolean(application)} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DrawerContent className="admin-application-drawer">
        {application ? (
          <>
            <DrawerHeader>
              <DrawerTitle>{formatSettingsPhoneNumber(application.requestedValue)}</DrawerTitle>
              <DrawerDescription>
                {getSenderNumberTypeLabel(application.senderNumberType)} · {getAdminApplicationStatusLabel(application.status)}
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <SectionPanel title="신청 정보">
                <div className="admin-detail-grid">
                  <AdminDetailItem label="신청자" value={application.user?.email ?? application.userId} />
                  <AdminDetailItem label="이름" value={application.user?.name || '-'} />
                  <AdminDetailItem label="User ref" value={application.user?.userRef || '-'} />
                  <AdminDetailItem label="신청일" value={formatAdminDateTime(application.createdAt)} />
                  <AdminDetailItem label="검토일" value={formatAdminDateTime(application.reviewedAt)} />
                  <AdminDetailItem label="반려 사유" value={application.rejectReason || '-'} />
                </div>
              </SectionPanel>

              <SectionPanel
                className="admin-evidence-panel"
                description="서류는 운영자 검수 후 승인 시 삭제되고, 반려 시 보관 만료일 이후 삭제 대상이 됩니다."
                title="제출 서류"
              >
                <div aria-label="제출 서류 목록" className="admin-evidence-list" tabIndex={0}>
                  {primaryEvidenceFiles.map((file) => (
                    <AdminEvidenceFileRow applicationId={application.id} file={file} key={file.id} />
                  ))}
                </div>
              </SectionPanel>

              {additionalEvidenceFiles.length ? (
                <SectionPanel
                  bodyClassName="admin-additional-evidence-body"
                  className="admin-evidence-panel admin-additional-evidence-panel"
                  description="사용자가 보완 과정에서 추가 제출한 서류입니다."
                  title="추가서류"
                >
                  <div
                    aria-label="추가서류 목록"
                    className="admin-evidence-list admin-additional-evidence-list"
                    tabIndex={0}
                  >
                    {additionalEvidenceFiles.map((file) => (
                      <AdminEvidenceFileRow applicationId={application.id} file={file} key={file.id} />
                    ))}
                  </div>
                </SectionPanel>
              ) : null}

              <SectionPanel
                description="NHN SMS에 같은 발신번호가 등록되어 있고 사용 가능하며 차단되지 않은 경우에만 승인할 수 있습니다."
                title="NHN 발신번호 상태"
              >
                <AdminNhnLookupPanel
                  error={lookupError}
                  lookupResult={lookupResult}
                  onLookup={onLookup}
                  pending={lookupPending}
                />
              </SectionPanel>

              {approveError ? (
                <div className="message-send-api-status admin-sender-status" data-tone="critical" role="alert">
                  <span>{approveError}</span>
                </div>
              ) : null}
            </DrawerBody>
            <DrawerFooter>
              <span className="admin-approval-hint">{approvalHint}</span>
              <Button
                disabled={!isSubmitted || rejectPending || approvePending}
                onClick={onRejectOpen}
                variant="danger"
              >
                반려
              </Button>
              <Button
                disabled={!canApprove}
                onClick={onApprove}
                variant="primary"
              >
                {approvePending ? '승인 중' : '승인'}
              </Button>
            </DrawerFooter>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function AdminNhnLookupPanel({ error, lookupResult, onLookup, pending }) {
  const status = lookupResult?.status ?? 'unchecked';

  return (
    <div className="admin-nhn-lookup">
      <div className="admin-nhn-lookup-main" data-status={error ? 'error' : status}>
        <NhnLookupStatusIcon error={Boolean(error)} pending={pending} status={status} />
        <span>
          <strong>{getNhnLookupTitle({ error, pending, status })}</strong>
          <small>{getNhnLookupDescription({ error, lookupResult, pending, status })}</small>
        </span>
      </div>
      <Button disabled={pending} onClick={onLookup} variant="secondary">
        <RefreshCcw aria-hidden="true" size={15} />
        {pending ? '조회 중' : 'NHN 상태 조회'}
      </Button>
      {lookupResult?.row ? (
        <div className="admin-nhn-meta">
          <span>useYn {lookupResult.row.useYn ?? '-'}</span>
          <span>blockYn {lookupResult.row.blockYn ?? '-'}</span>
          <span>serviceId {lookupResult.row.serviceId ?? '-'}</span>
        </div>
      ) : null}
    </div>
  );
}

function NhnLookupStatusIcon({ error, pending, status }) {
  if (pending) {
    return <RefreshCcw aria-hidden="true" size={20} />;
  }

  if (error) {
    return <AlertTriangle aria-hidden="true" size={20} />;
  }

  if (status === 'usable') {
    return <CheckCircle2 aria-hidden="true" size={20} />;
  }

  if (status === 'blocked' || status === 'unusable') {
    return <XCircle aria-hidden="true" size={20} />;
  }

  return <ShieldCheck aria-hidden="true" size={20} />;
}

function AdminDetailItem({ label, value }) {
  return (
    <span className="admin-detail-item">
      <small>{label}</small>
      <strong>{value || '-'}</strong>
    </span>
  );
}

function AdminEvidenceFileRow({ applicationId, file }) {
  return (
    <div className="admin-evidence-row">
      <span className="admin-evidence-icon">
        <FileText aria-hidden="true" size={18} />
      </span>
      <span className="admin-evidence-copy">
        <strong>{EVIDENCE_DOCUMENT_LABELS[file.documentType] ?? file.documentType}</strong>
        <small>{file.originalFileName} · {formatFileSize(file.byteSize)}</small>
      </span>
      <a
        className="button secondary admin-evidence-download"
        href={`/api/admin/sender-resource-applications/${encodeURIComponent(applicationId)}/evidence-files/${encodeURIComponent(file.id)}/download`}
      >
        <Download aria-hidden="true" size={15} />
        다운로드
      </a>
    </div>
  );
}

function AdminRejectDialog({
  error,
  onOpenChange,
  onReasonChange,
  onSubmit,
  open,
  pending,
  reason,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-reject-dialog" size="small">
        <DialogHeader>
          <DialogTitle>신청 반려</DialogTitle>
          <DialogDescription>운영자가 확인한 반려 사유를 입력하세요.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <DialogBody>
            <label className="admin-reject-field" htmlFor="admin-reject-reason">
              <span>반려 사유</span>
              <textarea
                className="admin-review-textarea"
                id="admin-reject-reason"
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder="예: 통신서비스 이용증명원 발급일이 3개월을 초과했습니다."
                rows={5}
                value={reason}
              />
            </label>
            {error ? (
              <div className="message-send-api-status admin-sender-status" data-tone="critical" role="alert">
                <span>{error}</span>
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button disabled={pending} onClick={() => onOpenChange(false)} variant="secondary">
              취소
            </Button>
            <Button disabled={!reason.trim() || pending} type="submit" variant="danger">
              {pending ? '반려 중' : '반려'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getApprovalHint({ application, lookupPending, lookupResult }) {
  if (!application) {
    return '';
  }

  if (application.status !== 'submitted') {
    return '이미 검토가 완료된 신청입니다.';
  }

  if (lookupPending) {
    return 'NHN 상태를 확인하는 중입니다.';
  }

  if (!lookupResult) {
    return 'NHN 상태 조회 후 승인할 수 있습니다.';
  }

  if (lookupResult.usable) {
    return 'NHN에서 사용 가능한 발신번호로 확인되었습니다.';
  }

  return 'NHN에서 사용 가능한 상태가 아니므로 승인할 수 없습니다.';
}

function getNhnLookupTitle({ error, pending, status }) {
  if (pending) {
    return 'NHN 상태 조회 중';
  }

  if (error) {
    return 'NHN 조회 실패';
  }

  if (status === 'usable') {
    return '사용 가능';
  }

  if (status === 'not_registered') {
    return 'NHN 미등록';
  }

  if (status === 'blocked') {
    return '차단된 발신번호';
  }

  if (status === 'unusable') {
    return '사용 불가';
  }

  return '조회 전';
}

function getNhnLookupDescription({ error, lookupResult, pending, status }) {
  if (pending) {
    return '등록 여부와 차단 여부를 확인하고 있습니다.';
  }

  if (error) {
    return error;
  }

  if (status === 'usable') {
    return 'useYn=Y, blockYn=N 조건을 만족합니다.';
  }

  if (status === 'not_registered') {
    return `${formatSettingsPhoneNumber(lookupResult?.sendNo)} 번호를 NHN에서 찾지 못했습니다.`;
  }

  if (status === 'blocked') {
    return lookupResult?.row?.blockReason || 'NHN에서 차단된 번호입니다.';
  }

  if (status === 'unusable') {
    return 'NHN 등록 정보가 사용 가능 조건을 만족하지 않습니다.';
  }

  return '승인 전 NHN 상태 조회를 실행하세요.';
}

function getSenderNumberTypeLabel(value) {
  if (value === 'company') {
    return '회사번호';
  }

  if (value === 'personal') {
    return '개인번호';
  }

  return value || '-';
}

function getAdminApplicationStatusLabel(status) {
  if (status === 'submitted') {
    return '검수 대기';
  }

  if (status === 'approved') {
    return '승인됨';
  }

  if (status === 'rejected') {
    return '반려됨';
  }

  if (status === 'canceled') {
    return '취소됨';
  }

  return status || '-';
}

function getAdminApplicationStatusTone(status) {
  if (status === 'approved') {
    return 'green';
  }

  if (status === 'rejected' || status === 'canceled') {
    return 'critical';
  }

  return 'neutral';
}

function formatAdminDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatFileSize(value) {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes < 0) {
    return '용량 정보 없음';
  }

  if (bytes < 1024) {
    return `${bytes}B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function SettingsPage() {
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
      {activeTab === '사용량' ? <UsageSettingsContent /> : null}
      {activeTab === SETTINGS_SENDER_RESOURCE_TAB ? <SenderResourceSettings /> : null}
      {activeTab === '프로필' && !isPublEmbed ? <ProfileSettingsContent /> : null}
      {activeTab !== '사용량' && activeTab !== SETTINGS_SENDER_RESOURCE_TAB && (activeTab !== '프로필' || isPublEmbed) ? (
        <SettingsPlaceholder title={activeTab} />
      ) : null}
    </section>
  );
}

function SenderResourceSettings() {
  const navigation = useConsoleNavigation();
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
        onAction={() => navigation.push('/settings/sender-resources/sms/new')}
        onDefaultSelect={() => showPendingToast('기본 발신번호')}
        onResubmit={(item) => navigation.push(`/settings/sender-resources/sms/new?applicationId=${encodeURIComponent(item.applicationId)}`)}
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
        onAction={() => navigation.push('/settings/sender-resources/kakao/new')}
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

function SenderResourceApplicationPage({ type }) {
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
