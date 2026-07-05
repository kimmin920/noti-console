import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default function ReservationDetailRoute({ searchParams }) {
  return <ConsoleRoute pageId="reservation-detail" searchParams={searchParams} />;
}
