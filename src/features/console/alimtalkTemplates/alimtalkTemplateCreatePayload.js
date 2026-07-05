import {
  getAlimtalkTemplateActionRuleState,
  normalizeAlimtalkTemplateActionType,
} from './alimtalkTemplateActionRules.js';

export class AlimtalkTemplateCreateValidationError extends Error {
  constructor(message, { code = 'ALIMTALK_TEMPLATE_CREATE_INVALID', title = '템플릿 등록 설정 필요' } = {}) {
    super(message);
    this.name = 'AlimtalkTemplateCreateValidationError';
    this.code = code;
    this.title = title;
  }
}

const TEMPLATE_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
const ALIMTALK_TEMPLATE_CODE_MAX_LENGTH = 50;
const ALIMTALK_TEMPLATE_NAME_MAX_LENGTH = 90;

export function buildAlimtalkTemplateCreatePayload(template = {}, { senderResourceId } = {}) {
  const resolvedSenderResourceId = requireString(senderResourceId, '발신 채널을 선택해 주세요.');
  const templateCode = requireString(template.templateCode, '템플릿 코드를 입력해 주세요.');
  const templateName = requireString(template.templateName, '템플릿 이름을 입력해 주세요.');
  const templateContent = requireString(template.templateContent, '템플릿 내용을 입력해 주세요.');
  const emphasizeType = normalizeEmphasizeType(template.emphasizeType);

  validateTemplateCode(templateCode);

  if (templateName.length > ALIMTALK_TEMPLATE_NAME_MAX_LENGTH) {
    throw new AlimtalkTemplateCreateValidationError('템플릿 이름은 90자를 넘을 수 없습니다.');
  }

  if (emphasizeType === 'IMAGE' && !hasProviderImage(template)) {
    throw new AlimtalkTemplateCreateValidationError(
      '이미지형 알림톡은 NHN 템플릿 이미지 업로드 연결 후 등록할 수 있습니다.'
    );
  }

  validateAlimtalkTemplateCreateActions(template);

  const payload = {
    senderResourceId: resolvedSenderResourceId,
    templateCode,
    templateName,
    templateContent,
    templateMessageType: getTemplateMessageType(template),
    templateEmphasizeType: emphasizeType,
    ...(template.securityFlag === true ? { securityFlag: true } : {}),
    ...optionalStringProperty('templateExtra', template.extraText ?? template.templateExtra),
    ...getEmphasisFields(template, emphasizeType),
    ...getImageFields(template, emphasizeType),
    ...getItemListFields(template, emphasizeType),
    ...getActionFields(template),
  };

  return payload;
}

function validateAlimtalkTemplateCreateActions(template) {
  const buttons = normalizeActions(template.buttons, normalizeButtonAction);
  const quickReplies = normalizeActions(template.quickReplies, normalizeQuickReplyAction);
  const ruleState = getAlimtalkTemplateActionRuleState({ buttons, quickReplies });

  if (ruleState.exceedsButtonMax === true) {
    throw new AlimtalkTemplateCreateValidationError('버튼은 최대 5개까지 등록할 수 있습니다.');
  }

  if (ruleState.exceedsButtonMaxWithQuickReplies === true) {
    throw new AlimtalkTemplateCreateValidationError(
      '바로가기를 사용하는 템플릿은 버튼을 최대 2개까지 등록할 수 있습니다.'
    );
  }

  if (ruleState.exceedsQuickReplyMax === true) {
    throw new AlimtalkTemplateCreateValidationError('바로가기는 최대 10개까지 등록할 수 있습니다.');
  }

  if (ruleState.hasDuplicateAddChannelButton === true) {
    throw new AlimtalkTemplateCreateValidationError('채널추가 버튼은 한 개만 사용할 수 있습니다.');
  }

  if (ruleState.hasMisplacedAddChannelButton === true) {
    throw new AlimtalkTemplateCreateValidationError('채널추가 버튼은 첫 번째 버튼에서만 사용할 수 있습니다.');
  }
}

function requireString(value, message) {
  const normalized = normalizeString(value);

  if (!normalized) {
    throw new AlimtalkTemplateCreateValidationError(message);
  }

  return normalized;
}

function validateTemplateCode(templateCode) {
  if (templateCode.length > ALIMTALK_TEMPLATE_CODE_MAX_LENGTH || TEMPLATE_CODE_PATTERN.test(templateCode) !== true) {
    throw new AlimtalkTemplateCreateValidationError(
      '템플릿 코드는 영문, 숫자, 밑줄, 하이픈만 사용할 수 있습니다.'
    );
  }
}

function normalizeEmphasizeType(value) {
  const emphasizeType = normalizeString(value)?.toUpperCase() || 'NONE';

  if (['NONE', 'TEXT', 'IMAGE', 'ITEM_LIST'].includes(emphasizeType)) {
    return emphasizeType;
  }

  throw new AlimtalkTemplateCreateValidationError('지원하지 않는 알림톡 템플릿 유형입니다.');
}

function getTemplateMessageType(template) {
  const providedType = normalizeString(template.templateMessageType)?.toUpperCase();
  if (providedType && ['BA', 'EX', 'AD', 'MI'].includes(providedType)) {
    return providedType;
  }

  const hasAddChannelButton = (template.buttons ?? []).some((button) => (
    normalizeAlimtalkTemplateActionType(button?.buttonType ?? button?.type) === 'AC'
  ));
  const hasExtra = Boolean(normalizeString(template.extraText ?? template.templateExtra));

  if (hasAddChannelButton && hasExtra) return 'MI';
  if (hasAddChannelButton) return 'AD';
  if (hasExtra) return 'EX';
  return 'BA';
}

function getEmphasisFields(template, emphasizeType) {
  if (emphasizeType !== 'TEXT') {
    return {};
  }

  return {
    templateTitle: requireString(template.emphasizeTitle ?? template.templateTitle, '강조 제목을 입력해 주세요.'),
    templateSubtitle: requireString(template.emphasizeSubtitle ?? template.templateSubtitle, '강조 보조 문구를 입력해 주세요.'),
  };
}

function getImageFields(template, emphasizeType) {
  if (emphasizeType !== 'IMAGE') {
    return {};
  }

  return {
    templateImageName: requireString(template.templateImageName, 'NHN에 업로드된 이미지 이름이 필요합니다.'),
    templateImageUrl: requireString(template.templateImageUrl, 'NHN에 업로드된 이미지 URL이 필요합니다.'),
  };
}

function getItemListFields(template, emphasizeType) {
  if (emphasizeType !== 'ITEM_LIST') {
    return {};
  }

  const templateItem = {};
  const itemList = Array.isArray(template.items)
    ? template.items
        .map((item) => ({
          title: normalizeString(item?.title),
          description: normalizeString(item?.description),
        }))
        .filter((item) => item.title || item.description)
    : [];

  if (itemList.length > 0) {
    templateItem.list = itemList;
  }

  if (template.useSummary === true) {
    templateItem.summary = {
      description: requireString(template.summaryDescription, '합계 값을 입력해 주세요.'),
      title: requireString(template.summaryTitle, '합계 제목을 입력해 주세요.'),
    };
  }

  return {
    ...optionalStringProperty('templateHeader', template.useHeader === true ? template.header : ''),
    ...(Object.keys(templateItem).length ? { templateItem } : {}),
    ...getItemHighlightField(template),
  };
}

function getItemHighlightField(template) {
  if (template.useHighlight !== true) {
    return {};
  }

  const highlight = {
    description: requireString(template.highlightDescription, '하이라이트 설명을 입력해 주세요.'),
    title: requireString(template.highlightTitle, '하이라이트 제목을 입력해 주세요.'),
    ...optionalStringProperty('imageUrl', getProviderImageUrl(template.highlighThumbnailImageUrl)),
  };

  return { templateItemHighlight: highlight };
}

function getActionFields(template) {
  const buttons = normalizeActions(template.buttons, normalizeButtonAction);
  const quickReplies = normalizeActions(template.quickReplies, normalizeQuickReplyAction);

  return {
    ...(buttons.length ? { buttons } : {}),
    ...(quickReplies.length ? { quickReplies } : {}),
  };
}

function normalizeActions(actions, normalizeAction) {
  return Array.isArray(actions)
    ? actions.map(normalizeAction).filter((action) => action.name && action.type)
    : [];
}

function normalizeButtonAction(button, index) {
  return compactObject({
    ordering: index + 1,
    type: normalizeAlimtalkTemplateActionType(button?.buttonType ?? button?.type),
    name: normalizeString(button?.buttonName ?? button?.name),
    linkMo: normalizeString(button?.linkMo),
    linkPc: normalizeString(button?.linkPc),
    schemeAndroid: normalizeString(button?.schemeAndroid ?? button?.linkAnd),
    schemeIos: normalizeString(button?.schemeIos ?? button?.linkIos),
    chatExtra: normalizeString(button?.chatExtra),
    chatEvent: normalizeString(button?.chatEvent),
  });
}

function normalizeQuickReplyAction(reply, index) {
  return compactObject({
    ordering: index + 1,
    type: normalizeAlimtalkTemplateActionType(reply?.type),
    name: normalizeString(reply?.name),
    linkMo: normalizeString(reply?.linkMo),
    linkPc: normalizeString(reply?.linkPc),
    schemeAndroid: normalizeString(reply?.schemeAndroid ?? reply?.linkAnd),
    schemeIos: normalizeString(reply?.schemeIos ?? reply?.linkIos),
  });
}

function hasProviderImage(template) {
  return Boolean(normalizeString(template.templateImageName) && normalizeString(template.templateImageUrl));
}

function getProviderImageUrl(value) {
  const imageUrl = normalizeString(value);

  if (!imageUrl || imageUrl.startsWith('data:')) {
    return null;
  }

  return imageUrl;
}

function optionalStringProperty(key, value) {
  const normalized = normalizeString(value);
  return normalized ? { [key]: normalized } : {};
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '')
  );
}

function normalizeString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}
