'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, EmbedShell } from './ConsoleShells.jsx';
import { pageMeta } from './consoleConfig.js';
import {
  DEFAULT_CONSOLE_PAGE_ID,
  getConsolePageHref,
  normalizeConsolePageId,
  normalizeShellMode,
} from './routing.js';

export function MessagingConsole({ mode = 'app', pageId = DEFAULT_CONSOLE_PAGE_ID, pageProps }) {
  const router = useRouter();
  const shellMode = normalizeShellMode(mode);
  const activePage = normalizeConsolePageId(pageId);

  const getPageHref = useCallback((nextPageId) => (
    getConsolePageHref({
      mode: shellMode,
      pageId: nextPageId,
    })
  ), [shellMode]);

  const openDocs = useCallback(() => {
    router.push(getPageHref('docs'));
  }, [getPageHref, router]);

  const activeMeta = pageMeta[activePage] ?? pageMeta[DEFAULT_CONSOLE_PAGE_ID];
  const shellProps = {
    activeMeta,
    activePage,
    docsHref: getPageHref('docs'),
    getPageHref,
    onDocs: openDocs,
    pageProps,
  };

  return shellMode === 'embed' ? <EmbedShell {...shellProps} /> : <AppShell {...shellProps} />;
}
