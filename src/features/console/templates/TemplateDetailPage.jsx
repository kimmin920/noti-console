'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '../../../components/ui/index.js';
import { relayGet, withQuery, getRelayErrorMessage } from '../messageSend/api.js';
import {
  TemplateDetailSkeleton,
  TemplateDetailStatus,
  TemplateHeader,
  TemplateSummary,
  TemplateTabs,
} from './TemplateDetailChrome.jsx';
import {
  TemplateContentPanel,
  TemplateParametersPanel,
  TemplatePayloadPanel,
} from './TemplateDetailSections.jsx';
import {
  TEMPLATE_DETAIL_TABS,
  getTemplateDetailChannel,
  normalizeTemplateDetail,
} from './templateDetailModel.js';

export function TemplateDetailPage({ channel, query, templateCode }) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState(TEMPLATE_DETAIL_TABS[0].id);
  const channelView = getTemplateDetailChannel(channel);
  const detailQuery = useTemplateDetailQuery({ channelView, query, templateCode });
  const senderResourceId = query.senderResourceId;
  const canLoadDetail = canLoadTemplateDetail({ channelView, query, templateCode });
  const detail = detailQuery.data?.template
    ? normalizeTemplateDetail({ channel: detailQuery.data.channel, template: detailQuery.data.template })
    : null;

  function copyTemplateCode() {
    writeClipboard(templateCode).then(() => {
      showToast({ description: templateCode, title: '템플릿 코드를 복사했습니다.', variant: 'success' });
    });
  }

  return (
    <section className="page-frame template-detail-page">
      <div className="resend-detail-content template-detail-content" aria-labelledby="template-detail-title">
        <TemplateHeader
          channelView={channelView}
          detail={detail}
          onCopyCode={copyTemplateCode}
          templateCode={templateCode}
        />
        {!canLoadDetail ? (
          <TemplateDetailStatus
            copy="템플릿 상세 조회에는 채널, 템플릿 코드, 발신 리소스 또는 공통 소스가 필요합니다. 템플릿 목록에서 다시 진입해 주세요."
            tone="warning"
            title="상세 조회 컨텍스트가 부족합니다"
          />
        ) : null}
        {canLoadDetail && detailQuery.isPending ? <TemplateDetailSkeleton /> : null}
        {detailQuery.isError ? (
          <TemplateDetailStatus
            copy={getRelayErrorMessage(detailQuery.error, '템플릿 상세를 불러오지 못했습니다.')}
            onRetry={() => detailQuery.refetch()}
            tone="critical"
            title="템플릿 상세를 불러오지 못했습니다"
          />
        ) : null}
        {detail ? (
          <>
            <TemplateSummary detail={detail} senderResourceId={senderResourceId} />
            <TemplateTabs activeTab={activeTab} onTabChange={setActiveTab} />
            <TemplateRecordsSection activeTab={activeTab} detail={detail} senderResourceId={senderResourceId} />
          </>
        ) : null}
      </div>
    </section>
  );
}

function useTemplateDetailQuery({ channelView, query, templateCode }) {
  return useQuery({
    enabled: canLoadTemplateDetail({ channelView, query, templateCode }),
    queryFn: () => relayGet(withQuery(
      `/api/templates/${channelView.apiChannel}/${encodeURIComponent(templateCode)}`,
      query
    )),
    queryKey: ['templates', 'detail', channelView?.apiChannel, templateCode, query],
  });
}

function TemplateRecordsSection({ activeTab, detail, senderResourceId }) {
  const title = TEMPLATE_DETAIL_TABS.find((tab) => tab.id === activeTab)?.label ?? 'Content';
  return (
    <section
      aria-labelledby="template-records-heading"
      className="resend-records-section template-detail-records-section"
      id={`template-${activeTab}-panel`}
      role="tabpanel"
      tabIndex={0}
    >
      <div className="resend-records-accent" aria-hidden="true" />
      <div className="resend-records-header">
        <h3 id="template-records-heading">Template {title}</h3>
      </div>
      {activeTab === 'content' ? <TemplateContentPanel detail={detail} /> : null}
      {activeTab === 'parameters' ? <TemplateParametersPanel detail={detail} /> : null}
      {activeTab === 'payload' ? <TemplatePayloadPanel detail={detail} senderResourceId={senderResourceId} /> : null}
    </section>
  );
}

function canLoadTemplateDetail({ channelView, query, templateCode }) {
  if (!channelView?.apiChannel || !templateCode) {
    return false;
  }

  if (query.senderResourceId) {
    return true;
  }

  return channelView.apiChannel === 'alimtalk'
    && String(query.source ?? '').toUpperCase() === 'GROUP'
    && Boolean(query.sourceKey);
}

async function writeClipboard(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(String(value ?? ''));
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = String(value ?? '');
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
