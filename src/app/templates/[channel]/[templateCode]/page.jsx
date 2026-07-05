import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export const metadata = {
  title: 'Template detail - Messaging App',
};

export default async function TemplateDetailRoute({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <ConsoleRoute
      pageId="templates-detail"
      pageProps={{
        templateDetail: {
          channel: resolvedParams.channel,
          query: {
            senderResourceId: resolvedSearchParams?.senderResourceId ?? '',
            source: resolvedSearchParams?.source ?? '',
            sourceKey: resolvedSearchParams?.sourceKey ?? '',
          },
          templateCode: resolvedParams.templateCode,
        },
      }}
      searchParams={resolvedSearchParams}
    />
  );
}
