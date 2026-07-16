import { AudiencePage as AudienceScreen } from '@/features/console/audience/AudienceTable.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default function AudiencePage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="audience" searchParams={searchParams}>
      <AudienceScreen />
    </StandaloneConsoleRoute>
  );
}
