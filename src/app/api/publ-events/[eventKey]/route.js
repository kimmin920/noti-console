import { getDb } from '@/db/client.js';
import { resolveRelayActor } from '@/server/auth/actor.js';
import { parseRelayRequest, relayRoute } from '@/server/http/relayRoute.js';
import { createPublEventCatalogRepository } from '@/server/publEvents/repository.js';
import { createDefaultPublEventEditorService } from '@/server/publEvents/service.js';
import { toPublEventDetailView } from '@/server/publEvents/views.js';
import { RELAY_ERROR_CODES } from '@/server/relay/constants.js';
import { RelayError } from '@/server/relay/errors.js';

export const runtime = 'nodejs';

export async function GET(_request, { params } = {}) {
  return relayRoute(async () => {
    const resolvedParams = await params;
    const eventKey = resolvedParams?.eventKey;
    const repository = createPublEventCatalogRepository(getDb());
    const event = await repository.findEventByKey(eventKey);

    if (!event) {
      throw new RelayError({
        code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
        message: 'PUBL event was not found.',
        retryable: false,
        status: 404,
      });
    }

    const props = await repository.listPropsByEventId(event.id);

    return {
      data: toPublEventDetailView(event, props),
    };
  });
}

export async function PATCH(request, { params } = {}) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { payload } = await parseRelayRequest(request);
    const resolvedParams = await params;
    const eventKey = resolvedParams?.eventKey;
    const result = await createDefaultPublEventEditorService().savePublEventEditorDraft({
      actor,
      eventKey,
      payload,
    });

    return {
      data: toPublEventDetailView(result.event, result.props),
    };
  });
}

export async function DELETE(request, { params } = {}) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { payload } = await parseRelayRequest(request);
    const resolvedParams = await params;
    const eventKey = resolvedParams?.eventKey;
    const result = await createDefaultPublEventEditorService().deletePublEventDefinition({
      actor,
      eventKey,
      payload,
    });

    return {
      data: {
        deleted: true,
        eventKey: result.eventKey,
      },
    };
  });
}
