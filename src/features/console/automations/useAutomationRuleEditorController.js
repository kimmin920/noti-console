'use client';

import { useEffect, useMemo, useReducer } from 'react';
import { getRelayErrorMessage } from '../messageSend/api.js';
import { useConsoleNavigation } from '../ConsoleNavigationContext.jsx';
import {
  getPersistedSendChannel,
  getTemplateCode,
  getTemplateSelectionValue,
  getTemplateSource,
  getTemplateSourceKey,
  getTemplateVariables,
  useAutomationSendConfiguration,
} from './AutomationRuleSendConfiguration.jsx';
import { useAutomationMappingPolicy } from './AutomationRuleMappingPolicy.jsx';
import {
  useAutomationRuleCreateMutation,
  useAutomationRuleUpdateMutation,
} from './queries.js';
import {
  AUTOMATION_RULE_EDITOR_ACTIONS,
  AUTOMATION_RULE_EDITOR_CHANNELS,
  automationRuleEditorReducer,
  buildAutomationRulePayload,
  createAutomationRuleEditorState,
  createDraftFromAutomationRule,
  getAutomationRuleSendFamily,
  isAutomationRuleDraftDirty,
  validateAutomationRuleDraft,
} from './ruleEditorReducer.js';
import { AUTOMATION_TARGET_PHONE_ALIAS } from './ruleEditorConstants.js';
import { useToast } from '../../../components/ui/index.js';

const EMPTY_INLINE_ERRORS = {
  action: '',
  event: '',
  name: '',
  sender: '',
  template: '',
  variables: {},
};

export function useAutomationRuleEditorController({ editing, initialDraft, returnHref = '/automations', ruleId }) {
  const navigation = useConsoleNavigation();
  const { showToast } = useToast();
  const [state, dispatch] = useReducer(automationRuleEditorReducer, initialDraft, createAutomationRuleEditorState);
  const createMutation = useAutomationRuleCreateMutation();
  const updateMutation = useAutomationRuleUpdateMutation();
  const sendConfiguration = useAutomationSendConfiguration(state.draft);
  const mappingPolicy = useAutomationMappingPolicy(state.draft, sendConfiguration.selectedTemplate);
  const validationErrors = useMemo(
    () => [
      ...validateAutomationRuleDraft(state.draft),
      ...sendConfiguration.validationErrors,
      ...mappingPolicy.validationErrors,
    ],
    [mappingPolicy.validationErrors, sendConfiguration.validationErrors, state.draft]
  );
  const dirty = useMemo(() => isAutomationRuleDraftDirty(state.draft, initialDraft), [initialDraft, state.draft]);
  const pending = state.submitting || createMutation.isPending || updateMutation.isPending;
  const saveDisabled = pending || (editing && !dirty);
  const inlineErrors = useMemo(
    () => state.submitAttempted
      ? getAutomationRuleEditorInlineErrors({
        draft: state.draft,
        mappingPolicy,
        sendConfiguration,
      })
      : EMPTY_INLINE_ERRORS,
    [mappingPolicy, sendConfiguration, state.draft, state.submitAttempted]
  );
  const senderResourceId = state.draft.senderResourceId;

  useEffect(() => {
    if (!sendConfiguration.family || !sendConfiguration.senderResourcesQuery.isSuccess) return;
    if (sendConfiguration.senderOptions.length !== 1) return;

    const onlySender = sendConfiguration.senderOptions[0];
    const senderStillValid = sendConfiguration.senderOptions.some((option) => option.value === senderResourceId);

    if (!senderStillValid && onlySender?.value) {
      dispatch({
        senderResourceId: onlySender.value,
        type: AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_SENDER_RESOURCE,
      });
    }
  }, [
    sendConfiguration.family,
    sendConfiguration.senderOptions,
    sendConfiguration.senderResourcesQuery.isSuccess,
    senderResourceId,
  ]);

  function returnToList() {
    navigation.push(returnHref);
  }

  function changeField(field) {
    return (event) => dispatch({ field, type: AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_FIELD, value: event.target.value });
  }

  function changeSendFamilyValue(family) {
    dispatch({ family, type: AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_SEND_FAMILY });
  }

  function changeSenderResourceValue(senderResourceId) {
    dispatch({ senderResourceId, type: AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_SENDER_RESOURCE });
  }

  function changeSmsChannelValue(sendChannel) {
    dispatch({ sendChannel, type: AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_SMS_CHANNEL });
  }

  function resetSendAction() {
    dispatch({ type: AUTOMATION_RULE_EDITOR_ACTIONS.RESET_SEND_ACTION });
  }

  function selectTemplateObject(template) {
    dispatch({
      sendChannel: template ? getPersistedSendChannel(template, state.draft.sendChannel) : state.draft.sendChannel,
      templateCode: template ? getTemplateCode(template) : '',
      templateSource: template ? getTemplateSource(template) : '',
      templateSourceKey: template ? getTemplateSourceKey(template) : '',
      templateVariableKeys: template ? getTemplateVariables(template).map((variable) => variable.key) : [],
      type: AUTOMATION_RULE_EDITOR_ACTIONS.SELECT_TEMPLATE,
    });
  }

  function selectTemplate(event) {
    const template = sendConfiguration.templates.find((item) => getTemplateSelectionValue(item) === event.target.value) ?? null;

    selectTemplateObject(template);
  }

  async function saveDraft(event) {
    event.preventDefault();
    if (pending || (editing && !dirty)) return;

    if (validationErrors.length > 0) {
      dispatch({ error: '필수 항목을 확인하세요.', type: AUTOMATION_RULE_EDITOR_ACTIONS.SUBMIT_FAILED });
      showToast({ description: validationErrors[0], title: '자동화 저장 불가', variant: 'error' });
      return;
    }

    dispatch({ type: AUTOMATION_RULE_EDITOR_ACTIONS.SUBMIT_STARTED });

    try {
      const payload = buildAutomationRulePayload(state.draft);
      const result = editing
        ? await updateMutation.mutateAsync({ payload, ruleId })
        : await createMutation.mutateAsync({ payload });
      const nextRule = result?.rule;

      dispatch({ draft: createDraftFromAutomationRule(nextRule), type: AUTOMATION_RULE_EDITOR_ACTIONS.RESET });
      dispatch({ type: AUTOMATION_RULE_EDITOR_ACTIONS.SUBMIT_SUCCEEDED });
      showToast({
        description: editing ? '변경 사항을 저장했습니다.' : '비활성화 상태의 자동화 초안을 만들었습니다.',
        title: editing ? '자동화 저장' : '자동화 생성',
        variant: 'success',
      });

      if (nextRule?.id) navigation.push(`/automations/${encodeURIComponent(nextRule.id)}`);
    } catch (error) {
      const message = getRelayErrorMessage(error, '자동화 규칙을 저장하지 못했습니다.');

      dispatch({
        error: message,
        type: AUTOMATION_RULE_EDITOR_ACTIONS.SUBMIT_FAILED,
      });
      showToast({
        description: message,
        title: '자동화 저장 실패',
        variant: 'error',
      });
    }
  }

  return {
    changeCooldownEnabled: (enabled, windowSeconds) => dispatch({ enabled, type: AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_COOLDOWN_ENABLED, windowSeconds }),
    changeCooldownWindow: (windowSeconds) => dispatch({ type: AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_COOLDOWN_WINDOW, windowSeconds }),
    changeEventDefinition: (eventDefinitionId) => dispatch({ eventDefinitionId, type: AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_EVENT_DEFINITION }),
    changeField,
    changeSenderResource: (event) => changeSenderResourceValue(event.target.value),
    changeSenderResourceValue,
    changeSendFamily: changeSendFamilyValue,
    changeSendFamilyValue,
    changeSmsChannel: (event) => changeSmsChannelValue(event.target.value),
    changeSmsChannelValue,
    changeVariableMapping: (templateKey, alias) => dispatch({ alias, templateKey, type: AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_TEMPLATE_VARIABLE_MAPPING }),
    dirty,
    addCondition: (alias) => dispatch({ alias, type: AUTOMATION_RULE_EDITOR_ACTIONS.ADD_CONDITION_CLAUSE }),
    inlineErrors,
    mappingPolicy,
    removeCondition: (index) => dispatch({ index, type: AUTOMATION_RULE_EDITOR_ACTIONS.REMOVE_CONDITION_CLAUSE }),
    resetSendAction,
    returnToList,
    saveDisabled,
    saveDraft,
    selectTemplate,
    selectTemplateObject,
    sendConfiguration,
    state,
    submitError: state.submitError,
    submitAttempted: state.submitAttempted,
    updateCondition: (index, patch) => dispatch({ index, patch, type: AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_CONDITION_CLAUSE }),
    validationErrors,
  };
}

function getAutomationRuleEditorInlineErrors({ draft, mappingPolicy, sendConfiguration }) {
  const errors = {
    action: '',
    event: '',
    name: '',
    sender: '',
    template: '',
    variables: {},
  };
  const sendFamily = getAutomationRuleSendFamily(draft.sendChannel);

  if (!draft.name.trim()) errors.name = '자동화 이름을 입력하세요.';

  if (!draft.eventDefinitionId.trim()) {
    errors.event = '이벤트를 선택하세요.';
  } else if (eventNeedsPhoneAlias(mappingPolicy)) {
    errors.event = `선택한 이벤트에는 ${AUTOMATION_TARGET_PHONE_ALIAS} 전화번호 alias가 필요합니다.`;
  }

  if (draft.eventDefinitionId.trim() && !AUTOMATION_RULE_EDITOR_CHANNELS.includes(draft.sendChannel)) {
    errors.action = '메시지 액션을 선택하세요.';
  }

  if (sendFamily) {
    if (!draft.senderResourceId.trim()) {
      errors.sender = '발신 리소스를 선택하세요.';
    } else if (sendConfiguration.senderResourcesQuery.isSuccess && !sendConfiguration.selectedSender) {
      errors.sender = '선택한 발신 리소스가 현재 발송 채널과 호환되지 않습니다.';
    }

    if (!draft.templateCode.trim()) {
      errors.template = '템플릿을 선택하세요.';
    } else if (sendConfiguration.activeTemplateQuery.isSuccess && !sendConfiguration.selectedTemplate) {
      errors.template = '선택한 템플릿이 현재 발송 채널과 호환되지 않습니다.';
    }
  }

  addVariableMappingErrors(errors.variables, mappingPolicy);

  return errors;
}

function eventNeedsPhoneAlias(mappingPolicy) {
  if (!mappingPolicy.selectedEvent) return false;

  return !(mappingPolicy.phoneOptions ?? []).some((option) => option.alias === mappingPolicy.recipientAlias);
}

function addVariableMappingErrors(variableErrors, mappingPolicy) {
  const variableMapping = mappingPolicy.variableMapping ?? {};
  const aliases = new Set((mappingPolicy.variableOptions ?? []).map((option) => option.alias));

  for (const templateKey of mappingPolicy.requiredTemplateVariables ?? []) {
    if (!variableMapping[templateKey]) {
      variableErrors[templateKey] = '필수 템플릿 변수에 이벤트 alias를 매핑하세요.';
    }
  }

  for (const [templateKey, alias] of Object.entries(variableMapping)) {
    if (alias && !aliases.has(alias)) {
      variableErrors[templateKey] = '현재 이벤트에 없는 alias입니다.';
    }
  }
}
