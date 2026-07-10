import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PublClientInvalidRouteView } from '../../features/publClient/PublClientRouteEntry.jsx';
import {
  matchPublClientPath,
  getPublStandaloneHref,
} from '../../features/console/routing.js';

describe('Publ client canonical routing', () => {
  it('strips a valid top-level Publ path to the matching standalone URL with query intact', () => {
    const routeResult = matchPublClientPath('/publ-client/logs/group-1?channel=sms&page=2');

    expect(routeResult).toMatchObject({
      canonicalPathname: '/logs/group-1',
      ok: true,
      pageId: 'log-detail',
      pageProps: { logDetail: { groupId: 'group-1' } },
      queryString: 'channel=sms&page=2',
    });
    expect(getPublStandaloneHref(routeResult)).toBe('/logs/group-1?channel=sms&page=2');
  });

  it('keeps invalid Publ paths controlled without defaulting to message send', () => {
    for (const pathname of [
      '/publ-client/unknown',
      '/publ-client/publ-client/logs/group-1',
      '/publ-client/logs/group-1/extra',
      '/publ-client/logs/group%2F1',
      '/publ-client/logs/group%5C1',
    ]) {
      expect(matchPublClientPath(pathname)).toMatchObject({
        ok: false,
        pageId: null,
      });
    }
  });

  it('renders a controlled invalid-route view without login controls', () => {
    const html = renderToStaticMarkup(createElement(PublClientInvalidRouteView));

    expect(html).toContain('열 수 없는 경로입니다');
    expect(html).toContain('/publ-client/message-send');
    expect(html).not.toContain('로그인');
    expect(html).not.toContain('가입');
  });

  it('uses a catch-all page and no query-page route identity helper', () => {
    const catchAllSource = readSource('../../app/publ-client/[[...path]]/page.jsx');
    const oldRootSource = readOptionalSource('../../app/publ-client/page.jsx');
    const sdkAdapterSource = readSource('../../features/publClient/sdkAdapter.js');

    expect(catchAllSource).toContain('matchPublClientPath');
    expect(catchAllSource).toContain('PublClientRouteEntry');
    expect(oldRootSource).toBe('');
    expect(sdkAdapterSource).not.toContain('getPublClientPageHref');
    expect(sdkAdapterSource).not.toContain('new URLSearchParams({ page');
  });
});

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function readOptionalSource(relativePath) {
  try {
    return readSource(relativePath);
  } catch {
    return '';
  }
}
