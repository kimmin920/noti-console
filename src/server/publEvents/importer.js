const PUBL_EVENT_TYPE = 'publ-event';

export function parsePublEventCatalogSource(input, { sourceLabel = 'PUBL event catalog source' } = {}) {
  const data = parseSourceInput(input, sourceLabel);

  if (!Array.isArray(data?.events)) {
    throw new Error(`${sourceLabel} must contain an events array.`);
  }

  const seenEventKeys = new Set();
  const events = data.events.map((event, eventIndex) => {
    const eventKey = readRequiredString(event, 'eventKey', `events[${eventIndex}]`);

    if (seenEventKeys.has(eventKey)) {
      throw new Error(`${sourceLabel} contains duplicate eventKey ${JSON.stringify(eventKey)}.`);
    }

    seenEventKeys.add(eventKey);

    if (!Array.isArray(event?.props)) {
      throw new Error(`${eventKey} must contain a props array.`);
    }

    return {
      eventKey,
      eventType: PUBL_EVENT_TYPE,
      displayName: readOptionalString(event, 'displayName'),
      serviceStatus: readOptionalString(event, 'serviceStatus'),
      locationType: readOptionalString(event, 'locationType'),
      locationId: readOptionalString(event, 'locationId'),
      sourceType: readOptionalString(event, 'sourceType'),
      actionType: readOptionalString(event, 'actionType'),
      props: normalizeProps(event.props, eventKey),
    };
  });

  return {
    eventType: PUBL_EVENT_TYPE,
    events,
    counts: getPublEventCatalogCounts({ events }),
  };
}

export function countPublEventCatalogSource(input, options) {
  return parsePublEventCatalogSource(input, options).counts;
}

export function getPublEventCatalogCounts(catalog) {
  const events = Array.isArray(catalog?.events) ? catalog.events : [];
  let propCount = 0;
  let enabledPropCount = 0;
  let requiredPropCount = 0;
  let parserStepCount = 0;

  for (const event of events) {
    const props = Array.isArray(event?.props) ? event.props : [];
    propCount += props.length;

    for (const prop of props) {
      if (prop.enabled === true) enabledPropCount += 1;
      if (prop.required === true) requiredPropCount += 1;
      if (Array.isArray(prop.parserPipeline)) parserStepCount += prop.parserPipeline.length;
    }
  }

  return {
    events: events.length,
    props: propCount,
    enabledProps: enabledPropCount,
    requiredProps: requiredPropCount,
    parserSteps: parserStepCount,
  };
}

function normalizeProps(props, eventKey) {
  const seenAliases = new Set();
  const seenSortOrders = new Set();

  return props.map((prop, propIndex) => {
    const label = `${eventKey}.props[${propIndex}]`;
    const alias = readRequiredString(prop, 'alias', label);
    const sortOrder = readRequiredInteger(prop, 'sortOrder', label);

    if (seenAliases.has(alias)) {
      throw new Error(`${eventKey} contains duplicate prop alias ${JSON.stringify(alias)}.`);
    }

    if (seenSortOrders.has(sortOrder)) {
      throw new Error(`${eventKey} contains duplicate prop sortOrder ${sortOrder}.`);
    }

    seenAliases.add(alias);
    seenSortOrders.add(sortOrder);

    return {
      sortOrder,
      rawPath: readRequiredString(prop, 'rawPath', label),
      alias,
      label: readRequiredString(prop, 'label', label),
      type: readRequiredString(prop, 'type', label),
      required: readRequiredBoolean(prop, 'required', label),
      enabled: readRequiredBoolean(prop, 'enabled', label),
      fallback: readOptionalString(prop, 'fallback'),
      sample: readOptionalString(prop, 'sample'),
      parserPipeline: normalizeParserPipeline(prop.parserPipeline, label),
      description: readOptionalString(prop, 'description'),
    };
  });
}

function parseSourceInput(input, sourceLabel) {
  if (typeof input !== 'string') return input;

  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error(`${sourceLabel} is not valid JSON: ${error.message}`);
  }
}

function normalizeParserPipeline(value, label) {
  if (value == null) return null;

  if (!Array.isArray(value)) {
    throw new Error(`${label}.parserPipeline must be an array or null.`);
  }

  return cloneJson(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function readRequiredString(object, key, label) {
  const value = object?.[key];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label}.${key} must be a non-empty string.`);
  }

  return value;
}

function readOptionalString(object, key) {
  const value = object?.[key];

  if (value == null) return null;
  if (typeof value !== 'string') return String(value);

  return value;
}

function readRequiredBoolean(object, key, label) {
  const value = object?.[key];

  if (typeof value !== 'boolean') {
    throw new Error(`${label}.${key} must be boolean.`);
  }

  return value;
}

function readRequiredInteger(object, key, label) {
  const value = object?.[key];

  if (!Number.isInteger(value)) {
    throw new Error(`${label}.${key} must be an integer.`);
  }

  return value;
}
