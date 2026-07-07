import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BuildVersionBadge } from '../../components/layout/BuildVersionBadge.jsx';

describe('BuildVersionBadge', () => {
  it('renders only the version visibly and keeps build details for hover', () => {
    const html = renderToStaticMarkup(createElement(BuildVersionBadge, {
      info: {
        buildTime: '2026-07-07T05:49:56Z',
        shortSha: '2d72c0e9',
        version: '1.2.3',
      },
    }));

    expect(html).toContain('<button');
    expect(html).toContain('v1.2.3');
    expect(html).toContain('data-build-details="build 2d72c0e9, built 2026-07-07T05:49:56Z"');
    expect(html).toContain('aria-label="Version 1.2.3, build 2d72c0e9, built 2026-07-07T05:49:56Z. 자세히 보기"');
    expect(html).not.toContain('build-version-badge-sha');
    expect(html).not.toContain('build-version-badge-separator');
  });
});
