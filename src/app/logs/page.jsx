import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default function LogsPage({ searchParams }) {
  return <ConsoleRoute pageId="logs" searchParams={searchParams} />;
}
