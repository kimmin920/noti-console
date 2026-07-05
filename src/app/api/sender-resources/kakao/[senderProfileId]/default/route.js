import { resolveRelayActor } from '@/server/auth/actor.js';
import { relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultSenderResourceApprovalService } from '@/server/senderResources/service.js';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const resolvedParams = await params;

    return {
      data: await createDefaultSenderResourceApprovalService().setDefaultKakaoChannel({
        actorUserId: actor.user.id,
        senderProfileId: resolvedParams.senderProfileId,
      }),
    };
  });
}
