import { resolveRelayActor } from '@/server/auth/actor.js';
import { relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultLimitIncreaseRequestService } from '@/server/limitIncreaseRequests/service.js';

export const runtime = 'nodejs';

export async function GET(request) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { searchParams } = new URL(request.url);

    return {
      data: await createDefaultLimitIncreaseRequestService().listAdminRequests({
        actorUserId: actor.user.id,
        query: {
          status: searchParams.get('status'),
        },
      }),
    };
  });
}
