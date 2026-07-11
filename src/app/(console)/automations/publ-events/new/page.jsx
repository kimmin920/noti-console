import { PublEventCreatePage } from '@/features/console/publEvents/PublEventCreatePage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export const metadata = {
  title: 'Create PUBL event - Messaging App',
};

export default function PublEventCreateRoute({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="publ-event-new" searchParams={searchParams}>
      <PublEventCreatePage />
    </StandaloneConsoleRoute>
  );
}
