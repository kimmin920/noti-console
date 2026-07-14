import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { hasDevBrowserAuthBypass } from './server/auth/devAuth.js';
import { resolvePublClientFramePolicy } from './server/publPapp/framePolicy.js';

const isPublicAuthRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
]);
const isPublicRoute = createRouteMatcher([
  '/__clerk(.*)',
  '/documents/phone-number-consent-individual.pdf',
  '/publ-client(.*)',
  '/integrations/exchange-token',
  '/integrations/refresh-token',
]);
const isDomainDetailRoute = createRouteMatcher(['/domain-detail']);
const isRelayApiRoute = createRouteMatcher(['/api(.*)']);
const isPlaygroundRoute = createRouteMatcher(['/playground(.*)']);
const isPublClientRoute = createRouteMatcher(['/publ-client(.*)']);

const publicAuthRouteProxy = clerkMiddleware(() => NextResponse.next());
const relayApiRouteProxy = clerkMiddleware(() => NextResponse.next());
const protectedRouteProxy = clerkMiddleware(async (auth) => {
  await auth.protect();
});

export default function proxy(request, event) {
  if (isPublClientRoute(request)) {
    return publClientPublicResponse();
  }

  if (isPublicAuthRoute(request)) {
    return publicAuthRouteProxy(request, event);
  }

  if (
    isPublicRoute(request)
    || (process.env.NODE_ENV !== 'production' && (isPlaygroundRoute(request) || isDomainDetailRoute(request)))
  ) {
    return NextResponse.next();
  }

  if (isRelayApiRoute(request)) {
    return relayApiRouteProxy(request, event);
  }

  if (hasDevBrowserAuthBypass(request)) {
    return NextResponse.next();
  }

  return protectedRouteProxy(request, event);
}

function publClientPublicResponse() {
  const framePolicy = resolvePublClientFramePolicy();
  return NextResponse.next({
    headers: {
      'Content-Security-Policy': framePolicy.contentSecurityPolicy,
    },
  });
}

export const config = {
  matcher: [
    '/publ-client/:path*',
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
};
