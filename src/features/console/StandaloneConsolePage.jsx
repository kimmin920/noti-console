'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { pageMeta } from './consoleConfig.js';
import { SmsBulkSendRunWatcher } from './messageSend/MessageSendPage.jsx';
import { StandaloneConsoleProvider } from './StandaloneConsoleContext.jsx';
import {
  DEFAULT_CONSOLE_PAGE_ID,
  getConsolePageHref,
  normalizeConsolePageId,
  normalizeShellMode,
} from './routing.js';

export function StandaloneConsolePage({ children, mode, pageId }) {
  const router = useRouter();
  const activePage = normalizeConsolePageId(pageId);
  const shellMode = normalizeShellMode(mode);
  const activeMeta = pageMeta[activePage] ?? pageMeta[DEFAULT_CONSOLE_PAGE_ID];
  const openDocs = useCallback(() => {
    router.push(getConsolePageHref({
      mode: shellMode,
      pageId: 'docs',
    }));
  }, [router, shellMode]);

  return (
    <StandaloneConsoleProvider meta={activeMeta} onDocs={openDocs}>
      <SmsBulkSendRunWatcher />
      {children}
    </StandaloneConsoleProvider>
  );
}
