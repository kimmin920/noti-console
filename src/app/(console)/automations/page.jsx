import { ConfiguredConsolePage } from '@/features/console/ConfiguredConsolePage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default function AutomationsPage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="automations" searchParams={searchParams}>
      <ConfiguredConsolePage />
    </StandaloneConsoleRoute>
  );
}
