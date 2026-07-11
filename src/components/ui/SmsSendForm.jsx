'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, X } from 'lucide-react';
import {
  defaultEmailSendFormSchedules,
  defaultEmailSendFormSegments,
  EmailSendFormCanvas,
  EmailSendFormDisclosure,
  EmailSendFormEmptyState,
  EmailSendFormGhostButton,
  EmailSendFormInput,
  EmailSendFormLabel,
  EmailSendFormRoot,
  EmailSendFormRow,
  EmailSendFormScheduleField,
  EmailSendFormSelect,
  EmailSendFormSelection,
  EmailSendFormTemplateButton,
  EmailSendFormTemplateDialog,
  EmailSendFormTextarea,
} from './EmailSendForm.jsx';
import { ImageCropDialog } from './ImageCropDialog.jsx';
import {
  getMessageTemplateVariableValue,
  getInitialTemplateVariables,
  getTemplateVariableDetails,
  MessageTemplateDocument,
  MessageTemplateVariablePanel,
} from './MessageTemplateVariables.jsx';
import { getSmsTemplateDialogItems } from './MessageTemplateDialogAdapters.jsx';
import { RecipientSelect } from './RecipientSelect.jsx';

const SMS_MAX_BYTES = 90;
const SMS_LONG_MAX_BYTES = 2000;
const BYTES_PER_KB = 1024;

export const smsMmsAttachmentConstraints = {
  acceptedExtensions: ['.jpg', '.jpeg'],
  acceptedMimeTypes: ['image/jpeg'],
  accept: '.jpg,.jpeg,image/jpeg',
  maxCount: 3,
  maxFileBytes: 300 * BYTES_PER_KB,
  maxFileNameLength: 45,
  maxHeight: 1000,
  maxTotalBytesWhenMaxCount: 800 * BYTES_PER_KB,
  maxWidth: 1000,
  uploadPath: '/sms/v3.0/appKeys/{appKey}/attachfile/binaryUpload',
  sendPaths: {
    mms: '/sms/v3.0/appKeys/{appKey}/sender/mms',
    adMms: '/sms/v3.0/appKeys/{appKey}/sender/ad-mms',
  },
};

export const defaultSmsSendFormSenderNumbers = [
  { label: '대표번호 1544-0000', value: '1544-0000' },
  { label: '서울지점 02-1234-5678', value: '02-1234-5678' },
  { label: '운영팀 010-9876-5432', value: '010-9876-5432' },
];

export const defaultSmsSendFormUnsubscribeNumbers = [
  { label: '080-123-4567', value: '080-123-4567' },
  { label: '080-987-6543', value: '080-987-6543' },
];

export const defaultSmsSendFormTemplates = [
  {
    attachFileIdList: [],
    body: '##customerName##님 안녕하세요.\n주문하신 ##productName## 배송이 완료되었습니다.\n문의: ##supportPhone##',
    categoryId: 199376,
    id: 'sms-template-delivery-complete',
    name: '배송 완료 안내',
    previewText: 'NHN SMS 템플릿 발송 예시',
    messageType: 'LMS',
    sendNo: '1544-0000',
    sendType: '1',
    subject: '배송 완료 안내',
    templateDesc: '템플릿 발송 시 templateParameter로 고객별 값을 치환합니다.',
    templateId: 'SMS_DELIVERY_COMPLETE',
    templateName: '배송 완료 안내',
    templateParameter: {
      customerName: '김민준',
      productName: '오가닉 티셔츠',
      supportPhone: '1544-0000',
    },
    title: '배송 완료 안내',
    useYn: 'Y',
    value: 'sms-template-delivery-complete',
    variables: [
      { fallbackValue: '고객', key: 'customerName', type: 'string' },
      { fallbackValue: '주문 상품', key: 'productName', type: 'string' },
      { fallbackValue: '1544-0000', key: 'supportPhone', type: 'string' },
    ],
  },
  {
    attachFileIdList: [],
    body: '##customerName##님, ##reservationDate## 예약이 확정되었습니다.\n예약번호: ##reservationNo##\n변경은 ##supportPhone##으로 문의해 주세요.',
    categoryId: 199376,
    id: 'sms-template-reservation-confirmed',
    name: '예약 확정 안내',
    previewText: 'NHN SMS templateParameter 치환 예시',
    messageType: 'LMS',
    sendNo: '02-1234-5678',
    sendType: '1',
    subject: '예약 확정 안내',
    templateDesc: '본문 수정 없이 templateId와 templateParameter로 발송하는 LMS 템플릿입니다.',
    templateId: 'SMS_RESERVATION_CONFIRMED',
    templateName: '예약 확정 안내',
    templateParameter: {
      customerName: '이지현',
      reservationDate: '6월 3일 오후 2시',
      reservationNo: 'R-20260603-014',
      supportPhone: '02-1234-5678',
    },
    title: '예약 확정 안내',
    useYn: 'Y',
    value: 'sms-template-reservation-confirmed',
    variables: [
      { fallbackValue: '고객', key: 'customerName', type: 'string' },
      { fallbackValue: '예약일', key: 'reservationDate', type: 'string' },
      { fallbackValue: '예약번호', key: 'reservationNo', type: 'string' },
      { fallbackValue: '02-1234-5678', key: 'supportPhone', type: 'string' },
    ],
  },
];

export const defaultSmsSendFormValue = {
  body: '',
  imageAttachments: [],
  imageName: '',
  isAdvertisement: false,
  managementTitle: '',
  recipient: 'all',
  scheduledAt: '',
  senderNumber: '1544-0000',
  templateId: '',
  templateParameter: {},
  unsubscribeNumber: '080-123-4567',
  variables: {},
};

function normalizeSmsImageAttachments(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((attachment, index) => {
    const fileName = attachment.fileName ?? attachment.name ?? '';

    return {
      file: attachment.file,
      fileBody: attachment.fileBody ?? '',
      fileId: attachment.fileId ?? null,
      fileName,
      filePath: attachment.filePath ?? '',
      height: Number.isFinite(attachment.height) ? attachment.height : null,
      id: attachment.id ?? `${fileName}-${attachment.size ?? index}-${index}`,
      name: attachment.name ?? fileName,
      previewUrl: attachment.previewUrl ?? '',
      size: Number.isFinite(attachment.size) ? attachment.size : 0,
      type: attachment.type ?? 'image/jpeg',
      uploadRequestPreview: attachment.uploadRequestPreview,
      width: Number.isFinite(attachment.width) ? attachment.width : null,
    };
  }).filter((attachment) => attachment.fileName);
}

function getSmsAttachmentNames(attachments) {
  return attachments.map((attachment) => attachment.fileName).filter(Boolean).join(', ');
}

function getSmsSendFormValue(value) {
  const mergedValue = { ...defaultSmsSendFormValue, ...value };
  const imageAttachments = normalizeSmsImageAttachments(
    mergedValue.imageAttachments ?? mergedValue.attachments
  );
  const templateParameter = mergedValue.templateParameter ?? {};
  const variables = Object.keys(mergedValue.variables ?? {}).length
    ? mergedValue.variables
    : templateParameter;

  return {
    ...mergedValue,
    body: mergedValue.body ?? '',
    imageAttachments,
    imageName: imageAttachments.length ? getSmsAttachmentNames(imageAttachments) : mergedValue.imageName ?? '',
    isAdvertisement: Boolean(mergedValue.isAdvertisement),
    managementTitle: mergedValue.managementTitle ?? '',
    recipient: mergedValue.recipient ?? '',
    scheduledAt: mergedValue.scheduledAt ?? '',
    senderNumber: mergedValue.senderNumber ?? '',
    templateId: mergedValue.templateId ?? '',
    templateParameter,
    unsubscribeNumber: mergedValue.unsubscribeNumber ?? '',
    variables,
  };
}

function getSmsByteLength(value) {
  return Array.from(value).reduce((total, character) => (
    total + (character.charCodeAt(0) > 127 ? 2 : 1)
  ), 0);
}

function getSmsMessageType({ bodyBytes, imageAttachmentCount, imageName }) {
  if (imageAttachmentCount > 0 || imageName) {
    return 'MMS';
  }

  return bodyBytes > SMS_MAX_BYTES ? 'LMS' : 'SMS';
}

export function getSmsSendFormMessageType(value) {
  const message = getSmsSendFormValue(value);

  return getSmsMessageType({
    bodyBytes: getSmsByteLength(message.body),
    imageAttachmentCount: message.imageAttachments.length || (message.imageName ? 1 : 0),
    imageName: message.imageName,
  });
}

function formatSmsAttachmentTagLabel(fileName) {
  const characters = Array.from(fileName);

  if (characters.length <= 4) {
    return fileName;
  }

  return `${characters.slice(0, 4).join('')}...`;
}

function getSmsAttachmentExtension(fileName) {
  const extension = fileName.split('.').pop()?.toLowerCase();

  return extension ? `.${extension}` : '';
}

function readSmsAttachmentDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getBase64FromDataUrl(dataUrl) {
  return String(dataUrl).split(',')[1] ?? '';
}

function readSmsAttachmentDimensions(dataUrl) {
  if (typeof Image === 'undefined') {
    return Promise.resolve({ height: null, width: null });
  }

  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve({ height: image.naturalHeight, width: image.naturalWidth });
    image.onerror = () => reject(new Error('Invalid image'));
    image.src = dataUrl;
  });
}

function validateSmsAttachmentFile(file, nextAttachments) {
  const extension = getSmsAttachmentExtension(file.name);
  const isAcceptedExtension = smsMmsAttachmentConstraints.acceptedExtensions.includes(extension);
  const nextTotalBytes = nextAttachments.reduce((total, attachment) => total + attachment.size, 0) + file.size;

  if (!isAcceptedExtension) {
    return 'JPG 또는 JPEG 이미지만 첨부할 수 있습니다.';
  }

  if (file.name.length > smsMmsAttachmentConstraints.maxFileNameLength) {
    return '이미지 파일 이름은 45자 이하여야 합니다.';
  }

  if (file.size > smsMmsAttachmentConstraints.maxFileBytes) {
    return '이미지는 1개당 300KB 이하여야 합니다.';
  }

  if (nextAttachments.length + 1 > smsMmsAttachmentConstraints.maxCount) {
    return '이미지는 최대 3개까지 첨부할 수 있습니다.';
  }

  if (
    nextAttachments.length + 1 === smsMmsAttachmentConstraints.maxCount
    && nextTotalBytes > smsMmsAttachmentConstraints.maxTotalBytesWhenMaxCount
  ) {
    return '이미지 3개 첨부 시 합산 800KB 이하여야 합니다.';
  }

  return '';
}

function validateSmsAttachmentSelection(file, nextAttachmentCount) {
  const extension = getSmsAttachmentExtension(file.name);
  const isAcceptedExtension = smsMmsAttachmentConstraints.acceptedExtensions.includes(extension);

  if (!isAcceptedExtension) {
    return 'JPG 또는 JPEG 이미지만 첨부할 수 있습니다.';
  }

  if (file.name.length > smsMmsAttachmentConstraints.maxFileNameLength) {
    return '이미지 파일 이름은 45자 이하여야 합니다.';
  }

  if (nextAttachmentCount + 1 > smsMmsAttachmentConstraints.maxCount) {
    return '이미지는 최대 3개까지 첨부할 수 있습니다.';
  }

  return '';
}

function validateSmsAttachmentDimensions({ height, width }) {
  if (
    width > smsMmsAttachmentConstraints.maxWidth
    || height > smsMmsAttachmentConstraints.maxHeight
  ) {
    return '이미지 해상도는 1000x1000 이하여야 합니다.';
  }

  return '';
}

function createSmsAttachmentId(file) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
}

function getSmsTemplateId(template) {
  return template?.value ?? template?.templateId ?? template?.id ?? '';
}

function getSmsTemplateParameterFromVariables(variables) {
  return Object.keys(variables ?? {}).reduce((parameters, key) => ({
    ...parameters,
    [key]: getMessageTemplateVariableValue(variables, key),
  }), {});
}

export function SmsSendForm({
  className = '',
  defaultValue,
  onChange,
  onRecipientCreate,
  onSenderNumberCreate,
  onTemplateSelect,
  recipientContacts,
  recipientCreateLabel,
  recipientSelectProps,
  recipients = defaultEmailSendFormSegments,
  scheduleOptions = defaultEmailSendFormSchedules,
  senderNumberCreateLabel = '발신번호 추가하기',
  senderNumbers = defaultSmsSendFormSenderNumbers,
  templates = defaultSmsSendFormTemplates,
  unsubscribeNumbers = defaultSmsSendFormUnsubscribeNumbers,
  value,
  variablePanelRoot,
  ...props
}) {
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(() => getSmsSendFormValue(defaultValue));
  const message = getSmsSendFormValue(isControlled ? value : uncontrolledValue);
  const [scheduleVisible, setScheduleVisible] = useState(() => Boolean(message.scheduledAt));
  const [imageVisible, setImageVisible] = useState(() => Boolean(message.imageName || message.imageAttachments.length));
  const [imageCropQueue, setImageCropQueue] = useState([]);
  const [imageReviewMessage, setImageReviewMessage] = useState('');
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [activeVariableKey, setActiveVariableKey] = useState('');
  const templateDialogItems = useMemo(() => getSmsTemplateDialogItems(templates), [templates]);
  const selectedTemplate = templates.find((template) => getSmsTemplateId(template) === message.templateId) ?? null;
  const selectedVariable = useMemo(() => (
    getTemplateVariableDetails(selectedTemplate, message.variables, activeVariableKey, 'sms')
  ), [activeVariableKey, message.variables, selectedTemplate]);
  const bodyBytes = useMemo(() => getSmsByteLength(message.body), [message.body]);
  const bodyLengthWarning = bodyBytes > SMS_LONG_MAX_BYTES
    ? `LMS/MMS는 ${SMS_LONG_MAX_BYTES.toLocaleString()}바이트까지 발송할 수 있습니다. 현재 ${bodyBytes.toLocaleString()}바이트입니다.`
    : '';
  const bodyWarningId = useId();
  const imageInputId = useId();
  const managementTitleInputId = useId();
  const imageInputRef = useRef(null);
  const activeImageCropFile = imageCropQueue[0] ?? null;
  const canAddImage = message.imageAttachments.length < smsMmsAttachmentConstraints.maxCount;
  const isBodyEmpty = !message.body.trim();

  function updateMessage(patch) {
    const nextValue = getSmsSendFormValue({ ...message, ...patch });

    if (!isControlled) {
      setUncontrolledValue(nextValue);
    }

    onChange?.(nextValue);
  }

  function hideScheduleIfEmpty() {
    if (!message.scheduledAt) {
      setScheduleVisible(false);
    }
  }

  function hideScheduleOnEmptyBackspace(event) {
    if (event.key === 'Backspace' && !event.currentTarget.value) {
      setScheduleVisible(false);
    }
  }

  function handleImageChange(event) {
    const files = Array.from(event.target.files ?? []);
    const nextFiles = [];
    let nextReviewMessage = '';

    event.target.value = '';

    for (const file of files) {
      const nextAttachmentCount = message.imageAttachments.length + imageCropQueue.length + nextFiles.length;
      const fileError = validateSmsAttachmentSelection(file, nextAttachmentCount);

      if (fileError) {
        nextReviewMessage ||= fileError;
        continue;
      }

      nextFiles.push(file);
    }

    setImageReviewMessage(nextReviewMessage);

    if (nextFiles.length) {
      setImageCropQueue((queue) => [...queue, ...nextFiles]);
    }
  }

  async function handleCroppedSmsImageApply({ file }) {
    const nextAttachments = [...message.imageAttachments];
    const fileError = validateSmsAttachmentFile(file, nextAttachments);

    if (fileError) {
      setImageReviewMessage(fileError);
      return;
    }

    try {
      const previewUrl = await readSmsAttachmentDataUrl(file);
      const dimensions = await readSmsAttachmentDimensions(previewUrl);
      const dimensionError = validateSmsAttachmentDimensions(dimensions);

      if (dimensionError) {
        setImageReviewMessage(dimensionError);
        return;
      }

      const fileBody = getBase64FromDataUrl(previewUrl);
      const attachment = {
        ...dimensions,
        file,
        fileBody,
        fileName: file.name,
        id: createSmsAttachmentId(file),
        name: file.name,
        previewUrl,
        size: file.size,
        type: file.type || 'image/jpeg',
        uploadRequestPreview: {
          fileBody,
          fileName: file.name,
        },
      };
      const updatedAttachments = [...nextAttachments, attachment];

      setImageReviewMessage('');
      updateMessage({
        imageAttachments: updatedAttachments,
        imageName: getSmsAttachmentNames(updatedAttachments),
      });
    } catch {
      setImageReviewMessage('이미지를 읽을 수 없습니다.');
    }
  }

  function handleSmsImageCropOpenChange(open) {
    if (!open) {
      setImageCropQueue((queue) => queue.slice(1));
    }
  }

  function removeImageAttachment(attachmentId) {
    const nextAttachments = message.imageAttachments.filter((attachment) => attachment.id !== attachmentId);

    setImageReviewMessage('');
    updateMessage({
      imageAttachments: nextAttachments,
      imageName: getSmsAttachmentNames(nextAttachments),
    });
  }

  function clearLegacyImageName() {
    setImageReviewMessage('');
    updateMessage({ imageAttachments: [], imageName: '' });
  }

  function openImageFileDialog() {
    setImageReviewMessage('');
    imageInputRef.current?.click();
  }

  function handleTemplateSelect(template) {
    const templateBody = [template.body, template.content, template.html]
      .find((value) => typeof value === 'string');
    const nextTemplateId = getSmsTemplateId(template);

    setActiveVariableKey('');

    if (templateBody !== undefined) {
      const variables = getInitialTemplateVariables(template, 'sms', message.variables);

      updateMessage({
        body: templateBody,
        templateId: nextTemplateId,
        templateParameter: getSmsTemplateParameterFromVariables(variables),
        variables,
      });
    }

    onTemplateSelect?.(template);
  }

  function clearSelectedTemplate() {
    setActiveVariableKey('');
    updateMessage({
      body: '',
      templateId: '',
      templateParameter: {},
      variables: {},
    });
  }

  function updateTemplateVariable(key, nextAssignment) {
    const nextVariables = {
      ...message.variables,
      [key]: nextAssignment,
    };

    updateMessage({
      templateParameter: {
        ...message.templateParameter,
        [key]: getMessageTemplateVariableValue(nextVariables, key),
      },
      variables: nextVariables,
    });
  }

  return (
    <EmailSendFormRoot className={['sms-send-form-root', className].filter(Boolean).join(' ')} {...props}>
      <EmailSendFormSelection>
        <EmailSendFormRow
          action={!message.isAdvertisement ? (
            <EmailSendFormGhostButton onClick={() => updateMessage({ isAdvertisement: true })}>
              광고성
            </EmailSendFormGhostButton>
          ) : null}
        >
          <EmailSendFormLabel>발신번호</EmailSendFormLabel>
          <EmailSendFormSelect
            ariaLabel="발신번호 선택"
            emptyActionLabel={senderNumberCreateLabel}
            emptyDescription="승인된 발신번호가 없습니다. 발신번호를 등록하면 SMS/LMS/MMS를 발송할 수 있습니다."
            onEmptyAction={onSenderNumberCreate}
            onValueChange={(senderNumber) => updateMessage({ senderNumber })}
            options={senderNumbers}
            placeholder="발신번호 선택"
            showMenuLabel={false}
            value={message.senderNumber}
          />
        </EmailSendFormRow>

        {message.isAdvertisement ? (
          <EmailSendFormDisclosure>
            <EmailSendFormRow
              action={(
                <EmailSendFormGhostButton onClick={() => updateMessage({ isAdvertisement: false })}>
                  해제
                </EmailSendFormGhostButton>
              )}
            >
              <EmailSendFormLabel>080 번호</EmailSendFormLabel>
              <EmailSendFormSelect
                ariaLabel="080 수신거부 번호 선택"
                onValueChange={(unsubscribeNumber) => updateMessage({ unsubscribeNumber })}
                options={unsubscribeNumbers}
                value={message.unsubscribeNumber}
              />
            </EmailSendFormRow>
          </EmailSendFormDisclosure>
        ) : null}

        <EmailSendFormRow
          action={!scheduleVisible ? (
            <EmailSendFormGhostButton onClick={() => setScheduleVisible(true)}>
              예약
            </EmailSendFormGhostButton>
          ) : null}
          className={!scheduleVisible ? 'sms-send-form-row-before-detail-border' : ''}
        >
          <EmailSendFormLabel>수신자</EmailSendFormLabel>
          <RecipientSelect
            {...recipientSelectProps}
            ariaLabel="수신자 선택"
            contacts={recipientContacts}
            emptyActionLabel={recipientCreateLabel}
            onEmptyAction={onRecipientCreate}
            onValueChange={(recipient) => updateMessage({ recipient })}
            options={recipients}
            value={message.recipient}
          />
        </EmailSendFormRow>

        {scheduleVisible ? (
          <EmailSendFormDisclosure>
            <EmailSendFormRow className="sms-send-form-row-before-detail-border">
              <EmailSendFormLabel htmlFor="sms-send-form-when">예약</EmailSendFormLabel>
              <EmailSendFormScheduleField
                id="sms-send-form-when"
                onCollapseEmpty={hideScheduleIfEmpty}
                onEmptyBackspace={hideScheduleOnEmptyBackspace}
                onNowSelect={() => {
                  updateMessage({ scheduledAt: '' });
                  setScheduleVisible(false);
                }}
                onValueChange={(scheduledAt) => updateMessage({ scheduledAt })}
                options={scheduleOptions}
                placeholder="날짜 또는 시간을 입력하세요"
                value={message.scheduledAt}
              />
            </EmailSendFormRow>
          </EmailSendFormDisclosure>
        ) : null}

        {imageVisible ? (
          <EmailSendFormDisclosure>
            <EmailSendFormRow className="sms-send-form-detail-start-row">
              <EmailSendFormLabel htmlFor={imageInputId} warning={imageReviewMessage}>이미지</EmailSendFormLabel>
              <div className="sms-send-form-upload-field">
                <input
                  accept={smsMmsAttachmentConstraints.accept}
                  className="sms-send-form-upload-input"
                  disabled={!canAddImage}
                  id={imageInputId}
                  multiple
                  onChange={handleImageChange}
                  ref={imageInputRef}
                  type="file"
                />
                <div className="sms-send-form-upload-list">
                  {message.imageAttachments.map((attachment) => (
                    <span className="sms-send-form-upload-tag" key={attachment.id}>
                      {attachment.previewUrl ? (
                        <span
                          aria-hidden="true"
                          className="sms-send-form-upload-preview"
                          style={{ backgroundImage: `url(${attachment.previewUrl})` }}
                        />
                      ) : null}
                      <span className="sms-send-form-upload-file">
                        <span title={attachment.fileName}>{formatSmsAttachmentTagLabel(attachment.fileName)}</span>
                      </span>
                      <button
                        aria-label={`${attachment.fileName} 제거`}
                        className="sms-send-form-upload-remove"
                        onClick={() => removeImageAttachment(attachment.id)}
                        type="button"
                      >
                        <X aria-hidden="true" size={14} />
                      </button>
                    </span>
                  ))}
                  {!message.imageAttachments.length && message.imageName ? (
                    <span className="sms-send-form-upload-tag">
                      <span className="sms-send-form-upload-file">
                        <span title={message.imageName}>{formatSmsAttachmentTagLabel(message.imageName)}</span>
                      </span>
                      <button
                        aria-label="첨부 이미지 제거"
                        className="sms-send-form-upload-remove"
                        onClick={clearLegacyImageName}
                        type="button"
                      >
                        <X aria-hidden="true" size={14} />
                      </button>
                    </span>
                  ) : null}
                  {canAddImage ? (
                    <EmailSendFormGhostButton onClick={openImageFileDialog}>
                      <ImagePlus aria-hidden="true" size={14} />
                      업로드
                    </EmailSendFormGhostButton>
                  ) : null}
                  {!canAddImage ? (
                    <EmailSendFormGhostButton disabled>
                      <ImagePlus aria-hidden="true" size={14} />
                      최대 3개
                    </EmailSendFormGhostButton>
                  ) : null}
                </div>
              </div>
            </EmailSendFormRow>
          </EmailSendFormDisclosure>
        ) : null}

        <EmailSendFormRow
          action={!imageVisible ? (
            <EmailSendFormGhostButton onClick={() => setImageVisible(true)}>
              이미지
            </EmailSendFormGhostButton>
          ) : null}
          className={imageVisible ? 'sms-send-form-detail-row' : 'sms-send-form-detail-start-row'}
        >
          <EmailSendFormLabel htmlFor={managementTitleInputId}>발송명</EmailSendFormLabel>
          <EmailSendFormInput
            id={managementTitleInputId}
            maxLength={120}
            onChange={(event) => updateMessage({ managementTitle: event.target.value })}
            placeholder="관리용 발송명"
            value={message.managementTitle}
          />
        </EmailSendFormRow>
      </EmailSendFormSelection>

      <EmailSendFormCanvas aria-label="문자 메시지 본문" data-empty={!selectedTemplate && isBodyEmpty ? 'true' : undefined}>
        {selectedTemplate ? (
          <div className="sms-send-form-template-workspace">
            <MessageTemplateDocument
              activeKey={activeVariableKey}
              className="sms-send-form-template-document"
              onVariableClick={setActiveVariableKey}
              syntax="sms"
              text={selectedTemplate.body}
              variables={message.variables}
            />
            <div className="sms-template-actions">
              <EmailSendFormTemplateDialog
                onOpenChange={setTemplateDialogOpen}
                onTemplateSelect={handleTemplateSelect}
                open={templateDialogOpen}
                templates={templateDialogItems}
                trigger={(
                  <EmailSendFormTemplateButton className="sms-template-action" onClick={() => setTemplateDialogOpen(true)}>
                    템플릿 변경
                  </EmailSendFormTemplateButton>
                )}
              />
              <span aria-hidden="true" className="sms-template-action-separator">|</span>
              <EmailSendFormGhostButton className="sms-template-action" onClick={clearSelectedTemplate}>
                템플릿 해제
              </EmailSendFormGhostButton>
            </div>
          </div>
        ) : (
          <>
            {isBodyEmpty ? (
              <EmailSendFormEmptyState
                className="sms-send-form-empty-state"
                onOpenTemplateDialog={() => setTemplateDialogOpen(true)}
                onTemplateSelect={handleTemplateSelect}
                onTemplateDialogOpenChange={setTemplateDialogOpen}
                templateDialogOpen={templateDialogOpen}
                templates={templateDialogItems}
              />
            ) : null}
            <EmailSendFormTextarea
              aria-describedby={bodyLengthWarning ? bodyWarningId : undefined}
              aria-label="문자 메시지 본문"
              aria-invalid={bodyLengthWarning ? 'true' : undefined}
              className={bodyLengthWarning ? 'review-error' : ''}
              onChange={(event) => updateMessage({ body: event.target.value, templateId: '' })}
              onKeyDown={(event) => {
                if (event.key === '/' && isBodyEmpty) {
                  event.preventDefault();
                  setTemplateDialogOpen(true);
                }
              }}
              placeholder="메세지를 입력하세요."
              rows={9}
              value={message.body}
            />
          </>
        )}
        {bodyLengthWarning ? (
          <p className="sms-send-form-body-warning" id={bodyWarningId} role="alert">
            {bodyLengthWarning}
          </p>
        ) : null}
      </EmailSendFormCanvas>
      <ImageCropDialog
        file={activeImageCropFile}
        onApply={handleCroppedSmsImageApply}
        onOpenChange={handleSmsImageCropOpenChange}
        open={Boolean(activeImageCropFile)}
        preset="SMS_MMS"
      />
      {variablePanelRoot
        ? createPortal(
            <MessageTemplateVariablePanel
              onClose={() => setActiveVariableKey('')}
              onValueChange={updateTemplateVariable}
              selectedVariable={selectedVariable}
            />,
            variablePanelRoot
          )
        : null}
    </EmailSendFormRoot>
  );
}
