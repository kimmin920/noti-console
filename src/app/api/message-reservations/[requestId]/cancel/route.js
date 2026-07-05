import { resolveRelayActor } from '@/server/auth/actor.js';
import { relayRoute } from '@/server/http/relayRoute.js';
import { createMessageReservationRouteService } from '@/server/messageReservations/routeService.js';

export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
};

export async function POST(request, { params }) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { requestId } = await params;
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());

    return {
      headers: NO_STORE_HEADERS,
      data: await createMessageReservationRouteService(query).cancelReservationGroup({
        actorUserId: actor.user.id,
        query,
        requestId,
      }),
    };
  });
}
