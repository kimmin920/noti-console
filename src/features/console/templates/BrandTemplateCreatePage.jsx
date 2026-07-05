'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import {
  BrandMessageSendForm,
  Button,
  defaultBrandMessageSendFormValue,
  FormField,
  getBrandMessageTemplateRegistrationIssues,
  NhnBrandMessagePreview,
  Notice,
  Panel,
  useToast,
} from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import {
  getAlimtalkSenderProfiles,
  getResolvedSenderOptionValue,
  getSmsSenderOptions,
  getTemplateOptions,
} from '../messageSend/mappers.js';
import {
  useBrandImageUploadMutation,
  useBrandTemplateCreateMutation,
} from '../messageSend/mutations.js';
import {
  useBrandTemplatesQuery,
  useSenderResourcesQuery,
} from '../messageSend/queries.js';
import {
  applyBrandImageUploadResult,
  buildBrandImageUploadFormData,
  buildBrandTemplateRegistrationPayload,
  getBrandImageUploadTargets,
  MessageSendValidationError,
} from '../messageSend/payloads.js';
import { getBrandImageUploadFailureMessage } from '../messageSend/uploadErrors.js';

const BRAND_TEMPLATE_REGISTRATION_NAME_MAX_LENGTH = 200;

export function BrandTemplateCreatePage({ onBack }) {
  const router = useRouter();
  const { showToast } = useToast();
  const senderResourcesQuery = useSenderResourcesQuery();
  const brandImageUploadMutation = useBrandImageUploadMutation();
  const brandTemplateCreateMutation = useBrandTemplateCreateMutation();
  const [brandMessage, setBrandMessage] = useState(defaultBrandMessageSendFormValue);
  const [brandCarouselPreviewTarget, setBrandCarouselPreviewTarget] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [templateNameError, setTemplateNameError] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitState, setSubmitState] = useState(null);
  const formRef = useRef(null);
  const templateNameRef = useRef(null);
  const kakaoSenderProfiles = useMemo(
    () => getAlimtalkSenderProfiles(senderResourcesQuery.data),
    [senderResourcesQuery.data]
  );
  const smsSenderOptions = useMemo(
    () => getSmsSenderOptions(senderResourcesQuery.data),
    [senderResourcesQuery.data]
  );
  const senderProfileId = getResolvedSenderOptionValue(brandMessage.senderProfileId, kakaoSenderProfiles);
  const brandTemplatesQuery = useBrandTemplatesQuery(senderProfileId);
  const brandTemplates = useMemo(
    () => getTemplateOptions(brandTemplatesQuery.data),
    [brandTemplatesQuery.data]
  );
  const brandFormValue = useMemo(() => ({
    ...brandMessage,
    fallbackSenderNumber: brandMessage.fallbackSenderNumber || smsSenderOptions[0]?.value || '',
    senderProfileId,
  }), [brandMessage, senderProfileId, smsSenderOptions]);
  const registrationIssues = useMemo(
    () => getBrandMessageTemplateRegistrationIssues(brandFormValue),
    [brandFormValue]
  );
  const isSubmitting = brandImageUploadMutation.isPending || brandTemplateCreateMutation.isPending;
  const hasUnsavedChanges = useMemo(
    () => isBrandTemplateDraftDirty(brandMessage, templateName),
    [brandMessage, templateName]
  );

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined;
    }

    function warnBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warnBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  function handleTemplateNameChange(event) {
    const nextName = event.target.value;

    setTemplateName(nextName);
    setSubmitState(null);

    if (templateNameError) {
      setTemplateNameError(getBrandTemplateRegistrationNameIssue(nextName));
    }
  }

  async function submitTemplateRegistration(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setSubmitAttempted(true);
    setSubmitState(null);

    const nextNameIssue = getBrandTemplateRegistrationNameIssue(templateName);

    if (nextNameIssue) {
      setTemplateNameError(nextNameIssue);
      templateNameRef.current?.focus();
      return;
    }

    setTemplateNameError('');

    if (registrationIssues.length > 0) {
      formRef.current?.revealValidation();
      setSubmitState({
        message: registrationIssues[0].message,
        stage: 'validate',
        status: 'error',
        title: '템플릿 등록 설정 필요',
      });
      return;
    }

    let failedStage = getBrandImageUploadTargets(brandFormValue).length > 0 ? 'upload' : 'create';

    try {
      setSubmitState({
        stage: failedStage,
        status: 'pending',
      });

      const nextBrandMessage = await uploadBrandImagesIfNeeded(brandFormValue, {
        brandImageUploadMutation,
      });

      if (nextBrandMessage !== brandFormValue) {
        setBrandMessage(nextBrandMessage);
      }

      failedStage = 'create';
      setSubmitState({
        stage: 'create',
        status: 'pending',
      });

      const payload = buildBrandTemplateRegistrationPayload(nextBrandMessage, {
        templateName,
      });
      const result = await brandTemplateCreateMutation.mutateAsync(payload);
      const templateCode = result?.templateCode ?? result?.template?.templateCode;

      showToast({
        description: templateCode ? `템플릿 코드 ${templateCode}로 등록되었습니다.` : '브랜드 메시지 템플릿이 등록되었습니다.',
        title: '템플릿 등록 완료',
        variant: 'success',
      });
      router.push('/templates?tab=brand');
    } catch (error) {
      const message = getBrandTemplateCreateErrorMessage(error, '브랜드 메시지 템플릿을 등록하지 못했습니다.');

      setSubmitState({
        error,
        message,
        stage: failedStage,
        status: 'error',
        title: getBrandTemplateCreateErrorTitle(error, failedStage),
      });
      showToast({
        description: message,
        title: getBrandTemplateCreateErrorTitle(error, failedStage),
        variant: 'critical',
      });
    }
  }

  function returnToList() {
    if (hasUnsavedChanges && !window.confirm('작성 중인 브랜드 메시지 템플릿 초안이 사라집니다. 목록으로 이동할까요?')) {
      return;
    }

    if (onBack) {
      onBack();
      return;
    }

    router.push('/templates?tab=brand');
  }

  function goToSenderSetup() {
    if (hasUnsavedChanges && !window.confirm('작성 중인 브랜드 메시지 템플릿 초안이 사라집니다. 발신 채널 설정 화면으로 이동할까요?')) {
      return;
    }

    router.push('/settings/sender-resources/kakao/new');
  }

  const visibleNameError = submitAttempted ? templateNameError || getBrandTemplateRegistrationNameIssue(templateName) : '';
  const visibleValidationIssue = submitAttempted ? registrationIssues[0] : null;

  return (
    <section className="page-frame brand-template-create-page">
      <div className="sms-template-create-header brand-template-create-header">
        <Button onClick={returnToList} variant="secondary">
          <ChevronLeft size={15} />
          템플릿 목록
        </Button>
        <div>
          <div className="sms-template-create-breadcrumb" aria-label="breadcrumb">
            <span>브랜드 메시지 템플릿 목록</span>
            <span>›</span>
            <span>템플릿 등록</span>
          </div>
          <h1>새 브랜드 메시지 템플릿 등록</h1>
        </div>
      </div>

      {senderResourcesQuery.isPending ? (
        <Notice className="brand-template-create-notice" role="status" title="발신 채널 확인 중" variant="neutral">
          <p>템플릿을 등록할 수 있는 카카오 발신 채널을 불러오고 있습니다.</p>
        </Notice>
      ) : null}

      {senderResourcesQuery.isError ? (
        <Notice
          action={<Button onClick={() => senderResourcesQuery.refetch()}>다시 시도</Button>}
          className="brand-template-create-notice"
          title="발신 채널을 불러오지 못했습니다"
          urgent
          variant="critical"
        >
          <p>{getRelayErrorMessage(senderResourcesQuery.error, '발신 채널을 불러오지 못했습니다.')}</p>
        </Notice>
      ) : null}

      {!senderResourcesQuery.isPending && !senderResourcesQuery.isError && kakaoSenderProfiles.length < 1 ? (
        <Notice
          action={<Button onClick={goToSenderSetup}>발신 채널 연결</Button>}
          className="brand-template-create-notice"
          title="브랜드 발신 채널이 없습니다"
          variant="warning"
        >
          <p>승인된 카카오 발신 채널이 있어야 브랜드 메시지 템플릿을 등록할 수 있습니다.</p>
        </Notice>
      ) : null}

      {brandTemplatesQuery.isError ? (
        <Notice
          action={<Button onClick={() => brandTemplatesQuery.refetch()}>다시 시도</Button>}
          className="brand-template-create-notice"
          title="기존 브랜드 템플릿을 불러오지 못했습니다"
          variant="warning"
        >
          <p>{getRelayErrorMessage(brandTemplatesQuery.error, '기존 템플릿을 불러오지 못했습니다.')}</p>
        </Notice>
      ) : null}

      {submitState?.status === 'pending' ? (
        <Notice className="brand-template-create-notice" role="status" title={submitState.stage === 'upload' ? '이미지 업로드 중' : '템플릿 등록 중'} variant="neutral">
          <p>{submitState.stage === 'upload' ? '브랜드 메시지 이미지를 NHN에 업로드하고 있습니다.' : '작성한 프리스타일 초안을 템플릿으로 등록하고 있습니다.'}</p>
        </Notice>
      ) : null}

      {submitState?.status === 'error' ? (
        <Notice className="brand-template-create-notice" title={submitState.title} urgent variant="critical">
          <p>{submitState.message}</p>
        </Notice>
      ) : null}

      <form className="brand-template-create-form" onSubmit={submitTemplateRegistration}>
        <section className="brand-template-create-card">
          <div className="brand-template-create-card-header">
            <h2>기본 정보</h2>
            <span>프리스타일 초안을 발신 채널 템플릿으로 저장합니다.</span>
          </div>
          <FormField.Root>
            <FormField.Label error={visibleNameError} htmlFor="brand-template-create-name" required>
              템플릿 이름
            </FormField.Label>
            <FormField.Control>
              <FormField.Input
                aria-invalid={visibleNameError ? 'true' : undefined}
                autoComplete="off"
                id="brand-template-create-name"
                maxLength={BRAND_TEMPLATE_REGISTRATION_NAME_MAX_LENGTH}
                onChange={handleTemplateNameChange}
                placeholder="예: 7월 멤버십 혜택 안내"
                ref={templateNameRef}
                value={templateName}
              />
              <FormField.Help>목록에 표시되는 이름입니다.</FormField.Help>
              {visibleNameError ? <FormField.Error>{visibleNameError}</FormField.Error> : null}
              <FormField.Counter
                current={Array.from(templateName.trim()).length}
                invalid={Boolean(visibleNameError)}
                max={BRAND_TEMPLATE_REGISTRATION_NAME_MAX_LENGTH}
              />
            </FormField.Control>
          </FormField.Root>
        </section>

        {visibleValidationIssue ? (
          <Notice className="brand-template-create-notice" title="메시지 구성을 확인해 주세요" variant="warning">
            <p>{visibleValidationIssue.message}</p>
          </Notice>
        ) : null}

        <Panel className="message-send-compose-panel message-send-brand-panel brand-template-create-panel" padded={false}>
          <div className="message-send-compose-layout message-send-brand-layout brand-template-create-compose-layout">
            <div className="message-send-brand-form-column">
              <BrandMessageSendForm
                compositionPurpose="template-registration"
                fallbackSenderNumbers={smsSenderOptions}
                onChange={setBrandMessage}
                onCarouselPreviewTargetChange={setBrandCarouselPreviewTarget}
                onFallbackSenderNumberCreate={() => router.push('/settings/sender-resources/sms/new')}
                onSenderProfileCreate={goToSenderSetup}
                ref={formRef}
                recipientContacts={[]}
                recipients={[]}
                senderProfileCreateLabel="발신채널 추가하기"
                senderProfiles={kakaoSenderProfiles}
                templates={brandTemplates}
                value={brandFormValue}
              />
            </div>
            <div className="message-send-brand-preview-column">
              <NhnBrandMessagePreview
                carouselTarget={brandCarouselPreviewTarget}
                senderProfiles={kakaoSenderProfiles}
                templates={brandTemplates}
                value={brandFormValue}
              />
            </div>
          </div>
        </Panel>

        <div className="brand-template-create-actions">
          <Button disabled={isSubmitting} onClick={returnToList}>
            취소
          </Button>
          <Button disabled={isSubmitting || kakaoSenderProfiles.length < 1} type="submit" variant="primary">
            {isSubmitting ? '등록 중...' : '템플릿 추가'}
          </Button>
        </div>
      </form>
    </section>
  );
}

async function uploadBrandImagesIfNeeded(message, { brandImageUploadMutation }) {
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

function getBrandTemplateCreateErrorMessage(error, fallbackMessage) {
  if (error instanceof MessageSendValidationError) {
    return error.message;
  }

  return getRelayErrorMessage(error, fallbackMessage);
}

function getBrandTemplateCreateErrorTitle(error, stage) {
  if (error instanceof MessageSendValidationError && error.title) {
    return error.title;
  }

  return stage === 'upload' ? '브랜드 이미지 업로드 실패' : '템플릿 등록 실패';
}

function isBrandTemplateDraftDirty(message, templateName) {
  return Boolean(
    String(templateName ?? '').trim()
    || message.senderProfileId
    || message.content
    || message.header
    || message.additionalContent
    || message.image
    || message.imageFile
    || message.item
    || message.video
    || message.commerce
    || message.carousel
    || message.adult
    || message.templateCode
    || message.mode !== defaultBrandMessageSendFormValue.mode
    || message.chatBubbleType !== defaultBrandMessageSendFormValue.chatBubbleType
    || JSON.stringify(message.buttons) !== JSON.stringify(defaultBrandMessageSendFormValue.buttons)
  );
}
