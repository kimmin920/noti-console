import { getDb } from '../../db/client.js';
import { RELAY_ERROR_CODES } from '../relay/constants.js';
import { RelayError, RelayValidationError } from '../relay/errors.js';
import { createPublEventCatalogRepository } from './repository.js';

const DEFAULT_TIME_ZONE = 'Asia/Seoul';
const SUPPORTED_DATE_FORMAT = 'yyyy년 M월 d일 HH:mm';
const STALE_PUBL_EVENT_EDITOR_DRAFT = 'STALE_PUBL_EVENT_EDITOR_DRAFT';
const EVENT_EDITOR_FIELDS = new Set([
  'eventKey',
  'displayName',
  'locationType',
  'locationId',
  'sourceType',
  'actionType',
]);
const CREATE_EVENT_TOP_LEVEL_FIELDS = new Set(['event', 'props']);
const CREATE_EVENT_FIELDS = new Set([
  'eventKey',
  'displayName',
  'locationType',
  'locationId',
  'sourceType',
  'actionType',
]);
const TOP_LEVEL_EDITOR_FIELDS = new Set([
  'baseUpdatedAt',
  'event',
  'props',
  'deletedAliases',
  'dangerousChangeConfirmations',
]);
const PROP_EDITOR_FIELDS = new Set([
  'originalAlias',
  'rawPath',
  'alias',
  'label',
  'type',
  'required',
  'enabled',
  'fallback',
  'sample',
  'parserPipeline',
  'description',
  'sortOrder',
]);
const CREATE_PROP_FIELDS = new Set([
  'rawPath',
  'alias',
  'label',
  'type',
  'required',
  'enabled',
  'fallback',
  'sample',
  'parserPipeline',
  'description',
]);
const DELETE_ALIAS_FIELDS = new Set(['originalAlias', 'confirmation']);
const DELETE_EVENT_FIELDS = new Set(['eventKey', 'confirmation']);
const DANGEROUS_CONFIRMATION_FIELDS = new Set(['originalAlias', 'from', 'to', 'confirmation']);
const PROP_TYPES = new Set(['text', 'number', 'datetime', 'boolean', 'enum', 'object', 'array']);
const EVENT_KEY_PATTERN = /^[A-Za-z0-9_.:-]+$/;
const FORMAT_STEP_TYPES = new Set([
  'none',
  'fallback',
  'firstItem',
  'mapTemplate',
  'join',
  'dateFormat',
  'currencyFormat',
  'phoneFormat',
  'truncate',
  'replace',
]);

export function createDefaultPublEventEditorService() {
  return createPublEventEditorService({
    repository: createPublEventCatalogRepository(getDb()),
  });
}

export function createPublEventEditorService({ repository, now = () => new Date() } = {}) {
  return {
    async createPublEventDefinition({ actor, payload }) {
      requirePublEventEditorPermission(actor);

      const draft = normalizeNewPublEventPayload(payload);
      const existingEvent = await repository.findEventByKey(draft.event.eventKey);
      if (existingEvent) {
        throw new RelayError({
          code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
          message: 'PUBL eventKey already exists.',
          retryable: false,
          status: 409,
        });
      }

      return repository.createEventDefinition({
        event: draft.event,
        props: draft.props,
        now: now(),
      });
    },

    async savePublEventEditorDraft({ actor, eventKey, payload }) {
      requirePublEventEditorPermission(actor);

      const existingEvent = await repository.findEventByKey(eventKey);
      if (!existingEvent) {
        throw new RelayError({
          code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
          message: 'PUBL event was not found.',
          retryable: false,
          status: 404,
        });
      }

      const existingProps = await repository.listPropsByEventId(existingEvent.id);
      const draft = normalizePublEventEditorPayload({
        payload,
        eventKey,
        existingEvent,
        existingProps,
      });

      return repository.updateEventEditorDraft({
        eventKey,
        event: draft.event,
        props: draft.props,
        deletedAliases: draft.deletedAliases,
        now: now(),
      });
    },

    async deletePublEventDefinition({ actor, eventKey, payload }) {
      requirePublEventEditorPermission(actor);

      const routeEventKey = normalizeRequiredString(eventKey, 'eventKey');
      const existingEvent = await repository.findEventByKey(routeEventKey);
      if (!existingEvent) {
        throw new RelayError({
          code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
          message: 'PUBL event was not found.',
          retryable: false,
          status: 404,
        });
      }

      normalizeDeletePublEventPayload(payload, routeEventKey);

      const connections = await repository.countEventConnections(existingEvent.id);
      const connectionCount = connections.automationRules + connections.deliveries;
      if (connectionCount > 0) {
        throw new RelayError({
          code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
          message: 'Connected automations or delivery history exist. Disconnect them before deleting this PUBL event.',
          retryable: false,
          status: 409,
        });
      }

      const deletedEvent = await repository.deleteEventDefinition({ eventKey: routeEventKey });

      return {
        deleted: true,
        event: deletedEvent ?? existingEvent,
        eventKey: routeEventKey,
      };
    },
  };
}

export function requirePublEventEditorPermission(actor) {
  if (actor?.user?.isOperator === true) {
    return actor.user;
  }

  throw new RelayError({
    code: RELAY_ERROR_CODES.FORBIDDEN,
    message: 'Operator permission is required.',
    retryable: false,
    status: 403,
  });
}

function normalizePublEventEditorPayload({ payload, eventKey, existingEvent, existingProps }) {
  if (!isPlainObject(payload)) {
    throw new RelayValidationError('Request body must be an object.');
  }

  rejectUnsupportedFields(payload, TOP_LEVEL_EDITOR_FIELDS, 'payload');

  const baseUpdatedAt = normalizeRequiredDateString(payload.baseUpdatedAt, 'baseUpdatedAt');
  const currentUpdatedAt = normalizeDateString(existingEvent.updatedAt);
  if (!currentUpdatedAt || baseUpdatedAt !== currentUpdatedAt) {
    throw new RelayError({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      message: 'PUBL event editor draft is stale.',
      retryable: false,
      status: 409,
      state: STALE_PUBL_EVENT_EDITOR_DRAFT,
    });
  }

  if (!isPlainObject(payload.event)) {
    throw new RelayValidationError('event object is required.');
  }
  rejectUnsupportedFields(payload.event, EVENT_EDITOR_FIELDS, 'event');

  if (payload.event.eventKey !== eventKey) {
    throw new RelayValidationError('eventKey is immutable and cannot be changed.');
  }

  const event = normalizeEditorEvent(payload.event, eventKey);

  if (!Array.isArray(payload.props)) {
    throw new RelayValidationError('props array is required.');
  }

  const deletedAliases = normalizeDeletedAliases(payload.deletedAliases ?? []);
  const dangerousChangeConfirmations = normalizeDangerousChangeConfirmations(
    payload.dangerousChangeConfirmations ?? {}
  );
  const props = normalizeEditorProps(payload.props);

  validateFullReplacementProps({
    existingProps,
    props,
    deletedAliases,
    dangerousChangeConfirmations,
  });
  validateVariableKeyCollisions(props);

  return {
    event,
    props,
    deletedAliases,
  };
}

function normalizeEditorEvent(event, eventKey) {
  if (event.eventKey !== eventKey) {
    throw new RelayValidationError('eventKey is immutable and must match the route eventKey.');
  }

  const bodyEventKey = normalizeRequiredString(event.eventKey, 'event.eventKey');

  if (bodyEventKey !== eventKey) {
    throw new RelayValidationError('eventKey is immutable and must match the route eventKey.');
  }

  return {
    eventKey: bodyEventKey,
    displayName: normalizeNullableString(event.displayName, 'event.displayName'),
    locationType: normalizeNullableString(event.locationType, 'event.locationType'),
    locationId: normalizeNullableString(event.locationId, 'event.locationId'),
    sourceType: normalizeNullableString(event.sourceType, 'event.sourceType'),
    actionType: normalizeNullableString(event.actionType, 'event.actionType'),
  };
}

function normalizeNewPublEventPayload(payload) {
  if (!isPlainObject(payload)) {
    throw new RelayValidationError('Request body must be an object.');
  }

  rejectUnsupportedFields(payload, CREATE_EVENT_TOP_LEVEL_FIELDS, 'payload');

  if (!isPlainObject(payload.event)) {
    throw new RelayValidationError('event object is required.');
  }

  rejectUnsupportedFields(payload.event, CREATE_EVENT_FIELDS, 'event');

  const eventKey = normalizeCreateString(payload.event.eventKey, 'event.eventKey', 160, { required: true });
  if (!EVENT_KEY_PATTERN.test(eventKey)) {
    throw new RelayValidationError('event.eventKey must use letters, numbers, _, ., :, or - only.');
  }

  const displayName = normalizeCreateString(payload.event.displayName, 'event.displayName', 160) || eventKey;

  return {
    event: {
      eventKey,
      displayName,
      serviceStatus: null,
      locationType: normalizeCreateString(payload.event.locationType, 'event.locationType', 80),
      locationId: normalizeCreateString(payload.event.locationId, 'event.locationId', 80),
      sourceType: normalizeCreateString(payload.event.sourceType, 'event.sourceType', 80),
      actionType: normalizeCreateString(payload.event.actionType, 'event.actionType', 80),
    },
    props: normalizeNewPublEventProps(payload.props, eventKey),
  };
}

function normalizeNewPublEventProps(props, eventKey) {
  if (props === undefined) {
    return createDefaultPublEventProps(eventKey);
  }

  if (!Array.isArray(props)) {
    throw new RelayValidationError('props must be an array.');
  }

  if (props.length === 0) {
    throw new RelayValidationError('props must contain at least one variable.');
  }

  const normalized = props.map((prop, index) => normalizeNewPublEventProp(prop, index, eventKey));
  validateVariableKeyCollisions(normalized);
  return normalized;
}

function normalizeDeletePublEventPayload(payload, routeEventKey) {
  if (!isPlainObject(payload)) {
    throw new RelayValidationError('Request body must be an object.');
  }

  rejectUnsupportedFields(payload, DELETE_EVENT_FIELDS, 'payload');

  const payloadEventKey = normalizeRequiredString(payload.eventKey, 'eventKey');
  if (payloadEventKey !== routeEventKey) {
    throw new RelayValidationError('eventKey confirmation must match the route eventKey.');
  }

  if (payload.confirmation !== 'DELETE_EVENT') {
    throw new RelayValidationError('confirmation must be DELETE_EVENT.');
  }
}

function normalizeNewPublEventProp(prop, index, eventKey) {
  if (!isPlainObject(prop)) {
    throw new RelayValidationError(`props[${index}] must be an object.`);
  }

  rejectUnsupportedFields(prop, CREATE_PROP_FIELDS, `props[${index}]`);

  const type = normalizeCreateString(prop.type, `props[${index}].type`, 40, { required: true });
  if (!PROP_TYPES.has(type)) {
    throw new RelayValidationError(
      `props[${index}].type must be text, number, datetime, boolean, enum, object, or array.`
    );
  }

  if (typeof prop.required !== 'boolean') {
    throw new RelayValidationError(`props[${index}].required must be a boolean.`);
  }

  if (typeof prop.enabled !== 'boolean') {
    throw new RelayValidationError(`props[${index}].enabled must be a boolean.`);
  }

  const alias = normalizeCreateString(prop.alias, `props[${index}].alias`, 120, { required: true });
  const sample = normalizeCreateString(prop.sample, `props[${index}].sample`, 400);

  return {
    sortOrder: index,
    rawPath: normalizeCreateString(prop.rawPath, `props[${index}].rawPath`, 240, { required: true }),
    alias,
    label: normalizeCreateString(prop.label, `props[${index}].label`, 160, { required: true }),
    type,
    required: prop.required,
    enabled: prop.enabled,
    fallback: normalizeCreateString(prop.fallback, `props[${index}].fallback`, 400),
    sample: alias === 'eventKey' && sample == null ? eventKey : sample,
    parserPipeline: normalizeParserPipeline(prop.parserPipeline, `props[${index}].parserPipeline`),
    description: normalizeCreateString(prop.description, `props[${index}].description`, 400),
  };
}

export function createDefaultPublEventProps(eventKey) {
  return [
    {
      sortOrder: 0,
      rawPath: 'targetPhoneNumber',
      alias: 'targetPhoneNumber',
      label: '수신자 전화번호',
      type: 'text',
      required: true,
      enabled: true,
      fallback: null,
      sample: '010-1234-1234',
      parserPipeline: null,
      description: '자동화 발송 수신자 번호입니다.',
    },
    {
      sortOrder: 1,
      rawPath: 'eventKey',
      alias: 'eventKey',
      label: '이벤트 키',
      type: 'text',
      required: true,
      enabled: true,
      fallback: null,
      sample: eventKey,
      parserPipeline: null,
      description: 'PUBL 이벤트를 식별하는 키입니다.',
    },
    {
      sortOrder: 2,
      rawPath: 'channelCode',
      alias: 'channelCode',
      label: '채널 코드',
      type: 'text',
      required: true,
      enabled: true,
      fallback: null,
      sample: null,
      parserPipeline: null,
      description: 'PUBL 채널 매핑에 사용하는 채널 코드입니다.',
    },
  ];
}

function normalizeEditorProps(props) {
  const seenOriginalAliases = new Set();

  return props.map((prop, index) => {
    if (!isPlainObject(prop)) {
      throw new RelayValidationError(`props[${index}] must be an object.`);
    }

    rejectUnsupportedFields(prop, PROP_EDITOR_FIELDS, `props[${index}]`);

    if (!Object.prototype.hasOwnProperty.call(prop, 'originalAlias')) {
      throw new RelayValidationError(`props[${index}].originalAlias is required.`);
    }

    const originalAlias = prop.originalAlias === null
      ? null
      : normalizeRequiredString(prop.originalAlias, `props[${index}].originalAlias`);

    if (originalAlias !== null) {
      if (seenOriginalAliases.has(originalAlias)) {
        throw new RelayValidationError(`Duplicate originalAlias: ${originalAlias}.`);
      }
      seenOriginalAliases.add(originalAlias);
    }

    const type = normalizeRequiredString(prop.type, `props[${index}].type`);
    if (!PROP_TYPES.has(type)) {
      throw new RelayValidationError(
        `props[${index}].type must be text, number, datetime, boolean, enum, object, or array.`
      );
    }

    if (typeof prop.required !== 'boolean') {
      throw new RelayValidationError(`props[${index}].required must be a boolean.`);
    }

    if (typeof prop.enabled !== 'boolean') {
      throw new RelayValidationError(`props[${index}].enabled must be a boolean.`);
    }

    return {
      originalAlias,
      rawPath: normalizeRequiredString(prop.rawPath, `props[${index}].rawPath`),
      alias: normalizeRequiredString(prop.alias, `props[${index}].alias`),
      label: normalizeRequiredString(prop.label, `props[${index}].label`),
      type,
      required: prop.required,
      enabled: prop.enabled,
      fallback: normalizeNullableString(prop.fallback, `props[${index}].fallback`),
      sample: normalizeNullableString(prop.sample, `props[${index}].sample`),
      parserPipeline: normalizeParserPipeline(prop.parserPipeline, `props[${index}].parserPipeline`),
      description: normalizeNullableString(prop.description, `props[${index}].description`),
      sortOrder: index,
    };
  });
}

function normalizeDeletedAliases(deletedAliases) {
  if (!Array.isArray(deletedAliases)) {
    throw new RelayValidationError('deletedAliases must be an array.');
  }

  const seenAliases = new Set();

  return deletedAliases.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new RelayValidationError(`deletedAliases[${index}] must be an object.`);
    }

    rejectUnsupportedFields(entry, DELETE_ALIAS_FIELDS, `deletedAliases[${index}]`);

    const originalAlias = normalizeRequiredString(
      entry.originalAlias,
      `deletedAliases[${index}].originalAlias`
    );

    if (seenAliases.has(originalAlias)) {
      throw new RelayValidationError(`Duplicate deleted alias: ${originalAlias}.`);
    }
    seenAliases.add(originalAlias);

    if (entry.confirmation !== 'DELETE_PROP') {
      throw new RelayValidationError(`deletedAliases[${index}].confirmation must be DELETE_PROP.`);
    }

    return { originalAlias, confirmation: 'DELETE_PROP' };
  });
}

function normalizeDangerousChangeConfirmations(confirmations) {
  if (!isPlainObject(confirmations)) {
    throw new RelayValidationError('dangerousChangeConfirmations must be an object.');
  }

  rejectUnsupportedFields(confirmations, new Set(['rawPath', 'alias']), 'dangerousChangeConfirmations');

  return {
    rawPath: normalizeDangerousConfirmationList(confirmations.rawPath ?? [], 'rawPath', 'CHANGE_RAW_PATH'),
    alias: normalizeDangerousConfirmationList(confirmations.alias ?? [], 'alias', 'CHANGE_ALIAS'),
  };
}

function normalizeDangerousConfirmationList(entries, key, expectedConfirmation) {
  if (!Array.isArray(entries)) {
    throw new RelayValidationError(`dangerousChangeConfirmations.${key} must be an array.`);
  }

  return entries.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new RelayValidationError(`dangerousChangeConfirmations.${key}[${index}] must be an object.`);
    }

    rejectUnsupportedFields(
      entry,
      DANGEROUS_CONFIRMATION_FIELDS,
      `dangerousChangeConfirmations.${key}[${index}]`
    );

    if (entry.confirmation !== expectedConfirmation) {
      throw new RelayValidationError(
        `dangerousChangeConfirmations.${key}[${index}].confirmation must be ${expectedConfirmation}.`
      );
    }

    return {
      originalAlias: normalizeRequiredString(
        entry.originalAlias,
        `dangerousChangeConfirmations.${key}[${index}].originalAlias`
      ),
      from: normalizeRequiredString(entry.from, `dangerousChangeConfirmations.${key}[${index}].from`),
      to: normalizeRequiredString(entry.to, `dangerousChangeConfirmations.${key}[${index}].to`),
      confirmation: expectedConfirmation,
    };
  });
}

function validateFullReplacementProps({ existingProps, props, deletedAliases, dangerousChangeConfirmations }) {
  const existingByAlias = new Map(existingProps.map((prop) => [prop.alias, prop]));
  const deletedByAlias = new Map(deletedAliases.map((entry) => [entry.originalAlias, entry]));
  const submittedExistingAliases = new Set();

  for (const prop of props) {
    if (prop.originalAlias === null) continue;

    const existing = existingByAlias.get(prop.originalAlias);
    if (!existing) {
      throw new RelayValidationError(`Unknown originalAlias: ${prop.originalAlias}.`);
    }

    if (deletedByAlias.has(prop.originalAlias)) {
      throw new RelayValidationError(`originalAlias ${prop.originalAlias} cannot be both saved and deleted.`);
    }

    submittedExistingAliases.add(prop.originalAlias);
    validateDangerousPropChanges({
      existing,
      prop,
      dangerousChangeConfirmations,
    });
  }

  for (const deletedAlias of deletedByAlias.keys()) {
    if (!existingByAlias.has(deletedAlias)) {
      throw new RelayValidationError(`Unknown deleted originalAlias: ${deletedAlias}.`);
    }
  }

  for (const existingAlias of existingByAlias.keys()) {
    if (!submittedExistingAliases.has(existingAlias) && !deletedByAlias.has(existingAlias)) {
      throw new RelayValidationError(`Omitted existing prop ${existingAlias} requires a DELETE_PROP confirmation.`);
    }
  }
}

function validateDangerousPropChanges({ existing, prop, dangerousChangeConfirmations }) {
  if (existing.rawPath !== prop.rawPath) {
    requireDangerousConfirmation({
      entries: dangerousChangeConfirmations.rawPath,
      originalAlias: prop.originalAlias,
      from: existing.rawPath,
      to: prop.rawPath,
      description: 'rawPath',
    });
  }

  if (existing.alias !== prop.alias) {
    requireDangerousConfirmation({
      entries: dangerousChangeConfirmations.alias,
      originalAlias: prop.originalAlias,
      from: existing.alias,
      to: prop.alias,
      description: 'alias',
    });
  }
}

function requireDangerousConfirmation({ entries, originalAlias, from, to, description }) {
  const matchingEntry = entries.find((entry) => (
    entry.originalAlias === originalAlias &&
    entry.from === from &&
    entry.to === to
  ));

  if (!matchingEntry) {
    throw new RelayValidationError(`${description} change for ${originalAlias} requires unlock confirmation.`);
  }
}

function validateVariableKeyCollisions(props) {
  const aliasIndexes = new Map();
  const labelKeyIndexes = new Map();

  props.forEach((prop, index) => {
    if (aliasIndexes.has(prop.alias)) {
      throw new RelayValidationError(`Duplicate alias variable key: ${prop.alias}.`);
    }
    aliasIndexes.set(prop.alias, index);

    for (const key of getPublEventLabelVariableKeys(prop.label)) {
      const ownerIndex = labelKeyIndexes.get(key);
      if (ownerIndex !== undefined && ownerIndex !== index) {
        throw new RelayValidationError(`Duplicate label-derived variable key: ${key}.`);
      }
      labelKeyIndexes.set(key, index);
    }
  });

  props.forEach((prop, index) => {
    const labelOwnerIndex = labelKeyIndexes.get(prop.alias);
    if (labelOwnerIndex !== undefined && labelOwnerIndex !== index) {
      throw new RelayValidationError(`Alias and label-derived variable key collision: ${prop.alias}.`);
    }
  });
}

function getPublEventLabelVariableKeys(label) {
  if (!isNonEmptyString(label)) return [];

  const keys = [label];
  const normalizedLabel = normalizeTemplateLabelKey(label);

  if (normalizedLabel && normalizedLabel !== label) {
    keys.push(normalizedLabel);
  }

  return keys;
}

function normalizeParserPipeline(parserPipeline, fieldName) {
  if (parserPipeline === undefined || parserPipeline === null) return null;

  if (!Array.isArray(parserPipeline)) {
    throw new RelayValidationError(`${fieldName} must be null or an array.`);
  }

  if (parserPipeline.length === 0) return null;

  const steps = parserPipeline.flatMap((step, index) => normalizeParserStep(step, `${fieldName}[${index}]`));
  return steps.length ? steps : null;
}

function normalizeParserStep(step, fieldName) {
  if (!isPlainObject(step)) {
    throw new RelayValidationError(`${fieldName} must be an object.`);
  }

  const type = normalizeRequiredString(step.type, `${fieldName}.type`);
  if (!FORMAT_STEP_TYPES.has(type)) {
    throw new RelayValidationError(`Unsupported parser pipeline step type: ${type}.`);
  }

  if (type === 'none') return [];

  return [{ ...step, type }];
}

export function resolvePublEventPayload(eventDefinition, payload) {
  const variables = {};
  const validationErrors = [];
  const props = normalizeProps(eventDefinition?.props);
  const sourcePayload = payload ?? {};

  for (const prop of props) {
    const rawLookup = readDotPath(sourcePayload, prop.rawPath);
    const rawMissing = !rawLookup.found || rawLookup.value == null;
    const fallback = prop.fallback ?? null;

    if (prop.enabled && prop.required && rawMissing && fallback == null) {
      validationErrors.push({
        alias: prop.alias,
        rawPath: prop.rawPath,
        reason: 'required',
      });
    }

    if (!prop.enabled) continue;

    const initialValue = rawMissing && fallback != null ? fallback : rawLookup.value;
    const resolvedValue = applyParserPipeline(initialValue, prop.parserPipeline, sourcePayload);

    for (const key of getPublEventVariableKeysForProp(prop)) {
      assignVariableKey({
        alias: prop.alias,
        key,
        value: resolvedValue,
        variables,
        validationErrors,
      });
    }
  }

  return { variables, validationErrors };
}

export function normalizeTemplateLabelKey(label) {
  if (typeof label !== 'string') return '';
  return label.replace(/\s+/g, '');
}

export function getPublEventVariableKeysForProp(prop) {
  const keys = [];

  if (isNonEmptyString(prop.alias)) keys.push(prop.alias);
  keys.push(...getPublEventLabelVariableKeys(prop.label));

  return keys;
}

function normalizeProps(props) {
  if (!Array.isArray(props)) return [];

  return props
    .map((prop, index) => ({
      alias: prop.alias,
      rawPath: prop.rawPath,
      label: prop.label,
      required: prop.required === true,
      enabled: prop.enabled === true,
      fallback: prop.fallback,
      parserPipeline: prop.parserPipeline ?? prop.parserPipelineJson ?? null,
      sortOrder: Number.isInteger(prop.sortOrder) ? prop.sortOrder : index,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function assignVariableKey({ alias, key, value, variables, validationErrors }) {
  if (!Object.prototype.hasOwnProperty.call(variables, key)) {
    variables[key] = value;
    return;
  }

  if (valuesEqual(variables[key], value)) return;

  validationErrors.push({
    alias,
    key,
    reason: 'variable_key_collision',
  });
}

function valuesEqual(left, right) {
  if (Object.is(left, right)) return true;

  if (left && right && typeof left === 'object' && typeof right === 'object') {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  return false;
}

function readDotPath(source, rawPath) {
  if (!isNonEmptyString(rawPath)) {
    return { found: false, value: undefined };
  }

  let current = source;

  for (const segment of rawPath.split('.')) {
    if (current == null || !Object.prototype.hasOwnProperty.call(Object(current), segment)) {
      return { found: false, value: undefined };
    }

    current = current[segment];
  }

  return { found: true, value: current };
}

function applyParserPipeline(value, parserPipeline, payload) {
  if (!Array.isArray(parserPipeline) || parserPipeline.length === 0) return value;

  return parserPipeline.reduce((currentValue, step) => applyParserStep(currentValue, step, payload), value);
}

function applyParserStep(value, step, payload) {
  switch (step?.type) {
    case 'fallback':
      return fallbackValue(value, step);
    case 'firstItem':
      return firstItemValue(value);
    case 'dateFormat':
      return formatDateValue(value, step);
    case 'currencyFormat':
      return formatCurrencyValue(value, step, payload);
    case 'phoneFormat':
      return formatPhoneValue(value);
    case 'truncate':
      return truncateValue(value, step);
    case 'replace':
      return replaceValue(value, step);
    case 'mapTemplate':
      return mapTemplateValue(value, step);
    case 'join':
      return joinValue(value, step);
    default:
      return value;
  }
}

function fallbackValue(value, step) {
  if (!isMissingParserValue(value)) return value;

  return step?.value ?? step?.fallback ?? step?.defaultValue ?? value;
}

function firstItemValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateValue(value, step) {
  if (value == null || value === '') return value;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const format = step?.format ?? SUPPORTED_DATE_FORMAT;
  if (format !== SUPPORTED_DATE_FORMAT) return value;

  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: step?.timezone || DEFAULT_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${Number(byType.year)}년 ${Number(byType.month)}월 ${Number(byType.day)}일 ${byType.hour}:${byType.minute}`;
}

function formatCurrencyValue(value, step, payload) {
  if (value == null || value === '') return value;

  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return value;

  const currencyLookup = readDotPath(payload, step?.currencyPath);
  const currency = step?.currency || currencyLookup.value || 'KRW';
  const locale = step?.locale || 'ko-KR';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'KRW' ? 0 : undefined,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat(locale).format(amount);
  }
}

function formatPhoneValue(value) {
  if (value == null || value === '') return value;

  const text = String(value).trim();
  const digits = text.replace(/\D/g, '');
  if (!digits) return value;

  const phoneDigits = digits.startsWith('82') && digits.length >= 11
    ? `0${digits.slice(2)}`
    : digits;

  if (phoneDigits.length === 11) {
    return `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3, 7)}-${phoneDigits.slice(7)}`;
  }

  if (phoneDigits.startsWith('02') && phoneDigits.length === 10) {
    return `${phoneDigits.slice(0, 2)}-${phoneDigits.slice(2, 6)}-${phoneDigits.slice(6)}`;
  }

  if (phoneDigits.startsWith('02') && phoneDigits.length === 9) {
    return `${phoneDigits.slice(0, 2)}-${phoneDigits.slice(2, 5)}-${phoneDigits.slice(5)}`;
  }

  if (phoneDigits.length === 10) {
    return `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`;
  }

  if (phoneDigits.length === 8) {
    return `${phoneDigits.slice(0, 4)}-${phoneDigits.slice(4)}`;
  }

  return text;
}

function truncateValue(value, step) {
  if (value == null || value === '') return value;

  const maxLength = Number(step?.maxLength ?? step?.length);
  if (!Number.isFinite(maxLength) || maxLength < 0) return value;

  return String(value).slice(0, maxLength);
}

function replaceValue(value, step) {
  if (value == null) return value;

  const from = typeof step?.from === 'string' ? step.from : '';
  if (!from) return value;

  return String(value).split(from).join(step?.to == null ? '' : String(step.to));
}

function mapTemplateValue(value, step) {
  if (!Array.isArray(value)) return value;

  const template = typeof step?.template === 'string' ? step.template : '';

  return value.map((item) =>
    template.replace(/#\{([^}]+)\}|\{\{([^}]+)\}\}/g, (_, hashPath, bracePath) => {
      const fieldPath = hashPath ?? bracePath;
      const lookup = readDotPath(item, fieldPath.trim());
      return lookup.value == null ? '' : String(lookup.value);
    })
  );
}

function joinValue(value, step) {
  if (!Array.isArray(value)) return value;

  return value.join(typeof step?.separator === 'string' ? step.separator : '');
}

function isMissingParserValue(value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function rejectUnsupportedFields(source, allowedFields, objectName) {
  for (const field of Object.keys(source)) {
    if (!allowedFields.has(field)) {
      throw new RelayValidationError(`${objectName}.${field} is not supported.`);
    }
  }
}

function normalizeRequiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RelayValidationError(`${name} is required.`);
  }

  return value.trim();
}

function normalizeNullableString(value, name) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new RelayValidationError(`${name} must be a string or null.`);
  }

  return value;
}

function normalizeCreateString(value, name, maxLength, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new RelayValidationError(`${name} is required.`);
    }

    return null;
  }

  if (typeof value !== 'string') {
    throw new RelayValidationError(`${name} must be a string or null.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    if (required) {
      throw new RelayValidationError(`${name} is required.`);
    }

    return null;
  }

  if (normalized.length > maxLength) {
    throw new RelayValidationError(`${name} must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

function normalizeRequiredDateString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RelayValidationError(`${name} is required.`);
  }

  const normalized = normalizeDateString(value);
  if (!normalized) {
    throw new RelayValidationError(`${name} must be a valid date string.`);
  }

  return normalized;
}

function normalizeDateString(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
