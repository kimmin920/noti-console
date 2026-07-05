import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default async function LogGroupDetailPage({ params, searchParams }) {
  const { groupId } = await params;

  return (
    <ConsoleRoute
      pageId="log-detail"
      pageProps={{ logDetail: { groupId } }}
      searchParams={searchParams}
    />
  );
}
