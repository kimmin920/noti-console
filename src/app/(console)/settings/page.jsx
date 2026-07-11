import { SettingsPage as SettingsScreen } from '@/features/console/settings/SettingsPage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default function SettingsPage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="settings" searchParams={searchParams}>
      <SettingsScreen />
    </StandaloneConsoleRoute>
  );
}
