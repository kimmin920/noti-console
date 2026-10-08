'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Download, FileText, RefreshCcw, ShieldCheck, XCircle } from 'lucide-react';
import { PageHeader } from '../../../components/layout/index.js';
import { Badge, Button, DataTableV2, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, EmptyState, FilterSelect, Panel, SearchField, SectionPanel, useToast } from '../../../components/ui/index.js';
import { getRelayErrorMessage } from '../messageSend/api.js';
import { formatSettingsPhoneNumber } from '../senderResourceLabels.js';
import { useAdminSenderResourceApplicationApproveMutation, useAdminSenderResourceApplicationRejectMutation, useAdminSmsSendNoLookupMutation } from '../messageSend/mutations.js';
import { useAdminSenderResourceApplicationsQuery, useCurrentActorQuery } from '../messageSend/queries.js';
import { AdminLimitIncreaseRequestsPanel } from '../settings/AdminLimitIncreaseRequestsPanel.jsx';
import { AdminRequestTabs, ADMIN_REQUEST_TAB_VALUES } from '../settings/AdminRequestTabs.jsx';

import {
  ADMIN_APPLICATION_STATUS_OPTIONS,
  EVIDENCE_DOCUMENT_LABELS,
  SMS_SENDER_RESOURCE_TYPE,
} from '../settings/senderResourceApplicationConfig.js';

export function AdminSenderResourceApplicationsPage() {
  const { showToast } = useToast();
  const [activeAdminTab, setActiveAdminTab] = useState(ADMIN_REQUEST_TAB_VALUES.LIMIT_REQUESTS);
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const actorQuery = useCurrentActorQuery();
  const queryFilters = useMemo(() => ({
    resourceType: SMS_SENDER_RESOURCE_TYPE,
    status: statusFilter === 'all' ? undefined : statusFilter,
  }), [statusFilter]);
  const applicationsQuery = useAdminSenderResourceApplicationsQuery(queryFilters, {
    enabled: actorQuery.data?.user?.isOperator === true
      && activeAdminTab === ADMIN_REQUEST_TAB_VALUES.SENDER_APPLICATIONS,
  });
  const lookupMutation = useAdminSmsSendNoLookupMutation();
  const approveMutation = useAdminSenderResourceApplicationApproveMutation();
  const rejectMutation = useAdminSenderResourceApplicationRejectMutation();
  const applications = useMemo(() => (
    Array.isArray(applicationsQuery.data?.applications) ? applicationsQuery.data.applications : []
  ), [applicationsQuery.data]);
  const filteredApplications = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return applications;
    }

    return applications.filter((application) => {
      const haystack = [
        application.requestedValue,
        application.user?.email,
        application.user?.name,
        application.user?.userRef,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [applications, searchTerm]);
  const selectedApplication = applications.find((application) => application.id === selectedApplicationId) ?? null;
  const lookupResult = lookupMutation.data;
  const canApprove = Boolean(
    selectedApplication
    && selectedApplication.status === 'submitted'
    && lookupResult?.usable
    && !approveMutation.isPending
  );
  const pageError = applicationsQuery.isError
    ? getRelayErrorMessage(applicationsQuery.error, '신청 목록을 불러오지 못했습니다.')
    : '';
  const actorError = actorQuery.isError
    ? getRelayErrorMessage(actorQuery.error, '현재 계정 정보를 확인하지 못했습니다.')
    : '';

  function changeAdminTab(nextTab) {
    setActiveAdminTab(nextTab);
    closeApplication();
  }

  function openApplication(application) {
    setSelectedApplicationId(application.id);
    setRejectDialogOpen(false);
    setRejectReason('');
    lookupMutation.reset();
    approveMutation.reset();
    rejectMutation.reset();
  }

  function closeApplication() {
    setSelectedApplicationId(null);
    setRejectDialogOpen(false);
    setRejectReason('');
    lookupMutation.reset();
    approveMutation.reset();
    rejectMutation.reset();
  }

  async function lookupNhnSendNo() {
    if (!selectedApplication || lookupMutation.isPending) {
      return;
    }

    await lookupMutation.mutateAsync(selectedApplication.id).catch(() => {});
  }

  async function approveApplication() {
    if (!selectedApplication || !canApprove) {
      return;
    }

    try {
      await approveMutation.mutateAsync({
        applicationId: selectedApplication.id,
        payload: {},
      });
      showToast({
        description: formatSettingsPhoneNumber(selectedApplication.requestedValue),
        title: '발신번호를 승인했습니다',
      });
      closeApplication();
    } catch {
      // The drawer renders the mutation error near the action buttons.
    }
  }

  async function rejectApplication(event) {
    event.preventDefault();

    if (!selectedApplication || !rejectReason.trim() || rejectMutation.isPending) {
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        applicationId: selectedApplication.id,
        payload: {
          rejectReason: rejectReason.trim(),
        },
      });
      showToast({
        description: formatSettingsPhoneNumber(selectedApplication.requestedValue),
        title: '발신번호 신청을 반려했습니다',
      });
      closeApplication();
    } catch {
      // The dialog renders the mutation error below the textarea.
    }
  }

  if (actorQuery.isPending) {
    return (
      <section className="page-frame admin-sender-page">
        <PageHeader title="신청 관리" />
        <Panel className="admin-state-panel">
          <span className="admin-state-row">
            <Circle aria-hidden="true" size={18} />
            관리자 권한을 확인하는 중입니다.
          </span>
        </Panel>
      </section>
    );
  }

  if (actorQuery.data?.user && !actorQuery.data.user.isOperator) {
    return (
      <section className="page-frame admin-sender-page">
        <PageHeader title="신청 관리" />
        <EmptyState
          copy="이 화면은 운영자 권한이 있는 계정에서만 사용할 수 있습니다."
          icon={ShieldCheck}
          title="관리자 권한이 필요합니다"
        />
      </section>
    );
  }

  return (
    <section className="page-frame admin-sender-page">
      <PageHeader title="신청 관리" />

      <AdminRequestTabs onValueChange={changeAdminTab} value={activeAdminTab} />

      {actorError ? (
        <div className="message-send-api-status admin-sender-status" data-tone="critical" role="alert">
          <span>{actorError}</span>
          <Button onClick={() => actorQuery.refetch()}>다시 시도</Button>
        </div>
      ) : null}

      {activeAdminTab === ADMIN_REQUEST_TAB_VALUES.LIMIT_REQUESTS ? (
        <div className="admin-request-tab-panel" role="tabpanel">
          <AdminLimitIncreaseRequestsPanel enabled={actorQuery.data?.user?.isOperator === true} />
        </div>
      ) : null}

      {activeAdminTab === ADMIN_REQUEST_TAB_VALUES.SENDER_APPLICATIONS ? (
        <div className="admin-request-tab-panel" role="tabpanel">
          <div className="admin-sender-toolbar">
            <div className="admin-sender-toolbar-search">
              <SearchField
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="번호, 이메일, 이름 검색"
                value={searchTerm}
              />
            </div>
            <FilterSelect
              label="상태"
              onValueChange={setStatusFilter}
              options={ADMIN_APPLICATION_STATUS_OPTIONS}
              value={statusFilter}
            />
            <Button
              disabled={applicationsQuery.isFetching}
              onClick={() => applicationsQuery.refetch()}
              variant="secondary"
            >
              <RefreshCcw aria-hidden="true" size={15} />
              새로고침
            </Button>
          </div>

          {pageError ? (
            <div className="message-send-api-status admin-sender-status" data-tone="critical" role="alert">
              <span>{pageError}</span>
              <Button onClick={() => applicationsQuery.refetch()}>다시 시도</Button>
            </div>
          ) : null}

          <DataTableV2
            actionsClassName="is-email-actions table-actions"
            actionsHeaderClassName="is-email-actions"
            columns={[
              {
                accessor: (application) => formatSettingsPhoneNumber(application.requestedValue),
                header: '발신번호',
                cell: ({ value }) => <strong>{value}</strong>,
              },
              { accessor: (application) => getSenderNumberTypeLabel(application.senderNumberType), header: '유형' },
              {
                accessor: (application) => application,
                header: '신청자',
                cell: ({ value: application }) => (
                  <span className="admin-table-user">
                    <strong>{application.user?.email ?? '이메일 없음'}</strong>
                    <small>{application.user?.name || application.user?.userRef || application.userId}</small>
                  </span>
                ),
              },
              {
                accessor: (application) => application.status,
                header: '상태',
                cell: ({ value }) => (
                  <Badge tone={getAdminApplicationStatusTone(value)}>
                    {getAdminApplicationStatusLabel(value)}
                  </Badge>
                ),
              },
              { accessor: (application) => formatAdminDateTime(application.createdAt), header: '신청일' },
            ]}
            data={applicationsQuery.isPending ? [] : filteredApplications}
            empty={<span className="admin-empty-row">조건에 맞는 신청이 없습니다.</span>}
            getRowId={(application) => application.id}
            loading={applicationsQuery.isPending}
            loadingSlot={(
              <span className="admin-state-row">
                <Circle aria-hidden="true" size={18} />
                신청 목록을 불러오는 중입니다.
              </span>
            )}
            rowActions={({ row }) => (
              <Button onClick={() => openApplication(row)} variant="secondary">
                검토
              </Button>
            )}
            shellClassName="admin-sender-table-shell"
            tableClassName="admin-sender-table"
          />
        </div>
      ) : null}

      <AdminSenderApplicationDrawer
        application={selectedApplication}
        approveError={approveMutation.isError
          ? getRelayErrorMessage(approveMutation.error, '승인하지 못했습니다.')
          : ''}
        approvePending={approveMutation.isPending}
        canApprove={canApprove}
        lookupError={lookupMutation.isError
          ? getRelayErrorMessage(lookupMutation.error, 'NHN 발신번호 상태를 조회하지 못했습니다.')
          : ''}
        lookupPending={lookupMutation.isPending}
        lookupResult={lookupResult}
        onApprove={approveApplication}
        onClose={closeApplication}
        onLookup={lookupNhnSendNo}
        onRejectOpen={() => {
          rejectMutation.reset();
          setRejectReason('');
          setRejectDialogOpen(true);
        }}
        rejectPending={rejectMutation.isPending}
      />

      <AdminRejectDialog
        error={rejectMutation.isError
          ? getRelayErrorMessage(rejectMutation.error, '반려하지 못했습니다.')
          : ''}
        onOpenChange={setRejectDialogOpen}
        onReasonChange={setRejectReason}
        onSubmit={rejectApplication}
        open={rejectDialogOpen}
        pending={rejectMutation.isPending}
        reason={rejectReason}
      />
    </section>
  );
}

function AdminSenderApplicationDrawer({
  application,
  approveError,
  approvePending,
  canApprove,
  lookupError,
  lookupPending,
  lookupResult,
  onApprove,
  onClose,
  onLookup,
  onRejectOpen,
  rejectPending,
}) {
  const isSubmitted = application?.status === 'submitted';
  const approvalHint = getApprovalHint({ application, lookupResult, lookupPending });
  const evidenceFiles = Array.isArray(application?.evidenceFiles) ? application.evidenceFiles : [];
  const primaryEvidenceFiles = evidenceFiles.filter((file) => file.documentType !== 'additional_document');
  const additionalEvidenceFiles = evidenceFiles.filter((file) => file.documentType === 'additional_document');

  return (
    <Drawer open={Boolean(application)} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DrawerContent
        className="admin-application-drawer"
        title={application ? formatSettingsPhoneNumber(application.requestedValue) : '신청 상세'}
      >
        {application ? (
          <>
            <DrawerHeader>
              <DrawerTitle>{formatSettingsPhoneNumber(application.requestedValue)}</DrawerTitle>
              <DrawerDescription>
                {getSenderNumberTypeLabel(application.senderNumberType)} · {getAdminApplicationStatusLabel(application.status)}
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <SectionPanel title="신청 정보">
                <div className="admin-detail-grid">
                  <AdminDetailItem label="신청자" value={application.user?.email ?? application.userId} />
                  <AdminDetailItem label="이름" value={application.user?.name || '-'} />
                  <AdminDetailItem label="User ref" value={application.user?.userRef || '-'} />
                  <AdminDetailItem label="신청일" value={formatAdminDateTime(application.createdAt)} />
                  <AdminDetailItem label="검토일" value={formatAdminDateTime(application.reviewedAt)} />
                  <AdminDetailItem label="반려 사유" value={application.rejectReason || '-'} />
                </div>
              </SectionPanel>

              <SectionPanel
                className="admin-evidence-panel"
                description="서류는 운영자 검수 후 승인 시 삭제되고, 반려 시 보관 만료일 이후 삭제 대상이 됩니다."
                title="제출 서류"
              >
                <div aria-label="제출 서류 목록" className="admin-evidence-list" tabIndex={0}>
                  {primaryEvidenceFiles.map((file) => (
                    <AdminEvidenceFileRow applicationId={application.id} file={file} key={file.id} />
                  ))}
                </div>
              </SectionPanel>

              {additionalEvidenceFiles.length ? (
                <SectionPanel
                  bodyClassName="admin-additional-evidence-body"
                  className="admin-evidence-panel admin-additional-evidence-panel"
                  description="사용자가 보완 과정에서 추가 제출한 서류입니다."
                  title="추가서류"
                >
                  <div
                    aria-label="추가서류 목록"
                    className="admin-evidence-list admin-additional-evidence-list"
                    tabIndex={0}
                  >
                    {additionalEvidenceFiles.map((file) => (
                      <AdminEvidenceFileRow applicationId={application.id} file={file} key={file.id} />
                    ))}
                  </div>
                </SectionPanel>
              ) : null}

              <SectionPanel
                description="NHN SMS에 같은 발신번호가 등록되어 있고 사용 가능하며 차단되지 않은 경우에만 승인할 수 있습니다."
                title="NHN 발신번호 상태"
              >
                <AdminNhnLookupPanel
                  error={lookupError}
                  lookupResult={lookupResult}
                  onLookup={onLookup}
                  pending={lookupPending}
                />
              </SectionPanel>

              {approveError ? (
                <div className="message-send-api-status admin-sender-status" data-tone="critical" role="alert">
                  <span>{approveError}</span>
                </div>
              ) : null}
            </DrawerBody>
            <DrawerFooter>
              <span className="admin-approval-hint">{approvalHint}</span>
              <Button
                disabled={!isSubmitted || rejectPending || approvePending}
                onClick={onRejectOpen}
                variant="danger"
              >
                반려
              </Button>
              <Button
                disabled={!canApprove}
                onClick={onApprove}
                variant="primary"
              >
                {approvePending ? '승인 중' : '승인'}
              </Button>
            </DrawerFooter>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function AdminNhnLookupPanel({ error, lookupResult, onLookup, pending }) {
  const status = lookupResult?.status ?? 'unchecked';

  return (
    <div className="admin-nhn-lookup">
      <div className="admin-nhn-lookup-main" data-status={error ? 'error' : status}>
        <NhnLookupStatusIcon error={Boolean(error)} pending={pending} status={status} />
        <span>
          <strong>{getNhnLookupTitle({ error, pending, status })}</strong>
          <small>{getNhnLookupDescription({ error, lookupResult, pending, status })}</small>
        </span>
      </div>
      <Button disabled={pending} onClick={onLookup} variant="secondary">
        <RefreshCcw aria-hidden="true" size={15} />
        {pending ? '조회 중' : 'NHN 상태 조회'}
      </Button>
      {lookupResult?.row ? (
        <div className="admin-nhn-meta">
          <span>useYn {lookupResult.row.useYn ?? '-'}</span>
          <span>blockYn {lookupResult.row.blockYn ?? '-'}</span>
          <span>serviceId {lookupResult.row.serviceId ?? '-'}</span>
        </div>
      ) : null}
    </div>
  );
}

function NhnLookupStatusIcon({ error, pending, status }) {
  if (pending) {
    return <RefreshCcw aria-hidden="true" size={20} />;
  }

  if (error) {
    return <AlertTriangle aria-hidden="true" size={20} />;
  }

  if (status === 'usable') {
    return <CheckCircle2 aria-hidden="true" size={20} />;
  }

  if (status === 'blocked' || status === 'unusable') {
    return <XCircle aria-hidden="true" size={20} />;
  }

  return <ShieldCheck aria-hidden="true" size={20} />;
}

function AdminDetailItem({ label, value }) {
  return (
    <span className="admin-detail-item">
      <small>{label}</small>
      <strong>{value || '-'}</strong>
    </span>
  );
}

function AdminEvidenceFileRow({ applicationId, file }) {
  return (
    <div className="admin-evidence-row">
      <span className="admin-evidence-icon">
        <FileText aria-hidden="true" size={18} />
      </span>
      <span className="admin-evidence-copy">
        <strong>{EVIDENCE_DOCUMENT_LABELS[file.documentType] ?? file.documentType}</strong>
        <small>{file.originalFileName} · {formatFileSize(file.byteSize)}</small>
      </span>
      <Button asChild variant="secondary">
        <a
          className="admin-evidence-download"
          href={`/api/admin/sender-resource-applications/${encodeURIComponent(applicationId)}/evidence-files/${encodeURIComponent(file.id)}/download`}
        >
          <Download aria-hidden="true" size={15} />
          다운로드
        </a>
      </Button>
    </div>
  );
}

function AdminRejectDialog({
  error,
  onOpenChange,
  onReasonChange,
  onSubmit,
  open,
  pending,
  reason,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-reject-dialog" size="small">
        <DialogHeader>
          <DialogTitle>신청 반려</DialogTitle>
          <DialogDescription>운영자가 확인한 반려 사유를 입력하세요.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <DialogBody>
            <label className="admin-reject-field" htmlFor="admin-reject-reason">
              <span>반려 사유</span>
              <textarea
                className="admin-review-textarea"
                id="admin-reject-reason"
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder="예: 통신서비스 이용증명원 발급일이 3개월을 초과했습니다."
                rows={5}
                value={reason}
              />
            </label>
            {error ? (
              <div className="message-send-api-status admin-sender-status" data-tone="critical" role="alert">
                <span>{error}</span>
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button disabled={pending} onClick={() => onOpenChange(false)} variant="secondary">
              취소
            </Button>
            <Button disabled={!reason.trim() || pending} type="submit" variant="danger">
              {pending ? '반려 중' : '반려'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getApprovalHint({ application, lookupPending, lookupResult }) {
  if (!application) {
    return '';
  }

  if (application.status !== 'submitted') {
    return '이미 검토가 완료된 신청입니다.';
  }

  if (lookupPending) {
    return 'NHN 상태를 확인하는 중입니다.';
  }

  if (!lookupResult) {
    return 'NHN 상태 조회 후 승인할 수 있습니다.';
  }

  if (lookupResult.usable) {
    return 'NHN에서 사용 가능한 발신번호로 확인되었습니다.';
  }

  return 'NHN에서 사용 가능한 상태가 아니므로 승인할 수 없습니다.';
}

function getNhnLookupTitle({ error, pending, status }) {
  if (pending) {
    return 'NHN 상태 조회 중';
  }

  if (error) {
    return 'NHN 조회 실패';
  }

  if (status === 'usable') {
    return '사용 가능';
  }

  if (status === 'not_registered') {
    return 'NHN 미등록';
  }

  if (status === 'blocked') {
    return '차단된 발신번호';
  }

  if (status === 'unusable') {
    return '사용 불가';
  }

  return '조회 전';
}

function getNhnLookupDescription({ error, lookupResult, pending, status }) {
  if (pending) {
    return '등록 여부와 차단 여부를 확인하고 있습니다.';
  }

  if (error) {
    return error;
  }

  if (status === 'usable') {
    return 'useYn=Y, blockYn=N 조건을 만족합니다.';
  }

  if (status === 'not_registered') {
    return `${formatSettingsPhoneNumber(lookupResult?.sendNo)} 번호를 NHN에서 찾지 못했습니다.`;
  }

  if (status === 'blocked') {
    return lookupResult?.row?.blockReason || 'NHN에서 차단된 번호입니다.';
  }

  if (status === 'unusable') {
    return 'NHN 등록 정보가 사용 가능 조건을 만족하지 않습니다.';
  }

  return '승인 전 NHN 상태 조회를 실행하세요.';
}

function getSenderNumberTypeLabel(value) {
  if (value === 'company') {
    return '회사번호';
  }

  if (value === 'personal') {
    return '개인번호';
  }

  return value || '-';
}

function getAdminApplicationStatusLabel(status) {
  if (status === 'submitted') {
    return '검수 대기';
  }

  if (status === 'approved') {
    return '승인됨';
  }

  if (status === 'rejected') {
    return '반려됨';
  }

  if (status === 'canceled') {
    return '취소됨';
  }

  return status || '-';
}

function getAdminApplicationStatusTone(status) {
  if (status === 'approved') {
    return 'green';
  }

  if (status === 'rejected' || status === 'canceled') {
    return 'critical';
  }

  return 'neutral';
}

function formatAdminDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatFileSize(value) {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes < 0) {
    return '용량 정보 없음';
  }

  if (bytes < 1024) {
    return `${bytes}B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
