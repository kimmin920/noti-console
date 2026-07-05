import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default function MetricsPage({ searchParams }) {
  return <ConsoleRoute pageId="metrics" searchParams={searchParams} />;
}
