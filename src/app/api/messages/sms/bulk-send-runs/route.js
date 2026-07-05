import { resolveRelayActor } from '@/server/auth/actor.js';
import { parseRelayRequest, relayRoute } from '@/server/http/relayRoute.js';
import { createDefaultMessageSendService } from '@/server/messages/service.js';
import {
  createDevSmsBulkSimulationRun,
  listDevSmsBulkSimulationRuns,
} from '@/server/messages/smsBulkSimulation.js';
import { RelayValidationError } from '@/server/relay/errors.js';

export const runtime = 'nodejs';

export async function POST(request) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { payload } = await parseRelayRequest(request);

    if (payload?.devSimulation?.enabled === true && process.env.NODE_ENV === 'production') {
      throw new RelayValidationError('SMS bulk simulation is available only outside production.');
    }

    const simulatedRun = createDevSmsBulkSimulationRun({
      actorUserId: actor.user.id,
      payload,
    });

    if (simulatedRun) {
      return {
        data: simulatedRun,
        status: 202,
      };
    }

    return {
      data: await createDefaultMessageSendService().createSmsBulkSendRun({
        actorUserId: actor.user.id,
        payload,
      }),
      status: 202,
    };
  });
}

export async function GET(request) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('active') === 'true';
    const simulatedRuns = listDevSmsBulkSimulationRuns({
      actorUserId: actor.user.id,
      activeOnly,
    });
    let realRuns;

    try {
      realRuns = await createDefaultMessageSendService().listSmsBulkSendRuns({
        actorUserId: actor.user.id,
        activeOnly,
      });
    } catch (error) {
      if (simulatedRuns.runs.length > 0 && process.env.NODE_ENV !== 'production') {
        return { data: simulatedRuns };
      }

      throw error;
    }

    return {
      data: {
        runs: [...simulatedRuns.runs, ...(realRuns?.runs ?? [])]
          .sort((left, right) => Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? '')),
      },
    };
  });
}
