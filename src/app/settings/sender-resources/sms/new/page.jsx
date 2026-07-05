import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default function SmsSenderResourceNewPage({ searchParams }) {
  return <ConsoleRoute pageId="settings-sender-sms-new" searchParams={searchParams} />;
}
