import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';
import { AdminSenderResourceApplicationsPage as AdminSenderResourceApplicationsScreen } from '@/features/console/admin/SenderResourceApplicationsPage.jsx';

export default function AdminSenderResourceApplicationsPage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="admin-sender-resource-applications" searchParams={searchParams}>
      <AdminSenderResourceApplicationsScreen />
    </StandaloneConsoleRoute>
  );
}
