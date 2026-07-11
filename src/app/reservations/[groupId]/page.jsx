import { ConsoleRoute } from '@/features/console/ConsoleRoute.jsx';

export default async function ReservationDetailRoute({ params, searchParams }) {
  const { groupId } = await params;

  return (
    <ConsoleRoute
      pageId="reservation-detail"
      pageProps={{ reservationDetail: { groupId } }}
      searchParams={searchParams}
    />
  );
}
