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
    next: vi.fn(() => {
      proxyMocks.nextCalls.push('next');
      return { type: 'next' };
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

  it('keeps public routes outside Clerk middleware', async () => {
    const proxy = await loadProxy();
    const response = await proxy(new Request('http://localhost:3000/'), {});

    expect(response).toEqual({ type: 'next' });
    expect(proxyMocks.clerkInvocations).toEqual([]);
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

    expect(response).toEqual({ type: 'next' });
    expect(proxyMocks.clerkInvocations).toEqual([]);
    expect(proxyMocks.protectCalls).toEqual([]);
  });

  it('passes relay APIs through Clerk middleware without enforcing route protection', async () => {
    const proxy = await loadProxy();
    const response = await proxy(new Request('http://localhost:3000/api/sender-resources'), {});

    expect(response).toEqual({ type: 'next' });
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

    expect(response).toEqual({ type: 'next' });
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
