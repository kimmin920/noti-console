import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default async function AutomationRuleDetailPage({ params, searchParams }) {
  const { ruleId } = await params;

  return (
    <ConsoleRoute
      pageId="automations-detail"
      pageProps={{ automationDetail: { ruleId } }}
      searchParams={searchParams}
    />
  );
}
