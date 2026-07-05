import { AUTOMATION_TARGET_PHONE_ALIAS } from './ruleEditorConstants.js';

export const ALLOWED_AUTOMATION_CONDITION_OPERATORS = [
  'equals',
  'not_equals',
  'exists',
  'contains',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
];

export const AUTOMATION_CONDITION_OPERATOR_LABELS = {
  contains: '포함',
  equals: '같음',
  exists: '존재함',
  gt: '초과',
  gte: '이상',
  in: '목록 중 하나',
  lt: '미만',
  lte: '이하',
  not_equals: '같지 않음',
};

export const AUTOMATION_COOLDOWN_UNITS = [
  { label: '분', seconds: 60, value: 'minutes' },
  { label: '시간', seconds: 3600, value: 'hours' },
  { label: '일', seconds: 86400, value: 'days' },
];

export const MAX_AUTOMATION_COOLDOWN_SECONDS = 2_592_000;

const CONDITION_OPERATOR_SET = new Set(ALLOWED_AUTOMATION_CONDITION_OPERATORS);
const UNSAFE_CONDITION_TEXT_PATTERN = /(;|=>|\b(function|script|select|insert|update|delete|drop|where|union|regexp|new RegExp)\b)/i;

export function parseDraftJsonObject(text, fallback = {}) {
  try {
    const value = JSON.parse(text || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function formatDraftJson(value) {
  return JSON.stringify(value && typeof value === 'object' ? value : {}, null, 2);
}

export function getRecipientAliasFromDraft(draft) {
  const mapping = parseDraftJsonObject(draft?.recipientMappingJsonText);
  return mapping.type === 'event_alias'
    ? String(mapping.alias ?? AUTOMATION_TARGET_PHONE_ALIAS).trim() || AUTOMATION_TARGET_PHONE_ALIAS
    : AUTOMATION_TARGET_PHONE_ALIAS;
}

export function createRecipientMappingJsonText(alias) {
  return formatDraftJson({
    type: 'event_alias',
    alias: String(alias ?? AUTOMATION_TARGET_PHONE_ALIAS).trim() || AUTOMATION_TARGET_PHONE_ALIAS,
  });
}

export function getVariableMappingFromDraft(draft) {
  return parseDraftJsonObject(draft?.variableMappingJsonText);
}

export function createVariableMappingJsonText(mapping) {
  return formatDraftJson(mapping);
}

export function updateVariableMappingJsonText(text, templateKey, alias) {
  const mapping = parseDraftJsonObject(text);
  const normalizedKey = String(templateKey ?? '').trim();
  const normalizedAlias = String(alias ?? '').trim();

  if (!normalizedKey) return createVariableMappingJsonText(mapping);

  if (normalizedAlias) {
    mapping[normalizedKey] = normalizedAlias;
  } else {
    delete mapping[normalizedKey];
  }

  return createVariableMappingJsonText(mapping);
}

export function pruneVariableMappingJsonText(text, allowedTemplateKeys) {
  const allowed = new Set((allowedTemplateKeys ?? []).map((key) => String(key).trim()).filter(Boolean));
  const mapping = parseDraftJsonObject(text);
  const nextMapping = {};

  for (const [templateKey, alias] of Object.entries(mapping)) {
    if (allowed.has(templateKey)) nextMapping[templateKey] = alias;
  }

  return createVariableMappingJsonText(nextMapping);
}

export function getConditionClausesFromDraft(draft) {
  const condition = parseDraftJsonObject(draft?.conditionJsonText, { all: [] });
  return Array.isArray(condition.all) ? condition.all : [];
}

export function createConditionJsonText(clauses) {
  return formatDraftJson({
    all: (clauses ?? []).map(normalizeConditionClauseForDraft).filter(Boolean),
  });
}

export function createDefaultConditionClause(alias = '') {
  return {
    alias,
    operator: 'equals',
    value: '',
  };
}

export function updateConditionClauseJsonText(text, index, patch) {
  const clauses = getConditionClausesFromDraft({ conditionJsonText: text });
  const nextClauses = clauses.map((clause, clauseIndex) => {
    if (clauseIndex !== index) return normalizeConditionClauseForDraft(clause);

    const nextClause = normalizeConditionClauseForDraft({ ...clause, ...patch });
    if (nextClause?.operator === 'exists') {
      return {
        alias: nextClause.alias,
        operator: nextClause.operator,
      };
    }

    return nextClause;
  });

  return createConditionJsonText(nextClauses);
}

export function removeConditionClauseJsonText(text, index) {
  return createConditionJsonText(
    getConditionClausesFromDraft({ conditionJsonText: text }).filter((_, clauseIndex) => clauseIndex !== index)
  );
}

export function appendConditionClauseJsonText(text, alias = '') {
  return createConditionJsonText([
    ...getConditionClausesFromDraft({ conditionJsonText: text }),
    createDefaultConditionClause(alias),
  ]);
}

export function getCooldownPolicyFromDraft(draft) {
  return parseDraftJsonObject(draft?.cooldownPolicyJsonText, { enabled: false });
}

export function createCooldownPolicyJsonText({ enabled, windowSeconds }) {
  if (!enabled) return formatDraftJson({ enabled: false });

  return formatDraftJson({
    enabled: true,
    windowSeconds: clampCooldownSeconds(windowSeconds),
  });
}

export function getCooldownUiValue(draft) {
  const policy = getCooldownPolicyFromDraft(draft);
  const windowSeconds = Number(policy.windowSeconds);

  if (!policy.enabled || !Number.isInteger(windowSeconds)) {
    return { amount: 5, enabled: false, unit: 'minutes', windowSeconds: 300 };
  }

  const unit = [...AUTOMATION_COOLDOWN_UNITS]
    .reverse()
    .find((item) => windowSeconds % item.seconds === 0) ?? AUTOMATION_COOLDOWN_UNITS[0];

  return {
    amount: Math.max(1, Math.floor(windowSeconds / unit.seconds)),
    enabled: true,
    unit: unit.value,
    windowSeconds,
  };
}

export function getCooldownWindowSeconds(amount, unitValue) {
  const unit = AUTOMATION_COOLDOWN_UNITS.find((item) => item.value === unitValue) ?? AUTOMATION_COOLDOWN_UNITS[0];
  const count = Number(amount);

  if (!Number.isInteger(count) || count < 1) return unit.seconds;

  return clampCooldownSeconds(count * unit.seconds);
}

export function validateStructuredPolicyJson(draft, errors) {
  validateRecipientMappingJson(draft.recipientMappingJsonText, errors);
  validateConditionJson(draft.conditionJsonText, errors);
  validateCooldownPolicyJson(draft.cooldownPolicyJsonText, errors);
}

function validateRecipientMappingJson(text, errors) {
  const mapping = parseDraftJsonObject(text);

  if (mapping.type !== 'event_alias' || !String(mapping.alias ?? '').trim()) {
    errors.push('수신자 매핑 alias를 선택하세요.');
  }
}

function validateConditionJson(text, errors) {
  const condition = parseDraftJsonObject(text, null);

  if (!condition || !Array.isArray(condition.all) || Object.keys(condition).some((key) => key !== 'all')) {
    errors.push('조건은 all 절 목록만 사용할 수 있습니다.');
    return;
  }

  for (const clause of condition.all) {
    if (!clause || typeof clause !== 'object' || Array.isArray(clause)) {
      errors.push('조건 절은 alias와 연산자로 구성해야 합니다.');
      continue;
    }

    const operator = String(clause.operator ?? '').trim();
    if (!CONDITION_OPERATOR_SET.has(operator)) {
      errors.push('지원하지 않는 조건 연산자가 포함되어 있습니다.');
      continue;
    }

    if (operator !== 'exists' && !isSafeConditionValue(clause.value, operator)) {
      errors.push('조건 값은 제한된 리터럴만 입력할 수 있습니다.');
    }
  }
}

function validateCooldownPolicyJson(text, errors) {
  const policy = parseDraftJsonObject(text, null);

  if (!policy || typeof policy.enabled !== 'boolean') {
    errors.push('쿨다운 설정 형식이 올바르지 않습니다.');
    return;
  }

  if (!policy.enabled) return;

  const windowSeconds = Number(policy.windowSeconds);
  if (!Number.isInteger(windowSeconds) || windowSeconds < 60 || windowSeconds > MAX_AUTOMATION_COOLDOWN_SECONDS) {
    errors.push('쿨다운 시간은 1분에서 30일 사이여야 합니다.');
  }
}

function normalizeConditionClauseForDraft(clause) {
  if (!clause || typeof clause !== 'object' || Array.isArray(clause)) return null;

  const alias = String(clause.alias ?? '').trim();
  const operator = CONDITION_OPERATOR_SET.has(clause.operator) ? clause.operator : 'equals';

  if (operator === 'exists') return { alias, operator };

  return {
    alias,
    operator,
    value: normalizeConditionValue(clause.value, operator),
  };
}

function normalizeConditionValue(value, operator) {
  if (operator === 'in') {
    if (Array.isArray(value)) {
      return value.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 50);
    }

    return String(value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 50);
  }

  if (['gt', 'gte', 'lt', 'lte'].includes(operator)) {
    const number = Number(value);
    return Number.isFinite(number) ? number : '';
  }

  return value ?? '';
}

function isSafeConditionValue(value, operator) {
  if (operator === 'in') {
    return Array.isArray(value) && value.length <= 50 && value.every(isSafeConditionLiteral);
  }

  return isSafeConditionLiteral(value);
}

function isSafeConditionLiteral(value) {
  if (typeof value === 'string') {
    return value.length <= 200 && !UNSAFE_CONDITION_TEXT_PATTERN.test(value);
  }

  return typeof value === 'number' || typeof value === 'boolean' || value === null;
}

function clampCooldownSeconds(value) {
  const seconds = Number(value);
  if (!Number.isInteger(seconds)) return 300;
  return Math.min(Math.max(seconds, 60), MAX_AUTOMATION_COOLDOWN_SECONDS);
}
