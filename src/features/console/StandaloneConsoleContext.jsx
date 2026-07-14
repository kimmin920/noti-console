'use client';

import { createContext, useContext, useMemo } from 'react';

const StandaloneConsoleContext = createContext(null);

export function StandaloneConsoleProvider({ children, meta, onDocs }) {
  const value = useMemo(() => ({ meta, onDocs }), [meta, onDocs]);

  return (
    <StandaloneConsoleContext.Provider value={value}>
      {children}
    </StandaloneConsoleContext.Provider>
  );
}

export function useStandaloneConsole() {
  return useContext(StandaloneConsoleContext);
}
