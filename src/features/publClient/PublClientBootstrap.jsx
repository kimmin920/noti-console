'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCcw, ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/index.js';
import { MessagingConsole } from '../console/MessagingConsole.jsx';
import {
  DEFAULT_CONSOLE_PAGE_ID,
  buildPublClientPath,
} from '../console/routing.js';
import {
  bootstrapPublClientSession,
  refreshPublClientSession,
  resolvePublSdkAdapter,
} from './sdkAdapter.js';
import {
  isPublClientSdkAvailable,
  loadPublClientSdkScript,
} from './sdkScriptLoader.js';
import {
  hasPublClientRefreshTokenHandler,
  registerPublClientRefreshTokenHandler,
} from './authToken.js';
import { isPublIframeContext } from './frameContext.js';
import { PublClientProvider } from './PublClientContext.jsx';
import {
  activatePublClientRuntime,
  getIdentity,
} from './runtimeSession.js';

const CONNECTING_STATE = {
  message: 'Publ iframe 연결을 확인하고 있습니다.',
  status: 'connecting',
  title: '연결 확인 중',
};

const REFRESH_FAILED_STATE = {
  message: '세션을 다시 연결해야 합니다. 재시도하면 Publ SDK를 통해 새 토큰을 요청합니다.',
  status: 'refresh-error',
  title: '세션을 갱신하지 못했습니다',
};

const SDK_NOT_CONFIGURED_STATE = {
  message: 'Publ SDK script 주소가 설정되지 않았습니다. 테스트베드 연결 값을 확인해 주세요.',
  status: 'sdk-not-configured',
  title: 'Publ SDK 설정이 필요합니다',
};

const SDK_LOAD_FAILED_STATE = {
  message: 'Publ SDK script를 불러오지 못했습니다. 네트워크와 SDK URL을 확인한 뒤 다시 시도해 주세요.',
  status: 'sdk-load-error',
  title: 'Publ SDK를 불러오지 못했습니다',
};

export function PublClientBootstrap({
  children = null,
  clientConfig = null,
  clientConfigError = '',
  pageId = DEFAULT_CONSOLE_PAGE_ID,
  pageProps = undefined,
  routeResult = null,
}) {
  const queryClient = useQueryClient();
  const [initialSessionInput] = useState(() => ({
    clientConfig,
    clientConfigError,
    routeResult,
  }));
  const [attempt, setAttempt] = useState(0);
  const [sessionState, setSessionState] = useState(CONNECTING_STATE);
  const stableClientConfig = initialSessionInput.clientConfig;
  const stableClientConfigError = initialSessionInput.clientConfigError;
  const initialRouteResult = initialSessionInput.routeResult;
  const getPageHref = useCallback(({ pageId: nextPageId }) => (
    buildPublClientPath({ pageId: nextPageId })
  ), []);

  useEffect(() => {
    let cancelled = false;

    async function startPublSession() {
      setSessionState(CONNECTING_STATE);

      if (!isPublIframeContext()) {
        setSessionState({
          message: 'Publ client는 iframe 안에서만 열 수 있습니다.',
          status: 'invalid-context',
          title: 'Publ client 경로를 확인해 주세요',
        });
        return;
      }

      if (!stableClientConfig) {
        setSessionState({
          message: stableClientConfigError || 'Publ client 설정을 확인해 주세요.',
          status: 'misconfigured',
          title: 'Publ client 설정이 올바르지 않습니다',
        });
        return;
      }

      let adapter = resolvePublSdkAdapter({ clientConfig: stableClientConfig });
      if (!adapter && !isPublClientSdkAvailable()) {
        if (!stableClientConfig.sdkSrc) {
          setSessionState(SDK_NOT_CONFIGURED_STATE);
          return;
        }

        try {
          await loadPublClientSdkScript(stableClientConfig.sdkSrc);
        } catch {
          if (!cancelled) {
            setSessionState(SDK_LOAD_FAILED_STATE);
          }
          return;
        }

        adapter = resolvePublSdkAdapter({ clientConfig: stableClientConfig });
      }

      await queryClient.cancelQueries();
      queryClient.clear();

      if (getIdentity() && hasPublClientRefreshTokenHandler()) {
        setSessionState({
          adapter,
          message: '',
          ok: true,
          status: 'ready',
          title: '연결되었습니다',
        });
        return;
      }

      const result = await bootstrapPublClientSession({ adapter, clientConfig: stableClientConfig });

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setSessionState(result);
        return;
      }

      registerPublClientRefreshTokenHandler(async ({
        previousAccessToken,
        refreshToken,
      }) => {
        try {
          return await refreshPublClientSession({
            adapter,
            clientConfig: stableClientConfig,
            previousAccessToken,
            refreshToken,
          });
        } catch (error) {
          setSessionState(REFRESH_FAILED_STATE);
          throw error;
        }
      });

      if (!activatePublClientRuntime({
        originPolicyConfigured: Boolean(stableClientConfig?.framePolicy?.configured),
      })) {
        setSessionState({
          message: 'Publ iframe origin policy or local session is not active.',
          status: 'misconfigured',
          title: 'Publ client 연결을 활성화할 수 없습니다',
        });
        return;
      }

      setSessionState({ ...result, adapter });
      canonicalizePublClientPath(initialRouteResult);
    }

    startPublSession();

    return () => {
      cancelled = true;
    };
  }, [attempt, initialRouteResult, queryClient, stableClientConfig, stableClientConfigError]);

  if (sessionState.status === 'ready') {
    return (
      <PublClientProvider adapter={sessionState.adapter} clientConfig={stableClientConfig}>
        {children ?? (
          <MessagingConsole
            getPageHref={getPageHref}
            hideAccountControl
            mode="embed"
            pageId={routeResult?.pageId ?? pageId}
            pageProps={routeResult?.pageProps ?? pageProps}
          />
        )}
      </PublClientProvider>
    );
  }

  return (
    <PublClientStatusView
      onRetry={() => setAttempt((currentAttempt) => currentAttempt + 1)}
      state={sessionState}
    />
  );
}

function canonicalizePublClientPath(routeResult) {
  if (
    routeResult?.ok &&
    routeResult.canonicalPathname === '/message-send' &&
    window.location.pathname === '/publ-client'
  ) {
    window.history.replaceState(
      window.history.state,
      '',
      buildPublClientPath({ pageId: DEFAULT_CONSOLE_PAGE_ID, queryString: routeResult.queryString })
    );
  }
}

export function PublClientStatusView({ onRetry, state }) {
  const isConnecting = state.status === 'connecting' || state.status === 'redirecting';

  return (
    <main className="publ-client-boot" aria-labelledby="publ-client-boot-title">
      <section
        className="publ-client-boot-panel"
        role={isConnecting ? 'status' : 'alert'}
      >
        <span className="publ-client-boot-icon" aria-hidden="true">
          {isConnecting ? <RefreshCcw size={18} /> : <ShieldAlert size={18} />}
        </span>
        <div className="publ-client-boot-copy">
          <p className="publ-client-boot-kicker">Publ client</p>
          <h1 id="publ-client-boot-title">{state.title}</h1>
          <p>{state.message}</p>
        </div>
        {!isConnecting ? (
          <Button onClick={onRetry} variant="primary">
            <RefreshCcw aria-hidden="true" size={15} />
            다시 시도
          </Button>
        ) : null}
      </section>
    </main>
  );
}
