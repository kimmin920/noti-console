import { BrandMessagePreviewMessage } from './BrandMessagePreview.jsx';
import {
  getBrandTemplateBody,
  getBrandTemplateSenderLabel,
  getBrandTemplateType,
} from './brandMessageTemplateCardPreviewData.js';

export function BrandMessageTemplateCardPreview({ className = '', template }) {
  const templateCode = getBrandTemplateCode(template);
  const chatBubbleType = getBrandTemplateType(template);
  const isCarousel = chatBubbleType === 'CAROUSEL_FEED' || chatBubbleType === 'CAROUSEL_COMMERCE';
  const senderProfileId = String(template.senderProfileId ?? template.senderProfile?.id ?? template.ownerKey ?? template.plusFriendId ?? 'brand-template-card-sender');
  const senderLabel = getBrandTemplateSenderLabel(template);
  const previewTemplate = {
    ...template,
    content: getBrandTemplateBody(template),
    senderProfileId,
    templateCode,
    value: template.value ?? templateCode,
  };
  const previewValue = {
    chatBubbleType,
    mode: 'template',
    senderProfileId,
    templateCode,
    templateParameter: template.templateParameter ?? {},
  };

  return (
    <span className={['template-card-brand-preview-shell', className].filter(Boolean).join(' ')}>
      <span
        className={['template-card-brand-preview', isCarousel ? 'is-carousel' : ''].filter(Boolean).join(' ')}
        data-brand-template-type={chatBubbleType}
      >
        <BrandMessagePreviewMessage
          senderProfiles={[{ label: senderLabel, plusFriendId: senderLabel, value: senderProfileId }]}
          templates={[previewTemplate]}
          value={previewValue}
        />
      </span>
    </span>
  );
}

function getBrandTemplateCode(template) {
  return String(template.templateCode ?? template.templateId ?? template.value ?? template.id ?? '');
}
