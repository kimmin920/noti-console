'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ConsoleNavigationProvider } from './ConsoleNavigationContext.jsx';
import { AppShell, EmbedShell } from './ConsoleShells.jsx';
import { ConsoleScreenOutlet } from './ConsoleScreenOutlet.jsx';
import { pageMeta } from './consoleConfig.js';
import {
  DEFAULT_CONSOLE_PAGE_ID,
  getConsolePageHref,
  normalizeConsolePageId,
  normalizeShellMode,
} from './routing.js';

export function MessagingConsole({
  getPageHref: getPageHrefOverride,
  hideAccountControl = false,
  mode = 'app',
  pageId = DEFAULT_CONSOLE_PAGE_ID,
  pageProps,
}) {
  const router = useRouter();
  const shellMode = normalizeShellMode(mode);
  const activePage = normalizeConsolePageId(pageId);

  const getPageHref = useCallback((nextPageId) => (
    getPageHrefOverride?.({
      mode: shellMode,
      pageId: nextPageId,
    }) ?? getConsolePageHref({
      mode: shellMode,
      pageId: nextPageId,
    })
  ), [getPageHrefOverride, shellMode]);

  const openDocs = useCallback(() => {
    router.push(getPageHref('docs'));
  }, [getPageHref, router]);

  const activeMeta = pageMeta[activePage] ?? pageMeta[DEFAULT_CONSOLE_PAGE_ID];
  const shellProps = {
    activePage,
    docsHref: getPageHref('docs'),
    getPageHref,
    hideAccountControl,
  };

  const screen = (
    <ConsoleScreenOutlet
      activePage={activePage}
      meta={activeMeta}
      onDocs={openDocs}
      pageProps={pageProps}
    />
  );

  return (
    <ConsoleNavigationProvider mode={shellMode}>
      {shellMode === 'embed'
        ? <EmbedShell {...shellProps}>{screen}</EmbedShell>
        : <AppShell {...shellProps}>{screen}</AppShell>}
    </ConsoleNavigationProvider>
  );
}
