'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, X } from 'lucide-react';
import { AppButton as Button } from '../ui-extensions/AppButton.jsx';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './Dialog.jsx';
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
  acceptedOriginalExtensions: ['.jpg', '.jpeg', '.png'],
  acceptedOriginalMimeTypes: ['image/jpeg', 'image/png'],
  accept: '.jpg,.jpeg,.png,image/jpeg,image/png',
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
  unsubscribeNumber: '',
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
  const isAcceptedExtension = smsMmsAttachmentConstraints.acceptedOriginalExtensions.includes(extension);

  if (!isAcceptedExtension) {
    return 'JPG, JPEG 또는 PNG 이미지만 선택할 수 있습니다.';
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
  onUnsubscribeNumberCreate,
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
  const [advertisementGuideOpen, setAdvertisementGuideOpen] = useState(false);
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

  function confirmAdvertisementGuide() {
    setAdvertisementGuideOpen(false);
    updateMessage({ isAdvertisement: true });
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
            <EmailSendFormGhostButton onClick={() => setAdvertisementGuideOpen(true)}>
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

        <EmailSendFormDisclosure open={message.isAdvertisement}>
          <EmailSendFormRow
            action={(
              <EmailSendFormGhostButton onClick={() => updateMessage({ isAdvertisement: false })}>
                해제
              </EmailSendFormGhostButton>
            )}
          >
            <EmailSendFormLabel description="광고성 문자 하단에 표시할 무료 수신거부 번호를 선택하세요.">
              080 번호
            </EmailSendFormLabel>
            <EmailSendFormSelect
              ariaLabel="080 수신거부 번호 선택"
              emptyActionLabel="080번호 추가하기"
              emptyDescription="등록된 080 수신거부 번호가 없습니다. 번호를 추가하면 광고성 문자에 사용할 수 있습니다."
              onEmptyAction={onUnsubscribeNumberCreate}
              onValueChange={(unsubscribeNumber) => updateMessage({ unsubscribeNumber })}
              options={unsubscribeNumbers}
              placeholder="080 번호 선택"
              showMenuLabel={false}
              value={message.unsubscribeNumber}
            />
          </EmailSendFormRow>
        </EmailSendFormDisclosure>

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

        <EmailSendFormDisclosure open={scheduleVisible}>
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

        <EmailSendFormDisclosure open={imageVisible}>
          <EmailSendFormRow className="sms-send-form-detail-start-row">
            <EmailSendFormLabel
              description="JPG, JPEG, PNG 이미지를 최대 3개까지 첨부할 수 있습니다."
              htmlFor={imageInputId}
              warning={imageReviewMessage}
            >
              이미지
            </EmailSendFormLabel>
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

        <EmailSendFormRow
          action={!imageVisible ? (
            <EmailSendFormGhostButton onClick={() => setImageVisible(true)}>
              이미지
            </EmailSendFormGhostButton>
          ) : null}
          className={imageVisible ? 'sms-send-form-detail-row' : 'sms-send-form-detail-start-row'}
        >
          <EmailSendFormLabel
            description="발송 내역을 구분하는 관리용 제목입니다. LMS/MMS 발송 시에는 수신자에게도 메시지 제목으로 표시됩니다."
            htmlFor={managementTitleInputId}
          >
            제목
          </EmailSendFormLabel>
          <EmailSendFormInput
            id={managementTitleInputId}
            maxLength={120}
            onChange={(event) => updateMessage({ managementTitle: event.target.value })}
            placeholder="제목을 입력하세요"
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
                emptyActionHref="/templates/sms/new"
                emptyActionLabel="새 템플릿 만들기"
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
                emptyActionHref="/templates/sms/new"
                emptyActionLabel="새 템플릿 만들기"
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
      <Dialog onOpenChange={setAdvertisementGuideOpen} open={advertisementGuideOpen}>
        <DialogContent className="sms-advertisement-guide-dialog" size="large">
          <DialogHeader>
            <DialogTitle>광고 메시지 가이드</DialogTitle>
          </DialogHeader>
          <DialogBody className="sms-advertisement-guide-body">
            <div className="sms-advertisement-guide-notice">
              <p>
                한국인터넷진흥원(KISA) 불법 스팸 방지를 위한 정보통신망법 안내서에 따라
                아래의 규칙을 준수하여 메시지를 발송해 주세요.
              </p>
              <p className="sms-advertisement-guide-notice-warning">
                <strong>
                  광고 메시지 규칙 미준수 시 메시지 발송이 중단될 수 있으며,
                  정보통신망법에 따라 과태료
                </strong>
                {' 등의 처벌을 받을 수 있습니다.'}
              </p>
            </div>

            <section className="sms-advertisement-guide-overview">
              <div className="sms-advertisement-guide-diagram">
                <p
                  className="sms-advertisement-guide-annotation sms-advertisement-guide-annotation-one"
                >
                  <strong>(광고)와 업체명(발송자명)</strong>이 메시지 앞에 자동으로 붙습니다.
                </p>

                <div className="sms-advertisement-guide-phone">
                  <div className="sms-advertisement-guide-phone-time">
                    오늘 오후 8:30
                    <button
                      aria-hidden="true"
                      className="sms-advertisement-guide-marker sms-advertisement-guide-marker-three"
                      disabled
                      type="button"
                    >
                      3
                    </button>
                  </div>
                  <div className="sms-advertisement-guide-message">
                    <div className="sms-advertisement-guide-message-heading">
                      <button
                        aria-hidden="true"
                        className="sms-advertisement-guide-marker sms-advertisement-guide-marker-one"
                        disabled
                        type="button"
                      >
                        1
                      </button>
                      <strong>(광고) NOTI</strong>
                    </div>
                    <span className="sms-advertisement-guide-message-placeholder">
                      작성한 메시지 내용이 표시됩니다.
                    </span>
                    <div className="sms-advertisement-guide-optout">
                      <span>
                        무료 수신거부 번호
                        <br />
                        080-1234-5678
                      </span>
                      <button
                        aria-hidden="true"
                        className="sms-advertisement-guide-marker sms-advertisement-guide-marker-two"
                        disabled
                        type="button"
                      >
                        2
                      </button>
                    </div>
                  </div>
                </div>

                <p
                  className="sms-advertisement-guide-annotation sms-advertisement-guide-annotation-two"
                >
                  <strong>무료 수신거부 번호</strong>가 메시지 하단에 자동으로 붙습니다.
                  <span className="sms-advertisement-guide-annotation-detail">
                    수신거부 요청 결과는 <strong>요청일로부터 14일 이내</strong> 고지해야 합니다.
                  </span>
                </p>

                <p
                  className="sms-advertisement-guide-annotation sms-advertisement-guide-annotation-three"
                >
                  <strong>광고성 메시지 발송 제한 시간</strong>
                  <span className="sms-advertisement-guide-annotation-detail">
                    오후 9시 – 오전 8시
                  </span>
                </p>

                <svg
                  aria-hidden="true"
                  className="sms-advertisement-guide-arrows sms-advertisement-guide-arrows-desktop"
                  preserveAspectRatio="none"
                  viewBox="0 0 800 390"
                >
                  <path d="M205 116C231 116 256 114 281 121" />
                  <path d="M268 110L282 121L267 130" />
                  <path d="M600 258C548 258 505 270 450 274" />
                  <path d="M466 263L449 274L466 283" />
                  <path d="M600 75C560 75 518 67 473 63" />
                  <path d="M488 55L472 63L486 74" />
                </svg>

                <svg
                  aria-hidden="true"
                  className="sms-advertisement-guide-arrows sms-advertisement-guide-arrows-mobile"
                  preserveAspectRatio="none"
                  viewBox="0 0 400 710"
                >
                  <path d="M92 480C64 370 70 204 99 118" />
                  <path d="M89 133L99 117L103 136" />
                  <path d="M306 580C337 488 305 364 244 271" />
                  <path d="M247 289L244 271L259 283" />
                  <path d="M306 380C330 294 320 146 262 60" />
                  <path d="M266 78L262 59L277 72" />
                </svg>
              </div>
            </section>

            <section className="sms-advertisement-guide-section">
              <h3>광고성 메시지란?</h3>
              <p>다음과 같은 홍보·혜택 안내가 포함된 메시지를 말합니다.</p>
              <ul className="sms-advertisement-guide-example-list">
                <li>고객관리 차원의 안부 인사, 무료 뉴스레터</li>
                <li>쿠폰, 마일리지 제공 및 소멸 안내</li>
                <li>특가, 할인 안내</li>
                <li>상품 및 서비스 홍보를 위한 프로모션, 이벤트 안내</li>
              </ul>
            </section>
          </DialogBody>
          <DialogFooter className="sms-advertisement-guide-footer">
            <Button onClick={confirmAdvertisementGuide} variant="primary">
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
