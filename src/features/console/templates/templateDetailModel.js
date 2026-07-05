import { getTemplateCardItems } from './templateCards.js';

export const TEMPLATE_DETAIL_TABS = Object.freeze([
  { id: 'content', label: 'Content' },
  { id: 'parameters', label: 'Parameters' },
  { id: 'payload', label: 'Payload' },
]);

const CHANNELS = Object.freeze({
  alimtalk: {
    apiChannel: 'alimtalk',
    label: '알림톡',
    routeChannel: 'alimtalk',
    sendTab: 'alimtalk',
    variableSyntax: 'kakao',
  },
  brand: {
    apiChannel: 'brand-message',
    label: '브랜드 메시지',
    routeChannel: 'brand',
    sendTab: 'brand',
    variableSyntax: 'kakao',
  },
  'brand-message': {
    apiChannel: 'brand-message',
    label: '브랜드 메시지',
    routeChannel: 'brand',
    sendTab: 'brand',
    variableSyntax: 'kakao',
  },
  sms: {
    apiChannel: 'sms',
    label: 'SMS',
    routeChannel: 'sms',
    sendTab: 'sms',
    variableSyntax: 'sms',
  },
});

const ROUTE_CHANNEL_BY_TAB = Object.freeze({
  SMS: 'sms',
  알림톡: 'alimtalk',
  '브랜드 메시지': 'brand',
});

export function getTemplateDetailChannel(value) {
  return CHANNELS[String(value ?? '').toLowerCase()] ?? null;
}

export function buildTemplateDetailHref({ activeTab, senderResourceId, template }) {
  const routeChannel = ROUTE_CHANNEL_BY_TAB[activeTab] ?? getRouteChannel(template.channel);
  const templateCode = String(template.code ?? template.templateCode ?? template.value ?? '').trim();

  if (!routeChannel || !templateCode) return '';

  const params = new URLSearchParams();

  if (senderResourceId) params.set('senderResourceId', senderResourceId);
  if (template.source) params.set('source', template.source);
  if (template.sourceKey) params.set('sourceKey', template.sourceKey);

  const query = params.toString();
  const path = `/templates/${routeChannel}/${encodeURIComponent(templateCode)}`;
  return query ? `${path}?${query}` : path;
}

export function normalizeTemplateDetail({ channel, template }) {
  const card = getTemplateCardItems([template])[0] ?? {};
  const channelView = getTemplateDetailChannel(channel ?? template?.channel);
  const variables = normalizeVariables(template, channelView);

  return {
    ...card,
    channelView,
    template,
    variables,
    variableCount: variables.length,
  };
}

export function buildSummaryItems(detail, senderResourceId) {
  return [
    { label: 'Template code', value: detail.code || '-' },
    { label: 'Status', tone: detail.statusTone, value: detail.status || '상태 없음' },
    { label: 'Sender', detail: detail.source === 'GROUP' ? '공통' : '', value: detail.ownerLabel || senderResourceId || '-' },
    { label: 'Variables', value: `${detail.variableCount}개` },
  ];
}

export function buildContentRows(detail) {
  const template = detail.template ?? {};
  return compactRows([
    row('Template name', detail.name),
    row('Body', template.body ?? template.content ?? detail.body),
    row('Header', template.header ?? template.templateHeader),
    row('Title', template.title ?? template.templateTitle),
    row('Subtitle', template.templateSubtitle),
    row('Description', template.description),
    row('Message type', template.chatBubbleType ?? template.templateMessageType ?? template.sendTypeName),
    row('Image', detail.imageUrl),
  ]);
}

export function buildActionRows(detail) {
  const template = detail.template ?? {};
  const buttons = Array.isArray(template.buttons) ? template.buttons : [];
  const quickReplies = Array.isArray(template.quickReplies) ? template.quickReplies : [];
  const actions = [
    ...buttons.map((action, index) => toActionRow(action, index, 'Button')),
    ...quickReplies.map((action, index) => toActionRow(action, index, 'Quick reply')),
  ];

  return actions;
}

export function buildParameterRows(detail) {
  return detail.variables.map((variable) => ({
    fallback: variable.fallbackValue || '-',
    key: variable.key,
    required: 'Required',
    token: getVariableToken(variable.key, detail.channelView?.variableSyntax),
  }));
}

export function buildPayloadRows(detail, senderResourceId) {
  const template = detail.template ?? {};
  return compactRows([
    row('Channel', detail.channelView?.label ?? template.channel),
    row('Template code', detail.code),
    row('Sender resource', senderResourceId),
    row('Source', template.source),
    row('Source key', template.sourceKey),
    row('Owner', detail.ownerLabel),
    row('Provider status', template.providerStatus),
    row('Provider status code', template.providerStatusCode),
    row('Created at', template.createDate),
    row('Updated at', template.updateDate),
    row('Category', template.categoryName ?? template.categoryCode ?? template.categoryId),
  ]);
}

export function buildUseTemplateHref(detail, mode) {
  const params = new URLSearchParams({
    tab: detail.channelView?.sendTab ?? '',
    templateCode: detail.code ?? '',
    templateMode: mode,
  });

  return `/message-send?${params.toString()}`;
}

function compactRows(rows) {
  return rows.filter((item) => item.value !== undefined && item.value !== null && item.value !== '');
}

function getRouteChannel(channel) {
  return getTemplateDetailChannel(channel)?.routeChannel ?? '';
}

function getVariableToken(key, syntax) {
  return syntax === 'sms' ? `##${key}##` : `#{${key}}`;
}

function normalizeVariables(template, channelView) {
  const variables = Array.isArray(template?.variables) ? template.variables : [];
  const requiredVariables = Array.isArray(template?.requiredVariables) ? template.requiredVariables : [];
  const seen = new Set();

  return [
    ...variables.map((variable) => ({
      fallbackValue: variable?.fallbackValue ?? '',
      key: String(variable?.key ?? '').trim(),
    })),
    ...requiredVariables.map((key) => ({
      fallbackValue: '',
      key: String(key ?? '').trim(),
    })),
  ].filter((variable) => {
    if (!variable.key || seen.has(variable.key)) return false;
    seen.add(variable.key);
    return Boolean(channelView);
  });
}

function row(field, value) {
  return {
    field,
    value: formatCellValue(value),
  };
}

function toActionRow(action, index, group) {
  return {
    group,
    link: action.linkMo ?? action.linkPc ?? action.schemeIos ?? action.schemeAndroid ?? action.telNumber ?? '-',
    name: action.name || '-',
    order: action.ordering ?? index + 1,
    type: action.type || '-',
  };
}

function formatCellValue(value) {
  if (Array.isArray(value)) return value.length ? `${value.length} items` : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value ?? '').trim();
}
