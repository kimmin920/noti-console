'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  FileText,
  Image as ImageIcon,
  MessageSquareText,
} from 'lucide-react';
import {
  Badge,
  Button,
  FileUploadField,
  FormField,
  ImageCropDialog,
  Notice,
  SmsPreview,
  ValidationChecklist,
  useToast,
} from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import { useConsoleNavigation } from '../ConsoleNavigationContext.jsx';
import { getSmsSenderOptions } from '../messageSend/mappers.js';
import { useSenderResourcesQuery } from '../messageSend/queries.js';
import {
  SMS_TEMPLATE_CREATE_FIELD_IDS,
  SMS_TEMPLATE_MESSAGE_TYPES,
  SMS_TEMPLATE_REGISTRATION_LIMITS,
  applySmsTemplateIdChange,
  applySmsTemplateNameChange,
  buildSmsTemplateCreatePayloadWithUploadedAttachments,
  getSmsTemplateCreateModel,
  validateSmsTemplateCreateSubmissionDraft,
} from './smsTemplateCreateModel.js';
import {
  useSmsTemplateAttachmentUploadMutation,
  useSmsTemplateCreateMutation,
} from './queries.js';

const IMAGE_ACCEPT = 'image/jpeg,image/jpg,image/png';
const MAX_MMS_IMAGE_COUNT = 3;
const MAX_MMS_IMAGE_BYTES = 300 * 1024;
const MAX_MMS_IMAGE_DIMENSION = 1000;
const SMS_TEMPLATE_CATEGORY_LABEL = 'NOTI / 사용자별 카테고리';

const INITIAL_DRAFT = {
  attachFileIdList: [],
  body: '',
  senderResourceId: '',
  templateDesc: '',
  templateId: '',
  templateName: '',
  title: '',
  useYn: 'Y',
};

export function SmsTemplateCreatePage({ onBack }) {
  const navigation = useConsoleNavigation();
  const { showToast } = useToast();
  const senderResourcesQuery = useSenderResourcesQuery();
  const attachmentUploadMutation = useSmsTemplateAttachmentUploadMutation();
  const createTemplateMutation = useSmsTemplateCreateMutation();
  const [draft, setDraft] = useState(INITIAL_DRAFT);
  const [mmsPreviewFiles, setMmsPreviewFiles] = useState([]);
  const [cropFile, setCropFile] = useState(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [localSubmitResult, setLocalSubmitResult] = useState(null);
  const previewUrlsRef = useRef(new Set());
  const smsSenderOptions = useMemo(
    () => getSmsSenderOptions(senderResourcesQuery.data),
    [senderResourcesQuery.data]
  );
  const selectedSenderResourceId = getResolvedSmsSenderResourceId(draft.senderResourceId, smsSenderOptions);
  const modelDraft = useMemo(() => ({
    ...draft,
    senderResourceId: selectedSenderResourceId,
  }), [draft, selectedSenderResourceId]);
  const pendingMmsUploadCount = useMemo(
    () => mmsPreviewFiles.filter((file) => file.file).length,
    [mmsPreviewFiles]
  );
  const model = useMemo(() => getSmsTemplateCreateModel(modelDraft, {
    pendingAttachmentUploadCount: pendingMmsUploadCount,
  }), [modelDraft, pendingMmsUploadCount]);
  const isMms = model.messageType === SMS_TEMPLATE_MESSAGE_TYPES.MMS;
  const uploadableMmsPreviewFiles = useMemo(
    () => mmsPreviewFiles.filter((file) => file.file),
    [mmsPreviewFiles]
  );
  const submissionValidation = useMemo(() => validateSmsTemplateCreateSubmissionDraft(modelDraft, {
    pendingAttachmentUploadCount: uploadableMmsPreviewFiles.length,
  }), [modelDraft, uploadableMmsPreviewFiles.length]);
  const errors = submissionValidation.errors;
  const isSubmitting = attachmentUploadMutation.isPending || createTemplateMutation.isPending;
  const hasUnsavedChanges = useMemo(
    () => isSmsTemplateDraftDirty(draft) || mmsPreviewFiles.length > 0,
    [draft, mmsPreviewFiles.length]
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

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
  }, []);

  function patchDraft(patch) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      ...patch,
    }));
    setLocalSubmitResult(null);
  }

  function handleTemplateNameChange(event) {
    setDraft((currentDraft) => applySmsTemplateNameChange(currentDraft, event.target.value));
    setLocalSubmitResult(null);
  }

  function handleTemplateIdChange(event) {
    setDraft((currentDraft) => applySmsTemplateIdChange(currentDraft, event.target.value));
    setLocalSubmitResult(null);
  }

  function handleMmsImageChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      setCropFile(file);
    }
  }

  function handleCropOpenChange(open) {
    if (!open) {
      setCropFile(null);
    }
  }

  function handleCropApply({ file, height, size, type, width }) {
    const previewUrl = URL.createObjectURL(file);
    previewUrlsRef.current.add(previewUrl);
    setMmsPreviewFiles((currentFiles) => [
      ...currentFiles,
      {
        file,
        fileName: file.name,
        height,
        id: createLocalFileId(file),
        metadata: [type, formatBytes(size), `${width}x${height}px`],
        previewAlt: '선택한 MMS 이미지',
        previewUrl,
        size,
        type,
        width,
      },
    ].slice(0, MAX_MMS_IMAGE_COUNT));
  }

  function removeMmsPreviewFile(fileId) {
    setMmsPreviewFiles((currentFiles) => {
      const removedFile = currentFiles.find((file) => file.id === fileId);

      if (removedFile?.previewUrl) {
        URL.revokeObjectURL(removedFile.previewUrl);
        previewUrlsRef.current.delete(removedFile.previewUrl);
      }

      return currentFiles.filter((file) => file.id !== fileId);
    });
  }

  async function submitTemplateRegistration(event) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setSubmitAttempted(true);
    setLocalSubmitResult(null);

    if (!submissionValidation.isValid) {
      focusFirstInvalidField(submissionValidation.firstInvalidFieldId);
      return;
    }

    const uploadedAttachments = [];
    let failedStage = isMms && uploadableMmsPreviewFiles.length ? 'upload' : 'create';

    try {
      if (isMms && uploadableMmsPreviewFiles.length) {
        setLocalSubmitResult({ stage: 'upload', status: 'pending' });

        for (const previewFile of uploadableMmsPreviewFiles) {
          const uploadResult = await attachmentUploadMutation.mutateAsync({
            file: previewFile.file,
            senderResourceId: modelDraft.senderResourceId,
          });
          uploadedAttachments.push(uploadResult);
        }
      }

      failedStage = 'create';
      setLocalSubmitResult({
        stage: 'create',
        status: 'pending',
        uploadedFileCount: uploadedAttachments.length,
      });

      const payload = buildSmsTemplateCreatePayloadWithUploadedAttachments(modelDraft, uploadedAttachments);
      const result = await createTemplateMutation.mutateAsync(payload);
      const templateCode = result.templateCode ?? result.template?.templateCode ?? payload.templateId;

      setLocalSubmitResult({
        stage: 'create',
        status: 'success',
        templateCode,
        uploadedFileCount: uploadedAttachments.length,
      });
      showToast({
        description: `${templateCode} 템플릿이 등록되었습니다.`,
        title: 'SMS 템플릿을 등록했습니다.',
        variant: 'success',
      });
      navigation.push('/templates?tab=sms');
    } catch (error) {
      setLocalSubmitResult({
        error,
        stage: failedStage,
        status: 'error',
        uploadedFileCount: uploadedAttachments.length,
      });
    }
  }

  function returnToList() {
    if (hasUnsavedChanges && !window.confirm('작성 중인 SMS 템플릿 초안이 사라집니다. 목록으로 이동할까요?')) {
      return;
    }

    if (onBack) {
      onBack();
      return;
    }

    navigation.push('/templates?tab=sms');
  }

  function goToSenderSetup() {
    if (hasUnsavedChanges && !window.confirm('작성 중인 SMS 템플릿 초안이 사라집니다. 발신번호 신청 화면으로 이동할까요?')) {
      return;
    }

    navigation.push('/settings/sender-resources/sms/new');
  }

  const previewValue = {
    body: model.body,
    imageAttachments: isMms ? mmsPreviewFiles : [],
    senderNumber: selectedSenderResourceId,
    variables: {},
  };
  const fieldError = (field) => (submitAttempted ? errors[field]?.join(' ') : '');

  return (
    <section className="page-frame sms-template-create-page">
      <div className="sms-template-create-header">
        <Button onClick={returnToList} variant="secondary">
          <ChevronLeft size={15} />
          템플릿 목록
        </Button>
        <div>
          <div className="sms-template-create-breadcrumb" aria-label="breadcrumb">
            <span>SMS 템플릿 목록</span>
            <span>›</span>
            <span>템플릿 등록</span>
          </div>
          <h1>새 SMS 템플릿 등록</h1>
        </div>
      </div>

      {senderResourcesQuery.isPending ? (
        <Notice className="sms-template-create-notice" role="status" title="발신번호 확인 중" variant="neutral">
          <p>템플릿을 등록할 수 있는 발신번호를 불러오고 있습니다.</p>
        </Notice>
      ) : null}

      {senderResourcesQuery.isError ? (
        <Notice
          action={<Button onClick={() => senderResourcesQuery.refetch()}>다시 시도</Button>}
          className="sms-template-create-notice"
          title="발신번호를 불러오지 못했습니다"
          urgent
          variant="critical"
        >
          <p>{getRelayErrorMessage(senderResourcesQuery.error, '발신 수단을 불러오지 못했습니다.')}</p>
        </Notice>
      ) : null}

      {!senderResourcesQuery.isPending && !senderResourcesQuery.isError && smsSenderOptions.length < 1 ? (
        <Notice
          action={<Button onClick={goToSenderSetup}>발신번호 신청</Button>}
          className="sms-template-create-notice"
          title="사용 가능한 SMS 발신번호가 없습니다"
          variant="warning"
        >
          <p>승인된 발신번호가 있어야 SMS, LMS, MMS 템플릿 초안을 검증할 수 있습니다.</p>
        </Notice>
      ) : null}

      <form className="sms-template-create-layout" id={SMS_TEMPLATE_CREATE_FIELD_IDS.form} onSubmit={submitTemplateRegistration}>
        <div className="sms-template-create-main">
          <section className="sms-template-create-card">
            <AutoMessageTypePanel
              model={model}
              pendingMmsUploadCount={pendingMmsUploadCount}
            />
          </section>

          <section className="sms-template-create-card">
            <h2>기본 정보</h2>
            <div className="sms-template-form-stack">
              <FormField.Root>
                <FormField.Label error={fieldError('senderResourceId')} htmlFor={SMS_TEMPLATE_CREATE_FIELD_IDS.senderResourceId} required>
                  발신번호
                </FormField.Label>
                <FormField.Control>
                  <FormField.Select
                    aria-invalid={fieldError('senderResourceId') ? 'true' : undefined}
                    autoComplete="off"
                    disabled={senderResourcesQuery.isPending || smsSenderOptions.length < 1}
                    id={SMS_TEMPLATE_CREATE_FIELD_IDS.senderResourceId}
                    name="senderResourceId"
                    onChange={(event) => patchDraft({ senderResourceId: event.target.value })}
                    value={selectedSenderResourceId}
                  >
                    {smsSenderOptions.length < 1 ? <option value="">발신번호 없음</option> : null}
                    {smsSenderOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </FormField.Select>
                  <FormField.Help>provider에 승인된 SMS 발신번호를 선택합니다.</FormField.Help>
                  {fieldError('senderResourceId') ? <FormField.Error>{fieldError('senderResourceId')}</FormField.Error> : null}
                </FormField.Control>
              </FormField.Root>

              <FormField.Root>
                <FormField.Label>
                  카테고리
                </FormField.Label>
                <FormField.Control>
                  <div className="sms-template-fixed-category" aria-label="SMS 템플릿 카테고리">
                    <span>{SMS_TEMPLATE_CATEGORY_LABEL}</span>
                  </div>
                  <FormField.Help>등록 시 서버가 현재 사용자 기준으로 지정합니다.</FormField.Help>
                </FormField.Control>
              </FormField.Root>

              <div className="sms-template-two-column">
                <FormField.Root>
                  <FormField.Label error={fieldError('templateName')} htmlFor={SMS_TEMPLATE_CREATE_FIELD_IDS.templateName} required>
                    템플릿 이름
                  </FormField.Label>
                  <FormField.Control>
                    <FormField.Input
                      aria-invalid={fieldError('templateName') ? 'true' : undefined}
                      autoComplete="off"
                      id={SMS_TEMPLATE_CREATE_FIELD_IDS.templateName}
                      maxLength={SMS_TEMPLATE_REGISTRATION_LIMITS.templateName}
                      name="templateName"
                      onChange={handleTemplateNameChange}
                      placeholder="픽업 알림"
                      value={draft.templateName}
                    />
                    <FormField.Help>내부 관리와 provider 목록에 표시되는 이름입니다.</FormField.Help>
                    {fieldError('templateName') ? <FormField.Error>{fieldError('templateName')}</FormField.Error> : null}
                  </FormField.Control>
                </FormField.Root>

                <FormField.Root>
                  <FormField.Label error={fieldError('templateId')} htmlFor={SMS_TEMPLATE_CREATE_FIELD_IDS.templateId} required>
                    템플릿 ID
                  </FormField.Label>
                  <FormField.Control>
                    <FormField.Input
                      aria-invalid={fieldError('templateId') ? 'true' : undefined}
                      autoComplete="off"
                      id={SMS_TEMPLATE_CREATE_FIELD_IDS.templateId}
                      maxLength={SMS_TEMPLATE_REGISTRATION_LIMITS.templateId}
                      name="templateId"
                      onChange={handleTemplateIdChange}
                      placeholder="SMS_PICKUP"
                      spellCheck={false}
                      translate="no"
                      value={draft.templateId}
                    />
                    <FormField.Help>영문, 숫자, 밑줄만 사용합니다.</FormField.Help>
                    {fieldError('templateId') ? <FormField.Error>{fieldError('templateId')}</FormField.Error> : null}
                  </FormField.Control>
                </FormField.Root>
              </div>

              <FormField.Root>
                <FormField.Label error={fieldError('templateDesc')} htmlFor={SMS_TEMPLATE_CREATE_FIELD_IDS.templateDesc}>
                  템플릿 설명
                </FormField.Label>
                <FormField.Control>
                  <FormField.Input
                    aria-invalid={fieldError('templateDesc') ? 'true' : undefined}
                    autoComplete="off"
                    id={SMS_TEMPLATE_CREATE_FIELD_IDS.templateDesc}
                    maxLength={SMS_TEMPLATE_REGISTRATION_LIMITS.templateDesc}
                    name="templateDesc"
                    onChange={(event) => patchDraft({ templateDesc: event.target.value })}
                    placeholder="픽업 코드 발송용 템플릿"
                    value={draft.templateDesc}
                  />
                  <FormField.Help>최대 {SMS_TEMPLATE_REGISTRATION_LIMITS.templateDesc}자까지 입력할 수 있습니다.</FormField.Help>
                  {fieldError('templateDesc') ? <FormField.Error>{fieldError('templateDesc')}</FormField.Error> : null}
                </FormField.Control>
              </FormField.Root>

              <FormField.Root>
                <FormField.Label error={fieldError('useYn')} htmlFor={SMS_TEMPLATE_CREATE_FIELD_IDS.useYn} required>
                  사용 여부
                </FormField.Label>
                <FormField.Control>
                  <FormField.Select
                    aria-invalid={fieldError('useYn') ? 'true' : undefined}
                    autoComplete="off"
                    id={SMS_TEMPLATE_CREATE_FIELD_IDS.useYn}
                    name="useYn"
                    onChange={(event) => patchDraft({ useYn: event.target.value })}
                    value={draft.useYn}
                  >
                    <option value="Y">사용</option>
                    <option value="N">미사용</option>
                  </FormField.Select>
                  {fieldError('useYn') ? <FormField.Error>{fieldError('useYn')}</FormField.Error> : null}
                </FormField.Control>
              </FormField.Root>
            </div>
          </section>

          <section className="sms-template-create-card">
            <h2>메시지 내용</h2>
            <div className="sms-template-form-stack">
              <FormField.Root>
                <FormField.Label error={fieldError('title')} htmlFor={SMS_TEMPLATE_CREATE_FIELD_IDS.title} required={model.messageType !== SMS_TEMPLATE_MESSAGE_TYPES.SMS}>
                  제목
                </FormField.Label>
                <FormField.Control>
                  <FormField.Input
                    aria-invalid={fieldError('title') ? 'true' : undefined}
                    autoComplete="off"
                    id={SMS_TEMPLATE_CREATE_FIELD_IDS.title}
                    maxLength={SMS_TEMPLATE_REGISTRATION_LIMITS.title}
                    name="title"
                    onChange={(event) => patchDraft({ title: event.target.value })}
                    placeholder="알림"
                    value={draft.title}
                  />
                  <FormField.Help>LMS/MMS 등록 시 제목이 필요합니다.</FormField.Help>
                  {fieldError('title') ? <FormField.Error>{fieldError('title')}</FormField.Error> : null}
                </FormField.Control>
              </FormField.Root>

              <FormField.Root>
                <FormField.Label
                  error={fieldError('body')}
                  htmlFor={SMS_TEMPLATE_CREATE_FIELD_IDS.body}
                  required
                >
                  본문
                </FormField.Label>
                <FormField.Control>
                  <FormField.Textarea
                    aria-invalid={fieldError('body') ? 'true' : undefined}
                    autoComplete="off"
                    id={SMS_TEMPLATE_CREATE_FIELD_IDS.body}
                    maxLength={SMS_TEMPLATE_REGISTRATION_LIMITS.body}
                    name="body"
                    onChange={(event) => patchDraft({ body: event.target.value })}
                    placeholder={'안녕하세요 ##name##님.\n픽업 코드 ##code##를 확인해 주세요.'}
                    rows={8}
                    value={draft.body}
                  />
                  <div className="sms-template-body-meta">
                    <FormField.Help>
                      SMS 변수는 <CodeToken>##variable##</CodeToken> 형식으로 작성합니다.
                    </FormField.Help>
                    <FormField.Counter invalid={Boolean(fieldError('body'))}>{model.bodyBytes}바이트</FormField.Counter>
                  </div>
                  {fieldError('body') ? <FormField.Error>{fieldError('body')}</FormField.Error> : null}
                </FormField.Control>
              </FormField.Root>

              <ExtractedVariableList variables={model.variables} />
            </div>
          </section>

          <MmsImageSection
            isSubmitting={isSubmitting}
            mmsPreviewFiles={mmsPreviewFiles}
            onFileChange={handleMmsImageChange}
            onRemovePreviewFile={removeMmsPreviewFile}
          />

          <section className="sms-template-create-card">
            <Notice icon={AlertTriangle} title="등록 전 확인" variant="warning">
              <ul className="sms-template-warning-list">
                <li>선택한 이미지는 템플릿 등록 전에 자동 업로드합니다.</li>
                <li>수신자 번호, 발송 예약, 전송 로그 필드는 템플릿 등록에 포함하지 않습니다.</li>
              </ul>
            </Notice>
            <ValidationChecklist items={getFinalChecklistItems({ errors, model })} />
            <div className="sms-template-submit-row">
              <Button disabled={isSubmitting || senderResourcesQuery.isPending || smsSenderOptions.length < 1} type="submit" variant="primary">
                {getSubmitButtonLabel(localSubmitResult, isSubmitting)}
              </Button>
            </div>
            {submitAttempted && !submissionValidation.isValid ? (
              <Notice title="검증이 필요한 항목" urgent variant="critical">
                <ul className="sms-template-error-list">
                  {Object.entries(errors).flatMap(([field, messages]) => (
                    messages.map((message) => <li key={`${field}-${message}`}>{message}</li>)
                  ))}
                </ul>
              </Notice>
            ) : null}
            {localSubmitResult?.status === 'pending' ? (
              <Notice role="status" title={getSubmitPendingTitle(localSubmitResult.stage)} variant="neutral">
                <p>{getSubmitPendingCopy(localSubmitResult)}</p>
              </Notice>
            ) : null}
            {localSubmitResult?.status === 'error' ? (
              <Notice title={getSubmitErrorTitle(localSubmitResult)} urgent variant="critical">
                <p>{getSubmitErrorCopy(localSubmitResult)}</p>
              </Notice>
            ) : null}
          </section>
        </div>

        <aside className="sms-template-preview-rail" aria-label="SMS 템플릿 미리보기">
          <SmsPreview senderNumbers={smsSenderOptions} value={previewValue} />
          <div className="sms-template-preview-summary">
            <span>전송유형 {model.providerSendType}</span>
            <span>{model.messageType}</span>
            {model.attachFileIdList?.length ? (
              <span><AttachmentCount count={model.attachFileIdList.length} /></span>
            ) : null}
            {pendingMmsUploadCount ? <span>업로드 대기 {pendingMmsUploadCount}개</span> : null}
          </div>
        </aside>
      </form>

      <ImageCropDialog
        description="MMS 템플릿 이미지 제약에 맞춰 자릅니다. 등록 시 이미지를 자동 업로드합니다."
        file={cropFile}
        onApply={handleCropApply}
        onOpenChange={handleCropOpenChange}
        open={Boolean(cropFile)}
        preset="SMS_MMS"
      />
    </section>
  );
}

function AutoMessageTypePanel({ model, pendingMmsUploadCount }) {
  const badgeTone = getMessageTypeBadgeTone(model.messageType);

  return (
    <>
      <div className="sms-template-section-header">
        <h2>등록 타입</h2>
      </div>

      <div className="sms-template-auto-type" id={SMS_TEMPLATE_CREATE_FIELD_IDS.messageType}>
        <div className="sms-template-auto-type-main">
          <span className="sms-template-auto-type-icon" aria-hidden="true">
            <MessageTypeIcon messageType={model.messageType} />
          </span>
          <div>
            <span className="sms-template-auto-type-label">{model.messageType}</span>
            <p>{getMessageTypeReason(model, pendingMmsUploadCount)}</p>
          </div>
        </div>
        <div className="sms-template-auto-type-meta">
          <Badge tone={badgeTone}>전송유형 {model.providerSendType}</Badge>
          <Badge>{model.bodyBytes}/{SMS_TEMPLATE_REGISTRATION_LIMITS.smsBytes}바이트</Badge>
          {model.attachFileIdList.length ? <Badge><AttachmentCount count={model.attachFileIdList.length} /></Badge> : null}
          {pendingMmsUploadCount ? <Badge>업로드 대기 {pendingMmsUploadCount}개</Badge> : null}
        </div>
      </div>

      {model.messageType === SMS_TEMPLATE_MESSAGE_TYPES.SMS && model.variables.length > 0 ? (
        <p className="sms-template-auto-type-note">
          변수 값이 길어져 실제 본문이 {SMS_TEMPLATE_REGISTRATION_LIMITS.smsBytes}바이트를 넘으면 LMS 과금이 적용될 수 있습니다.
        </p>
      ) : null}
    </>
  );
}

function MessageTypeIcon({ messageType }) {
  if (messageType === SMS_TEMPLATE_MESSAGE_TYPES.MMS) {
    return <ImageIcon size={16} />;
  }

  if (messageType === SMS_TEMPLATE_MESSAGE_TYPES.LMS) {
    return <FileText size={16} />;
  }

  return <MessageSquareText size={16} />;
}

function ExtractedVariableList({ variables }) {
  if (variables.length < 1) {
    return null;
  }

  return (
    <div className="sms-template-variable-section">
      <div className="sms-template-variable-header">
        <span>추출된 변수</span>
      </div>
      <div className="sms-template-variable-token-list" aria-label="추출된 SMS 변수" role="list" translate="no">
        {variables.map((variable) => (
          <span className="sms-template-variable-token" key={variable.key} role="listitem">
            <CodeToken>{variable.token}</CodeToken>
          </span>
        ))}
      </div>
    </div>
  );
}

function MmsImageSection({
  isSubmitting,
  mmsPreviewFiles,
  onFileChange,
  onRemovePreviewFile,
}) {
  const fileChecklist = getMmsImageChecklist(mmsPreviewFiles);
  const uploadStatus = getMmsPreviewStatus(mmsPreviewFiles, fileChecklist);
  const imageDescriptionIds = [
    mmsPreviewFiles.length ? 'sms-template-mms-image-checks' : null,
    uploadStatus ? 'sms-template-mms-image-status' : null,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <section className="sms-template-create-card">
      <div className="sms-template-section-header">
        <div>
          <h2>이미지</h2>
          <p>이미지는 등록 시 자동 업로드합니다.</p>
        </div>
      </div>

      <div className="sms-template-form-stack">
        <FormField.Root>
          <FormField.Label htmlFor={SMS_TEMPLATE_CREATE_FIELD_IDS.attachFileIdList}>
            이미지 미리보기
          </FormField.Label>
          <FormField.Control>
            <FileUploadField
              accept={IMAGE_ACCEPT}
              actionLabel="이미지 선택"
              aria-describedby={imageDescriptionIds}
              disabled={isSubmitting || mmsPreviewFiles.length >= MAX_MMS_IMAGE_COUNT}
              emptyDescription="JPG, PNG · 최대 3개 · 업로드 전 로컬 미리보기"
              emptyLabel="선택된 이미지 없음"
              files={mmsPreviewFiles}
              id={SMS_TEMPLATE_CREATE_FIELD_IDS.attachFileIdList}
              name="mmsPreviewImage"
              onFileChange={onFileChange}
              onRemoveFile={onRemovePreviewFile}
            />
            {mmsPreviewFiles.length ? <ValidationChecklist id="sms-template-mms-image-checks" items={fileChecklist} /> : null}
            {uploadStatus ? (
              <p className="sms-template-upload-status" data-state={uploadStatus.state} id="sms-template-mms-image-status" role={uploadStatus.state === 'error' ? 'alert' : 'status'}>
                {uploadStatus.message}
              </p>
            ) : null}
          </FormField.Control>
        </FormField.Root>
      </div>
    </section>
  );
}

function CodeToken({ children }) {
  return (
    <code className="sms-template-code-token" translate="no">
      {children}
    </code>
  );
}

function AttachmentCount({ count }) {
  return (
    <span className="sms-template-attachment-count">
      <span>첨부 이미지</span>
      <span>{count}개</span>
    </span>
  );
}

function getResolvedSmsSenderResourceId(value, options) {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';

  if (normalizedValue && options.some((option) => option.value === normalizedValue)) {
    return normalizedValue;
  }

  return options[0]?.value ?? '';
}

function getFinalChecklistItems({ errors, model }) {
  return [
    {
      checked: !errors.senderResourceId?.length,
      error: Boolean(errors.senderResourceId?.length),
      errorLabel: errors.senderResourceId?.join(' '),
      id: 'sms-template-check-sender',
      label: '승인된 SMS 발신번호 선택',
    },
    {
      checked: !errors.templateName?.length && !errors.templateId?.length,
      error: Boolean(errors.templateName?.length || errors.templateId?.length),
      errorLabel: [
        ...(errors.templateName ?? []),
        ...(errors.templateId ?? []),
      ].join(' '),
      id: 'sms-template-check-basic',
      label: '템플릿 이름, ID 입력',
    },
    {
      checked: !errors.title?.length && !errors.body?.length,
      error: Boolean(errors.title?.length || errors.body?.length),
      errorLabel: [
        ...(errors.title ?? []),
        ...(errors.body ?? []),
      ].join(' '),
      id: 'sms-template-check-content',
      label: `${model.messageType} 메시지 내용 검증`,
    },
    {
      checked: model.messageType !== SMS_TEMPLATE_MESSAGE_TYPES.MMS || !errors.attachFileIdList?.length,
      error: Boolean(errors.attachFileIdList?.length),
      errorLabel: errors.attachFileIdList?.join(' '),
      id: 'sms-template-check-attachments',
      label: model.messageType === SMS_TEMPLATE_MESSAGE_TYPES.MMS
        ? 'MMS 이미지 준비'
        : 'MMS 이미지 요구사항 없음',
    },
  ];
}

function getMessageTypeBadgeTone(messageType) {
  if (messageType === SMS_TEMPLATE_MESSAGE_TYPES.MMS) {
    return 'yellow';
  }

  if (messageType === SMS_TEMPLATE_MESSAGE_TYPES.LMS) {
    return 'blue';
  }

  return 'neutral';
}

function getMessageTypeReason(model, pendingMmsUploadCount) {
  const fileIdCount = model.attachFileIdList.length;
  const imageCount = fileIdCount + pendingMmsUploadCount;

  if (model.messageType === SMS_TEMPLATE_MESSAGE_TYPES.MMS) {
    return `이미지 ${imageCount}개`;
  }

  if (model.messageType === SMS_TEMPLATE_MESSAGE_TYPES.LMS) {
    return `본문 ${model.bodyBytes}바이트 · SMS 기준 ${SMS_TEMPLATE_REGISTRATION_LIMITS.smsBytes}바이트 초과`;
  }

  return `본문 ${model.bodyBytes}/${SMS_TEMPLATE_REGISTRATION_LIMITS.smsBytes}바이트 · 이미지 없음`;
}

function getMmsImageChecklist(files) {
  const hasTooManyFiles = files.length > MAX_MMS_IMAGE_COUNT;
  const invalidFile = files.find((file) => {
    const isJpeg = file.type === 'image/jpeg';
    const sizeOk = Number(file.size) <= MAX_MMS_IMAGE_BYTES;
    const dimensionOk = Number(file.width) <= MAX_MMS_IMAGE_DIMENSION
      && Number(file.height) <= MAX_MMS_IMAGE_DIMENSION;

    return !isJpeg || !sizeOk || !dimensionOk;
  });

  return [
    {
      checked: files.length > 0 && !hasTooManyFiles,
      error: hasTooManyFiles,
      errorLabel: `이미지는 최대 ${MAX_MMS_IMAGE_COUNT}개까지 확인할 수 있습니다.`,
      id: 'sms-template-mms-count',
      label: `최대 ${MAX_MMS_IMAGE_COUNT}개`,
    },
    {
      checked: files.length > 0 && files.every((file) => file.type === 'image/jpeg'),
      error: Boolean(invalidFile && invalidFile.type !== 'image/jpeg'),
      errorLabel: 'MMS 이미지는 JPEG 파일로 등록합니다.',
      id: 'sms-template-mms-type',
      label: 'JPEG 변환 확인',
    },
    {
      checked: files.length > 0 && files.every((file) => Number(file.size) <= MAX_MMS_IMAGE_BYTES),
      error: Boolean(invalidFile && Number(invalidFile.size) > MAX_MMS_IMAGE_BYTES),
      errorLabel: '이미지는 300KB 이하여야 합니다.',
      id: 'sms-template-mms-size',
      label: '300KB 이하',
    },
    {
      checked: files.length > 0 && files.every((file) => (
        Number(file.width) <= MAX_MMS_IMAGE_DIMENSION && Number(file.height) <= MAX_MMS_IMAGE_DIMENSION
      )),
      error: Boolean(invalidFile && (
        Number(invalidFile.width) > MAX_MMS_IMAGE_DIMENSION || Number(invalidFile.height) > MAX_MMS_IMAGE_DIMENSION
      )),
      errorLabel: '이미지는 1000x1000px 이하여야 합니다.',
      id: 'sms-template-mms-dimensions',
      label: '1000x1000px 이하',
    },
  ];
}

function getMmsPreviewStatus(files, checklist) {
  if (files.length < 1) {
    return null;
  }

  if (checklist.some((item) => item.error)) {
    return {
      message: '이미지 제약을 통과하지 못했습니다. 다른 파일로 다시 선택해 주세요.',
      state: 'error',
    };
  }

  return null;
}

function getSubmitButtonLabel(submitResult, isSubmitting) {
  if (!isSubmitting) {
    return '템플릿 등록';
  }

  if (submitResult?.stage === 'upload') {
    return '이미지 업로드 중…';
  }

  return '템플릿 등록 중…';
}

function getSubmitPendingTitle(stage) {
  return stage === 'upload' ? 'MMS 이미지 업로드 중…' : '템플릿 등록 요청 중…';
}

function getSubmitPendingCopy(submitResult) {
  if (submitResult.stage === 'upload') {
    return '선택한 MMS 이미지를 업로드하고 있습니다.';
  }

  if (submitResult.uploadedFileCount > 0) {
    return '이미지 업로드가 완료되어 템플릿 등록 요청을 전송하고 있습니다.';
  }

  return '검증된 템플릿 등록 요청을 전송하고 있습니다.';
}

function getSubmitErrorTitle(submitResult) {
  return submitResult.stage === 'upload' ? 'MMS 이미지 업로드 실패' : '템플릿 등록 실패';
}

function getSubmitErrorCopy(submitResult) {
  const message = getRelayErrorMessage(submitResult.error, '템플릿 등록 요청을 처리할 수 없습니다.');

  if (submitResult.stage === 'upload') {
    return `MMS 이미지 업로드 단계에서 중단되었습니다. ${message}`;
  }

  if (submitResult.uploadedFileCount > 0) {
    return `이미지 업로드는 완료됐지만 템플릿 등록 단계에서 실패했습니다. ${message}`;
  }

  return `템플릿 등록 단계에서 실패했습니다. ${message}`;
}

function focusFirstInvalidField(fieldId) {
  if (!fieldId) {
    return;
  }

  window.requestAnimationFrame(() => {
    const target = document.getElementById(fieldId);
    const focusTarget = target?.matches('input, select, textarea, button, [tabindex]')
      ? target
      : target?.querySelector('input, select, textarea, button, [tabindex]');

    focusTarget?.focus();
  });
}

function isSmsTemplateDraftDirty(draft) {
  return Object.entries(INITIAL_DRAFT).some(([key, value]) => {
    if (Array.isArray(value)) {
      return Array.isArray(draft[key]) && draft[key].length > 0;
    }

    if (value && typeof value === 'object') {
      return Object.keys(draft[key] ?? {}).length > 0;
    }

    return draft[key] !== value;
  });
}

function createLocalFileId(file) {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${file.name}-${file.size}-${suffix}`;
}

function formatBytes(bytes) {
  const size = Number(bytes);

  if (!Number.isFinite(size) || size < 0) {
    return '';
  }

  if (size >= 1024 * 1024) {
    return `${Math.round((size / (1024 * 1024)) * 10) / 10}MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))}KB`;
}
