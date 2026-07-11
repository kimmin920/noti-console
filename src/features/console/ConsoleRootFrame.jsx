'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell, EmbedShell } from './ConsoleShells.jsx';
import {
  getConsolePageHref,
  getConsolePageIdFromPathname,
  normalizeShellMode,
} from './routing.js';

export function ConsoleRootFrame({ children }) {
  const pathname = usePathname();
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
  if (!activePage) {
    return children;
  }

  const shellProps = {
    activePage,
    docsHref: getPageHref('docs'),
    getPageHref,
    hideAccountControl: false,
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
