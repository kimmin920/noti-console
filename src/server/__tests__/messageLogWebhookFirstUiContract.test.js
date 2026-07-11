import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CONSOLE_SOURCE = readSource('../../features/console/messageLogs/MessageLogsPage.jsx');
const DETAIL_PAGE_SOURCE = readSource('../../features/console/messageLogs/MessageLogGroupDetailPage.jsx');
const MESSAGE_LOG_API_SOURCE = readSource('../../features/console/messageLogs/api.js');
const MESSAGE_LOG_MUTATIONS_SOURCE = readSource('../../features/console/messageLogs/mutations.js');

describe('message log webhook-first UI contract', () => {
  it('removes ordinary manual result-sync copy and client calls', () => {
    expect(CONSOLE_SOURCE).not.toContain('최신 결과 확인');
    expect(CONSOLE_SOURCE).not.toContain('마지막 확인');
    expect(CONSOLE_SOURCE).not.toContain('useMessageLogGroupSyncMutation');
    expect(CONSOLE_SOURCE).not.toContain('syncSelectedGroup');
    expect(MESSAGE_LOG_API_SOURCE).not.toContain('/sync');
    expect(MESSAGE_LOG_API_SOURCE).not.toContain('syncMessageLogGroup');
    expect(MESSAGE_LOG_MUTATIONS_SOURCE).not.toContain('useMessageLogGroupSyncMutation');
    expect(MESSAGE_LOG_MUTATIONS_SOURCE).not.toContain('syncMessageLogGroup');
  });

  it('does not expose an ordinary manual result-sync route', () => {
    const syncRoute = new URL('../../app/api/message-log-groups/[groupId]/sync/route.js', import.meta.url);

    expect(existsSync(syncRoute)).toBe(false);
  });

  it('keeps refresh scoped to local list/detail/failure queries', () => {
    expect(CONSOLE_SOURCE).toContain('onClick={() => groupsQuery.refetch()}');
    expect(CONSOLE_SOURCE).not.toContain('refreshSelectedGroup');
    expect(DETAIL_PAGE_SOURCE).toContain('useMessageLogGroupDetailQuery');
    expect(DETAIL_PAGE_SOURCE).toContain('useMessageLogGroupRequestFailuresQuery');
    expect(DETAIL_PAGE_SOURCE).not.toContain('invalidateQueries');
    expect(DETAIL_PAGE_SOURCE).not.toContain('syncMessageLogGroup');
  });

  it('uses local failure and detail hooks without provider request identifiers', () => {
    expect(DETAIL_PAGE_SOURCE).toContain('useMessageLogGroupRequestFailuresQuery');
    expect(DETAIL_PAGE_SOURCE).toContain('useMessageLogGroupRequestRecipientDetailQuery');
    expect(DETAIL_PAGE_SOURCE).not.toContain('useMessageLogGroupRequestRecipientsQuery');
    expect(DETAIL_PAGE_SOURCE).not.toContain('useMessageLogDetailQuery');
    expect(DETAIL_PAGE_SOURCE).not.toContain('providerRequestId');
    expect(DETAIL_PAGE_SOURCE).not.toContain('detail.requestId');
  });
});

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
