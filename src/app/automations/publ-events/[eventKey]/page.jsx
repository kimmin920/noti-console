import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export const metadata = {
  title: 'PUBL event detail - Messaging App',
};

export default async function PublEventDetailRoute({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <ConsoleRoute
      pageId="publ-event-detail"
      pageProps={{
        publEventDetail: {
          eventKey: resolvedParams.eventKey,
        },
      }}
      searchParams={resolvedSearchParams}
    />
  );
}
