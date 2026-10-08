'use client';

import { useMemo, useState } from 'react';
import { DropdownMenu as RadixDropdownMenu } from 'radix-ui';
import { Ban, Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '../../../components/layout/index.js';
import { ActionMenu, ActionMenuContent, ActionMenuItem, ActionMenuSeparator, ActionMenuTrigger, ConfirmationDialog, DataTableV2, IconButton, SegmentedControl, TablePagination, useToast } from '../../../components/ui/index.js';
import {
  AudienceContactList,
  AudienceManagementList,
  DropdownMenu,
  EmptyState,
  PageHeaderActions,
  PageHeaderPrimaryButton,
} from '../../../ui-kits/resend/index.ts';
import { AudienceAddContactsModal } from '../../../ui-kits/resend/domain/audience-contact-list/audience-add-contacts-modal.tsx';
import { AudienceImportCsvModal } from '../../../ui-kits/resend/domain/audience-contact-list/audience-import-csv-modal.tsx';
import { usePublMessageRecipients } from '../../publClient/usePublMessageRecipients.js';
import { useStandaloneConsole } from '../StandaloneConsoleContext.jsx';

const SELECTABLE_TABLE_PAGE_SIZE_OPTIONS = [20, 40, 80, 120];
const AUDIENCE_CONTACT_PAGE_SIZE = 20;
const STATIC_AUDIENCE_DATE = '2026-07-14T00:00:00.000Z';

export function AudiencePage({ meta: metaProp }) {
  const standaloneConsole = useStandaloneConsole();
  const meta = metaProp ?? standaloneConsole?.meta;
  const [activeTab, setActiveTab] = useState('contacts');
  const [contactPage, setContactPage] = useState(1);
  const [contactPageSize, setContactPageSize] = useState(AUDIENCE_CONTACT_PAGE_SIZE);
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState([]);
  const { showToast } = useToast();
  const publRecipients = usePublMessageRecipients();
  const configuredAudience = useMemo(
    () => toConfiguredAudience(meta?.table?.rows ?? []),
    [meta?.table?.rows]
  );
  const publContacts = useMemo(
    () => toPublAudienceContacts(publRecipients.contacts),
    [publRecipients.contacts]
  );
  const isPublEmbed = publRecipients.isPublEmbed;
  const contacts = isPublEmbed ? publContacts : configuredAudience.contacts;
  const contactPageCount = Math.max(1, Math.ceil(contacts.length / contactPageSize));
  const resolvedContactPage = Math.min(contactPage, contactPageCount);
  const visibleContacts = contacts.slice(
    (resolvedContactPage - 1) * contactPageSize,
    resolvedContactPage * contactPageSize
  );
  const segments = isPublEmbed ? [] : configuredAudience.segments;
  const managementSegments = isPublEmbed ? [] : configuredAudience.managementSegments;
  const publContactNotice = isPublEmbed
    ? getPublContactNotice(publRecipients.contactsSourceState)
    : null;
  const contactState = getAudienceContactState({
    contactCount: visibleContacts.length,
    isPublEmbed,
    sourceState: publRecipients.contactsSourceState,
  });

  function notifyUnavailable(label) {
    showToast({
      description: '이번 화면 이식에서는 UI만 연결했습니다.',
      title: `${label} 기능 준비 중`,
      variant: 'default',
    });
  }

  function handleActiveTabChange(nextTab) {
    setActiveTab(nextTab);
    setContactPage(1);
    setSelectedContactIds([]);
    setSelectedSegmentIds([]);
  }

  function handleContactPageSizeChange(nextPageSize) {
    setContactPageSize(nextPageSize);
    setContactPage(1);
  }

  function handleDomainLinkClick(event) {
    if (!event.target.closest('a')) return;
    event.preventDefault();
    notifyUnavailable(activeTab === 'contacts' ? '수신자 상세' : '세그먼트 상세');
  }

  return (
    <section className={`page-frame console-audience-page${isPublEmbed ? ' is-publ' : ''}`}>
      <PageHeader
        actions={(
          <AudiencePageHeaderActions
            activeTab={activeTab}
            isPublEmbed={isPublEmbed}
            onUnavailable={notifyUnavailable}
            segments={segments}
          />
        )}
        title="수신자"
      />
      <SegmentedControl
        items={getAudienceTabs(isPublEmbed)}
        onValueChange={handleActiveTabChange}
        value={activeTab}
      />

      {activeTab === 'contacts' ? (
        publContactNotice ? (
          <AudienceSourceNotice {...publContactNotice} />
        ) : (
          <>
            <AudienceContactList
              className="console-audience-domain"
              contactColumnLabel="수신자"
              contacts={visibleContacts}
              isUserAdmin={!isPublEmbed}
              onClickCapture={handleDomainLinkClick}
              onExport={() => notifyUnavailable('수신자 내보내기')}
              onSelectedContactIdsChange={setSelectedContactIds}
              segments={segments}
              segmentsColumnLabel="세그먼트"
              selectedContactIds={selectedContactIds}
              state={contactState}
              statusColumnLabel="수신동의"
              subscribedLabel="동의"
              unsubscribedLabel="미동의"
            />
            {contacts.length > 0 ? (
              <TablePagination
                className="console-audience-pagination"
                itemLabel="수신자"
                onPageChange={setContactPage}
                onPageSizeChange={handleContactPageSizeChange}
                page={resolvedContactPage}
                pageSize={contactPageSize}
                pageSizeOptions={SELECTABLE_TABLE_PAGE_SIZE_OPTIONS}
                total={contacts.length}
                unit="명"
              />
            ) : null}
          </>
        )
      ) : isPublEmbed ? (
        <AudienceSourceNotice
          description="Publ 세그먼트 SDK 권한이 추가되면 이 화면에서 조회하고 발송 대상으로 선택할 수 있습니다."
          title="Publ 세그먼트 연동 준비 중"
        />
      ) : (
        <AudienceManagementList
          className="console-audience-domain"
          onAudienceManagementRowAction={(action) => notifyUnavailable(`세그먼트 ${action}`)}
          onClickCapture={handleDomainLinkClick}
          onSelectedAudienceManagementIdsChange={setSelectedSegmentIds}
          segments={managementSegments}
          selectedAudienceManagementIds={selectedSegmentIds}
          state={managementSegments.length > 0 ? 'loaded' : 'empty'}
          view="segments"
        />
      )}
    </section>
  );
}

function AudienceSourceNotice({ description, title, variant = 'status' }) {
  return (
    <EmptyState.Root
      className="console-audience-source-state"
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <EmptyState.Content>
        <EmptyState.Title>{title}</EmptyState.Title>
        <EmptyState.Description>{description}</EmptyState.Description>
      </EmptyState.Content>
    </EmptyState.Root>
  );
}

export function PublAudiencePage({ meta }) {
  return <AudiencePage meta={meta} />;
}

function AudiencePageHeaderActions({ activeTab, isPublEmbed, onUnavailable, segments }) {
  const [manualOpen, setManualOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  if (isPublEmbed) return null;

  return (
    <>
      <PageHeaderActions>
        {activeTab === 'contacts' ? (
          <DropdownMenu.Root>
            <RadixDropdownMenu.Trigger asChild>
              <PageHeaderPrimaryButton>수신자 추가</PageHeaderPrimaryButton>
            </RadixDropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item onSelect={() => window.requestAnimationFrame(() => setManualOpen(true))}>
                직접 추가
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => window.requestAnimationFrame(() => setCsvOpen(true))}>
                CSV 가져오기
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        ) : (
          <PageHeaderPrimaryButton onClick={() => onUnavailable('세그먼트 만들기')}>
            세그먼트 만들기
          </PageHeaderPrimaryButton>
        )}
      </PageHeaderActions>
      <AudienceAddContactsModal
        onOpenChange={setManualOpen}
        open={manualOpen}
        segments={segments}
      />
      <AudienceImportCsvModal
        canCreateSegment
        onOpenChange={setCsvOpen}
        open={csvOpen}
        segments={segments}
      />
    </>
  );
}

function getAudienceTabs(isPublEmbed) {
  return isPublEmbed
    ? [
      { label: 'Publ 수신자', value: 'contacts' },
      { label: 'Publ 세그먼트', value: 'segments' },
    ]
    : [
      { label: '수신자', value: 'contacts' },
      { label: '세그먼트', value: 'segments' },
    ];
}

function getAudienceContactState({ contactCount, isPublEmbed, sourceState }) {
  if (isPublEmbed && sourceState === 'loading') return 'loading';
  return contactCount > 0 ? 'loaded' : 'empty';
}

function getPublContactNotice(sourceState) {
  if (sourceState === 'permission-denied') {
    return {
      description: '현재 환경의 Publ 연락처 permission ID를 확인해 주세요.',
      title: 'Publ 수신자 조회 권한이 없습니다',
      variant: 'error',
    };
  }

  if (sourceState === 'error') {
    return {
      description: 'Publ 연결 상태를 확인한 뒤 다시 열어 주세요.',
      title: 'Publ 수신자를 불러오지 못했습니다',
      variant: 'error',
    };
  }

  if (sourceState === 'empty') {
    return {
      description: '전화번호가 등록된 Publ 수신자만 표시됩니다.',
      title: '전화번호가 등록된 Publ 수신자가 없습니다.',
    };
  }

  return null;
}

function toPublAudienceContacts(contacts) {
  return contacts.map((contact, index) => {
    const phone = contact.value || contact.detail || contact.label || '-';
    const label = contact.label && contact.label !== phone ? contact.label : undefined;

    return {
      createdAtDateTime: STATIC_AUDIENCE_DATE,
      createdAtLabel: '-',
      email: phone,
      ...(label ? { firstName: label } : {}),
      id: `publ-contact-${contact.externalId || phone || index}`,
      segments: [],
      topics: [],
      unsubscribed: false,
    };
  });
}

function toConfiguredAudience(rows) {
  const segmentMap = new Map();

  rows.forEach((cells) => {
    const name = String(cells[4] ?? '').trim();
    if (!name) return;

    const current = segmentMap.get(name) ?? {
      contactsCount: 0,
      createdAtDateTime: STATIC_AUDIENCE_DATE,
      createdAtLabel: '기존 데이터',
      id: `segment-${segmentMap.size + 1}`,
      name,
      unsubscribedCount: 0,
    };
    current.contactsCount += 1;
    if (cells[3] === '수신거부') current.unsubscribedCount += 1;
    segmentMap.set(name, current);
  });

  const managementSegments = Array.from(segmentMap.values());
  const contactSegments = new Map(managementSegments.map((segment) => [
    segment.name,
    {
      contactsCount: segment.contactsCount,
      id: segment.id,
      name: segment.name,
    },
  ]));
  const contacts = rows.map((cells, index) => {
    const segment = contactSegments.get(String(cells[4] ?? '').trim());
    const phone = String(cells[1] ?? cells[2] ?? '-');
    const name = String(cells[0] ?? '').trim();
    const createdAtLabel = String(cells[5] ?? '-');

    return {
      createdAtDateTime: getConfiguredCreatedAtDateTime(createdAtLabel),
      createdAtLabel,
      email: phone,
      ...(name ? { firstName: name } : {}),
      id: `contact-${index + 1}`,
      segments: segment ? [segment] : [],
      topics: [],
      unsubscribed: cells[3] === '수신거부',
    };
  });

  return {
    contacts,
    managementSegments,
    segments: Array.from(contactSegments.values()),
  };
}

function getConfiguredCreatedAtDateTime(label) {
  if (label === '오늘') return STATIC_AUDIENCE_DATE;
  if (label === '어제') return '2026-07-13T00:00:00.000Z';

  const match = /^5월 (\d{1,2})일$/.exec(label);
  if (!match) return STATIC_AUDIENCE_DATE;
  return `2026-05-${match[1].padStart(2, '0')}T00:00:00.000Z`;
}

function getStatusTone(cell) {
  if (['활성', '성공'].includes(cell)) {
    return 'green';
  }

  if (['초안', '대기', '없음'].includes(cell)) {
    return 'neutral';
  }

  return undefined;
}

export function SelectableDataTable({ table }) {
  const { showToast } = useToast();
  const [firstColumn, ...otherColumns] = table.columns;
  const isRecipientTable = firstColumn === '수신자';
  const rows = useMemo(
    () => table.rows.map((cells) => ({ cells, id: cells.join('|') })),
    [table.rows]
  );
  const columns = [
    {
      accessor: (row) => row.cells[0],
      className: 'is-email-to',
      header: firstColumn,
      cell: ({ value }) => {
        const tone = getStatusTone(value);

        return (
          <span className="resend-email-subject-text">
            {tone ? <span className={`badge ${tone}`}>{value}</span> : value}
          </span>
        );
      },
    },
    ...otherColumns.map((column, index) => ({
      accessor: (row) => row.cells[index + 1],
      header: column,
      cell: ({ value }) => {
        const tone = getStatusTone(value);
        return tone ? <span className={`badge ${tone}`}>{value}</span> : value;
      },
    })),
  ];

  function notifyBulkAction(action, selectedRows, clearSelection) {
    showToast({
      description: '선택한 테이블 항목에 작업이 적용되었습니다.',
      title: `${selectedRows.length}개 항목 ${action}`,
      variant: 'success',
    });
    clearSelection();
  }

  return (
    <DataTableV2
      actionsClassName="is-email-actions table-actions"
      actionsHeaderClassName="is-email-actions"
      bulkActionBarProps={({ selectedRows }) => ({
        'aria-label': '선택 항목 작업',
        clearLabel: '선택 해제',
        countLabel: `${selectedRows.length}개 선택됨`,
      })}
      bulkActions={({ clearSelection, selectedRows }) => (
        <>
          <DataTableV2.BulkActionButton onClick={() => notifyBulkAction('비활성화됨', selectedRows, clearSelection)}>
          <Ban size={14} />
          비활성화
          </DataTableV2.BulkActionButton>
          <ConfirmationDialog
            confirmLabel="삭제"
            description="선택한 항목을 목록에서 제거합니다. 이 작업은 되돌릴 수 없습니다."
            destructive
            onConfirm={() => notifyBulkAction('삭제됨', selectedRows, clearSelection)}
            title="선택 항목 삭제?"
          >
            <DataTableV2.BulkActionButton danger>
              <Trash2 size={14} />
              삭제
            </DataTableV2.BulkActionButton>
          </ConfirmationDialog>
        </>
      )}
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      initialPageSize={SELECTABLE_TABLE_PAGE_SIZE_OPTIONS[0]}
      pagination={isRecipientTable}
      renderPagination={isRecipientTable ? ({ table: dataTable }) => (
        <TablePagination
          itemLabel="수신자"
          pageSizeOptions={SELECTABLE_TABLE_PAGE_SIZE_OPTIONS}
          table={dataTable}
          total={rows.length}
          unit="명"
        />
      ) : undefined}
      rowActions={({ row }) => (
        <RowActionMenu
          label={row.cells[0]}
          onAction={(action) => showToast({
            description: `${row.cells[0]} 항목에 작업이 적용되었습니다.`,
            title: `${row.cells[0]} ${action}`,
            variant: action === '삭제됨' ? 'critical' : 'success',
          })}
        />
      )}
      selectable
      selectAllLabel="모든 행 선택"
      selectedRowLabel={({ row }) => `${row.cells[0]} 선택`}
      shellClassName="console-data-table-shell"
      tableClassName="console-data-table-v2"
    />
  );
}

function RowActionMenu({ label, onAction }) {
  return (
    <ActionMenu>
      <ActionMenuTrigger asChild>
        <IconButton icon={MoreHorizontal} label={`${label} 작업 더보기`} />
      </ActionMenuTrigger>
      <ActionMenuContent align="end">
        <ActionMenuItem leadingVisual={<Copy size={16} />} onSelect={() => onAction('복제됨')}>
          복제
        </ActionMenuItem>
        <ActionMenuItem leadingVisual={<Pencil size={16} />} onSelect={() => onAction('이름 변경됨')}>
          이름 변경
        </ActionMenuItem>
        <ActionMenuSeparator />
        <ConfirmationDialog
          confirmLabel="삭제"
          description={`${label} 항목을 목록에서 제거합니다. 이 작업은 되돌릴 수 없습니다.`}
          destructive
          onConfirm={() => onAction('삭제됨')}
          title={`${label} 삭제?`}
        >
          <ActionMenuItem leadingVisual={<Trash2 size={16} />} variant="danger">
            삭제
          </ActionMenuItem>
        </ConfirmationDialog>
      </ActionMenuContent>
    </ActionMenu>
  );
}
