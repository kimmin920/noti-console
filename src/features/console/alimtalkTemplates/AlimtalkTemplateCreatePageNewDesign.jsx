'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  Image as ImageIcon,
  ListTree,
  MessageSquareText,
  Plus,
  Trash2,
  Type,
} from 'lucide-react';
import {
  Button,
  Checkbox,
  ChoiceCardGroup,
  FileUploadField,
  FormField,
  ImageCropDialog,
  KakaoTemplatePreview,
  Notice,
  ValidationChecklist,
  useToast,
} from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import { useConsoleNavigation } from '../ConsoleNavigationContext.jsx';
import { getAlimtalkSenderProfiles } from '../messageSend/mappers.js';
import { useSenderResourcesQuery } from '../messageSend/queries.js';
import {
  useAlimtalkTemplateCreateMutation,
  useAlimtalkTemplateImageUploadMutation,
} from '../templates/queries.js';
import {
  DEFAULT_ALIMTALK_IMAGE_CHECKS,
  DEFAULT_HIGHLIGHT_THUMBNAIL_CHECKS,
  createAlimtalkImagePatch,
  createAlimtalkImageReadFailurePatch,
  createHighlightThumbnailPatch,
  createHighlightThumbnailReadFailurePatch,
} from './alimtalkTemplateImageState.js';
import {
  ALIMTALK_TEMPLATE_ADD_CHANNEL_BUTTON_TYPE,
  ALIMTALK_TEMPLATE_BUTTON_MAX_COUNT,
  ALIMTALK_TEMPLATE_BUTTON_MAX_WITH_QUICK_REPLIES,
  ALIMTALK_TEMPLATE_QUICK_REPLY_MAX_COUNT,
  getAlimtalkTemplateActionRuleState,
  getAlimtalkTemplateButtonLimit,
} from './alimtalkTemplateActionRules.js';
import {
  getAlimtalkTemplateMaxContentLength,
  validateAlimtalkTemplateAdvancedSections,
  validateAlimtalkTemplateContent,
} from './alimtalkTemplateValidation.js';

const IMAGE_ACCEPT = 'image/jpeg,image/jpg,image/png';
const TEMPLATE_CODE_MAX_LENGTH = 20;
const TEMPLATE_CODE_PATTERN = /^[A-Z0-9_]+$/;

const ALIMTALK_TEMPLATE_CREATE_FIELD_IDS = Object.freeze({
  form: 'alimtalk-template-form',
  senderResourceId: 'alimtalk-template-sender-resource',
  templateCode: 'alimtalk-template-code',
  templateName: 'new-template-name',
});

const BUTTON_TYPES = [
  ['AC', '채널추가'],
  ['WL', '웹링크'],
  ['AL', '앱링크 (URL Scheme)'],
  ['DS', '배송조회'],
  ['BK', '봇키워드'],
  ['MD', '메시지전달'],
  ['BC', '상담톡전환'],
  ['BT', '봇전환'],
];

const QUICK_REPLY_TYPES = [
  ['WL', '웹링크'],
  ['AL', '앱링크 (URL Scheme)'],
  ['BK', '봇키워드'],
  ['BC', '상담톡전환'],
  ['BT', '봇전환'],
];

const BUTTON_ACTION_FIELD_SETS = {
  AL: [
    {
      aliases: ['linkAnd'],
      autocomplete: 'off',
      field: 'schemeAndroid',
      label: 'Android 앱 링크',
      placeholder: 'myapp://path',
      required: true,
    },
    {
      aliases: ['linkIos'],
      autocomplete: 'off',
      field: 'schemeIos',
      label: 'iOS 앱 링크',
      placeholder: 'myapp://path',
      required: true,
    },
  ],
  BC: [
    {
      autocomplete: 'off',
      field: 'chatExtra',
      label: '메타정보',
      placeholder: 'chatExtra',
    },
  ],
  BT: [
    {
      autocomplete: 'off',
      field: 'chatExtra',
      label: '메타정보',
      placeholder: 'chatExtra',
    },
    {
      autocomplete: 'off',
      field: 'chatEvent',
      label: '봇 이벤트명',
      placeholder: 'chatEvent',
      required: true,
    },
  ],
  WL: [
    {
      field: 'linkMo',
      label: '모바일 링크',
      placeholder: 'https://m.example.com',
      required: true,
      type: 'url',
    },
    {
      field: 'linkPc',
      label: 'PC 링크',
      placeholder: 'https://example.com',
      type: 'url',
    },
  ],
};

const QUICK_REPLY_ACTION_FIELD_SETS = {
  AL: BUTTON_ACTION_FIELD_SETS.AL,
  WL: BUTTON_ACTION_FIELD_SETS.WL,
};

const TEMPLATE_TYPE_OPTIONS = [
  {
    description: '특별한 강조 없이 글자만 포함하는 알림톡을 발송할 때 사용합니다.\n간단한 알림이나 안내문구 등 정갈한 안내 표현이 가능합니다.',
    icon: MessageSquareText,
    label: '기본형',
    meta: '텍스트',
    summary: '일반 안내 메시지',
    value: 'NONE',
  },
  {
    description: '알림톡에 강조 제목을 표기합니다.\n강조 하고싶은 문구가 있는 경우 주로 사용하며, 수신자에게 중요한 내용을 바로 인지시킬 수 있습니다.',
    icon: Type,
    label: '강조표기형',
    meta: '제목',
    summary: '제목을 크게 표시',
    value: 'TEXT',
  },
  {
    description: '알림톡에 이미지를 첨부합니다.\n차별화된 브랜딩을 제공하고 싶은 경우 주로 사용하며, 완성도 높은 메시지를 전달하여 기업 신뢰도를 한층 높일 수 있습니다.',
    icon: ImageIcon,
    label: '이미지첨부형',
    meta: '필수 업로드',
    summary: '이미지 필수',
    value: 'IMAGE',
  },
  {
    description: '알림톡에 리스트를 추가합니다.\n영수증이나 구매물품 등 항목 표현이 필요한 경우 주로 사용하며, 표 형식으로 출력되어 정리된 정보를 한눈에 볼 수 있습니다.',
    icon: ListTree,
    label: '리스트형',
    meta: '선택 섹션',
    summary: '항목 정보 표시',
    value: 'ITEM_LIST',
  },
];

const TEMPLATE_TYPE_CHOICE_OPTIONS = TEMPLATE_TYPE_OPTIONS.map(({ description, summary, ...option }) => ({
  ...option,
  description: summary,
}));

const REJECTION_CONSTRAINTS = [
  '알림톡은 광고를 발송할 수 없습니다.',
  '수신 대상과 발송 사유가 명확해야 합니다.',
  '혜택을 조건으로 개인정보 수집 등 특정 행위를 유도할 수 없습니다.',
  '앱 설치를 유도하는 내용을 포함할 수 없습니다.',
];

const INITIAL_TEMPLATE = {
  buttons: [],
  emphasizeSubtitle: '',
  emphasizeTitle: '',
  emphasizeType: 'NONE',
  extraText: '',
  header: '',
  highlighThumbnailImageUrl: '',
  highlightDescription: '',
  highlightThumbnailCheckList: null,
  highlightThumbnailFileInfo: null,
  highlightThumbnailImageId: '',
  highlightTitle: '',
  imageCheckList: null,
  imageFileData: '',
  imageFileInfo: null,
  imageId: '',
  imageSrcPrefix: '',
  items: [],
  quickReplies: [],
  securityFlag: false,
  senderResourceId: '',
  selectedSummaryOptionIndex: 0,
  summaryDescription: '',
  summaryTitle: '',
  templateCode: '',
  templateCodeManuallyEdited: false,
  templateContent: '',
  templateName: '',
  useHeader: false,
  useHighlight: false,
  useItemList: false,
  useSummary: false,
  useSummaryVariable: false,
  visibleImageUploadCollapse: false,
};

const SUMMARY_OPTIONS = [
  { align: 'right', value: '원' },
  { align: 'right', value: '₩' },
  { align: 'left', value: '$' },
  { align: null, value: '' },
];

export function AlimtalkTemplateCreatePageNewDesign({ onBack }) {
  const navigation = useConsoleNavigation();
  const { showToast } = useToast();
  const senderResourcesQuery = useSenderResourcesQuery();
  const imageUploadMutation = useAlimtalkTemplateImageUploadMutation();
  const createTemplateMutation = useAlimtalkTemplateCreateMutation();
  const [template, setTemplate] = useState(INITIAL_TEMPLATE);
  const [confirmed, setConfirmed] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [localSubmitResult, setLocalSubmitResult] = useState(null);
  const senderOptions = useMemo(
    () => getAlimtalkSenderProfiles(senderResourcesQuery.data),
    [senderResourcesQuery.data]
  );
  const selectedSenderResourceId = getResolvedAlimtalkSenderResourceId(template.senderResourceId, senderOptions);
  const submissionTemplate = useMemo(() => ({
    ...template,
    senderResourceId: selectedSenderResourceId,
  }), [selectedSenderResourceId, template]);
  const errors = useMemo(
    () => getAlimtalkTemplateRegistrationErrors(submissionTemplate),
    [submissionTemplate]
  );
  const selectedType = TEMPLATE_TYPE_OPTIONS.find((option) => option.value === template.emphasizeType)
    ?? TEMPLATE_TYPE_OPTIONS[0];
  const showsTextEmphasis = template.emphasizeType === 'TEXT';
  const showsImageSection = template.emphasizeType === 'IMAGE' || template.emphasizeType === 'ITEM_LIST';
  const showsMainImageUpload = template.emphasizeType === 'IMAGE'
    || template.visibleImageUploadCollapse === true;
  const showsItemList = template.emphasizeType === 'ITEM_LIST';
  const { currentLength, maxLength } = getContentSizeLabel(template);
  const hasErrors = errors.length > 0;
  const isSubmitting = imageUploadMutation.isPending || createTemplateMutation.isPending;
  const hasUnsavedChanges = useMemo(
    () => isAlimtalkTemplateDraftDirty(template),
    [template]
  );
  const fieldError = (field) => (
    submitAttempted
      ? errors.find((error) => error.field === field)?.message ?? ''
      : ''
  );

  function updateTemplate(patch) {
    setTemplate((current) => ({
      ...current,
      ...patch,
    }));
    setLocalSubmitResult(null);
  }

  function handleTemplateNameChange(templateName) {
    setTemplate((current) => ({
      ...current,
      ...(current.templateCodeManuallyEdited
        ? {}
        : { templateCode: suggestAlimtalkTemplateCode(templateName) }),
      templateName: templateName.slice(0, 90),
    }));
    setLocalSubmitResult(null);
  }

  function handleTemplateCodeChange(templateCode) {
    setTemplate((current) => ({
      ...current,
      templateCode: formatAlimtalkTemplateCode(templateCode),
      templateCodeManuallyEdited: true,
    }));
    setLocalSubmitResult(null);
  }

  function handleTypeChange(emphasizeType) {
    setTemplate((current) => {
      if (current.emphasizeType === emphasizeType) {
        return current;
      }

      return {
        ...current,
        ...getTypeResetPatch(emphasizeType),
      };
    });
    setSubmitAttempted(false);
    setLocalSubmitResult(null);
  }

  async function submitTemplateRegistration(event) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setSubmitAttempted(true);
    setLocalSubmitResult(null);

    if (hasErrors) {
      focusFirstInvalidField(errors[0]?.field);
      return;
    }

    const uploadedImages = {};
    let failedStage = getRequiredImageUploads(submissionTemplate).length > 0 ? 'upload' : 'create';

    try {
      for (const upload of getRequiredImageUploads(submissionTemplate)) {
        setLocalSubmitResult({ stage: 'upload', status: 'pending' });
        uploadedImages[upload.key] = await imageUploadMutation.mutateAsync({
          fileBody: upload.fileBody,
          fileName: upload.fileName,
          fileType: upload.fileType,
          kind: upload.kind,
          senderResourceId: submissionTemplate.senderResourceId,
        });
      }

      failedStage = 'create';
      setLocalSubmitResult({ stage: 'create', status: 'pending' });

      const payload = buildAlimtalkTemplateCreatePayload(submissionTemplate, uploadedImages);
      const result = await createTemplateMutation.mutateAsync(payload);
      const templateCode = result.templateCode ?? result.template?.templateCode ?? payload.templateCode;

      setLocalSubmitResult({ stage: 'create', status: 'success', templateCode });
      showToast({
        description: `${templateCode} 템플릿 등록 요청을 전송했습니다.`,
        title: '알림톡 템플릿을 등록했습니다.',
        variant: 'success',
      });
      navigation.push('/templates?tab=alimtalk');
    } catch (error) {
      setLocalSubmitResult({
        error,
        stage: failedStage,
        status: 'error',
      });
    }
  }

  function returnToList() {
    if (hasUnsavedChanges && !window.confirm('작성 중인 알림톡 템플릿 초안이 사라집니다. 목록으로 이동할까요?')) {
      return;
    }

    if (onBack) {
      onBack();
      return;
    }

    navigation.push('/templates');
  }

  return (
    <section className="page-frame alimtalk-template-create-page alimtalk-template-create-page-new-design">
      <div className="alimtalk-template-create-header">
        <Button onClick={returnToList} variant="secondary">
          <ChevronLeft size={15} />
          알림톡 템플릿 목록
        </Button>
        <div>
          <div className="alimtalk-template-create-breadcrumb" aria-label="breadcrumb">
            <span>알림톡 템플릿 목록</span>
            <span>›</span>
            <span>템플릿 등록</span>
          </div>
          <h1>새 템플릿 등록하기</h1>
        </div>
      </div>

      <Notice className="alimtalk-template-new-design-notice" title="정보성 메시지 검수 기준" variant="info">
        <p>카카오 알림톡 템플릿은 수신자가 꼭 받아야하는 정보성 메시지만 등록이 가능합니다!</p>
      </Notice>

      {senderResourcesQuery.isPending ? (
        <Notice title="알림톡 채널 확인 중" variant="neutral">
          <p>템플릿을 등록할 수 있는 알림톡 채널을 불러오고 있습니다.</p>
        </Notice>
      ) : null}
      {!senderResourcesQuery.isPending && senderOptions.length < 1 ? (
        <Notice icon={AlertTriangle} title="사용 가능한 알림톡 채널이 없습니다" variant="warning">
          <p>승인된 카카오 발신 채널이 있어야 알림톡 템플릿을 등록할 수 있습니다.</p>
        </Notice>
      ) : null}

      <form
        className="alimtalk-template-create-layout"
        id={ALIMTALK_TEMPLATE_CREATE_FIELD_IDS.form}
        onSubmit={submitTemplateRegistration}
      >
        <div className="alimtalk-template-create-main">
          <section className="alimtalk-template-create-card alimtalk-template-new-design-card">
            <h2>템플릿 유형</h2>
            <ChoiceCardGroup
              className="alimtalk-template-new-design-type-group"
              compact
              description={selectedType.description}
              items={TEMPLATE_TYPE_CHOICE_OPTIONS}
              label="유형 선택"
              name="alimtalkTemplateType"
              onValueChange={handleTypeChange}
              value={template.emphasizeType}
            />
          </section>

          <section className="alimtalk-template-create-card alimtalk-template-new-design-card">
            <h2>기본 정보</h2>
            <div className="alimtalk-template-new-design-form-stack">
              <BasicInfoFields
                fieldError={fieldError}
                onChange={updateTemplate}
                onTemplateCodeChange={handleTemplateCodeChange}
                onTemplateNameChange={handleTemplateNameChange}
                selectedSenderResourceId={selectedSenderResourceId}
                senderOptions={senderOptions}
                senderResourcesPending={senderResourcesQuery.isPending}
                template={template}
              />
            </div>
          </section>

          <section className="alimtalk-template-create-card alimtalk-template-new-design-card">
            <h2>템플릿 내용</h2>
            <div className="alimtalk-template-new-design-form-stack">
              <TemplateContentFields
                currentLength={currentLength}
                fieldError={fieldError}
                maxLength={maxLength}
                onChange={updateTemplate}
                showsTextEmphasis={showsTextEmphasis}
                template={template}
              />
            </div>
          </section>

          {showsImageSection ? (
            <ImageUploadSection
              onChange={updateTemplate}
              showsMainImageUpload={showsMainImageUpload}
              template={template}
            />
          ) : null}

          {showsItemList ? <ItemListSection onChange={updateTemplate} template={template} /> : null}

          <ActionSection onChange={updateTemplate} template={template} />

          <section className="alimtalk-template-create-card alimtalk-template-new-design-card">
            <Notice icon={AlertTriangle} title="반려 가능성이 높은 조건" variant="warning">
              <ul className="alimtalk-template-new-design-warning-list">
                {REJECTION_CONSTRAINTS.map((constraint) => (
                  <li key={constraint}>{constraint}</li>
                ))}
              </ul>
            </Notice>
            <div className="alimtalk-template-new-design-submit">
              <Checkbox
                checked={confirmed}
                label="위 내용을 확인했으며 해당 사항이 없습니다."
                onCheckedChange={setConfirmed}
              />
              <Button
                disabled={!confirmed || isSubmitting || senderResourcesQuery.isPending || senderOptions.length < 1}
                type="submit"
                variant="primary"
              >
                {getSubmitButtonLabel(localSubmitResult, isSubmitting)}
              </Button>
            </div>
            {submitAttempted && hasErrors ? (
              <Notice title="검증이 필요한 항목" urgent variant="critical">
                <ul className="alimtalk-template-new-design-error-list">
                  {errors.map((error) => (
                    <li key={error.message}>{error.message}</li>
                  ))}
                </ul>
              </Notice>
            ) : null}
            {localSubmitResult?.status === 'pending' ? (
              <Notice role="status" title={getSubmitPendingTitle(localSubmitResult.stage)} variant="neutral">
                <p>{getSubmitPendingCopy(localSubmitResult.stage)}</p>
              </Notice>
            ) : null}
            {localSubmitResult?.status === 'error' ? (
              <Notice title={getSubmitErrorTitle(localSubmitResult.stage)} urgent variant="critical">
                <p>{getSubmitErrorCopy(localSubmitResult)}</p>
              </Notice>
            ) : null}
          </section>
        </div>

        <aside className="alimtalk-template-preview-rail" aria-label="알림톡 미리보기">
          <KakaoTemplatePreview
            buttons={template.buttons}
            dateString="2026-06-12T14:30:00.000+09:00"
            emphasizeSubtitle={showsTextEmphasis ? template.emphasizeSubtitle : ''}
            emphasizeTitle={showsTextEmphasis ? template.emphasizeTitle : ''}
            extra={template.extraText}
            header={showsItemList && template.useHeader ? template.header : ''}
            highlighThumbnailImageUrl={showsItemList && template.useHighlight ? template.highlighThumbnailImageUrl : ''}
            highlightDescription={showsItemList && template.useHighlight ? template.highlightDescription : ''}
            highlightThumbnailImageId={
              showsItemList && template.useHighlight && !template.highlighThumbnailImageUrl
                ? template.highlightThumbnailImageId
                : ''
            }
            highlightTitle={showsItemList && template.useHighlight ? template.highlightTitle : ''}
            imageId={showsImageSection && !template.imageFileData ? template.imageId : ''}
            imageUrl={showsImageSection && template.imageFileData ? `${template.imageSrcPrefix}${template.imageFileData}` : ''}
            isCta={showsImageSection}
            items={showsItemList && template.useItemList ? template.items : []}
            quickReplies={template.quickReplies}
            summaryDescription={showsItemList && template.useItemList && template.useSummary ? template.summaryDescription : ''}
            summaryTitle={showsItemList && template.useItemList && template.useSummary ? template.summaryTitle : ''}
            text={template.templateContent}
          />
        </aside>
      </form>
    </section>
  );
}

function BasicInfoFields({
  fieldError,
  onChange,
  onTemplateCodeChange,
  onTemplateNameChange,
  selectedSenderResourceId,
  senderOptions,
  senderResourcesPending,
  template,
}) {
  return (
    <>
      <FormField.Root>
        <FormField.Label
          error={fieldError('senderResourceId')}
          htmlFor={ALIMTALK_TEMPLATE_CREATE_FIELD_IDS.senderResourceId}
          required
        >
          알림톡 채널
        </FormField.Label>
        <FormField.Control>
          <FormField.Select
            aria-invalid={fieldError('senderResourceId') ? 'true' : undefined}
            autoComplete="off"
            disabled={senderResourcesPending || senderOptions.length < 1}
            id={ALIMTALK_TEMPLATE_CREATE_FIELD_IDS.senderResourceId}
            name="senderResourceId"
            onChange={(event) => onChange({ senderResourceId: event.target.value })}
            value={selectedSenderResourceId}
          >
            {senderOptions.length < 1 ? <option value="">알림톡 채널 없음</option> : null}
            {senderOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </FormField.Select>
          <FormField.Help>provider에 승인된 카카오 발신 채널을 선택합니다.</FormField.Help>
          {fieldError('senderResourceId') ? <FormField.Error>{fieldError('senderResourceId')}</FormField.Error> : null}
        </FormField.Control>
      </FormField.Root>

      <div className="alimtalk-template-action-grid">
        <FormField.Root>
          <FormField.Label
            error={fieldError('templateName')}
            htmlFor={ALIMTALK_TEMPLATE_CREATE_FIELD_IDS.templateName}
            required
          >
            템플릿 이름
          </FormField.Label>
          <FormField.Control>
            <FormField.Input
              aria-invalid={fieldError('templateName') ? 'true' : undefined}
              autoComplete="off"
              id={ALIMTALK_TEMPLATE_CREATE_FIELD_IDS.templateName}
              name="templateName"
              onChange={(event) => onTemplateNameChange(event.target.value)}
              placeholder="회원가입 환영"
              value={template.templateName}
            />
            <FormField.Help>수신자에게 공개되지 않는 provider 관리용 이름입니다.</FormField.Help>
            {fieldError('templateName') ? <FormField.Error>{fieldError('templateName')}</FormField.Error> : null}
          </FormField.Control>
        </FormField.Root>

        <FormField.Root>
          <FormField.Label
            error={fieldError('templateCode')}
            htmlFor={ALIMTALK_TEMPLATE_CREATE_FIELD_IDS.templateCode}
            required
          >
            템플릿 코드
          </FormField.Label>
          <FormField.Control>
            <FormField.Input
              aria-invalid={fieldError('templateCode') ? 'true' : undefined}
              autoComplete="off"
              id={ALIMTALK_TEMPLATE_CREATE_FIELD_IDS.templateCode}
              name="templateCode"
              onChange={(event) => onTemplateCodeChange(event.target.value)}
              placeholder="WELCOME_NOTICE"
              value={template.templateCode}
            />
            <FormField.Help>영문 대문자, 숫자, 밑줄 조합으로 {TEMPLATE_CODE_MAX_LENGTH}자까지 입력합니다.</FormField.Help>
            {fieldError('templateCode') ? <FormField.Error>{fieldError('templateCode')}</FormField.Error> : null}
          </FormField.Control>
        </FormField.Root>
      </div>
    </>
  );
}

function TemplateContentFields({
  currentLength,
  fieldError,
  maxLength,
  onChange,
  showsTextEmphasis,
  template,
}) {
  return (
    <>
      {showsTextEmphasis ? (
        <>
          <FormField.Root>
            <FormField.Label htmlFor="new-emphasize-title" required>강조 제목</FormField.Label>
            <FormField.Control>
              <FormField.Input
                autoComplete="off"
                id="new-emphasize-title"
                name="emphasizeTitle"
                onChange={(event) => onChange({ emphasizeTitle: event.target.value.slice(0, 50) })}
                placeholder="환영합니다"
                value={template.emphasizeTitle}
              />
              <FormField.Help>최대 50자까지 입력할 수 있습니다.</FormField.Help>
            </FormField.Control>
          </FormField.Root>
          <FormField.Root>
            <FormField.Label htmlFor="new-emphasize-subtitle" required>보조 문구</FormField.Label>
            <FormField.Control>
              <FormField.Input
                autoComplete="off"
                id="new-emphasize-subtitle"
                name="emphasizeSubtitle"
                onChange={(event) => onChange({ emphasizeSubtitle: event.target.value.slice(0, 50) })}
                placeholder="가입 안내가 완료되었습니다"
                value={template.emphasizeSubtitle}
              />
              <FormField.Help>보조 문구에는 변수를 사용할 수 없습니다.</FormField.Help>
            </FormField.Control>
          </FormField.Root>
        </>
      ) : null}

      <FormField.Root>
        <FormField.Label error={fieldError('templateContent')} htmlFor="new-template-content" required>내용</FormField.Label>
        <FormField.Control>
          <FormField.Textarea
            aria-invalid={fieldError('templateContent') ? 'true' : undefined}
            autoComplete="off"
            id="new-template-content"
            name="templateContent"
            onChange={(event) => onChange({ templateContent: event.target.value.slice(0, 2000) })}
            placeholder={'#{홍길동}님, 가입이 완료되었습니다.\n\n필요한 안내를 이 메시지에서 확인해 주세요.'}
            rows={7}
            value={template.templateContent}
          />
          <FormField.Counter current={currentLength} invalid={currentLength > maxLength} max={maxLength} />
          {fieldError('templateContent') ? <FormField.Error>{fieldError('templateContent')}</FormField.Error> : null}
        </FormField.Control>
      </FormField.Root>

      <FormField.Root>
        <FormField.Label htmlFor="new-template-extra">부가정보</FormField.Label>
        <FormField.Control>
          <FormField.Textarea
            autoComplete="off"
            id="new-template-extra"
            name="extraText"
            onChange={(event) => onChange({ extraText: event.target.value.slice(0, 500) })}
            placeholder="고객센터 운영시간: 오전 9시 ~ 오후 5시"
            rows={3}
            value={template.extraText}
          />
          <FormField.Help>부가정보에는 변수를 사용할 수 없습니다.</FormField.Help>
        </FormField.Control>
      </FormField.Root>

      <Checkbox
        checked={template.securityFlag}
        label="보안 템플릿"
        caption="인증번호 등 민감정보를 포함하는 경우 모바일 앱에서만 열람되도록 설정합니다."
        onCheckedChange={(securityFlag) => onChange({ securityFlag })}
      />
    </>
  );
}

function ImageUploadSection({ onChange, showsMainImageUpload, template }) {
  const [imageCropFile, setImageCropFile] = useState(null);
  const isRequired = template.emphasizeType === 'IMAGE';
  const imageCheckList = template.imageCheckList ?? DEFAULT_ALIMTALK_IMAGE_CHECKS;
  const imagePreviewUrl = template.imageFileData ? `${template.imageSrcPrefix}${template.imageFileData}` : '';
  const imageValidationStatus = getUploadValidationStatus({
    checklist: imageCheckList,
    fileInfo: template.imageFileInfo,
    hasPreview: Boolean(imagePreviewUrl),
    invalidMessage: '이미지가 조건을 통과하지 못해 미리보기에 표시되지 않습니다. 실패 항목을 수정한 파일로 다시 업로드하세요.',
    validMessage: '이미지가 미리보기에 반영되었습니다.',
  });
  const imageFiles = getUploadFiles({
    fallbackName: '알림톡 이미지',
    fileInfo: template.imageFileInfo,
    id: 'imageFileData',
    previewAlt: '업로드한 알림톡 이미지',
    previewUrl: imagePreviewUrl,
  });

  function setImageUploadEnabled(visibleImageUploadCollapse) {
    onChange({
      visibleImageUploadCollapse,
      ...(visibleImageUploadCollapse ? {} : getMainImageResetPatch()),
    });
  }

  function handleMainImageFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      setImageCropFile(file);
    }
  }

  function handleMainImageCropOpenChange(open) {
    if (!open) {
      setImageCropFile(null);
    }
  }

  function handleMainImageCropApply({ file }) {
    applyAlimtalkImageFile(file, onChange);
  }

  return (
    <section className="alimtalk-template-create-card alimtalk-template-new-design-card">
      <div className="alimtalk-template-new-design-section-header">
        <div>
          <h2>알림톡 이미지 {isRequired ? '' : '(선택사항)'}</h2>
          <p>아래 알림톡 이미지 가이드를 반드시 지켜야합니다.</p>
        </div>
        {!isRequired ? (
          <Checkbox
            checked={template.visibleImageUploadCollapse === true}
            label="대표 이미지 사용"
            onCheckedChange={setImageUploadEnabled}
          />
        ) : null}
      </div>

      {showsMainImageUpload ? (
        <div className="alimtalk-template-new-design-form-stack">
          <FormField.Root>
            <FormField.Label htmlFor="new-main-image" required={isRequired}>이미지</FormField.Label>
            <FormField.Control>
              <FileUploadField
                accept={IMAGE_ACCEPT}
                actionLabel="이미지 선택"
                aria-describedby={
                  imageValidationStatus
                    ? 'new-main-image-checks new-main-image-status'
                    : 'new-main-image-checks'
                }
                aria-invalid={imageValidationStatus?.state === 'error' ? 'true' : undefined}
                emptyDescription="JPEG, JPG, PNG · 500KB 이하 · 2:1 비율"
                emptyLabel="선택된 이미지 없음"
                files={imageFiles}
                id="new-main-image"
                name="imageFileData"
                onFileChange={handleMainImageFileChange}
                onRemoveFile={() => onChange(getMainImageResetPatch())}
              />
              <ValidationChecklist
                id="new-main-image-checks"
                items={toChecklistItems(imageCheckList, 'main-image')}
              />
              <UploadValidationStatus id="new-main-image-status" status={imageValidationStatus} />
            </FormField.Control>
          </FormField.Root>
        </div>
      ) : (
        <Notice title="대표 이미지를 사용하지 않습니다." variant="neutral">
          <p>가이드 미준수 시 알림톡 검수 반려</p>
        </Notice>
      )}
      <ImageCropDialog
        file={imageCropFile}
        onApply={handleMainImageCropApply}
        onOpenChange={handleMainImageCropOpenChange}
        open={Boolean(imageCropFile)}
        preset="ALIMTALK_MAIN_IMAGE"
      />
    </section>
  );
}

function ItemListSection({ onChange, template }) {
  const [thumbnailCropFile, setThumbnailCropFile] = useState(null);
  const thumbnailCheckList = template.highlightThumbnailCheckList ?? DEFAULT_HIGHLIGHT_THUMBNAIL_CHECKS;
  const thumbnailValidationStatus = getUploadValidationStatus({
    checklist: thumbnailCheckList,
    fileInfo: template.highlightThumbnailFileInfo,
    hasPreview: Boolean(template.highlighThumbnailImageUrl),
    invalidMessage: '썸네일이 조건을 통과하지 못해 미리보기에 표시되지 않습니다. 실패 항목을 수정한 파일로 다시 업로드하세요.',
    validMessage: '썸네일이 미리보기에 반영되었습니다.',
  });
  let thumbnailDescribedBy;
  if (template.useHighlight === true) {
    thumbnailDescribedBy = thumbnailValidationStatus
      ? 'new-highlight-thumbnail-checks new-highlight-thumbnail-status'
      : 'new-highlight-thumbnail-checks';
  }
  const thumbnailFiles = getUploadFiles({
    fallbackName: '하이라이트 썸네일',
    fileInfo: template.highlightThumbnailFileInfo,
    id: 'highlightThumbnailImageUrl',
    previewAlt: '업로드한 하이라이트 썸네일',
    previewUrl: template.highlighThumbnailImageUrl,
  });

  function updateItem(index, patch) {
    onChange({
      items: template.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    });
  }

  function setHighlightEnabled(useHighlight) {
    onChange({
      useHighlight,
      ...(useHighlight ? {} : getHighlightResetPatch()),
    });
  }

  function setItemListEnabled(useItemList) {
    onChange({
      items: useItemList ? template.items : [],
      useItemList,
      ...(useItemList ? {} : getSummaryResetPatch()),
    });
  }

  function setSummaryEnabled(useSummary) {
    if (template.useItemList !== true) {
      return;
    }

    onChange({
      summaryDescription: useSummary ? template.summaryDescription : '',
      summaryTitle: useSummary ? template.summaryTitle : '',
      useSummary,
    });
  }

  function handleThumbnailFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      setThumbnailCropFile(file);
    }
  }

  function handleThumbnailCropOpenChange(open) {
    if (!open) {
      setThumbnailCropFile(null);
    }
  }

  function handleThumbnailCropApply({ file }) {
    applyHighlightThumbnailFile(file, onChange);
  }

  return (
    <section className="alimtalk-template-create-card alimtalk-template-new-design-card">
      <h2>리스트형 상세 설정</h2>
      <div className="alimtalk-template-new-design-form-stack">
        <ToggleBlock checked={template.useHeader} label="헤더 사용" onCheckedChange={(useHeader) => onChange({ header: useHeader ? template.header : '', useHeader })}>
          <FormField.Root>
            <FormField.Label htmlFor="new-item-header">헤더</FormField.Label>
            <FormField.Control>
              <FormField.Input
                autoComplete="off"
                disabled={template.useHeader !== true}
                id="new-item-header"
                name="itemHeader"
                onChange={(event) => onChange({ header: event.target.value.slice(0, 16) })}
                placeholder="주문 안내"
                value={template.header}
              />
              <FormField.Help>최대 16자까지 입력할 수 있습니다.</FormField.Help>
            </FormField.Control>
          </FormField.Root>
        </ToggleBlock>

        <ToggleBlock checked={template.useHighlight} label="하이라이트 사용" onCheckedChange={setHighlightEnabled}>
          <FormField.Root>
            <FormField.Label htmlFor="new-highlight-title">제목</FormField.Label>
            <FormField.Control>
              <FormField.Input
                autoComplete="off"
                disabled={template.useHighlight !== true}
                id="new-highlight-title"
                name="highlightTitle"
                onChange={(event) => onChange({ highlightTitle: event.target.value.slice(0, 30) })}
                placeholder="배송 준비 완료"
                value={template.highlightTitle}
              />
            </FormField.Control>
          </FormField.Root>
          <FormField.Root>
            <FormField.Label htmlFor="new-highlight-description">설명</FormField.Label>
            <FormField.Control>
              <FormField.Input
                autoComplete="off"
                disabled={template.useHighlight !== true}
                id="new-highlight-description"
                name="highlightDescription"
                onChange={(event) => onChange({ highlightDescription: event.target.value.slice(0, 16) })}
                placeholder="오늘 출고 예정"
                value={template.highlightDescription}
              />
            </FormField.Control>
          </FormField.Root>
          <FormField.Root>
            <FormField.Label htmlFor="new-highlight-thumbnail">썸네일</FormField.Label>
            <FormField.Control>
              <FileUploadField
                accept={IMAGE_ACCEPT}
                actionLabel="썸네일 선택"
                aria-describedby={thumbnailDescribedBy}
                aria-invalid={thumbnailValidationStatus?.state === 'error' ? 'true' : undefined}
                disabled={template.useHighlight !== true}
                emptyDescription="JPEG, JPG, PNG · 500KB 이하 · 1:1 비율"
                emptyLabel="선택된 썸네일 없음"
                files={thumbnailFiles}
                id="new-highlight-thumbnail"
                name="highlightThumbnailImageUrl"
                onFileChange={handleThumbnailFileChange}
                onRemoveFile={() => onChange(getHighlightResetPatch())}
              />
              {template.useHighlight === true ? (
                <>
                  <ValidationChecklist
                    id="new-highlight-thumbnail-checks"
                    items={toChecklistItems(thumbnailCheckList, 'highlight-thumbnail')}
                  />
                  <UploadValidationStatus
                    id="new-highlight-thumbnail-status"
                    status={thumbnailValidationStatus}
                  />
                </>
              ) : null}
            </FormField.Control>
          </FormField.Root>
        </ToggleBlock>

        <ToggleBlock checked={template.useItemList} label="목록 사용" onCheckedChange={setItemListEnabled}>
          <div className="alimtalk-template-new-design-list-stack">
            {template.items.map((item, index) => (
              <div className="alimtalk-template-action-row" key={`new-item-${index}`}>
                <div className="alimtalk-template-action-grid">
                  <FormField.Control>
                    <FormField.Input
                      aria-label={`목록 ${index + 1} 항목명`}
                      autoComplete="off"
                      disabled={template.useItemList !== true}
                      id={`new-list-item-title-${index}`}
                      name={`items.${index}.title`}
                      onChange={(event) => updateItem(index, { title: event.target.value })}
                      placeholder="항목명"
                      value={item.title}
                    />
                  </FormField.Control>
                  <FormField.Control>
                    <FormField.Input
                      aria-label={`목록 ${index + 1} 항목값`}
                      autoComplete="off"
                      disabled={template.useItemList !== true}
                      id={`new-list-item-description-${index}`}
                      name={`items.${index}.description`}
                      onChange={(event) => updateItem(index, { description: event.target.value })}
                      placeholder="항목값"
                      value={item.description}
                    />
                  </FormField.Control>
                </div>
                <button
                  aria-label="항목 제거"
                  className="alimtalk-template-icon-button"
                  onClick={() => onChange({ items: template.items.filter((_, itemIndex) => itemIndex !== index) })}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <Button
              disabled={template.useItemList !== true || template.items.length >= 10}
              onClick={() => onChange({ items: [...template.items, { description: '', title: '' }] })}
              variant="secondary"
            >
              <Plus size={14} />
              목록 추가
            </Button>
          </div>
        </ToggleBlock>

        <ToggleBlock checked={template.useSummary} disabled={template.useItemList !== true} label="합계 단락 사용" onCheckedChange={setSummaryEnabled}>
          <FormField.Root>
            <FormField.Label htmlFor="new-summary-title">합계 제목</FormField.Label>
            <FormField.Control>
              <FormField.Input
                autoComplete="off"
                disabled={template.useItemList !== true || template.useSummary !== true}
                id="new-summary-title"
                name="summaryTitle"
                onChange={(event) => onChange({ summaryTitle: event.target.value.slice(0, 6) })}
                placeholder="합계"
                value={template.summaryTitle}
              />
            </FormField.Control>
          </FormField.Root>
          <Checkbox
            checked={template.useSummaryVariable}
            disabled={template.useItemList !== true || template.useSummary !== true}
            label="변수 사용하기"
            onCheckedChange={(useSummaryVariable) => onChange({
              summaryDescription: useSummaryVariable
                ? '#{합계}원'
                : getSummaryDescription(template.summaryDescription, SUMMARY_OPTIONS[template.selectedSummaryOptionIndex]),
              useSummaryVariable,
            })}
          />
          <FormField.Root>
            <FormField.Label htmlFor="new-summary-description">합계 값</FormField.Label>
            <FormField.Control>
              <FormField.Input
                autoComplete="off"
                disabled={template.useItemList !== true || template.useSummary !== true}
                id="new-summary-description"
                name="summaryDescription"
                onChange={(event) => onChange({
                  summaryDescription: event.target.value.slice(0, template.useSummaryVariable ? 11 : 14),
                })}
                placeholder={template.useSummaryVariable ? '#{합계}원' : '1,000,000'}
                value={template.summaryDescription}
              />
              <div className="alimtalk-template-inline-actions">
                {SUMMARY_OPTIONS.map((option, index) => (
                  <button
                    aria-label={`합계 단위 ${option.value || '없음'} 선택`}
                    disabled={template.useItemList !== true || template.useSummary !== true}
                    key={`${option.value}-${index}`}
                    onClick={() => onChange({
                      selectedSummaryOptionIndex: index,
                      summaryDescription: getSummaryDescription(template.summaryDescription, option),
                    })}
                    type="button"
                  >
                    {option.value || '없음'}
                  </button>
                ))}
              </div>
            </FormField.Control>
          </FormField.Root>
        </ToggleBlock>
      </div>
      <ImageCropDialog
        file={thumbnailCropFile}
        onApply={handleThumbnailCropApply}
        onOpenChange={handleThumbnailCropOpenChange}
        open={Boolean(thumbnailCropFile)}
        preset="ALIMTALK_HIGHLIGHT_THUMBNAIL"
      />
    </section>
  );
}

function ActionSection({ onChange, template }) {
  const buttons = template.buttons ?? [];
  const quickReplies = template.quickReplies ?? [];
  const buttonLimit = getAlimtalkTemplateButtonLimit({ quickReplyCount: quickReplies.length });
  const hasTooManyButtonsForQuickReplies = buttons.length > ALIMTALK_TEMPLATE_BUTTON_MAX_WITH_QUICK_REPLIES;
  const buttonLimitNote = quickReplies.length > 0
    ? `바로가기 사용 중: 버튼 최대 ${ALIMTALK_TEMPLATE_BUTTON_MAX_WITH_QUICK_REPLIES}개`
    : `버튼 최대 ${ALIMTALK_TEMPLATE_BUTTON_MAX_COUNT}개`;
  const quickReplyLimitNote = hasTooManyButtonsForQuickReplies
    ? `버튼을 ${ALIMTALK_TEMPLATE_BUTTON_MAX_WITH_QUICK_REPLIES}개 이하로 줄이면 바로가기를 추가할 수 있습니다.`
    : `바로가기 최대 ${ALIMTALK_TEMPLATE_QUICK_REPLY_MAX_COUNT}개`;

  function updateButton(index, patch) {
    onChange({
      buttons: buttons.map((button, buttonIndex) => (
        buttonIndex === index ? { ...button, ...patch } : button
      )),
    });
  }

  function updateQuickReply(index, patch) {
    onChange({
      quickReplies: quickReplies.map((reply, replyIndex) => (
        replyIndex === index ? { ...reply, ...patch } : reply
      )),
    });
  }

  return (
    <section className="alimtalk-template-create-card alimtalk-template-new-design-card">
      <div className="alimtalk-template-action-section-heading">
        <div>
          <h2>버튼과 바로가기</h2>
          <p>메시지 하단에 노출할 액션만 추가하고, 유형별로 필요한 입력값만 관리합니다.</p>
        </div>
      </div>
      <div className="alimtalk-template-action-groups">
        <ActionGroup
          addLabel="버튼 추가"
          countLabel={`${buttons.length}/${buttonLimit}`}
          countState={buttons.length > buttonLimit ? 'invalid' : 'default'}
          description="메시지 아래 고정 버튼입니다. 채널추가는 첫 번째 버튼에서만 사용할 수 있습니다."
          disabled={buttons.length >= buttonLimit}
          limitNote={buttonLimitNote}
          onAdd={() => onChange({ buttons: [...buttons, createButton(buttons.length)] })}
          title="버튼"
        >
          {buttons.length > 0 ? buttons.map((button, index) => (
            <div aria-label={`버튼 ${index + 1}`} className="alimtalk-template-action-card" key={`new-button-${index}`} role="group">
              <div className="alimtalk-template-action-card-header">
                <div className="alimtalk-template-action-card-title">
                  <span>버튼 {index + 1}</span>
                  <strong>{getActionTypeLabel(BUTTON_TYPES, button.buttonType)}</strong>
                </div>
                <button
                  aria-label={`버튼 ${index + 1} 제거`}
                  className="alimtalk-template-icon-button"
                  onClick={() => onChange({ buttons: buttons.filter((_, itemIndex) => itemIndex !== index) })}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="alimtalk-template-action-fields">
                <div className="alimtalk-template-action-grid">
                  <FormField.Root>
                    <FormField.Label htmlFor={`new-button-name-${index}`}>버튼명</FormField.Label>
                    <FormField.Control>
                      <FormField.Input
                        autoComplete="off"
                        id={`new-button-name-${index}`}
                        name={`buttons.${index}.buttonName`}
                        onChange={(event) => updateButton(index, { buttonName: event.target.value.slice(0, 14) })}
                        placeholder="자세히 보기"
                        readOnly={button.buttonType === 'AC'}
                        value={button.buttonType === 'AC' ? '채널 추가' : button.buttonName}
                      />
                    </FormField.Control>
                  </FormField.Root>
                  <FormField.Root>
                    <FormField.Label htmlFor={`new-button-type-${index}`}>버튼 유형</FormField.Label>
                    <FormField.Control>
                      <FormField.Select
                        id={`new-button-type-${index}`}
                        name={`buttons.${index}.buttonType`}
                        onChange={(event) => updateButton(index, getButtonTypePatch(event.target.value, index, button))}
                        value={button.buttonType}
                      >
                        {BUTTON_TYPES.map(([value, label]) => (
                          <option
                            disabled={value === ALIMTALK_TEMPLATE_ADD_CHANNEL_BUTTON_TYPE && index > 0}
                            key={value}
                            value={value}
                          >
                            {label}
                          </option>
                        ))}
                      </FormField.Select>
                    </FormField.Control>
                  </FormField.Root>
                </div>
                <ActionTypeFields
                  action={button}
                  fieldSets={BUTTON_ACTION_FIELD_SETS}
                  idPrefix={`new-button-${index}`}
                  namePrefix={`buttons.${index}`}
                  onChange={(patch) => updateButton(index, patch)}
                  type={button.buttonType}
                />
              </div>
            </div>
          )) : (
            <ActionEmptyState>필요한 경우에만 웹링크, 앱링크, 채널 추가 버튼을 추가하세요.</ActionEmptyState>
          )}
        </ActionGroup>

        <ActionGroup
          addLabel="바로가기 추가"
          countLabel={`${quickReplies.length}/${ALIMTALK_TEMPLATE_QUICK_REPLY_MAX_COUNT}`}
          countState={quickReplies.length > ALIMTALK_TEMPLATE_QUICK_REPLY_MAX_COUNT ? 'invalid' : 'default'}
          description="메시지 하단의 보조 액션입니다. 바로가기를 사용하면 버튼은 최대 2개로 제한됩니다."
          disabled={quickReplies.length >= ALIMTALK_TEMPLATE_QUICK_REPLY_MAX_COUNT || hasTooManyButtonsForQuickReplies}
          limitNote={quickReplyLimitNote}
          onAdd={() => onChange({ quickReplies: [...quickReplies, createQuickReply(quickReplies.length)] })}
          title="바로가기"
        >
          {quickReplies.length > 0 ? quickReplies.map((reply, index) => (
            <div aria-label={`바로가기 ${index + 1}`} className="alimtalk-template-action-card" key={`new-reply-${index}`} role="group">
              <div className="alimtalk-template-action-card-header">
                <div className="alimtalk-template-action-card-title">
                  <span>바로가기 {index + 1}</span>
                  <strong>{getActionTypeLabel(QUICK_REPLY_TYPES, reply.type ?? 'BK')}</strong>
                </div>
                <button
                  aria-label={`바로가기 ${index + 1} 제거`}
                  className="alimtalk-template-icon-button"
                  onClick={() => onChange({ quickReplies: quickReplies.filter((_, itemIndex) => itemIndex !== index) })}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="alimtalk-template-action-fields">
                <div className="alimtalk-template-action-grid">
                  <FormField.Root>
                    <FormField.Label htmlFor={`new-quick-reply-name-${index}`}>바로가기명</FormField.Label>
                    <FormField.Control>
                      <FormField.Input
                        autoComplete="off"
                        id={`new-quick-reply-name-${index}`}
                        name={`quickReplies.${index}.name`}
                        onChange={(event) => updateQuickReply(index, { name: event.target.value.slice(0, 14) })}
                        placeholder="상담원 연결"
                        value={reply.name}
                      />
                    </FormField.Control>
                  </FormField.Root>
                  <FormField.Root>
                    <FormField.Label htmlFor={`new-quick-reply-type-${index}`}>바로가기 유형</FormField.Label>
                    <FormField.Control>
                      <FormField.Select
                        id={`new-quick-reply-type-${index}`}
                        name={`quickReplies.${index}.type`}
                        onChange={(event) => updateQuickReply(index, getQuickReplyTypePatch(event.target.value, index))}
                        value={reply.type ?? 'BK'}
                      >
                        {QUICK_REPLY_TYPES.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </FormField.Select>
                    </FormField.Control>
                  </FormField.Root>
                </div>
                <ActionTypeFields
                  action={reply}
                  fieldSets={QUICK_REPLY_ACTION_FIELD_SETS}
                  idPrefix={`new-quick-reply-${index}`}
                  namePrefix={`quickReplies.${index}`}
                  onChange={(patch) => updateQuickReply(index, patch)}
                  type={reply.type ?? 'BK'}
                />
              </div>
            </div>
          )) : (
            <ActionEmptyState>필요한 경우에만 봇키워드, 웹링크, 앱링크 바로가기를 추가하세요.</ActionEmptyState>
          )}
        </ActionGroup>
      </div>
    </section>
  );
}

function ActionGroup({
  addLabel,
  children,
  countLabel,
  countState = 'default',
  description,
  disabled,
  limitNote = '',
  onAdd,
  title,
}) {
  return (
    <div className="alimtalk-template-action-group">
      <div className="alimtalk-template-action-group-header">
        <div>
          <div className="alimtalk-template-action-group-title">
            <h3>{title}</h3>
            <span data-state={countState}>{countLabel}</span>
          </div>
          <p>{description}</p>
          {limitNote ? <small className="alimtalk-template-action-limit-note">{limitNote}</small> : null}
        </div>
        <Button disabled={disabled} onClick={onAdd} variant="secondary">
          <Plus size={14} />
          {addLabel}
        </Button>
      </div>
      <div className="alimtalk-template-action-list">
        {children}
      </div>
    </div>
  );
}

function ActionEmptyState({ children }) {
  return (
    <div className="alimtalk-template-action-empty">
      {children}
    </div>
  );
}

function ActionTypeFields({ action, fieldSets, idPrefix, namePrefix, onChange, type }) {
  const fields = fieldSets[type] ?? [];

  if (fields.length < 1) {
    return null;
  }

  return (
    <div className="alimtalk-template-action-link-grid" data-columns={fields.length === 1 ? '1' : '2'}>
      {fields.map((field) => {
        const id = `${idPrefix}-${field.field}`;
        const value = getActionFieldValue(action, field);

        return (
          <FormField.Root key={field.field}>
            <FormField.Label htmlFor={id} required={field.required}>
              {field.label}
            </FormField.Label>
            <FormField.Control>
              <FormField.Input
                autoComplete={field.autocomplete}
                id={id}
                name={`${namePrefix}.${field.field}`}
                onChange={(event) => onChange(getActionFieldPatch(field, event.target.value))}
                placeholder={field.placeholder}
                type={field.type ?? 'text'}
                value={value}
              />
            </FormField.Control>
          </FormField.Root>
        );
      })}
    </div>
  );
}

function ToggleBlock({ checked, children, disabled = false, label, onCheckedChange }) {
  return (
    <div className="alimtalk-template-checked-field alimtalk-template-new-design-toggle-block" data-enabled={checked ? 'true' : 'false'}>
      <Checkbox checked={checked} disabled={disabled} label={label} onCheckedChange={onCheckedChange} />
      <div className="alimtalk-template-checked-body">{children}</div>
    </div>
  );
}

function UploadValidationStatus({ id, status }) {
  if (!status) {
    return null;
  }

  return (
    <p className="alimtalk-template-new-design-validation-status" data-state={status.state} id={id}>
      {status.message}
    </p>
  );
}

function getTypeResetPatch(emphasizeType) {
  return {
    emphasizeSubtitle: '',
    emphasizeTitle: '',
    emphasizeType,
    ...getMainImageResetPatch(),
    ...getHighlightResetPatch(),
    header: '',
    items: [],
    selectedSummaryOptionIndex: 0,
    summaryDescription: '',
    summaryTitle: '',
    useHeader: false,
    useHighlight: false,
    useItemList: false,
    useSummary: false,
    useSummaryVariable: false,
    visibleImageUploadCollapse: false,
  };
}

function getMainImageResetPatch() {
  return {
    imageCheckList: null,
    imageFileData: '',
    imageFileInfo: null,
    imageId: '',
    imageSrcPrefix: '',
  };
}

function getHighlightResetPatch() {
  return {
    highlighThumbnailImageUrl: '',
    highlightDescription: '',
    highlightThumbnailCheckList: null,
    highlightThumbnailFileInfo: null,
    highlightThumbnailImageId: '',
    highlightTitle: '',
  };
}

function getSummaryResetPatch() {
  return {
    summaryDescription: '',
    summaryTitle: '',
    useSummary: false,
    useSummaryVariable: false,
  };
}

function getContentSizeLabel(template) {
  const maxLength = getAlimtalkTemplateMaxContentLength(template.emphasizeType);
  const currentLength = template.templateContent.length
    + template.extraText.length
    + (template.emphasizeType === 'TEXT' ? 36 : 0);

  return { currentLength, maxLength };
}

function getUploadFiles({
  fallbackName,
  fileInfo,
  id,
  previewAlt,
  previewUrl,
}) {
  if (!fileInfo) {
    return [];
  }

  return [
    {
      fileName: fileInfo.fileName || fallbackName,
      id,
      metadata: [
        fileInfo.fileType,
        formatFileSize(fileInfo.fileSize),
        fileInfo.width && fileInfo.height ? `${fileInfo.width}x${fileInfo.height}px` : '',
      ].filter(Boolean),
      previewAlt,
      previewUrl,
    },
  ];
}

function toChecklistItems(items, prefix) {
  return items.map((item, index) => ({
    checked: item.checked,
    error: item.error,
    errorLabel: item.errorLabel,
    id: `${prefix}-${index}`,
    label: item.label,
  }));
}

function getUploadValidationStatus({
  checklist,
  fileInfo,
  hasPreview,
  invalidMessage,
  validMessage,
}) {
  if (!fileInfo) {
    return null;
  }

  if (checklist.some((item) => item.error === true)) {
    return {
      message: invalidMessage,
      state: 'error',
    };
  }

  if (hasPreview) {
    return {
      message: validMessage,
      state: 'success',
    };
  }

  return null;
}

function applyAlimtalkImageFile(file, onChange) {
  readImageFile({
    file,
    onFailure() {
      onChange(createAlimtalkImageReadFailurePatch({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      }));
    },
    onSuccess({ height, imageDataUrl, width }) {
      onChange(createAlimtalkImagePatch({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        height,
        imageDataUrl,
        width,
      }));
    },
  });
}

function applyHighlightThumbnailFile(file, onChange) {
  readImageFile({
    file,
    onFailure() {
      const patch = createHighlightThumbnailReadFailurePatch({
        fileSize: file.size,
        fileType: file.type,
      });

      onChange({
        ...patch,
        highlightThumbnailFileInfo: {
          ...patch.highlightThumbnailFileInfo,
          fileName: file.name,
        },
      });
    },
    onSuccess({ height, imageDataUrl, width }) {
      const patch = createHighlightThumbnailPatch({
        fileSize: file.size,
        fileType: file.type,
        height,
        imageDataUrl,
        width,
      });

      onChange({
        ...patch,
        highlightThumbnailFileInfo: {
          ...patch.highlightThumbnailFileInfo,
          fileName: file.name,
        },
      });
    },
  });
}

function readImageFile({ file, onFailure, onSuccess }) {
  function failRead() {
    onFailure();
  }

  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const image = new Image();
    image.addEventListener('load', () => {
      onSuccess({
        height: image.height,
        imageDataUrl: String(reader.result),
        width: image.width,
      });
    });
    image.addEventListener('error', failRead);
    image.src = String(reader.result);
  });
  reader.addEventListener('error', failRead);
  reader.readAsDataURL(file);
}

function createButton(index) {
  return {
    buttonName: '',
    buttonType: 'WL',
    chatEvent: '',
    chatExtra: '',
    linkAnd: '',
    linkIos: '',
    linkMo: '',
    linkPc: '',
    ordering: index + 1,
    priority: index,
    schemeAndroid: '',
    schemeIos: '',
  };
}

function createQuickReply(index) {
  return {
    linkMo: '',
    linkPc: '',
    name: '',
    ordering: index + 1,
    schemeAndroid: '',
    schemeIos: '',
    type: 'BK',
  };
}

function getButtonTypePatch(buttonType, index, currentButton = {}) {
  const nextButtonType = index > 0 && buttonType === ALIMTALK_TEMPLATE_ADD_CHANNEL_BUTTON_TYPE
    ? 'WL'
    : buttonType;

  return {
    ...getActionFieldResetPatch(),
    ...(nextButtonType === ALIMTALK_TEMPLATE_ADD_CHANNEL_BUTTON_TYPE ? { buttonName: '채널 추가' } : {}),
    ...(nextButtonType !== ALIMTALK_TEMPLATE_ADD_CHANNEL_BUTTON_TYPE
      && currentButton.buttonType === ALIMTALK_TEMPLATE_ADD_CHANNEL_BUTTON_TYPE ? { buttonName: '' } : {}),
    buttonType: nextButtonType,
    ordering: index + 1,
    priority: nextButtonType === ALIMTALK_TEMPLATE_ADD_CHANNEL_BUTTON_TYPE ? -1 : index,
  };
}

function getQuickReplyTypePatch(type, index) {
  return {
    ...getActionFieldResetPatch(),
    ordering: index + 1,
    type,
  };
}

function getActionTypeLabel(options, value) {
  return options.find(([optionValue]) => optionValue === value)?.[1] ?? value;
}

function getActionFieldResetPatch() {
  return {
    chatEvent: '',
    chatExtra: '',
    linkAnd: '',
    linkIos: '',
    linkMo: '',
    linkPc: '',
    schemeAndroid: '',
    schemeIos: '',
  };
}

function getActionFieldPatch(field, value) {
  return {
    ...(field.aliases ?? []).reduce((patch, alias) => ({ ...patch, [alias]: value }), {}),
    [field.field]: value,
  };
}

function getActionFieldValue(action, field) {
  if (action[field.field]) {
    return action[field.field];
  }

  for (const alias of field.aliases ?? []) {
    if (action[alias]) {
      return action[alias];
    }
  }

  return '';
}

function getSummaryDescription(value, option) {
  const numericValue = String(value ?? '')
    .replace(/[^0-9,.]/g, '')
    .slice(0, 14 - (option.value?.length || 0));

  return `${option.align === 'left' ? option.value : ''}${numericValue}${option.align === 'right' ? option.value : ''}`;
}

function formatFileSize(value) {
  const size = Number(value);

  if (!Number.isFinite(size) || size <= 0) {
    return '';
  }

  if (size < 1024) {
    return `${size} B`;
  }

  return `${Math.ceil(size / 1024)} KB`;
}

function getResolvedAlimtalkSenderResourceId(senderResourceId, senderOptions) {
  if (senderOptions.some((option) => option.value === senderResourceId)) {
    return senderResourceId;
  }

  return senderOptions.find((option) => option.value)?.value ?? '';
}

function formatAlimtalkTemplateCode(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    .toUpperCase()
    .slice(0, TEMPLATE_CODE_MAX_LENGTH);
}

function suggestAlimtalkTemplateCode(templateName) {
  return formatAlimtalkTemplateCode(templateName) || 'ALIMTALK_TEMPLATE';
}

function getAlimtalkTemplateRegistrationErrors(template) {
  const errors = [];

  if (!String(template.senderResourceId ?? '').trim()) {
    errors.push({ field: 'senderResourceId', message: '알림톡 채널을 선택해 주세요.' });
  }

  if (!String(template.templateName ?? '').trim()) {
    errors.push({ field: 'templateName', message: '템플릿 이름을 입력해 주세요.' });
  }

  const templateCode = String(template.templateCode ?? '').trim();
  if (!templateCode) {
    errors.push({ field: 'templateCode', message: '템플릿 코드를 입력해 주세요.' });
  } else if (templateCode.length > TEMPLATE_CODE_MAX_LENGTH) {
    errors.push({ field: 'templateCode', message: `템플릿 코드는 ${TEMPLATE_CODE_MAX_LENGTH}자 이하여야 합니다.` });
  } else if (!TEMPLATE_CODE_PATTERN.test(templateCode)) {
    errors.push({ field: 'templateCode', message: '템플릿 코드는 영문 대문자, 숫자, 밑줄만 사용할 수 있습니다.' });
  }

  if (
    (template.buttons ?? []).some((button) => button.buttonType === 'AC')
    && !String(template.extraText ?? '').trim()
  ) {
    errors.push({ field: 'extraText', message: '채널 추가 버튼을 사용할 때는 부가정보를 입력해 주세요.' });
  }

  return [
    ...errors,
    ...validateAlimtalkTemplateContent(template).map(toRegistrationError),
    ...validateAlimtalkTemplateAdvancedSections(template).map(toRegistrationError),
  ];
}

function toRegistrationError(error) {
  return {
    field: inferRegistrationErrorField(error.message),
    message: error.message,
  };
}

function inferRegistrationErrorField(message = '') {
  if (message.includes('템플릿 이름')) return 'templateName';
  if (message.includes('템플릿 내용') || message.includes('내용')) return 'templateContent';
  if (message.includes('강조표기 제목')) return 'emphasizeTitle';
  if (message.includes('강조표기 보조문구')) return 'emphasizeSubtitle';
  if (message.includes('부가정보')) return 'extraText';

  return '';
}

function buildAlimtalkTemplateCreatePayload(template, uploadedImages = {}) {
  const payload = {
    senderResourceId: template.senderResourceId,
    securityFlag: template.securityFlag === true,
    templateCode: template.templateCode,
    templateContent: template.templateContent,
    templateEmphasizeType: template.emphasizeType,
    templateMessageType: getAlimtalkTemplateMessageType(template),
    templateName: template.templateName,
  };

  if (template.extraText) {
    payload.templateExtra = template.extraText;
  }

  if (template.emphasizeType === 'TEXT') {
    payload.templateTitle = template.emphasizeTitle;
    payload.templateSubtitle = template.emphasizeSubtitle;
  }

  if (uploadedImages.main) {
    payload.templateImageName = uploadedImages.main.templateImageName;
    payload.templateImageUrl = uploadedImages.main.templateImageUrl;
  }

  if (template.emphasizeType === 'ITEM_LIST') {
    if (template.useHeader === true) {
      payload.templateHeader = template.header;
    }

    if (template.useItemList === true) {
      payload.templateItem = {
        list: template.items.map((item) => ({
          description: item.description,
          title: item.title,
        })),
      };

      if (template.useSummary === true) {
        payload.templateItem.summary = {
          description: template.summaryDescription,
          title: template.summaryTitle,
        };
      }
    }

    if (template.useHighlight === true) {
      payload.templateItemHighlight = {
        description: template.highlightDescription,
        title: template.highlightTitle,
      };

      if (uploadedImages.highlight) {
        payload.templateItemHighlight.imageName = uploadedImages.highlight.templateImageName;
        payload.templateItemHighlight.imageUrl = uploadedImages.highlight.templateImageUrl;
      }
    }
  }

  const buttons = normalizeAlimtalkTemplateButtons(template.buttons);
  const quickReplies = normalizeAlimtalkQuickReplies(template.quickReplies);

  validateAlimtalkTemplateCreateActionRules({ buttons, quickReplies });

  if (buttons.length) {
    payload.buttons = buttons;
  }

  if (quickReplies.length) {
    payload.quickReplies = quickReplies;
  }

  return payload;
}

function validateAlimtalkTemplateCreateActionRules({ buttons, quickReplies }) {
  const ruleState = getAlimtalkTemplateActionRuleState({ buttons, quickReplies });

  if (ruleState.exceedsButtonMax === true) {
    throw new Error('버튼은 최대 5개까지 등록할 수 있습니다.');
  }

  if (ruleState.exceedsButtonMaxWithQuickReplies === true) {
    throw new Error('바로가기를 사용하는 템플릿은 버튼을 최대 2개까지 등록할 수 있습니다.');
  }

  if (ruleState.exceedsQuickReplyMax === true) {
    throw new Error('바로가기는 최대 10개까지 등록할 수 있습니다.');
  }

  if (ruleState.hasDuplicateAddChannelButton === true) {
    throw new Error('채널추가 버튼은 한 개만 사용할 수 있습니다.');
  }

  if (ruleState.hasMisplacedAddChannelButton === true) {
    throw new Error('채널추가 버튼은 첫 번째 버튼에서만 사용할 수 있습니다.');
  }
}

function getAlimtalkTemplateMessageType(template) {
  const hasExtra = Boolean(String(template.extraText ?? '').trim());
  const hasAddChannel = (template.buttons ?? []).some((button) => button.buttonType === 'AC');

  if (hasExtra && hasAddChannel) return 'MI';
  if (hasExtra) return 'EX';
  if (hasAddChannel) return 'AD';
  return 'BA';
}

function normalizeAlimtalkTemplateButtons(buttons = []) {
  return [...buttons]
    .sort((left, right) => Number(left.priority ?? 0) - Number(right.priority ?? 0))
    .map((button, index) => normalizeAlimtalkAction({
      ...button,
      name: button.buttonType === 'AC' ? '채널 추가' : button.buttonName,
      ordering: index + 1,
      type: button.buttonType,
    }));
}

function normalizeAlimtalkQuickReplies(quickReplies = []) {
  return quickReplies.map((reply, index) => normalizeAlimtalkAction({
    ...reply,
    ordering: index + 1,
    type: reply.type ?? 'BK',
  }));
}

function normalizeAlimtalkAction(action) {
  return {
    ...(action.chatEvent ? { chatEvent: action.chatEvent } : {}),
    ...(action.chatExtra ? { chatExtra: action.chatExtra } : {}),
    ...(action.linkMo ? { linkMo: action.linkMo } : {}),
    ...(action.linkPc ? { linkPc: action.linkPc } : {}),
    ...(action.schemeAndroid || action.linkAnd ? { schemeAndroid: action.schemeAndroid || action.linkAnd } : {}),
    ...(action.schemeIos || action.linkIos ? { schemeIos: action.schemeIos || action.linkIos } : {}),
    name: action.name,
    ordering: action.ordering,
    type: action.type,
  };
}

function getRequiredImageUploads(template) {
  const uploads = [];

  if (template.imageFileData) {
    uploads.push({
      fileBody: template.imageFileData,
      fileName: template.imageFileInfo?.fileName || 'alimtalk-template-image.png',
      fileType: template.imageFileInfo?.fileType || 'image/png',
      key: 'main',
      kind: 'template',
    });
  }

  if (template.useHighlight === true && template.highlighThumbnailImageUrl) {
    uploads.push({
      fileBody: getBase64ImageBody(template.highlighThumbnailImageUrl),
      fileName: template.highlightThumbnailFileInfo?.fileName || 'alimtalk-item-highlight.png',
      fileType: template.highlightThumbnailFileInfo?.fileType || 'image/png',
      key: 'highlight',
      kind: 'item-highlight',
    });
  }

  return uploads.filter((upload) => upload.fileBody);
}

function getBase64ImageBody(imageDataUrl = '') {
  const value = String(imageDataUrl);
  const separatorIndex = value.indexOf(',');

  return separatorIndex >= 0 ? value.slice(separatorIndex + 1) : value;
}

function focusFirstInvalidField(field) {
  if (!field) {
    return;
  }

  const idByField = {
    senderResourceId: ALIMTALK_TEMPLATE_CREATE_FIELD_IDS.senderResourceId,
    templateCode: ALIMTALK_TEMPLATE_CREATE_FIELD_IDS.templateCode,
    templateContent: 'new-template-content',
    templateName: ALIMTALK_TEMPLATE_CREATE_FIELD_IDS.templateName,
  };
  const element = document.getElementById(idByField[field] ?? field);

  if (element && typeof element.focus === 'function') {
    element.focus();
  }
}

function isAlimtalkTemplateDraftDirty(template) {
  return Boolean(
    template.senderResourceId
    || template.templateCode
    || template.templateName
    || template.templateContent
    || template.extraText
    || template.emphasizeTitle
    || template.emphasizeSubtitle
    || template.imageFileData
    || template.buttons.length
    || template.quickReplies.length
    || template.items.length
  );
}

function getSubmitButtonLabel(submitResult, isSubmitting) {
  if (!isSubmitting) {
    return '템플릿 추가';
  }

  if (submitResult?.stage === 'upload') {
    return '이미지 업로드 중...';
  }

  return '템플릿 추가 중...';
}

function getSubmitPendingTitle(stage) {
  return stage === 'upload' ? '이미지 업로드 중' : '템플릿 등록 요청 중';
}

function getSubmitPendingCopy(stage) {
  return stage === 'upload'
    ? '선택한 알림톡 이미지를 NHN 템플릿 이미지로 업로드하고 있습니다.'
    : '검증된 템플릿 등록 요청을 NHN에 전송하고 있습니다.';
}

function getSubmitErrorTitle(stage) {
  return stage === 'upload' ? '이미지 업로드 실패' : '템플릿 등록 실패';
}

function getSubmitErrorCopy(submitResult) {
  const message = getRelayErrorMessage(submitResult.error, '템플릿 등록 요청을 처리할 수 없습니다.');

  return submitResult.stage === 'upload'
    ? `이미지 업로드 단계에서 실패했습니다. ${message}`
    : `템플릿 등록 단계에서 실패했습니다. ${message}`;
}
