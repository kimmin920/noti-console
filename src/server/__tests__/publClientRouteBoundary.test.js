import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeLifecycle = vi.hoisted(() => ({
  effects: [],
  isIframe: false,
  snapshotSource: 'client',
  queryClient: {
    cancelQueries: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('react', async (importOriginal) => {
  const react = await importOriginal();

  return {
    ...react,
    useEffect: (effect) => routeLifecycle.effects.push(effect),
    useMemo: (factory) => factory(),
    useSyncExternalStore: (_subscribe, getSnapshot, getServerSnapshot) => (
      routeLifecycle.snapshotSource === 'server'
        ? getServerSnapshot()
        : getSnapshot()
    ),
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => routeLifecycle.queryClient,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }) => ({ children, href }),
}));

vi.mock('../../features/publClient/frameContext.js', () => ({
  isPublIframeContext: () => routeLifecycle.isIframe,
}));

vi.mock('../../features/publClient/authToken.js', () => ({
  clearPublClientTokens: vi.fn(),
}));

vi.mock('../../features/publClient/runtimeSession.js', () => ({
  resetPublClientRuntime: vi.fn(),
}));

import { PublClientConsole } from '../../features/publClient/PublClientConsole.jsx';
import {
  PublClientInvalidRouteView,
  PublClientRouteEntry,
} from '../../features/publClient/PublClientRouteEntry.jsx';

describe('Publ client route boundary', () => {
  beforeEach(() => {
    routeLifecycle.effects = [];
    routeLifecycle.isIframe = false;
    routeLifecycle.snapshotSource = 'client';
    routeLifecycle.queryClient.cancelQueries.mockClear();
    routeLifecycle.queryClient.clear.mockClear();
    vi.unstubAllGlobals();
  });

  it('waits for the iframe client snapshot before deciding standalone navigation', () => {
    const replace = vi.fn();
    routeLifecycle.isIframe = true;
    routeLifecycle.snapshotSource = 'server';
    vi.stubGlobal('window', {
      history: { replaceState: vi.fn(), state: null },
      location: { pathname: '/publ-client/logs/group-1', replace },
    });

    PublClientRouteEntry({ routeResult: createRouteResult() });
    routeLifecycle.effects.forEach((effect) => effect());
    expect(replace).not.toHaveBeenCalled();

    routeLifecycle.effects = [];
    routeLifecycle.snapshotSource = 'client';
    const result = PublClientRouteEntry({ routeResult: createRouteResult() });
    routeLifecycle.effects.forEach((effect) => effect());

    expect(result.type).toBe(PublClientConsole);
    expect(replace).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalledWith('/sign-in');
  });

  it('renders an iframe route without standalone or sign-in navigation', () => {
    const replace = vi.fn();
    routeLifecycle.isIframe = true;
    vi.stubGlobal('window', {
      history: { replaceState: vi.fn(), state: null },
      location: { pathname: '/publ-client/logs/group-1', replace },
    });

    const result = PublClientRouteEntry({
      routeResult: createRouteResult(),
    });
    routeLifecycle.effects.forEach((effect) => effect());

    expect(result.type).toBe(PublClientConsole);
    expect(replace).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalledWith('/sign-in');
  });

  it('strips a registered top-level Publ path to its standalone route', () => {
    const replace = vi.fn();
    routeLifecycle.snapshotSource = 'server';
    vi.stubGlobal('window', {
      location: { pathname: '/publ-client/logs/group-1', replace },
    });

    PublClientRouteEntry({ routeResult: createRouteResult() });
    routeLifecycle.effects.forEach((effect) => effect());
    expect(replace).not.toHaveBeenCalled();

    routeLifecycle.effects = [];
    routeLifecycle.snapshotSource = 'client';
    PublClientRouteEntry({ routeResult: createRouteResult() });
    routeLifecycle.effects.forEach((effect) => effect());

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/logs/group-1?channel=sms');
  });

  it('keeps an invalid top-level route on the controlled invalid view', () => {
    const replace = vi.fn();
    vi.stubGlobal('window', {
      location: { pathname: '/publ-client/not-registered', replace },
    });

    const result = PublClientRouteEntry({
      routeResult: { ok: false, reason: 'unknown_path' },
    });
    routeLifecycle.effects.forEach((effect) => effect());

    expect(result.type).toBe(PublClientInvalidRouteView);
    expect(replace).not.toHaveBeenCalled();
  });
});

function createRouteResult() {
  return {
    canonicalPathname: '/logs/group-1',
    ok: true,
    pageId: 'log-detail',
    pageProps: { logDetail: { groupId: 'group-1' } },
    queryString: 'channel=sms',
  };
}
