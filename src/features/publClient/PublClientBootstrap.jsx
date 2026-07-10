'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCcw, ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/index.js';
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
  createPublClientRuntimeStorage,
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
}) {
  const queryClient = useQueryClient();
  const [initialSessionInput] = useState(() => ({
    clientConfig,
    clientConfigError,
  }));
  const [attempt, setAttempt] = useState(0);
  const [sessionState, setSessionState] = useState(CONNECTING_STATE);
  const lifecycleRef = useRef({ active: false, attempt: null, promise: null });
  const isIframe = useSyncExternalStore(
    subscribeFrameContext,
    getFrameContextSnapshot,
    getServerFrameContextSnapshot
  );
  const stableClientConfig = initialSessionInput.clientConfig;
  const stableClientConfigError = initialSessionInput.clientConfigError;
  const handleRefreshError = useCallback(() => {
    setSessionState(REFRESH_FAILED_STATE);
  }, []);

  useEffect(() => {
    const lifecycle = lifecycleRef.current;
    let cancelled = false;

    lifecycle.active = isIframe;
    if (!isIframe) {
      return () => {
        lifecycle.active = false;
      };
    }

    if (lifecycle.attempt !== attempt) {
      lifecycle.attempt = attempt;
      lifecycle.promise = initializePublClientSession({
        clientConfig: stableClientConfig,
        clientConfigError: stableClientConfigError,
        onRefreshError: handleRefreshError,
        queryClient,
        shouldContinue: () => lifecycle.active && lifecycle.attempt === attempt,
      });
    }

    lifecycle.promise.then((nextState) => {
      if (!cancelled && lifecycle.active && lifecycle.attempt === attempt && nextState) {
        setSessionState(nextState);
      }
    });

    return () => {
      cancelled = true;
      lifecycle.active = false;
    };
  }, [
    attempt,
    handleRefreshError,
    isIframe,
    queryClient,
    stableClientConfig,
    stableClientConfigError,
  ]);

  if (!isIframe) {
    return children;
  }

  if (sessionState.status === 'ready') {
    return (
      <PublClientProvider adapter={sessionState.adapter} clientConfig={stableClientConfig}>
        {children}
      </PublClientProvider>
    );
  }

  return (
    <PublClientStatusView
      onRetry={() => {
        setSessionState(CONNECTING_STATE);
        setAttempt((currentAttempt) => currentAttempt + 1);
      }}
      state={sessionState}
    />
  );
}

async function initializePublClientSession({
  clientConfig,
  clientConfigError,
  onRefreshError,
  queryClient,
  shouldContinue,
}) {
  if (!clientConfig) {
    return {
      message: clientConfigError || 'Publ client 설정을 확인해 주세요.',
      status: 'misconfigured',
      title: 'Publ client 설정이 올바르지 않습니다',
    };
  }

  let adapter = resolvePublSdkAdapter({ clientConfig });
  if (!adapter && !isPublClientSdkAvailable()) {
    if (!clientConfig.sdkSrc) {
      return SDK_NOT_CONFIGURED_STATE;
    }

    try {
      await loadPublClientSdkScript(clientConfig.sdkSrc);
    } catch {
      return shouldContinue() ? SDK_LOAD_FAILED_STATE : null;
    }

    if (!shouldContinue()) return null;
    adapter = resolvePublSdkAdapter({ clientConfig });
  }

  await queryClient.cancelQueries();
  if (!shouldContinue()) return null;
  queryClient.clear();

  if (getIdentity() && hasPublClientRefreshTokenHandler()) {
    return {
      adapter,
      message: '',
      ok: true,
      status: 'ready',
      title: '연결되었습니다',
    };
  }

  const result = await bootstrapPublClientSession({ adapter, clientConfig });
  if (!shouldContinue()) return null;
  if (!result.ok) return result;

  registerPublClientRefreshTokenHandler(async ({ previousAccessToken, refreshToken }) => {
    const refreshIdentity = getIdentity();
    const storage = createPublClientRuntimeStorage({ identity: refreshIdentity });
    const shouldApplyResult = storage.isActive;

    try {
      return await refreshPublClientSession({
        adapter,
        clientConfig,
        previousAccessToken,
        refreshToken,
        shouldApplyResult,
        storage,
      });
    } catch (error) {
      if (shouldApplyResult()) {
        onRefreshError();
      }
      throw error;
    }
  });

  if (!activatePublClientRuntime({
    originPolicyConfigured: Boolean(clientConfig.framePolicy?.configured),
  })) {
    return {
      message: 'Publ iframe origin policy or local session is not active.',
      status: 'misconfigured',
      title: 'Publ client 연결을 활성화할 수 없습니다',
    };
  }

  return { ...result, adapter };
}

function subscribeFrameContext() {
  return () => {};
}

function getFrameContextSnapshot() {
  return isPublIframeContext();
}

function getServerFrameContextSnapshot() {
  return false;
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
