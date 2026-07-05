import { MessagingConsole } from './MessagingConsole.jsx';
import { normalizeConsolePageId, normalizeShellMode } from './routing.js';

export async function ConsoleRoute({ pageId, pageProps, searchParams }) {
  const params = await searchParams;

  return (
    <MessagingConsole
      mode={normalizeShellMode(params?.mode)}
      pageProps={pageProps}
      pageId={normalizeConsolePageId(pageId)}
    />
  );
}
