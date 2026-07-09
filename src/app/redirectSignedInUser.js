import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  DEV_BROWSER_AUTH_USER_ID_COOKIE,
  isDevBrowserAuthBypassEnabled,
} from '@/server/auth/devAuth.js';

export async function redirectSignedInUser(href) {
  const { userId } = await auth();

  if (userId || await hasDevBrowserAuthCookie()) {
    redirect(href);
  }
}

async function hasDevBrowserAuthCookie() {
  if (!isDevBrowserAuthBypassEnabled()) return false;

  const cookieStore = await cookies();
  const userId = cookieStore.get(DEV_BROWSER_AUTH_USER_ID_COOKIE)?.value?.trim();
  return Boolean(userId);
}
