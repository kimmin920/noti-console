import { AlimtalkTemplateCreatePageNewDesign } from '@/features/console/alimtalkTemplates/AlimtalkTemplateCreatePageNewDesign.jsx';
import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';

export default function NewAlimtalkTemplatePage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="templates-alimtalk-new" searchParams={searchParams}>
      <AlimtalkTemplateCreatePageNewDesign />
    </StandaloneConsoleRoute>
  );
}
