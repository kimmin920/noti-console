import { createDefaultMessageSendService } from '../src/server/messages/service.js';
import { createDefaultMessageLogService } from '../src/server/messageLogs/service.js';
import { createDefaultSenderResourceApprovalService } from '../src/server/senderResources/service.js';

const intervalMs = Number(process.env.WORKER_INTERVAL_MS ?? 60_000);
const evidenceCleanupLimit = Number(process.env.EVIDENCE_CLEANUP_LIMIT ?? 100);
const evidenceCleanupEnabled = process.env.EVIDENCE_CLEANUP_ENABLED !== 'false';
const smsBulkSendEnabled = process.env.SMS_BULK_SEND_WORKER_ENABLED !== 'false';
const smsBulkSendMaxBatchesPerTick = Number(process.env.SMS_BULK_SEND_MAX_BATCHES_PER_TICK ?? 100);
const smsBulkPayloadCleanupLimit = Number(process.env.SMS_BULK_PAYLOAD_CLEANUP_LIMIT ?? 100);
const messageResultCorrectionEnabled = process.env.MESSAGE_RESULT_CORRECTION_WORKER_ENABLED ?? 'true';
const messageResultCorrectionLimit = Number(process.env.MESSAGE_RESULT_CORRECTION_LIMIT ?? 20);
const messageLogArchiveCleanupLimit = Number(process.env.MESSAGE_LOG_ARCHIVE_CLEANUP_LIMIT ?? 100);
const messageLogPurgeCleanupLimit = Number(process.env.MESSAGE_LOG_PURGE_CLEANUP_LIMIT ?? 100);
const workerId = process.env.WORKER_ID ?? `worker-${process.pid}`;
let messageLogService;
let messageSendService;
let senderResourceService;

async function tick() {
  console.log(`[worker] heartbeat ${new Date().toISOString()}`);

  if (smsBulkSendEnabled) {
    await processSmsBulkSendBatches();
    await cleanupSmsBulkPayloads();
  }

  if (messageResultCorrectionEnabled !== 'false') {
    await correctDueMessageLogResults();
    await cleanupMessageLogLedgerRetention();
  }

  if (!evidenceCleanupEnabled) {
    return;
  }

  try {
    const result = await getSenderResourceService().cleanupExpiredEvidence({
      limit: evidenceCleanupLimit,
    });

    if (result.selectedCount > 0) {
      console.log(
        `[worker] evidence cleanup selected=${result.selectedCount} deleted=${result.deletedCount} pending=${result.pendingCount}`
      );
    }
  } catch (error) {
    console.error(`[worker] evidence cleanup failed: ${error?.message || 'unknown error'}`);
  }
}

tick();
setInterval(() => {
  void tick();
}, intervalMs);

async function processSmsBulkSendBatches() {
  try {
    for (let index = 0; index < smsBulkSendMaxBatchesPerTick; index += 1) {
      const result = await getMessageSendService().processNextSmsBulkSendBatch({ workerId });

      if (!result.processed) {
        return;
      }

      console.log(
        `[worker] sms bulk batch run=${result.run?.runRef ?? 'unknown'} batch=${result.batchId} status=${result.status}`
      );

      if (result.status !== 'accepted') {
        return;
      }
    }
  } catch (error) {
    console.error(`[worker] sms bulk processing failed: ${error?.message || 'unknown error'}`);
  }
}

async function cleanupSmsBulkPayloads() {
  try {
    const purged = await getMessageSendService().cleanupSmsBulkSendPayloads({
      limit: smsBulkPayloadCleanupLimit,
    });

    if (purged.length > 0) {
      console.log(`[worker] sms bulk payload cleanup purged=${purged.length}`);
    }
  } catch (error) {
    console.error(`[worker] sms bulk payload cleanup failed: ${error?.message || 'unknown error'}`);
  }
}

async function correctDueMessageLogResults() {
  try {
    const result = await getMessageLogService().correctDueMessageResults({
      limit: messageResultCorrectionLimit,
      workerId,
    });

    if (result.processedCount > 0) {
      console.log(
        `[worker] message result correction processed=${result.processedCount} corrected=${result.correctedCount} finalized=${result.finalizedCount} stale=${result.staleCount} errors=${result.errorCount}`
      );
    }
  } catch (error) {
    console.error(`[worker] message result correction failed: ${error?.message || 'unknown error'}`);
  }
}

async function cleanupMessageLogLedgerRetention() {
  try {
    const result = await getMessageLogService().cleanupMessageLogLedgerRetention({
      archiveLimit: messageLogArchiveCleanupLimit,
      purgeLimit: messageLogPurgeCleanupLimit,
    });

    if (result.archivedCount > 0 || result.purgedCount > 0) {
      console.log(
        `[worker] message log retention archived=${result.archivedCount} purged=${result.purgedCount} purgedRequests=${result.purgedRequestCount}`
      );
    }
  } catch (error) {
    console.error(`[worker] message log retention cleanup failed: ${error?.message || 'unknown error'}`);
  }
}

function getMessageLogService() {
  if (!messageLogService) {
    messageLogService = createDefaultMessageLogService();
  }

  return messageLogService;
}

function getMessageSendService() {
  if (!messageSendService) {
    messageSendService = createDefaultMessageSendService();
  }

  return messageSendService;
}

function getSenderResourceService() {
  if (!senderResourceService) {
    senderResourceService = createDefaultSenderResourceApprovalService();
  }

  return senderResourceService;
}
