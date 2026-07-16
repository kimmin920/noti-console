import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BuildVersionBadge } from '../../components/layout/BuildVersionBadge.jsx';

describe('BuildVersionBadge', () => {
  it('renders only the version visibly and keeps build details in the dialog trigger label', () => {
    const html = renderToStaticMarkup(createElement(BuildVersionBadge, {
      info: {
        buildSubject: 'feat: format build time in KST',
        buildTime: '2026-07-07T05:49:56Z',
        shortSha: '2d72c0e9',
        version: '1.2.3',
      },
    }));

    expect(html).toContain('<button');
    expect(html).toContain('v1.2.3');
    expect(html).not.toContain('data-build-details');
    expect(html).toContain('aria-label="Version 1.2.3, build 2d72c0e9, commit feat: format build time in KST, built 2026-07-07 14:49:56 KST. 자세히 보기"');
    expect(html).not.toContain('build-version-badge-sha');
    expect(html).not.toContain('build-version-badge-separator');
  });

  it('keeps the commit field visible when the build subject is unavailable', () => {
    const html = renderToStaticMarkup(createElement(BuildVersionBadge, {
      info: {
        buildSubject: null,
        buildTime: '2026-07-07T05:49:56Z',
        shortSha: '2d72c0e9',
        version: '1.2.3',
      },
    }));

    expect(html).not.toContain('data-build-details');
    expect(html).toContain('aria-label="Version 1.2.3, build 2d72c0e9, commit 작업 설명 없음, built 2026-07-07 14:49:56 KST. 자세히 보기"');
  });
});
