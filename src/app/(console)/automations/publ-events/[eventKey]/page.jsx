import { PublEventDetailPage } from '@/features/console/publEvents/PublEventDetailPage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export const metadata = {
  title: 'PUBL event detail - Messaging App',
};

export default async function PublEventDetailRoute({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <StandaloneConsoleRoute pageId="publ-event-detail" searchParams={resolvedSearchParams}>
      <PublEventDetailPage eventKey={resolvedParams.eventKey} />
    </StandaloneConsoleRoute>
  );
}
