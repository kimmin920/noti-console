import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default function AutomationRuleNewPage({ searchParams }) {
  return <ConsoleRoute pageId="automations-new" searchParams={searchParams} />;
}
