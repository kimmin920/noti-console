import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default function MessageSendPage({ searchParams }) {
  return <ConsoleRoute pageId="emails" searchParams={searchParams} />;
}
