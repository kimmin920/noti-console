export const ALIMTALK_TEMPLATE_BUTTON_MAX_COUNT = 5;
export const ALIMTALK_TEMPLATE_BUTTON_MAX_WITH_QUICK_REPLIES = 2;
export const ALIMTALK_TEMPLATE_QUICK_REPLY_MAX_COUNT = 10;
export const ALIMTALK_TEMPLATE_ADD_CHANNEL_BUTTON_TYPE = 'AC';

export function getAlimtalkTemplateButtonLimit({ quickReplyCount = 0 } = {}) {
  return quickReplyCount > 0
    ? ALIMTALK_TEMPLATE_BUTTON_MAX_WITH_QUICK_REPLIES
    : ALIMTALK_TEMPLATE_BUTTON_MAX_COUNT;
}

export function normalizeAlimtalkTemplateActionType(value) {
  return String(value ?? '').trim().toUpperCase();
}

export function getAlimtalkTemplateActionRuleState({ buttons = [], quickReplies = [] } = {}) {
  const normalizedButtons = Array.isArray(buttons) ? buttons : [];
  const normalizedQuickReplies = Array.isArray(quickReplies) ? quickReplies : [];
  const addChannelButtonIndexes = normalizedButtons
    .map((button, index) => (
      normalizeAlimtalkTemplateActionType(button?.buttonType ?? button?.type) === ALIMTALK_TEMPLATE_ADD_CHANNEL_BUTTON_TYPE
        ? index
        : -1
    ))
    .filter((index) => index >= 0);

  return {
    buttonLimit: getAlimtalkTemplateButtonLimit({ quickReplyCount: normalizedQuickReplies.length }),
    exceedsButtonMax: normalizedButtons.length > ALIMTALK_TEMPLATE_BUTTON_MAX_COUNT,
    exceedsButtonMaxWithQuickReplies:
      normalizedQuickReplies.length > 0
      && normalizedButtons.length > ALIMTALK_TEMPLATE_BUTTON_MAX_WITH_QUICK_REPLIES,
    exceedsQuickReplyMax: normalizedQuickReplies.length > ALIMTALK_TEMPLATE_QUICK_REPLY_MAX_COUNT,
    hasDuplicateAddChannelButton: addChannelButtonIndexes.length > 1,
    hasMisplacedAddChannelButton: addChannelButtonIndexes.some((index) => index !== 0),
  };
}
