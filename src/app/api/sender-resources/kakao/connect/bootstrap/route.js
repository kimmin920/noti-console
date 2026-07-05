import { resolveRelayActor } from '@/server/auth/actor.js';
import { relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultSenderResourceApprovalService } from '@/server/senderResources/service.js';

export const runtime = 'nodejs';

export async function GET(request) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);

    return {
      data: await createDefaultSenderResourceApprovalService().getKakaoConnectBootstrap({
        actorUserId: actor.user.id,
      }),
    };
  });
}
