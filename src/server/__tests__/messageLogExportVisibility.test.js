import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { MessageLogsExportAction } from '../../features/console/messageLogs/MessageLogsExportAction.jsx';

describe('MessageLogsExportAction', () => {
  it('renders a clickable standalone CSV action and invokes the existing export callback', () => {
    const onExport = vi.fn();
    const action = MessageLogsExportAction({
      disabled: false,
      isPending: false,
      isPublEmbed: false,
      onExport,
    });
    const html = renderToStaticMarkup(createElement(() => action));

    expect(html).toContain('<button');
    expect(html).toContain('CSV 내보내기');
    expect(html).not.toContain('disabled=""');

    action.props.onClick();
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('renders no export action in Publ embed mode', () => {
    expect(MessageLogsExportAction({
      disabled: false,
      isPending: false,
      isPublEmbed: true,
      onExport: vi.fn(),
    })).toBeNull();
  });

  it('renders a disabled pending state for standalone exports', () => {
    const html = renderToStaticMarkup(createElement(MessageLogsExportAction, {
      disabled: false,
      isPending: true,
      isPublEmbed: false,
      onExport: vi.fn(),
    }));

    expect(html).toContain('disabled=""');
    expect(html).toContain('내보내는 중…');
  });
});
