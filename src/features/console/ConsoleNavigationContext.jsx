'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { normalizeShellMode, transformConsoleHref } from './routing.js';

const ConsoleNavigationContext = createContext(null);

export function ConsoleNavigationProvider({ children, mode = 'app', surface = 'standalone' }) {
  const router = useRouter();
  const shellMode = normalizeShellMode(mode);
  const href = useCallback(
    (value) => transformConsoleHref(value, { mode: shellMode, surface }),
    [shellMode, surface]
  );
  const push = useCallback((value, options) => router.push(href(value), options), [href, router]);
  const replace = useCallback((value, options) => router.replace(href(value), options), [href, router]);
  const value = useMemo(() => ({
    href,
    mode: shellMode,
    push,
    replace,
  }), [href, push, replace, shellMode]);

  return (
    <ConsoleNavigationContext.Provider value={value}>
      {children}
    </ConsoleNavigationContext.Provider>
  );
}

export function useConsoleNavigation() {
  const context = useContext(ConsoleNavigationContext);
  const router = useOptionalRouter();

  if (context) {
    return context;
  }

  return {
    href: (value) => transformConsoleHref(value, { mode: 'app' }),
    mode: 'app',
    push: (value, options) => {
      const nextHref = transformConsoleHref(value, { mode: 'app' });
      if (router) {
        router.push(nextHref, options);
      } else if (typeof window !== 'undefined') {
        window.location.assign(nextHref);
      }
    },
    replace: (value, options) => {
      const nextHref = transformConsoleHref(value, { mode: 'app' });
      if (router) {
        router.replace(nextHref, options);
      } else if (typeof window !== 'undefined') {
        window.location.replace(nextHref);
      }
    },
  };
}

function useOptionalRouter() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export function ConsoleLink({ href, ...props }) {
  const navigation = useConsoleNavigation();
  return <Link href={navigation.href(href)} {...props} />;
}
