import { handleAutomationUnsentDismissRequest } from '@/server/automations/unsentRoute.js';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  return handleAutomationUnsentDismissRequest({ params, request });
}
