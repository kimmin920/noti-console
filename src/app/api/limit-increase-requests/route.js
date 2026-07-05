import { resolveRelayActor } from '@/server/auth/actor.js';
import { parseRelayRequest, relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultLimitIncreaseRequestService } from '@/server/limitIncreaseRequests/service.js';

export const runtime = 'nodejs';

export async function GET(request) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);

    return {
      data: await createDefaultLimitIncreaseRequestService().listUserRequests({
        actorUserId: actor.user.id,
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
      data: await createDefaultLimitIncreaseRequestService().createRequest({
        actorUserId: actor.user.id,
        payload,
      }),
    };
  });
}
