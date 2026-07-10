'use client';

import { useCallback } from 'react';
import { MessagingConsole } from '../console/MessagingConsole.jsx';
import {
  DEFAULT_CONSOLE_PAGE_ID,
  normalizeConsolePageId,
} from '../console/routing.js';
import { getPublClientPageHref } from './sdkAdapter.js';

export function PublClientConsole({ pageId = DEFAULT_CONSOLE_PAGE_ID }) {
  const activePageId = normalizeConsolePageId(pageId);
  const getPageHref = useCallback(({ pageId: nextPageId }) => (
    getPublClientPageHref({ pageId: normalizeConsolePageId(nextPageId) })
  ), []);

  return (
    <MessagingConsole
      getPageHref={getPageHref}
      hideAccountControl
      mode="embed"
      pageId={activePageId}
    />
  );
}
