import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const lifecycle = vi.hoisted(() => ({
  bootstrapSession: null,
  effect: null,
  hasRefreshHandler: false,
  identity: null,
  queryClient: {
    cancelQueries: vi.fn(async () => {}),
    clear: vi.fn(),
  },
  refs: [],
  refIndex: 0,
  refreshHandler: null,
  refreshSession: null,
  stateIndex: 0,
  states: [],
}));

vi.mock('react', async (importOriginal) => {
  const react = await importOriginal();

  return {
    ...react,
    useCallback: (callback) => callback,
    useEffect: (effect) => {
      lifecycle.effect = effect;
    },
    useRef: (initialValue) => {
      const index = lifecycle.refIndex;
      lifecycle.refIndex += 1;
      lifecycle.refs[index] ??= { current: initialValue };
      return lifecycle.refs[index];
    },
    useState: (initialValue) => {
      const index = lifecycle.stateIndex;
      lifecycle.stateIndex += 1;
      lifecycle.states[index] ??= typeof initialValue === 'function' ? initialValue() : initialValue;
      return [
        lifecycle.states[index],
        (value) => {
          lifecycle.states[index] = typeof value === 'function'
            ? value(lifecycle.states[index])
            : value;
        },
      ];
    },
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => lifecycle.queryClient,
}));

vi.mock('../../features/publClient/sdkAdapter.js', () => ({
  bootstrapPublClientSession: (...args) => lifecycle.bootstrapSession(...args),
  refreshPublClientSession: (...args) => lifecycle.refreshSession(...args),
  resolvePublSdkAdapter: () => ({ exchangeToken: vi.fn(), refreshToken: vi.fn() }),
}));

vi.mock('../../features/publClient/sdkScriptLoader.js', () => ({
  isPublClientSdkAvailable: () => true,
  loadPublClientSdkScript: vi.fn(),
}));

vi.mock('../../features/publClient/authToken.js', () => ({
  hasPublClientRefreshTokenHandler: () => lifecycle.hasRefreshHandler,
  registerPublClientRefreshTokenHandler: (handler) => {
    lifecycle.hasRefreshHandler = true;
    lifecycle.refreshHandler = handler;
  },
}));

vi.mock('../../features/publClient/frameContext.js', () => ({
  isPublIframeContext: () => true,
}));

vi.mock('../../features/publClient/runtimeSession.js', () => ({
  activatePublClientRuntime: () => {
    lifecycle.identity = { generation: 1 };
    return true;
  },
  createPublClientRuntimeStorage: ({ identity }) => ({
    isActive: () => identity?.generation === lifecycle.identity?.generation,
  }),
  getIdentity: () => lifecycle.identity,
}));

vi.mock('../../features/publClient/PublClientContext.jsx', () => ({
  PublClientProvider: ({ children }) => children,
}));

vi.mock('../../features/console/MessagingConsole.jsx', () => ({
  MessagingConsole: () => null,
}));

vi.mock('../../components/ui/index.js', () => ({
  Button: ({ children }) => createElement('button', null, children),
}));

import { PublClientBootstrap } from '../../features/publClient/PublClientBootstrap.jsx';

describe('Publ client bootstrap lifecycle', () => {
  beforeEach(() => {
    lifecycle.bootstrapSession = vi.fn(async () => ({
      message: '',
      ok: true,
      status: 'ready',
      title: 'ready',
    }));
    lifecycle.effect = null;
    lifecycle.hasRefreshHandler = false;
    lifecycle.identity = null;
    lifecycle.queryClient.cancelQueries.mockClear();
    lifecycle.queryClient.clear.mockClear();
    lifecycle.refs = [];
    lifecycle.refIndex = 0;
    lifecycle.refreshHandler = null;
    lifecycle.refreshSession = vi.fn();
    lifecycle.stateIndex = 0;
    lifecycle.states = [];
  });

  it('exchanges exactly once when a fresh mount effect is replayed', async () => {
    PublClientBootstrap({
      children: createElement('div'),
      clientConfig: { framePolicy: { configured: true } },
    });

    const firstCleanup = lifecycle.effect();
    firstCleanup();
    const secondCleanup = lifecycle.effect();
    await flushPromises();

    expect(lifecycle.bootstrapSession).toHaveBeenCalledTimes(1);
    secondCleanup();
  });

  it('ignores stale refresh failure state after the active runtime identity changes', async () => {
    const refreshStarted = createDeferred();
    const refreshResult = createDeferred();
    lifecycle.refreshSession = vi.fn(() => {
      refreshStarted.resolve();
      return refreshResult.promise;
    });
    PublClientBootstrap({
      children: createElement('div'),
      clientConfig: { framePolicy: { configured: true } },
    });
    lifecycle.effect();
    await flushPromises();
    expect(lifecycle.states[2]).toMatchObject({ status: 'ready' });

    const staleRefresh = lifecycle.refreshHandler({
      previousAccessToken: 'merchant-a-access',
      refreshToken: 'merchant-a-refresh',
    });
    await refreshStarted.promise;
    lifecycle.identity = { generation: 2, identityKey: 'merchant-b' };
    refreshResult.reject(new Error('merchant A refresh failed'));

    await expect(staleRefresh).rejects.toThrow('merchant A refresh failed');
    expect(lifecycle.states[2]).toMatchObject({ status: 'ready' });
    expect(lifecycle.queryClient.clear).toHaveBeenCalledTimes(1);
  });
});

async function flushPromises() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
}

function createDeferred() {
  let reject;
  let resolve;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    reject = rejectPromise;
    resolve = resolvePromise;
  });

  return { promise, reject, resolve };
}
