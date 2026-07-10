import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('message log CSV export visibility', () => {
  it('hides the CSV action only for Publ embed mode without changing export download helper', () => {
    const consoleSource = readFileSync(
      new URL('../../features/console/ConsolePages.jsx', import.meta.url),
      'utf8'
    );
    const apiSource = readFileSync(
      new URL('../../features/console/messageLogs/api.js', import.meta.url),
      'utf8'
    );

    expect(consoleSource).toContain('publClient.isPublEmbed ? null');
    expect(consoleSource).toContain('CSV 내보내기');
    expect(apiSource).toContain('export async function downloadMessageLogsExport');
    expect(apiSource).toContain("fetch(withQuery(`${MESSAGE_LOGS_PATH}/export`, filters)");
  });
});
