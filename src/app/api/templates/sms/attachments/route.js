import { resolveRelayActor } from '@/server/auth/actor.js';
import { parseRelayRequest, relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultTemplateCatalogService } from '@/server/templates/service.js';

export const runtime = 'nodejs';

export async function POST(request) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { payload } = await parseRelayRequest(request);

    return {
      status: 201,
      data: await createDefaultTemplateCatalogService().uploadSmsTemplateAttachment({
        actorUserId: actor.user.id,
        payload,
      }),
    };
  });
}
