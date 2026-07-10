'use client';

import { createContext, useContext, useMemo } from 'react';

const DEFAULT_PUBL_CLIENT_CONTEXT = Object.freeze({
  adapter: null,
  clientConfig: null,
  isPublEmbed: false,
});

const PublClientContext = createContext(DEFAULT_PUBL_CLIENT_CONTEXT);

export function PublClientProvider({ adapter, children, clientConfig }) {
  const value = useMemo(() => ({
    adapter: adapter ?? null,
    clientConfig: clientConfig ?? null,
    isPublEmbed: Boolean(adapter && clientConfig),
  }), [adapter, clientConfig]);

  return (
    <PublClientContext.Provider value={value}>
      {children}
    </PublClientContext.Provider>
  );
}

export function usePublClient() {
  return useContext(PublClientContext);
}
