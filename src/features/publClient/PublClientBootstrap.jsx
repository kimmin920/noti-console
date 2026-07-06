'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCcw, ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/index.js';
import { MessagingConsole } from '../console/MessagingConsole.jsx';
import {
  DEFAULT_CONSOLE_PAGE_ID,
  normalizeConsolePageId,
} from '../console/routing.js';
import {
  bootstrapPublClientSession,
  getPublClientPageHref,
  refreshPublClientSession,
  resolvePublSdkAdapter,
} from './sdkAdapter.js';
import { registerPublClientRefreshTokenHandler } from './authToken.js';

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

export function PublClientBootstrap({ pageId = DEFAULT_CONSOLE_PAGE_ID }) {
  const [attempt, setAttempt] = useState(0);
  const [sessionState, setSessionState] = useState(CONNECTING_STATE);
  const activePageId = normalizeConsolePageId(pageId);
  const getPageHref = useCallback(({ pageId: nextPageId }) => (
    getPublClientPageHref({ pageId: normalizeConsolePageId(nextPageId) })
  ), []);

  useEffect(() => {
    let cancelled = false;
    let unregisterRefreshHandler = null;

    async function startPublSession() {
      setSessionState(CONNECTING_STATE);

      const adapter = resolvePublSdkAdapter();
      const result = await bootstrapPublClientSession({ adapter });

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setSessionState(result);
        return;
      }

      unregisterRefreshHandler = registerPublClientRefreshTokenHandler(async ({
        previousAccessToken,
        refreshToken,
      }) => {
        try {
          return await refreshPublClientSession({
            adapter,
            previousAccessToken,
            refreshToken,
          });
        } catch (error) {
          setSessionState(REFRESH_FAILED_STATE);
          throw error;
        }
      });

      setSessionState(result);
    }

    startPublSession();

    return () => {
      cancelled = true;
      unregisterRefreshHandler?.();
    };
  }, [attempt]);

  if (sessionState.status === 'ready') {
    return (
      <MessagingConsole
        getPageHref={getPageHref}
        hideAccountControl
        mode="embed"
        pageId={activePageId}
      />
    );
  }

  return (
    <PublClientStatusView
      onRetry={() => setAttempt((currentAttempt) => currentAttempt + 1)}
      state={sessionState}
    />
  );
}

export function PublClientStatusView({ onRetry, state }) {
  const isConnecting = state.status === 'connecting';

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
