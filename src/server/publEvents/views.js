const DEFAULT_PUBL_EVENT_TYPE = 'publ-event';

export function toPublEventCatalogListView(events = []) {
  const summaries = normalizeArray(events).map(toPublEventSummary);
  const totals = summaries.reduce(
    (accumulator, event) => ({
      events: accumulator.events + 1,
      props: accumulator.props + event.propCount,
      enabledProps: accumulator.enabledProps + event.enabledPropCount,
      requiredProps: accumulator.requiredProps + event.requiredPropCount,
      parserPipelineProps: accumulator.parserPipelineProps + event.parserPipelinePropCount,
      parserSteps: accumulator.parserSteps + event.parserStepCount,
    }),
    {
      events: 0,
      props: 0,
      enabledProps: 0,
      requiredProps: 0,
      parserPipelineProps: 0,
      parserSteps: 0,
    }
  );

  return { events: summaries, totals };
}

export function toPublEventDetailView(event, props = event?.props) {
  const sortedProps = [...normalizeArray(props)].sort(comparePropSortOrder);
  const propStats = getPropStats(sortedProps);
  const variableOptions = sortedProps.filter((prop) => prop?.enabled === true).map(toVariableOption);

  return {
    id: event?.id ?? event?.eventKey ?? null,
    eventKey: event?.eventKey ?? '',
    eventType: event?.eventType ?? DEFAULT_PUBL_EVENT_TYPE,
    displayName: event?.displayName ?? event?.eventKey ?? '',
    serviceStatus: event?.serviceStatus ?? null,
    locationType: event?.locationType ?? null,
    locationId: event?.locationId ?? null,
    sourceType: event?.sourceType ?? null,
    actionType: event?.actionType ?? null,
    updatedAt: toIsoString(event?.updatedAt),
    propCount: propStats.propCount,
    enabledPropCount: propStats.enabledPropCount,
    requiredPropCount: propStats.requiredPropCount,
    parserPipelinePropCount: propStats.parserPipelinePropCount,
    parserStepCount: propStats.parserStepCount,
    variableOptions,
    props: sortedProps.map(toDetailProp),
  };
}

function toPublEventSummary(event) {
  const props = [...normalizeArray(event?.props)].sort(comparePropSortOrder);
  const propStats = getPropStats(props);

  return {
    id: event?.id ?? event?.eventKey ?? null,
    eventKey: event?.eventKey ?? '',
    eventType: event?.eventType ?? DEFAULT_PUBL_EVENT_TYPE,
    displayName: event?.displayName ?? event?.eventKey ?? '',
    serviceStatus: event?.serviceStatus ?? null,
    locationType: event?.locationType ?? null,
    locationId: event?.locationId ?? null,
    sourceType: event?.sourceType ?? null,
    actionType: event?.actionType ?? null,
    updatedAt: toIsoString(event?.updatedAt),
    propCount: propStats.propCount,
    enabledPropCount: propStats.enabledPropCount,
    requiredPropCount: propStats.requiredPropCount,
    parserPipelinePropCount: propStats.parserPipelinePropCount,
    parserStepCount: propStats.parserStepCount,
    variableOptions: props.filter((prop) => prop?.enabled === true).map(toVariableOption),
    variablePreview: props.filter((prop) => prop?.enabled === true).slice(0, 4).map(toVariablePreview),
  };
}

function getPropStats(props) {
  return props.reduce(
    (accumulator, prop) => {
      const parserPipeline = normalizeArray(prop?.parserPipeline ?? prop?.parserPipelineJson);

      return {
        propCount: accumulator.propCount + 1,
        enabledPropCount: accumulator.enabledPropCount + (prop?.enabled === true ? 1 : 0),
        requiredPropCount: accumulator.requiredPropCount + (prop?.required === true ? 1 : 0),
        parserPipelinePropCount: accumulator.parserPipelinePropCount + (parserPipeline.length > 0 ? 1 : 0),
        parserStepCount: accumulator.parserStepCount + parserPipeline.length,
      };
    },
    {
      propCount: 0,
      enabledPropCount: 0,
      requiredPropCount: 0,
      parserPipelinePropCount: 0,
      parserStepCount: 0,
    }
  );
}

function toVariablePreview(prop) {
  return {
    alias: prop?.alias ?? '',
    label: prop?.label ?? '',
    type: prop?.type ?? prop?.propType ?? null,
  };
}

function toVariableOption(prop) {
  return {
    alias: prop?.alias ?? '',
    label: prop?.label ?? '',
    required: prop?.required === true,
    type: prop?.type ?? prop?.propType ?? null,
  };
}

function toDetailProp(prop) {
  return {
    sortOrder: toSortOrder(prop?.sortOrder),
    rawPath: prop?.rawPath ?? '',
    alias: prop?.alias ?? '',
    label: prop?.label ?? '',
    type: prop?.type ?? prop?.propType ?? null,
    required: prop?.required === true,
    enabled: prop?.enabled === true,
    fallback: prop?.fallback ?? null,
    sample: prop?.sample ?? null,
    parserPipeline: normalizeArray(prop?.parserPipeline ?? prop?.parserPipelineJson),
    description: prop?.description ?? null,
  };
}

function comparePropSortOrder(left, right) {
  const leftOrder = toSortOrder(left?.sortOrder);
  const rightOrder = toSortOrder(right?.sortOrder);

  if (leftOrder !== rightOrder) return leftOrder - rightOrder;

  return String(left?.alias ?? '').localeCompare(String(right?.alias ?? ''));
}

function toSortOrder(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : Number.MAX_SAFE_INTEGER;
}

function toIsoString(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}
