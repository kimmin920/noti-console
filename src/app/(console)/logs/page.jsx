import { MessageLogsPage } from '@/features/console/messageLogs/MessageLogsPage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default function LogsPage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="logs" searchParams={searchParams}>
      <MessageLogsPage />
    </StandaloneConsoleRoute>
  );
}
