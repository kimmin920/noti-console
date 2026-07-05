import { getDb } from '@/db/client.js';
import { resolveRelayActor } from '@/server/auth/actor.js';
import { parseRelayRequest, relayRoute } from '@/server/http/relayRoute.js';
import { createPublEventCatalogRepository } from '@/server/publEvents/repository.js';
import { createDefaultPublEventEditorService } from '@/server/publEvents/service.js';
import {
  toPublEventCatalogListView,
  toPublEventDetailView,
} from '@/server/publEvents/views.js';

export const runtime = 'nodejs';

export async function GET() {
  return relayRoute(async () => {
    const repository = createPublEventCatalogRepository(getDb());
    const events = await repository.listCatalogEvents({ includeProps: true });

    return {
      data: toPublEventCatalogListView(events),
    };
  });
}

export async function POST(request) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { payload } = await parseRelayRequest(request);
    const result = await createDefaultPublEventEditorService().createPublEventDefinition({
      actor,
      payload,
    });

    return {
      data: toPublEventDetailView(result.event, result.props),
    };
  });
}
