import {
  handleAutomationRuleDetailRequest,
  handleAutomationRuleUpdateRequest,
} from '@/server/automations/rulesRoute.js';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  return handleAutomationRuleDetailRequest({ params, request });
}

export async function PATCH(request, { params }) {
  return handleAutomationRuleUpdateRequest({ params, request });
}
