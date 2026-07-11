import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';
import { BrandTemplateCreatePage } from '@/features/console/templates/BrandTemplateCreatePage.jsx';

export default function NewBrandTemplatePage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="templates-brand-new" searchParams={searchParams}>
      <BrandTemplateCreatePage />
    </StandaloneConsoleRoute>
  );
}
