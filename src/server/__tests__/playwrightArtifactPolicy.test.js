import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import playwrightConfig from '../../../playwright.config.mjs';

describe('Publ Playwright artifact policy', () => {
  it('disables raw browser retention and uses an auto-cleaned OS temp directory', () => {
    expect(playwrightConfig.use).toMatchObject({
      screenshot: 'off',
      trace: 'off',
      video: 'off',
    });
    expect(path.resolve(playwrightConfig.outputDir).startsWith(path.resolve(tmpdir()))).toBe(true);
    expect(playwrightConfig.globalTeardown).toBe('./tests/publ-client/global-teardown.mjs');
  });
});
