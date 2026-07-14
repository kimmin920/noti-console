'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { PageHeader } from '../../../components/layout/index.js';
import {
  Button,
  Pagination,
  SegmentedControl,
} from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import {
  getAlimtalkSenderProfiles,
  getKakaoTemplateLookupSenderResourceId,
  getResolvedSenderOptionValue,
  getSmsSenderOptions,
} from '../messageSend/mappers.js';
import { useSenderResourcesQuery } from '../messageSend/queries.js';
import { useConsoleNavigation } from '../ConsoleNavigationContext.jsx';
import { useStandaloneConsole } from '../StandaloneConsoleContext.jsx';
import { buildTabQueryHref, getTemplateTabFromQuery, getTemplateTabQueryValue } from '../tabQuery.js';
import { TemplateCardList } from './TemplateCardList.jsx';
import { TemplateListToolbar } from './TemplateListToolbar.jsx';
import {
  ALIMTALK_TEMPLATE_STATUS_OPTIONS,
  DEFAULT_ALIMTALK_TEMPLATE_STATUS,
  useTemplateCatalogQuery,
} from './queries.js';
import { getTemplateCardItems } from './templateCards.js';

const defaultPageSize = 20;
const pageSizeOptions = [20, 50, 100];
const KAKAO_TEMPLATE_TABS = new Set(['알림톡', '브랜드 메시지']);

export function TemplatePage({ meta: metaProp }) {
  const standaloneConsole = useStandaloneConsole();
  const meta = metaProp ?? standaloneConsole?.meta;
  const navigation = useConsoleNavigation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => getTemplateTabFromQuery(searchParams, meta.tabs));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(DEFAULT_ALIMTALK_TEMPLATE_STATUS);
  const [selectedSenderResourceIds, setSelectedSenderResourceIds] = useState({});
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const senderResourcesQuery = useSenderResourcesQuery();
  const senderResourceOptions = useMemo(
    () => getTemplateSenderResourceOptions(senderResourcesQuery.data, activeTab),
    [activeTab, senderResourcesQuery.data]
  );
  const selectedSenderResourceId = getResolvedSenderOptionValue(
    selectedSenderResourceIds[activeTab],
    senderResourceOptions
  );
  const templateLookupSenderResourceId = getTemplateLookupSenderResourceId({
    activeTab,
    selectedSenderResourceId,
    senderResourcesData: senderResourcesQuery.data,
  });
  const templateQuery = useTemplateCatalogQuery({
    enabled: !senderResourcesQuery.isPending,
    senderResourceId: templateLookupSenderResourceId,
    tab: activeTab,
    templateName: deferredSearchQuery.trim(),
    templateStatus: activeTab === '알림톡' ? statusFilter : undefined,
  });
  const canQueryTemplateCatalog = canQueryTemplates(activeTab, templateLookupSenderResourceId);
  const isTemplateLoading = canQueryTemplateCatalog && templateQuery.isPending;
  const isTemplateError = canQueryTemplateCatalog && templateQuery.isError;
  const isTemplateListLoading = senderResourcesQuery.isPending || isTemplateLoading;
  const templates = useMemo(() => {
    const items = getTemplateCardItems(templateQuery.data?.templates ?? []);
    const normalizedSearch = deferredSearchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return items;
    }

    return items.filter((template) => (
      template.name.toLowerCase().includes(normalizedSearch)
      || template.code.toLowerCase().includes(normalizedSearch)
    ));
  }, [deferredSearchQuery, templateQuery.data]);
  const pageCount = Math.max(1, Math.ceil(templates.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleTemplates = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return templates.slice(start, start + pageSize);
  }, [currentPage, pageSize, templates]);
  const emptyState = getTemplateEmptyState({
    activeTab,
    hasCatalogContext: canQueryTemplateCatalog,
    isError: senderResourcesQuery.isError || isTemplateError,
    meta,
    searchQuery,
  });
  const createAction = getTemplateCreateAction({
    activeTab,
    meta,
    navigation,
    selectedSenderResourceId,
  });

  function handleActiveTabChange(nextTab) {
    setActiveTab(nextTab);
    setPage(1);
    navigation.replace(
      buildTabQueryHref({
        pathname,
        searchParams,
        tabQueryValue: getTemplateTabQueryValue(nextTab),
      }),
      { scroll: false }
    );
  }

  function handlePageSizeChange(nextPageSize) {
    setPageSize(nextPageSize);
    setPage(1);
  }

  function handleSearchChange(nextSearchQuery) {
    setSearchQuery(nextSearchQuery);
    setPage(1);
  }

  function handleStatusChange(nextStatus) {
    setStatusFilter(nextStatus);
    setPage(1);
  }

  function handleSenderResourceChange(nextSenderResourceId) {
    setSelectedSenderResourceIds((currentIds) => ({
      ...currentIds,
      [activeTab]: nextSenderResourceId,
    }));
    setPage(1);
  }

  function retryTemplates() {
    if (senderResourcesQuery.isError) {
      senderResourcesQuery.refetch();
      return;
    }

    templateQuery.refetch();
  }

  return (
    <section className="page-frame templates-page">
      <PageHeader action={createAction.label} onAction={createAction.onClick} title={meta.title} />
      <div className="message-send-tabs-row">
        <SegmentedControl
          items={meta.tabs}
          onValueChange={handleActiveTabChange}
          value={activeTab}
        />
        <span className="template-list-summary">{activeTab} 템플릿 {templates.length.toLocaleString('ko-KR')}개</span>
      </div>
      <TemplateListToolbar
        onSearchChange={handleSearchChange}
        onSenderResourceChange={handleSenderResourceChange}
        onStatusChange={handleStatusChange}
        searchValue={searchQuery}
        senderResourceOptions={senderResourceOptions}
        senderResourceValue={selectedSenderResourceId}
        showStatusFilter={activeTab === '알림톡'}
        statusOptions={ALIMTALK_TEMPLATE_STATUS_OPTIONS}
        statusValue={statusFilter}
      />
      {senderResourcesQuery.isError || isTemplateError ? (
        <div className="template-list-status" data-tone="critical" role="alert">
          <span>
            {getRelayErrorMessage(
              senderResourcesQuery.error ?? templateQuery.error,
              '템플릿을 불러오지 못했습니다.'
            )}
          </span>
          <Button onClick={retryTemplates}>다시 시도</Button>
        </div>
      ) : null}
      <TemplateCardList
        activeTab={activeTab}
        emptyCopy={emptyState.copy}
        emptyTitle={emptyState.title}
        isLoading={isTemplateListLoading}
        senderResourceId={templateLookupSenderResourceId}
        templates={visibleTemplates}
      />
      {!isTemplateListLoading ? (
        <Pagination
          className="template-list-pagination"
          label="템플릿"
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          page={currentPage}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          total={templates.length}
        />
      ) : null}
    </section>
  );
}

function getTemplateCreateAction({
  activeTab,
  meta,
  navigation,
  selectedSenderResourceId,
}) {
  if (activeTab === 'SMS') {
    return {
      label: meta.action,
      onClick: () => navigation.push('/templates/sms/new'),
    };
  }

  if (activeTab === '알림톡') {
    const params = new URLSearchParams();

    if (selectedSenderResourceId) {
      params.set('senderResourceId', selectedSenderResourceId);
    }

    const query = params.toString();

    return {
      label: meta.action,
      onClick: () => navigation.push(query ? `/templates/alimtalk/new?${query}` : '/templates/alimtalk/new'),
    };
  }

  if (activeTab === '브랜드 메시지') {
    return {
      label: meta.action,
      onClick: () => navigation.push('/templates/brand/new'),
    };
  }

  return { label: null, onClick: undefined };
}

function getTemplateSenderResourceOptions(senderResourcesData, activeTab) {
  if (activeTab === 'SMS') {
    return getSmsSenderOptions(senderResourcesData).map(toFilterSelectOption);
  }

  if (KAKAO_TEMPLATE_TABS.has(activeTab)) {
    return getAlimtalkSenderProfiles(senderResourcesData).map(toFilterSelectOption);
  }

  return [];
}

function getTemplateLookupSenderResourceId({
  activeTab,
  selectedSenderResourceId,
  senderResourcesData,
}) {
  if (activeTab === '알림톡') {
    return getKakaoTemplateLookupSenderResourceId(senderResourcesData, selectedSenderResourceId);
  }

  return selectedSenderResourceId;
}

function canQueryTemplates(activeTab, senderResourceId) {
  if (activeTab === '알림톡') {
    return true;
  }

  return Boolean(senderResourceId);
}

function toFilterSelectOption(option) {
  return {
    label: option.label,
    value: option.value,
  };
}

function getTemplateEmptyState({
  activeTab,
  hasCatalogContext,
  isError,
  meta,
  searchQuery,
}) {
  if (isError) {
    return {
      title: '템플릿을 불러오지 못했습니다',
      copy: '연결 상태나 NHN 설정을 확인한 뒤 다시 시도하세요.',
    };
  }

  if (!hasCatalogContext) {
    return {
      title: `${activeTab} 발신 리소스가 없습니다`,
      copy: '발신 수단을 연결하면 NHN 템플릿 목록을 확인할 수 있습니다.',
    };
  }

  if (searchQuery.trim()) {
    return {
      title: '검색 결과가 없습니다',
      copy: '템플릿 이름 검색어 또는 상태 조건을 조정해 보세요.',
    };
  }

  return {
    title: meta.emptyStates?.[activeTab]?.emptyTitle ?? meta.emptyTitle,
    copy: meta.emptyStates?.[activeTab]?.emptyCopy ?? meta.emptyCopy,
  };
}
