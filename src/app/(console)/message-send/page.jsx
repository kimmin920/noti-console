import { MessageSendPage as MessageSendScreen } from '@/features/console/messageSend/MessageSendPage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default function MessageSendPage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="emails" searchParams={searchParams}>
      <MessageSendScreen />
    </StandaloneConsoleRoute>
  );
}
