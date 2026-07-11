import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';
import { SenderResourceApplicationPage } from '@/features/console/settings/SettingsPage.jsx';

export default function KakaoSenderResourceNewPage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="settings-sender-kakao-new" searchParams={searchParams}>
      <SenderResourceApplicationPage type="kakao" />
    </StandaloneConsoleRoute>
  );
}
