import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default function AutomationRuleEditPage({ searchParams }) {
  return <ConsoleRoute pageId="automations-edit" searchParams={searchParams} />;
}
