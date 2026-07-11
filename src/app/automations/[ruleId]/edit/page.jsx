import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default async function AutomationRuleEditPage({ params, searchParams }) {
  const { ruleId } = await params;

  return (
    <ConsoleRoute
      pageId="automations-edit"
      pageProps={{ automationDetail: { ruleId } }}
      searchParams={searchParams}
    />
  );
}
