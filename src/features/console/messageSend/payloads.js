const SMS_MAX_BYTES = 90;
const SMS_LONG_MAX_BYTES = 2000;
const SCHEDULE_MAX_DAYS = 50;
const BRAND_SCHEDULE_MAX_DAYS = 60;
const BRAND_TOP_LEVEL_IMAGE_TYPES = new Set(['IMAGE', 'WIDE']);
const BRAND_CAROUSEL_TYPES = new Set(['CAROUSEL_FEED', 'CAROUSEL_COMMERCE']);
const BRAND_CHAT_BUBBLE_TYPES = new Set([
  'TEXT',
  'IMAGE',
  'WIDE',
  'WIDE_ITEM_LIST',
  'PREMIUM_VIDEO',
  'COMMERCE',
  'CAROUSEL_FEED',
  'CAROUSEL_COMMERCE',
]);
const BRAND_ADD_CHANNEL_BUTTON_TYPE = 'AC';
const BRAND_ADD_CHANNEL_BUTTON_NAME = '채널 추가';
const BRAND_CONTENT_HIDDEN_TYPES = new Set(['WIDE_ITEM_LIST', 'COMMERCE', 'CAROUSEL_FEED', 'CAROUSEL_COMMERCE']);
const BRAND_CONTENT_REQUIRED_TYPES = new Set(['TEXT', 'IMAGE', 'WIDE']);
const BRAND_CONTENT_RULES = {
  IMAGE: { contentMaxLength: 1300, contentMaxLineBreak: 99 },
  PREMIUM_VIDEO: { contentMaxLength: 76, contentMaxLineBreak: 5 },
  TEXT: { contentMaxLength: 1300, contentMaxLineBreak: 99 },
  WIDE: { contentMaxLength: 76, contentMaxLineBreak: 5 },
};
const BRAND_COUPON_PLACEHOLDERS = new Set(['할인금액', '할인율', '상품명']);
const BRAND_COUPON_NUMERIC_PARAMETER_KEYS = new Set(['할인금액', '할인율']);
const BRAND_COUPON_NUMERIC_ERROR_CODE = 'COUPON_VARIABLE_NUMERIC_REQUIRED';
const BRAND_FREESTYLE_COUPON_PLACEHOLDER_UNSUPPORTED = 'BRAND_FREESTYLE_COUPON_PLACEHOLDER_UNSUPPORTED';
const BRAND_HEADER_TYPES = new Set(['WIDE_ITEM_LIST', 'PREMIUM_VIDEO']);
const BRAND_ADDITIONAL_CONTENT_TYPES = new Set(['COMMERCE']);
const BRAND_TEMPLATE_NAME_MAX_LENGTH = 200;
const BRAND_IMAGE_UPLOAD_TYPES = new Set([
  'IMAGE',
  'WIDE_IMAGE',
  'MAIN_WIDE_ITEMLIST_IMAGE',
  'NORMAL_WIDE_ITEMLIST_IMAGE',
  'CAROUSEL_FEED_IMAGE',
  'CAROUSEL_COMMERCE_IMAGE',
]);
const BRAND_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const BRAND_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const BRAND_RELAY_OMITTED_KEYS = new Set([
  'buttonVariable',
  'carouselVariable',
  'commerceVariable',
  'couponVariable',
  'file',
  'groupingKey',
  'id',
  'imageFile',
  'imageTone',
  'imageVariable',
  'isUseIntro',
  'messageType',
  'messageVariable',
  'msgType',
  'originCID',
  'previewUrl',
  'recipientGroupingKey',
  'sendType',
  'senderGroupingKey',
  'templateId',
  'thumbnail',
  'thumbnailFile',
  'variables',
  'videoVariable',
]);

export class MessageSendValidationError extends Error {
  constructor(message, { code = 'LOCAL_VALIDATION_FAILED', title = '발송 설정 확인 필요' } = {}) {
    super(message);
    this.name = 'MessageSendValidationError';
    this.code = code;
    this.title = title;
  }
}

export function buildSmsSendPayload(message, { templates = [] } = {}) {
  const senderResourceId = normalizeRequiredString(message.senderNumber, {
    message: '발신번호를 선택해 주세요.',
    title: '발신번호 필요',
  });

  if (message.isAdvertisement) {
    throw new MessageSendValidationError(
      '광고성 문자 발송은 아직 지원하지 않습니다. 광고성 문자 신청하기를 진행해 주세요.',
      { code: 'AD_SMS_UNSUPPORTED', title: '광고성 문자 지원 준비 중' }
    );
  }

  const body = normalizeRequiredString(message.body, {
    message: '메시지 내용을 입력해 주세요.',
    title: '메시지 내용 필요',
  });
  validateSmsBodyByteLength(body);
  const selectedTemplate = getSelectedTemplate(message.templateId, templates);
  const recipients = getManualRecipients(message.recipient).map((recipientNo) => ({
    recipientNo,
    ...getTemplateParameterProperty(message, selectedTemplate),
  }));
  const attachFileIdList = getSmsAttachFileIdList(message);
  const channel = getSmsChannel({ attachFileIdList, body });
  const requestDate = formatRelayRequestDate(message.scheduledAt);
  const managementTitle = normalizeOptionalManagementTitle(message.managementTitle);

  return {
    attachFileIdList,
    body,
    channel,
    clientRequestId: createClientRequestId(),
    recipients,
    senderResourceId,
    ...(managementTitle ? { managementTitle } : {}),
    ...(channel !== 'sms' ? { title: getSmsTitle(selectedTemplate) } : {}),
    ...(requestDate ? { requestDate } : {}),
    ...(selectedTemplate ? { templateCode: getTemplateCode(selectedTemplate) } : {}),
  };
}

export function buildAlimtalkSendPayload(message, { templates = [] } = {}) {
  const senderResourceId = normalizeRequiredString(message.senderProfileId, {
    message: '발신 채널을 선택해 주세요.',
    title: '발신 채널 필요',
  });
  const selectedTemplate = getSelectedTemplate(message.templateId, templates);

  if (!selectedTemplate) {
    throw new MessageSendValidationError(
      '알림톡 템플릿을 선택해 주세요.',
      { code: 'TEMPLATE_REQUIRED', title: '템플릿 필요' }
    );
  }

  const templateCode = getTemplateCode(selectedTemplate);

  if (!templateCode) {
    throw new MessageSendValidationError(
      '선택한 알림톡 템플릿의 templateCode를 확인할 수 없습니다.',
      { code: 'TEMPLATE_CODE_REQUIRED', title: '템플릿 코드 필요' }
    );
  }

  const templateParameter = getTemplateParameterProperty(message, selectedTemplate);
  const buttons = Array.isArray(selectedTemplate.buttons) ? selectedTemplate.buttons : [];
  const quickReplies = Array.isArray(selectedTemplate.quickReplies) ? selectedTemplate.quickReplies : [];
  const recipients = getManualRecipients(message.recipient).map((recipientNo) => ({
    recipientNo,
    ...templateParameter,
    ...(buttons.length ? { buttons } : {}),
    ...(quickReplies.length ? { quickReplies } : {}),
  }));
  const requestDate = formatRelayRequestDate(message.scheduledAt);
  const fallback = buildAlimtalkFallback(message);

  return {
    clientRequestId: createClientRequestId(),
    fallback,
    recipients,
    senderResourceId,
    templateCode,
    ...(requestDate ? { requestDate } : {}),
  };
}

export function buildBrandMessageSendPayload(message, { templates = [] } = {}) {
  const senderResourceId = normalizeRequiredString(message.senderProfileId, {
    message: '브랜드 발신 채널을 선택해 주세요.',
    title: '브랜드 발신 채널 필요',
  });
  const selectedTemplate = getSelectedTemplate(message.templateCode, templates);
  const requestDate = formatBrandRelayRequestDate(message.scheduledAt);
  const fallback = buildBrandFallback(message);
  const recipients = getManualRecipientItems(message.recipient);
  const commonPayload = {
    clientRequestId: createClientRequestId(),
    fallback,
    pushAlarm: message.pushAlarm !== false,
    senderResourceId,
    ...(requestDate ? { requestDate } : {}),
    ...optionalRelayStringProperty('resellerCode', message.resellerCode),
    ...optionalRelayStringProperty('statsId', message.statsId),
    ...optionalRelayStringProperty('unsubscribeNo', message.unsubscribeNo),
    ...optionalRelayStringProperty('unsubscribeAuthNo', message.unsubscribeAuthNo),
  };

  if (message.mode === 'template' || message.templateCode) {
    const templateCode = message.templateCode || getTemplateCode(selectedTemplate);

    if (!templateCode) {
      throw new MessageSendValidationError(
        '선택한 브랜드 템플릿의 templateCode를 확인할 수 없습니다.',
        { code: 'TEMPLATE_CODE_REQUIRED', title: '템플릿 코드 필요' }
      );
    }

    const templateParameter = getTemplateParameterProperty(message, selectedTemplate);
    const templateRecipientDefaults = {
      ...templateParameter,
      ...optionalRelayObjectArrayProperty('imageParameters', message.imageParameters),
      ...optionalRelayObjectProperty('videoParameter', message.videoParameter),
      ...optionalRelayStringProperty('targeting', message.targeting),
      ...optionalRelayStringProperty('unsubscribeNo', message.unsubscribeNo),
      ...optionalRelayStringProperty('unsubscribeAuthNo', message.unsubscribeAuthNo),
    };

    const brandRecipients = recipients.map((recipient) => buildBrandRecipientPayload(recipient, templateRecipientDefaults));
    validateBrandCouponTemplateParameters(brandRecipients);

    return {
      ...commonPayload,
      mode: 'template',
      recipients: brandRecipients,
      templateCode,
    };
  }

  const chatBubbleType = normalizeBrandChatBubbleType(message.chatBubbleType);
  const freestyleFields = getBrandFreestyleProviderFields(message, chatBubbleType);

  return {
    ...commonPayload,
    ...freestyleFields,
    mode: 'freestyle',
    recipients: recipients.map((recipient) => buildBrandRecipientPayload(recipient)),
    ...optionalRelayStringProperty('targeting', message.targeting),
  };
}

export function buildBrandTemplateRegistrationPayload(message, options = {}) {
  const providedTemplateName = typeof options === 'string' ? options : options.templateName;
  const senderResourceId = normalizeRequiredString(message.senderProfileId, {
    message: '브랜드 발신 채널을 선택해 주세요.',
    title: '브랜드 발신 채널 필요',
  });
  const normalizedTemplateName = normalizeBrandTemplateName(providedTemplateName ?? message.templateName);

  if (message.mode === 'template' || message.templateCode) {
    throw new MessageSendValidationError(
      '템플릿 등록은 프리스타일 작성 중인 브랜드 메시지만 사용할 수 있습니다.',
      { code: 'BRAND_TEMPLATE_REGISTRATION_FREESTYLE_REQUIRED', title: '프리스타일 작성 필요' }
    );
  }

  const chatBubbleType = normalizeBrandChatBubbleType(message.chatBubbleType);

  return {
    senderResourceId,
    templateName: normalizedTemplateName,
    ...getBrandFreestyleProviderFields(message, chatBubbleType),
  };
}

export function buildBrandImageUploadFormData({ file, imageType = 'IMAGE', senderResourceId }) {
  const resolvedSenderResourceId = normalizeRequiredString(senderResourceId, {
    message: '이미지를 업로드할 브랜드 발신 채널을 선택해 주세요.',
    title: '브랜드 발신 채널 필요',
  });
  const resolvedImageType = normalizeBrandImageUploadType(imageType);
  validateBrandImageUploadFile(file);

  const formData = new FormData();

  formData.set('senderResourceId', resolvedSenderResourceId);
  formData.set('imageType', resolvedImageType);
  formData.set('image', file);
  return formData;
}

function validateBrandImageUploadFile(file) {
  if (!file || typeof file !== 'object') {
    throw new MessageSendValidationError(
      '업로드할 이미지를 선택해 주세요.',
      { code: 'BRAND_IMAGE_REQUIRED', title: '이미지 필요' }
    );
  }

  if (!BRAND_IMAGE_MIME_TYPES.has(file.type)) {
    throw new MessageSendValidationError(
      '브랜드 메시지 이미지는 PNG 또는 JPEG 파일만 업로드할 수 있습니다.',
      { code: 'BRAND_IMAGE_MIME_UNSUPPORTED', title: '이미지 형식 확인 필요' }
    );
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new MessageSendValidationError(
      '이미지 파일이 비어 있습니다. 실제 PNG 또는 JPEG 파일을 다시 선택해 주세요.',
      { code: 'BRAND_IMAGE_EMPTY', title: '이미지 파일 확인 필요' }
    );
  }

  if (file.size > BRAND_IMAGE_MAX_BYTES) {
    throw new MessageSendValidationError(
      '브랜드 메시지 이미지는 5MB 이하로 업로드해 주세요.',
      { code: 'BRAND_IMAGE_TOO_LARGE', title: '이미지 용량 초과' }
    );
  }
}

export function getBrandImageUploadTargets(message) {
  const draft = message && typeof message === 'object' && !Array.isArray(message) ? message : {};
  const chatBubbleType = normalizeBrandUploadChatBubbleType(draft.chatBubbleType ?? draft.messageType);

  if (draft.mode === 'template' || chatBubbleType === 'TEXT') {
    return [];
  }

  if (chatBubbleType === 'IMAGE' || chatBubbleType === 'WIDE') {
    return compactUploadTargets([
      createBrandImageUploadTarget({
        file: getTopLevelBrandImageFile(draft),
        imageType: chatBubbleType === 'WIDE' ? 'WIDE_IMAGE' : 'IMAGE',
        path: ['image'],
        section: 'image',
      }),
    ]);
  }

  if (chatBubbleType === 'WIDE_ITEM_LIST') {
    return getObjectList(draft.item).map((item, index) => (
      createBrandImageUploadTarget({
        file: getBrandNestedImageFile(item),
        imageType: index === 0 ? 'MAIN_WIDE_ITEMLIST_IMAGE' : 'NORMAL_WIDE_ITEMLIST_IMAGE',
        index,
        path: ['item', 'list', index, 'image'],
        section: 'item.list[]',
      })
    )).filter(Boolean);
  }

  if (chatBubbleType === 'PREMIUM_VIDEO') {
    return compactUploadTargets([
      createBrandImageUploadTarget({
        file: getBrandVideoThumbnailFile(draft.video),
        imageType: 'IMAGE',
        path: ['video', 'thumbnailUrl'],
        section: 'video.thumbnailUrl',
      }),
    ]);
  }

  if (chatBubbleType === 'COMMERCE') {
    return compactUploadTargets([
      createBrandImageUploadTarget({
        file: getBrandNestedImageFile(draft.commerce) ?? getTopLevelBrandImageFile(draft),
        imageType: 'IMAGE',
        path: ['commerce', 'image'],
        section: 'commerce',
      }),
    ]);
  }

  if (chatBubbleType === 'CAROUSEL_FEED' || chatBubbleType === 'CAROUSEL_COMMERCE') {
    const imageType = chatBubbleType === 'CAROUSEL_COMMERCE'
      ? 'CAROUSEL_COMMERCE_IMAGE'
      : 'CAROUSEL_FEED_IMAGE';
    const carousel = getPlainObject(draft.carousel);
    const headTarget = chatBubbleType === 'CAROUSEL_COMMERCE' && carousel.isUseIntro
      ? createBrandImageUploadTarget({
          file: getBrandNestedImageFile(carousel.head),
          imageType,
          path: ['carousel', 'head', 'image'],
          section: 'carousel.head',
        })
      : null;
    const itemTargets = getObjectList(carousel).map((item, index) => (
      createBrandImageUploadTarget({
        file: getBrandNestedImageFile(item),
        imageType,
        index,
        path: ['carousel', 'list', index, 'image'],
        section: 'carousel.list[]',
      })
    ));

    return compactUploadTargets([headTarget, ...itemTargets]);
  }

  return [];
}

export function applyBrandImageUploadResult(message, target, uploadResult) {
  const draft = message && typeof message === 'object' && !Array.isArray(message) ? message : {};
  const uploadedImage = toUploadedBrandImage(uploadResult, target?.imageType);

  if (!uploadedImage.imageUrl && !uploadedImage.imageSeq) {
    return draft;
  }

  if (target?.section === 'image') {
    return {
      ...draft,
      image: uploadedImage,
      imageFile: null,
    };
  }

  if (target?.section === 'item.list[]') {
    const item = getPlainObject(draft.item);
    const list = getObjectList(item);

    return {
      ...draft,
      item: {
        ...item,
        list: replaceImageAtIndex(list, target.index, uploadedImage),
      },
    };
  }

  if (target?.section === 'video.thumbnailUrl') {
    const video = getPlainObject(draft.video);

    return {
      ...draft,
      video: {
        ...withoutUploadFileProperties(video),
        thumbnailImageName: uploadedImage.imageName,
        thumbnailImageSeq: uploadedImage.imageSeq,
        thumbnailImageType: uploadedImage.imageType,
        thumbnailUrl: uploadedImage.imageUrl,
      },
    };
  }

  if (target?.section === 'commerce') {
    const commerce = getPlainObject(draft.commerce);

    return {
      ...draft,
      commerce: {
        ...withoutUploadFileProperties(commerce),
        image: uploadedImage,
        imageName: uploadedImage.imageName,
        imageUrl: uploadedImage.imageUrl,
      },
      imageFile: null,
    };
  }

  if (target?.section === 'carousel.head') {
    const carousel = getPlainObject(draft.carousel);
    const head = getPlainObject(carousel.head);

    return {
      ...draft,
      carousel: {
        ...carousel,
        head: {
          ...withoutUploadFileProperties(head),
          image: uploadedImage,
          imageName: uploadedImage.imageName,
          imageUrl: uploadedImage.imageUrl,
        },
      },
    };
  }

  if (target?.section === 'carousel.list[]') {
    const carousel = getPlainObject(draft.carousel);
    const list = getObjectList(carousel);

    return {
      ...draft,
      carousel: {
        ...carousel,
        list: replaceImageAtIndex(list, target.index, uploadedImage),
      },
    };
  }

  return draft;
}

function normalizeRequiredString(value, { message, title }) {
  const normalized = typeof value === 'string' ? value.trim() : '';

  if (!normalized) {
    throw new MessageSendValidationError(message, { title });
  }

  return normalized;
}

function normalizeOptionalManagementTitle(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';

  if (!normalized) {
    return null;
  }

  if (normalized.length > 120) {
    throw new MessageSendValidationError(
      '관리용 발송명은 120자 이하여야 합니다.',
      { code: 'MANAGEMENT_TITLE_TOO_LONG', title: '발송명 확인 필요' }
    );
  }

  return normalized;
}

function normalizeBrandTemplateName(value) {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    throw new MessageSendValidationError(
      '템플릿 이름을 입력해 주세요.',
      { code: 'BRAND_TEMPLATE_NAME_REQUIRED', title: '템플릿 이름 필요' }
    );
  }

  if (Array.from(normalized).length > BRAND_TEMPLATE_NAME_MAX_LENGTH) {
    throw new MessageSendValidationError(
      `템플릿 이름은 ${BRAND_TEMPLATE_NAME_MAX_LENGTH.toLocaleString()}자 이하여야 합니다.`,
      { code: 'BRAND_TEMPLATE_NAME_TOO_LONG', title: '템플릿 이름 확인 필요' }
    );
  }

  return normalized;
}

function validateSmsBodyByteLength(body) {
  const bodyBytes = getSmsByteLength(body);

  if (bodyBytes > SMS_LONG_MAX_BYTES) {
    throw new MessageSendValidationError(
      `문자 본문은 LMS/MMS 기준 ${SMS_LONG_MAX_BYTES.toLocaleString()}바이트 이하여야 합니다. 현재 ${bodyBytes.toLocaleString()}바이트입니다.`,
      { code: 'SMS_BODY_TOO_LONG', title: '메시지 길이 확인 필요' }
    );
  }
}

function createClientRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return [...bytes].map((byte, index) => {
    const value = byte.toString(16).padStart(2, '0');
    return [4, 6, 8, 10].includes(index) ? `-${value}` : value;
  }).join('');
}

function getSmsByteLength(value) {
  return Array.from(value).reduce((total, character) => (
    total + (character.charCodeAt(0) > 127 ? 2 : 1)
  ), 0);
}

function getSmsChannel({ attachFileIdList, body }) {
  if (attachFileIdList.length > 0) {
    return 'mms';
  }

  return getSmsByteLength(body) > SMS_MAX_BYTES ? 'lms' : 'sms';
}

function getManualRecipients(value) {
  return getManualRecipientItems(value).map((recipient) => recipient.recipientNo);
}

function getManualRecipientItems(value) {
  const recipients = Array.isArray(value) ? value : [value].filter(Boolean);
  const manualRecipients = [];
  const unsupportedRecipients = [];

  recipients.forEach((recipient) => {
    const normalized = normalizeRecipientItem(recipient);

    if (normalized.type === 'manual' && isPlausiblePhoneNumber(normalized.value)) {
      manualRecipients.push({
        recipientNo: normalized.value.replace(/[\s-]/g, ''),
        source: recipient && typeof recipient === 'object' && !Array.isArray(recipient) ? recipient : {},
      });
      return;
    }

    if (normalized.value) {
      unsupportedRecipients.push(normalized);
    }
  });

  if (unsupportedRecipients.length > 0) {
    throw new MessageSendValidationError(
      '저장 연락처, 세그먼트, 전체 대상은 아직 발송 대상으로 확장할 수 없습니다. 전화번호를 직접 입력해 주세요.',
      { code: 'UNSUPPORTED_RECIPIENT_TARGET', title: '수신자 직접 입력 필요' }
    );
  }

  if (manualRecipients.length === 0) {
    throw new MessageSendValidationError(
      '전화번호를 직접 입력해 수신자를 추가해 주세요.',
      { code: 'RECIPIENT_REQUIRED', title: '수신자 필요' }
    );
  }

  return Array.from(
    manualRecipients
      .reduce((recipientMap, recipient) => (
        recipientMap.has(recipient.recipientNo) ? recipientMap : recipientMap.set(recipient.recipientNo, recipient)
      ), new Map())
      .values()
  );
}

function normalizeRecipientItem(recipient) {
  if (typeof recipient === 'string') {
    return {
      type: isPlausiblePhoneNumber(recipient) ? 'manual' : 'segment',
      value: recipient,
    };
  }

  if (!recipient || typeof recipient !== 'object') {
    return { type: '', value: '' };
  }

  return {
    type: recipient.type ?? recipient.kind ?? '',
    value: String(recipient.value ?? recipient.label ?? '').trim(),
  };
}

function isPlausiblePhoneNumber(value) {
  return /^\+?[0-9\s-]{7,24}$/.test(String(value ?? '').trim());
}

function getTemplateParameterProperty(message, template) {
  const templateParameter = getTemplateParameter(message, template);

  return Object.keys(templateParameter).length > 0
    ? { templateParameter }
    : {};
}

function getTemplateParameter(message, template) {
  const variableKeys = getTemplateVariableKeys(message, template);
  const variables = message.variables && typeof message.variables === 'object' ? message.variables : {};
  const templateParameter = message.templateParameter && typeof message.templateParameter === 'object'
    ? message.templateParameter
    : {};

  if (variableKeys.length === 0) {
    return Object.fromEntries(
      Object.entries(templateParameter).filter(([, value]) => value !== undefined && value !== null)
    );
  }

  return variableKeys.reduce((parameters, key) => {
    const value = getTemplateVariableValue(variables[key] ?? templateParameter[key], key);

    if (value !== '') {
      parameters[key] = value;
    }

    return parameters;
  }, {});
}

function getTemplateVariableKeys(message, template) {
  return Array.from(new Set([
    ...toKeyArray(template?.requiredVariables),
    ...toKeyArray(template?.variables?.map((variable) => variable.key)),
    ...Object.keys(message.variables ?? {}),
    ...Object.keys(message.templateParameter ?? {}),
  ].filter(Boolean)));
}

function toKeyArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : [];
}

function getTemplateVariableValue(value, key) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const mode = value.mode === 'recipient' ? 'recipient' : 'manual';

    if (mode === 'recipient') {
      throw new MessageSendValidationError(
        `${key} 변수는 수신자 속성 치환을 아직 사용할 수 없습니다. 직접 값을 입력해 주세요.`,
        { code: 'RECIPIENT_VARIABLE_UNSUPPORTED', title: '변수 직접 입력 필요' }
      );
    }

    return String(value.value ?? value.fallbackValue ?? '').trim();
  }

  return String(value ?? '').trim();
}

function normalizeBrandChatBubbleType(value) {
  const type = String(value || 'TEXT').trim().toUpperCase();

  if (BRAND_CHAT_BUBBLE_TYPES.has(type)) {
    return type;
  }

  throw new MessageSendValidationError(
    '지원하지 않는 브랜드 메시지 타입입니다.',
    { code: 'UNSUPPORTED_BRAND_MESSAGE_TYPE', title: '메시지 타입 확인 필요' }
  );
}

function getBrandFreestyleContent(message, chatBubbleType) {
  if (BRAND_CONTENT_HIDDEN_TYPES.has(chatBubbleType)) {
    return '';
  }

  if (BRAND_CONTENT_REQUIRED_TYPES.has(chatBubbleType)) {
    const content = normalizeRequiredString(message.content, {
      message: '브랜드 메시지 내용을 입력해 주세요.',
      title: '브랜드 메시지 내용 필요',
    });

    validateBrandContentRules(content, chatBubbleType);
    return content;
  }

  const content = normalizeOptionalRelayString(message.content);

  validateBrandContentRules(content, chatBubbleType);
  return content;
}

function validateBrandContentRules(content, chatBubbleType) {
  if (!content) {
    return;
  }

  const rules = BRAND_CONTENT_RULES[chatBubbleType];

  if (!rules) {
    return;
  }

  if (Array.from(content).length > rules.contentMaxLength) {
    throw new MessageSendValidationError(
      `브랜드 메시지 내용은 ${rules.contentMaxLength.toLocaleString()}자 이하여야 합니다.`,
      { code: 'BRAND_CONTENT_TOO_LONG', title: '브랜드 메시지 내용 확인 필요' }
    );
  }

  const lineBreakCount = (content.match(/\r\n|\r|\n/g) ?? []).length;

  if (lineBreakCount > rules.contentMaxLineBreak) {
    throw new MessageSendValidationError(
      `브랜드 메시지 내용의 줄바꿈은 ${rules.contentMaxLineBreak}회 이하여야 합니다.`,
      { code: 'BRAND_CONTENT_LINE_BREAKS_TOO_MANY', title: '브랜드 메시지 내용 확인 필요' }
    );
  }
}

function getBrandFreestyleProviderFields(message, chatBubbleType) {
  const content = getBrandFreestyleContent(message, chatBubbleType);
  const carousel = getBrandProviderCarousel(message, chatBubbleType);
  const structuredFields = getBrandFreestyleStructuredFields(message, chatBubbleType, carousel);
  const coupon = BRAND_CAROUSEL_TYPES.has(chatBubbleType) ? null : getBrandProviderCoupon(message.coupon);
  const sharedActions = BRAND_CAROUSEL_TYPES.has(chatBubbleType)
    ? {}
    : {
        ...optionalRelayObjectArrayProperty('buttons', getBrandTopLevelButtons(
          message.buttons,
          chatBubbleType,
          Boolean(coupon)
        )),
        ...optionalRelayObjectProperty('coupon', coupon),
      };

  return {
    chatBubbleType,
    adult: Boolean(message.adult),
    ...(content ? { content } : {}),
    ...(BRAND_HEADER_TYPES.has(chatBubbleType) ? optionalRelayStringProperty('header', message.header) : {}),
    ...(BRAND_ADDITIONAL_CONTENT_TYPES.has(chatBubbleType)
      ? optionalRelayStringProperty('additionalContent', message.additionalContent)
      : {}),
    ...structuredFields,
    ...sharedActions,
  };
}

function getBrandProviderImage(message, chatBubbleType) {
  if (!BRAND_TOP_LEVEL_IMAGE_TYPES.has(chatBubbleType)) {
    return null;
  }

  const image = message.image && typeof message.image === 'object' ? message.image : {};
  const imageUrl = String(image.imageUrl ?? '').trim();

  if (!imageUrl || imageUrl.startsWith('data:') || imageUrl.startsWith('blob:') || imageUrl.startsWith('sample:')) {
    throw new MessageSendValidationError(
      '브랜드 이미지 메시지는 NHN 업로드가 완료된 이미지만 발송할 수 있습니다.',
      { code: 'BRAND_IMAGE_UPLOAD_REQUIRED', title: '브랜드 이미지 업로드 필요' }
    );
  }

  return sanitizeBrandRelayValue({
    imageUrl,
    ...(image.imageLink ? { imageLink: String(image.imageLink) } : {}),
    ...(image.imageSeq ? { imageSeq: String(image.imageSeq) } : {}),
    ...(image.imageName ? { imageName: String(image.imageName) } : {}),
    ...(image.imageType ? { imageType: String(image.imageType) } : {}),
  }, 'image');
}

function getBrandFreestyleStructuredFields(message, chatBubbleType, carousel) {
  if (BRAND_TOP_LEVEL_IMAGE_TYPES.has(chatBubbleType)) {
    return optionalRelayProperty('image', getBrandProviderImage(message, chatBubbleType));
  }

  if (chatBubbleType === 'WIDE_ITEM_LIST') {
    return optionalRelayObjectProperty('item', getBrandProviderWideItemList(message.item));
  }

  if (chatBubbleType === 'PREMIUM_VIDEO') {
    return optionalRelayObjectProperty('video', message.video);
  }

  if (chatBubbleType === 'COMMERCE') {
    return getBrandProviderCommerceFields(message.commerce);
  }

  if (BRAND_CAROUSEL_TYPES.has(chatBubbleType)) {
    return optionalRelayObjectProperty('carousel', carousel);
  }

  return {};
}

function getBrandProviderCarousel(message, chatBubbleType) {
  if (chatBubbleType !== 'CAROUSEL_FEED' && chatBubbleType !== 'CAROUSEL_COMMERCE') {
    return null;
  }

  const carousel = getPlainObject(message.carousel);
  const list = getObjectList(carousel).map((item, index) => (
    getBrandProviderCarouselItem(item, index, chatBubbleType)
  ));
  const tail = getBrandProviderCarouselTail(carousel);

  if (chatBubbleType === 'CAROUSEL_FEED') {
    validateBrandCarouselListLength(list, 2, 6, '캐러셀 피드는 상품 카드가 2~6개여야 합니다.');
    validateBrandCarouselAddChannelButtonCount(list);
    const {
      head: _head,
      isUseIntro: _isUseIntro,
      moreButton: _moreButton,
      tail: _tail,
      ...rest
    } = carousel;

    return {
      ...rest,
      ...(tail ? { tail } : {}),
      list,
    };
  }

  const isUseIntro = Boolean(carousel.isUseIntro);
  validateBrandCarouselListLength(
    list,
    isUseIntro ? 1 : 2,
    isUseIntro ? 5 : 6,
    isUseIntro
      ? '인트로를 사용하면 캐러셀 커머스 상품은 1~5개여야 합니다.'
      : '인트로를 사용하지 않으면 캐러셀 커머스 상품은 2~6개여야 합니다.'
  );
  validateBrandCarouselAddChannelButtonCount(list);

  const {
    head,
    isUseIntro: _isUseIntro,
    moreButton: _moreButton,
    tail: _tail,
    ...rest
  } = carousel;

  return {
    ...rest,
    ...(isUseIntro ? { head: getBrandProviderCarouselHead(head) } : {}),
    ...(tail ? { tail } : {}),
    list,
  };
}

function getBrandProviderCarouselTail(carousel) {
  const source = getPlainObject(carousel.tail ?? carousel.moreButton);

  if (!Object.keys(source).length) {
    return null;
  }

  const linkMo = normalizeOptionalRelayString(source.linkMo ?? source.linkMobile ?? source.mobileLink ?? source.mobileWebLink);
  const linkPc = normalizeOptionalRelayString(source.linkPc);
  const schemeAndroid = normalizeOptionalRelayString(source.schemeAndroid);
  const schemeIos = normalizeOptionalRelayString(source.schemeIos);
  const hasLink = Boolean(linkMo || linkPc || schemeAndroid || schemeIos);
  const isMoreButton = source.isMoreButton === undefined ? hasLink : Boolean(source.isMoreButton);

  if (!isMoreButton) {
    return null;
  }

  if (!linkMo) {
    throw new MessageSendValidationError(
      '더보기 모바일 링크를 입력해 주세요.',
      { code: 'BRAND_CAROUSEL_TAIL_LINK_REQUIRED', title: '캐러셀 더보기 확인 필요' }
    );
  }

  return sanitizeBrandRelayValue({
    isMoreButton: true,
    linkMo,
    ...optionalRelayStringProperty('linkPc', linkPc),
    ...optionalRelayStringProperty('schemeAndroid', schemeAndroid),
    ...optionalRelayStringProperty('schemeIos', schemeIos),
  }, 'tail');
}

function getBrandProviderWideItemList(value) {
  const item = getPlainObject(value);
  const list = getObjectList(item).map((entry, index) => getBrandProviderWideItem(entry, index));

  validateBrandCarouselListLength(list, 3, 4, '와이드 리스트는 상품이 3~4개여야 합니다.');
  return sanitizeBrandRelayValue({ list }, 'item');
}

function getBrandProviderWideItem(value, index) {
  const item = getPlainObject(value);
  const imageUrl = getBrandProviderImageUrl(item);

  if (!imageUrl || isUnsafeBrandImageUrl(imageUrl)) {
    throw new MessageSendValidationError(
      `${index + 1}번 와이드 리스트 이미지를 업로드해 주세요.`,
      { code: 'BRAND_IMAGE_UPLOAD_REQUIRED', title: '와이드 리스트 확인 필요' }
    );
  }

  return sanitizeBrandRelayValue({
    title: index === 0
      ? normalizeOptionalRelayString(item.title)
      : normalizeRequiredString(item.title, {
          message: `${index + 1}번 와이드 리스트 제목을 입력해 주세요.`,
          title: '와이드 리스트 확인 필요',
        }),
    imageUrl,
    linkMo: normalizeRequiredString(item.linkMo, {
      message: `${index + 1}번 와이드 리스트 모바일 링크를 입력해 주세요.`,
      title: '와이드 리스트 확인 필요',
    }),
    ...optionalRelayStringProperty('linkPc', item.linkPc),
    ...optionalRelayStringProperty('schemeAndroid', item.schemeAndroid),
    ...optionalRelayStringProperty('schemeIos', item.schemeIos),
  }, 'item');
}

function getBrandProviderCommerceFields(value) {
  const commerce = getPlainObject(value);

  return {
    ...optionalRelayStringProperty('additionalContent', commerce.additionalContent),
    image: getBrandProviderImageFromSource(value),
    commerce: getBrandProviderCommerce(value, 'commerce'),
  };
}

function getBrandCommerceDiscountType(value) {
  return value === 'fixed' ? 'fixed' : 'rate';
}

function getBrandComputedDiscountRate(regularPrice, discountPrice) {
  if (!regularPrice || !discountPrice || regularPrice <= discountPrice) {
    return 0;
  }

  return Math.floor(((regularPrice - discountPrice) / regularPrice) * 100);
}

function getBrandProviderCommerce(value, fieldName) {
  const commerce = getPlainObject(value);
  const regularPrice = getRequiredBrandInteger(commerce.regularPrice ?? commerce.price, {
    message: '커머스 정상가를 입력해 주세요.',
    title: '커머스 확인 필요',
  });
  const discountPrice = getOptionalBrandInteger(commerce.discountPrice);
  let discountRate = getOptionalBrandInteger(commerce.discountRate);
  let discountFixed = getOptionalBrandInteger(commerce.discountFixed);

  if (discountPrice !== null && discountRate === null && discountFixed === null) {
    if (regularPrice < discountPrice) {
      throw new MessageSendValidationError(
        '커머스 할인가는 정상가보다 클 수 없습니다.',
        { code: 'BRAND_COMMERCE_PRICE_INVALID', title: '커머스 가격 확인 필요' }
      );
    }

    if (getBrandCommerceDiscountType(commerce.discountType) === 'fixed') {
      discountFixed = regularPrice - discountPrice;
    } else {
      discountRate = getBrandComputedDiscountRate(regularPrice, discountPrice);
    }
  }

  return sanitizeBrandRelayValue({
    title: normalizeRequiredString(commerce.title, {
      message: '커머스 상품명을 입력해 주세요.',
      title: '커머스 확인 필요',
    }),
    regularPrice,
    ...(discountPrice !== null ? { discountPrice } : {}),
    ...(discountRate !== null ? { discountRate } : {}),
    ...(discountFixed !== null ? { discountFixed } : {}),
  }, fieldName);
}

function getBrandProviderCarouselItem(value, index, chatBubbleType) {
  const item = getPlainObject(value);
  const buttons = getBrandButtons(item.buttons);

  if (buttons.length < 1 || buttons.length > 2) {
    throw new MessageSendValidationError(
      `${index + 1}번 캐러셀 슬라이드 버튼은 1~2개여야 합니다.`,
      { code: 'BRAND_CAROUSEL_BUTTONS_INVALID', title: '캐러셀 버튼 확인 필요' }
    );
  }
  validateBrandAddChannelButtons(buttons, chatBubbleType, `${index + 1}번 캐러셀 슬라이드`);

  const imageUrl = getBrandProviderImageUrl(item);

  if (!imageUrl || isUnsafeBrandImageUrl(imageUrl)) {
    throw new MessageSendValidationError(
      `${index + 1}번 캐러셀 이미지를 업로드해 주세요.`,
      { code: 'BRAND_IMAGE_UPLOAD_REQUIRED', title: '캐러셀 항목 확인 필요' }
    );
  }

  const coupon = getBrandProviderCoupon(item.coupon);

  if (chatBubbleType === 'CAROUSEL_COMMERCE') {
    return sanitizeBrandRelayValue({
      ...optionalRelayStringProperty('additionalContent', item.additionalContent),
      imageUrl,
      ...optionalRelayStringProperty('imageLink', item.imageLink),
      commerce: getBrandProviderCommerce(item.commerce ?? item, 'carousel.commerce'),
      buttons,
      ...(coupon ? { coupon } : {}),
    }, 'carousel');
  }

  return sanitizeBrandRelayValue({
    header: normalizeRequiredString(item.header ?? item.title, {
      message: `${index + 1}번 캐러셀 제목을 입력해 주세요.`,
      title: '캐러셀 항목 확인 필요',
    }),
    message: normalizeRequiredString(item.message ?? item.content ?? item.description, {
      message: `${index + 1}번 캐러셀 본문을 입력해 주세요.`,
      title: '캐러셀 항목 확인 필요',
    }),
    imageUrl,
    ...optionalRelayStringProperty('imageLink', item.imageLink),
    buttons,
    ...(coupon ? { coupon } : {}),
  }, 'carousel');
}

function validateBrandCarouselListLength(list, min, max, message) {
  if (list.length < min || list.length > max) {
    throw new MessageSendValidationError(message, {
      code: 'BRAND_CAROUSEL_LIST_INVALID',
      title: '캐러셀 항목 확인 필요',
    });
  }
}

function getBrandProviderCarouselHead(value) {
  const head = getPlainObject(value);
  const image = getPlainObject(head.image);
  const imageUrl = String(head.imageUrl ?? image.imageUrl ?? '').trim();
  const linkMo = normalizeOptionalRelayString(head.linkMo);
  const linkPc = normalizeOptionalRelayString(head.linkPc);
  const schemeAndroid = normalizeOptionalRelayString(head.schemeAndroid);
  const schemeIos = normalizeOptionalRelayString(head.schemeIos);

  if (!imageUrl) {
    throw new MessageSendValidationError(
      '커머스 인트로 이미지를 업로드해 주세요.',
      { code: 'BRAND_CAROUSEL_INTRO_IMAGE_REQUIRED', title: '커머스 인트로 확인 필요' }
    );
  }

  if (isUnsafeBrandImageUrl(imageUrl)) {
    throw new MessageSendValidationError(
      '브랜드 이미지 메시지는 NHN 업로드가 완료된 이미지만 발송할 수 있습니다.',
      { code: 'BRAND_IMAGE_UPLOAD_REQUIRED', title: '브랜드 이미지 업로드 필요' }
    );
  }

  if ((linkPc || schemeAndroid || schemeIos) && !linkMo) {
    throw new MessageSendValidationError(
      '커머스 인트로 링크를 사용하려면 모바일 웹 링크를 입력해 주세요.',
      { code: 'BRAND_CAROUSEL_INTRO_LINK_MO_REQUIRED', title: '커머스 인트로 확인 필요' }
    );
  }

  return {
    content: normalizeRequiredString(head.content, {
      message: '커머스 인트로 내용을 입력해 주세요.',
      title: '커머스 인트로 확인 필요',
    }),
    header: normalizeRequiredString(head.header, {
      message: '커머스 인트로 제목을 입력해 주세요.',
      title: '커머스 인트로 확인 필요',
    }),
    imageUrl,
    ...optionalRelayStringProperty('linkMo', linkMo),
    ...optionalRelayStringProperty('linkPc', linkPc),
    ...optionalRelayStringProperty('schemeAndroid', schemeAndroid),
    ...optionalRelayStringProperty('schemeIos', schemeIos),
  };
}

function getBrandProviderImageFromSource(value) {
  const source = getPlainObject(value);
  const imageUrl = getBrandProviderImageUrl(source);

  if (!imageUrl || isUnsafeBrandImageUrl(imageUrl)) {
    throw new MessageSendValidationError(
      '브랜드 이미지 메시지는 NHN 업로드가 완료된 이미지만 발송할 수 있습니다.',
      { code: 'BRAND_IMAGE_UPLOAD_REQUIRED', title: '브랜드 이미지 업로드 필요' }
    );
  }

  const image = getPlainObject(source.image);

  return sanitizeBrandRelayValue({
    imageUrl,
    ...(source.imageLink ?? image.imageLink ? { imageLink: String(source.imageLink ?? image.imageLink) } : {}),
    ...(source.imageSeq ?? image.imageSeq ? { imageSeq: String(source.imageSeq ?? image.imageSeq) } : {}),
    ...(source.imageName ?? source.name ?? image.imageName ?? image.name
      ? { imageName: String(source.imageName ?? source.name ?? image.imageName ?? image.name) }
      : {}),
    ...(source.imageType ?? image.imageType ? { imageType: String(source.imageType ?? image.imageType) } : {}),
  }, 'image');
}

function getBrandProviderImageUrl(value) {
  const source = getPlainObject(value);
  const image = getPlainObject(source.image);
  return String(source.imageUrl ?? source.url ?? image.imageUrl ?? image.url ?? '').trim();
}

function getBrandProviderCoupon(value) {
  const coupon = getPlainObject(value);

  if (!Object.keys(coupon).length) {
    return null;
  }

  const title = normalizeBrandCouponTitle(coupon);
  validateBrandFreestyleCouponTitle(title);

  return sanitizeBrandRelayValue({
    title,
    description: normalizeRequiredString(coupon.description, {
      message: '쿠폰 설명을 입력해 주세요.',
      title: '쿠폰 확인 필요',
    }),
    ...optionalRelayStringProperty('linkMo', coupon.linkMo),
    ...optionalRelayStringProperty('linkPc', coupon.linkPc),
    ...optionalRelayStringProperty('schemeAndroid', coupon.schemeAndroid),
    ...optionalRelayStringProperty('schemeIos', coupon.schemeIos),
  }, 'coupon');
}

function getBrandTopLevelButtons(buttons, chatBubbleType, hasCoupon) {
  const normalizedButtons = getBrandButtons(buttons);
  const maxButtons = getBrandTopLevelButtonMaxCount(chatBubbleType, hasCoupon);
  const minButtons = chatBubbleType === 'COMMERCE' ? 1 : 0;

  if (normalizedButtons.length < minButtons) {
    throw new MessageSendValidationError(
      '커머스 메시지는 버튼을 1개 이상 추가해 주세요.',
      { code: 'BRAND_BUTTONS_REQUIRED', title: '브랜드 버튼 확인 필요' }
    );
  }

  if (normalizedButtons.length > maxButtons) {
    throw new MessageSendValidationError(
      `이 메시지 타입의 버튼은 최대 ${maxButtons}개까지 추가할 수 있습니다.`,
      { code: 'BRAND_BUTTONS_TOO_MANY', title: '브랜드 버튼 확인 필요' }
    );
  }

  validateBrandAddChannelButtons(
    normalizedButtons,
    chatBubbleType,
    chatBubbleType === 'TEXT' || chatBubbleType === 'IMAGE' ? '브랜드 메시지' : '이 메시지 타입'
  );

  return normalizedButtons;
}

function validateBrandAddChannelButtons(buttons, chatBubbleType, label) {
  const addChannelIndex = buttons.findIndex((button) => button.type === BRAND_ADD_CHANNEL_BUTTON_TYPE);

  if (addChannelIndex < 0) {
    return;
  }

  const addChannelButton = buttons[addChannelIndex];

  if (addChannelButton.name !== BRAND_ADD_CHANNEL_BUTTON_NAME) {
    throw new MessageSendValidationError(
      `채널 추가(AC) 버튼 이름은 '${BRAND_ADD_CHANNEL_BUTTON_NAME}'로 고정해야 합니다.`,
      { code: 'BRAND_AC_BUTTON_NAME_INVALID', title: '브랜드 버튼 확인 필요' }
    );
  }

  const mustBeFirst = chatBubbleType === 'TEXT' || chatBubbleType === 'IMAGE';
  const expectedIndex = mustBeFirst ? 0 : buttons.length - 1;

  if (addChannelIndex !== expectedIndex) {
    throw new MessageSendValidationError(
      mustBeFirst
        ? `${label}의 채널 추가(AC) 버튼은 첫 번째 버튼이어야 합니다.`
        : `${label}의 채널 추가(AC) 버튼은 마지막 버튼이어야 합니다.`,
      { code: 'BRAND_AC_BUTTON_POSITION_INVALID', title: '브랜드 버튼 순서 확인 필요' }
    );
  }
}

function validateBrandCarouselAddChannelButtonCount(list) {
  const count = list.reduce((total, item) => (
    total + getBrandButtons(item.buttons).filter((button) => button.type === BRAND_ADD_CHANNEL_BUTTON_TYPE).length
  ), 0);

  if (count > 1) {
    throw new MessageSendValidationError(
      '캐러셀 전체에서 채널 추가(AC) 버튼은 1개만 사용할 수 있습니다.',
      { code: 'BRAND_AC_BUTTON_DUPLICATED', title: '캐러셀 버튼 확인 필요' }
    );
  }
}

function getBrandTopLevelButtonMaxCount(chatBubbleType, hasCoupon) {
  if (chatBubbleType === 'PREMIUM_VIDEO') {
    return 1;
  }

  if (chatBubbleType === 'WIDE' || chatBubbleType === 'WIDE_ITEM_LIST' || chatBubbleType === 'COMMERCE') {
    return 2;
  }

  if ((chatBubbleType === 'TEXT' || chatBubbleType === 'IMAGE') && hasCoupon) {
    return 4;
  }

  return 5;
}

function normalizeBrandCouponTitle(coupon) {
  const explicitTitle = normalizeOptionalRelayString(coupon.title);

  if (explicitTitle) {
    return explicitTitle;
  }

  if (coupon.type === 'PERCENT') {
    return `${getRequiredBrandInteger(coupon.percent, {
      message: '쿠폰 할인율을 입력해 주세요.',
      title: '쿠폰 확인 필요',
    })}% 할인 쿠폰`;
  }

  if (coupon.type === 'SHIPPING') {
    return '배송비 할인 쿠폰';
  }

  if (coupon.type === 'FREE') {
    return `${normalizeRequiredString(coupon.text, {
      message: '무료 쿠폰명을 입력해 주세요.',
      title: '쿠폰 확인 필요',
    })} 무료 쿠폰`;
  }

  if (coupon.type === 'UP') {
    return `${normalizeRequiredString(coupon.text, {
      message: 'UP 쿠폰명을 입력해 주세요.',
      title: '쿠폰 확인 필요',
    })} UP 쿠폰`;
  }

  return `${getRequiredBrandInteger(coupon.amount, {
    message: '쿠폰 할인 금액을 입력해 주세요.',
    title: '쿠폰 확인 필요',
  })}원 할인 쿠폰`;
}

function validateBrandFreestyleCouponTitle(title) {
  const unresolvedKeys = extractBrandCouponPlaceholderKeys(title);

  if (unresolvedKeys.length > 0) {
    throw new MessageSendValidationError(
      `프리스타일 쿠폰명에는 ${unresolvedKeys.map(getBrandCouponPlaceholderToken).join(', ')} 변수를 사용할 수 없습니다.`,
      { code: BRAND_FREESTYLE_COUPON_PLACEHOLDER_UNSUPPORTED, title: '쿠폰 확인 필요' }
    );
  }
}

function validateBrandCouponTemplateParameters(recipients) {
  for (const recipient of recipients) {
    const templateParameter = recipient.templateParameter;

    if (!templateParameter || typeof templateParameter !== 'object' || Array.isArray(templateParameter)) {
      continue;
    }

    const invalidNumericKeys = Array.from(BRAND_COUPON_NUMERIC_PARAMETER_KEYS).filter((key) => (
      Object.prototype.hasOwnProperty.call(templateParameter, key)
      && !/^\d+$/.test(String(getTemplateParameterScalarValue(templateParameter[key]) ?? '').trim())
    ));

    if (invalidNumericKeys.length > 0) {
      throw new MessageSendValidationError(
        `${invalidNumericKeys.join(',')} 변수는 숫자만 입력가능합니다.`,
        { code: BRAND_COUPON_NUMERIC_ERROR_CODE, title: '쿠폰 변수 확인 필요' }
      );
    }
  }
}

function extractBrandCouponPlaceholderKeys(value) {
  const matches = String(value ?? '').match(/#\{[^}\n]+\}/g) ?? [];

  return matches
    .map((token) => token.slice(2, -1).trim())
    .filter((key) => BRAND_COUPON_PLACEHOLDERS.has(key));
}

function getBrandCouponPlaceholderToken(key) {
  if (key === '할인금액') return '#{할인금액}';
  if (key === '할인율') return '#{할인율}';
  if (key === '상품명') return '#{상품명}';
  return `#{${key}}`;
}

function getTemplateParameterScalarValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value.value ?? value.fallbackValue ?? '';
  }

  return value;
}

function getRequiredBrandInteger(value, { message, title }) {
  const normalized = getOptionalBrandInteger(value);

  if (normalized === null) {
    throw new MessageSendValidationError(message, { title });
  }

  return normalized;
}

function optionalBrandIntegerProperty(key, value) {
  const normalized = getOptionalBrandInteger(value);
  return normalized === null ? {} : { [key]: normalized };
}

function getOptionalBrandInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = Number(String(value).replace(/[^0-9.-]/g, '').trim());
  return Number.isFinite(normalized) ? Math.trunc(normalized) : null;
}

function normalizeBrandImageUploadType(value) {
  const imageType = String(value || 'IMAGE').trim().toUpperCase();

  if (!BRAND_IMAGE_UPLOAD_TYPES.has(imageType)) {
    throw new MessageSendValidationError(
      '지원하지 않는 브랜드 이미지 업로드 유형입니다.',
      { code: 'BRAND_IMAGE_TYPE_UNSUPPORTED', title: '이미지 유형 확인 필요' }
    );
  }

  return imageType;
}

function normalizeBrandUploadChatBubbleType(value) {
  return String(value || 'TEXT').trim().toUpperCase();
}

function createBrandImageUploadTarget({ file, imageType, index = null, path, section }) {
  if (!file) {
    return null;
  }

  return {
    file,
    id: path.map(String).join('.'),
    imageType: normalizeBrandImageUploadType(imageType),
    index,
    path,
    section,
  };
}

function compactUploadTargets(targets) {
  return targets.filter(Boolean);
}

function getPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getObjectList(value) {
  const source = getPlainObject(value);
  const list = [source.list, source.items, source.listItems, source.itemList].find(Array.isArray);

  return list ? list.map((item) => getPlainObject(item)) : [];
}

function getTopLevelBrandImageFile(message) {
  return message.imageFile ?? getBrandNestedImageFile(message);
}

function getBrandNestedImageFile(source) {
  const item = getPlainObject(source);
  const image = getPlainObject(item.image);

  return image.imageFile ?? image.file ?? item.imageFile ?? item.file ?? null;
}

function getBrandVideoThumbnailFile(video) {
  const source = getPlainObject(video);
  const thumbnail = getPlainObject(source.thumbnail);

  return source.thumbnailFile ?? thumbnail.imageFile ?? thumbnail.file ?? source.imageFile ?? null;
}

function toUploadedBrandImage(uploadResult, fallbackImageType) {
  const image = getPlainObject(uploadResult);

  return {
    ...(image.imageSeq ? { imageSeq: String(image.imageSeq) } : {}),
    ...(image.imageUrl ? { imageUrl: String(image.imageUrl) } : {}),
    ...(image.imageName ? { imageName: String(image.imageName) } : {}),
    imageType: normalizeBrandImageUploadType(image.imageType || fallbackImageType || 'IMAGE'),
  };
}

function withoutUploadFileProperties(value) {
  const {
    file: _file,
    imageFile: _imageFile,
    imageName: _imageName,
    imageUrl: _imageUrl,
    thumbnail: _thumbnail,
    thumbnailFile: _thumbnailFile,
    ...rest
  } = getPlainObject(value);

  return rest;
}

function replaceImageAtIndex(items, index, uploadedImage) {
  return items.map((item, itemIndex) => (
    itemIndex === index
      ? {
          ...withoutUploadFileProperties(item),
          image: uploadedImage,
          imageName: uploadedImage.imageName,
          imageUrl: uploadedImage.imageUrl,
        }
      : item
  ));
}

function getBrandButtons(buttons) {
  return Array.isArray(buttons)
    ? buttons
        .filter((button) => button?.name)
        .map((button) => {
          const bizFormId = button.bizFormId ?? button.bizFormKey;
          const normalizedButton = sanitizeBrandRelayValue({
            ...button,
            ...(bizFormId ? { bizFormId: String(bizFormId) } : {}),
            bizFormKey: undefined,
          }, 'buttons');

          validateBrandButtonLinkRules(normalizedButton);
          return normalizedButton;
        })
        .filter(Boolean)
    : [];
}

function validateBrandButtonLinkRules(button) {
  if (!button) {
    return;
  }

  if (button.type === 'WL' && !isHttpRelayUrl(button.linkMo)) {
    throw new MessageSendValidationError(
      '모바일 링크를 입력해주세요.',
      { code: 'BRAND_BUTTON_LINK_MO_REQUIRED', title: '브랜드 버튼 확인 필요' }
    );
  }

  if (button.type === 'AL') {
    const linkCount = [
      isHttpRelayUrl(button.linkMo),
      normalizeOptionalRelayString(button.schemeAndroid),
      normalizeOptionalRelayString(button.schemeIos),
    ].filter(Boolean).length;

    if (linkCount < 2) {
      throw new MessageSendValidationError(
        '모바일/Android/iOS 링크 중 2개 이상 입력해주세요.',
        { code: 'BRAND_BUTTON_APP_LINKS_REQUIRED', title: '브랜드 버튼 확인 필요' }
      );
    }
  }

  if (button.type === 'BF' && !/^\d+$/.test(String(button.bizFormId ?? '').trim())) {
    throw new MessageSendValidationError(
      'BF 버튼은 숫자형 bizFormId가 필요합니다.',
      { code: 'BRAND_BUTTON_BIZ_FORM_ID_REQUIRED', title: '브랜드 버튼 확인 필요' }
    );
  }
}

function isHttpRelayUrl(value) {
  return /^https?:\/\//i.test(String(value ?? '').trim());
}

function buildBrandRecipientPayload(recipient, defaults = {}) {
  const source = getPlainObject(recipient.source);

  return {
    recipientNo: recipient.recipientNo,
    ...defaults,
    ...optionalRelayStringProperty('targeting', source.targeting),
    ...optionalRelayStringProperty('content', source.content),
    ...optionalRelayObjectProperty('templateParameter', source.templateParameter),
    ...optionalRelayObjectArrayProperty('imageParameters', source.imageParameters),
    ...optionalRelayObjectProperty('videoParameter', source.videoParameter),
    ...optionalRelayStringProperty('unsubscribeNo', source.unsubscribeNo),
    ...optionalRelayStringProperty('unsubscribeAuthNo', source.unsubscribeAuthNo),
  };
}

function optionalRelayProperty(key, value) {
  const normalized = sanitizeBrandRelayValue(value, key);

  return normalized === undefined ? {} : { [key]: normalized };
}

function optionalRelayStringProperty(key, value) {
  const normalized = normalizeOptionalRelayString(value);

  return normalized ? { [key]: normalized } : {};
}

function optionalRelayObjectProperty(key, value) {
  const normalized = sanitizeBrandRelayValue(value, key);

  return normalized && !Array.isArray(normalized) && typeof normalized === 'object'
    ? { [key]: normalized }
    : {};
}

function optionalRelayObjectArrayProperty(key, value) {
  const normalized = sanitizeBrandRelayValue(value, key);

  if (Array.isArray(normalized) && normalized.length > 0) {
    return { [key]: normalized };
  }

  if (normalized && typeof normalized === 'object') {
    return { [key]: [normalized] };
  }

  return {};
}

function normalizeOptionalRelayString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeBrandRelayValue(value, fieldName = '') {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const list = value
      .map((item) => sanitizeBrandRelayValue(item, fieldName))
      .filter((item) => item !== undefined);

    return list.length ? list : undefined;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value).reduce((accumulator, [key, itemValue]) => {
      if (BRAND_RELAY_OMITTED_KEYS.has(key)) {
        return accumulator;
      }

      if (isUnsafeBrandImageUrlKey(key) && isUnsafeBrandImageUrl(itemValue)) {
        throw new MessageSendValidationError(
          '브랜드 이미지 메시지는 NHN 업로드가 완료된 이미지만 발송할 수 있습니다.',
          { code: 'BRAND_IMAGE_UPLOAD_REQUIRED', title: '브랜드 이미지 업로드 필요' }
        );
      }

      const normalized = sanitizeBrandRelayValue(itemValue, key);

      if (normalized !== undefined) {
        accumulator.push([key, normalized]);
      }

      return accumulator;
    }, []);

    return entries.length ? Object.fromEntries(entries) : undefined;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized ? normalized : undefined;
  }

  return value;
}

function isUnsafeBrandImageUrlKey(key) {
  return ['imageUrl', 'thumbnailUrl'].includes(key);
}

function isUnsafeBrandImageUrl(value) {
  const url = typeof value === 'string' ? value.trim() : '';
  return Boolean(url) && (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('sample:'));
}

function buildAlimtalkFallback(message) {
  if (!message.fallbackEnabled) {
    return { enabled: false };
  }

  const smsSenderResourceId = normalizeRequiredString(message.fallbackSenderNumber, {
    message: 'SMS 대체 발송용 발신번호를 선택해 주세요.',
    title: 'SMS 대체 발신번호 필요',
  });

  return {
    enabled: true,
    resendType: 'SMS',
    smsSenderResourceId,
  };
}

function buildBrandFallback(message) {
  if (!message.fallbackEnabled) {
    return { enabled: false };
  }

  const smsSenderResourceId = normalizeRequiredString(message.fallbackSenderNumber, {
    message: 'SMS 대체 발송용 발신번호를 선택해 주세요.',
    title: 'SMS 대체 발신번호 필요',
  });
  const advertisementEnabled = Boolean(message.fallbackAdvertisementEnabled);
  const resendUnsubscribeNo = String(message.fallbackUnsubscribeNumber ?? '').trim();

  if (advertisementEnabled && !resendUnsubscribeNo) {
    throw new MessageSendValidationError(
      '광고성 SMS 대체발송에는 080 수신거부 번호가 필요합니다.',
      { code: 'BRAND_FALLBACK_UNSUBSCRIBE_REQUIRED', title: '080 번호 필요' }
    );
  }

  return {
    enabled: true,
    resendType: 'SMS',
    smsSenderResourceId,
    ...(advertisementEnabled ? {
      advertisement: {
        enabled: true,
        unsubscribeNo: resendUnsubscribeNo,
      },
      resendUnsubscribeNo,
    } : {}),
  };
}

function getSmsAttachFileIdList(message) {
  const attachments = Array.isArray(message.imageAttachments) ? message.imageAttachments : [];
  const attachFileIdList = attachments
    .map((attachment) => attachment?.attachFileId ?? attachment?.fileId)
    .filter((fileId) => fileId !== undefined && fileId !== null && fileId !== '');
  const hasBrowserOnlyAttachment = attachments.some((attachment) => (
    attachment
    && (attachment.fileBody || attachment.previewUrl || attachment.file)
    && !(attachment.attachFileId || attachment.fileId)
  ));

  if (hasBrowserOnlyAttachment || (message.imageName && attachFileIdList.length === 0)) {
    throw new MessageSendValidationError(
      '이미지 첨부 발송은 업로드된 파일 ID만 지원합니다. 현재 선택한 브라우저 미리보기 이미지는 발송할 수 없습니다.',
      { code: 'MMS_UPLOAD_REQUIRED', title: 'MMS 첨부 업로드 필요' }
    );
  }

  return attachFileIdList;
}

function getSelectedTemplate(templateId, templates) {
  if (!templateId) {
    return null;
  }

  return templates.find((template) => (
    template.value === templateId
    || template.templateCode === templateId
    || template.templateId === templateId
    || template.id === templateId
  )) ?? null;
}

function getTemplateCode(template) {
  return template.templateCode ?? template.templateId ?? template.value ?? template.id;
}

function getSmsTitle(template) {
  return template?.title
    ?? template?.templateName
    ?? template?.label
    ?? '문자 메시지';
}

function formatRelayRequestDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  const now = new Date();
  const maxDate = new Date(now.getTime() + SCHEDULE_MAX_DAYS * 24 * 60 * 60 * 1000);

  if (Number.isNaN(date.getTime()) || date < now || date > maxDate) {
    throw new MessageSendValidationError(
      '예약 시간은 현재부터 50일 이내의 유효한 날짜와 시간이어야 합니다.',
      { code: 'INVALID_REQUEST_DATE', title: '예약 시간 확인 필요' }
    );
  }

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

function formatBrandRelayRequestDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  const now = new Date();
  const maxDate = new Date(now.getTime() + BRAND_SCHEDULE_MAX_DAYS * 24 * 60 * 60 * 1000);

  if (Number.isNaN(date.getTime()) || date < now || date > maxDate) {
    throw new MessageSendValidationError(
      '브랜드 메시지 예약 시간은 현재부터 60일 이내의 유효한 날짜와 시간이어야 합니다.',
      { code: 'INVALID_REQUEST_DATE', title: '예약 시간 확인 필요' }
    );
  }

  if (isRestrictedBrandMessageDate(date)) {
    throw new MessageSendValidationError(
      '브랜드 메시지는 20:50부터 다음 날 08:00까지 발송할 수 없습니다.',
      { code: 'BRAND_NIGHT_SEND_RESTRICTED', title: '야간 발송 제한' }
    );
  }

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

function isRestrictedBrandMessageDate(date) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= 20 * 60 + 50 || minutes < 8 * 60;
}

function pad(value) {
  return String(value).padStart(2, '0');
}
