import { handleAutomationRuleEnableRequest } from '@/server/automations/rulesRoute.js';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  return handleAutomationRuleEnableRequest({ params, request });
}
