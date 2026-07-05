'use client';

/* eslint-disable @next/next/no-img-element -- Keep the source-captured thumbnail DOM for visual parity. */

import { ImageOff } from 'lucide-react';

import { BrandMessageTemplateCardPreview } from '../../../../components/ui/BrandMessageTemplateCardPreview.jsx';
import { KakaoTemplateCardPreview } from '../../../../components/ui/KakaoTemplateCardPreview.jsx';
import { cx } from './shared.js';

export function TemplateThumbnail({
  className = '',
  family,
  name,
  template,
  thumbnailSrc,
  ...props
}) {
  const preview = template ? (
    <TemplateCardPreview family={family} name={name} template={template} />
  ) : null;

  return (
    <div
      className={cx('resend-ui-domain-automation-send-email-node__thumbnail', className)}
      {...props}
    >
      {thumbnailSrc ? (
        <div className="resend-ui-domain-automation-send-email-node__thumbnail-frame">
          <img
            alt={`${name} template preview`}
            className="resend-ui-domain-automation-send-email-node__thumbnail-image"
            decoding="async"
            height={300}
            loading="lazy"
            src={thumbnailSrc}
            width={400}
          />
        </div>
      ) : preview ?? (
        <div className="resend-ui-domain-automation-send-email-node__thumbnail-empty">
          <ImageOff aria-hidden="true" size={20} />
        </div>
      )}
    </div>
  );
}

function TemplateCardPreview({
  family,
  name,
  template,
}) {
  const previewTemplate = getPreviewTemplate(template, name);
  const previewFamily = getPreviewFamily(family, previewTemplate);

  if (previewFamily === 'brand-message') {
    return (
      <span
        className="resend-ui-domain-automation-send-email-node__thumbnail-inline-preview"
        data-automation-template-card-preview="brand-message"
      >
        <BrandMessageTemplateCardPreview template={previewTemplate} />
      </span>
    );
  }

  if (previewFamily === 'alimtalk') {
    return (
      <span
        className="resend-ui-domain-automation-send-email-node__thumbnail-inline-preview"
        data-automation-template-card-preview="alimtalk"
      >
        <KakaoTemplateCardPreview body={getPreviewBody(previewTemplate)} template={previewTemplate} />
      </span>
    );
  }

  if (previewFamily === 'sms') {
    return (
      <span
        className="resend-ui-domain-automation-send-email-node__thumbnail-inline-preview"
        data-automation-template-card-preview="sms"
      >
        <span className="automation-message-node-sms-card-preview" role="group" aria-label={`${previewTemplate.name} 문자 미리보기`}>
          <span className="automation-message-node-sms-card-preview__phone">
            <span className="automation-message-node-sms-card-preview__time">오늘 오후 2:30</span>
            <span className="automation-message-node-sms-card-preview__bubble">
              {getPreviewBody(previewTemplate) || '템플릿 내용을 불러오면 표시됩니다.'}
            </span>
          </span>
        </span>
      </span>
    );
  }

  return (
    <div className="resend-ui-domain-automation-send-email-node__thumbnail-empty">
      <ImageOff aria-hidden="true" size={20} />
    </div>
  );
}

function getPreviewTemplate(template, name) {
  const sourceTemplate = template.sourceTemplate ?? template;

  return {
    ...sourceTemplate,
    name: name || sourceTemplate.name || sourceTemplate.templateName || '템플릿',
  };
}

function getPreviewFamily(family, template) {
  const channel = String(family || template.channel || '').toLowerCase();

  if (channel === 'brand' || channel === 'brand-message') return 'brand-message';
  if (channel === 'alimtalk') return 'alimtalk';
  if (channel === 'sms' || channel === 'lms' || channel === 'mms') return 'sms';

  return '';
}

function getPreviewBody(template) {
  return String(
    template.body
      ?? template.content
      ?? template.templateContent
      ?? template.message
      ?? template.messageText
      ?? ''
  ).trim();
}
