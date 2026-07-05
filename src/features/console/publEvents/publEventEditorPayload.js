import {
  PUBL_EVENT_EDITOR_EVENT_FIELDS,
  normalizeEditorParserPipeline,
} from './publEventEditorState.js';

export function serializePublEventEditorPayload(state) {
  if (!state?.draft) {
    throw new Error('PUBL event editor draft is required before serialization.');
  }

  return {
    baseUpdatedAt: state.baseUpdatedAt,
    event: toEventPayload(state.draft.event),
    props: state.draft.props.map(toPropPayload),
    deletedAliases: state.deletedAliases.map((originalAlias) => ({ originalAlias, confirmation: 'DELETE_PROP' })),
    dangerousChangeConfirmations: getDangerousChangeConfirmations(state),
  };
}

export function getPublEventEditorPreflightIssues(state) {
  if (!state?.draft) return [];

  return [
    ...getVariableKeyCollisionIssues(state.draft.props),
    ...getDangerousChangeIssues(state),
  ];
}

function toEventPayload(event) {
  return Object.fromEntries(PUBL_EVENT_EDITOR_EVENT_FIELDS.map((field) => [field, field === 'eventKey'
    ? requiredString(event[field])
    : nullableString(event[field])]));
}

function toPropPayload(prop) {
  return {
    originalAlias: prop.originalAlias,
    alias: requiredString(prop.alias),
    label: requiredString(prop.label),
    rawPath: requiredString(prop.rawPath),
    type: requiredString(prop.type),
    required: prop.required === true,
    enabled: prop.enabled === true,
    fallback: nullableString(prop.fallback),
    sample: nullableString(prop.sample),
    description: nullableString(prop.description),
    parserPipeline: normalizeEditorParserPipeline(prop.parserPipeline),
  };
}

function getDangerousChangeConfirmations(state) {
  const originalByAlias = new Map(state.originalDraft.props.map((prop) => [prop.originalAlias, prop]));

  return {
    rawPath: state.draft.props.flatMap((prop) => getDangerousConfirmation({
      confirmation: 'CHANGE_RAW_PATH',
      field: 'rawPath',
      original: originalByAlias.get(prop.originalAlias),
      prop,
      unlockedAliases: state.rawPathUnlockedAliases,
    })),
    alias: state.draft.props.flatMap((prop) => getDangerousConfirmation({
      confirmation: 'CHANGE_ALIAS',
      field: 'alias',
      original: originalByAlias.get(prop.originalAlias),
      prop,
      unlockedAliases: state.aliasUnlockedAliases,
    })),
  };
}

function getDangerousConfirmation({ confirmation, field, original, prop, unlockedAliases }) {
  if (!prop.originalAlias || !original || original[field] === prop[field] || !unlockedAliases.includes(prop.originalAlias)) {
    return [];
  }

  return [{ originalAlias: prop.originalAlias, from: original[field], to: prop[field], confirmation }];
}

function getDangerousChangeIssues(state) {
  const originalByAlias = new Map(state.originalDraft.props.map((prop) => [prop.originalAlias, prop]));

  return state.draft.props.flatMap((prop) => {
    if (!prop.originalAlias) return [];

    const original = originalByAlias.get(prop.originalAlias);
    if (!original) return [];

    const issues = [];

    if (original.rawPath !== prop.rawPath && !state.rawPathUnlockedAliases.includes(prop.originalAlias)) {
      issues.push({
        confirmation: 'CHANGE_RAW_PATH',
        from: original.rawPath,
        originalAlias: prop.originalAlias,
        reason: 'rawPath_unlock_required',
        to: prop.rawPath,
      });
    }

    if (original.alias !== prop.alias && !state.aliasUnlockedAliases.includes(prop.originalAlias)) {
      issues.push({
        confirmation: 'CHANGE_ALIAS',
        from: original.alias,
        originalAlias: prop.originalAlias,
        reason: 'alias_unlock_required',
        to: prop.alias,
      });
    }

    return issues;
  });
}

function getVariableKeyCollisionIssues(props) {
  const issues = [];
  const aliasIndexes = new Map();
  const labelKeyIndexes = new Map();

  props.forEach((prop, index) => {
    const alias = requiredString(prop.alias);
    if (aliasIndexes.has(alias)) issues.push({ alias, reason: 'duplicate_alias' });
    aliasIndexes.set(alias, index);

    for (const key of getLabelVariableKeys(prop.label)) {
      const ownerIndex = labelKeyIndexes.get(key);
      if (ownerIndex !== undefined && ownerIndex !== index) {
        issues.push({ key, reason: 'label_variable_key_collision' });
      }
      labelKeyIndexes.set(key, index);
    }
  });

  props.forEach((prop, index) => {
    const ownerIndex = labelKeyIndexes.get(requiredString(prop.alias));
    if (ownerIndex !== undefined && ownerIndex !== index) {
      issues.push({ alias: prop.alias, reason: 'alias_label_variable_key_collision' });
    }
  });

  return issues;
}

function getLabelVariableKeys(label) {
  const value = requiredString(label);
  const normalized = normalizeTemplateLabelKey(value);
  return normalized && normalized !== value ? [value, normalized] : [value];
}

function normalizeTemplateLabelKey(label) {
  return typeof label === 'string' ? label.replace(/\s+/g, '') : '';
}

function nullableString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value);
  return text.trim() === '' ? null : text;
}

function requiredString(value) {
  return String(value ?? '').trim();
}
