import { resolveRelayActor } from '@/server/auth/actor.js';
import { relayErrorResponse } from '@/server/http/relayRoute.js';
import { createDefaultMessageLogService } from '@/server/messageLogs/service.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const actor = await resolveRelayActor(request);
    const { searchParams } = new URL(request.url);
    const exportResult = await createDefaultMessageLogService().exportLogs({
      actorUserId: actor.user.id,
      query: Object.fromEntries(searchParams.entries()),
    });

    return new Response(exportResult.stream, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
        'X-Relay-Export-Row-Count': String(exportResult.rowCount),
      },
    });
  } catch (error) {
    return relayErrorResponse(error);
  }
}
