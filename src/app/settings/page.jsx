import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default function SettingsPage({ searchParams }) {
  return <ConsoleRoute pageId="settings" searchParams={searchParams} />;
}
