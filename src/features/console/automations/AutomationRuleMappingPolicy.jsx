'use client';

import { useMemo } from 'react';

import {
  Badge,
  Button,
  SectionPanel,
} from '../../../components/ui/index.js';
import { usePublEventsQuery } from '../publEvents/queries.js';
import { AUTOMATION_RULE_EDITOR_SECTION_IDS } from './automationRuleEditorSectionIds.js';
import {
  buildAutomationMappingPolicy,
} from './automationRuleMappingSelectors.js';

export function useAutomationMappingPolicy(draft, selectedTemplate) {
  const eventCatalogQuery = usePublEventsQuery();
  const policy = useMemo(
    () => buildAutomationMappingPolicy({
      catalogData: eventCatalogQuery.data,
      draft,
      selectedTemplate,
    }),
    [draft, eventCatalogQuery.data, selectedTemplate]
  );

  return { ...policy, eventCatalogQuery };
}

export function AutomationEventDefinitionSelect({ draft, onChange, policy }) {
  const { eventCatalogQuery, events } = policy;

  return (
    <>
      <label className="automation-rule-editor-field">
        <span>이벤트 정의</span>
        <select
          className="automation-rule-editor-select"
          disabled={eventCatalogQuery.isLoading || eventCatalogQuery.isError}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          required
          value={draft.eventDefinitionId}
        >
          <option value="">이벤트 선택</option>
          {events.map((item) => (
            <option key={item.id} value={item.id}>{item.displayName || item.eventKey || item.id}</option>
          ))}
          {draft.eventDefinitionId && !events.some((item) => item.id === draft.eventDefinitionId) ? (
            <option value={draft.eventDefinitionId}>{draft.eventDefinitionId}</option>
          ) : null}
        </select>
      </label>
      <AutomationCatalogState query={eventCatalogQuery} />
    </>
  );
}

export function AutomationMappingPolicySections({
  onVariableMappingChange,
  policy,
}) {
  return <TemplateVariableMappingSection onVariableMappingChange={onVariableMappingChange} policy={policy} />;
}

function TemplateVariableMappingSection({ onVariableMappingChange, policy }) {
  const { optionalTemplateVariables, requiredTemplateVariables, variableMapping, variableOptions } = policy;

  return (
    <SectionPanel
      bodyClassName="automation-rule-editor-fields"
      description="템플릿 변수에는 이벤트 alias 참조만 저장합니다."
      id={AUTOMATION_RULE_EDITOR_SECTION_IDS.variables}
      title="Variable mapping"
    >
      <VariableMappingGroup
        emptyMessage="필수 템플릿 변수가 없습니다."
        keys={requiredTemplateVariables}
        onVariableMappingChange={onVariableMappingChange}
        required
        title="Required variables"
        variableMapping={variableMapping}
        variableOptions={variableOptions}
      />
      <VariableMappingGroup
        emptyMessage="선택 템플릿 변수가 없습니다."
        keys={optionalTemplateVariables}
        onVariableMappingChange={onVariableMappingChange}
        title="Optional variables"
        variableMapping={variableMapping}
        variableOptions={variableOptions}
      />
    </SectionPanel>
  );
}

function VariableMappingGroup({ emptyMessage, keys, onVariableMappingChange, required = false, title, variableMapping, variableOptions }) {
  return (
    <div className="automation-variable-mapping-group">
      <div className="automation-policy-subheading">
        <span>{title}</span>
        <Badge tone={required ? 'critical' : 'neutral'}>{keys.length.toLocaleString('ko-KR')}</Badge>
      </div>
      {keys.length === 0 ? <p className="automation-policy-state">{emptyMessage}</p> : null}
      {keys.map((templateKey) => (
        <div className="automation-variable-mapping-row" key={templateKey}>
          <code translate="no">{templateKey}</code>
          <select
            className="automation-rule-editor-select"
            onChange={(event) => onVariableMappingChange(templateKey, event.target.value)}
            value={variableMapping[templateKey] ?? ''}
          >
            <option value="">이벤트 alias 선택</option>
            {variableOptions.map((option) => <VariableOption key={option.alias} option={option} />)}
          </select>
        </div>
      ))}
    </div>
  );
}

function VariableOption({ option }) {
  return <option value={option.alias}>{option.label ? `${option.label} (${option.alias})` : option.alias}</option>;
}

function AutomationCatalogState({ query }) {
  if (query.isLoading) return <p className="automation-policy-state">이벤트 catalog를 불러오는 중입니다.</p>;
  if (!query.isError) return null;

  return (
    <div className="automation-policy-state is-error" role="alert">
      <span>이벤트 catalog를 불러오지 못했습니다.</span>
      <Button onClick={() => query.refetch()} variant="secondary">다시 시도</Button>
    </div>
  );
}
