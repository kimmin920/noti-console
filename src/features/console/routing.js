export const DEFAULT_CONSOLE_PAGE_ID = 'emails';
export const DEFAULT_SHELL_MODE = 'app';

const ROUTE_BY_CONSOLE_PAGE = {
  emails: '/message-send',
  automations: '/automations',
  'automations-detail': '/automations',
  'automations-edit': '/automations',
  'automations-new': '/automations/new',
  'publ-event-detail': '/automations',
  'publ-event-new': '/automations/publ-events/new',
  templates: '/templates',
  'templates-detail': '/templates',
  'templates-sms-new': '/templates/sms/new',
  'templates-alimtalk-new': '/templates/alimtalk/new',
  'templates-brand-new': '/templates/brand/new',
  audience: '/audience',
  metrics: '/metrics',
  reservations: '/reservations',
  'reservation-detail': '/reservations',
  logs: '/logs',
  'log-detail': '/logs',
  settings: '/settings',
  'settings-sender-sms-new': '/settings/sender-resources/sms/new',
  'settings-sender-kakao-new': '/settings/sender-resources/kakao/new',
  admin: '/admin/sender-resource-applications',
  'admin-sender-resource-applications': '/admin/sender-resource-applications',
  docs: '/docs',
};

const CONSOLE_PAGE_IDS = new Set([
  DEFAULT_CONSOLE_PAGE_ID,
  'automations',
  'automations-detail',
  'automations-edit',
  'automations-new',
  'publ-event-detail',
  'publ-event-new',
  'templates',
  'templates-detail',
  'templates-sms-new',
  'templates-alimtalk-new',
  'templates-brand-new',
  'audience',
  'metrics',
  'reservations',
  'reservation-detail',
  'logs',
  'log-detail',
  'settings',
  'settings-sender-sms-new',
  'settings-sender-kakao-new',
  'admin',
  'admin-sender-resource-applications',
  'docs',
]);

const CONSOLE_PATH_ROUTE_RULES = [
  { pageId: DEFAULT_CONSOLE_PAGE_ID, pattern: /^\/message-send\/?$/ },
  { pageId: 'automations', pattern: /^\/automations\/?$/ },
  { pageId: 'automations-new', pattern: /^\/automations\/new\/?$/ },
  { pageId: 'publ-event-new', pattern: /^\/automations\/publ-events\/new\/?$/ },
  { pageId: 'publ-event-detail', pattern: /^\/automations\/publ-events\/[^/]+\/?$/ },
  { pageId: 'automations-edit', pattern: /^\/automations\/[^/]+\/edit\/?$/ },
  { pageId: 'automations-detail', pattern: /^\/automations\/[^/]+\/?$/ },
  { pageId: 'templates', pattern: /^\/templates\/?$/ },
  { pageId: 'templates-sms-new', pattern: /^\/templates\/sms\/new\/?$/ },
  { pageId: 'templates-alimtalk-new', pattern: /^\/templates\/alimtalk\/new\/?$/ },
  { pageId: 'templates-brand-new', pattern: /^\/templates\/brand\/new\/?$/ },
  { pageId: 'templates-detail', pattern: /^\/templates\/[^/]+\/[^/]+\/?$/ },
  { pageId: 'audience', pattern: /^\/audience\/?$/ },
  { pageId: 'metrics', pattern: /^\/metrics\/?$/ },
  { pageId: 'reservations', pattern: /^\/reservations\/?$/ },
  { pageId: 'reservation-detail', pattern: /^\/reservations\/[^/]+\/?$/ },
  { pageId: 'logs', pattern: /^\/logs\/?$/ },
  { pageId: 'log-detail', pattern: /^\/logs\/[^/]+\/?$/ },
  { pageId: 'settings', pattern: /^\/settings\/?$/ },
  { pageId: 'settings-sender-sms-new', pattern: /^\/settings\/sender-resources\/sms\/new\/?$/ },
  { pageId: 'settings-sender-kakao-new', pattern: /^\/settings\/sender-resources\/kakao\/new\/?$/ },
  { pageId: 'admin-sender-resource-applications', pattern: /^\/admin\/sender-resource-applications\/?$/ },
  { pageId: 'docs', pattern: /^\/docs\/?$/ },
];

export function normalizeConsolePageId(value) {
  if (value === 'message-send') {
    return DEFAULT_CONSOLE_PAGE_ID;
  }

  return CONSOLE_PAGE_IDS.has(value) ? value : DEFAULT_CONSOLE_PAGE_ID;
}

export function normalizeShellMode(value) {
  return value === 'embed' ? 'embed' : DEFAULT_SHELL_MODE;
}

export function getConsoleNavigationPageId(pageId) {
  const normalizedPageId = normalizeConsolePageId(pageId);

  if (normalizedPageId.startsWith('settings-')) {
    return 'settings';
  }

  if (normalizedPageId.startsWith('templates-')) {
    return 'templates';
  }

  if (
    normalizedPageId.startsWith('automations-') ||
    normalizedPageId === 'publ-event-detail' ||
    normalizedPageId === 'publ-event-new'
  ) {
    return 'automations';
  }

  if (normalizedPageId === 'reservation-detail') {
    return 'reservations';
  }

  if (normalizedPageId === 'log-detail') {
    return 'logs';
  }

  if (normalizedPageId.startsWith('admin-')) {
    return 'admin';
  }

  return normalizedPageId;
}

export function getConsolePagePath(pageId) {
  return ROUTE_BY_CONSOLE_PAGE[normalizeConsolePageId(pageId)] ?? ROUTE_BY_CONSOLE_PAGE[DEFAULT_CONSOLE_PAGE_ID];
}

export function getConsolePageHref({ mode, pageId }) {
  const pathname = getConsolePagePath(pageId);
  return normalizeShellMode(mode) === 'embed' ? `${pathname}?mode=embed` : pathname;
}

export function getConsolePageIdFromPathname(pathname) {
  if (typeof pathname !== 'string') {
    return null;
  }

  const matchingRule = CONSOLE_PATH_ROUTE_RULES.find(({ pattern }) => pattern.test(pathname));
  return matchingRule?.pageId ?? null;
}
