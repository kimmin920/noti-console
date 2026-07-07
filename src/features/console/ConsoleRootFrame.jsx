'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppShell, EmbedShell } from './ConsoleShells.jsx';
import { pageMeta } from './consoleConfig.js';
import {
  DEFAULT_CONSOLE_PAGE_ID,
  getConsolePageHref,
  getConsolePageIdFromPathname,
  normalizeShellMode,
} from './routing.js';

export function ConsoleRootFrame({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchText = useSyncExternalStore(
    subscribeToLocationChange,
    getBrowserLocationSearch,
    getServerLocationSearch
  );
  const shellMode = normalizeShellMode(new URLSearchParams(searchText).get('mode'));
  const activePage = getConsolePageIdFromPathname(pathname);
  const getPageHref = useCallback((nextPageId) => (
    getConsolePageHref({
      mode: shellMode,
      pageId: nextPageId,
    })
  ), [shellMode]);
  const openDocs = useCallback(() => {
    router.push(getPageHref('docs'));
  }, [getPageHref, router]);

  if (!activePage) {
    return children;
  }

  const activeMeta = pageMeta[activePage] ?? pageMeta[DEFAULT_CONSOLE_PAGE_ID];
  const shellProps = {
    activeMeta,
    activePage,
    docsHref: getPageHref('docs'),
    getPageHref,
    hideAccountControl: false,
    onDocs: openDocs,
  };

  return shellMode === 'embed' ? (
    <EmbedShell {...shellProps}>{children}</EmbedShell>
  ) : (
    <AppShell {...shellProps}>{children}</AppShell>
  );
}

function subscribeToLocationChange(onStoreChange) {
  window.addEventListener('popstate', onStoreChange);
  return () => window.removeEventListener('popstate', onStoreChange);
}

function getBrowserLocationSearch() {
  return window.location.search;
}

function getServerLocationSearch() {
  return '';
}
