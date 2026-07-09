import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  devAuthEnabled: false,
  devCookieValue: null,
  redirectCalls: [],
  userId: null,
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: authMocks.userId })),
}));

vi.mock('@/server/auth/devAuth.js', () => ({
  DEV_BROWSER_AUTH_USER_ID_COOKIE: '__dev_auth_user_id',
  isDevBrowserAuthBypassEnabled: vi.fn(() => authMocks.devAuthEnabled),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn((name) => (
      name === '__dev_auth_user_id' && authMocks.devCookieValue
        ? { value: authMocks.devCookieValue }
        : undefined
    )),
  })),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((href) => {
    authMocks.redirectCalls.push(href);
    throw new Error('NEXT_REDIRECT');
  }),
}));

describe('public auth page redirect contract', () => {
  beforeEach(() => {
    authMocks.devAuthEnabled = false;
    authMocks.devCookieValue = null;
    authMocks.redirectCalls.length = 0;
    authMocks.userId = null;
    vi.resetModules();
  });

  it('uses Clerk server auth redirects for signed-in users on public auth pages', async () => {
    const helper = await readFile('src/app/redirectSignedInUser.js', 'utf8');
    const homePage = await readFile('src/app/page.jsx', 'utf8');
    const signInPage = await readFile('src/app/sign-in/[[...sign-in]]/page.jsx', 'utf8');
    const signUpPage = await readFile('src/app/sign-up/[[...sign-up]]/page.jsx', 'utf8');

    expect(helper).toContain("import { auth } from '@clerk/nextjs/server';");
    expect(helper).toContain("import { redirect } from 'next/navigation';");
    expect(helper).toContain('const { userId } = await auth();');
    expect(helper).toContain('redirect(href);');
    expect(homePage).toContain('await redirectSignedInUser(consoleHref);');
    expect(signInPage).toContain("await redirectSignedInUser('/message-send');");
    expect(signUpPage).toContain("await redirectSignedInUser('/message-send');");
  });

  it('redirects signed-in users and leaves signed-out users on the auth page', async () => {
    const { redirectSignedInUser } = await import('../../app/redirectSignedInUser.js');

    await redirectSignedInUser('/message-send');
    expect(authMocks.redirectCalls).toEqual([]);

    authMocks.userId = 'user_123';
    await expect(redirectSignedInUser('/message-send')).rejects.toThrow('NEXT_REDIRECT');
    expect(authMocks.redirectCalls).toEqual(['/message-send']);
  });

  it('treats an enabled dev auth browser cookie as signed in for local auth-page redirects', async () => {
    const { redirectSignedInUser } = await import('../../app/redirectSignedInUser.js');

    authMocks.devAuthEnabled = true;
    authMocks.devCookieValue = 'operator_1';

    await expect(redirectSignedInUser('/message-send')).rejects.toThrow('NEXT_REDIRECT');
    expect(authMocks.redirectCalls).toEqual(['/message-send']);
  });

  it('forces Clerk auth components to leave public auth pages after authentication', async () => {
    const homePage = await readFile('src/app/page.jsx', 'utf8');
    const signInPage = await readFile('src/app/sign-in/[[...sign-in]]/page.jsx', 'utf8');
    const signUpPage = await readFile('src/app/sign-up/[[...sign-up]]/page.jsx', 'utf8');

    expect(homePage).toContain('forceRedirectUrl={consoleHref}');
    expect(signInPage).toContain('forceRedirectUrl="/message-send"');
    expect(signUpPage).toContain('forceRedirectUrl="/message-send"');
  });
});
