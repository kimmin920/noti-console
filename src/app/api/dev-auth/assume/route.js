import { NextResponse } from 'next/server';

import { getDb } from '@/db/client.js';
import {
  DEV_BROWSER_AUTH_USER_ID_COOKIE,
  isDevBrowserAuthBypassEnabled,
} from '@/server/auth/devAuth.js';
import { createAuthRepository } from '@/server/auth/repository.js';

export const runtime = 'nodejs';

export async function GET(request) {
  return assumeDevActor(request);
}

export async function POST(request) {
  return assumeDevActor(request);
}

export async function DELETE() {
  const response = NextResponse.json({
    ok: true,
    data: {
      cleared: true,
    },
  });
  response.cookies.delete(DEV_BROWSER_AUTH_USER_ID_COOKIE);
  return response;
}

async function assumeDevActor(request) {
  if (!isDevBrowserAuthBypassEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'DEV_AUTH_DISABLED',
          message: 'Dev auth bypass is disabled.',
        },
      },
      { status: 404 }
    );
  }

  const repository = createAuthRepository(getDb());
  const requestedUserId = readRequestedUserId(request);
  const user = requestedUserId
    ? await repository.getUserById(requestedUserId)
    : await repository.findFirstOperator();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'DEV_AUTH_USER_NOT_FOUND',
          message: 'No dev auth user was found.',
        },
      },
      { status: 404 }
    );
  }

  if (user.status !== 'active' || user.isOperator !== true) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'DEV_AUTH_REQUIRES_OPERATOR',
          message: 'Dev auth bypass requires an active operator user.',
        },
      },
      { status: 403 }
    );
  }

  const redirectUrl = readSafeRedirectUrl(request);
  const response = redirectUrl
    ? NextResponse.redirect(redirectUrl)
    : NextResponse.json({
        ok: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            isOperator: true,
          },
        },
      });
  response.cookies.set(DEV_BROWSER_AUTH_USER_ID_COOKIE, user.id, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: false,
  });
  return response;
}

function readRequestedUserId(request) {
  const url = new URL(request.url);
  const value = url.searchParams.get('userId');
  return value && value.trim() ? value.trim() : null;
}

function readSafeRedirectUrl(request) {
  const url = new URL(request.url);
  const value = url.searchParams.get('redirect');
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;

  const host = request.headers.get('host');
  if (!host) return new URL(value, url);

  const protocol = request.headers.get('x-forwarded-proto') ?? 'http';
  return new URL(value, `${protocol}://${host}`);
}
