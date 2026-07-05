'use client';

import { useState } from 'react';
import {
  BadgeCheck,
  BellRing,
  ChevronLeft,
  MessageSquareText,
  Save,
  Workflow,
} from 'lucide-react';

import {
  Button,
  SectionPanel,
} from '../../../components/ui/index.js';
import {
  AutomationTextField,
  CancelButton,
} from './AutomationRuleEditorControls.jsx';
import {
  AutomationActionList,
  AutomationSendMessageNode,
  AutomationTriggerNode,
} from './builder/index.js';
import { getAutomationRuleSendFamily } from './ruleEditorReducer.js';
import { useAutomationRuleEditorController } from './useAutomationRuleEditorController.js';

const automationBuilderSendActions = [
  {
    icon: MessageSquareText,
    family: 'sms',
    id: 'send_sms',
    label: '문자 보내기',
    templateSearchPlaceholder: '문자 템플릿 검색...',
  },
  {
    icon: BellRing,
    family: 'alimtalk',
    id: 'send_alimtalk',
    label: '카카오 알림톡 보내기',
    templateSearchPlaceholder: '알림톡 템플릿 검색...',
  },
  {
    icon: BadgeCheck,
    family: 'brand-message',
    id: 'send_brand_message',
    label: '카카오 브랜드 메시지 보내기',
    templateSearchPlaceholder: '브랜드 메시지 템플릿 검색...',
  },
];

const automationBuilderSendActionGroups = [
  {
    actions: automationBuilderSendActions,
    label: 'Messages',
  },
];

const automationBuilderSendNodeConfigs = Object.fromEntries(
  automationBuilderSendActions.map((action) => [
    action.family,
    {
      actionId: action.id,
      icon: action.icon,
      family: action.family,
      templateSearchPlaceholder: action.templateSearchPlaceholder,
      title: action.label,
    },
  ])
);

export function AutomationRuleEditorForm({ editing, initialDraft, returnHref, rule, ruleId }) {
  const editor = useAutomationRuleEditorController({ editing, initialDraft, returnHref, ruleId });
  const title = editing ? '자동화 편집' : '자동화 생성';
  const backLabel = editing ? '자동화 상세' : '자동화 목록';
  const titleCode = editing ? rule?.id ?? ruleId : '새 규칙';

  return (
    <section className="page-frame automation-rule-editor-page">
      <header className="automation-rule-detail-header automation-rule-editor-header">
        <div className="automation-rule-detail-icon" aria-hidden="true">
          <Workflow size={32} strokeWidth={1.7} />
        </div>
        <div className="automation-rule-detail-title-block">
          <span className="automation-rule-detail-context">Automation</span>
          <h1>{title}</h1>
          <code title={titleCode} translate="no">{titleCode}</code>
        </div>
        <div className="automation-rule-detail-header-actions automation-rule-editor-header-actions">
          <Button onClick={editor.returnToList} variant="secondary">
            <ChevronLeft size={15} />
            {backLabel}
          </Button>
          <CancelButton dirty={editor.dirty} onCancel={editor.returnToList} />
          <Button disabled={editor.saveDisabled} form="automation-rule-editor-form" type="submit" variant="primary">
            <Save size={15} />
            저장
          </Button>
        </div>
      </header>

      <form className="automation-rule-editor-layout" id="automation-rule-editor-form" onSubmit={editor.saveDraft}>
        <div className="automation-rule-editor-main">
          <BasicInfoSection editor={editor} validation={editor.inlineErrors} />
          <AutomationBuilderFlow editor={editor} validation={editor.inlineErrors} />
        </div>
      </form>
    </section>
  );
}

function AutomationBuilderFlow({ editor, validation }) {
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const events = editor.mappingPolicy.events;
  const eventCatalogQuery = editor.mappingPolicy.eventCatalogQuery;
  const selectedEventId = editor.state.draft.eventDefinitionId;
  const selectedSendFamily = selectedEventId ? getAutomationRuleSendFamily(editor.state.draft.sendChannel) : '';
  const selectedSendNodeConfig = automationBuilderSendNodeConfigs[selectedSendFamily] ?? null;

  function handleEventChange(eventDefinitionId) {
    setTemplateDialogOpen(false);
    editor.changeEventDefinition(eventDefinitionId);
  }

  function handleActionSelect(action) {
    if (!action?.family) return;
    editor.changeSendFamilyValue(action.family);
    setTemplateDialogOpen(true);
  }

  function handleChangeSendAction() {
    setTemplateDialogOpen(false);
    editor.resetSendAction();
  }

  return (
    <div className="automation-rule-builder-preview" aria-label="Automation flow">
      <div className="automation-rule-builder-preview-flow">
        <AutomationTriggerNode
          className="automation-rule-builder-preview-trigger"
          eventOptions={events}
          eventPlaceholder="이벤트 선택"
          eventsLoading={eventCatalogQuery.isLoading}
          eventsUnavailable={eventCatalogQuery.isError}
          onEventChange={handleEventChange}
          selectedEventId={selectedEventId}
          showApiButton={false}
          validationMessage={validation.event}
        />
        {selectedEventId ? (
          <span
            aria-hidden="true"
            className="automation-rule-builder-preview-connector"
          />
        ) : null}
        {selectedEventId ? (
          selectedSendNodeConfig ? (
            <AutomationSendMessageNode
              className="automation-rule-builder-preview-message-node"
              configuration={editor.sendConfiguration}
              draft={editor.state.draft}
              family={selectedSendNodeConfig.family}
              key={selectedSendNodeConfig.family}
              mappingPolicy={editor.mappingPolicy}
              onChangeSendAction={handleChangeSendAction}
              onSenderResourceChange={editor.changeSenderResourceValue}
              onSmsChannelChange={editor.changeSmsChannelValue}
              onTemplateDialogOpenChange={setTemplateDialogOpen}
              onTemplateSelect={editor.selectTemplateObject}
              onVariableMappingChange={editor.changeVariableMapping}
              stepIcon={selectedSendNodeConfig.icon}
              templateDialogOpen={templateDialogOpen}
              templateSearchPlaceholder={selectedSendNodeConfig.templateSearchPlaceholder}
              title={selectedSendNodeConfig.title}
              validation={validation}
            />
          ) : (
            <AutomationActionList
              className="automation-rule-builder-preview-action-list"
              groups={automationBuilderSendActionGroups}
              onActionSelect={handleActionSelect}
              primaryAction={null}
              selectedActionId={selectedSendNodeConfig?.actionId ?? ''}
              validationMessage={validation.action}
            />
          )
        ) : null}
      </div>
    </div>
  );
}

function BasicInfoSection({ editor, validation }) {
  return (
    <SectionPanel bodyClassName="automation-rule-editor-fields" description="운영자가 목록과 감사 기록에서 식별할 이름을 관리합니다." title="Basic info">
      <AutomationTextField error={validation.name} label="자동화 이름" onChange={editor.changeField('name')} placeholder="주문 준비 안내" required value={editor.state.draft.name} />
    </SectionPanel>
  );
}
