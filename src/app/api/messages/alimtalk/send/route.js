import { resolveRelayActor } from '@/server/auth/actor.js';
import { parseRelayRequest, relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultMessageSendService } from '@/server/messages/service.js';

export const runtime = 'nodejs';

export async function POST(request) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { payload } = await parseRelayRequest(request);

    return {
      data: await createDefaultMessageSendService().sendAlimtalk({
        actorUserId: actor.user.id,
        payload,
      }),
    };
  });
}
