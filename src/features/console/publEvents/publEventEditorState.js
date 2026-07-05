import { normalizePublEventDetail } from './publEventDetailModel.js';

export const PUBL_EVENT_EDITOR_EVENT_FIELDS = Object.freeze([
  'eventKey',
  'displayName',
  'locationType',
  'locationId',
  'sourceType',
  'actionType',
]);

const PROP_FIELDS = new Set([
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
const STALE_PUBL_EVENT_EDITOR_DRAFT = 'STALE_PUBL_EVENT_EDITOR_DRAFT';

export function createPublEventEditorDraft(detail) {
  const normalized = normalizePublEventDetail(detail);
  const draft = {
    event: Object.fromEntries(
      PUBL_EVENT_EDITOR_EVENT_FIELDS.map((field) => [field, normalized[field] ?? ''])
    ),
    props: normalized.props.map((prop, index) => createDraftProp(prop, {
      clientId: `existing:${prop.alias || prop.rawPath || index}`,
      originalAlias: prop.alias,
      sortOrder: index,
    })),
  };

  return {
    aliasUnlockedAliases: [],
    baseUpdatedAt: normalized.updatedAt,
    deletedAliases: [],
    draft,
    mode: 'edit',
    originalDraft: cloneJson(draft),
    rawPathUnlockedAliases: [],
    save: { error: null, result: null, status: 'idle' },
  };
}

export function createPublEventEditorReadState() {
  return {
    aliasUnlockedAliases: [],
    baseUpdatedAt: null,
    deletedAliases: [],
    draft: null,
    mode: 'read',
    originalDraft: null,
    rawPathUnlockedAliases: [],
    save: { error: null, result: null, status: 'idle' },
  };
}

export function publEventEditorReducer(state, action) {
  switch (action.type) {
    case 'OPEN_EDIT_MODE':
      return createPublEventEditorDraft(action.detail);
    case 'CANCEL_EDIT_MODE':
      return createPublEventEditorReadState();
    case 'UPDATE_EVENT_FIELD':
      return updateEventField(state, action);
    case 'ADD_PROP':
      return addProp(state, action.prop);
    case 'UPDATE_PROP_FIELD':
      return updatePropField(state, action);
    case 'SET_PROP_ENABLED':
      return updateProp(state, action.propKey, (prop) => ({ ...prop, enabled: action.enabled ?? !prop.enabled }));
    case 'SET_PROP_REQUIRED':
      return updateProp(state, action.propKey, (prop) => ({ ...prop, required: action.required ?? !prop.required }));
    case 'SET_PROP_FORMAT':
      return updateProp(state, action.propKey, (prop) => ({
        ...prop,
        parserPipeline: normalizeEditorParserPipeline(action.step ?? { type: action.formatType ?? 'none' }),
      }));
    case 'DELETE_PROP':
      return deleteProp(state, action.propKey);
    case 'UNLOCK_PROP_RAW_PATH':
      return unlockProp(state, action.propKey, 'rawPathUnlockedAliases');
    case 'UNLOCK_PROP_ALIAS':
      return unlockProp(state, action.propKey, 'aliasUnlockedAliases');
    case 'SAVE_STARTED':
      return { ...state, save: { error: null, result: null, status: 'pending' } };
    case 'SAVE_FAILED':
      return { ...state, save: { error: toPublEventEditorFormError(action.error), result: null, status: 'error' } };
    case 'SAVE_SUCCEEDED':
      return {
        ...createPublEventEditorDraft(action.detail),
        save: { error: null, result: action.detail ?? null, status: 'success' },
      };
    default:
      return state;
  }
}

export function isPublEventEditorDirty(state) {
  if (!state?.draft || !state?.originalDraft) return false;

  return JSON.stringify({ deletedAliases: state.deletedAliases, draft: state.draft }) !==
    JSON.stringify({ deletedAliases: [], draft: state.originalDraft });
}

export function toPublEventEditorFormError(error) {
  const state = error?.state ?? null;

  return {
    code: error?.code ?? 'UNKNOWN_CLIENT_ERROR',
    message: state === STALE_PUBL_EVENT_EDITOR_DRAFT
      ? '다른 변경사항이 먼저 저장되었습니다. 최신 이벤트 정보를 다시 불러온 뒤 저장해 주세요.'
      : error?.message ?? 'PUBL 이벤트 변경사항을 저장하지 못했습니다.',
    retryable: Boolean(error?.retryable),
    source: error?.source ?? 'client',
    state,
    status: error?.status ?? 0,
  };
}

export function normalizeEditorParserPipeline(parserPipeline) {
  const steps = Array.isArray(parserPipeline) ? parserPipeline : [parserPipeline].filter(Boolean);
  const visibleSteps = steps
    .filter((step) => step?.type && step.type !== 'none')
    .map((step) => ({ ...step, type: step.type }));

  return visibleSteps.length ? visibleSteps : null;
}

function updateEventField(state, action) {
  if (!state?.draft || !PUBL_EVENT_EDITOR_EVENT_FIELDS.includes(action.field) || action.field === 'eventKey') {
    return state;
  }

  return {
    ...state,
    draft: {
      ...state.draft,
      event: { ...state.draft.event, [action.field]: action.value },
    },
  };
}

function addProp(state, prop = {}) {
  if (!state?.draft) return state;

  const draftProp = createDraftProp(prop, {
    clientId: prop.clientId ?? `new:${prop.alias || state.draft.props.length}`,
    originalAlias: null,
    sortOrder: state.draft.props.length,
  });

  return { ...state, draft: { ...state.draft, props: [...state.draft.props, draftProp] } };
}

function updatePropField(state, action) {
  if (!PROP_FIELDS.has(action.field)) return state;

  return updateProp(state, action.propKey, (prop) => {
    if (isLockedDangerousField(state, prop, action.field)) return prop;
    return { ...prop, [action.field]: action.value };
  });
}

function deleteProp(state, propKey) {
  if (!state?.draft) return state;

  const target = findProp(state.draft.props, propKey);
  if (!target) return state;

  return {
    ...state,
    deletedAliases: target.originalAlias ? addUnique(state.deletedAliases, target.originalAlias) : state.deletedAliases,
    draft: {
      ...state.draft,
      props: state.draft.props.filter((prop) => prop.clientId !== target.clientId),
    },
  };
}

function unlockProp(state, propKey, field) {
  if (!state?.draft) return state;

  const prop = findProp(state.draft.props, propKey);
  return prop?.originalAlias ? { ...state, [field]: addUnique(state[field], prop.originalAlias) } : state;
}

function updateProp(state, propKey, update) {
  if (!state?.draft) return state;

  return {
    ...state,
    draft: {
      ...state.draft,
      props: state.draft.props.map((prop) => (isPropMatch(prop, propKey) ? update(prop) : prop)),
    },
  };
}

function createDraftProp(prop, { clientId, originalAlias, sortOrder }) {
  return {
    alias: prop.alias ?? '',
    clientId,
    description: prop.description ?? '',
    enabled: prop.enabled !== false,
    fallback: prop.fallback ?? '',
    label: prop.label ?? '',
    originalAlias,
    parserPipeline: normalizeEditorParserPipeline(prop.parserPipeline),
    rawPath: prop.rawPath ?? '',
    required: prop.required === true,
    sample: prop.sample ?? '',
    sortOrder,
    type: prop.type || 'text',
  };
}

function findProp(props, propKey) {
  return props.find((prop) => isPropMatch(prop, propKey)) ?? null;
}

function isPropMatch(prop, propKey) {
  return [prop.clientId, prop.originalAlias, prop.alias].includes(propKey);
}

function isLockedDangerousField(state, prop, field) {
  if (!prop.originalAlias) return false;
  if (field === 'rawPath') return !state.rawPathUnlockedAliases.includes(prop.originalAlias);
  if (field === 'alias') return !state.aliasUnlockedAliases.includes(prop.originalAlias);
  return false;
}

function addUnique(values, value) {
  return values.includes(value) ? values : [...values, value];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
