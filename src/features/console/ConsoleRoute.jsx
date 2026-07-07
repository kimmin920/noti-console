import { ConsolePageOutlet } from './ConsolePageOutlet.jsx';
import { normalizeConsolePageId, normalizeShellMode } from './routing.js';

export async function ConsoleRoute({ pageId, pageProps, searchParams }) {
  const params = await searchParams;

  return (
    <ConsolePageOutlet
      mode={normalizeShellMode(params?.mode)}
      pageProps={pageProps}
      pageId={normalizeConsolePageId(pageId)}
    />
  );
}
