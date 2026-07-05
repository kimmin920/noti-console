import { resolveRelayActor } from '@/server/auth/actor.js';
import { relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultSenderResourceApprovalService } from '@/server/senderResources/service.js';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { id } = await params;

    return {
      data: await createDefaultSenderResourceApprovalService().lookupSmsSendNo({
        actorUserId: actor.user.id,
        applicationId: id,
      }),
    };
  });
}
