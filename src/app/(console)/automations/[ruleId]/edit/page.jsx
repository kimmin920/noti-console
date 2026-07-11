import { AutomationRuleEditorPage } from '@/features/console/automations/AutomationRuleEditorPage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default async function AutomationRuleEditPage({ params, searchParams }) {
  const { ruleId } = await params;

  return (
    <StandaloneConsoleRoute pageId="automations-edit" searchParams={searchParams}>
      <AutomationRuleEditorPage mode="edit" ruleId={ruleId} />
    </StandaloneConsoleRoute>
  );
}
