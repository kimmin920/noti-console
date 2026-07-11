import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';
import { SenderResourceApplicationPage } from '@/features/console/settings/SettingsPage.jsx';

export default function SmsSenderResourceNewPage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="settings-sender-sms-new" searchParams={searchParams}>
      <SenderResourceApplicationPage type="sms" />
    </StandaloneConsoleRoute>
  );
}
