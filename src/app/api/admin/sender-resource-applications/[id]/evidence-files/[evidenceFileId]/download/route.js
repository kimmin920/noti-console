import { resolveRelayActor } from '@/server/auth/actor.js';
import { relayErrorResponse } from '@/server/http/relayRoute.js';
import { createDefaultSenderResourceApprovalService } from '@/server/senderResources/service.js';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  try {
    const actor = await resolveRelayActor(request);
    const { id, evidenceFileId } = await params;
    const evidenceFile = await createDefaultSenderResourceApprovalService().downloadEvidenceFile({
      actorUserId: actor.user.id,
      applicationId: id,
      evidenceFileId,
    });

    return new Response(evidenceFile.stream, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': evidenceFile.contentType,
        'Content-Disposition': `attachment; filename="${evidenceFile.filename}"`,
        ...(evidenceFile.byteSize === null ? {} : { 'Content-Length': String(evidenceFile.byteSize) }),
      },
    });
  } catch (error) {
    return relayErrorResponse(error);
  }
}
