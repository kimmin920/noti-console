import { MessageLogGroupDetailPage } from '@/features/console/messageLogs/MessageLogGroupDetailPage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default async function LogGroupDetailPage({ params, searchParams }) {
  const { groupId } = await params;

  return (
    <StandaloneConsoleRoute pageId="log-detail" searchParams={searchParams}>
      <MessageLogGroupDetailPage groupId={groupId} />
    </StandaloneConsoleRoute>
  );
}
