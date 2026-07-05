import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default function DocsPage({ searchParams }) {
  return <ConsoleRoute pageId="docs" searchParams={searchParams} />;
}
