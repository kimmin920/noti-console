import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  StandaloneConsoleProvider,
  useStandaloneConsole,
} from '../../features/console/StandaloneConsoleContext.jsx';

function ContextProbe() {
  const context = useStandaloneConsole();
  return React.createElement('span', null, context.meta.title);
}

describe('standalone console context', () => {
  it('passes route metadata without cloning App Router children', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        StandaloneConsoleProvider,
        { meta: { title: '자동화' }, onDocs: () => {} },
        React.createElement(ContextProbe)
      )
    );

    expect(html).toBe('<span>자동화</span>');

    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/features/console/StandaloneConsolePage.jsx'),
      'utf8'
    );
    expect(source).not.toContain('cloneElement');
    expect(source).toContain('<StandaloneConsoleProvider');
  });
});
