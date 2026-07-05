import { handleAutomationUnsentSendRequest } from '@/server/automations/unsentRoute.js';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  return handleAutomationUnsentSendRequest({ params, request });
}
