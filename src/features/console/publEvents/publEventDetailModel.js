export const PUBL_EVENT_VARIABLE_FILTERS = Object.freeze([
  { label: '전체', value: 'all' },
  { label: '사용', value: 'enabled' },
  { label: '필수', value: 'required' },
  { label: '포맷', value: 'transformed' },
]);

const NO_VALUE_LABEL = '값 없음';
const FORMAT_STEP_LABELS = Object.freeze({
  currencyFormat: '금액 표시',
  dateFormat: '날짜 표시',
  fallback: '중간 결과가 비면 대체값',
  firstItem: '첫 번째 값만 사용',
  join: '여러 값을 합치기',
  mapTemplate: '항목 문구 만들기',
  none: '가공 없음',
  phoneFormat: '전화번호 표시',
  replace: '문구 바꾸기',
  truncate: '글자 수 자르기',
});

export function normalizePublEventDetail(detail) {
  const props = normalizeArray(detail?.props).map(normalizeProp);

  return {
    id: detail?.id ?? detail?.eventKey ?? null,
    eventKey: detail?.eventKey ?? '',
    displayName: detail?.displayName ?? detail?.eventKey ?? '',
    locationType: detail?.locationType ?? '',
    locationId: detail?.locationId ?? '',
    sourceType: detail?.sourceType ?? '',
    actionType: detail?.actionType ?? '',
    updatedAt: detail?.updatedAt ?? null,
    propCount: toNumber(detail?.propCount, props.length),
    enabledPropCount: toNumber(detail?.enabledPropCount, props.filter((prop) => prop.enabled).length),
    requiredPropCount: toNumber(detail?.requiredPropCount, props.filter((prop) => prop.required).length),
    parserPipelinePropCount: toNumber(
      detail?.parserPipelinePropCount,
      props.filter((prop) => prop.parserPipeline.length > 0).length
    ),
    parserStepCount: toNumber(
      detail?.parserStepCount,
      props.reduce((total, prop) => total + prop.parserPipeline.length, 0)
    ),
    props,
  };
}

export function getFilteredPublEventVariables({ detail, filter, query }) {
  const normalizedQuery = String(query ?? '').trim().toLowerCase();

  return normalizeArray(detail?.props)
    .filter((prop) => matchesFilter(prop, filter) && matchesSearch(prop, normalizedQuery))
    .sort(compareVariablePriority);
}

export function buildPublEventSummaryItems(detail) {
  return [
    { label: 'Location', value: detail.locationId || NO_VALUE_LABEL, mono: Boolean(detail.locationId) },
    { label: 'Location type', value: detail.locationType || NO_VALUE_LABEL },
    { label: 'Source / action', value: joinValues(detail.sourceType, detail.actionType) || NO_VALUE_LABEL },
    { label: 'Variables', value: `${detail.enabledPropCount} used / ${detail.propCount} total` },
  ];
}

export function formatParserStep(step) {
  const type = getParserStepType(step);
  const entries = Object.entries(step ?? {}).filter(([key]) => key !== 'type');

  return {
    detail: entries.length ? entries.map(([key, value]) => `${key}: ${formatStepValue(value)}`).join(', ') : '',
    label: FORMAT_STEP_LABELS[type] ?? type,
    type,
  };
}

export function getParserFormatLabel(parserPipeline) {
  const step = normalizeArray(parserPipeline).find((parserStep) => getParserStepType(parserStep) !== 'none');
  return step ? formatParserStep(step).label : '';
}

function normalizeProp(prop) {
  const parserPipeline = normalizeArray(prop?.parserPipeline);

  return {
    sortOrder: toNumber(prop?.sortOrder, 0),
    rawPath: prop?.rawPath ?? '',
    alias: prop?.alias ?? '',
    label: prop?.label ?? '',
    type: prop?.type ?? '',
    required: prop?.required === true,
    enabled: prop?.enabled === true,
    fallback: prop?.fallback ?? '',
    sample: prop?.sample ?? '',
    parserPipeline,
    description: prop?.description ?? '',
  };
}

function matchesFilter(prop, filter) {
  switch (filter) {
    case 'enabled':
      return prop.enabled;
    case 'required':
      return prop.required;
    case 'transformed':
      return Boolean(getParserFormatLabel(prop.parserPipeline));
    default:
      return true;
  }
}

function matchesSearch(prop, normalizedQuery) {
  if (!normalizedQuery) return true;

  return [prop.label, prop.alias].some((value) => (
    String(value ?? '').toLowerCase().includes(normalizedQuery)
  ));
}

function compareVariablePriority(left, right) {
  const rankDifference = getVariablePriorityRank(left) - getVariablePriorityRank(right);
  if (rankDifference !== 0) return rankDifference;

  return left.sortOrder - right.sortOrder;
}

function getVariablePriorityRank(prop) {
  if (prop.required && prop.enabled) return 0;
  if (prop.required) return 1;
  if (prop.enabled) return 2;
  return 3;
}

function getParserStepType(step) {
  return String(step?.type ?? 'none');
}

function formatStepValue(value) {
  if (value == null || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function joinValues(...values) {
  return values
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' / ');
}

function toNumber(value, fallback) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}
