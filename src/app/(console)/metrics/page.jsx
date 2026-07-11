import { MetricsPage as MetricsScreen } from '@/features/console/metrics/MetricsPage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default function MetricsPage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="metrics" searchParams={searchParams}>
      <MetricsScreen />
    </StandaloneConsoleRoute>
  );
}
