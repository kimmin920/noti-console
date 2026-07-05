const SMS_TEMPLATE_SMS_BYTE_LIMIT = 90;

export const SMS_TEMPLATE_MESSAGE_TYPES = Object.freeze({
  SMS: 'SMS',
  LMS: 'LMS',
  MMS: 'MMS',
});

export const SMS_TEMPLATE_REGISTRATION_LIMITS = Object.freeze({
  body: 4000,
  smsBytes: SMS_TEMPLATE_SMS_BYTE_LIMIT,
  templateDesc: 100,
  templateId: 50,
  templateName: 50,
  title: 120,
});

export const SMS_TEMPLATE_CREATE_FIELD_IDS = Object.freeze({
  attachFileIdList: 'sms-template-attachments',
  body: 'sms-template-body',
  form: 'sms-template-form',
  messageType: 'sms-template-message-type',
  senderResourceId: 'sms-template-sender-resource',
  templateDesc: 'sms-template-description',
  templateId: 'sms-template-id',
  templateName: 'sms-template-name',
  title: 'sms-template-title',
  useYn: 'sms-template-status',
});

export const SMS_TEMPLATE_CREATE_FORBIDDEN_FIELDS = Object.freeze([
  'clientRequestId',
  'categoryId',
  'content',
  'fallback',
  'messagePurpose',
  'recipient',
  'recipientGroupingKey',
  'recipientList',
  'recipients',
  'requestDate',
  'reservation',
  'scheduledAt',
  'sendLog',
  'sendNo',
  'sender',
  'senderGroupingKey',
  'sendType',
  'statsId',
  'targeting',
  'templateLanguage',
  'templateParameter',
  'unsubscribe',
  'unsubscribeAuthNo',
  'unsubscribeContent',
  'unsubscribeNo',
  'unsubscribePhoneNumber',
  'unsubscribeSenderNo',
  'unsubscribeServiceNo',
]);

const FORBIDDEN_FIELD_SET = new Set(SMS_TEMPLATE_CREATE_FORBIDDEN_FIELDS);
const FIELD_ORDER = [
  'senderResourceId',
  'templateName',
  'templateId',
  'title',
  'body',
  'templateDesc',
  'attachFileIdList',
  'useYn',
];
const BROWSER_ATTACHMENT_FIELDS = [
  'attachments',
  'file',
  'fileBody',
  'files',
  'imageAttachments',
  'previewUrl',
  'uploadRequestPreview',
];
const REQUIRED_MMS_ATTACHMENT_MESSAGE = 'MMS 템플릿은 업로드된 이미지 파일 ID가 필요합니다.';
export class SmsTemplateCreateValidationError extends Error {
  constructor(validation) {
    super('SMS template creation draft is invalid.');
    this.name = 'SmsTemplateCreateValidationError';
    this.validation = validation;
  }
}

export function getSmsTemplateCreateModel(draft = {}, options = {}) {
  const normalizedDraft = normalizeSmsTemplateCreateDraft(draft, options);
  const variables = extractSmsTemplateVariables(normalizedDraft.body);

  return {
    ...normalizedDraft,
    bodyBytes: getSmsTemplateByteLength(normalizedDraft.body),
    providerSendType: getProviderSendType(normalizedDraft.messageType),
    previewVariables: createSmsTemplatePreviewVariableAssignments(normalizedDraft),
    validation: validateSmsTemplateCreateDraft(normalizedDraft, options),
    variables,
  };
}

export function normalizeSmsTemplateCreateDraft(draft = {}, options = {}) {
  const source = getDraftObject(draft);
  const templateName = normalizeText(source.templateName);
  const templateId = resolveSmsTemplateId(source);
  const body = normalizeText(source.body);
  const attachFileIdList = normalizeAttachFileIdListValue(source.attachFileIdList);
  const messageType = inferSmsTemplateMessageType({ attachFileIdList, body }, options);

  return {
    ...source,
    attachFileIdList,
    body,
    messageType,
    sampleVariableAssignments: createSmsTemplatePreviewVariableAssignments({
      body: source.body,
      sampleVariableAssignments: source.sampleVariableAssignments,
    }),
    senderResourceId: normalizeText(source.senderResourceId),
    templateDesc: normalizeText(source.templateDesc),
    templateId,
    templateName,
    title: normalizeText(source.title),
    useYn: normalizeUseYnValue(source.useYn),
  };
}

export function applySmsTemplateNameChange(draft, templateName) {
  const nextDraft = {
    ...getDraftObject(draft),
    templateName,
  };

  if (isTemplateIdManuallyEdited(nextDraft)) {
    return nextDraft;
  }

  return {
    ...nextDraft,
    templateId: suggestSmsTemplateId(templateName),
  };
}

export function applySmsTemplateIdChange(draft, templateId) {
  return {
    ...getDraftObject(draft),
    templateId: formatSmsTemplateId(templateId),
    templateIdManuallyEdited: true,
  };
}

export function suggestSmsTemplateId(templateName) {
  return truncateSmsTemplateId(formatSmsTemplateId(templateName)) || 'SMS_TEMPLATE';
}

export function resolveSmsTemplateId(draft = {}) {
  const source = getDraftObject(draft);
  const explicitTemplateId = normalizeText(source.templateId);

  if (explicitTemplateId) {
    return formatSmsTemplateId(explicitTemplateId);
  }

  if (source.templateName) {
    return suggestSmsTemplateId(source.templateName);
  }

  return '';
}

export function validateSmsTemplateCreateDraft(draft = {}, options = {}) {
  const source = getDraftObject(draft);
  const errors = {};
  const warnings = {};
  const forbiddenFields = Object.keys(source).filter((key) => FORBIDDEN_FIELD_SET.has(key));

  for (const field of forbiddenFields) {
    addIssue(errors, field, `${field} is not accepted for SMS template registration.`);
  }

  const senderResourceId = normalizeText(source.senderResourceId);
  const templateName = normalizeText(source.templateName);
  const explicitTemplateId = normalizeText(source.templateId);
  const templateId = explicitTemplateId ? formatSmsTemplateId(explicitTemplateId) : resolveSmsTemplateId(source);
  const title = normalizeText(source.title);
  const body = normalizeText(source.body);
  const templateDesc = normalizeText(source.templateDesc);
  const useYn = normalizeUseYnValue(source.useYn);
  const attachmentValidation = validateAttachFileIdList(source.attachFileIdList);
  const messageType = inferSmsTemplateMessageType(source, options);
  const pendingAttachmentUploadCount = getPendingAttachmentUploadCount(options);

  if (!senderResourceId) {
    addIssue(errors, 'senderResourceId', '발신번호를 선택해 주세요.');
  }

  if (!templateName) {
    addIssue(errors, 'templateName', '템플릿 이름을 입력해 주세요.');
  }

  addMaxLengthIssue(errors, 'templateName', templateName, SMS_TEMPLATE_REGISTRATION_LIMITS.templateName);

  if (!templateId) {
    addIssue(errors, 'templateId', '템플릿 ID를 입력해 주세요.');
  }

  addMaxLengthIssue(errors, 'templateId', templateId, SMS_TEMPLATE_REGISTRATION_LIMITS.templateId);

  if (explicitTemplateId && !templateId) {
    addIssue(errors, 'templateId', '템플릿 ID는 영문, 숫자, 밑줄을 포함해야 합니다.');
  }

  if (messageType !== SMS_TEMPLATE_MESSAGE_TYPES.SMS && !title) {
    addIssue(errors, 'title', 'LMS/MMS 템플릿은 제목이 필요합니다.');
  }

  addMaxLengthIssue(errors, 'title', title, SMS_TEMPLATE_REGISTRATION_LIMITS.title);

  if (!body) {
    addIssue(errors, 'body', '메시지 본문을 입력해 주세요.');
  }

  addMaxLengthIssue(errors, 'body', body, SMS_TEMPLATE_REGISTRATION_LIMITS.body);
  addMaxLengthIssue(errors, 'templateDesc', templateDesc, SMS_TEMPLATE_REGISTRATION_LIMITS.templateDesc);

  if (messageType === SMS_TEMPLATE_MESSAGE_TYPES.MMS && !attachmentValidation.fileIds.length && pendingAttachmentUploadCount < 1) {
    addIssue(errors, 'attachFileIdList', REQUIRED_MMS_ATTACHMENT_MESSAGE);
  }

  for (const message of attachmentValidation.errors) {
    addIssue(errors, 'attachFileIdList', message);
  }

  for (const field of BROWSER_ATTACHMENT_FIELDS) {
    if (hasOwn(source, field)) {
      addIssue(errors, 'attachFileIdList', '첨부 이미지는 업로드를 완료한 fileId만 사용할 수 있습니다.');
      break;
    }
  }

  if (useYn !== 'Y' && useYn !== 'N') {
    addIssue(errors, 'useYn', '템플릿 사용 여부는 Y 또는 N이어야 합니다.');
  }

  if (messageType === SMS_TEMPLATE_MESSAGE_TYPES.SMS && extractSmsTemplateVariables(body).length > 0) {
    addIssue(warnings, 'body', '변수 값에 따라 실제 발송 시 90바이트를 초과하면 LMS 과금이 적용될 수 있습니다.');
  }

  return {
    errors,
    firstInvalidFieldId: getFirstIssueFieldId(errors),
    isValid: Object.keys(errors).length === 0,
    warnings,
  };
}

export function validateSmsTemplateCreateSubmissionDraft(draft = {}, options = {}) {
  return validateSmsTemplateCreateDraft(draft, options);
}

export function buildSmsTemplateCreatePayload(draft = {}) {
  const validation = validateSmsTemplateCreateDraft(draft);

  if (!validation.isValid) {
    throw new SmsTemplateCreateValidationError(validation);
  }

  const source = getDraftObject(draft);
  const messageType = inferSmsTemplateMessageType(source);
  const payload = {
    body: normalizeText(source.body),
    senderResourceId: normalizeText(source.senderResourceId),
    sendType: getProviderSendType(messageType),
    templateId: resolveSmsTemplateId(source),
    templateName: normalizeText(source.templateName),
    useYn: normalizeUseYnValue(source.useYn),
  };
  const templateDesc = normalizeText(source.templateDesc);
  const title = normalizeText(source.title);

  if (templateDesc) {
    payload.templateDesc = templateDesc;
  }

  if (messageType === SMS_TEMPLATE_MESSAGE_TYPES.LMS || messageType === SMS_TEMPLATE_MESSAGE_TYPES.MMS) {
    payload.title = title;
  }

  if (messageType === SMS_TEMPLATE_MESSAGE_TYPES.MMS) {
    payload.attachFileIdList = validateAttachFileIdList(source.attachFileIdList).fileIds;
  }

  return payload;
}

export function createSmsTemplateSubmissionDraft(draft = {}, uploadedAttachments = []) {
  const source = getDraftObject(draft);
  const uploadedFileIds = normalizeAttachmentUploadResults(uploadedAttachments);

  return {
    ...source,
    attachFileIdList: Array.from(new Set([
      ...normalizeAttachFileIdListValue(source.attachFileIdList),
      ...uploadedFileIds,
    ])),
  };
}

export function buildSmsTemplateCreatePayloadWithUploadedAttachments(draft = {}, uploadedAttachments = []) {
  return buildSmsTemplateCreatePayload(createSmsTemplateSubmissionDraft(draft, uploadedAttachments));
}

export function extractSmsTemplateVariables(text) {
  const variables = [];
  const seen = new Set();
  const pattern = /##([^#]+)##/g;
  let match = pattern.exec(String(text ?? ''));

  while (match) {
    const key = match[1]?.trim();

    if (key && !seen.has(key)) {
      seen.add(key);
      variables.push({
        key,
        token: match[0],
      });
    }

    match = pattern.exec(String(text ?? ''));
  }

  return variables;
}

export function createSmsTemplatePreviewVariableAssignments(source = {}, previousAssignments = undefined) {
  const body = typeof source === 'string' ? source : source?.body;
  const assignments = previousAssignments ?? source?.sampleVariableAssignments ?? {};

  return Object.fromEntries(
    extractSmsTemplateVariables(body).map((variable, index) => [
      variable.key,
      normalizePreviewAssignment(assignments[variable.key], getDefaultPreviewVariableValue(variable.key, index)),
    ])
  );
}

function getDefaultPreviewVariableValue(key, index) {
  const normalizedKey = String(key ?? '').toLowerCase();

  if (normalizedKey.includes('name')) {
    return '김민준';
  }

  if (normalizedKey.includes('order')) {
    return 'ORD-1024';
  }

  if (normalizedKey.includes('code')) {
    return 'A12345';
  }

  if (normalizedKey.includes('phone') || normalizedKey.includes('tel')) {
    return '01012345678';
  }

  return `값 ${index + 1}`;
}

export function getSmsTemplateByteLength(value) {
  return Array.from(String(value ?? '')).reduce((total, character) => (
    total + (character.charCodeAt(0) > 127 ? 2 : 1)
  ), 0);
}

function getProviderSendType(messageType) {
  return messageType === SMS_TEMPLATE_MESSAGE_TYPES.SMS ? '0' : '1';
}

function getDraftObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeUseYnValue(value) {
  return normalizeText(value || 'Y').toUpperCase();
}

function isTemplateIdManuallyEdited(draft) {
  return Boolean(draft?.templateIdManuallyEdited || draft?.templateIdTouched);
}

function formatSmsTemplateId(value) {
  const normalized = normalizeText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) {
    return '';
  }

  return /^[A-Z]/.test(normalized) ? normalized : `SMS_${normalized}`;
}

function truncateSmsTemplateId(templateId) {
  return Array.from(templateId)
    .slice(0, SMS_TEMPLATE_REGISTRATION_LIMITS.templateId)
    .join('')
    .replace(/_+$/g, '');
}

function normalizeAttachFileIdListValue(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value;
}

function validateAttachFileIdList(value) {
  if (value === undefined || value === null || value === '') {
    return {
      errors: [],
      fileIds: [],
    };
  }

  if (!Array.isArray(value)) {
    return {
      errors: ['attachFileIdList는 업로드된 파일 ID 배열이어야 합니다.'],
      fileIds: [],
    };
  }

  const errors = [];
  const fileIds = [];

  value.forEach((item, index) => {
    const fileId = normalizeUploadedFileId(item);

    if (!fileId) {
      errors.push(`attachFileIdList ${index + 1}번째 항목은 업로드된 파일 ID여야 합니다.`);
      return;
    }

    fileIds.push(fileId);
  });

  return {
    errors,
    fileIds,
  };
}

function normalizeAttachmentUploadResults(uploadedAttachments) {
  if (!Array.isArray(uploadedAttachments)) {
    return [];
  }

  return uploadedAttachments
    .map((attachment) => normalizeUploadedFileId(attachment?.fileId ?? attachment))
    .filter(Boolean);
}

function normalizeUploadedFileId(value) {
  if (Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }

  return null;
}

function normalizePreviewAssignment(value, fallbackValue) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const mode = value.mode === 'recipient' ? 'recipient' : 'manual';

    if (mode === 'recipient') {
      return {
        mode,
        path: value.path ?? value.recipientField ?? '',
        value: value.value ?? '',
      };
    }

    return {
      mode,
      path: '',
      value: value.value ?? value.fallbackValue ?? fallbackValue,
    };
  }

  if (value !== undefined && value !== null && value !== '') {
    return {
      mode: 'manual',
      path: '',
      value,
    };
  }

  return {
    mode: 'manual',
    path: '',
    value: fallbackValue,
  };
}

function addIssue(collection, field, message) {
  collection[field] = [...(collection[field] ?? []), message];
}

function addMaxLengthIssue(errors, field, value, maxLength) {
  if (Array.from(value).length > maxLength) {
    addIssue(errors, field, `${field}은(는) ${maxLength}자 이하여야 합니다.`);
  }
}

function getFirstIssueFieldId(errors) {
  for (const field of FIELD_ORDER) {
    if (errors[field]?.length) {
      return SMS_TEMPLATE_CREATE_FIELD_IDS[field];
    }
  }

  const [firstField] = Object.keys(errors);

  if (!firstField) {
    return null;
  }

  return SMS_TEMPLATE_CREATE_FIELD_IDS[firstField] ?? SMS_TEMPLATE_CREATE_FIELD_IDS.form;
}

function inferSmsTemplateMessageType(source = {}, options = {}) {
  const body = normalizeText(source.body);
  const attachFileIdList = normalizeAttachFileIdListValue(source.attachFileIdList);

  if (attachFileIdList.length > 0 || getPendingAttachmentUploadCount(options) > 0) {
    return SMS_TEMPLATE_MESSAGE_TYPES.MMS;
  }

  if (getSmsTemplateByteLength(body) > SMS_TEMPLATE_SMS_BYTE_LIMIT) {
    return SMS_TEMPLATE_MESSAGE_TYPES.LMS;
  }

  return SMS_TEMPLATE_MESSAGE_TYPES.SMS;
}

function getPendingAttachmentUploadCount(options = {}) {
  return Math.max(0, Number(options.pendingAttachmentUploadCount) || 0);
}
