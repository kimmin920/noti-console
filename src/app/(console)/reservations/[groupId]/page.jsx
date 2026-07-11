import { MessageReservationDetailPage } from '@/features/console/messageReservations/MessageReservationDetailPage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default function ReservationDetailRoute({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="reservation-detail" searchParams={searchParams}>
      <MessageReservationDetailPage />
    </StandaloneConsoleRoute>
  );
}
