import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default function NewSmsTemplatePage({ searchParams }) {
  return <ConsoleRoute pageId="templates-sms-new" searchParams={searchParams} />;
}
