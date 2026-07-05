import {
  getConditionClausesFromDraft,
  getCooldownPolicyFromDraft,
  getRecipientAliasFromDraft,
  getVariableMappingFromDraft,
} from './automationRulePolicyModel.js';
import {
  getTemplateOptionalVariables,
  getTemplateRequiredVariables,
} from './automationTemplateMetadata.js';
import { AUTOMATION_TARGET_PHONE_ALIAS } from './ruleEditorConstants.js';

export function getCatalogEvents(catalogData) {
  return Array.isArray(catalogData?.events) ? catalogData.events : [];
}

export function getSelectedCatalogEvent(catalogData, eventDefinitionId) {
  return getCatalogEvents(catalogData).find((event) => event.id === eventDefinitionId) ?? null;
}

export function getEventVariableOptions(event) {
  const options = Array.isArray(event?.variableOptions)
    ? event.variableOptions
    : Array.isArray(event?.variablePreview)
      ? event.variablePreview
      : [];

  return options
    .map((option) => ({
      alias: String(option?.alias ?? '').trim(),
      label: String(option?.label ?? option?.alias ?? '').trim(),
      required: option?.required === true,
      type: String(option?.type ?? 'text').trim() || 'text',
    }))
    .filter((option) => option.alias);
}

export function getTargetPhoneOptions(options) {
  return options.filter((option) => option.alias === AUTOMATION_TARGET_PHONE_ALIAS);
}

export function getDefaultRecipientAlias(options) {
  return options.find((option) => option.alias === AUTOMATION_TARGET_PHONE_ALIAS)?.alias
    ?? AUTOMATION_TARGET_PHONE_ALIAS;
}

export function buildAutomationMappingPolicy({ catalogData, draft, selectedTemplate }) {
  const events = getCatalogEvents(catalogData);
  const selectedEvent = getSelectedCatalogEvent(catalogData, draft.eventDefinitionId);
  const variableOptions = getEventVariableOptions(selectedEvent);
  const phoneOptions = getTargetPhoneOptions(variableOptions);
  const recipientAlias = getRecipientAliasFromDraft(draft);
  const variableMapping = getVariableMappingFromDraft(draft);
  const requiredTemplateVariables = getTemplateRequiredVariables(selectedTemplate);
  const optionalTemplateVariables = getTemplateOptionalVariables(selectedTemplate);
  const conditionClauses = getConditionClausesFromDraft(draft);
  const cooldownPolicy = getCooldownPolicyFromDraft(draft);

  return {
    conditionClauses,
    cooldownPolicy,
    events,
    optionalTemplateVariables,
    phoneOptions,
    recipientAlias,
    requiredTemplateVariables,
    selectedEvent,
    validationErrors: validateAutomationMappingPolicy({
      conditionClauses,
      cooldownPolicy,
      phoneOptions,
      recipientAlias,
      requiredTemplateVariables,
      selectedEvent,
      variableMapping,
      variableOptions,
    }),
    variableMapping,
    variableOptions,
  };
}

function validateAutomationMappingPolicy({
  conditionClauses,
  cooldownPolicy,
  phoneOptions,
  recipientAlias,
  requiredTemplateVariables,
  selectedEvent,
  variableMapping,
  variableOptions,
}) {
  const errors = [];
  const aliases = new Set(variableOptions.map((option) => option.alias));
  const targetPhoneAliases = new Set(phoneOptions.map((option) => option.alias));

  if (selectedEvent && (!recipientAlias || !targetPhoneAliases.has(recipientAlias))) {
    errors.push(`선택한 이벤트에는 ${AUTOMATION_TARGET_PHONE_ALIAS} 전화번호 alias가 필요합니다.`);
  }

  for (const templateKey of requiredTemplateVariables) {
    if (!variableMapping[templateKey]) {
      errors.push(`필수 템플릿 변수 ${templateKey}에 이벤트 alias를 매핑하세요.`);
    }
  }

  for (const [templateKey, alias] of Object.entries(variableMapping)) {
    if (alias && !aliases.has(alias)) {
      errors.push(`템플릿 변수 ${templateKey}가 현재 이벤트에 없는 alias를 참조합니다.`);
    }
  }

  for (const clause of conditionClauses) {
    if (clause.alias && !aliases.has(clause.alias)) {
      errors.push(`조건 alias ${clause.alias}는 현재 이벤트에서 사용할 수 없습니다.`);
    }
  }

  if (cooldownPolicy.enabled && (!recipientAlias || !targetPhoneAliases.has(recipientAlias))) {
    errors.push('쿨다운은 해시 가능한 수신자 alias가 필요합니다.');
  }

  return [...new Set(errors)];
}
