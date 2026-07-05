import { resolveRelayActor } from '@/server/auth/actor.js';
import { relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultMessageSendService } from '@/server/messages/service.js';
import { getDevSmsBulkSimulationRun } from '@/server/messages/smsBulkSimulation.js';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { runId } = await params;
    const simulatedRun = getDevSmsBulkSimulationRun({
      actorUserId: actor.user.id,
      runId,
    });

    if (simulatedRun) {
      return { data: simulatedRun };
    }

    return {
      data: await createDefaultMessageSendService().getSmsBulkSendRun({
        actorUserId: actor.user.id,
        runId,
      }),
    };
  });
}
