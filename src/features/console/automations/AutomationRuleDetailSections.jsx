'use client';

import {
  BadgeCheck,
  BellRing,
  ChevronLeft,
  Clock3,
  Code2,
  FileText,
  MessageSquareText,
  Pencil,
  Send,
  ShieldCheck,
  Workflow,
} from 'lucide-react';

import {
  Button,
  SectionPanel,
  TextField,
} from '../../../components/ui/index.js';
import { ConsoleLink } from '../ConsoleNavigationContext.jsx';
import {
  AUTOMATION_STATUS_LABELS,
  formatAutomationRuleDateTime,
  formatAutomationSendChannel,
  getConditionSummary,
  getCooldownSummary,
} from './automationRuleDetailModel.js';

export function AutomationRuleDetailContent({
  eventKey,
  rule,
}) {
  return (
    <div className="automation-rule-detail-main">
      <AutomationRuleOperationalSummary eventKey={eventKey} rule={rule} />
      <div className="automation-rule-editor-layout automation-rule-detail-readonly-editor">
        <div className="automation-rule-editor-main">
          <AutomationRuleReadonlyBasicInfo rule={rule} />
          <AutomationRuleReadonlyFlow eventKey={eventKey} rule={rule} />
        </div>
      </div>
    </div>
  );
}

export function AutomationRuleDetailHeader({ eventKey, onOpenApi, rule }) {
  const encodedRuleId = encodeURIComponent(rule.id);

  return (
    <header className="automation-rule-detail-header">
      <div className="automation-rule-detail-icon" aria-hidden="true">
        <Workflow size={32} strokeWidth={1.7} />
      </div>
      <div className="automation-rule-detail-title-block">
        <span className="automation-rule-detail-context">Automation</span>
        <h1 title={rule.name}>{rule.name || '이름 없는 자동화'}</h1>
        <code title={rule.id} translate="no">{rule.id}</code>
      </div>
      <div className="automation-rule-detail-header-actions">
        <Button asChild variant="secondary">
          <ConsoleLink className="automation-rule-detail-link-button" href="/automations">
            <ChevronLeft aria-hidden="true" size={15} />
            목록
          </ConsoleLink>
        </Button>
        <Button disabled={!eventKey} onClick={onOpenApi} variant="secondary">
          <Code2 aria-hidden="true" size={14} />
          Open API
        </Button>
        <Button asChild variant="primary">
          <ConsoleLink className="automation-rule-detail-link-button" href={`/automations/${encodedRuleId}/edit`}>
            <Pencil aria-hidden="true" size={14} />
            편집
          </ConsoleLink>
        </Button>
      </div>
    </header>
  );
}

export function AutomationRuleDetailSkeleton() {
  return (
    <section className="page-frame automation-rule-detail-page">
      <div className="automation-rule-editor-skeleton is-button" />
      <div className="automation-rule-detail-main">
        <SectionPanel className="automation-rule-detail-panel" title=" ">
          <div className="automation-rule-editor-skeleton is-panel" />
        </SectionPanel>
        <div className="automation-rule-editor-skeleton is-panel" />
      </div>
    </section>
  );
}

export function AutomationRuleDetailStatus({ actionHref, actionLabel, message, onRetry, title }) {
  return (
    <section className="page-frame automation-rule-detail-page">
      <div className="publ-event-load-error" role="alert">
        <div>
          <strong>{title}</strong>
          <span>{message}</span>
        </div>
        {onRetry ? <Button onClick={onRetry}>다시 시도</Button> : null}
        <Button asChild variant="secondary">
          <ConsoleLink className="automation-rule-detail-link-button" href={actionHref}>{actionLabel}</ConsoleLink>
        </Button>
      </div>
    </section>
  );
}

function AutomationRuleReadonlyFlow({ eventKey, rule }) {
  const action = getSendActionMeta(rule.sendChannel);
  const ActionIcon = action.icon;
  const eventName = rule.eventDefinition?.displayName || eventKey || '-';

  return (
    <div className="automation-rule-builder-preview automation-rule-detail-readonly-flow" aria-label="Automation flow">
      <div className="automation-rule-builder-preview-flow">
        <article className="resend-ui-domain-automation-trigger-node automation-rule-builder-preview-trigger">
          <div className="resend-ui-domain-automation-trigger-node__content">
            <header className="resend-ui-domain-automation-trigger-node__header">
              <span className="resend-ui-domain-automation-trigger-node__trigger-icon" aria-hidden="true">
                <Workflow size={14} />
              </span>
              <span className="resend-ui-domain-automation-trigger-node__title">Custom event</span>
            </header>
            <div className="resend-ui-domain-automation-trigger-node__body">
              <div className="automation-rule-detail-readonly-control">
                <span>{eventName}</span>
                <code>{eventKey || '-'}</code>
              </div>
            </div>
          </div>
        </article>
        <span aria-hidden="true" className="automation-rule-builder-preview-connector" />
        <article className="resend-ui-domain-automation-send-email-node automation-rule-builder-preview-message-node">
          <header className="resend-ui-domain-automation-send-email-node__header">
            <span className="resend-ui-domain-automation-send-email-node__step-icon" aria-hidden="true">
              <ActionIcon size={14} />
            </span>
            <span className="resend-ui-domain-automation-send-email-node__title">{action.label}</span>
          </header>
          <div className="resend-ui-domain-automation-send-email-node__body">
            <div className="resend-ui-domain-automation-send-email-node__details">
              <div className="automation-message-node-compose automation-rule-detail-message-compose">
                <div className="automation-message-node-settings-column">
                  <AutomationRuleReadonlySettings rule={rule} />
                </div>
                <div className="automation-message-node-preview-column">
                  <AutomationRuleMappingSummary rule={rule} />
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

function AutomationRuleOperationalSummary({ eventKey, rule }) {
  return (
    <section className="automation-rule-detail-operational-summary" aria-label="자동화 추가 정보">
      <AutomationRuleMetaItem label="상태" value={<AutomationDetailStatusChip status={rule.status} />} />
      <AutomationRuleMetaItem label="PUBL 이벤트" value={rule.eventDefinition?.displayName || eventKey || '-'} />
      <AutomationRuleMetaItem label="이벤트 key" value={<code>{eventKey || '-'}</code>} />
      <AutomationRuleMetaItem label="발송 채널" value={formatAutomationSendChannel(rule.sendChannel)} />
      <AutomationRuleMetaItem label="수정일" value={formatAutomationRuleDateTime(rule.updatedAt ?? rule.createdAt)} />
    </section>
  );
}

function AutomationRuleReadonlyBasicInfo({ rule }) {
  return (
    <SectionPanel bodyClassName="automation-rule-editor-fields" description="운영자가 목록과 감사 기록에서 식별할 이름을 관리합니다." title="Basic info">
      <AutomationRuleReadonlyTextField label="자동화 이름" value={rule.name || '-'} />
    </SectionPanel>
  );
}

function AutomationRuleReadonlyTextField({ label, value }) {
  return (
    <label className="automation-rule-editor-field automation-rule-detail-readonly-input">
      <span>{label}</span>
      <TextField.Root>
        <TextField.Input aria-label={label} readOnly value={value} />
      </TextField.Root>
    </label>
  );
}

function AutomationRuleMetaItem({ label, value }) {
  return (
    <div className="automation-rule-detail-meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AutomationRuleReadonlyField({ label, value }) {
  return (
    <div className="automation-rule-detail-readonly-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AutomationRuleMappingSummary({ rule }) {
  const recipientAlias = rule.recipientMappingJson?.alias || '-';
  const entries = Object.entries(rule.variableMappingJson ?? {});

  return (
    <section className="automation-rule-detail-preview-card">
      <div>
        <span className="automation-rule-detail-preview-label">템플릿</span>
        <strong>{rule.templateCode || '-'}</strong>
        <code>{rule.templateSource || '-'}</code>
      </div>
      <div className="automation-rule-detail-highlight-row">
        <span><Send aria-hidden="true" size={15} />수신자 alias</span>
        <code>{recipientAlias}</code>
      </div>
      <div className="automation-rule-detail-chip-list" aria-label="템플릿 변수 매핑">
        {entries.length > 0 ? entries.map(([templateKey, eventAlias]) => (
          <span className="automation-rule-detail-chip" key={templateKey}>
            <code>{templateKey}</code>
            <span aria-hidden="true">-&gt;</span>
            <code>{String(eventAlias)}</code>
          </span>
        )) : <span className="automation-rule-detail-empty">템플릿 변수 매핑이 없습니다.</span>}
      </div>
    </section>
  );
}

function AutomationRuleReadonlySettings({ rule }) {
  return (
    <div className="resend-ui-domain-automation-send-email-node__settings">
      <section className="resend-ui-domain-automation-send-email-node__settings-section">
        <h3>발송 설정</h3>
        <div className="automation-rule-detail-readonly-settings-grid">
          <AutomationRuleReadonlyField label="발송 채널" value={formatAutomationSendChannel(rule.sendChannel)} />
          <AutomationRuleReadonlyField label="발신 리소스" value={rule.senderResource?.displayName || rule.senderResourceId || '-'} />
        </div>
      </section>
      <section className="resend-ui-domain-automation-send-email-node__settings-section">
        <h3>실행 정책</h3>
        <div className="automation-rule-detail-stack">
          <div className="automation-rule-detail-highlight-row">
            <span><ShieldCheck aria-hidden="true" size={15} />조건</span>
            <strong>{getConditionSummary(rule.conditionJson)}</strong>
          </div>
          <div className="automation-rule-detail-highlight-row">
            <span><Clock3 aria-hidden="true" size={15} />쿨다운</span>
            <strong>{getCooldownSummary(rule.cooldownPolicyJson)}</strong>
          </div>
          <div className="automation-rule-detail-highlight-row">
            <span><FileText aria-hidden="true" size={15} />템플릿 소스</span>
            <code>{rule.templateSource || '-'}</code>
          </div>
        </div>
      </section>
    </div>
  );
}

function getSendActionMeta(channel) {
  if (channel === 'alimtalk') {
    return {
      icon: BellRing,
      label: '카카오 알림톡 보내기',
    };
  }

  if (channel === 'brand-message') {
    return {
      icon: BadgeCheck,
      label: '카카오 브랜드 메시지 보내기',
    };
  }

  return {
    icon: MessageSquareText,
    label: `${formatAutomationSendChannel(channel)} 보내기`,
  };
}

function AutomationDetailStatusChip({ status }) {
  const normalizedStatus = ['archived', 'enabled'].includes(status) ? status : 'disabled';

  return <span className={`automation-status-chip is-${normalizedStatus}`}>{AUTOMATION_STATUS_LABELS[normalizedStatus]}</span>;
}
