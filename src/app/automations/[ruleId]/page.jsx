import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default function AutomationRuleDetailPage({ searchParams }) {
  return <ConsoleRoute pageId="automations-detail" searchParams={searchParams} />;
}
