'use client';

import { SendHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  AlimtalkTemplateDialogCard,
  BrandMessageTemplateDialogCard,
  Button,
  EmailSendFormTemplateDialog,
  getAlimtalkTemplateDialogItems,
  getBrandTemplateDialogItems,
  getSmsTemplateDialogItems,
} from '../../../../components/ui/index.js';
import { AutomationMessageSettingsForm } from './AutomationMessageSettingsForm.jsx';
import { AutomationSendMessageNodeActionsMenu } from './AutomationSendMessageNodeActionsMenu.jsx';
import { AutomationTemplatePreviewPanel } from './AutomationTemplatePreviewPanel.jsx';
import { cx } from './shared.js';
import { getRelayErrorMessage } from '../../messageSend/api.js';

const ALL_TEMPLATE_SCOPE_VALUE = 'all';
const EMPTY_TEMPLATE_SCOPES = [];
const EMPTY_TEMPLATES = [];

export function AutomationSendMessageNode({
  actionsLabel = 'Node actions',
  className = '',
  configuration,
  draft,
  family,
  isLoadingTemplateDetails = false,
  mappingPolicy,
  onChangeSendAction,
  onSenderResourceChange,
  onSmsChannelChange,
  onTemplateSelect,
  onTemplateDialogOpenChange,
  onVariableMappingChange,
  stepIcon: StepIcon = SendHorizontal,
  templateDialogOpen,
  templateSearchPlaceholder = '템플릿 검색...',
  title = '메시지 보내기',
  validation = {},
  ...props
}) {
  const [internalTemplateDialogOpen, setInternalTemplateDialogOpen] = useState(false);
  const [templateScopeValue, setTemplateScopeValue] = useState(ALL_TEMPLATE_SCOPE_VALUE);
  const isTemplateDialogControlled = templateDialogOpen !== undefined;
  const isTemplateDialogOpen = isTemplateDialogControlled ? templateDialogOpen : internalTemplateDialogOpen;
  const selectedTemplate = configuration?.selectedTemplate ?? null;
  const templates = configuration?.templates ?? EMPTY_TEMPLATES;
  const templateScopes = configuration?.templateScopes ?? EMPTY_TEMPLATE_SCOPES;
  const activeTemplateQuery = configuration?.activeTemplateQuery;
  const effectiveTemplateScopeValue = getEffectiveTemplateScopeValue(templateScopeValue, templateScopes);
  const filteredTemplates = useMemo(
    () => filterTemplatesByScope(templates, effectiveTemplateScopeValue),
    [effectiveTemplateScopeValue, templates]
  );
  const dialogTemplates = useMemo(
    () => getDialogTemplates(family, filteredTemplates),
    [family, filteredTemplates]
  );
  const renderTemplateCard = getDialogTemplateCardRenderer(family);
  const loadingTemplates = Boolean(configuration?.activeTemplateQuery?.isLoading);
  const templateError = validation?.template ?? '';

  function handleTemplateSelect(template) {
    setTemplateDialogOpen(false);
    onTemplateSelect?.(template ?? null);
  }

  function openTemplateDialog() {
    setTemplateDialogOpen(true);
  }

  function setTemplateDialogOpen(nextOpen) {
    if (!isTemplateDialogControlled) {
      setInternalTemplateDialogOpen(nextOpen);
    }

    onTemplateDialogOpenChange?.(nextOpen);
  }

  return (
    <article
      aria-label={title}
      className={cx('resend-ui-domain-automation-send-email-node', className)}
      data-resend-domain-automation-send-email-node
      data-resend-domain-automation-send-message-node
      {...props}
    >
      <header className="resend-ui-domain-automation-send-email-node__header">
        <span className="resend-ui-domain-automation-send-email-node__step-icon" aria-hidden="true">
          <StepIcon size={14} />
        </span>
        <span className="resend-ui-domain-automation-send-email-node__title">{title}</span>
        <AutomationSendMessageNodeActionsMenu
          actionsLabel={actionsLabel}
          onChangeSendAction={onChangeSendAction}
          onChangeTemplate={openTemplateDialog}
        />
      </header>
      <div className="resend-ui-domain-automation-send-email-node__body">
        <AutomationTemplateSelectionDialog
          activeTemplateQuery={activeTemplateQuery}
          family={family}
          loadingTemplates={loadingTemplates}
          onOpenChange={setTemplateDialogOpen}
          onTemplateScopeChange={setTemplateScopeValue}
          onTemplateSelect={handleTemplateSelect}
          open={isTemplateDialogOpen}
          renderTemplateCard={renderTemplateCard}
          searchPlaceholder={templateSearchPlaceholder}
          selectedScopeValue={effectiveTemplateScopeValue}
          templateScopes={templateScopes}
          templates={dialogTemplates}
        />
        {!selectedTemplate ? (
          <AutomationMessageTemplateSelection
            loadingTemplates={loadingTemplates}
            onOpenTemplateDialog={openTemplateDialog}
            templateError={templateError}
          />
        ) : (
          <div
            className="resend-ui-domain-automation-send-email-node__details"
            data-resend-domain-automation-send-email-node-details
          >
            <div className="automation-message-node-compose">
              <div className="automation-message-node-settings-column">
                <AutomationMessageSettingsForm
                  configuration={configuration}
                  draft={draft}
                  family={family}
                  isLoadingTemplateDetails={isLoadingTemplateDetails}
                  mappingPolicy={mappingPolicy}
                  onSenderResourceChange={onSenderResourceChange}
                  onSmsChannelChange={onSmsChannelChange}
                  onVariableMappingChange={onVariableMappingChange}
                  validation={validation}
                />
              </div>
              <div className="automation-message-node-preview-column">
                <AutomationTemplatePreviewPanel
                  configuration={configuration}
                  draft={draft}
                  family={family}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function AutomationMessageTemplateSelection({
  loadingTemplates,
  onOpenTemplateDialog,
  templateError,
}) {
  return (
    <div className="automation-message-node-template-selection">
      <div className="resend-ui-domain-automation-send-email-node__empty">
        <p>{loadingTemplates ? '템플릿을 불러오는 중입니다' : '템플릿을 선택하세요'}</p>
        <span>공통 또는 내 템플릿을 선택한 뒤 왼쪽 설정에서 발신 리소스를 설정합니다.</span>
        <Button disabled={loadingTemplates} onClick={onOpenTemplateDialog} type="button" variant="secondary">
          템플릿 선택
        </Button>
        {templateError ? (
          <p className="automation-message-node-state is-error" role="alert">
            {templateError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AutomationTemplateSelectionDialog({
  activeTemplateQuery,
  family,
  loadingTemplates,
  onOpenChange,
  onTemplateScopeChange,
  onTemplateSelect,
  open,
  renderTemplateCard,
  searchPlaceholder,
  selectedScopeValue,
  templateScopes,
  templates,
}) {
  return (
    <EmailSendFormTemplateDialog
      beforePicker={(
        <AutomationTemplateScopeFilter
          activeTemplateQuery={activeTemplateQuery}
          loadingTemplates={loadingTemplates}
          onTemplateScopeChange={onTemplateScopeChange}
          selectedScopeValue={selectedScopeValue}
          templateScopes={templateScopes}
        />
      )}
      description={`${getFamilyLabel(family)} 발송에 사용할 템플릿을 선택하세요.`}
      emptyCopy="선택한 범위에 템플릿이 있으면 여기에 표시됩니다."
      emptyTitle={loadingTemplates ? '템플릿을 불러오는 중입니다' : '선택 가능한 템플릿이 없습니다'}
      onOpenChange={onOpenChange}
      onTemplateSelect={onTemplateSelect}
      open={open}
      renderTemplateCard={renderTemplateCard}
      searchLabel={`${getFamilyLabel(family)} 템플릿 검색`}
      searchPlaceholder={searchPlaceholder}
      templates={templates}
      title={`${getFamilyLabel(family)} 템플릿 선택`}
      trigger={null}
    />
  );
}

function AutomationTemplateScopeFilter({
  activeTemplateQuery,
  loadingTemplates,
  onTemplateScopeChange,
  selectedScopeValue,
  templateScopes,
}) {
  const queryError = activeTemplateQuery?.isError
    ? getRelayErrorMessage(activeTemplateQuery.error, '템플릿을 불러오지 못했습니다.')
    : '';

  return (
    <div className="automation-message-template-dialog-controls">
      <label className="automation-message-template-dialog-scope">
        <span>템플릿 범위</span>
        <select
          className="automation-rule-editor-select"
          disabled={templateScopes.length <= 1}
          onChange={(event) => onTemplateScopeChange?.(event.target.value)}
          value={selectedScopeValue}
        >
          {templateScopes.length ? templateScopes.map((scope) => (
            <option key={scope.value} value={scope.value}>{scope.label}</option>
          )) : (
            <option value="">조회 가능한 범위 없음</option>
          )}
        </select>
      </label>
      {loadingTemplates ? <p className="automation-message-node-state">템플릿을 불러오는 중입니다.</p> : null}
      {queryError ? (
        <p className="automation-message-node-state is-error" role="alert">
          {queryError}
        </p>
      ) : null}
    </div>
  );
}

function getEffectiveTemplateScopeValue(value, templateScopes) {
  if (templateScopes.some((scope) => scope.value === value)) return value;
  if (templateScopes.some((scope) => scope.value === ALL_TEMPLATE_SCOPE_VALUE)) return ALL_TEMPLATE_SCOPE_VALUE;
  return templateScopes[0]?.value ?? '';
}

function filterTemplatesByScope(templates, selectedScopeValue) {
  if (!selectedScopeValue || selectedScopeValue === ALL_TEMPLATE_SCOPE_VALUE) return templates;

  return templates.filter((template) => (
    (template.__automationTemplateScopeKeys ?? []).includes(selectedScopeValue)
  ));
}

function getDialogTemplates(family, templates) {
  if (family === 'sms') return getSmsTemplateDialogItems(templates);
  if (family === 'brand-message') return getBrandTemplateDialogItems(templates);
  return getAlimtalkTemplateDialogItems(templates);
}

function getDialogTemplateCardRenderer(family) {
  if (family === 'brand-message') return BrandMessageTemplateDialogCard;
  if (family === 'alimtalk') return AlimtalkTemplateDialogCard;
  return undefined;
}

function getFamilyLabel(family) {
  if (family === 'sms') return '문자';
  if (family === 'brand-message') return '브랜드 메시지';
  return '알림톡';
}
