'use client';

import {
  Code2,
  ChevronLeft,
  Copy,
  Pencil,
  RefreshCcw,
  Save,
  Trash2,
  Workflow,
  X,
} from 'lucide-react';
import {
  Button,
} from '../../../components/ui/index.js';
import { ConsoleLink } from '../ConsoleNavigationContext.jsx';
import {
  buildPublEventSummaryItems,
} from './publEventDetailModel.js';

export function PublEventDetailHeader({
  canEdit = false,
  detail,
  eventKey,
  isEditing = false,
  onCancelEdit,
  onCopyEventKey,
  onEnterEdit,
  onRequestDelete,
  onOpenApiExample,
  onSave,
  deleteDisabled = false,
  saveDisabled = false,
  saveLabel = '저장',
}) {
  const title = detail?.displayName || eventKey;
  const automationHref = `/automations/new?eventKey=${encodeURIComponent(String(eventKey ?? ''))}`;

  return (
    <header className="publ-event-detail-header">
      <div className="publ-event-detail-status-icon" aria-hidden="true">
        <Workflow size={36} strokeWidth={1.7} />
      </div>
      <div className="publ-event-detail-title-block">
        <span className="publ-event-detail-context">PUBL Event</span>
        <h1 id="publ-event-detail-title" title={title}>{title}</h1>
        <code title={eventKey} translate="no">{eventKey}</code>
      </div>
      <div className="publ-event-detail-actions">
        <ConsoleLink className="publ-event-secondary-button publ-event-detail-link-button" href="/automations">
          <ChevronLeft aria-hidden="true" size={15} />
          목록
        </ConsoleLink>
        <Button className="publ-event-secondary-button" onClick={onCopyEventKey}>
          <Copy aria-hidden="true" size={14} />
          키 복사
        </Button>
        {onOpenApiExample ? (
          <Button className="publ-event-secondary-button" onClick={onOpenApiExample}>
            <Code2 aria-hidden="true" size={14} />
            API 예시
          </Button>
        ) : null}
        {isEditing ? (
          <>
            <Button className="publ-event-secondary-button" onClick={onCancelEdit}>
              <X aria-hidden="true" size={14} />
              취소
            </Button>
            <Button
              className="publ-event-primary-button"
              disabled={saveDisabled}
              onClick={onSave}
            >
              <Save aria-hidden="true" size={14} />
              {saveLabel}
            </Button>
          </>
        ) : (
          <>
            {canEdit ? (
              <>
                <Button className="publ-event-secondary-button" onClick={onEnterEdit}>
                  <Pencil aria-hidden="true" size={14} />
                  편집
                </Button>
                <Button
                  className="publ-event-secondary-button publ-event-danger-secondary-button"
                  disabled={deleteDisabled}
                  onClick={onRequestDelete}
                >
                  <Trash2 aria-hidden="true" size={14} />
                  삭제
                </Button>
              </>
            ) : null}
            <ConsoleLink className="publ-event-primary-button publ-event-detail-link-button" href={automationHref}>
              <Workflow aria-hidden="true" size={15} />
              자동화 생성
            </ConsoleLink>
          </>
        )}
      </div>
    </header>
  );
}

export function PublEventDetailSummary({ detail }) {
  return (
    <dl className="publ-event-detail-summary" aria-label="PUBL 이벤트 계약 요약">
      {buildPublEventSummaryItems(detail).map((item) => (
        <div className="publ-event-detail-summary-item" key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            {item.tone ? <span className="publ-event-status-badge">{item.value}</span> : (
              <span className={item.mono ? 'is-mono' : ''}>{item.value || '-'}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function PublEventDetailSkeleton() {
  return (
    <section
      aria-label="PUBL 이벤트 상세를 불러오는 중입니다"
      className="publ-event-detail-skeleton"
      role="status"
    >
      <span />
      <span />
      <span />
      <span />
    </section>
  );
}

export function PublEventDetailStatus({ actionHref, actionLabel, copy, onRetry, title, tone = 'neutral' }) {
  return (
    <section className="publ-event-detail-status" data-tone={tone} role={tone === 'critical' ? 'alert' : 'status'}>
      <div>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      {actionHref && actionLabel ? (
        <ConsoleLink className="publ-event-secondary-button publ-event-detail-link-button" href={actionHref}>
          {actionLabel}
        </ConsoleLink>
      ) : null}
      {onRetry ? (
        <Button className="publ-event-secondary-button" onClick={onRetry}>
          <RefreshCcw aria-hidden="true" size={14} />
          다시 시도
        </Button>
      ) : null}
    </section>
  );
}
