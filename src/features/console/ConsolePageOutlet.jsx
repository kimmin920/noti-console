'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ConsolePages } from './ConsolePages.jsx';
import { pageMeta } from './consoleConfig.js';
import {
  DEFAULT_CONSOLE_PAGE_ID,
  getConsolePageHref,
  normalizeConsolePageId,
  normalizeShellMode,
} from './routing.js';

export function ConsolePageOutlet({ mode, pageId, pageProps }) {
  const router = useRouter();
  const activePage = normalizeConsolePageId(pageId);
  const shellMode = normalizeShellMode(mode);
  const openDocs = useCallback(() => {
    router.push(getConsolePageHref({
      mode: shellMode,
      pageId: 'docs',
    }));
  }, [router, shellMode]);
  const activeMeta = pageMeta[activePage] ?? pageMeta[DEFAULT_CONSOLE_PAGE_ID];

  return (
    <ConsolePages
      activePage={activePage}
      meta={activeMeta}
      onDocs={openDocs}
      pageProps={pageProps}
    />
  );
}
