import { MessageReservationDetailPage } from '@/features/console/messageReservations/MessageReservationDetailPage.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default async function ReservationDetailRoute({ params, searchParams }) {
  const { groupId } = await params;

  return (
    <StandaloneConsoleRoute pageId="reservation-detail" searchParams={searchParams}>
      <MessageReservationDetailPage groupId={groupId} />
    </StandaloneConsoleRoute>
  );
}
