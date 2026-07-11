import { AutomationRuleDetailPage as AutomationRuleDetailScreen } from '@/features/console/automations/AutomationRuleDetailPage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default async function AutomationRuleDetailPage({ params, searchParams }) {
  const { ruleId } = await params;

  return (
    <StandaloneConsoleRoute pageId="automations-detail" searchParams={searchParams}>
      <AutomationRuleDetailScreen ruleId={ruleId} />
    </StandaloneConsoleRoute>
  );
}
