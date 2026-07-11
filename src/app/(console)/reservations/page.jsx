import { MessageReservationsPage } from '@/features/console/messageReservations/MessageReservationsPage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default function ReservationsPage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="reservations" searchParams={searchParams}>
      <MessageReservationsPage />
    </StandaloneConsoleRoute>
  );
}
