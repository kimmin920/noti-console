'use client';

import { useCallback } from 'react';
import { MessagingConsole } from '../console/MessagingConsole.jsx';
import {
  DEFAULT_CONSOLE_PAGE_ID,
  buildPublClientPath,
} from '../console/routing.js';

export function PublClientConsole({
  pageId = DEFAULT_CONSOLE_PAGE_ID,
  pageProps = undefined,
}) {
  const getPageHref = useCallback(({ pageId: nextPageId }) => (
    buildPublClientPath({ pageId: nextPageId })
  ), []);

  return (
    <MessagingConsole
      getPageHref={getPageHref}
      hideAccountControl
      mode="embed"
      pageId={pageId}
      pageProps={pageProps}
    />
  );
}
