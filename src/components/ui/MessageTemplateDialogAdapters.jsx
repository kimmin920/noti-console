'use client';

import { BrandMessageTemplateCardPreview } from './BrandMessageTemplateCardPreview.jsx';
import {
  brandTemplateTypeLabels,
  getBrandTemplateType,
} from './brandMessageTemplateCardPreviewData.js';
import { KakaoTemplateCardPreview } from './KakaoTemplateCardPreview.jsx';

const COMMON_TEMPLATE_SOURCE = 'GROUP';
const ALIMTALK_TEMPLATE_STATUS_LABELS = Object.freeze({
  APR: '승인',
  APPROVED: '승인',
  REQ: '요청',
  REJ: '반려',
  TSC01: '요청',
  TSC02: '검수중',
  TSC03: '승인',
  TSC04: '반려',
});
const ALIMTALK_TEMPLATE_STATUS_TONES = Object.freeze({
  APR: 'green',
  APPROVED: 'green',
  REQ: 'yellow',
  REJ: 'red',
  TSC01: 'yellow',
  TSC02: 'blue',
  TSC03: 'green',
  TSC04: 'red',
});

export function getSmsTemplateDialogItems(templates) {
  return templates.map((template) => ({
    ...template,
    description: template.templateDesc ?? template.body,
    id: template.value ?? template.templateId ?? template.id,
    name: template.templateName ?? template.name ?? template.templateId,
    previewText: template.body,
    subject: template.title ?? template.subject ?? template.templateName,
  }));
}

export function getAlimtalkTemplateDialogItems(templates) {
  return templates.map((template) => {
    const body = String(template.body ?? template.content ?? template.description ?? '');
    const code = String(template.templateCode ?? template.templateId ?? template.value ?? template.id ?? '');
    const fallbackName = template.templateName ?? template.name ?? template.label ?? code;
    const name = String(fallbackName || '제목 없는 템플릿');
    const ownerLabel = getAlimtalkTemplateOwnerLabel(template);
    const statusCode = template.providerStatusCode ?? template.providerStatus;

    return {
      ...template,
      alias: code,
      body,
      code,
      codeMetaLabel: getAlimtalkTemplateCodeMetaLabel(template, ownerLabel),
      description: body,
      id: template.id ?? template.value ?? code,
      imageUrl: template.templateImageUrl ?? template.image?.imageUrl ?? template.image?.url ?? null,
      name,
      ownerLabel,
      previewText: body,
      status: getAlimtalkTemplateStatusLabel(statusCode, template.statusName),
      statusTone: getAlimtalkTemplateStatusTone(statusCode),
      subject: template.label ?? name,
    };
  });
}

export function AlimtalkTemplateDialogCard({ cardKey, onSelect, template }) {
  const previewBody = template.body?.trim();

  return (
    <button
      aria-label={`${template.name} 템플릿 선택`}
      className="email-send-form-template-card email-send-form-template-card--alimtalk template-card"
      key={cardKey}
      onClick={onSelect}
      type="button"
    >
      <span className="template-card-preview-frame">
        <span className="template-card-preview-link" aria-hidden="true">
          {template.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- NHN template image URLs can come from provider-hosted domains.
            <img
              alt=""
              className="template-card-preview-image"
              loading="lazy"
              src={template.imageUrl}
            />
          ) : previewBody ? (
            <KakaoTemplateCardPreview body={previewBody} template={template} />
          ) : (
            <span className="template-card-preview-fallback">
              <span className="template-card-preview-text">미리보기가 없습니다.</span>
            </span>
          )}
        </span>
      </span>
      <span className="template-card-content">
        <span className="template-card-header">
          <span className="template-card-copy">
            <span className="template-card-title" title={template.name}>{template.name}</span>
            <span className="template-card-alias-row">
              <code className="template-card-alias" title={template.code}>{template.code}</code>
              {template.codeMetaLabel ? (
                <>
                  <span className="template-card-alias-separator" aria-hidden="true">|</span>
                  <span className="template-card-code-meta" title={template.codeMetaLabel}>
                    {template.codeMetaLabel}
                  </span>
                </>
              ) : null}
            </span>
          </span>
          <span className={['template-card-status', 'badge', template.statusTone].filter(Boolean).join(' ')}>
            {template.status}
          </span>
        </span>
      </span>
    </button>
  );
}

export function getBrandTemplateDialogItems(templates) {
  return templates.map((template) => {
    const body = String(template.body ?? template.content ?? template.description ?? '');
    const code = String(getBrandTemplateCode(template));
    const fallbackName = template.templateName ?? template.name ?? template.label ?? code;
    const name = String(fallbackName || '제목 없는 템플릿');

    return {
      ...template,
      alias: code,
      body,
      code,
      description: body,
      id: template.id ?? template.value ?? code,
      imageUrl: getBrandTemplateImageUrl(template),
      name,
      previewText: body,
      subject: template.label ?? name,
      templateTypeLabel: brandTemplateTypeLabels[getBrandTemplateType(template)] ?? '',
    };
  });
}

export function BrandMessageTemplateDialogCard({ cardKey, isSelected = false, onSelect, template }) {
  return (
    <button
      aria-label={`${template.name} 템플릿 선택`}
      aria-pressed={isSelected}
      className="email-send-form-template-card email-send-form-template-card--brand template-card"
      data-selected={isSelected ? 'true' : undefined}
      key={cardKey}
      onClick={onSelect}
      type="button"
    >
      <span className="template-card-preview-frame">
        <span className="template-card-preview-surface template-card-preview-surface--brand-dialog" aria-hidden="true">
          <BrandMessageTemplateCardPreview template={template} />
        </span>
      </span>
      <span className="template-card-content">
        <span className="template-card-header">
          <span className="template-card-copy">
            <span className="template-card-title" title={template.name}>{template.name}</span>
            <span className="template-card-alias-row">
              <code className="template-card-alias" title={template.code}>{template.code}</code>
              {template.codeMetaLabel ? (
                <>
                  <span className="template-card-alias-separator" aria-hidden="true">|</span>
                  <span className="template-card-code-meta" title={template.codeMetaLabel}>
                    {template.codeMetaLabel}
                  </span>
                </>
              ) : null}
            </span>
            {template.templateTypeLabel ? (
              <span className="template-card-description-row">
                <span className="template-card-type-meta">[{template.templateTypeLabel}]</span>
              </span>
            ) : null}
          </span>
          {template.status ? (
            <span className={['template-card-status', 'badge', template.statusTone].filter(Boolean).join(' ')}>
              {template.status}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function getAlimtalkTemplateCodeMetaLabel(template, ownerLabel) {
  if (String(template.source ?? '').toUpperCase() === COMMON_TEMPLATE_SOURCE) {
    return '공통';
  }

  return ownerLabel;
}

function getAlimtalkTemplateOwnerLabel(template) {
  return String(template.sourceLabel ?? template.ownerLabel ?? template.plusFriendId ?? '').trim();
}

function getAlimtalkTemplateStatusLabel(statusCode, fallback) {
  return ALIMTALK_TEMPLATE_STATUS_LABELS[String(statusCode ?? '').toUpperCase()] ?? fallback ?? '상태 없음';
}

function getAlimtalkTemplateStatusTone(statusCode) {
  return ALIMTALK_TEMPLATE_STATUS_TONES[String(statusCode ?? '').toUpperCase()] ?? 'neutral';
}

function getBrandTemplateCode(template) {
  return template?.templateCode ?? template?.templateId ?? template?.value ?? template?.id ?? '';
}

function getBrandTemplateImageUrl(template) {
  return template?.templateImageUrl
    ?? template?.imageUrl
    ?? template?.image?.imageUrl
    ?? template?.image?.url
    ?? null;
}
