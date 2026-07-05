'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronLeft,
  Copy,
  FileText,
  Send,
  SquarePen,
} from 'lucide-react';
import {
  ActionMenu,
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuTrigger,
  Badge,
} from '../../../components/ui/index.js';
import {
  TEMPLATE_DETAIL_TABS,
  buildSummaryItems,
  buildUseTemplateHref,
} from './templateDetailModel.js';

export function TemplateHeader({ channelView, detail, onCopyCode, templateCode }) {
  const title = detail?.name || templateCode;
  return (
    <header className="resend-domain-header template-detail-header">
      <div className="resend-domain-status-icon template-detail-icon" aria-hidden="true">
        <FileText size={34} strokeWidth={1.6} />
      </div>
      <div className="resend-domain-title template-detail-title">
        <span>{channelView?.label ?? 'Template'}</span>
        <h1 id="template-detail-title" title={title}>{title}</h1>
      </div>
      <div className="resend-domain-actions template-detail-actions">
        <Link aria-label="템플릿 목록으로 돌아가기" className="resend-icon-button" href="/templates">
          <ChevronLeft aria-hidden="true" size={16} />
        </Link>
        <button aria-label="템플릿 코드 복사" className="resend-icon-button" onClick={onCopyCode} type="button">
          <Copy aria-hidden="true" size={15} />
        </button>
        <TemplateUseAction detail={detail} />
      </div>
    </header>
  );
}

export function TemplateSummary({ detail, senderResourceId }) {
  return (
    <dl className="resend-domain-summary template-detail-summary">
      {buildSummaryItems(detail, senderResourceId).map((item) => (
        <div className="resend-domain-summary-item" key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            {item.tone ? <Badge tone={item.tone}>{item.value}</Badge> : <span>{item.value}</span>}
            {item.detail ? <span className="resend-summary-detail">{item.detail}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function TemplateTabs({ activeTab, onTabChange }) {
  return (
    <div className="resend-domain-tabs-root" data-orientation="horizontal">
      <div className="resend-domain-tabs" role="tablist" aria-label="템플릿 상세 탭">
        {TEMPLATE_DETAIL_TABS.map((tab) => (
          <button
            aria-controls={`template-${tab.id}-panel`}
            aria-selected={activeTab === tab.id}
            data-active={activeTab === tab.id ? '' : undefined}
            id={`template-${tab.id}-tab`}
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TemplateDetailSkeleton() {
  return (
    <div className="template-detail-skeleton" aria-label="템플릿 상세를 불러오는 중입니다" role="status">
      <span />
      <span />
      <span />
    </div>
  );
}

export function TemplateDetailStatus({ copy, onRetry, title, tone }) {
  return (
    <div className="template-detail-status" data-tone={tone} role={tone === 'critical' ? 'alert' : 'status'}>
      <h2>{title}</h2>
      <p>{copy}</p>
      {onRetry ? <button className="resend-auto-configure" onClick={onRetry} type="button">다시 시도</button> : null}
    </div>
  );
}

function TemplateUseAction({ detail }) {
  const router = useRouter();

  if (!detail) {
    return <button className="resend-primary-button" disabled type="button">템플릿 사용</button>;
  }

  if (detail.channelView?.apiChannel !== 'brand-message') {
    return (
      <Link className="resend-primary-button template-detail-primary-link" href={buildUseTemplateHref(detail, 'use')}>
        발송에 사용
      </Link>
    );
  }

  return (
    <ActionMenu>
      <ActionMenuTrigger asChild>
        <button className="resend-primary-button template-detail-use-trigger" type="button">
          <span>템플릿 사용</span>
          <ChevronDown aria-hidden="true" size={14} />
        </button>
      </ActionMenuTrigger>
      <ActionMenuContent align="end" className="template-detail-use-menu" sideOffset={6}>
        <ActionMenuItem
          description="templateCode로 템플릿 발송"
          leadingVisual={<Send size={16} />}
          onSelect={() => router.push(buildUseTemplateHref(detail, 'use'))}
        >
          그대로 사용
        </ActionMenuItem>
        <ActionMenuItem
          description="내용을 가져와 자유형으로 수정"
          leadingVisual={<SquarePen size={16} />}
          onSelect={() => router.push(buildUseTemplateHref(detail, 'start'))}
        >
          복사해서 편집
        </ActionMenuItem>
      </ActionMenuContent>
    </ActionMenu>
  );
}
