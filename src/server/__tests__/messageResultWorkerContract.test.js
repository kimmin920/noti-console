import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const WORKER_SOURCE = readFileSync(new URL('../../../scripts/worker.js', import.meta.url), 'utf8');

describe('message result worker contract', () => {
  it('runs correction, bulk, evidence, and retention work without old pull-sync calls', () => {
    expect(WORKER_SOURCE).toContain('correctDueMessageResults');
    expect(WORKER_SOURCE).toContain('cleanupMessageLogLedgerRetention');
    expect(WORKER_SOURCE).toContain('processNextSmsBulkSendBatch');
    expect(WORKER_SOURCE).toContain('cleanupExpiredEvidence');

    expect(WORKER_SOURCE).not.toContain('syncDueBulkResults');
    expect(WORKER_SOURCE).not.toContain('syncDailyBulkResultCorrection');
    expect(WORKER_SOURCE).not.toContain('MESSAGE_LOG_SYNC');
  });

  it('logs only safe correction counters', () => {
    expect(WORKER_SOURCE).toContain('message result correction processed=');
    expect(WORKER_SOURCE).toContain('corrected=');
    expect(WORKER_SOURCE).toContain('finalized=');
    expect(WORKER_SOURCE).toContain('stale=');
    expect(WORKER_SOURCE).toContain('errors=');

    expect(WORKER_SOURCE).not.toContain('recipientNo');
    expect(WORKER_SOURCE).not.toContain('messageBody');
    expect(WORKER_SOURCE).not.toContain('providerResponse');
    expect(WORKER_SOURCE).not.toContain('raw');
  });
});
