const VALID_ALIMTALK_VARIABLE_PATTERN = /#{(.+?)}/g;
const SOURCE_STRICT_VARIABLE_PATTERN = /([$|#])([\\[|{])(.+?)([}\]])/g;
const UNSUPPORTED_EMOJI_SEQUENCE_PATTERN =
  /[\u{1F300}-\u{1F9FF}][\u{200D}][\u{2640}\u{2642}\u{2695}\u{2696}\u{2708}\u{2764}\u{1F33E}\u{1F373}\u{1F393}\u{1F3A4}\u{1F3A8}\u{1F3EB}\u{1F3ED}\u{1F4BB}\u{1F4BC}\u{1F527}\u{1F52C}\u{1F680}\u{1F692}\u{1F9AF}\u{1F9BC}\u{1F9BD}][\u{FE0F}]?/gu;

export {
  validateAlimtalkTemplateAdvancedSections,
  validateAlimtalkTemplateHighlightThumbnailFile,
  validateAlimtalkTemplateImageFile,
} from './alimtalkTemplateAdvancedValidation.js';

export const ALIMTALK_TEMPLATE_VALIDATION_MESSAGES = Object.freeze({
  addChannelButtonDuplicate: '채널추가 버튼은 한 개만 사용할 수 있습니다.',
  addChannelButtonPosition: '채널추가 버튼은 첫 번째 버튼에서만 사용할 수 있습니다.',
  actionAppLinkRequired: '앱링크 타입은 Android 앱 링크와 iOS 앱 링크를 입력해야 합니다.',
  actionNameRequired: '버튼과 바로가기 이름은 필수입니다.',
  actionNameTooLong: '버튼과 바로가기 이름은 14자를 넘을 수 없습니다.',
  actionWebLinkRequired: '웹링크 타입은 모바일 링크를 입력해야 합니다.',
  buttonBotEventRequired: '봇전환 버튼은 봇 이벤트명을 입력해야 합니다.',
  buttonTooMany: '버튼은 최대 5개까지 등록할 수 있습니다.',
  buttonTooManyWithQuickReplies: '바로가기를 사용하는 템플릿은 버튼을 최대 2개까지 등록할 수 있습니다.',
  contentInvalidVariable: '템플릿 내용에 올바르지 않은 변수가 있는지 확인하세요.',
  contentRequired: '템플릿 내용은 필수로 입력해야 합니다.',
  contentTooShort: '템플릿 내용이 너무 짧습니다.',
  contentUnsupportedEmoji: '템플릿 내용에 사용할 수 없는 이모지가 있습니다.',
  emphasisSubtitleNoVariables: '강조표기 보조문구에는 변수가 사용될 수 없습니다.',
  emphasisSubtitleRequired: '강조표기 보조문구는 필수로 입력해야 합니다.',
  emphasisSubtitleTooLong: '강조표기 보조문구는 50자를 넘을 수 없습니다.',
  emphasisTitleInvalidVariable: '강조표기 제목에 올바르지 않은 변수가 있는지 확인하세요.',
  emphasisTitleRequired: '강조표기 제목은 필수로 입력해야 합니다.',
  emphasisTitleTooLong: '강조표기 제목은 50자를 넘을 수 없습니다.',
  extraNoVariables: '부가정보에는 변수가 사용될 수 없습니다.',
  extraTooLong: '부가정보는 500자를 넘을 수 없습니다.',
  highlightDescriptionNoVariables: '하이라이트 설명에는 변수가 포함될 수 없습니다.',
  highlightDescriptionRequired: '하이라이트 설명이 입력되지 않았습니다.',
  highlightDescriptionTooLong: '하이라이트 설명은 16자 이내로 입력하세요.',
  highlightThumbnailInvalidType: '하이라이트 썸네일 이미지 사용할 수 없는 파일 확장자 입니다. JPG, PNG 파일인지 다시 확인하세요.',
  highlightThumbnailUnreadable: '하이라이트 썸네일 이미지 파일을 읽을 수 없습니다. JPG, PNG 파일인지 다시 확인하세요.',
  highlightThumbnailTooLarge: '하이라이트 썸네일 이미지의 파일 사이즈가 500KB를 초과합니다.',
  highlightThumbnailTooNarrow: '하이라이트 썸네일 이미지 파일 너비가 108px보다 작습니다. 너비가 108px 이상인 파일만 사용가능합니다.',
  highlightTitleRequired: '하이라이트 제목이 입력되지 않았습니다.',
  highlightTitleTooLong: '하이라이트 제목은 30자 이내로 입력하세요.',
  imageInvalidType: '사용할 수 없는 파일 확장자 입니다. JPG, PNG 파일인지 다시 확인하세요.',
  imageRequired: '이미지형 템플릿의 경우 이미지 업로드는 필수입니다.',
  imageTooLarge: '파일 사이즈가 500KB를 초과합니다.',
  imageTooNarrow: '파일 너비가 500px보다 작습니다. 너비가 500px 이상인 파일만 사용가능합니다.',
  imageUnreadable: '이미지 파일을 읽을 수 없습니다. JPG, PNG 파일인지 다시 확인하세요.',
  itemListHeaderRequired: '헤더가 입력되지 않았습니다. 사용하지 않으려면 체크를 해제하세요.',
  itemListHeaderTooLong: '헤더는 16자 이내로 입력하세요.',
  itemListSectionRequired: '리스트형 템플릿은 이미지, 헤더, 하이라이트, 목록 중 1개 이상은 필수 입력입니다.',
  itemListTooFew: '아이템 리스트는 최소 2개 이상 존재해야 합니다.',
  itemListTooMany: '아이템 리스트는 최대 10개 까지 등록가능합니다.',
  quickReplyTooMany: '바로가기는 최대 10개까지 등록할 수 있습니다.',
  summaryDescriptionRequired: '합계 값이 입력되지 않았습니다. 사용하지 않으려면 체크를 해제하세요.',
  summaryDescriptionTooLong: '합계 값은 14자 이내로 입력하세요.',
  summaryTitleNoVariables: '합계 제목에는 변수가 포함될 수 없습니다.',
  summaryTitleRequired: '합계 제목이 입력되지 않았습니다. 사용하지 않으려면 체크를 해제하세요.',
  summaryTitleTooLong: '합계 제목은 6자 이내로 입력하세요.',
  summaryVariableInvalidCharacters: '합계 값 내용 변수 외 값에 사용할 수 없는 값이 포함되었습니다. 숫자, 콤마, (원, $, ₩)만 입력가능',
  summaryVariableTextTooLong: '합계 값 내용 변수 외 값이 13자를 초과합니다.',
  templateNameNoVariables: '템플릿 이름에는 변수가 사용될 수 없습니다.',
  templateNameTooLong: '템플릿 이름은 90자를 넘을 수 없습니다.',
  templateNameTooShort: '템플릿 제목이 너무 짧습니다.',
});

export function getAlimtalkTemplateMaxContentLength(emphasizeType) {
  return emphasizeType === 'ITEM_LIST' ? 164 : 1000;
}

export function getAlimtalkTemplateContentDefaults({ emphasizeType } = {}) {
  return {
    isTextEmphasize: String(emphasizeType).toUpperCase() === 'TEXT',
    maxContentLength: getAlimtalkTemplateMaxContentLength(emphasizeType),
  };
}

export function getAlimtalkTemplateTextSize(text = '') {
  let size = 0;
  const characters = text.match(/[^\x05]|.+/g) || [];

  for (const character of characters) {
    size += character.charCodeAt(0) <= 127 ? 1 : 2;
  }

  return Number(size);
}

export function detectUnsupportedAlimtalkEmoji(text) {
  if (!text || !text.includes('\u200D')) {
    return null;
  }

  const brokenEmojis = [];
  const regexp = new RegExp(UNSUPPORTED_EMOJI_SEQUENCE_PATTERN.source, UNSUPPORTED_EMOJI_SEQUENCE_PATTERN.flags);
  let match = regexp.exec(text);

  while (match !== null) {
    brokenEmojis.push(match[0]);

    if (match.index === regexp.lastIndex) {
      regexp.lastIndex += 1;
    }

    match = regexp.exec(text);
  }

  if (brokenEmojis.length < 1) {
    return null;
  }

  return {
    brokenEmojis,
    hasBrokenEmoji: true,
    message: `이모지가 저장 시 분리될 수 있습니다: ${brokenEmojis.join(', ')}`,
  };
}

export function getAlimtalkTemplateVariables(text, { strict = false } = {}) {
  if (isSourceEmpty(text)) {
    return false;
  }

  if (strict === true) {
    return text.replace(VALID_ALIMTALK_VARIABLE_PATTERN, '').match(SOURCE_STRICT_VARIABLE_PATTERN);
  }

  return text.match(VALID_ALIMTALK_VARIABLE_PATTERN);
}

export function hasAlimtalkTemplateVariables(text, { strict = false } = {}) {
  return isSourceEmpty(text) ? false : getAlimtalkTemplateVariables(text, { strict }) !== null;
}

export function validateAlimtalkTemplateContent(formData = {}) {
  const contentDefaults = getAlimtalkTemplateContentDefaults({ emphasizeType: formData.emphasizeType });
  const {
    formEmphasizeSubtitle = formData.emphasizeSubtitle ?? '',
    formEmphasizeTitle = formData.emphasizeTitle ?? '',
    formExtraText = formData.extraText ?? formData.extra ?? '',
    formTemplateContent = formData.templateContent ?? '',
    formTemplateName = formData.templateName ?? '',
    isTextEmphasize = contentDefaults.isTextEmphasize,
    maxContentLength = contentDefaults.maxContentLength,
  } = formData;
  const errors = [];

  if (sourceLength(formTemplateName) > 90) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.templateNameTooLong);
  } else if (!isSourceEmpty(formTemplateName) && sourceLength(formTemplateName) < 2) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.templateNameTooShort);
  } else if (hasAlimtalkTemplateVariables(formTemplateName) === true) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.templateNameNoVariables);
  }

  if (isSourceEmpty(formTemplateContent)) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.contentRequired);
  } else if (getAlimtalkTemplateTextSize(formTemplateContent) < 2) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.contentTooShort);
  } else if (sourceLength(formTemplateContent) + sourceLength(formExtraText) > maxContentLength) {
    pushError(errors, getContentLengthMessage(maxContentLength));
  } else if (hasAlimtalkTemplateVariables(formTemplateContent, { strict: true }) === true) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.contentInvalidVariable);
  } else if (detectUnsupportedAlimtalkEmoji(formTemplateContent) !== null) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.contentUnsupportedEmoji);
  }

  if (sourceLength(formExtraText) > 500) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.extraTooLong);
  } else if (hasAlimtalkTemplateVariables(formExtraText) === true) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.extraNoVariables);
  }

  if (isTextEmphasize === true) {
    if (isSourceEmpty(formEmphasizeTitle)) {
      pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.emphasisTitleRequired);
    } else if (sourceLength(formEmphasizeTitle) > 50) {
      pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.emphasisTitleTooLong);
    } else if (hasAlimtalkTemplateVariables(formEmphasizeTitle, { strict: true }) === true) {
      pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.emphasisTitleInvalidVariable);
    }

    if (isSourceEmpty(formEmphasizeSubtitle)) {
      pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.emphasisSubtitleRequired);
    } else if (sourceLength(formEmphasizeSubtitle) > 50) {
      pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.emphasisSubtitleTooLong);
    } else if (hasAlimtalkTemplateVariables(formEmphasizeSubtitle) === true) {
      pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.emphasisSubtitleNoVariables);
    }
  }

  return errors;
}

function getContentLengthMessage(maxContentLength) {
  return `템플릿 내용과 부가정보 내용 길이의 합은 ${Number(maxContentLength).toLocaleString()}자를 넘을 수 없습니다.`;
}

function isSourceEmpty(value) {
  return value === undefined
    || value === false
    || value === null
    || String(value).trim().replace(/\\t\\s\\n/g, '') === '';
}

function pushError(errors, message) {
  errors.push({ message });
}

function sourceLength(value) {
  return value?.length ?? 0;
}
