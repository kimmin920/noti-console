import {
  ALIMTALK_TEMPLATE_VALIDATION_MESSAGES,
  hasAlimtalkTemplateVariables,
} from './alimtalkTemplateValidation.js';
import {
  getAlimtalkTemplateActionRuleState,
  normalizeAlimtalkTemplateActionType,
} from './alimtalkTemplateActionRules.js';

export function validateAlimtalkTemplateAdvancedSections(formData = {}) {
  const emphasizeType = String(formData.emphasizeType).toUpperCase();
  const actionErrors = validateActions(formData);

  if (emphasizeType === 'IMAGE') {
    return [
      ...validateImageTemplate(formData),
      ...actionErrors,
    ];
  }

  if (emphasizeType !== 'ITEM_LIST') {
    return actionErrors;
  }

  const {
    header = '',
    highlightDescription = '',
    highlightThumbnailFileInfo,
    highlightTitle = '',
    items = [],
    summaryDescription = '',
    summaryTitle = '',
    useHeader = false,
    useHighlight = false,
    useItemList = false,
    useSummary = false,
    useSummaryVariable = false,
  } = formData;
  const errors = [];
  const hasImage = hasSourceValue(formData.imageFileData)
    || hasSourceValue(formData.imageId)
    || hasSourceValue(formData.imageUrl);

  validateItemListPresence(errors, { hasImage, useHeader, useHighlight, useItemList });
  validateHeader(errors, { header, useHeader });
  validateHighlight(errors, { highlightDescription, highlightThumbnailFileInfo, highlightTitle, useHighlight });
  validateItems(errors, { items, useItemList });
  validateSummary(errors, { summaryDescription, summaryTitle, useSummary, useSummaryVariable });
  errors.push(...actionErrors);

  return errors;
}

export function validateAlimtalkTemplateImageFile(fileInfo = null) {
  if (!fileInfo) {
    return [];
  }

  const errors = [];
  const fileType = String(fileInfo.fileType ?? '').toLowerCase();
  const width = Number(fileInfo.width);
  const height = Number(fileInfo.height);

  if (Number.isFinite(Number(fileInfo.fileSize)) && Math.ceil(Number(fileInfo.fileSize) / 1024) > 500) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.imageTooLarge, 3);
  }

  if (!['image/jpg', 'image/jpeg', 'image/png'].includes(fileType)) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.imageInvalidType, 2);
  } else if (fileInfo.readError === true) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.imageUnreadable, 2);
  }

  if (fileInfo.readError === true) {
    return errors;
  }

  if (width < 500) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.imageTooNarrow, 0);
  }

  if (width / height !== 2) {
    pushError(errors, getImageRatioMessage(width, height), 1);
  }

  return errors;
}

export function validateAlimtalkTemplateHighlightThumbnailFile(fileInfo = null) {
  if (!fileInfo) {
    return [];
  }

  const errors = [];
  const fileType = String(fileInfo.fileType ?? '').toLowerCase();
  const width = Number(fileInfo.width);
  const height = Number(fileInfo.height);

  if (Number.isFinite(Number(fileInfo.fileSize)) && Math.ceil(Number(fileInfo.fileSize) / 1024) > 500) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.highlightThumbnailTooLarge, 3);
  }

  if (!['image/jpg', 'image/jpeg', 'image/png'].includes(fileType)) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.highlightThumbnailInvalidType, 2);
  } else if (fileInfo.readError === true) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.highlightThumbnailUnreadable, 2);
  }

  if (fileInfo.readError === true) {
    return errors;
  }

  if (width < 108) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.highlightThumbnailTooNarrow, 0);
  }

  if (width / height !== 1) {
    pushError(errors, getHighlightThumbnailRatioMessage(width, height), 1);
  }

  return errors;
}

function validateImageTemplate(formData) {
  const errors = [];
  const imageErrors = validateAlimtalkTemplateImageFile(formData.imageFileInfo);

  if (!hasSourceValue(formData.imageFileData)) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.imageRequired);
  }

  errors.push(...imageErrors);

  return errors;
}

function validateItemListPresence(errors, { hasImage, useHeader, useHighlight, useItemList }) {
  if (hasImage !== true && useHeader !== true && useHighlight !== true && useItemList !== true) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.itemListSectionRequired);
  }
}

function validateHeader(errors, { header, useHeader }) {
  if (useHeader !== true) {
    return;
  }

  if (isSourceEmpty(header)) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.itemListHeaderRequired);
  } else if (sourceLength(header) > 16) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.itemListHeaderTooLong);
  }
}

function validateHighlight(errors, { highlightDescription, highlightThumbnailFileInfo, highlightTitle, useHighlight }) {
  if (useHighlight !== true) {
    return;
  }

  if (isSourceEmpty(highlightTitle)) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.highlightTitleRequired);
  } else if (sourceLength(highlightTitle) > 30) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.highlightTitleTooLong);
  }

  if (isSourceEmpty(highlightDescription)) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.highlightDescriptionRequired);
  } else if (sourceLength(highlightDescription) > 16) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.highlightDescriptionTooLong);
  } else if (hasAlimtalkTemplateVariables(highlightDescription) === true) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.highlightDescriptionNoVariables);
  }

  if (highlightThumbnailFileInfo) {
    errors.push(...validateAlimtalkTemplateHighlightThumbnailFile(highlightThumbnailFileInfo));
  }
}

function validateItems(errors, { items, useItemList }) {
  if (useItemList !== true) {
    return;
  }

  if (items.length > 0 && items.length < 2) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.itemListTooFew);
  } else if (items.length > 10) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.itemListTooMany);
  }
}

function validateSummary(errors, { summaryDescription, summaryTitle, useSummary, useSummaryVariable }) {
  if (useSummary !== true) {
    return;
  }

  if (isSourceEmpty(summaryTitle)) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.summaryTitleRequired);
  } else if (sourceLength(summaryTitle) > 6) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.summaryTitleTooLong);
  } else if (hasAlimtalkTemplateVariables(summaryTitle) === true) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.summaryTitleNoVariables);
  }

  if (isSourceEmpty(summaryDescription)) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.summaryDescriptionRequired);
  } else if (sourceLength(summaryDescription) > 14) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.summaryDescriptionTooLong);
  } else if (useSummaryVariable === true && hasAlimtalkTemplateVariables(summaryDescription) === true) {
    validateSummaryVariableText(errors, summaryDescription);
  }
}

function validateSummaryVariableText(errors, summaryDescription) {
  const summaryTextWithoutVariables = removeAllAlimtalkTemplateVariables(summaryDescription);

  if (/[^0-9,₩원\$]/g.test(summaryTextWithoutVariables) === true) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.summaryVariableInvalidCharacters);
  } else if (summaryTextWithoutVariables.length > 13) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.summaryVariableTextTooLong);
  }
}

function validateActions(formData) {
  const errors = [];
  const buttons = Array.isArray(formData.buttons) ? formData.buttons : [];
  const quickReplies = Array.isArray(formData.quickReplies) ? formData.quickReplies : [];

  validateActionLimits(errors, { buttons, quickReplies });

  buttons.forEach((button, index) => {
    validateAction(errors, {
      action: button,
      fallbackType: 'WL',
      label: `버튼 ${index + 1}`,
      name: button?.buttonName,
      type: button?.buttonType,
      validatesBotEvent: true,
    });
  });

  quickReplies.forEach((reply, index) => {
    validateAction(errors, {
      action: reply,
      fallbackType: 'BK',
      label: `바로가기 ${index + 1}`,
      name: reply?.name,
      type: reply?.type,
      validatesBotEvent: false,
    });
  });

  return errors;
}

function validateActionLimits(errors, { buttons, quickReplies }) {
  const ruleState = getAlimtalkTemplateActionRuleState({ buttons, quickReplies });

  if (ruleState.exceedsButtonMax === true) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.buttonTooMany);
  }

  if (ruleState.exceedsButtonMaxWithQuickReplies === true) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.buttonTooManyWithQuickReplies);
  }

  if (ruleState.exceedsQuickReplyMax === true) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.quickReplyTooMany);
  }

  if (ruleState.hasDuplicateAddChannelButton === true) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.addChannelButtonDuplicate);
  }

  if (ruleState.hasMisplacedAddChannelButton === true) {
    pushError(errors, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.addChannelButtonPosition);
  }
}

function validateAction(errors, { action, fallbackType, label, name, type, validatesBotEvent }) {
  const actionType = normalizeAlimtalkTemplateActionType(type || fallbackType);
  const actionName = String(name ?? '');

  if (isSourceEmpty(actionName)) {
    pushError(errors, getActionMessage(label, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.actionNameRequired));
  } else if (sourceLength(actionName) > 14) {
    pushError(errors, getActionMessage(label, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.actionNameTooLong));
  }

  if (actionType === 'WL' && !hasSourceValue(action?.linkMo)) {
    pushError(errors, getActionMessage(label, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.actionWebLinkRequired));
  }

  if (actionType === 'AL' && (
    !hasSourceValue(action?.schemeAndroid ?? action?.linkAnd)
    || !hasSourceValue(action?.schemeIos ?? action?.linkIos)
  )) {
    pushError(errors, getActionMessage(label, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.actionAppLinkRequired));
  }

  if (validatesBotEvent === true && actionType === 'BT' && !hasSourceValue(action?.chatEvent)) {
    pushError(errors, getActionMessage(label, ALIMTALK_TEMPLATE_VALIDATION_MESSAGES.buttonBotEventRequired));
  }
}

function getActionMessage(label, message) {
  return `${label}: ${message}`;
}

function isSourceEmpty(value) {
  return value === undefined
    || value === false
    || value === null
    || String(value).trim().replace(/\\t\\s\\n/g, '') === '';
}

function hasSourceValue(value) {
  if (Array.isArray(value)) {
    return value.some((item) => !isSourceEmpty(item));
  }

  return !isSourceEmpty(value);
}

function removeAllAlimtalkTemplateVariables(text = '') {
  return String(text).replace(/#{.*?}/g, '');
}

function getHighlightThumbnailRatioMessage(width, height) {
  const ratio = String(width / height).substring(0, 5);

  return `하이라이트 썸네일 이미지의 가로:세로 비율이 1:1이어야 합니다. / 현재 비율:${ratio}:1 / 너비:${width} 높이:${height}`;
}

function getImageRatioMessage(width, height) {
  const ratio = String(width / height).substring(0, 5);

  return `이미지의 가로:세로 비율이 2:1이어야 합니다. / 현재 비율 ${ratio}:1 / 너비:${width} 높이:${height}`;
}

function pushError(errors, message, thumbnailCheckIndex = null) {
  errors.push({ message, thumbnailCheckIndex });
}

function sourceLength(value) {
  return value?.length ?? 0;
}
