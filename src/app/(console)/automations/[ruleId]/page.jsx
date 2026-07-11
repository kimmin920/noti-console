import { AutomationRuleDetailPage as AutomationRuleDetailScreen } from '@/features/console/automations/AutomationRuleDetailPage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default function AutomationRuleDetailPage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="automations-detail" searchParams={searchParams}>
      <AutomationRuleDetailScreen />
    </StandaloneConsoleRoute>
  );
}
