import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';
import { TemplateDetailPage } from '@/features/console/templates/TemplateDetailPage.jsx';

export const metadata = {
  title: 'Template detail - Messaging App',
};

export default async function TemplateDetailRoute({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <StandaloneConsoleRoute pageId="templates-detail" searchParams={resolvedSearchParams}>
      <TemplateDetailPage
        channel={resolvedParams.channel}
        query={{
          senderResourceId: resolvedSearchParams?.senderResourceId ?? '',
          source: resolvedSearchParams?.source ?? '',
          sourceKey: resolvedSearchParams?.sourceKey ?? '',
        }}
        templateCode={resolvedParams.templateCode}
      />
    </StandaloneConsoleRoute>
  );
}
