import { resolveRelayActor } from '@/server/auth/actor.js';
import { parseRelayRequest, relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultSettlementService } from '@/server/settlements/service.js';

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
      data: await createDefaultSettlementService().listRuns({
        actorUserId: actor.user.id,
        query: Object.fromEntries(searchParams.entries()),
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
      headers: NO_STORE_HEADERS,
      data: await createDefaultSettlementService().createRun({
        actorUserId: actor.user.id,
        payload,
      }),
    };
  });
}
