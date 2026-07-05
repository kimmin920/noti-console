import { resolveRelayActor } from '@/server/auth/actor.js';
import { parseRelayFormData, relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultMessageSendService } from '@/server/messages/service.js';

export const runtime = 'nodejs';

export async function POST(request) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const formData = await parseRelayFormData(request);

    return {
      data: await createDefaultMessageSendService().uploadBrandImage({
        actorUserId: actor.user.id,
        formData,
      }),
    };
  });
}
