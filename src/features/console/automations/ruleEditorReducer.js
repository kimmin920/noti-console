import {
  createRecipientMappingJsonText,
  formatDraftJson,
  validateStructuredPolicyJson,
} from './automationRulePolicyModel.js';
import {
  AUTOMATION_RULE_EDITOR_ACTIONS,
  AUTOMATION_RULE_EDITOR_CHANNELS,
  DEFAULT_AUTOMATION_RULE_DRAFT,
} from './ruleEditorConstants.js';
import { reduceAutomationRuleDraft } from './ruleEditorDraftReducer.js';

export {
  AUTOMATION_RULE_EDITOR_ACTIONS,
  AUTOMATION_RULE_EDITOR_CHANNELS,
  DEFAULT_AUTOMATION_RULE_DRAFT,
} from './ruleEditorConstants.js';

export function automationRuleEditorReducer(state, action) {
  const nextDraft = reduceAutomationRuleDraft(state.draft, action);

  if (nextDraft) {
    return {
      ...state,
      draft: nextDraft,
      submitError: null,
    };
  }

  switch (action.type) {
    case AUTOMATION_RULE_EDITOR_ACTIONS.RESET:
      return {
        ...state,
        draft: action.draft,
        submitError: null,
        submitAttempted: false,
        submitting: false,
      };
    case AUTOMATION_RULE_EDITOR_ACTIONS.SUBMIT_STARTED:
      return {
        ...state,
        submitError: null,
        submitAttempted: true,
        submitting: true,
      };
    case AUTOMATION_RULE_EDITOR_ACTIONS.SUBMIT_SUCCEEDED:
      return {
        ...state,
        submitError: null,
        submitAttempted: false,
        submitting: false,
      };
    case AUTOMATION_RULE_EDITOR_ACTIONS.SUBMIT_FAILED:
      return {
        ...state,
        submitError: action.error,
        submitAttempted: true,
        submitting: false,
      };
    default:
      return state;
  }
}

export function createAutomationRuleEditorState(initialDraft = DEFAULT_AUTOMATION_RULE_DRAFT) {
  return {
    draft: normalizeAutomationRuleDraft(initialDraft),
    submitAttempted: false,
    submitError: null,
    submitting: false,
  };
}

export function normalizeAutomationRuleDraft(draft = {}) {
  return {
    ...DEFAULT_AUTOMATION_RULE_DRAFT,
    ...draft,
    recipientMappingJsonText: createRecipientMappingJsonText(),
  };
}

export function getAutomationRuleSendFamily(sendChannel) {
  if (sendChannel === 'alimtalk' || sendChannel === 'brand-message') return sendChannel;
  if (sendChannel === 'sms' || sendChannel === 'lms' || sendChannel === 'mms') return 'sms';
  return '';
}

export function createDraftFromAutomationRule(rule) {
  if (!rule) return DEFAULT_AUTOMATION_RULE_DRAFT;

  return normalizeAutomationRuleDraft({
    conditionJsonText: formatDraftJson(rule.conditionJson),
    cooldownPolicyJsonText: formatDraftJson(rule.cooldownPolicyJson ?? { enabled: false }),
    eventDefinitionId: rule.eventDefinitionId,
    name: rule.name,
    recipientMappingJsonText: formatDraftJson(rule.recipientMappingJson),
    sendChannel: rule.sendChannel,
    senderResourceId: rule.senderResourceId,
    templateCode: rule.templateCode,
    templateSource: rule.templateSource,
    templateSourceKey: rule.templateSourceKey,
    variableMappingJsonText: formatDraftJson(rule.variableMappingJson),
  });
}

export function buildAutomationRulePayload(draft) {
  const normalizedDraft = normalizeAutomationRuleDraft(draft);

  return {
    condition: parseDraftJson(normalizedDraft.conditionJsonText, '조건 JSON'),
    cooldownPolicy: parseDraftJson(normalizedDraft.cooldownPolicyJsonText, '쿨다운 JSON'),
    eventDefinitionId: normalizedDraft.eventDefinitionId.trim(),
    name: normalizedDraft.name.trim(),
    recipientMapping: parseDraftJson(normalizedDraft.recipientMappingJsonText, '수신자 매핑 JSON'),
    sendChannel: normalizedDraft.sendChannel,
    senderResourceId: normalizedDraft.senderResourceId.trim(),
    templateCode: normalizedDraft.templateCode.trim(),
    templateSource: emptyToNull(normalizedDraft.templateSource),
    templateSourceKey: emptyToNull(normalizedDraft.templateSourceKey),
    variableMapping: parseDraftJson(normalizedDraft.variableMappingJsonText, '변수 매핑 JSON'),
  };
}

export function validateAutomationRuleDraft(draft) {
  const errors = [];
  const normalizedDraft = normalizeAutomationRuleDraft(draft);

  if (!normalizedDraft.name.trim()) errors.push('자동화 이름을 입력하세요.');
  if (!normalizedDraft.eventDefinitionId.trim()) errors.push('트리거 이벤트 ID를 입력하세요.');
  if (!AUTOMATION_RULE_EDITOR_CHANNELS.includes(normalizedDraft.sendChannel)) {
    errors.push('발송 채널을 선택하세요.');
  }
  if (!normalizedDraft.senderResourceId.trim()) errors.push('발신 리소스 ID를 입력하세요.');
  if (!normalizedDraft.templateCode.trim()) errors.push('템플릿 코드를 입력하세요.');

  validateJsonText(normalizedDraft.recipientMappingJsonText, '수신자 매핑 JSON', errors);
  validateJsonText(normalizedDraft.variableMappingJsonText, '변수 매핑 JSON', errors);
  validateJsonText(normalizedDraft.conditionJsonText, '조건 JSON', errors);
  validateJsonText(normalizedDraft.cooldownPolicyJsonText, '쿨다운 JSON', errors);
  validateStructuredPolicyJson(normalizedDraft, errors);

  return errors;
}

export function isAutomationRuleDraftDirty(draft, initialDraft) {
  return stableDraftString(normalizeAutomationRuleDraft(draft)) !== stableDraftString(normalizeAutomationRuleDraft(initialDraft));
}

function validateJsonText(text, label, errors) {
  try {
    parseDraftJson(text, label);
  } catch (error) {
    errors.push(error.message);
  }
}

function parseDraftJson(text, label) {
  try {
    const value = JSON.parse(text || '{}');

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${label}은 객체여야 합니다.`);
    }

    return value;
  } catch (error) {
    if (error.message.endsWith('객체여야 합니다.')) {
      throw error;
    }

    throw new Error(`${label} 형식이 올바르지 않습니다.`);
  }
}

function emptyToNull(value) {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function stableDraftString(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}
