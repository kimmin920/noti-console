'use client';

import { ResendButton } from './primitives/ResendButton.jsx';

export function DraftTemplateNotice({
  isPublishing = false,
  onPublishTemplate,
  template,
}) {
  return (
    <div className="resend-ui-domain-automation-send-email-node__draft-notice">
      <span>Draft template. Publish before use</span>
      <ResendButton
        className="resend-ui-domain-automation-send-email-node__draft-action"
        disabled={isPublishing}
        onClick={(event) => {
          event.stopPropagation();
          onPublishTemplate?.(template);
        }}
        variant="interactive"
      >
        {isPublishing ? 'Publishing' : 'Publish'}
      </ResendButton>
    </div>
  );
}
