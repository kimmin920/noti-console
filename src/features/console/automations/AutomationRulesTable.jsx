'use client';

import { useMemo, useState } from 'react';
import { Ban, CheckCircle2, ChevronDown, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { ActionMenu, ActionMenuContent, ActionMenuItem, ActionMenuSeparator, ActionMenuTrigger, Badge, ConfirmationDialog, DataTableV2, FilterSelect, IconButton, SearchField, useToast } from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import { AutomationTableLoadError } from './AutomationTableLoadError.jsx';
import { useAutomationRuleArchiveMutation, useAutomationRuleDisableMutation, useAutomationRuleEnableMutation, useAutomationRulesQuery } from './queries.js';
import { useConsoleNavigation } from '../ConsoleNavigationContext.jsx';

const AUTOMATION_STATUS_LABELS = {
  archived: '보관됨',
  disabled: '비활성화',
  enabled: '활성화',
};

const AUTOMATION_RULE_QUERY_LIMIT = 200;

const AUTOMATION_RULE_PAGE_SIZE_OPTIONS = [20, 50, 100];

const AUTOMATION_RULE_STATUS_OPTIONS = [
  { label: '모든 상태', value: 'all' },
  { label: '활성화', tone: 'green', value: 'enabled' },
  { label: '비활성화', tone: 'neutral', value: 'disabled' },
  { label: '보관됨', tone: 'neutral', value: 'archived' },
];

export function AutomationRulesTable({ table: tableConfig }) {
  const navigation = useConsoleNavigation();
  const { showToast } = useToast();
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const queryFilters = useMemo(
    () => ({
      limit: AUTOMATION_RULE_QUERY_LIMIT,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [statusFilter]
  );
  const rulesQuery = useAutomationRulesQuery(queryFilters);
  const enableMutation = useAutomationRuleEnableMutation();
  const disableMutation = useAutomationRuleDisableMutation();
  const archiveMutation = useAutomationRuleArchiveMutation();
  const rows = useMemo(
    () => (Array.isArray(rulesQuery.data?.rules) ? rulesQuery.data.rules : []),
    [rulesQuery.data]
  );
  const filteredRows = useMemo(
    () => filterAutomationRules(rows, searchValue),
    [rows, searchValue]
  );
  const columns = useMemo(
    () => {
      const headers = tableConfig.columns ?? ['이름', '상태', '이벤트', '템플릿'];

      return [
        {
          accessor: (row) => row.name,
          className: 'is-automation-name',
          header: headers[0],
          cell: ({ row }) => <AutomationNameCell rule={row} />,
        },
        {
          accessor: (row) => row.status,
          className: 'is-automation-status',
          header: headers[1],
          cell: ({ value }) => <AutomationStatusChip status={value} />,
        },
        {
          accessor: (row) => row.eventDefinition?.displayName ?? row.eventDefinition?.eventKey,
          className: 'is-automation-event',
          header: headers[2],
          cell: ({ row }) => <AutomationRuleEventCell rule={row} />,
        },
        {
          accessor: (row) => row.templateCode,
          className: 'is-automation-template',
          header: headers[3],
          cell: ({ row }) => <AutomationRuleTemplateCell rule={row} />,
        },
      ];
    },
    [tableConfig.columns]
  );
  const mutationPending = enableMutation.isPending || disableMutation.isPending || archiveMutation.isPending;
  const emptyMessage = searchValue.trim() || statusFilter !== 'all'
    ? '조건에 맞는 자동화가 없습니다.'
    : '아직 자동화 규칙이 없습니다.';

  function openAutomationDetail(row) {
    navigation.push(`/automations/${encodeURIComponent(row.id)}`);
  }

  function openAutomationEdit(row) {
    navigation.push(`/automations/${encodeURIComponent(row.id)}/edit`);
  }

  async function enableRule(row) {
    try {
      const result = await enableMutation.mutateAsync({ ruleId: row.id });
      showToast({
        description: `${result?.rule?.name ?? row.name} 규칙이 이벤트 수신 시 발송됩니다.`,
        title: '자동화 활성화',
        variant: 'success',
      });
    } catch (error) {
      showToast({
        description: getRelayErrorMessage(error, '자동화를 활성화하지 못했습니다.'),
        title: '자동화 활성화 실패',
        variant: 'critical',
      });
    }
  }

  async function disableRule(row) {
    try {
      const result = await disableMutation.mutateAsync({ ruleId: row.id });
      showToast({
        description: `${result?.rule?.name ?? row.name} 규칙이 발송을 멈췄습니다.`,
        title: '자동화 비활성화',
        variant: 'success',
      });
    } catch (error) {
      showToast({
        description: getRelayErrorMessage(error, '자동화를 비활성화하지 못했습니다.'),
        title: '자동화 비활성화 실패',
        variant: 'critical',
      });
    }
  }

  async function archiveRule(row) {
    try {
      const result = await archiveMutation.mutateAsync({ ruleId: row.id });
      showToast({
        description: `${result?.rule?.name ?? row.name} 규칙을 보관했습니다.`,
        title: '자동화 보관',
        variant: 'success',
      });
    } catch (error) {
      showToast({
        description: getRelayErrorMessage(error, '자동화를 보관하지 못했습니다.'),
        title: '자동화 보관 실패',
        variant: 'critical',
      });
    }
  }

  if (rulesQuery.isError && rows.length === 0) {
    return (
      <AutomationTableLoadError
        message={getRelayErrorMessage(rulesQuery.error, '자동화 규칙을 불러오지 못했습니다.')}
        onRetry={() => rulesQuery.refetch()}
        title="자동화 규칙 로드 실패"
      />
    );
  }

  return (
    <div className="automation-rules-list">
      <div className="automation-rules-list-toolbar">
        <SearchField
          aria-label="자동화 이름, 이벤트, 발신 수단, 템플릿 검색"
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="이름, 이벤트, 템플릿 검색"
          value={searchValue}
        />
        <FilterSelect
          className="automation-status-filter"
          label="상태"
          onValueChange={setStatusFilter}
          options={AUTOMATION_RULE_STATUS_OPTIONS}
          value={statusFilter}
        />
      </div>
      <DataTableV2
        actionsClassName="is-email-actions is-automation-actions table-actions"
        actionsHeaderClassName="is-email-actions is-automation-actions"
        columns={columns}
        data={filteredRows}
        empty={emptyMessage}
        getRowId={(row) => row.id}
        getRowProps={({ row }) => ({
          'aria-label': `${row.name || '이름 없는 자동화'} 자동화 상세 보기`,
          className: 'is-clickable',
          onClick: (event) => {
            if (shouldIgnoreAutomationRowNavigation(event)) return;
            openAutomationDetail(row);
          },
          onKeyDown: (event) => {
            if (event.key !== 'Enter' || shouldIgnoreAutomationRowNavigation(event)) return;
            openAutomationDetail(row);
          },
          role: 'link',
          tabIndex: 0,
        })}
        initialPageSize={AUTOMATION_RULE_PAGE_SIZE_OPTIONS[0]}
        loading={rulesQuery.isLoading}
        loadingRows={6}
        loadingSlot={<span className="automation-unsent-loading" role="status">자동화 규칙을 불러오는 중입니다.</span>}
        onRowClick={({ row }) => openAutomationDetail(row)}
        pagination
        renderPagination={({ table: dataTable }) => (
          <AutomationTablePagination table={dataTable} total={filteredRows.length} />
        )}
        rowActions={({ row }) => (
          <AutomationRuleRowActions
            archivePending={archiveMutation.isPending && archiveMutation.variables?.ruleId === row.id}
            disabled={mutationPending}
            disablePending={disableMutation.isPending && disableMutation.variables?.ruleId === row.id}
            enablePending={enableMutation.isPending && enableMutation.variables?.ruleId === row.id}
            onArchive={() => archiveRule(row)}
            onDisable={() => disableRule(row)}
            onEdit={() => openAutomationEdit(row)}
            onEnable={() => enableRule(row)}
            row={row}
          />
        )}
        selectable
        selectAllLabel="모든 자동화 선택"
        selectedRowLabel={({ row }) => `${row.name} 선택`}
        selectionVisibility="hover"
        shellClassName="automation-data-table-shell"
        tableClassName="automation-data-table automation-rules-data-table"
      />
    </div>
  );
}

function shouldIgnoreAutomationRowNavigation(event) {
  const target = event.target;
  if (!(target instanceof Element)) return false;

  return Boolean(target.closest(
    'a, button, input, select, textarea, [role="button"], [role="menuitem"], [data-automation-row-action]'
  ));
}

function filterAutomationRules(rows, searchValue) {
  const normalizedSearch = normalizeAutomationSearchValue(searchValue);

  if (!normalizedSearch) return rows;

  return rows.filter((row) => getAutomationRuleSearchText(row).includes(normalizedSearch));
}

function getAutomationRuleSearchText(rule) {
  return [
    rule.name,
    rule.eventDefinition?.displayName,
    rule.eventDefinition?.eventKey,
    rule.sendChannel,
    formatAutomationSendChannel(rule.sendChannel),
    rule.senderResource?.displayName,
    rule.senderResource?.type,
    rule.templateCode,
    rule.templateSource,
    rule.status,
    AUTOMATION_STATUS_LABELS[rule.status],
  ]
    .filter(Boolean)
    .map(normalizeAutomationSearchValue)
    .join(' ');
}

function normalizeAutomationSearchValue(value) {
  return String(value ?? '').trim().toLocaleLowerCase('ko-KR');
}

function AutomationRuleRowActions({
  archivePending,
  disabled,
  disablePending,
  enablePending,
  onArchive,
  onDisable,
  onEdit,
  onEnable,
  row,
}) {
  const archived = row.status === 'archived';
  const enabled = row.status === 'enabled';
  const actionsDisabled = disabled || archivePending || disablePending || enablePending;

  return (
    <div
      className="automation-unsent-action-buttons"
      data-automation-row-action
      onClick={(event) => event.stopPropagation()}
    >
      <ActionMenu>
        <ActionMenuTrigger asChild>
          <IconButton
            disabled={actionsDisabled}
            icon={MoreHorizontal}
            label={`${row.name} 작업 더보기`}
          />
        </ActionMenuTrigger>
        <ActionMenuContent align="end">
          <ActionMenuItem
            leadingVisual={<Pencil size={16} />}
            onSelect={onEdit}
          >
            편집
          </ActionMenuItem>
          {enabled ? (
            <ActionMenuItem
              disabled={actionsDisabled || archived}
              leadingVisual={<Ban size={16} />}
              onSelect={onDisable}
            >
              비활성화
            </ActionMenuItem>
          ) : (
            <ActionMenuItem
              disabled={actionsDisabled || archived}
              leadingVisual={<CheckCircle2 size={16} />}
              onSelect={onEnable}
            >
              활성화
            </ActionMenuItem>
          )}
          <ActionMenuSeparator />
          <ConfirmationDialog
            confirmLabel="보관"
            description={`${row.name} 자동화를 보관합니다. 보관된 규칙은 다시 활성화할 수 없습니다.`}
            destructive
            onConfirm={onArchive}
            title={`${row.name} 보관?`}
          >
            <ActionMenuItem
              disabled={actionsDisabled || archived}
              leadingVisual={<Trash2 size={16} />}
              variant="danger"
            >
              보관
            </ActionMenuItem>
          </ConfirmationDialog>
        </ActionMenuContent>
      </ActionMenu>
    </div>
  );
}

function AutomationNameCell({ rule }) {
  return (
    <span className="automation-name-cell">
      <AutomationRowIcon />
      <span className="automation-name-copy">
        <span className="automation-name-text">{rule.name || '이름 없는 자동화'}</span>
      </span>
    </span>
  );
}

function AutomationRuleEventCell({ rule }) {
  const eventName = rule.eventDefinition?.displayName || rule.eventDefinition?.eventKey || '이벤트';

  return (
    <span className="automation-rule-stack-cell">
      <span className="automation-rule-primary">{eventName}</span>
    </span>
  );
}

function AutomationRuleTemplateCell({ rule }) {
  return (
    <span className="automation-rule-stack-cell">
      <span className="automation-rule-primary">
        <Badge tone="neutral">{formatAutomationSendChannel(rule.sendChannel)}</Badge>
      </span>
      <span className="automation-rule-code" title={rule.templateCode} translate="no">
        {rule.templateCode || '-'}
      </span>
    </span>
  );
}

function AutomationStatusChip({ status }) {
  const normalizedStatus = ['archived', 'enabled'].includes(status) ? status : 'disabled';

  return (
    <span className={`automation-status-chip is-${normalizedStatus}`}>
      {AUTOMATION_STATUS_LABELS[normalizedStatus]}
    </span>
  );
}

function AutomationTablePagination({ table, total }) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = Math.max(table.getPageCount(), 1);
  const pageNumber = Math.min(pageIndex + 1, pageCount);

  function changePageSize(event) {
    table.setPageSize(Number(event.target.value));
    table.setPageIndex(0);
  }

  return (
    <div className="automation-table-pagination">
      <span>
        페이지 {pageNumber} - {pageCount} / {total.toLocaleString('ko-KR')}개 자동화 -{' '}
        <span className="automation-page-size-select">
          <select aria-label="페이지당 자동화 수" onChange={changePageSize} value={pageSize}>
            {AUTOMATION_RULE_PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}개</option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={14} />
        </span>
      </span>
    </div>
  );
}

function AutomationRowIcon() {
  return (
    <span aria-hidden="true" className="automation-row-icon">
      <svg className="automation-row-icon-frame" fill="none" height="32" viewBox="0 0 32 32" width="32">
        <rect className="automation-row-icon-bg" height="32" rx="11" width="32" />
        <rect className="automation-row-icon-border" height="30" rx="10" width="30" x="1" y="1" />
        <g className="automation-row-icon-grid">
          <path d="M5.5 1v30M10.5 1v30M15.5 1v30M20.5 1v30M25.5 1v30" />
          <path d="M1 5.5h30M1 10.5h30M1 15.5h30M1 20.5h30M1 25.5h30" />
          <path d="M11 1h4v4h-4zM26 1h4v4h-4zM1 11h4v4H1zM21 11h4v4h-4zM26 16h4v4h-4zM6 21h4v4H6zM21 21h4v4h-4zM11 26h4v4h-4z" />
        </g>
      </svg>
      <svg className="automation-row-icon-mark" fill="currentColor" height="17" viewBox="0 0 32 32" width="17">
        <path
          clipRule="evenodd"
          d="M6 3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm0 2.5a.5.5 0 0 0-.5.5v6c0 .28.22.5.5.5h6a.5.5 0 0 0 .5-.5V6a.5.5 0 0 0-.5-.5H6ZM20 17h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Zm0 2.5a.5.5 0 0 0-.5.5v6c0 .28.22.5.5.5h6a.5.5 0 0 0 .5-.5v-6a.5.5 0 0 0-.5-.5h-6ZM8 15v5a4 4 0 0 0 4 4h5v-2.5h-5a1.5 1.5 0 0 1-1.5-1.5v-5H8Z"
          fillRule="evenodd"
        />
      </svg>
    </span>
  );
}
