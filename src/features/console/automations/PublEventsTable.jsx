'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, DataTableV2, TablePagination } from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import { useAutomationRulesQuery } from './queries.js';
import { usePublEventsQuery } from '../publEvents/queries.js';
import { AutomationTableLoadError } from './AutomationTableLoadError.jsx';
import { useConsoleNavigation } from '../ConsoleNavigationContext.jsx';

const PUBL_EVENT_TABLE_PAGE_SIZE_OPTIONS = [30, 60, 120];

const PUBL_EVENT_VARIABLE_CHIP_GAP = 4;

const PUBL_EVENT_VARIABLE_COLLAPSED_ROW_LIMIT = 2;

const AUTOMATION_RULE_QUERY_LIMIT = 200;

export function PublEventsTable({ table: tableConfig }) {
  const navigation = useConsoleNavigation();
  const publEventsQuery = usePublEventsQuery();
  const automationQueryFilters = useMemo(() => ({ limit: AUTOMATION_RULE_QUERY_LIMIT }), []);
  const automationRulesQuery = useAutomationRulesQuery(automationQueryFilters);
  const catalog = publEventsQuery.data ?? {};
  const rows = useMemo(
    () => (Array.isArray(catalog.events) ? catalog.events : []),
    [catalog.events]
  );
  const automationRules = useMemo(
    () => (Array.isArray(automationRulesQuery.data?.rules) ? automationRulesQuery.data.rules : []),
    [automationRulesQuery.data]
  );
  const automationStateByEventKey = useMemo(
    () => buildPublEventAutomationStateByEventKey(rows, automationRules),
    [automationRules, rows]
  );
  const columns = useMemo(
    () => {
      const headers = tableConfig.columns ?? ['이벤트', '사용중 변수', '자동화'];

      return [
        {
          accessor: (row) => row.displayName,
          className: 'is-publ-event-name',
          header: headers[0],
          cell: ({ row }) => <PublEventNameCell event={row} />,
        },
        {
          accessor: (row) => row.locationId || '',
          className: 'is-publ-event-location',
          header: headers[1],
          cell: ({ row }) => <PublEventLocationCell event={row} />,
        },
        {
          accessor: (row) => getPublEventUsedVariables(row).length,
          className: 'is-publ-event-variables',
          header: headers[2],
          cell: ({ row }) => <PublEventVariableChipsCell event={row} />,
        },
        {
          accessor: (row) => automationStateByEventKey.get(row.eventKey)?.sortRank ?? 3,
          className: 'is-publ-event-automation',
          header: headers[3],
          cell: ({ row }) => (
            <PublEventAutomationCell
              error={automationRulesQuery.isError}
              loading={automationRulesQuery.isLoading}
              state={automationStateByEventKey.get(row.eventKey)}
            />
          ),
        },
      ];
    },
    [automationRulesQuery.isError, automationRulesQuery.isLoading, automationStateByEventKey, tableConfig.columns]
  );

  if (publEventsQuery.isError && rows.length === 0) {
    return (
      <AutomationTableLoadError
        message={getRelayErrorMessage(publEventsQuery.error, 'PUBL 이벤트를 불러오지 못했습니다.')}
        onRetry={() => publEventsQuery.refetch()}
      />
    );
  }

  return (
    <DataTableV2
      columns={columns}
      data={rows}
      empty="표시할 PUBL 이벤트가 없습니다."
      fixed
      getRowId={(row) => row.id ?? row.eventKey}
      initialPageSize={30}
      loading={publEventsQuery.isLoading}
      loadingRows={8}
      pagination
      renderPagination={({ table: dataTable }) => (
        <TablePagination
          itemLabel="이벤트"
          pageSizeOptions={PUBL_EVENT_TABLE_PAGE_SIZE_OPTIONS}
          table={dataTable}
          total={rows.length}
        />
      )}
      rowActions={({ row }) => (
        <Button
          aria-label={`${row.displayName || row.eventKey} 상세 보기`}
          className="publ-event-detail-action"
          onClick={() => navigation.push(buildPublEventDetailHref(row.eventKey))}
        >
          상세
        </Button>
      )}
      actionsClassName="is-publ-event-actions"
      actionsHeaderClassName="is-publ-event-actions"
      shellClassName="publ-event-data-table-shell"
      tableClassName="publ-event-data-table"
    />
  );
}

function PublEventNameCell({ event }) {
  return (
    <span className="publ-event-name-cell">
      <span className="publ-event-name-row">
        <span className="publ-event-name-text">{event.displayName || event.eventKey}</span>
      </span>
      <span className="publ-event-key" title={event.eventKey} translate="no">
        {event.eventKey || '-'}
      </span>
    </span>
  );
}

function PublEventLocationCell({ event }) {
  const location = normalizePublEventVariableText(event?.locationId);

  return (
    <span className="publ-event-location-cell" title={location || 'location 없음'} translate="no">
      {location || '-'}
    </span>
  );
}

function PublEventVariableChipsCell({ event }) {
  const variables = getPublEventUsedVariables(event);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const [visibleVariableCount, setVisibleVariableCount] = useState(variables.length);
  const cellRef = useRef(null);
  const measureRef = useRef(null);
  const variableLayoutKey = variables.map((variable) => (
    `${variable.key}:${variable.displayName}:${variable.required ? 'required' : 'optional'}`
  )).join('|');

  useEffect(() => {
    const cell = cellRef.current;
    const measure = measureRef.current;

    if (!cell || !measure || variables.length === 0) {
      setCanExpand(false);
      setExpanded(false);
      setVisibleVariableCount(variables.length);
      return undefined;
    }

    let frameId = null;

    const getRowCount = (itemWidths, maxWidth) => {
      return itemWidths.reduce((rowState, itemWidth) => {
        const nextLineWidth = rowState.lineWidth === 0
          ? itemWidth
          : rowState.lineWidth + PUBL_EVENT_VARIABLE_CHIP_GAP + itemWidth;

        if (nextLineWidth <= maxWidth || rowState.lineWidth === 0) {
          return {
            lineWidth: nextLineWidth,
            rows: rowState.rows,
          };
        }

        return {
          lineWidth: itemWidth,
          rows: rowState.rows + 1,
        };
      }, { lineWidth: 0, rows: 1 }).rows;
    };

    const updateVisibleVariables = () => {
      const maxWidth = Math.floor(cell.getBoundingClientRect().width);
      const chipElements = Array.from(measure.querySelectorAll('[data-publ-variable-measure="chip"]'));
      const moreElement = measure.querySelector('[data-publ-variable-measure="more"]');

      if (maxWidth <= 0 || chipElements.length === 0 || !moreElement) {
        return;
      }

      const chipWidths = chipElements.map((chip) => Math.ceil(chip.getBoundingClientRect().width));
      const moreWidth = Math.ceil(moreElement.getBoundingClientRect().width);

      if (getRowCount(chipWidths, maxWidth) <= PUBL_EVENT_VARIABLE_COLLAPSED_ROW_LIMIT) {
        setCanExpand(false);
        setExpanded(false);
        setVisibleVariableCount(variables.length);
        return;
      }

      let nextVisibleCount = 0;

      for (let count = 0; count <= chipWidths.length; count += 1) {
        const candidateWidths = [...chipWidths.slice(0, count), moreWidth];
        const candidateRows = getRowCount(candidateWidths, maxWidth);

        if (candidateRows > PUBL_EVENT_VARIABLE_COLLAPSED_ROW_LIMIT) {
          break;
        }

        nextVisibleCount = count;
      }

      setCanExpand(true);
      setVisibleVariableCount(Math.min(nextVisibleCount, variables.length));
    };

    const scheduleUpdate = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(updateVisibleVariables);
    };

    scheduleUpdate();

    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleUpdate);
    observer?.observe(cell);
    observer?.observe(measure);
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      observer?.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [variableLayoutKey, variables.length]);

  if (variables.length === 0) {
    return <span className="publ-event-variable-empty">사용중 변수 없음</span>;
  }

  const variableSummary = variables.map((variable) => (
    variable.required ? `${variable.displayName} 필수` : variable.displayName
  )).join(', ');
  const cellClassName = [
    'publ-event-variable-cell',
    canExpand ? 'is-overflowing' : '',
    expanded ? 'is-expanded' : '',
  ].filter(Boolean).join(' ');
  const visibleVariables = expanded
    ? variables
    : variables.slice(0, visibleVariableCount);
  const toggleLabel = expanded ? '접기' : '더보기';

  const handleToggleExpanded = (interactionEvent) => {
    interactionEvent.stopPropagation();
    setExpanded((current) => !current);
  };

  return (
    <span
      aria-label={`사용중 변수 ${formatPublEventNumber(variables.length)}개: ${variableSummary}`}
      className={cellClassName}
      ref={cellRef}
      title={variableSummary}
    >
      <span className="publ-event-variable-list">
        {visibleVariables.map((variable) => (
          <span
            className={`publ-event-variable-chip ${variable.required ? 'is-required' : ''}`}
            key={variable.key}
            title={variable.required ? `${variable.displayName} 필수` : variable.displayName}
          >
            <span className="publ-event-variable-chip-label" translate="no">{variable.displayName}</span>
            {variable.required ? (
              <span aria-label="필수" className="publ-event-variable-required">*</span>
            ) : null}
          </span>
        ))}
        {canExpand ? (
          <button
            aria-expanded={expanded}
            className="publ-event-variable-more"
            onClick={handleToggleExpanded}
            type="button"
          >
            {toggleLabel}
          </button>
        ) : null}
      </span>
      <span aria-hidden="true" className="publ-event-variable-measure" ref={measureRef}>
        {variables.map((variable) => (
          <span
            className={`publ-event-variable-chip ${variable.required ? 'is-required' : ''}`}
            data-publ-variable-measure="chip"
            key={variable.key}
          >
            <span className="publ-event-variable-chip-label" translate="no">{variable.displayName}</span>
            {variable.required ? (
              <span className="publ-event-variable-required">*</span>
            ) : null}
          </span>
        ))}
        <span className="publ-event-variable-more" data-publ-variable-measure="more">
          더보기
        </span>
      </span>
    </span>
  );
}

function PublEventAutomationCell({ error, loading, state }) {
  const resolvedState = getPublEventAutomationCellState({ error, loading, state });
  const hasSecondary = Boolean(resolvedState.secondary);

  return (
    <span className="publ-event-automation-cell">
      <span className={`publ-event-automation-chip is-${resolvedState.tone}`}>
        {resolvedState.label}
      </span>
      {hasSecondary ? (
        <span className="publ-event-automation-secondary" title={resolvedState.secondary}>
          {resolvedState.secondary}
        </span>
      ) : null}
    </span>
  );
}

function getPublEventUsedVariables(event) {
  const source = Array.isArray(event?.variableOptions)
    ? event.variableOptions
    : Array.isArray(event?.variablePreview)
      ? event.variablePreview
      : [];
  const seenKeys = new Set();
  const variables = [];

  source.forEach((variable, index) => {
    const alias = normalizePublEventVariableText(variable?.alias);
    const label = normalizePublEventVariableText(variable?.label);
    const displayName = alias || label;

    if (!displayName) return;

    const dedupeKey = `${alias || label}`.toLowerCase();

    if (seenKeys.has(dedupeKey)) return;

    seenKeys.add(dedupeKey);
    variables.push({
      displayName,
      key: `${dedupeKey}-${index}`,
      required: variable?.required === true,
    });
  });

  return variables;
}

function buildPublEventAutomationStateByEventKey(events, rules) {
  const eventKeyById = new Map();
  const eventKeys = new Set();
  const rulesByEventKey = new Map();

  events.forEach((event) => {
    const eventKey = normalizePublEventVariableText(event?.eventKey);

    if (!eventKey) return;

    eventKeys.add(eventKey);
    rulesByEventKey.set(eventKey, []);

    if (event?.id !== undefined && event?.id !== null) {
      eventKeyById.set(String(event.id), eventKey);
    }
  });

  rules.forEach((rule) => {
    const ruleEventId = rule?.eventDefinitionId === undefined || rule?.eventDefinitionId === null
      ? ''
      : String(rule.eventDefinitionId);
    const ruleEventKey = normalizePublEventVariableText(rule?.eventDefinition?.eventKey);
    const matchedEventKey = eventKeyById.get(ruleEventId) || (eventKeys.has(ruleEventKey) ? ruleEventKey : '');

    if (!matchedEventKey) return;

    rulesByEventKey.get(matchedEventKey)?.push(rule);
  });

  return new Map(
    Array.from(rulesByEventKey.entries()).map(([eventKey, eventRules]) => [
      eventKey,
      getPublEventAutomationState(eventRules),
    ])
  );
}

function getPublEventAutomationState(rules) {
  const connectedRules = rules.filter((rule) => rule?.status !== 'archived');
  const enabledRules = connectedRules.filter((rule) => rule?.status === 'enabled');

  if (enabledRules.length > 0) {
    const primaryRule = enabledRules[0];

    return {
      label: '활성화됨',
      secondary: getPublEventAutomationRuleSummary(primaryRule, enabledRules.length),
      sortRank: 0,
      tone: 'enabled',
    };
  }

  if (connectedRules.length > 0) {
    const primaryRule = connectedRules[0];

    return {
      label: '연결됨',
      secondary: getPublEventAutomationRuleSummary(primaryRule, connectedRules.length),
      sortRank: 1,
      tone: 'connected',
    };
  }

  return {
    label: '연결 없음',
    secondary: '',
    sortRank: 2,
    tone: 'none',
  };
}

function getPublEventAutomationCellState({ error, loading, state }) {
  if (loading) {
    return {
      label: '확인 중',
      secondary: '자동화 조회 중',
      tone: 'loading',
    };
  }

  if (error) {
    return {
      label: '확인 불가',
      secondary: '자동화 조회 실패',
      tone: 'unknown',
    };
  }

  return state ?? {
    label: '연결 없음',
    secondary: '',
    tone: 'none',
  };
}

function getPublEventAutomationRuleSummary(rule, count) {
  if (count > 1) {
    return `${formatPublEventNumber(count)}개 자동화`;
  }

  return normalizePublEventVariableText(rule?.name) || '자동화 1개';
}

function normalizePublEventVariableText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildPublEventDetailHref(eventKey) {
  return `/automations/publ-events/${encodeURIComponent(String(eventKey ?? ''))}`;
}

function formatPublEventNumber(value) {
  return Number(value ?? 0).toLocaleString('ko-KR');
}
