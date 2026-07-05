import {
  appendConditionClauseJsonText,
  createCooldownPolicyJsonText,
  createRecipientMappingJsonText,
  pruneVariableMappingJsonText,
  removeConditionClauseJsonText,
  updateConditionClauseJsonText,
  updateVariableMappingJsonText,
} from './automationRulePolicyModel.js';
import { AUTOMATION_RULE_EDITOR_ACTIONS } from './ruleEditorConstants.js';

export function reduceAutomationRuleDraft(draft, action) {
  switch (action.type) {
    case AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_FIELD:
      return {
        ...draft,
        [action.field]: action.value,
      };
    case AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_SEND_FAMILY:
      return {
        ...draft,
        sendChannel: getDefaultSendChannelForFamily(action.family),
        senderResourceId: '',
        templateCode: '',
        templateSource: '',
        templateSourceKey: '',
        variableMappingJsonText: '{}',
      };
    case AUTOMATION_RULE_EDITOR_ACTIONS.RESET_SEND_ACTION:
      return {
        ...draft,
        sendChannel: '',
        senderResourceId: '',
        templateCode: '',
        templateSource: '',
        templateSourceKey: '',
        variableMappingJsonText: '{}',
      };
    case AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_EVENT_DEFINITION:
      return {
        ...draft,
        conditionJsonText: '{\n  "all": []\n}',
        cooldownPolicyJsonText: '{\n  "enabled": false\n}',
        eventDefinitionId: action.eventDefinitionId,
        recipientMappingJsonText: createRecipientMappingJsonText(),
        variableMappingJsonText: '{}',
      };
    case AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_SENDER_RESOURCE:
      return {
        ...draft,
        senderResourceId: action.senderResourceId,
      };
    case AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_SMS_CHANNEL:
      return {
        ...draft,
        sendChannel: action.sendChannel,
        templateCode: '',
        templateSource: '',
        templateSourceKey: '',
        variableMappingJsonText: '{}',
      };
    case AUTOMATION_RULE_EDITOR_ACTIONS.SELECT_TEMPLATE:
      return {
        ...draft,
        sendChannel: action.sendChannel ?? draft.sendChannel,
        templateCode: action.templateCode,
        templateSource: action.templateSource ?? '',
        templateSourceKey: action.templateSourceKey ?? '',
        variableMappingJsonText: action.templateVariableKeys
          ? pruneVariableMappingJsonText(draft.variableMappingJsonText, action.templateVariableKeys)
          : '{}',
      };
    case AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_TEMPLATE_VARIABLE_MAPPING:
      return {
        ...draft,
        variableMappingJsonText: updateVariableMappingJsonText(
          draft.variableMappingJsonText,
          action.templateKey,
          action.alias
        ),
      };
    case AUTOMATION_RULE_EDITOR_ACTIONS.ADD_CONDITION_CLAUSE:
      return {
        ...draft,
        conditionJsonText: appendConditionClauseJsonText(draft.conditionJsonText, action.alias),
      };
    case AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_CONDITION_CLAUSE:
      return {
        ...draft,
        conditionJsonText: updateConditionClauseJsonText(draft.conditionJsonText, action.index, action.patch),
      };
    case AUTOMATION_RULE_EDITOR_ACTIONS.REMOVE_CONDITION_CLAUSE:
      return {
        ...draft,
        conditionJsonText: removeConditionClauseJsonText(draft.conditionJsonText, action.index),
      };
    case AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_COOLDOWN_ENABLED:
      return {
        ...draft,
        cooldownPolicyJsonText: createCooldownPolicyJsonText({
          enabled: action.enabled,
          windowSeconds: action.windowSeconds,
        }),
      };
    case AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_COOLDOWN_WINDOW:
      return {
        ...draft,
        cooldownPolicyJsonText: createCooldownPolicyJsonText({
          enabled: true,
          windowSeconds: action.windowSeconds,
        }),
      };
    default:
      return null;
  }
}

function getDefaultSendChannelForFamily(family) {
  if (family === 'alimtalk') return 'alimtalk';
  if (family === 'brand-message') return 'brand-message';
  return 'sms';
}
