'use client';

import {
  AlimtalkPreview,
  NhnBrandMessagePreview,
  SmsPreview,
} from '../../../../components/ui/index.js';
import {
  getTemplateCode,
} from '../automationTemplateMetadata.js';

export function AutomationTemplatePreviewPanel({
  configuration,
  draft,
  family,
}) {
  const selectedSender = configuration?.selectedSender ?? null;
  const selectedTemplate = configuration?.selectedTemplate ?? null;
  const senderOptions = configuration?.senderOptions ?? [];
  const templates = configuration?.templates ?? [];

  if (!selectedTemplate) {
    return (
      <div className="resend-ui-domain-automation-send-email-node__preview">
        <div className="automation-message-node-empty-preview">템플릿을 선택하세요.</div>
      </div>
    );
  }

  return (
    <div className="resend-ui-domain-automation-send-email-node__preview">
      <ChannelPreview
        draft={draft}
        family={family}
        selectedSender={selectedSender}
        selectedTemplate={selectedTemplate}
        senderOptions={senderOptions}
        templates={templates}
      />
    </div>
  );
}

function ChannelPreview({
  draft,
  family,
  selectedSender,
  selectedTemplate,
  senderOptions,
  templates,
}) {
  if (family === 'sms') {
    return (
      <SmsPreview
        className="automation-message-node-channel-preview"
        senderNumbers={senderOptions}
        value={{
          body: selectedTemplate.body ?? selectedTemplate.content ?? selectedTemplate.templateContent ?? '',
          senderNumber: selectedSender?.value ?? '',
          variables: {},
        }}
      />
    );
  }

  if (family === 'brand-message') {
    return (
      <NhnBrandMessagePreview
        className="automation-message-node-channel-preview"
        senderProfiles={senderOptions}
        templates={templates}
        value={{
          mode: 'template',
          senderProfileId: selectedSender?.value ?? '',
          templateCode: getTemplateCode(selectedTemplate),
          templateParameter: {},
        }}
      />
    );
  }

  return (
    <AlimtalkPreview
      className="automation-message-node-channel-preview"
      senderProfiles={senderOptions}
      templates={templates}
      value={{
        senderProfileId: selectedSender?.value ?? '',
        templateId: selectedTemplate.value ?? selectedTemplate.id ?? draft.templateCode ?? '',
        variables: {},
      }}
    />
  );
}
