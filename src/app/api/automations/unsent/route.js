import { handleAutomationUnsentListRequest } from '@/server/automations/unsentRoute.js';

export const runtime = 'nodejs';

export async function GET(request) {
  return handleAutomationUnsentListRequest({ request });
}
