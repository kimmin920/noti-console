import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { hasDevBrowserAuthBypass } from './server/auth/devAuth.js';

const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)', '/__clerk(.*)']);
const isDomainDetailRoute = createRouteMatcher(['/domain-detail']);
const isRelayApiRoute = createRouteMatcher(['/api(.*)']);
const isPlaygroundRoute = createRouteMatcher(['/playground(.*)']);

const relayApiRouteProxy = clerkMiddleware(() => NextResponse.next());
const protectedRouteProxy = clerkMiddleware(async (auth) => {
  await auth.protect();
});

export default function proxy(request, event) {
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

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
};
