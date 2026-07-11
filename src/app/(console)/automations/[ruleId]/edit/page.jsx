import { AutomationRuleEditorPage } from '@/features/console/automations/AutomationRuleEditorPage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default function AutomationRuleEditPage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="automations-edit" searchParams={searchParams}>
      <AutomationRuleEditorPage mode="edit" />
    </StandaloneConsoleRoute>
  );
}
