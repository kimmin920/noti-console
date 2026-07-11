'use client';

import { AutomationRuleDetailPage } from './automations/AutomationRuleDetailPage.jsx';
import { AutomationRuleEditorPage } from './automations/AutomationRuleEditorPage.jsx';
import { AdminSenderResourceApplicationsPage } from './admin/SenderResourceApplicationsPage.jsx';
import { ConfiguredConsolePage } from './ConfiguredConsolePage.jsx';
import { DocsPage } from './docs/DocsPage.jsx';
import { MessageLogGroupDetailPage } from './messageLogs/MessageLogGroupDetailPage.jsx';
import { MessageLogsPage } from './messageLogs/MessageLogsPage.jsx';
import { MessageReservationsPage } from './messageReservations/MessageReservationsPage.jsx';
import { MessageReservationDetailPage } from './messageReservations/MessageReservationDetailPage.jsx';
import { MessageSendPage, SmsBulkSendRunWatcher } from './messageSend/MessageSendPage.jsx';
import { MetricsPage } from './metrics/MetricsPage.jsx';
import { PublEventCreatePage } from './publEvents/PublEventCreatePage.jsx';
import { PublEventDetailPage } from './publEvents/PublEventDetailPage.jsx';
import { DEFAULT_CONSOLE_PAGE_ID } from './routing.js';
import {
  SenderResourceApplicationPage,
  SettingsPage,
} from './settings/SettingsPage.jsx';
import { AlimtalkTemplateCreatePageNewDesign as AlimtalkTemplateCreatePage } from './alimtalkTemplates/AlimtalkTemplateCreatePageNewDesign.jsx';
import { BrandTemplateCreatePage } from './templates/BrandTemplateCreatePage.jsx';
import { SmsTemplateCreatePage } from './templates/SmsTemplateCreatePage.jsx';
import { TemplateDetailPage } from './templates/TemplateDetailPage.jsx';
import { TemplatePage } from './templates/TemplatePage.jsx';

export function ConsoleScreenOutlet({ activePage, meta, onDocs, pageProps }) {
  let page = <ConfiguredConsolePage key={activePage} meta={meta} onDocs={onDocs} />;
  const templateDetail = pageProps?.templateDetail;
  const publEventDetail = pageProps?.publEventDetail;
  const logDetail = pageProps?.logDetail;

  if (activePage === DEFAULT_CONSOLE_PAGE_ID) {
    page = <MessageSendPage meta={meta} onDocs={onDocs} />;
  } else if (activePage === 'settings') {
    page = <SettingsPage />;
  } else if (activePage === 'settings-sender-sms-new') {
    page = <SenderResourceApplicationPage type="sms" />;
  } else if (activePage === 'settings-sender-kakao-new') {
    page = <SenderResourceApplicationPage type="kakao" />;
  } else if (activePage === 'automations-new') {
    page = <AutomationRuleEditorPage mode="create" />;
  } else if (activePage === 'automations-detail') {
    page = <AutomationRuleDetailPage />;
  } else if (activePage === 'automations-edit') {
    page = <AutomationRuleEditorPage mode="edit" />;
  } else if (activePage === 'publ-event-detail' && publEventDetail) {
    page = <PublEventDetailPage eventKey={publEventDetail.eventKey} />;
  } else if (activePage === 'publ-event-new') {
    page = <PublEventCreatePage />;
  } else if (activePage === 'templates-sms-new') {
    page = <SmsTemplateCreatePage />;
  } else if (activePage === 'templates-alimtalk-new') {
    page = <AlimtalkTemplateCreatePage />;
  } else if (activePage === 'templates-brand-new') {
    page = <BrandTemplateCreatePage />;
  } else if (activePage === 'admin' || activePage === 'admin-sender-resource-applications') {
    page = <AdminSenderResourceApplicationsPage />;
  } else if (activePage === 'docs') {
    page = <DocsPage meta={meta} />;
  } else if (activePage === 'metrics') {
    page = <MetricsPage meta={meta} />;
  } else if (activePage === 'reservations') {
    page = <MessageReservationsPage />;
  } else if (activePage === 'reservation-detail') {
    page = <MessageReservationDetailPage />;
  } else if (activePage === 'logs') {
    page = <MessageLogsPage />;
  } else if (activePage === 'log-detail' && logDetail) {
    page = <MessageLogGroupDetailPage groupId={logDetail.groupId} />;
  } else if (activePage === 'templates') {
    page = <TemplatePage meta={meta} />;
  } else if (activePage === 'templates-detail' && templateDetail) {
    page = (
      <TemplateDetailPage
        channel={templateDetail.channel}
        query={templateDetail.query}
        templateCode={templateDetail.templateCode}
      />
    );
  }

  return (
    <>
      <SmsBulkSendRunWatcher />
      {page}
    </>
  );
}
