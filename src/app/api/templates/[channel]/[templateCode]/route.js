import { resolveRelayActor } from '@/server/auth/actor.js';
import { relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultTemplateCatalogService } from '@/server/templates/service.js';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { channel, templateCode } = await params;
    const { searchParams } = new URL(request.url);

    return {
      data: await createDefaultTemplateCatalogService().getTemplate({
        actorUserId: actor.user.id,
        channel,
        templateCode,
        query: {
          senderResourceId: searchParams.get('senderResourceId'),
          source: searchParams.get('source'),
          sourceKey: searchParams.get('sourceKey'),
        },
      }),
    };
  });
}
