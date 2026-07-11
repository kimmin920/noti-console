import { DocsPage as DocsScreen } from '@/features/console/docs/DocsPage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default function DocsPage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="docs" searchParams={searchParams}>
      <DocsScreen />
    </StandaloneConsoleRoute>
  );
}
