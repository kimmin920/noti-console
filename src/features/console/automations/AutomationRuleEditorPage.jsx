'use client';

import {
  Button,
  SectionPanel,
} from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import { useConsoleNavigation } from '../ConsoleNavigationContext.jsx';
import { AutomationRuleEditorForm } from './AutomationRuleEditorForm.jsx';
import {
  useAutomationRuleQuery,
} from './queries.js';
import {
  DEFAULT_AUTOMATION_RULE_DRAFT,
  createDraftFromAutomationRule,
} from './ruleEditorReducer.js';

export function AutomationRuleEditorPage({ mode = 'create', ruleId = '' }) {
  const editing = mode === 'edit';
  const detailQuery = useAutomationRuleQuery(ruleId, { enabled: editing && Boolean(ruleId) });

  if (editing && !ruleId) {
    return (
      <AutomationRuleEditorError
        message="자동화 규칙 ID가 없어 편집 화면을 열 수 없습니다."
      />
    );
  }

  if (editing && detailQuery.isLoading) {
    return <AutomationRuleEditorLoading />;
  }

  if (editing && detailQuery.isError) {
    return (
      <AutomationRuleEditorError
        message={getRelayErrorMessage(detailQuery.error, '자동화 규칙을 불러오지 못했습니다.')}
        onRetry={() => detailQuery.refetch()}
      />
    );
  }

  const rule = editing ? detailQuery.data?.rule : null;
  const initialDraft = editing ? createDraftFromAutomationRule(rule) : DEFAULT_AUTOMATION_RULE_DRAFT;
  const editorKey = editing ? `${rule?.id ?? ruleId}:${rule?.configHash ?? 'draft'}` : 'new';
  const returnHref = editing && ruleId ? `/automations/${encodeURIComponent(ruleId)}` : '/automations';

  return (
    <AutomationRuleEditorForm
      editing={editing}
      initialDraft={initialDraft}
      key={editorKey}
      returnHref={returnHref}
      rule={rule}
      ruleId={ruleId}
    />
  );
}

function AutomationRuleEditorLoading() {
  return (
    <section className="page-frame automation-rule-editor-page">
      <div className="automation-rule-editor-header">
        <div className="automation-rule-editor-skeleton is-button" />
        <div>
          <div className="automation-rule-editor-skeleton is-label" />
          <div className="automation-rule-editor-skeleton is-title" />
        </div>
      </div>
      <div className="automation-rule-editor-layout">
        <div className="automation-rule-editor-main">
          {Array.from({ length: 4 }, (_, index) => (
            <SectionPanel key={index} title=" ">
              <div className="automation-rule-editor-skeleton is-panel" />
            </SectionPanel>
          ))}
        </div>
      </div>
    </section>
  );
}

function AutomationRuleEditorError({ message, onRetry }) {
  const navigation = useConsoleNavigation();

  return (
    <section className="page-frame automation-rule-editor-page">
      <div className="publ-event-load-error" role="alert">
        <div>
          <strong>자동화 규칙 로드 실패</strong>
          <span>{message}</span>
        </div>
        {onRetry ? <Button onClick={onRetry}>다시 시도</Button> : null}
        <Button onClick={() => navigation.push('/automations')} variant="secondary">목록</Button>
      </div>
    </section>
  );
}
