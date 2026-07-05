import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default function TemplatesPage({ searchParams }) {
  return <ConsoleRoute pageId="templates" searchParams={searchParams} />;
}
