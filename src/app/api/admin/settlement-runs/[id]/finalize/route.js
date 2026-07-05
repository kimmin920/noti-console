import { resolveRelayActor } from '@/server/auth/actor.js';
import { relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultSettlementService } from '@/server/settlements/service.js';

export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
};

export async function POST(request, { params }) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { id } = await params;

    return {
      headers: NO_STORE_HEADERS,
      data: await createDefaultSettlementService().finalizeRun({
        actorUserId: actor.user.id,
        runId: id,
      }),
    };
  });
}
