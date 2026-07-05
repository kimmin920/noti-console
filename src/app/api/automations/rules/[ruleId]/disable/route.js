import { handleAutomationRuleDisableRequest } from '@/server/automations/rulesRoute.js';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  return handleAutomationRuleDisableRequest({ params, request });
}
