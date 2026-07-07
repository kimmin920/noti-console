import { describe, expect, it } from 'vitest';

import {
  formatBuildInfoTitle,
  resolveBuildInfo,
  shortenBuildSha,
} from '../../buildInfo.js';

describe('build info', () => {
  it('uses package version and local build fallback when build env is missing', () => {
    const info = resolveBuildInfo({});

    expect(info.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(info.shortSha).toBe('local');
    expect(info.buildTime).toBeNull();
  });

  it('uses explicit public build environment values', () => {
    const info = resolveBuildInfo({
      NEXT_PUBLIC_APP_VERSION: ' 1.2.3 ',
      NEXT_PUBLIC_BUILD_SHA: '2d72c0e9dd7b89346548d6dffacc458cca568b2f',
      NEXT_PUBLIC_BUILD_TIME: '2026-07-07T05:49:56Z',
    });

    expect(info).toMatchObject({
      buildSha: '2d72c0e9dd7b89346548d6dffacc458cca568b2f',
      buildTime: '2026-07-07T05:49:56Z',
      shortSha: '2d72c0e9',
      version: '1.2.3',
    });
  });

  it('formats a compact human-readable title', () => {
    const title = formatBuildInfoTitle({
      buildTime: '2026-07-07T05:49:56Z',
      shortSha: '2d72c0e9',
      version: '1.2.3',
    });

    expect(title).toBe('Version 1.2.3, build 2d72c0e9, built 2026-07-07T05:49:56Z');
  });

  it('keeps non-hash build identifiers readable', () => {
    expect(shortenBuildSha('local')).toBe('local');
    expect(shortenBuildSha('unknown')).toBe('local');
    expect(shortenBuildSha('release-candidate')).toBe('release-');
  });
});
