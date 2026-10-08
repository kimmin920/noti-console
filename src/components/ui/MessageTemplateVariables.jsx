'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Braces, TriangleAlert, X } from 'lucide-react';

const VARIABLE_PATTERNS = {
  kakao: /#\{([^}]+)\}/g,
  sms: /##([^#]+)##/g,
};

export const defaultMessageTemplateRecipientFields = [
  { group: '기본 정보', label: '수신자.이름', path: 'recipient.name', sampleValue: '김민준' },
  { group: '기본 정보', label: '수신자.번호', path: 'recipient.phone', sampleValue: '010-1234-5678' },
  { group: '기본 정보', label: '수신자.이메일', path: 'recipient.email', sampleValue: 'customer@example.com' },
  { group: '고객 정보', label: '수신자.등급', path: 'recipient.grade', sampleValue: 'VIP' },
  { group: '고객 정보', label: '수신자.포인트', path: 'recipient.points', sampleValue: '12,400P' },
  { group: '고객 정보', label: '수신자.가입일', path: 'recipient.joinedAt', sampleValue: '2026-03-14' },
];

export function getMessageTemplateVariableToken(key, syntax = 'kakao') {
  if (!key) {
    return '';
  }

  if (syntax === 'sms') {
    return `##${key}##`;
  }

  return `#{${key}}`;
}

function getRecipientField(path, recipientFields = defaultMessageTemplateRecipientFields) {
  return recipientFields.find((field) => field.path === path) ?? null;
}

function getFirstRecipientField(recipientFields = defaultMessageTemplateRecipientFields) {
  return recipientFields[0] ?? { label: '수신자.이름', path: 'recipient.name', sampleValue: '김민준' };
}

export function normalizeMessageTemplateVariableAssignment(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const mode = value.mode === 'recipient' ? 'recipient' : 'manual';

    if (mode === 'recipient') {
      return {
        mode,
        path: value.path ?? value.recipientField ?? '',
        value: value.value ?? value.fallbackValue ?? '',
      };
    }

    return {
      mode,
      path: value.path ?? '',
      value: value.value ?? value.fallbackValue ?? '',
    };
  }

  return {
    mode: 'manual',
    path: '',
    value: value ?? '',
  };
}

export function extractMessageTemplateVariables(text, syntax = 'kakao') {
  const pattern = VARIABLE_PATTERNS[syntax] ?? VARIABLE_PATTERNS.kakao;
  const variables = [];
  const seen = new Set();
  let match = pattern.exec(text ?? '');

  while (match) {
    const key = match[1]?.trim();

    if (key && !seen.has(key)) {
      seen.add(key);
      variables.push({
        key,
        token: match[0],
      });
    }

    match = pattern.exec(text ?? '');
  }

  pattern.lastIndex = 0;

  return variables;
}

export function getMessageTemplateVariableAssignment(variables, key) {
  if (!variables || !key) {
    return normalizeMessageTemplateVariableAssignment('');
  }

  if (Array.isArray(variables)) {
    const variable = variables.find((item) => item.key === key || item.variableKey === key);

    return normalizeMessageTemplateVariableAssignment(variable ?? '');
  }

  return normalizeMessageTemplateVariableAssignment(variables[key]);
}

export function getMessageTemplateVariableValue(
  variables,
  key,
  recipientFields = defaultMessageTemplateRecipientFields
) {
  const assignment = getMessageTemplateVariableAssignment(variables, key);

  if (assignment.mode === 'recipient') {
    const field = getRecipientField(assignment.path, recipientFields);

    return field?.sampleValue ?? assignment.value ?? assignment.path ?? '';
  }

  return assignment.value ?? '';
}

export function getInitialTemplateVariables(template, syntax = 'kakao', previousVariables = {}) {
  const textVariables = extractMessageTemplateVariables(getTemplateVariableSourceText(template), syntax);
  const explicitVariables = Array.isArray(template?.variables)
    ? template.variables.map((variable) => ({
      key: variable.key ?? variable.variableKey,
      value: variable.fallbackValue ?? variable.value ?? '',
    }))
    : [];
  const requiredVariables = Array.isArray(template?.requiredVariables)
    ? template.requiredVariables.map((key) => ({ key, value: '' }))
    : [];
  const nextVariables = {};

  for (const variable of [...textVariables, ...explicitVariables, ...requiredVariables]) {
    if (!variable.key) {
      continue;
    }

    const hasPreviousValue = Object.prototype.hasOwnProperty.call(previousVariables ?? {}, variable.key);
    const nextValue = hasPreviousValue
      ? previousVariables[variable.key]
      : template?.templateParameter?.[variable.key]
        ?? variable.value
        ?? '';

    nextVariables[variable.key] = normalizeMessageTemplateVariableAssignment(nextValue);
  }

  return nextVariables;
}

export function getTemplateVariableDetails(template, variables, activeKey, syntax = 'kakao') {
  if (!activeKey) {
    return null;
  }

  const knownVariableKeys = new Set([
    ...extractMessageTemplateVariables(getTemplateVariableSourceText(template), syntax).map((variable) => variable.key),
    ...(Array.isArray(template?.variables)
      ? template.variables.map((variable) => variable.key ?? variable.variableKey)
      : []),
    ...(Array.isArray(template?.requiredVariables) ? template.requiredVariables : []),
  ].filter(Boolean));

  if (!knownVariableKeys.has(activeKey)) {
    return null;
  }

  const explicitVariable = Array.isArray(template?.variables)
    ? template.variables.find((item) => item.key === activeKey || item.variableKey === activeKey)
    : null;

  return {
    assignment: getMessageTemplateVariableAssignment(variables, activeKey),
    category: explicitVariable?.category ?? template?.templateName ?? template?.templateCode ?? '',
    key: activeKey,
    token: getMessageTemplateVariableToken(activeKey, syntax),
    type: explicitVariable?.type ?? 'string',
    value: getMessageTemplateVariableValue(variables, activeKey),
  };
}

export function resolveMessageTemplateText(text, variables, syntax = 'kakao') {
  const pattern = VARIABLE_PATTERNS[syntax] ?? VARIABLE_PATTERNS.kakao;

  return String(text ?? '').replace(pattern, (token, key) => {
    const value = getMessageTemplateVariableValue(variables, key.trim());

    return value || token;
  });
}

function getTemplateVariableSourceText(template) {
  const chunks = [
    template?.body,
    template?.content,
    template?.title,
    template?.templateHeader,
    template?.templateSubtitle,
    ...(template?.buttons ?? []).flatMap((button) => [
      button.name,
      button.linkMo,
      button.linkPc,
      button.schemeIos,
      button.schemeAndroid,
      button.chatExtra,
      button.chatEvent,
      button.bizFormKey,
    ]),
    ...(template?.quickReplies ?? []).map((reply) => reply.name),
  ];

  return chunks.filter((chunk) => typeof chunk === 'string').join('\n');
}

function renderTemplateParts({ activeKey, onVariableClick, syntax, text, variables }) {
  const pattern = VARIABLE_PATTERNS[syntax] ?? VARIABLE_PATTERNS.kakao;
  const parts = [];
  let lastIndex = 0;
  let match = pattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, match.index),
        type: 'text',
      });
    }

    const key = match[1].trim();

    parts.push({
      key,
      token: match[0],
      type: 'variable',
      value: getMessageTemplateVariableValue(variables, key),
    });
    lastIndex = match.index + match[0].length;
    match = pattern.exec(text);
  }

  pattern.lastIndex = 0;

  if (lastIndex < text.length) {
    parts.push({
      text: text.slice(lastIndex),
      type: 'text',
    });
  }

  return parts.map((part, index) => {
    if (part.type === 'text') {
      return <span key={`text-${index}`}>{part.text}</span>;
    }

    const isMissing = !part.value;

    return (
      <button
        aria-pressed={activeKey === part.key}
        className="message-template-variable"
        data-missing={isMissing ? 'true' : undefined}
        key={`${part.token}-${index}`}
        onClick={() => onVariableClick?.(part.key)}
        type="button"
      >
        <span>{part.token}</span>
        {isMissing ? <TriangleAlert aria-hidden="true" size={14} /> : null}
      </button>
    );
  });
}

export function MessageTemplateDocument({
  activeKey = '',
  className = '',
  onVariableClick,
  syntax = 'kakao',
  text,
  variables,
}) {
  const renderedParts = useMemo(() => renderTemplateParts({
    activeKey,
    onVariableClick,
    syntax,
    text: text ?? '',
    variables,
  }), [activeKey, onVariableClick, syntax, text, variables]);

  return (
    <div className={['message-template-document', className].filter(Boolean).join(' ')}>
      {renderedParts}
    </div>
  );
}

export function MessageTemplateVariablePanel({
  onClose,
  onValueChange,
  recipientFields = defaultMessageTemplateRecipientFields,
  selectedVariable,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!selectedVariable) {
      return undefined;
    }

    function handlePointerDown(event) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (panelRef.current?.contains(target)) {
        return;
      }

      if (target instanceof Element && target.closest('.message-template-variable')) {
        return;
      }

      onClose?.();
    }

    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [onClose, selectedVariable]);

  if (!selectedVariable) {
    return null;
  }

  const assignment = normalizeMessageTemplateVariableAssignment(selectedVariable.assignment);
  const mode = assignment.mode;
  const firstRecipientField = getFirstRecipientField(recipientFields);
  const selectedPath = assignment.path || firstRecipientField.path;
  const previewValue = getMessageTemplateVariableValue(
    { [selectedVariable.key]: assignment.mode === 'recipient' ? { ...assignment, path: selectedPath } : assignment },
    selectedVariable.key,
    recipientFields
  );
  const groupedRecipientFields = recipientFields.reduce((groups, field) => {
    const groupName = field.group ?? '수신자 정보';

    return {
      ...groups,
      [groupName]: [...(groups[groupName] ?? []), field],
    };
  }, {});

  function updateMode(nextMode) {
    if (nextMode === mode) {
      return;
    }

    onValueChange?.(selectedVariable.key, nextMode === 'recipient'
      ? { mode: 'recipient', path: selectedPath }
      : { mode: 'manual', value: assignment.value ?? '' });
  }

  return (
    <aside
      aria-label="Variable settings"
      className="message-template-variable-sidebar"
      data-testid="variable-sidebar"
      ref={panelRef}
    >
      <div className="message-template-variable-sidebar-inner">
        <div className="message-template-variable-sidebar-header">
          <span aria-hidden="true" className="message-template-variable-sidebar-icon">
            <Braces size={16} />
          </span>
          <span className="message-template-variable-sidebar-title">
            <span>변수</span>
            <span aria-hidden="true">/</span>
            <code>{selectedVariable.token}</code>
          </span>
          <button
            aria-label="Close sidebar"
            className="message-template-variable-sidebar-button"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="message-template-variable-sidebar-body">
          <section className="message-template-variable-section">
            <label
              className="message-template-variable-label"
              htmlFor={mode === 'recipient' ? 'message-template-variable-recipient-field' : 'message-template-variable-value'}
            >
              값
            </label>
            <div className="message-template-variable-value-group">
              <div className="message-template-variable-mode" role="group" aria-label="값 입력 방식">
                <button
                  aria-pressed={mode === 'manual'}
                  className="message-template-variable-mode-button"
                  onClick={() => updateMode('manual')}
                  type="button"
                >
                  직접 입력
                </button>
                <button
                  aria-pressed={mode === 'recipient'}
                  className="message-template-variable-mode-button"
                  onClick={() => updateMode('recipient')}
                  type="button"
                >
                  수신자 정보
                </button>
              </div>
              {mode === 'recipient' ? (
                <>
                  <select
                    className="message-template-variable-select"
                    id="message-template-variable-recipient-field"
                    onChange={(event) => onValueChange?.(selectedVariable.key, {
                      mode: 'recipient',
                      path: event.target.value,
                    })}
                    value={selectedPath}
                  >
                    {Object.entries(groupedRecipientFields).map(([group, fields]) => (
                      <optgroup key={group} label={group}>
                        {fields.map((field) => (
                          <option key={field.path} value={field.path}>
                            {field.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <input
                    className="message-template-variable-input"
                    id="message-template-variable-value"
                    onChange={(event) => onValueChange?.(selectedVariable.key, {
                      mode: 'manual',
                      value: event.target.value,
                    })}
                    placeholder="값을 입력하세요"
                    type="text"
                    value={assignment.value ?? ''}
                  />
                </>
              )}
            </div>
          </section>
          <section className="message-template-variable-section">
            <label className="message-template-variable-label" htmlFor="message-template-variable-type">
              미리보기
            </label>
            <div className="message-template-variable-preview" id="message-template-variable-type">
              <span>{previewValue || selectedVariable.token}</span>
            </div>
          </section>
        </div>
      </div>
    </aside>
  );
}
