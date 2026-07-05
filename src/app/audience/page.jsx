import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default function AudiencePage({ searchParams }) {
  return <ConsoleRoute pageId="audience" searchParams={searchParams} />;
}
