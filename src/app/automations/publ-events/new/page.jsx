import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export const metadata = {
  title: 'Create PUBL event - Messaging App',
};

export default function PublEventCreateRoute({ searchParams }) {
  return <ConsoleRoute pageId="publ-event-new" searchParams={searchParams} />;
}
