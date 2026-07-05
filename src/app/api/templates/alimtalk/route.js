import { resolveRelayActor } from '@/server/auth/actor.js';
import { parseRelayRequest, relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultTemplateCatalogService } from '@/server/templates/service.js';

export const runtime = 'nodejs';

export async function GET(request) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { searchParams } = new URL(request.url);

    return {
      data: await createDefaultTemplateCatalogService().listAlimtalkTemplates({
        actorUserId: actor.user.id,
        senderResourceId: searchParams.get('senderResourceId'),
        query: {
          templateCode: searchParams.get('templateCode'),
          templateName: searchParams.get('templateName'),
          templateStatus: searchParams.get('templateStatus'),
        },
      }),
    };
  });
}

export async function POST(request) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { payload } = await parseRelayRequest(request);

    return {
      status: 201,
      data: await createDefaultTemplateCatalogService().createAlimtalkTemplate({
        actorUserId: actor.user.id,
        payload,
      }),
    };
  });
}
