import { AutomationRuleEditorPage } from '@/features/console/automations/AutomationRuleEditorPage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default function AutomationRuleNewPage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="automations-new" searchParams={searchParams}>
      <AutomationRuleEditorPage mode="create" />
    </StandaloneConsoleRoute>
  );
}
