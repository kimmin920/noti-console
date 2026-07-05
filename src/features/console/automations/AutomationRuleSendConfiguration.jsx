'use client';

import { useMemo } from 'react';

import {
  AlimtalkPreview,
  Button,
  NhnBrandMessagePreview,
  SegmentedControl,
  SmsPreview,
} from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import {
  getAutomationKakaoSenderProfiles,
  getKakaoTemplateLookupScopes,
  getSmsSenderOptions,
  getSmsTemplateLookupScopes,
  getTemplateOptions,
} from '../messageSend/mappers.js';
import {
  useAlimtalkTemplatesQueries,
  useBrandTemplatesQueries,
  useSenderResourcesQuery,
  useSmsTemplatesQueries,
} from '../messageSend/queries.js';
import {
  getPersistedSendChannelForTemplate,
  getTemplateCode,
  getTemplateDisplayChannel,
  getTemplateName,
  getTemplateOptionKey,
  getTemplateRequiredVariables,
  getTemplateSelectionValue,
  getTemplateSource,
  getTemplateSourceKey,
  getTemplateVariables,
} from './automationTemplateMetadata.js';
import {
  AUTOMATION_RULE_EDITOR_CHANNELS,
  getAutomationRuleSendFamily,
} from './ruleEditorReducer.js';

const SEND_FAMILY_ITEMS = [
  { label: '문자', value: 'sms' },
  { label: '알림톡', value: 'alimtalk' },
  { label: '브랜드 메시지', value: 'brand-message' },
];

const SMS_CHANNEL_ITEMS = [
  { label: 'SMS', value: 'sms' },
  { label: 'LMS', value: 'lms' },
  { label: 'MMS', value: 'mms' },
];
const ALL_TEMPLATE_SCOPE_VALUE = 'all';
const COMMON_TEMPLATE_SCOPE_VALUE = 'common';
const EMPTY_TEMPLATE_QUERIES = [];

export {
  getPersistedSendChannelForTemplate,
  getTemplateCode,
  getTemplateSelectionValue,
  getTemplateSource,
  getTemplateSourceKey,
  getTemplateVariables,
};

export function AutomationSendConfigurationSection({
  configuration,
  draft,
  onSenderResourceChange,
  onSendFamilyChange,
  onSmsChannelChange,
  onTemplateChange,
}) {
  const {
    activeTemplateQuery,
    family,
    selectedSender,
    selectedTemplate,
    senderOptions,
    senderResourcesQuery,
    templates,
  } = configuration;
  const senderSelectDisabled = !family || senderResourcesQuery.isLoading || senderResourcesQuery.isError;
  const templateSelectDisabled = !family || !selectedSender || activeTemplateQuery.isLoading || activeTemplateQuery.isError;

  return (
    <>
      <div className="automation-send-config-family">
        <SegmentedControl items={SEND_FAMILY_ITEMS} onValueChange={onSendFamilyChange} value={family} />
      </div>

      {family === 'sms' ? (
        <label className="automation-rule-editor-field">
          <span>문자 유형</span>
          <select className="automation-rule-editor-select" onChange={onSmsChannelChange} value={draft.sendChannel}>
            {SMS_CHANNEL_ITEMS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="automation-rule-editor-field">
        <span>발신 리소스</span>
        <select
          className="automation-rule-editor-select"
          disabled={senderSelectDisabled}
          onChange={onSenderResourceChange}
          value={draft.senderResourceId}
        >
          <option value="">{family ? '발신 리소스 선택' : '발송 채널 선택 후 발신 리소스 선택'}</option>
          {senderOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <AutomationResourceQueryState family={family} query={senderResourcesQuery} senderOptions={senderOptions} />

      <label className="automation-rule-editor-field">
        <span>템플릿</span>
        <select
          className="automation-rule-editor-select"
          disabled={templateSelectDisabled}
          onChange={onTemplateChange}
          value={selectedTemplate ? getTemplateSelectionValue(selectedTemplate) : ''}
        >
          <option value="">템플릿 선택</option>
          {templates.map((template) => (
            <option key={getTemplateOptionKey(template)} value={getTemplateSelectionValue(template)}>
              {getTemplateName(template)}
            </option>
          ))}
        </select>
      </label>

      <AutomationTemplateQueryState family={family} query={activeTemplateQuery} selectedSender={selectedSender} templates={templates} />

      {selectedTemplate ? (
        <div className="automation-send-config-preview-grid">
          <AutomationTemplateSummary template={selectedTemplate} />
          <AutomationTemplatePreview
            family={family}
            selectedSender={selectedSender}
            selectedTemplate={selectedTemplate}
            senderOptions={senderOptions}
            templates={templates}
          />
        </div>
      ) : null}
    </>
  );
}

export function useAutomationSendConfiguration(draft) {
  const family = getAutomationRuleSendFamily(draft.sendChannel);
  const senderResourcesQuery = useSenderResourcesQuery();
  const smsSenderOptions = useMemo(() => getSmsSenderOptions(senderResourcesQuery.data), [senderResourcesQuery.data]);
  const kakaoSenderOptions = useMemo(() => getAutomationKakaoSenderProfiles(senderResourcesQuery.data), [senderResourcesQuery.data]);
  const senderOptions = family === 'sms'
    ? smsSenderOptions
    : family === 'alimtalk' || family === 'brand-message'
      ? kakaoSenderOptions
      : [];
  const selectedSender = senderOptions.find((option) => option.value === draft.senderResourceId) ?? null;
  const templateScopes = useMemo(
    () => getAutomationTemplateScopes(family, senderResourcesQuery.data),
    [family, senderResourcesQuery.data]
  );
  const templateLookupEntries = useMemo(() => getTemplateLookupEntries(templateScopes), [templateScopes]);
  const templateLookupSenderResourceIds = useMemo(
    () => templateLookupEntries.map((entry) => entry.senderResourceId),
    [templateLookupEntries]
  );
  const smsTemplateQueries = useSmsTemplatesQueries(family === 'sms' ? templateLookupSenderResourceIds : []);
  const alimtalkTemplateQueries = useAlimtalkTemplatesQueries(family === 'alimtalk' ? templateLookupSenderResourceIds : []);
  const brandTemplateQueries = useBrandTemplatesQueries(family === 'brand-message' ? templateLookupSenderResourceIds : []);
  const idleTemplateQuery = useMemo(() => ({
    error: null,
    isError: false,
    isLoading: false,
    isSuccess: false,
    refetch: () => {},
  }), []);
  const activeTemplateQueries = useMemo(() => {
    if (family === 'sms') return smsTemplateQueries;
    if (family === 'brand-message') return brandTemplateQueries;
    if (family === 'alimtalk') return alimtalkTemplateQueries;

    return EMPTY_TEMPLATE_QUERIES;
  }, [alimtalkTemplateQueries, brandTemplateQueries, family, smsTemplateQueries]);
  const activeTemplateQuery = family === 'sms'
    ? combineTemplateQueries(smsTemplateQueries, idleTemplateQuery)
    : family === 'brand-message'
      ? combineTemplateQueries(brandTemplateQueries, idleTemplateQuery)
      : family === 'alimtalk'
        ? combineTemplateQueries(alimtalkTemplateQueries, idleTemplateQuery)
        : idleTemplateQuery;
  const templates = useMemo(
    () => getCombinedTemplateOptions(activeTemplateQueries, templateLookupEntries, family),
    [activeTemplateQueries, family, templateLookupEntries]
  );
  const selectedTemplate = useMemo(
    () => templates.find((template) => (
      getTemplateCode(template) === draft.templateCode &&
      (!draft.templateSource || getTemplateSource(template) === draft.templateSource) &&
      (!draft.templateSourceKey || getTemplateSourceKey(template) === draft.templateSourceKey)
    )) ?? null,
    [draft.templateCode, draft.templateSource, draft.templateSourceKey, templates]
  );
  const validationErrors = useMemo(() => {
    const errors = [];

    if (senderResourcesQuery.isSuccess && draft.senderResourceId && !selectedSender) {
      errors.push('선택한 발신 리소스가 현재 발송 채널과 호환되지 않습니다.');
    }

    if (activeTemplateQuery.isSuccess && draft.templateCode && !selectedTemplate) {
      errors.push('선택한 템플릿이 현재 발송 채널과 호환되지 않습니다.');
    }

    return errors;
  }, [activeTemplateQuery.isSuccess, draft.senderResourceId, draft.templateCode, selectedSender, selectedTemplate, senderResourcesQuery.isSuccess]);

  return {
    activeTemplateQuery,
    family,
    selectedSender,
    selectedTemplate,
    senderOptions,
    senderResourcesQuery,
    templateScopes,
    templates,
    validationErrors,
  };
}

export function getPersistedSendChannel(template, fallbackSendChannel) {
  return getPersistedSendChannelForTemplate(template, fallbackSendChannel, AUTOMATION_RULE_EDITOR_CHANNELS);
}

function AutomationResourceQueryState({ family, query, senderOptions }) {
  if (!family) return <p className="automation-send-config-state">발송 채널을 먼저 선택하세요.</p>;
  if (query.isLoading) return <p className="automation-send-config-state">발신 리소스를 불러오는 중입니다.</p>;
  if (query.isSuccess && senderOptions.length === 0) return <p className="automation-send-config-state">호환되는 발신 리소스가 없습니다.</p>;
  if (!query.isError) return null;

  return (
    <div className="automation-send-config-state is-error" role="alert">
      <span>{getRelayErrorMessage(query.error, '발신 리소스를 불러오지 못했습니다.')}</span>
      <Button onClick={() => query.refetch()} variant="secondary">다시 시도</Button>
    </div>
  );
}

function AutomationTemplateQueryState({ family, query, selectedSender, templates }) {
  if (!family) return null;
  if (!selectedSender) return <p className="automation-send-config-state">발신 리소스를 선택하면 템플릿을 불러옵니다.</p>;
  if (query.isLoading) return <p className="automation-send-config-state">템플릿을 불러오는 중입니다.</p>;
  if (query.isSuccess && templates.length === 0) return <p className="automation-send-config-state">선택 가능한 템플릿이 없습니다.</p>;
  if (!query.isError) return null;

  return (
    <div className="automation-send-config-state is-error" role="alert">
      <span>{getRelayErrorMessage(query.error, '템플릿을 불러오지 못했습니다.')}</span>
      <Button onClick={() => query.refetch()} variant="secondary">다시 시도</Button>
    </div>
  );
}

function AutomationTemplateSummary({ template }) {
  const requiredVariables = getTemplateRequiredVariables(template);
  const variables = getTemplateVariables(template);

  return (
    <div className="automation-template-summary">
      <div><span>템플릿 코드</span><strong translate="no">{getTemplateCode(template)}</strong></div>
      <div><span>필수 변수</span><strong>{requiredVariables.length.toLocaleString('ko-KR')}개</strong></div>
      {variables.length ? (
        <div className="automation-template-variable-list">
          {variables.map((variable) => (
            <span key={variable.key} translate="no">{variable.key}{variable.required ? ' *' : ''}</span>
          ))}
        </div>
      ) : <p>템플릿 변수가 없습니다.</p>}
    </div>
  );
}

function AutomationTemplatePreview({ family, selectedSender, selectedTemplate, senderOptions, templates }) {
  if (family === 'sms') {
    return <SmsPreview className="automation-template-preview" senderNumbers={senderOptions} value={{ body: selectedTemplate.body ?? selectedTemplate.content ?? '', senderNumber: selectedSender?.value ?? '' }} />;
  }

  if (family === 'brand-message') {
    return <NhnBrandMessagePreview className="automation-template-preview" senderProfiles={senderOptions} templates={templates} value={{ mode: 'template', senderProfileId: selectedSender?.value ?? '', templateCode: getTemplateCode(selectedTemplate) }} />;
  }

  return <AlimtalkPreview className="automation-template-preview" senderProfiles={senderOptions} templates={templates} value={{ senderProfileId: selectedSender?.value ?? '', templateId: selectedTemplate.value ?? selectedTemplate.id ?? '' }} />;
}

function getAutomationTemplateScopes(family, senderResourcesData) {
  const scopes = family === 'sms'
    ? getSmsTemplateLookupScopes(senderResourcesData)
    : family === 'alimtalk' || family === 'brand-message'
      ? getKakaoTemplateLookupScopes(senderResourcesData)
      : [];
  const leafScopes = scopes.map((scope) => ({
    ...scope,
    senderResourceIds: [...new Set(scope.senderResourceIds ?? [])],
  })).filter((scope) => scope.senderResourceIds.length > 0);
  const allSenderResourceIds = [...new Set(leafScopes.flatMap((scope) => scope.senderResourceIds))];

  if (allSenderResourceIds.length > 1) {
    return [
      {
        label: '모두',
        senderResourceIds: allSenderResourceIds,
        type: 'all',
        value: ALL_TEMPLATE_SCOPE_VALUE,
      },
      ...leafScopes,
    ];
  }

  return leafScopes;
}

function getTemplateLookupEntries(templateScopes) {
  return templateScopes
    .filter((scope) => scope.value !== ALL_TEMPLATE_SCOPE_VALUE)
    .flatMap((scope) => scope.senderResourceIds.map((senderResourceId) => ({
      scope,
      senderResourceId,
    })));
}

function combineTemplateQueries(queries, idleTemplateQuery) {
  if (!queries.length) return idleTemplateQuery;

  return {
    error: queries.find((query) => query.isError)?.error ?? null,
    isError: queries.some((query) => query.isError),
    isLoading: queries.some((query) => query.isLoading),
    isSuccess: queries.every((query) => query.isSuccess),
    refetch: () => Promise.all(queries.map((query) => query.refetch())),
  };
}

function getCombinedTemplateOptions(templateQueries, lookupEntries, family) {
  const templatesByKey = new Map();

  templateQueries.forEach((query, index) => {
    const entry = lookupEntries[index];

    for (const template of getTemplateOptions(query.data)) {
      const key = getTemplateSelectionValue(template);
      const scopeKey = getTemplateScopeKey(template, entry?.scope, family);
      const existing = templatesByKey.get(key);

      if (existing) {
        const scopeKeys = new Set(existing.__automationTemplateScopeKeys);
        scopeKeys.add(scopeKey);
        templatesByKey.set(key, {
          ...existing,
          __automationTemplateScopeKeys: [...scopeKeys],
        });
        continue;
      }

      templatesByKey.set(key, {
        ...template,
        __automationTemplateLookupSenderResourceId: entry?.senderResourceId ?? '',
        __automationTemplateScopeKeys: [scopeKey],
      });
    }
  });

  return [...templatesByKey.values()];
}

function getTemplateScopeKey(template, scope, family) {
  if (scope?.type === 'common' || (family !== 'sms' && isCommonTemplate(template))) {
    return COMMON_TEMPLATE_SCOPE_VALUE;
  }

  return scope?.value ?? '';
}

function isCommonTemplate(template) {
  return String(template?.source ?? '').toUpperCase() === 'GROUP'
    || !String(template?.ownerKey ?? '').trim();
}
