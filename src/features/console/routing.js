import {
  DEFAULT_ROUTE_PAGE_ID,
  appendRouteQuery,
  consoleRouteDescriptors,
  createInvalidRoute,
  createRouteMatch,
  getRouteDescriptor,
  hasRouteDescriptor,
  matchRouteDescriptor,
  parseRouteLocation,
} from './routeDescriptors.js';

export const DEFAULT_CONSOLE_PAGE_ID = DEFAULT_ROUTE_PAGE_ID;
export const DEFAULT_SHELL_MODE = 'app';
export const PUBL_CLIENT_PREFIX = '/publ-client';
export { consoleRouteDescriptors };

export function normalizeConsolePageId(value) {
  if (value === 'message-send') return DEFAULT_CONSOLE_PAGE_ID;
  if (value === 'admin') return 'admin-sender-resource-applications';
  return hasRouteDescriptor(value) ? value : DEFAULT_CONSOLE_PAGE_ID;
}

export function normalizeShellMode(value) {
  return value === 'embed' ? 'embed' : DEFAULT_SHELL_MODE;
}

export function getConsoleNavigationPageId(pageId) {
  const normalizedPageId = normalizeConsolePageId(pageId);

  if (normalizedPageId.startsWith('settings-')) return 'settings';
  if (normalizedPageId.startsWith('templates-')) return 'templates';
  if (
    normalizedPageId.startsWith('automations-')
    || normalizedPageId === 'publ-event-detail'
    || normalizedPageId === 'publ-event-new'
  ) {
    return 'automations';
  }
  if (normalizedPageId === 'reservation-detail') return 'reservations';
  if (normalizedPageId === 'log-detail') return 'logs';
  if (normalizedPageId.startsWith('admin-')) return 'admin';
  return normalizedPageId;
}

export function buildConsolePath({ pageId, params = {}, queryString = '' } = {}) {
  const descriptor = getRouteDescriptor(normalizeConsolePageId(pageId))
    ?? getRouteDescriptor(DEFAULT_CONSOLE_PAGE_ID);
  return appendRouteQuery(descriptor.build(params), queryString);
}

export function buildPublClientPath({ pageId, params = {}, queryString = '' } = {}) {
  return `${PUBL_CLIENT_PREFIX}${buildConsolePath({ pageId, params, queryString })}`;
}

export function getConsolePagePath(pageId) {
  return buildConsolePath({ pageId });
}

export function getConsolePageHref({ mode, pageId }) {
  const pathname = getConsolePagePath(pageId);
  return normalizeShellMode(mode) === 'embed' ? appendRouteQuery(pathname, 'mode=embed') : pathname;
}

export function getConsolePageIdFromPathname(pathname) {
  const match = matchConsolePath(pathname);
  return match.ok ? match.pageId : null;
}

export function matchConsolePath(value) {
  const parsed = parseRouteLocation(value);
  if (!parsed) return createInvalidRoute('invalid_path');

  const match = matchRouteDescriptor(parsed.pathname);
  return match
    ? createRouteMatch(match.descriptor, match.params, parsed.queryString)
    : createInvalidRoute('unknown_path');
}

export function matchPublClientPath(value) {
  const parsed = parseRouteLocation(value);
  if (!parsed) {
    return createInvalidRoute('invalid_path');
  }
  if (parsed.pathname === PUBL_CLIENT_PREFIX) {
    return createRouteMatch(
      getRouteDescriptor(DEFAULT_CONSOLE_PAGE_ID),
      {},
      parsed.queryString
    );
  }
  if (!parsed.pathname.startsWith(`${PUBL_CLIENT_PREFIX}/`)) {
    return createInvalidRoute('missing_prefix');
  }

  const standalonePathname = parsed.pathname.slice(PUBL_CLIENT_PREFIX.length);
  if (standalonePathname.startsWith(PUBL_CLIENT_PREFIX)) {
    return createInvalidRoute('duplicate_prefix');
  }
  return matchConsolePath(appendRouteQuery(standalonePathname, parsed.queryString));
}

export function getPublStandaloneHref(routeMatchResult) {
  if (!routeMatchResult?.ok) return '';
  return appendRouteQuery(routeMatchResult.canonicalPathname, routeMatchResult.queryString);
}

export function transformConsoleHref(href, { mode } = {}) {
  if (!shouldTransformConsoleHref(href)) return href;

  const shellMode = normalizeShellMode(mode);
  const routeResult = href.startsWith(`${PUBL_CLIENT_PREFIX}/`)
    ? matchPublClientPath(href)
    : matchConsolePath(href);
  if (!routeResult.ok) return href;

  const standaloneHref = getPublStandaloneHref(routeResult);
  return shellMode === 'embed' ? `${PUBL_CLIENT_PREFIX}${standaloneHref}` : standaloneHref;
}

export function shouldTransformConsoleHref(href) {
  if (typeof href !== 'string' || !href.startsWith('/')) return false;
  if (
    href.startsWith('//')
    || href.startsWith('/api/')
    || href.startsWith('/_next/')
    || href.startsWith('/blob:')
    || href.startsWith('/data:')
    || href.startsWith('#')
  ) {
    return false;
  }
  return true;
}
