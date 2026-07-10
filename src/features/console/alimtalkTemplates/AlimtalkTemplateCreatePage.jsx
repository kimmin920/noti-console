'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft } from 'lucide-react';
import { Button, Checkbox, KakaoTemplatePreview } from '../../../components/ui/index.js';
import { useConsoleNavigation } from '../ConsoleNavigationContext.jsx';
import { AlimtalkTemplateAdvancedSections } from './AlimtalkTemplateAdvancedSections.jsx';
import {
  getAlimtalkTemplateMaxContentLength,
  validateAlimtalkTemplateAdvancedSections,
  validateAlimtalkTemplateContent,
} from './alimtalkTemplateValidation.js';

const TEMPLATE_TYPE_OPTIONS = [
  {
    description: '특별한 강조 없이 글자만 포함하는 알림톡을 발송할 때 사용합니다.\n간단한 알림이나 안내문구 등 정갈한 안내 표현이 가능합니다.',
    label: '기본형',
    value: 'NONE',
  },
  {
    description: '알림톡에 강조 제목을 표기합니다.\n강조 하고싶은 문구가 있는 경우 주로 사용하며, 수신자에게 중요한 내용을 바로 인지시킬 수 있습니다.',
    label: '강조표기형',
    value: 'TEXT',
  },
  {
    description: '알림톡에 이미지를 첨부합니다.\n차별화된 브랜딩을 제공하고 싶은 경우 주로 사용하며, 완성도 높은 메시지를 전달하여 기업 신뢰도를 한층 높일 수 있습니다.',
    label: '이미지첨부형',
    value: 'IMAGE',
  },
  {
    description: '알림톡에 리스트를 추가합니다.\n영수증이나 구매물품 등 항목 표현이 필요한 경우 주로 사용하며, 표 형식으로 출력되어 정리된 정보를 한눈에 볼 수 있습니다.',
    label: '리스트형',
    value: 'ITEM_LIST',
  },
];

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
  highlightThumbnailCheckList: null,
  highlightDescription: '',
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
  selectedSummaryOptionIndex: 0,
  summaryDescription: '',
  summaryTitle: '',
  templateContent: '',
  templateName: '',
  useHeader: false,
  useHighlight: false,
  useItemList: false,
  useSummary: false,
  useSummaryVariable: false,
  visibleImageUploadCollapse: false,
};

function getContentSizeLabel(template) {
  const maxLength = getAlimtalkTemplateMaxContentLength(template.emphasizeType);
  const currentLength = template.templateContent.length
    + template.extraText.length
    + (template.emphasizeType === 'TEXT' ? 36 : 0);

  return {
    currentLength,
    maxLength,
  };
}

export function AlimtalkTemplateCreatePage({ onBack }) {
  const navigation = useConsoleNavigation();
  const [template, setTemplate] = useState(INITIAL_TEMPLATE);
  const [confirmed, setConfirmed] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const errors = useMemo(() => [
    ...validateAlimtalkTemplateContent(template),
    ...validateAlimtalkTemplateAdvancedSections(template),
  ], [template]);
  const selectedType = TEMPLATE_TYPE_OPTIONS.find((option) => option.value === template.emphasizeType)
    ?? TEMPLATE_TYPE_OPTIONS[0];
  const showsTextEmphasis = template.emphasizeType === 'TEXT';
  const showsImage = template.emphasizeType === 'IMAGE' || template.emphasizeType === 'ITEM_LIST';
  const showsItemList = template.emphasizeType === 'ITEM_LIST';
  const { currentLength, maxLength } = getContentSizeLabel(template);
  const hasErrors = errors.length > 0;

  function updateTemplate(patch) {
    setTemplate((current) => ({
      ...current,
      ...patch,
    }));
  }

  function handleTypeChange(emphasizeType) {
    updateTemplate({ emphasizeType });
  }

  function validateLocally() {
    setSubmitAttempted(true);
  }

  function returnToList() {
    if (onBack) {
      onBack();
      return;
    }

    navigation.push('/templates');
  }

  return (
    <section className="page-frame alimtalk-template-create-page">
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

      <div className="alimtalk-template-create-intro">
        <p>카카오 알림톡 템플릿은 수신자가 꼭 받아야하는 정보성 메시지만 등록이 가능합니다!</p>
        <p>예시) 회원가입 환영, 배송정보, 쿠폰소멸안내 등등..</p>
        <div className="alimtalk-template-create-guide-actions">
          <a href="https://kakaobusiness.gitbook.io/main/ad/bizmessage/notice-friend/content-guide" rel="noreferrer" target="_blank">
            템플릿 제작 가이드
          </a>
          <a href="https://kakaobusiness.gitbook.io/main/ad/bizmessage/notice-friend/audit" rel="noreferrer" target="_blank">
            필독! 심사 가이드
          </a>
        </div>
      </div>

      <div className="alimtalk-template-create-layout">
        <div className="alimtalk-template-create-main">
          <section className="alimtalk-template-create-card">
            <h2>템플릿 유형</h2>
            <div className="alimtalk-template-type-grid" role="radiogroup" aria-label="템플릿 유형">
              {TEMPLATE_TYPE_OPTIONS.map((option) => {
                const selected = option.value === template.emphasizeType;

                return (
                  <button
                    aria-checked={selected}
                    className="alimtalk-template-type-card"
                    data-selected={selected ? 'true' : undefined}
                    key={option.value}
                    onClick={() => handleTypeChange(option.value)}
                    role="radio"
                    type="button"
                  >
                    <span className="alimtalk-template-type-radio" aria-hidden="true" />
                    <strong>{option.label}</strong>
                  </button>
                );
              })}
            </div>
            <div className="alimtalk-template-type-help">
              <span>도움말</span>
              <p>{selectedType.description}</p>
            </div>
          </section>

          <section className="alimtalk-template-create-card">
            <h2>템플릿 내용</h2>
            <div className="alimtalk-template-content-fields">
              <label className="alimtalk-template-field">
                <span>템플릿 이름 (선택사항)</span>
                <input
                  onChange={(event) => updateTemplate({ templateName: event.target.value.slice(0, 90) })}
                  placeholder="회원가입 환영"
                  type="text"
                  value={template.templateName}
                />
                <small>수신자에게 공개되지 않습니다. 추후 변경 가능!</small>
              </label>

              {showsTextEmphasis ? (
                <>
                  <label className="alimtalk-template-field">
                    <span>강조표기 제목</span>
                    <input
                      onChange={(event) => updateTemplate({ emphasizeTitle: event.target.value.slice(0, 50) })}
                      placeholder="환영합니다!"
                      type="text"
                      value={template.emphasizeTitle}
                    />
                    <small>최대 50자 이내 (변수 사용 가능)</small>
                  </label>
                  <label className="alimtalk-template-field">
                    <span>강조표기 보조문구</span>
                    <input
                      onChange={(event) => updateTemplate({ emphasizeSubtitle: event.target.value.slice(0, 50) })}
                      placeholder="솔라피에 오신걸 진심으로 환영합니다"
                      type="text"
                      value={template.emphasizeSubtitle}
                    />
                    <small>최대 50자 이내</small>
                  </label>
                </>
              ) : null}

              <label className="alimtalk-template-field">
                <span>내용</span>
                <textarea
                  onChange={(event) => updateTemplate({ templateContent: event.target.value.slice(0, 2000) })}
                  placeholder={'#{홍길동}님 솔라피에 오신걸 진심으로 환영합니다!\n\n이 메시지는 솔라피 회원가입 시 알림 수신에 동의한 회원님께 발송됩니다.'}
                  rows={7}
                  value={template.templateContent}
                />
              </label>

              <label className="alimtalk-template-field">
                <span>부가정보 (선택사항)</span>
                <textarea
                  onChange={(event) => updateTemplate({ extraText: event.target.value.slice(0, 500) })}
                  placeholder="고객센터 운영시간: 오전 9시 ~ 오후 5시"
                  rows={3}
                  value={template.extraText}
                />
                <small>변수 사용 불가</small>
              </label>

              <div className="alimtalk-template-character-count" data-invalid={currentLength > maxLength ? 'true' : undefined}>
                현재 <strong>{currentLength.toLocaleString('ko-KR')}</strong>자
                {showsTextEmphasis ? ' + (변수내용)' : ''} / 최대 {maxLength.toLocaleString('ko-KR')}자
              </div>

              <div className="alimtalk-template-security">
                <Checkbox
                  checked={template.securityFlag}
                  label={(
                    <>
                      보안 템플릿
                      <span>{template.securityFlag ? '(사용중)' : '(사용안함)'}</span>
                    </>
                  )}
                  onCheckedChange={(securityFlag) => updateTemplate({ securityFlag })}
                />
                <div className="alimtalk-template-type-help">
                  <span>도움말</span>
                  <p>
                    {'\'보안 템플릿\' 사용 시 '}
                    <strong>모바일 카카오톡</strong>
                    에서만 알림톡을 열람할 수 있습니다.
                  </p>
                  <p>비밀번호, 인증번호 등 민감정보를 포함하는 경우 카카오측에서 보안템플릿으로 설정할 수 있습니다.</p>
                </div>
              </div>

              {hasErrors ? (
                <div className="alimtalk-template-validation" role="alert">
                  <ul>
                    {errors.map((error) => (
                      <li key={error.message}>{error.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>

          <AlimtalkTemplateAdvancedSections onChange={updateTemplate} template={template} />

          <section className="alimtalk-template-warning-card">
            <div className="alimtalk-template-warning-header">
              <AlertTriangle size={18} />
              <span>다음에 해당하면 템플릿이 반려됩니다</span>
            </div>
            <div className="alimtalk-template-warning-list">
              {REJECTION_CONSTRAINTS.map((constraint) => (
                <div className="alimtalk-template-warning-item" key={constraint}>
                  <span aria-hidden="true" />
                  <p>{constraint}</p>
                </div>
              ))}
            </div>
            <div className="alimtalk-template-warning-links">
              <a href="https://kakaobusiness.gitbook.io/main/ad/bizmessage/notice-friend/audit" rel="noreferrer" target="_blank">
                심사 가이드
              </a>
              <a href="https://kakaobusiness.gitbook.io/main/ad/bizmessage/notice-friend/content-guide" rel="noreferrer" target="_blank">
                제작 가이드
              </a>
            </div>
            <Checkbox
              checked={confirmed}
              className="alimtalk-template-warning-confirm"
              label="위 내용을 확인했으며 해당 사항이 없습니다."
              onCheckedChange={setConfirmed}
            />
            {!confirmed ? (
              <div className="alimtalk-template-warning-note" role="status">
                템플릿 검수 유의 사항을 확인해주세요.
              </div>
            ) : null}
            <Button disabled={!confirmed} onClick={validateLocally} variant="primary">
              템플릿 등록 완료
            </Button>
            {submitAttempted && hasErrors ? (
              <div className="alimtalk-template-warning-note" role="alert">
                {errors[0].message}
              </div>
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
            highlightThumbnailImageId={showsItemList && template.useHighlight ? template.highlightThumbnailImageId : ''}
            highlightTitle={showsItemList && template.useHighlight ? template.highlightTitle : ''}
            imageId={showsImage && !template.imageFileData ? template.imageId : ''}
            imageUrl={showsImage && template.imageFileData ? `${template.imageSrcPrefix}${template.imageFileData}` : ''}
            items={showsItemList && template.useItemList ? template.items : []}
            quickReplies={template.quickReplies}
            summaryDescription={showsItemList && template.useItemList && template.useSummary ? template.summaryDescription : ''}
            summaryTitle={showsItemList && template.useItemList && template.useSummary ? template.summaryTitle : ''}
            text={template.templateContent}
          />
        </aside>
      </div>
    </section>
  );
}
