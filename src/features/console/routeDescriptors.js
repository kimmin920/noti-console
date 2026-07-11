export const DEFAULT_ROUTE_PAGE_ID = 'emails';

export const consoleRouteDescriptors = Object.freeze([
  route(DEFAULT_ROUTE_PAGE_ID, '/message-send'),
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
]);

const routesByPageId = new Map(
  consoleRouteDescriptors.map((descriptor) => [descriptor.pageId, descriptor])
);

export function getRouteDescriptor(pageId) {
  return routesByPageId.get(pageId) ?? null;
}

export function hasRouteDescriptor(pageId) {
  return routesByPageId.has(pageId);
}

export function matchRouteDescriptor(pathname) {
  for (const descriptor of consoleRouteDescriptors) {
    const params = descriptor.match(pathname);
    if (params) return { descriptor, params };
  }

  return null;
}

export function createRouteMatch(descriptor, params, queryString) {
  const query = new URLSearchParams(queryString);
  return {
    canonicalPathname: descriptor.build(params),
    ok: true,
    pageId: descriptor.pageId,
    pageProps: descriptor.props(params, query),
    queryString,
  };
}

export function createInvalidRoute(reason) {
  return {
    canonicalPathname: '',
    ok: false,
    pageId: null,
    pageProps: {},
    queryString: '',
    reason,
  };
}

export function parseRouteLocation(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return null;

  const [pathname, queryString = ''] = value.split('?');
  if (!pathname || pathname.includes('\\')) return null;
  return { pathname: trimTrailingSlash(pathname), queryString };
}

export function appendRouteQuery(pathname, queryString) {
  const normalizedQuery = typeof queryString === 'string' ? queryString.replace(/^\?/, '') : '';
  return normalizedQuery ? `${pathname}?${normalizedQuery}` : pathname;
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
  if (pathParts.length !== parts.length) return null;

  const params = {};
  for (let index = 0; index < parts.length; index += 1) {
    const patternPart = parts[index];
    const pathPart = pathParts[index];
    if (!patternPart.startsWith(':')) {
      if (patternPart !== pathPart) return null;
      continue;
    }

    const decoded = decodeRouteParam(pathPart);
    if (!decoded) return null;
    params[patternPart.slice(1)] = decoded;
  }

  return params;
}

function encodeRouteParam(value, name) {
  const stringValue = typeof value === 'string' ? value : '';
  if (!stringValue) throw new Error(`${name} is required to build console route.`);
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

function trimTrailingSlash(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}
