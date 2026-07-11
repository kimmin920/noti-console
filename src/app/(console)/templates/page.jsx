import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';
import { TemplatePage } from '@/features/console/templates/TemplatePage.jsx';

export default function TemplatesPage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="templates" searchParams={searchParams}>
      <TemplatePage />
    </StandaloneConsoleRoute>
  );
}
