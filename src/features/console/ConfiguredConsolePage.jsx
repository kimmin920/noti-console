'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Sparkles } from 'lucide-react';
import { ApiCodeDrawer, PageHeader, Toolbar } from '../../components/layout/index.js';
import { Button, EmptyState, SegmentedControl } from '../../components/ui/index.js';

import { AutomationRulesTable } from './automations/AutomationRulesTable.jsx';
import { AutomationUnsentTable } from './automations/AutomationUnsentTable.jsx';
import { PublEventsTable } from './automations/PublEventsTable.jsx';
import { SelectableDataTable } from './audience/AudienceTable.jsx';

export function ConfiguredConsolePage({ meta, onDocs }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(() => getConsolePageTabValue(meta.tabs?.[0]));
  const isAutomationsPage = meta.variant === 'automations';
  const activeView = {
    ...meta,
    ...(meta.tabViews?.[activeTab] ?? {}),
  };
  const activeTableVariant = activeView.table?.variant;
  const shouldShowToolbar = !isAutomationsPage;
  const toolbarClassName = [
    isAutomationsPage && 'automations-toolbar',
    activeTableVariant === 'publ-events' && 'publ-events-toolbar',
    activeTableVariant === 'automation-unsent' && 'automation-unsent-toolbar',
  ].filter(Boolean).join(' ');
  const opensDocs = activeView.emptyButton === '문서 보기';
  const opensTemplateCreate = activeView.action === '템플릿 생성';
  const opensAutomationCreate = activeView.action === '자동화 생성';
  const opensPublEventCreate = activeView.action === '이벤트 생성';
  const openTemplateCreatePage = opensTemplateCreate
    ? () => router.push('/templates/alimtalk/new')
    : undefined;
  const openAutomationCreatePage = opensAutomationCreate
    ? () => router.push('/automations/new')
    : undefined;
  const openPublEventCreatePage = opensPublEventCreate
    ? () => router.push('/automations/publ-events/new')
    : undefined;
  const openActionPage = openTemplateCreatePage ?? openAutomationCreatePage ?? openPublEventCreatePage;

  return (
    <section className={['page-frame', isAutomationsPage && 'automations-page'].filter(Boolean).join(' ')}>
      <PageHeader action={isAutomationsPage ? undefined : activeView.action} onAction={openTemplateCreatePage} title={meta.title} />
      {meta.tabs ? (
        isAutomationsPage ? (
          <div className="automations-tabs-row">
            <SegmentedControl
              items={meta.tabs}
              onValueChange={setActiveTab}
              value={activeTab}
            />
            <div className="automations-header-actions">
              {activeView.action ? (
                <Button onClick={openActionPage} variant="primary">
                  <Plus size={15} />
                  {activeView.action}
                </Button>
              ) : null}
              <ApiCodeDrawer />
            </div>
          </div>
        ) : (
          <SegmentedControl
            items={meta.tabs}
            onValueChange={setActiveTab}
            value={activeTab}
          />
        )
      ) : null}
      {shouldShowToolbar ? (
        <Toolbar
          className={toolbarClassName}
          filters={activeView.filters}
          showExport
        />
      ) : null}
      {activeView.table ? (
        activeTableVariant === 'automations' ? (
          <AutomationRulesTable table={activeView.table} />
        ) : activeTableVariant === 'automation-unsent' ? (
          <AutomationUnsentTable table={activeView.table} />
        ) : activeTableVariant === 'publ-events' ? (
          <PublEventsTable table={activeView.table} />
        ) : (
          <SelectableDataTable table={activeView.table} />
        )
      ) : (
        <EmptyState
          action={activeView.emptyButton}
          copy={activeView.emptyCopy}
          icon={Sparkles}
          onAction={opensDocs ? onDocs : openActionPage}
          title={activeView.emptyTitle}
        />
      )}
    </section>
  );
}

function getConsolePageTabValue(tab) {
  if (typeof tab === 'object' && tab !== null) {
    return tab.value;
  }

  return tab ?? '';
}
