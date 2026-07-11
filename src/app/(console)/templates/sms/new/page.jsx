import { StandaloneConsoleRoute } from '@/features/console/StandaloneConsoleRoute.jsx';
import { SmsTemplateCreatePage } from '@/features/console/templates/SmsTemplateCreatePage.jsx';

export default function NewSmsTemplatePage({ searchParams }) {
  return (
    <StandaloneConsoleRoute pageId="templates-sms-new" searchParams={searchParams}>
      <SmsTemplateCreatePage />
    </StandaloneConsoleRoute>
  );
}
