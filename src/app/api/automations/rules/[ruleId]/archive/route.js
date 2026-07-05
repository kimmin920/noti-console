import { handleAutomationRuleArchiveRequest } from '@/server/automations/rulesRoute.js';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  return handleAutomationRuleArchiveRequest({ params, request });
}
