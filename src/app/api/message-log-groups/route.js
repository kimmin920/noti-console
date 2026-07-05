import { resolveRelayActor } from '@/server/auth/actor.js';
import { relayRoute } from '@/server/http/relayRoute.js';
import { createMessageLogRouteService } from '@/server/messageLogs/routeService.js';

export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
};

export async function GET(request) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { searchParams } = new URL(request.url);

    return {
      headers: NO_STORE_HEADERS,
      data: await createMessageLogRouteService().listLogGroups({
        actorUserId: actor.user.id,
        query: Object.fromEntries(searchParams.entries()),
      }),
    };
  });
}
