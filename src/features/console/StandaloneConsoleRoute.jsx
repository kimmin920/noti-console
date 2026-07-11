import { StandaloneConsolePage } from './StandaloneConsolePage.jsx';
import { normalizeConsolePageId, normalizeShellMode } from './routing.js';

export async function StandaloneConsoleRoute({ children, pageId, searchParams }) {
  const params = await searchParams;

  return (
    <StandaloneConsolePage
      mode={normalizeShellMode(params?.mode)}
      pageId={normalizeConsolePageId(pageId)}
    >
      {children}
    </StandaloneConsolePage>
  );
}
