'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ResendButton } from './primitives/ResendButton.jsx';
import { ResendInput } from './primitives/ResendInput.jsx';
import { TemplateThumbnail } from './TemplateThumbnail.jsx';

export function TemplatePicker({
  family,
  isCreatingTemplate = false,
  loading = false,
  onCreateNew,
  onTemplatePreview,
  onTemplateSelect,
  placeholder = 'Search templates...',
  templates,
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTemplates = useMemo(() => (
    normalizedQuery
      ? templates.filter((template) => template.name.toLowerCase().includes(normalizedQuery))
      : templates
  ), [normalizedQuery, templates]);

  return (
    <div className="resend-ui-domain-automation-send-email-node__picker">
      <label className="resend-ui-domain-automation-send-email-node__search">
        <Search aria-hidden="true" size={14} />
        <ResendInput
          aria-label="Search templates"
          className="resend-ui-domain-automation-send-email-node__search-input"
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={placeholder}
          value={query}
        />
      </label>
      <div className="resend-ui-domain-automation-send-email-node__scroll-region">
        {loading ? (
          <TemplatePickerSkeleton />
        ) : filteredTemplates.length > 0 ? (
          <div className="resend-ui-domain-automation-send-email-node__template-grid">
            {filteredTemplates.map((template) => (
              <TemplatePickerCard
                family={family}
                key={template.id}
                onTemplatePreview={onTemplatePreview}
                onTemplateSelect={onTemplateSelect}
                template={template}
              />
            ))}
          </div>
        ) : (
          <TemplatePickerEmpty
            isCreatingTemplate={isCreatingTemplate}
            isSearching={normalizedQuery.length > 0}
            onCreateNew={onCreateNew}
          />
        )}
      </div>
    </div>
  );
}

function TemplatePickerCard({
  family,
  onTemplatePreview,
  onTemplateSelect,
  template,
}) {
  return (
    <div
      className="resend-ui-domain-automation-send-email-node__template-card"
      data-resend-domain-automation-send-email-template-card={template.id}
      title={template.name}
    >
      <button
        aria-label={`템플릿 미리보기: ${template.name}`}
        className="resend-ui-domain-automation-send-email-node__template-card-thumbnail-action"
        onClick={() => onTemplatePreview?.(template)}
        type="button"
      >
        <span className="resend-ui-domain-automation-send-email-node__template-card-preview">
          <TemplateThumbnail
            family={family}
            name={template.name}
            template={template}
            thumbnailSrc={template.thumbnailSrc}
          />
          {template.status === 'draft' ? (
            <span className="resend-ui-domain-automation-send-email-node__badge">Draft</span>
          ) : null}
        </span>
      </button>
      <button
        className="resend-ui-domain-automation-send-email-node__template-card-main"
        onClick={() => onTemplateSelect?.(template)}
        type="button"
      >
        <span className="resend-ui-domain-automation-send-email-node__template-card-name">
          {template.name}
        </span>
      </button>
    </div>
  );
}

function TemplatePickerEmpty({
  isCreatingTemplate,
  isSearching,
  onCreateNew,
}) {
  const canCreateTemplate = typeof onCreateNew === 'function';

  return (
    <div className="resend-ui-domain-automation-send-email-node__empty">
      <p>{isSearching ? '검색 결과가 없습니다.' : '선택 가능한 템플릿이 없습니다.'}</p>
      <span>{isSearching ? '다른 검색어를 입력하세요.' : '발신 리소스에 연결된 승인 템플릿을 선택할 수 없습니다.'}</span>
      {!isSearching && canCreateTemplate ? (
        <ResendButton disabled={isCreatingTemplate} onClick={onCreateNew} variant="interactive">
          {isCreatingTemplate ? '생성 중' : '새로 만들기'}
        </ResendButton>
      ) : null}
    </div>
  );
}

function TemplatePickerSkeleton() {
  const items = Array.from({ length: 6 }, (_, index) => `template-picker-skeleton-${index}`);

  return (
    <div
      aria-live="polite"
      className="resend-ui-domain-automation-send-email-node__template-grid"
    >
      {items.map((item) => (
        <div
          aria-hidden="true"
          className="resend-ui-domain-automation-send-email-node__template-skeleton"
          key={item}
        />
      ))}
    </div>
  );
}
