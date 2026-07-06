import { handlePublPappRefreshTokenRequest } from '@/server/publPapp/tokenExchangeRoute.js';

export const runtime = 'nodejs';

export async function POST(request) {
  return handlePublPappRefreshTokenRequest({ request });
}
