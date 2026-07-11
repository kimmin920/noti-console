import { beforeEach, describe, expect, it, vi } from 'vitest';

const proxyMocks = vi.hoisted(() => ({
  clerkInvocations: [],
  nextCalls: [],
  protectCalls: [],
}));

const DEV_BROWSER_AUTH_USER_ID_COOKIE = '__dev_auth_user_id';
const RELAY_DEV_AUTH_HEADER_ENABLED_ENV = 'RELAY_DEV_AUTH_HEADER_ENABLED';

vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (handler) => async (request, event) => {
    const pathname = new URL(request.url).pathname;
    proxyMocks.clerkInvocations.push(pathname);

    const auth = {
      protect: vi.fn(async () => {
        proxyMocks.protectCalls.push(pathname);
      }),
    };

    return await handler(auth, request, event) ?? { type: 'clerk-next' };
  },
  createRouteMatcher: (patterns) => (request) => {
    const pathname = new URL(request.url).pathname;
    return patterns.some((pattern) => matchesRoutePattern(pattern, pathname));
  },
}));

vi.mock('next/server', () => ({
  NextResponse: {
    next: vi.fn((init) => {
      proxyMocks.nextCalls.push('next');
      return {
        headers: new Headers(init?.headers),
        type: 'next',
      };
    }),
  },
}));

describe('proxy auth context contract', () => {
  beforeEach(() => {
    proxyMocks.clerkInvocations.length = 0;
    proxyMocks.nextCalls.length = 0;
    proxyMocks.protectCalls.length = 0;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each(['/', '/sign-in', '/sign-up'])('passes public auth route %s through Clerk context without protection', async (path) => {
    const proxy = await loadProxy();
    const response = await proxy(new Request(`http://localhost:3000${path}`), {});

    expect(response.type).toBe('next');
    expect(proxyMocks.clerkInvocations).toEqual([path]);
    expect(proxyMocks.protectCalls).toEqual([]);
  });

  it.each([
    '/publ-client',
    '/publ-client/embed',
    '/integrations/exchange-token',
    '/integrations/refresh-token',
  ])('keeps Publ public route %s outside Clerk middleware', async (path) => {
    const proxy = await loadProxy();
    const response = await proxy(new Request(`http://localhost:3000${path}?apiKey=publ-key`), {});

    expect(response.type).toBe('next');
    expect(proxyMocks.clerkInvocations).toEqual([]);
    expect(proxyMocks.protectCalls).toEqual([]);
  });

  it('passes relay APIs through Clerk middleware without enforcing route protection', async () => {
    const proxy = await loadProxy();
    const response = await proxy(new Request('http://localhost:3000/api/sender-resources'), {});

    expect(response.type).toBe('next');
    expect(proxyMocks.clerkInvocations).toEqual(['/api/sender-resources']);
    expect(proxyMocks.protectCalls).toEqual([]);
  });

  it('protects console app routes', async () => {
    const proxy = await loadProxy();
    const response = await proxy(new Request('http://localhost:3000/message-send'), {});

    expect(response).toEqual({ type: 'clerk-next' });
    expect(proxyMocks.clerkInvocations).toEqual(['/message-send']);
    expect(proxyMocks.protectCalls).toEqual(['/message-send']);
  });

  it('lets dev browser auth cookies bypass Clerk protection on console app routes', async () => {
    vi.stubEnv(RELAY_DEV_AUTH_HEADER_ENABLED_ENV, 'true');
    const proxy = await loadProxy();
    const response = await proxy(createRequestWithDevAuthCookie('http://localhost:3000/message-send'), {});

    expect(response.type).toBe('next');
    expect(proxyMocks.clerkInvocations).toEqual([]);
    expect(proxyMocks.protectCalls).toEqual([]);
  });

  it('does not let dev browser auth cookies bypass Clerk protection in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv(RELAY_DEV_AUTH_HEADER_ENABLED_ENV, 'true');
    const proxy = await loadProxy();
    const response = await proxy(createRequestWithDevAuthCookie('http://localhost:3000/message-send'), {});

    expect(response).toEqual({ type: 'clerk-next' });
    expect(proxyMocks.clerkInvocations).toEqual(['/message-send']);
    expect(proxyMocks.protectCalls).toEqual(['/message-send']);
  });

  it.each([
    '/publ-client',
    '/publ-client/embed/settings',
    '/publ-client/foo.csv',
    '/publ-client/foo.js',
  ])('sets the selected Publ frame-ancestors CSP on %s', async (path) => {
    vi.stubEnv('PUBL_PAPP_CLIENT_STAGE', 'test');
    vi.stubEnv('PUBL_PAPP_TEST_PARENT_ORIGINS', 'https://console.dev.publ.biz');
    const proxy = await loadProxy();
    const response = await proxy(new Request(`http://localhost:3000${path}`), {});

    expect(response.type).toBe('next');
    expect(response.headers.get('content-security-policy')).toBe(
      'frame-ancestors https://console.dev.publ.biz'
    );
    expect(proxyMocks.clerkInvocations).toEqual([]);
  });

  it('sets frame-ancestors none when Publ origin policy is missing', async () => {
    const proxy = await loadProxy();
    const response = await proxy(new Request('http://localhost:3000/publ-client'), {});

    expect(response.headers.get('content-security-policy')).toBe("frame-ancestors 'none'");
  });

  it('keeps static assets outside Publ client excluded from the proxy matcher', async () => {
    const { config } = await import('../../proxy.js');

    expect(matchesAnyMatcher(config.matcher, '/publ-client/foo.csv')).toBe(true);
    expect(matchesAnyMatcher(config.matcher, '/logo.svg')).toBe(false);
    expect(matchesAnyMatcher(config.matcher, '/_next/static/app.js')).toBe(false);
  });
});

async function loadProxy() {
  const proxyModule = await import('../../proxy.js');
  return proxyModule.default;
}

function createRequestWithDevAuthCookie(url) {
  return new Request(url, {
    headers: {
      cookie: `${DEV_BROWSER_AUTH_USER_ID_COOKIE}=operator_1`,
    },
  });
}

function matchesRoutePattern(pattern, pathname) {
  if (pattern.endsWith('(.*)')) {
    return pathname.startsWith(pattern.slice(0, -4));
  }

  return pathname === pattern;
}

function matchesAnyMatcher(matchers, pathname) {
  return matchers.some((matcher) => {
    if (matcher === '/publ-client/:path*') {
      return pathname === '/publ-client' || pathname.startsWith('/publ-client/');
    }

    return new RegExp(`^${matcher}$`).test(pathname);
  });
}
