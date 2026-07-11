import { describe, expect, it } from 'vitest';

import { transformConsoleHref } from '../../features/console/routing.js';

describe('message log navigation hrefs', () => {
  it('preserves list filters and pagination when opening and returning from detail in Publ mode', () => {
    const listHref = '/logs?channel=sms&messageType=lms&from=2026-06-01T00%3A00%3A00.000Z&to=2026-06-02T00%3A00%3A00.000Z&page=3&pageSize=50';
    const detailHref = '/logs/group-1?channel=sms&messageType=lms&from=2026-06-01T00%3A00%3A00.000Z&to=2026-06-02T00%3A00%3A00.000Z&page=3&pageSize=50';

    expect(transformConsoleHref(listHref, { mode: 'embed' })).toBe(
      '/publ-client/logs?channel=sms&messageType=lms&from=2026-06-01T00%3A00%3A00.000Z&to=2026-06-02T00%3A00%3A00.000Z&page=3&pageSize=50'
    );
    expect(transformConsoleHref(detailHref, { mode: 'embed' })).toBe(
      '/publ-client/logs/group-1?channel=sms&messageType=lms&from=2026-06-01T00%3A00%3A00.000Z&to=2026-06-02T00%3A00%3A00.000Z&page=3&pageSize=50'
    );
  });

  it('keeps malformed log ids and API export downloads outside console navigation rewriting', () => {
    expect(transformConsoleHref('/logs/group%2F1?channel=sms&page=2', { mode: 'embed' })).toBe('/logs/group%2F1?channel=sms&page=2');
    expect(transformConsoleHref('/api/message-logs/export?channel=sms', { mode: 'embed' })).toBe('/api/message-logs/export?channel=sms');
  });
});
