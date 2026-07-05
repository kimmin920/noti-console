export const SEND_CHANNEL_LABELS = {
  alimtalk: '알림톡',
  'brand-message': '브랜드 메시지',
  lms: 'LMS',
  mms: 'MMS',
  sms: 'SMS',
};

export function getTemplateCode(template) {
  return String(template?.templateCode ?? template?.templateId ?? template?.value ?? template?.id ?? '').trim();
}

export function getTemplateName(template) {
  const code = getTemplateCode(template);
  const name = String(template?.templateName ?? template?.name ?? template?.label ?? code).trim();
  const channel = getTemplateDisplayChannel(template);

  return channel ? `${name} (${channel})` : name;
}

export function getTemplateOptionKey(template) {
  return String(template?.id ?? template?.value ?? getTemplateSelectionValue(template));
}

export function getTemplateSource(template) {
  return String(template?.source ?? '').trim();
}

export function getTemplateSourceKey(template) {
  return String(template?.sourceKey ?? '').trim();
}

export function getTemplateSelectionValue(template) {
  return `${getTemplateSource(template)}::${getTemplateSourceKey(template)}::${getTemplateCode(template)}`;
}

export function getPersistedSendChannelForTemplate(template, fallbackSendChannel, validChannels) {
  const templateChannel = String(template?.channel ?? '').toLowerCase();

  if (['sms', 'lms', 'mms'].includes(templateChannel)) {
    return templateChannel;
  }

  return validChannels.includes(fallbackSendChannel) ? fallbackSendChannel : 'sms';
}

export function getTemplateDisplayChannel(template) {
  const channel = String(template?.channel ?? '').toLowerCase();

  return SEND_CHANNEL_LABELS[channel] ?? '';
}

export function getTemplateRequiredVariables(template) {
  const required = new Set();

  for (const key of template?.requiredVariables ?? []) {
    const normalizedKey = String(key ?? '').trim();
    if (normalizedKey) required.add(normalizedKey);
  }

  for (const variable of template?.variables ?? []) {
    const key = String(variable?.key ?? variable?.name ?? '').trim();
    if (key && variable?.required === true) required.add(key);
  }

  return [...required];
}

export function getTemplateOptionalVariables(template) {
  const required = new Set(getTemplateRequiredVariables(template));
  return getTemplateVariables(template)
    .filter((variable) => !required.has(variable.key))
    .map((variable) => variable.key);
}

export function getTemplateVariables(template) {
  const required = new Set(getTemplateRequiredVariables(template));
  const variables = [];
  const seen = new Set();

  for (const key of required) {
    pushVariable({ key, required: true, seen, variables });
  }

  for (const variable of template?.variables ?? []) {
    pushVariable({
      key: String(variable?.key ?? variable?.name ?? '').trim(),
      required: required.has(String(variable?.key ?? variable?.name ?? '').trim()) || variable?.required === true,
      seen,
      type: String(variable?.type ?? 'string'),
      variables,
    });
  }

  for (const key of extractTemplatePlaceholderKeys(template)) {
    pushVariable({ key, required: required.has(key), seen, variables });
  }

  return variables;
}

export function getTemplateVariableKeys(template) {
  return getTemplateVariables(template).map((variable) => variable.key);
}

function pushVariable({ key, required = false, seen, type = 'string', variables }) {
  if (!key || seen.has(key)) return;

  seen.add(key);
  variables.push({ key, required, type });
}

function extractTemplatePlaceholderKeys(template) {
  const text = [template?.body, template?.content, template?.templateContent]
    .map((value) => String(value ?? ''))
    .filter(Boolean)
    .join('\n');
  const keys = [];
  const seen = new Set();
  const patterns = [/##([^#\n]{1,80})##/g, /#\{([^}\n]{1,80})\}/g];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const key = String(match[1] ?? '').trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }

  return keys;
}
