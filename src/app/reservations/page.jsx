import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default function ReservationsPage({ searchParams }) {
  return <ConsoleRoute pageId="reservations" searchParams={searchParams} />;
}
