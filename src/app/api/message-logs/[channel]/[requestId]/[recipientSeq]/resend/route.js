import { resolveRelayActor } from '@/server/auth/actor.js';
import { relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultMessageLogService } from '@/server/messageLogs/service.js';

export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
};

export async function POST(request, { params }) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { channel, requestId, recipientSeq } = await params;

    return {
      headers: NO_STORE_HEADERS,
      data: await createDefaultMessageLogService().resend({
        actorUserId: actor.user.id,
        channel,
        requestId,
        recipientSeq,
      }),
    };
  });
}
