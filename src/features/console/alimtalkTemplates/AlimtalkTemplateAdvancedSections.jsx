import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import { Button, Checkbox, ImageCropDialog } from '../../../components/ui/index.js';
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
  ALIMTALK_TEMPLATE_BUTTON_MAX_WITH_QUICK_REPLIES,
  ALIMTALK_TEMPLATE_QUICK_REPLY_MAX_COUNT,
  getAlimtalkTemplateButtonLimit,
} from './alimtalkTemplateActionRules.js';

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

const SUMMARY_OPTIONS = [
  { value: '원', align: 'right' },
  { value: '₩', align: 'right' },
  { value: '$', align: 'left' },
  { value: '', align: null },
];

export function AlimtalkTemplateAdvancedSections({ onChange, template }) {
  const isImageType = template.emphasizeType === 'IMAGE' || template.emphasizeType === 'ITEM_LIST';
  const isItemListType = template.emphasizeType === 'ITEM_LIST';

  function patchTemplate(patch) {
    onChange(patch);
  }

  return (
    <>
      {isImageType ? <ImageSection onChange={patchTemplate} template={template} /> : null}
      <ButtonSection onChange={patchTemplate} template={template} />
      {isItemListType ? <ItemListSection onChange={patchTemplate} template={template} /> : null}
    </>
  );
}

function ImageSection({ onChange, template }) {
  const [imageCropFile, setImageCropFile] = useState(null);
  const isRequired = template.emphasizeType === 'IMAGE';
  const isOpen = isRequired || template.visibleImageUploadCollapse === true;
  const imageCheckList = template.imageCheckList ?? DEFAULT_ALIMTALK_IMAGE_CHECKS;
  const fileName = template.imageFileInfo?.fileName ?? '';

  function handleImageFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      setImageCropFile(file);
    }
  }

  function handleImageCropOpenChange(open) {
    if (!open) {
      setImageCropFile(null);
    }
  }

  function handleImageCropApply({ file }) {
    applyAlimtalkImageFile(file, onChange);
  }

  return (
    <section className="alimtalk-template-create-card">
      <div className="alimtalk-template-section-title-row">
        <h2>알림톡 이미지 {isRequired ? '' : '(선택사항)'}</h2>
        {!isRequired ? (
          <button
            aria-expanded={isOpen}
            className="alimtalk-template-icon-button"
            onClick={() => onChange({ visibleImageUploadCollapse: !isOpen })}
            type="button"
          >
            {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        ) : null}
      </div>
      <div className="alimtalk-template-advanced-stack">
        {isOpen ? (
          <>
            <label className="alimtalk-template-field">
              <span>알림톡 이미지 업로드 (JPEG, PNG)</span>
              <input accept="image/jpeg,image/jpg,image/png" onChange={handleImageFileChange} type="file" />
              {fileName ? <small>{fileName}</small> : null}
            </label>
            <ThumbnailCheckList items={imageCheckList} />
          </>
        ) : null}
        <div className="alimtalk-template-inline-actions">
          <Button disabled variant="secondary">
            웹에서 이미지 만들기
          </Button>
        </div>
        <div className="alimtalk-template-type-help">
          <span>도움말</span>
          <p>아래 알림톡 이미지 가이드를 반드시 지켜야합니다.</p>
          <p>가이드 미준수 시 알림톡 검수 반려</p>
        </div>
      </div>
      <ImageCropDialog
        file={imageCropFile}
        onApply={handleImageCropApply}
        onOpenChange={handleImageCropOpenChange}
        open={Boolean(imageCropFile)}
        preset="ALIMTALK_MAIN_IMAGE"
      />
    </section>
  );
}

function ButtonSection({ onChange, template }) {
  const buttons = template.buttons ?? [];
  const quickReplies = template.quickReplies ?? [];
  const buttonLimit = getAlimtalkTemplateButtonLimit({ quickReplyCount: quickReplies.length });
  const hasTooManyButtonsForQuickReplies = buttons.length > ALIMTALK_TEMPLATE_BUTTON_MAX_WITH_QUICK_REPLIES;

  function updateButton(index, patch) {
    onChange({ buttons: buttons.map((button, buttonIndex) => (buttonIndex === index ? { ...button, ...patch } : button)) });
  }

  return (
    <section className="alimtalk-template-create-card">
      <h2>알림톡 버튼 (선택사항)</h2>
      <div className="alimtalk-template-advanced-stack">
        {buttons.map((button, index) => (
          <ActionRow key={`button-${index}`} onDelete={() => onChange({ buttons: buttons.filter((_, itemIndex) => itemIndex !== index) })}>
            <label className="alimtalk-template-field">
              <span>버튼명</span>
              <input
                onChange={(event) => updateButton(index, { buttonName: event.target.value })}
                type="text"
                value={button.buttonName}
              />
            </label>
            <label className="alimtalk-template-field">
              <span>버튼 타입</span>
              <select
                onChange={(event) => updateButton(index, getButtonTypePatch(event.target.value, index))}
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
              </select>
            </label>
            <label className="alimtalk-template-field">
              <span>모바일</span>
              <input onChange={(event) => updateButton(index, { linkMo: event.target.value })} type="text" value={button.linkMo ?? ''} />
            </label>
            <label className="alimtalk-template-field">
              <span>컴퓨터</span>
              <input onChange={(event) => updateButton(index, { linkPc: event.target.value })} type="text" value={button.linkPc ?? ''} />
            </label>
          </ActionRow>
        ))}
        <Button
          disabled={buttons.length >= buttonLimit}
          onClick={() => onChange({ buttons: [...buttons, createButton(buttons.length)] })}
          variant="secondary"
        >
          <Plus size={14} />
          버튼 추가
        </Button>
        {quickReplies.map((reply, index) => (
          <ActionRow key={`reply-${index}`} onDelete={() => onChange({ quickReplies: quickReplies.filter((_, itemIndex) => itemIndex !== index) })}>
            <label className="alimtalk-template-field">
              <span>Quick reply</span>
              <input
                onChange={(event) => onChange({ quickReplies: quickReplies.map((item, itemIndex) => (itemIndex === index ? { ...item, name: event.target.value } : item)) })}
                type="text"
                value={reply.name}
              />
            </label>
          </ActionRow>
        ))}
        <Button
          disabled={quickReplies.length >= ALIMTALK_TEMPLATE_QUICK_REPLY_MAX_COUNT || hasTooManyButtonsForQuickReplies}
          onClick={() => onChange({ quickReplies: [...quickReplies, { name: '', type: 'BK' }] })}
          variant="secondary"
        >
          <Plus size={14} />
          Quick reply 추가
        </Button>
      </div>
    </section>
  );
}

function ItemListSection({ onChange, template }) {
  const [thumbnailCropFile, setThumbnailCropFile] = useState(null);
  const items = template.items ?? [];
  const thumbnailCheckList = template.highlightThumbnailCheckList ?? DEFAULT_HIGHLIGHT_THUMBNAIL_CHECKS;

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
    applyThumbnailFile(file, onChange);
  }

  return (
    <section className="alimtalk-template-create-card">
      <h2>아이템 리스트 설정</h2>
      <div className="alimtalk-template-advanced-stack">
        <CheckedField checked={template.useHeader} label="헤더 사용" onCheckedChange={(useHeader) => onChange({ useHeader })}>
          <input
            disabled={template.useHeader !== true}
            onChange={(event) => onChange({ header: event.target.value.slice(0, 16) })}
            placeholder="헤더 입력. 변수 포함 가능. (16자 이내)"
            type="text"
            value={template.header}
          />
        </CheckedField>

        <CheckedField checked={template.useHighlight} label="하이라이트 사용" onCheckedChange={(useHighlight) => onChange({ useHighlight })}>
          <input disabled={template.useHighlight !== true} onChange={(event) => onChange({ highlightTitle: event.target.value.slice(0, 30) })} placeholder="하이라이트 제목" type="text" value={template.highlightTitle} />
          <input disabled={template.useHighlight !== true} onChange={(event) => onChange({ highlightDescription: event.target.value.slice(0, 16) })} placeholder="하이라이트 설명" type="text" value={template.highlightDescription} />
          <label className="alimtalk-template-field">
            <span>하이라이트 썸네일 (선택사항)</span>
            <input accept="image/jpeg,image/jpg,image/png" disabled={template.useHighlight !== true} onChange={handleThumbnailFileChange} type="file" />
          </label>
          {template.useHighlight === true ? <ThumbnailCheckList items={thumbnailCheckList} /> : null}
        </CheckedField>

        <CheckedField checked={template.useItemList} label="목록 사용" onCheckedChange={(useItemList) => onChange({ useItemList })}>
          {items.map((item, index) => (
            <ActionRow key={`item-${index}`} onDelete={() => onChange({ items: items.filter((_, itemIndex) => itemIndex !== index) })}>
              <input disabled={template.useItemList !== true} onChange={(event) => updateItem(items, index, { title: event.target.value }, onChange)} placeholder="항목명" type="text" value={item.title} />
              <input disabled={template.useItemList !== true} onChange={(event) => updateItem(items, index, { description: event.target.value }, onChange)} placeholder="항목값" type="text" value={item.description} />
            </ActionRow>
          ))}
          <Button disabled={template.useItemList !== true || items.length >= 10} onClick={() => onChange({ items: [...items, { title: '', description: '' }] })} variant="secondary">
            <Plus size={14} />
            목록 추가
          </Button>
        </CheckedField>

        <CheckedField checked={template.useSummary} label="합계 단락 사용" onCheckedChange={(useSummary) => onChange({ useSummary })}>
          <input disabled={template.useSummary !== true} onChange={(event) => onChange({ summaryTitle: event.target.value.slice(0, 6) })} placeholder="총합" type="text" value={template.summaryTitle} />
          <Checkbox checked={template.useSummaryVariable} label="변수 사용하기" onCheckedChange={(useSummaryVariable) => onChange({ useSummaryVariable, summaryDescription: useSummaryVariable ? '#{합계}원' : getSummaryDescription(template.summaryDescription, SUMMARY_OPTIONS[template.selectedSummaryOptionIndex]) })} />
          <input disabled={template.useSummary !== true} onChange={(event) => onChange({ summaryDescription: event.target.value.slice(0, template.useSummaryVariable ? 11 : 14) })} placeholder={template.useSummaryVariable ? '#{합계}원' : '1,000,000'} type="text" value={template.summaryDescription} />
          <div className="alimtalk-template-inline-actions">
            {SUMMARY_OPTIONS.map((option, index) => (
              <button key={`${option.value}-${index}`} onClick={() => onChange({ selectedSummaryOptionIndex: index, summaryDescription: getSummaryDescription(template.summaryDescription, option) })} type="button">
                {option.value || '없음'}
              </button>
            ))}
          </div>
        </CheckedField>
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

function CheckedField({ checked, children, label, onCheckedChange }) {
  return (
    <div className="alimtalk-template-checked-field">
      <Checkbox checked={checked} label={label} onCheckedChange={onCheckedChange} />
      <div className="alimtalk-template-checked-body">{children}</div>
    </div>
  );
}

function ThumbnailCheckList({ items }) {
  return (
    <ul className="alimtalk-template-checklist" aria-live="polite">
      {items.map((item) => (
        <li data-checked={item.checked ? 'true' : undefined} data-error={item.error ? 'true' : undefined} key={item.label}>
          <span className="alimtalk-template-checklist-icon" aria-hidden="true">
            {item.error ? <X size={13} /> : <Check size={13} />}
          </span>
          <span>{item.error && item.errorLabel ? item.errorLabel : item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function ActionRow({ children, onDelete }) {
  return (
    <div className="alimtalk-template-action-row">
      <div className="alimtalk-template-action-grid">{children}</div>
      <button aria-label="제거" className="alimtalk-template-icon-button" onClick={onDelete} type="button">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function createButton(index) {
  return { buttonName: '', buttonType: 'WL', linkAnd: '', linkIos: '', linkMo: '', linkPc: '', priority: index };
}

function getButtonTypePatch(buttonType, index) {
  const nextButtonType = index > 0 && buttonType === ALIMTALK_TEMPLATE_ADD_CHANNEL_BUTTON_TYPE ? 'WL' : buttonType;

  return nextButtonType === ALIMTALK_TEMPLATE_ADD_CHANNEL_BUTTON_TYPE
    ? { buttonName: '채널 추가', buttonType: nextButtonType, priority: -1 }
    : { buttonType: nextButtonType, priority: index };
}

function getSummaryDescription(value, option) {
  const numericValue = String(value ?? '').replace(/[^0-9,.]/g, '').slice(0, 14 - (option.value?.length || 0));
  return `${option.align === 'left' ? option.value : ''}${numericValue}${option.align === 'right' ? option.value : ''}`;
}

function updateItem(items, index, patch, onChange) {
  onChange({ items: items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) });
}

function applyThumbnailFile(file, onChange) {
  function failRead() {
    onChange(createHighlightThumbnailReadFailurePatch({
      fileSize: file.size,
      fileType: file.type,
    }));
  }

  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const image = new Image();
    image.addEventListener('load', () => {
      onChange(createHighlightThumbnailPatch({
        fileSize: file.size,
        fileType: file.type,
        height: image.height,
        imageDataUrl: String(reader.result),
        width: image.width,
      }));
    });
    image.addEventListener('error', failRead);
    image.src = String(reader.result);
  });
  reader.addEventListener('error', failRead);
  reader.readAsDataURL(file);
}

function applyAlimtalkImageFile(file, onChange) {
  function failRead() {
    onChange(createAlimtalkImageReadFailurePatch({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    }));
  }

  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const image = new Image();
    image.addEventListener('load', () => {
      onChange(createAlimtalkImagePatch({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        height: image.height,
        imageDataUrl: String(reader.result),
        width: image.width,
      }));
    });
    image.addEventListener('error', failRead);
    image.src = String(reader.result);
  });
  reader.addEventListener('error', failRead);
  reader.readAsDataURL(file);
}
