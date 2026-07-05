import { resolveRelayActor } from '@/server/auth/actor.js';
import { parseRelayRequest, relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultLimitIncreaseRequestService } from '@/server/limitIncreaseRequests/service.js';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { id } = await params;
    const { payload } = await parseRelayRequest(request);

    return {
      data: await createDefaultLimitIncreaseRequestService().approveRequest({
        actorUserId: actor.user.id,
        requestId: id,
        payload,
      }),
    };
  });
}
