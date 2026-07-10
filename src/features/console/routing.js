export const DEFAULT_CONSOLE_PAGE_ID = 'emails';
export const DEFAULT_SHELL_MODE = 'app';
export const PUBL_CLIENT_PREFIX = '/publ-client';

const ROUTE_DESCRIPTORS = [
  route(DEFAULT_CONSOLE_PAGE_ID, '/message-send'),
  route('automations', '/automations'),
  route('automations-new', '/automations/new'),
  route('publ-event-new', '/automations/publ-events/new'),
  route('publ-event-detail', '/automations/publ-events/:eventKey', {
    props: ({ eventKey }) => ({ publEventDetail: { eventKey } }),
  }),
  route('automations-edit', '/automations/:ruleId/edit', {
    props: ({ ruleId }) => ({ automationDetail: { ruleId } }),
  }),
  route('automations-detail', '/automations/:ruleId', {
    props: ({ ruleId }) => ({ automationDetail: { ruleId } }),
  }),
  route('templates', '/templates'),
  route('templates-sms-new', '/templates/sms/new'),
  route('templates-alimtalk-new', '/templates/alimtalk/new'),
  route('templates-brand-new', '/templates/brand/new'),
  route('templates-detail', '/templates/:channel/:templateCode', {
    props: ({ channel, templateCode }, query) => ({
      templateDetail: {
        channel,
        query: {
          ...(query.get('senderResourceId') ? { senderResourceId: query.get('senderResourceId') } : {}),
          ...(query.get('source') ? { source: query.get('source') } : {}),
          ...(query.get('sourceKey') ? { sourceKey: query.get('sourceKey') } : {}),
        },
        templateCode,
      },
    }),
  }),
  route('audience', '/audience'),
  route('metrics', '/metrics'),
  route('reservations', '/reservations'),
  route('reservation-detail', '/reservations/:groupId', {
    props: ({ groupId }) => ({ reservationDetail: { groupId } }),
  }),
  route('logs', '/logs'),
  route('log-detail', '/logs/:groupId', {
    props: ({ groupId }) => ({ logDetail: { groupId } }),
  }),
  route('settings', '/settings'),
  route('settings-sender-sms-new', '/settings/sender-resources/sms/new'),
  route('settings-sender-kakao-new', '/settings/sender-resources/kakao/new'),
  route('admin-sender-resource-applications', '/admin/sender-resource-applications'),
  route('docs', '/docs'),
];

export const consoleRouteDescriptors = Object.freeze(ROUTE_DESCRIPTORS);

const ROUTES_BY_PAGE_ID = new Map(ROUTE_DESCRIPTORS.map((descriptor) => [descriptor.pageId, descriptor]));
const CONSOLE_PAGE_IDS = new Set(ROUTE_DESCRIPTORS.flatMap(({ pageId }) => (
  pageId === 'admin-sender-resource-applications' ? [pageId, 'admin'] : [pageId]
)));

export function normalizeConsolePageId(value) {
  if (value === 'message-send') {
    return DEFAULT_CONSOLE_PAGE_ID;
  }

  if (value === 'admin') {
    return 'admin-sender-resource-applications';
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

export function buildConsolePath({ pageId, params = {}, queryString = '' } = {}) {
  const descriptor = ROUTES_BY_PAGE_ID.get(normalizeConsolePageId(pageId)) ?? ROUTES_BY_PAGE_ID.get(DEFAULT_CONSOLE_PAGE_ID);
  const pathname = descriptor.build(params);
  return appendQueryString(pathname, queryString);
}

export function buildPublClientPath({ pageId, params = {}, queryString = '' } = {}) {
  return `${PUBL_CLIENT_PREFIX}${buildConsolePath({ pageId, params, queryString })}`;
}

export function getConsolePagePath(pageId) {
  return buildConsolePath({ pageId });
}

export function getConsolePageHref({ mode, pageId }) {
  const pathname = getConsolePagePath(pageId);
  return normalizeShellMode(mode) === 'embed' ? appendQueryString(pathname, 'mode=embed') : pathname;
}

export function getConsolePageIdFromPathname(pathname) {
  const match = matchConsolePath(pathname);
  return match.ok ? match.pageId : null;
}

export function matchConsolePath(value) {
  const parsed = parsePathAndQuery(value);
  if (!parsed) {
    return invalidRoute('invalid_path');
  }

  for (const descriptor of ROUTE_DESCRIPTORS) {
    const params = descriptor.match(parsed.pathname);
    if (params) {
      return routeMatch(descriptor, params, parsed.queryString);
    }
  }

  return invalidRoute('unknown_path');
}

export function matchPublClientPath(value) {
  const parsed = parsePathAndQuery(value);
  if (!parsed || parsed.pathname === PUBL_CLIENT_PREFIX) {
    return routeMatch(ROUTES_BY_PAGE_ID.get(DEFAULT_CONSOLE_PAGE_ID), {}, parsed?.queryString ?? '');
  }

  if (!parsed.pathname.startsWith(`${PUBL_CLIENT_PREFIX}/`)) {
    return invalidRoute('missing_prefix');
  }

  const standalonePathname = parsed.pathname.slice(PUBL_CLIENT_PREFIX.length);
  if (standalonePathname.startsWith(PUBL_CLIENT_PREFIX)) {
    return invalidRoute('duplicate_prefix');
  }

  return matchConsolePath(appendQueryString(standalonePathname, parsed.queryString));
}

export function getPublStandaloneHref(routeMatchResult) {
  if (!routeMatchResult?.ok) {
    return '';
  }

  return appendQueryString(routeMatchResult.canonicalPathname, routeMatchResult.queryString);
}

export function transformConsoleHref(href, { mode } = {}) {
  if (!shouldTransformConsoleHref(href)) {
    return href;
  }

  const shellMode = normalizeShellMode(mode);
  const routeResult = href.startsWith(`${PUBL_CLIENT_PREFIX}/`)
    ? matchPublClientPath(href)
    : matchConsolePath(href);

  if (!routeResult.ok) {
    return href;
  }

  const standaloneHref = getPublStandaloneHref(routeResult);
  return shellMode === 'embed' ? `${PUBL_CLIENT_PREFIX}${standaloneHref}` : standaloneHref;
}

export function shouldTransformConsoleHref(href) {
  if (typeof href !== 'string' || !href.startsWith('/')) {
    return false;
  }

  if (
    href.startsWith('//') ||
    href.startsWith('/api/') ||
    href.startsWith('/_next/') ||
    href.startsWith('/blob:') ||
    href.startsWith('/data:') ||
    href.startsWith('#')
  ) {
    return false;
  }

  return true;
}

function route(pageId, pattern, { props = () => ({}) } = {}) {
  const parts = pattern.split('/').filter(Boolean);

  return Object.freeze({
    build: (params) => buildPath(parts, params),
    match: (pathname) => matchPath(parts, pathname),
    pageId,
    pattern,
    props,
  });
}

function buildPath(parts, params) {
  return `/${parts.map((part) => (
    part.startsWith(':') ? encodeRouteParam(params[part.slice(1)], part.slice(1)) : part
  )).join('/')}`;
}

function matchPath(parts, pathname) {
  const pathParts = pathname.split('/').filter(Boolean);
  if (pathParts.length !== parts.length) {
    return null;
  }

  const params = {};
  for (let index = 0; index < parts.length; index += 1) {
    const patternPart = parts[index];
    const pathPart = pathParts[index];

    if (!patternPart.startsWith(':')) {
      if (patternPart !== pathPart) {
        return null;
      }
      continue;
    }

    const decoded = decodeRouteParam(pathPart);
    if (!decoded) {
      return null;
    }

    params[patternPart.slice(1)] = decoded;
  }

  return params;
}

function routeMatch(descriptor, params, queryString) {
  const query = new URLSearchParams(queryString);
  return {
    canonicalPathname: descriptor.build(params),
    ok: true,
    pageId: descriptor.pageId,
    pageProps: descriptor.props(params, query),
    queryString,
  };
}

function invalidRoute(reason) {
  return {
    canonicalPathname: '',
    ok: false,
    pageId: null,
    pageProps: {},
    queryString: '',
    reason,
  };
}

function encodeRouteParam(value, name) {
  const stringValue = typeof value === 'string' ? value : '';
  if (!stringValue) {
    throw new Error(`${name} is required to build console route.`);
  }

  return encodeURIComponent(stringValue);
}

function decodeRouteParam(value) {
  try {
    const decoded = decodeURIComponent(value);
    return decoded && !decoded.includes('/') && !decoded.includes('\\') ? decoded : null;
  } catch {
    return null;
  }
}

function parsePathAndQuery(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return null;
  }

  const [pathname, queryString = ''] = value.split('?');
  if (!pathname || pathname.includes('\\')) {
    return null;
  }

  return { pathname: trimTrailingSlash(pathname), queryString };
}

function trimTrailingSlash(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

function appendQueryString(pathname, queryString) {
  const normalizedQuery = typeof queryString === 'string' ? queryString.replace(/^\?/, '') : '';
  return normalizedQuery ? `${pathname}?${normalizedQuery}` : pathname;
}
