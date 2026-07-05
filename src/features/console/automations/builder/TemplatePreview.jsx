'use client';

import { DraftTemplateNotice } from './DraftTemplateNotice.jsx';
import { TemplateThumbnail } from './TemplateThumbnail.jsx';

export function TemplatePreview({
  isPublishingTemplate = false,
  onChangeTemplate,
  onPublishTemplate,
  template,
}) {
  const isDraft = template.status === 'draft';

  return (
    <div className="resend-ui-domain-automation-send-email-node__preview">
      <div className="resend-ui-domain-automation-send-email-node__preview-frame">
        <button
          aria-label={`Change template: ${template.name}`}
          className="resend-ui-domain-automation-send-email-node__preview-hit-area"
          onClick={onChangeTemplate}
          type="button"
        />
        <TemplateThumbnail name={template.name} thumbnailSrc={template.thumbnailSrc} />
        <span className="resend-ui-domain-automation-send-email-node__preview-title">
          {template.name}
        </span>
        {isDraft ? (
          <div className="resend-ui-domain-automation-send-email-node__preview-draft">
            <DraftTemplateNotice
              isPublishing={isPublishingTemplate}
              onPublishTemplate={onPublishTemplate}
              template={template}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
