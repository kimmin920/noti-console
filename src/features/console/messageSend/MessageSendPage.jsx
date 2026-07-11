'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { PageHeader } from '../../../components/layout/index.js';
import { AlimtalkPreview, AlimtalkSendForm, BrandMessageSendForm, Button, defaultAlimtalkSendFormValue, defaultBrandMessageSendFormValue, defaultSmsSendFormValue, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState, FormField, getSmsSendFormMessageType, getBrandMessageTemplateRegistrationIssues, getBrandMessageValidationIssues, NhnBrandMessagePreview, Panel, SegmentedControl, SmsPreview, SmsSendForm, useToast } from '../../../components/ui/index.js';
import { getRelayErrorMessage } from './api.js';
import { DEV_SMS_BULK_SIMULATION_SENDER_ID, DEV_SMS_BULK_SIMULATION_SENDER_OPTION, getDevSmsBulkSimulationConfig, getSmsBulkSimulationPayloadMessage, toSmsBulkSimulationRunPayload } from './bulkSimulation.js';
import { getAlimtalkSenderProfiles, getResolvedSenderOptionValue, getSmsSenderOptions, getTemplateOptions } from './mappers.js';
import { useAlimtalkSendMutation, useBrandImageUploadMutation, useBrandMessageSendMutation, useBrandTemplateCreateMutation, useSmsBulkSendRunMutation, useSmsSendMutation } from './mutations.js';
import { applyBrandImageUploadResult, buildAlimtalkSendPayload, buildBrandImageUploadFormData, buildBrandMessageSendPayload, buildBrandTemplateRegistrationPayload, buildSmsSendPayload, getBrandImageUploadTargets, MessageSendValidationError } from './payloads.js';
import { useAlimtalkTemplatesQuery, useBrandTemplatesQuery, useSenderResourcesQuery, useActiveSmsBulkSendRunsQuery, useSmsTemplatesQuery } from './queries.js';
import { MESSAGE_STATUS_TOAST_ID, showMessageReservationAcceptedToast, showMessageStatusResultToast, showMessageStatusSubmitToast } from './statusToast.js';
import { getBrandImageUploadFailureMessage } from './uploadErrors.js';
import { getReservationsHrefForChannel, shouldShowSmsReservationAcceptedToast } from './reservationRouting.js';
import { getSmsBulkSendRunToastView } from './smsBulkSendRunToast.js';
import { messageLogQueryKeys } from '../messageLogs/queryKeys.js';
import { buildTabQueryHref, getMessageSendTabFromQuery, getMessageSendTabQueryValue } from '../tabQuery.js';
import { useConsoleNavigation } from '../ConsoleNavigationContext.jsx';
import { usePublMessageRecipients } from '../../publClient/usePublMessageRecipients.js';

const BRAND_TEMPLATE_REGISTRATION_NAME_MAX_LENGTH = 200;

export function SmsBulkSendRunWatcher() {
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

export function MessageSendPage({ meta, onDocs }) {
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
    navigation.replace(
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
