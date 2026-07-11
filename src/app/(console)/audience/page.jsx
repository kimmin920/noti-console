import { ConfiguredConsolePage } from '@/features/console/ConfiguredConsolePage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default function AudiencePage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="audience" searchParams={searchParams}>
      <ConfiguredConsolePage />
    </StandaloneConsoleRoute>
  );
}
