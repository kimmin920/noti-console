import {
  handleAutomationRuleCreateRequest,
  handleAutomationRulesListRequest,
} from '@/server/automations/rulesRoute.js';

export const runtime = 'nodejs';

export async function GET(request) {
  return handleAutomationRulesListRequest({ request });
}

export async function POST(request) {
  return handleAutomationRuleCreateRequest({ request });
}
