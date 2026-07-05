import { resolveRelayActor } from '@/server/auth/actor.js';
import { parseRelayRequest, relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultSenderResourceApprovalService } from '@/server/senderResources/service.js';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { id } = await params;
    const { payload } = await parseRelayRequest(request);

    return {
      data: await createDefaultSenderResourceApprovalService().rejectApplication({
        actorUserId: actor.user.id,
        applicationId: id,
        payload,
      }),
    };
  });
}
