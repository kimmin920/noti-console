import { resolveRelayActor } from '../auth/actor.js';
import { relayRoute } from '../http/relayRoute.js';
import { createDefaultAutomationService } from './service.js';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
};

export async function handleAutomationUnsentListRequest({
  automationService = null,
  createAutomationService = createDefaultAutomationService,
  request,
  resolveActor = resolveRelayActor,
} = {}) {
  return relayRoute(async () => {
    const actor = await resolveActor(request);
    const { searchParams } = new URL(request.url);

    return {
      headers: NO_STORE_HEADERS,
      data: await resolveAutomationService({ automationService, createAutomationService }).listUnsentDeliveries({
        actorUserId: actor.user.id,
        query: Object.fromEntries(searchParams.entries()),
      }),
    };
  });
}

export async function handleAutomationUnsentSendRequest({
  automationService = null,
  createAutomationService = createDefaultAutomationService,
  params,
  request,
  resolveActor = resolveRelayActor,
} = {}) {
  return relayRoute(async () => {
    const actor = await resolveActor(request);
    const { deliveryId } = await params;

    return {
      headers: NO_STORE_HEADERS,
      data: await resolveAutomationService({ automationService, createAutomationService }).sendUnsentDelivery({
        actorUserId: actor.user.id,
        deliveryId,
      }),
    };
  });
}

export async function handleAutomationUnsentDismissRequest({
  automationService = null,
  createAutomationService = createDefaultAutomationService,
  params,
  request,
  resolveActor = resolveRelayActor,
} = {}) {
  return relayRoute(async () => {
    const actor = await resolveActor(request);
    const { deliveryId } = await params;

    return {
      headers: NO_STORE_HEADERS,
      data: await resolveAutomationService({ automationService, createAutomationService }).dismissUnsentDelivery({
        actorUserId: actor.user.id,
        deliveryId,
      }),
    };
  });
}

function resolveAutomationService({ automationService, createAutomationService }) {
  return automationService ?? createAutomationService();
}
