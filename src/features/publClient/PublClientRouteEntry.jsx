'use client';

import Link from 'next/link';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import {
  buildPublClientPath,
  DEFAULT_CONSOLE_PAGE_ID,
  getPublStandaloneHref,
} from '../console/routing.js';
import { clearPublClientTokens } from './authToken.js';
import { isPublIframeContext } from './frameContext.js';
import { PublClientConsole } from './PublClientConsole.jsx';
import { resetPublClientRuntime } from './runtimeSession.js';

export function PublClientRouteEntry({ routeResult }) {
  const queryClient = useQueryClient();
  const frameContext = useSyncExternalStore(subscribeFrameContext, getFrameContextSnapshot, getServerFrameContextSnapshot);
  const standaloneHref = useMemo(() => getPublStandaloneHref(routeResult), [routeResult]);

  useEffect(() => {
    if (!routeResult?.ok || frameContext === null) {
      return;
    }

    if (frameContext) {
      canonicalizePublClientPath(routeResult);
      return;
    }

    resetPublClientRuntime();
    clearPublClientTokens();
    queryClient.cancelQueries();
    queryClient.clear();
    window.location.replace(standaloneHref);
  }, [frameContext, queryClient, routeResult, standaloneHref]);

  if (!routeResult?.ok) {
    return <PublClientInvalidRouteView />;
  }

  if (!frameContext) {
    return (
      <main className="publ-client-boot" aria-labelledby="publ-client-redirect-title">
        <section className="publ-client-boot-panel" role="status">
          <div className="publ-client-boot-copy">
            <p className="publ-client-boot-kicker">Publ client</p>
            <h1 id="publ-client-redirect-title">콘솔로 이동 중</h1>
            <p>일반 웹 콘솔로 이동하고 있습니다.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <PublClientConsole
      pageId={routeResult.pageId}
      pageProps={routeResult.pageProps}
    />
  );
}

function canonicalizePublClientPath(routeResult) {
  if (
    routeResult.canonicalPathname === '/message-send'
    && window.location.pathname === '/publ-client'
  ) {
    window.history.replaceState(
      window.history.state,
      '',
      buildPublClientPath({
        pageId: DEFAULT_CONSOLE_PAGE_ID,
        queryString: routeResult.queryString,
      })
    );
  }
}

function subscribeFrameContext() {
  return () => {};
}

function getFrameContextSnapshot() {
  return isPublIframeContext();
}

function getServerFrameContextSnapshot() {
  return null;
}

export function PublClientInvalidRouteView() {
  return (
    <main className="publ-client-boot" aria-labelledby="publ-client-invalid-route-title">
      <section className="publ-client-boot-panel" role="alert">
        <span className="publ-client-boot-icon" aria-hidden="true">
          <ShieldAlert size={18} />
        </span>
        <div className="publ-client-boot-copy">
          <p className="publ-client-boot-kicker">Publ client</p>
          <h1 id="publ-client-invalid-route-title">열 수 없는 경로입니다</h1>
          <p>요청한 Publ client 경로가 등록된 콘솔 화면과 일치하지 않습니다.</p>
        </div>
        <Link className="button secondary" href="/publ-client/message-send">메시지 발송으로 이동</Link>
      </section>
    </main>
  );
}
