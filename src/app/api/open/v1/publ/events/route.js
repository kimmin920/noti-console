import { handlePublOpenApiEventRequest } from '@/server/automations/openApiRoute.js';
import { createDefaultAutomationService } from '@/server/automations/service.js';

export const runtime = 'nodejs';

export async function POST(request) {
  const rawBody = await request.text();

  return handlePublOpenApiEventRequest({
    createAutomationService: createDefaultAutomationService,
    rawBody,
    request,
  });
}
