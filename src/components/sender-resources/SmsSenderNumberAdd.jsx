'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  FileText,
  Info,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  DomainAddField,
  DomainAddHeader,
  DomainAddSteps,
  DomainIconButton,
  DomainStep,
  DomainStepBody,
  DomainStepHeading,
  DomainTextInput,
} from '../domains/index.js';
import { Notice, SegmentedControl, Tooltip } from '../ui/index.js';
import { getSmsSenderNumberDuplicateIssue } from './smsSenderNumberDuplicateGuard.js';

export const SMS_SENDER_NUMBER_TYPE_OPTIONS = [
  {
    label: '개인번호',
    value: 'personal',
  },
  {
    label: '회사번호',
    value: 'company',
  },
];

export const PERSONAL_SENDER_EVIDENCE_FILES = [
  {
    helpLines: [
      '통신사에 따라 가입사실확인서, 서비스 이용증명서 등 다른 이름으로 발급될 수 있습니다.',
      '등록하려는 번호의 이용 사실과 가입자 정보가 확인되는 문서를 준비해 주세요.',
      '숨김 처리된 정보가 없어야 하며, 최근 3개월 이내 발급된 서류만 등록할 수 있습니다.',
    ],
    description: '최근 3개월 이내 발급된 서류만 등록할 수 있습니다.',
    helpTitle: '어떤 문서인가요?',
    id: 'telecom_certificate',
    label: '통신서비스 이용증명원',
  },
  {
    helpLines: [
      '번호 사용에 대한 동의를 확인하는 문서입니다.',
      '번호 명의자와 실제 이용 주체가 다를 때 특히 중요합니다.',
      '서명 또는 날인이 필요한 양식을 사용 중이라면 서명 완료본을 업로드해 주세요.',
    ],
    description: '발신번호 사용에 대한 동의 내용을 확인할 수 있는 문서를 업로드하세요.',
    helpTitle: '무엇을 확인하나요?',
    id: 'consent_document',
    label: '이용승낙서',
  },
  {
    helpLines: [
      '개인번호는 본인 확인을 위해 번호 명의자의 신분증 사본이 필요합니다.',
      '주민등록번호 뒷자리는 반드시 마스킹된 상태여야 합니다.',
      '이름과 생년월일 앞자리 등 필요한 정보만 보이도록 편집한 뒤 제출해 주세요.',
    ],
    description: '번호 명의자의 신분증 사본을 업로드하세요. 주민등록번호 뒷자리는 반드시 가려 주세요.',
    helpTitle: '제출 시 주의사항',
    id: 'id_card_copy',
    label: '신분증 사본',
  },
];

export const COMPANY_SENDER_EVIDENCE_FILES = [
  {
    helpLines: PERSONAL_SENDER_EVIDENCE_FILES[0].helpLines,
    description: PERSONAL_SENDER_EVIDENCE_FILES[0].description,
    helpTitle: PERSONAL_SENDER_EVIDENCE_FILES[0].helpTitle,
    id: PERSONAL_SENDER_EVIDENCE_FILES[0].id,
    label: PERSONAL_SENDER_EVIDENCE_FILES[0].label,
  },
  {
    helpLines: PERSONAL_SENDER_EVIDENCE_FILES[1].helpLines,
    description: PERSONAL_SENDER_EVIDENCE_FILES[1].description,
    helpTitle: PERSONAL_SENDER_EVIDENCE_FILES[1].helpTitle,
    id: PERSONAL_SENDER_EVIDENCE_FILES[1].id,
    label: PERSONAL_SENDER_EVIDENCE_FILES[1].label,
  },
  {
    helpLines: [
      '발신번호 명의 사업자의 정보를 확인하는 문서입니다.',
      '사업자명과 사업자등록번호가 확인되는 사본을 준비해 주세요.',
    ],
    description: '번호 명의자의 사업자등록증을 업로드하세요.',
    helpTitle: '무엇을 확인하나요?',
    id: 'business_registration',
    label: '번호 명의 사업자등록증',
  },
  {
    helpLines: [
      '번호 명의 사업자와 신청 사업자 간의 관계를 확인하는 문서입니다.',
      '계약서, 위임장, 관계 확인 공문처럼 번호 사용 권한을 설명할 수 있는 문서를 준비해 주세요.',
    ],
    description: '번호 명의 사업자와 신청 사업자 간의 관계를 확인할 수 있는 문서를 업로드하세요.',
    helpTitle: '어떤 문서인가요?',
    id: 'relationship_proof',
    label: '사업자와 타사 간 관계 확인 문서',
  },
];

export const ADDITIONAL_SENDER_EVIDENCE_FILE = {
  helpLines: [
    '운영자가 보완을 요청한 추가 자료를 제출할 때 사용합니다.',
    '기존 필수 서류는 유지되며, 필요한 서류만 변경하거나 보완 자료를 더 올릴 수 있습니다.',
  ],
  description: '보완 요청을 받은 추가 자료가 있다면 업로드하세요.',
  helpTitle: '언제 사용하나요?',
  id: 'additional_document',
  label: '기타서류',
};

export const SENDER_EVIDENCE_FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png';

export const smsSenderNumberAddFixtures = {
  default: {
    initialStep: 'number',
  },
  numberCompleted: {
    initialNumberType: 'company',
    initialSendNo: '1544-6859',
    initialStep: 'evidence',
  },
  partialEvidence: {
    initialEvidenceFiles: {
      telecom_certificate: { name: 'telecom-certificate.pdf', size: 324000 },
    },
    initialNumberType: 'company',
    initialSendNo: '1544-6859',
    initialStep: 'evidence',
  },
  rejectedResubmission: {
    resubmitApplication: {
      evidenceFiles: [
        {
          documentType: 'telecom_certificate',
          id: 'evidence_telecom_existing',
          originalFileName: 'telecom-certificate.pdf',
          status: 'active',
        },
        {
          documentType: 'consent_document',
          id: 'evidence_consent_existing',
          originalFileName: 'consent-signed.pdf',
          status: 'active',
        },
        {
          documentType: 'id_card_copy',
          id: 'evidence_id_existing',
          originalFileName: 'id-card-masked.pdf',
          status: 'active',
        },
        {
          documentType: 'additional_document',
          id: 'evidence_additional_existing',
          originalFileName: 'operator-supplement.pdf',
          status: 'active',
        },
      ],
      id: 'application_rejected_1',
      rejectReason: '통신서비스 이용증명원 발급일이 3개월을 초과했습니다.',
      requestedValue: '01012345678',
      senderNumberType: 'personal',
      status: 'rejected',
    },
  },
  submittedCompleted: {
    initialEvidenceFiles: {
      business_registration: { name: 'business-registration.pdf', size: 198000 },
      consent_document: { name: 'consent-signed.pdf', size: 188000 },
      relationship_proof: { name: 'relationship-proof.pdf', size: 246000 },
      telecom_certificate: { name: 'telecom-certificate.pdf', size: 324000 },
    },
    initialNumberType: 'company',
    initialSendNo: '1544-6859',
    initialStep: 'submitted',
    submittedApplication: {
      id: 'application_submitted_1',
      status: 'submitted',
    },
  },
};

export function SmsSenderNumberAdd({
  initialAdditionalEvidenceFiles = [],
  initialEvidenceFiles = {},
  initialNumberType = SMS_SENDER_NUMBER_TYPE_OPTIONS[0].value,
  initialSendNo = '',
  initialStep = 'number',
  onBack,
  onSubmit,
  resubmitApplication = null,
  senderResourcesData = null,
  submitError = '',
  duplicateCheckPending = false,
  submitPending = false,
  submittedApplication = null,
}) {
  const isResubmission = Boolean(resubmitApplication);
  const [step, setStep] = useState(() => (
    submittedApplication || initialStep === 'submitted'
      ? 'submitted'
      : isResubmission
        ? 'evidence'
        : initialStep
  ));
  const [sendNo, setSendNo] = useState(resubmitApplication?.requestedValue ?? initialSendNo);
  const [senderNumberType, setSenderNumberType] = useState(
    resubmitApplication?.senderNumberType ?? initialNumberType
  );
  const [evidenceFiles, setEvidenceFiles] = useState(initialEvidenceFiles);
  const [additionalEvidenceFiles, setAdditionalEvidenceFiles] = useState(initialAdditionalEvidenceFiles);
  const [localSubmitError, setLocalSubmitError] = useState('');
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const normalizedSendNo = normalizeSenderNumberInput(sendNo);
  const numberIssue = getSenderNumberInputIssue(sendNo);
  const duplicateIssue = useMemo(() => getSmsSenderNumberDuplicateIssue({
    currentApplicationId: resubmitApplication?.id,
    senderResourcesData,
    sendNo,
  }), [resubmitApplication?.id, senderResourcesData, sendNo]);
  const shouldWaitForDuplicateCheck = Boolean(duplicateCheckPending && normalizedSendNo && !numberIssue);
  const selectedNumberType = getSmsSenderNumberTypeOption(senderNumberType);
  const evidenceDocuments = getSmsSenderEvidenceDocuments(senderNumberType);
  const evidenceReady = evidenceDocuments.every((document) => (
    evidenceFiles[document.id] || getReusableApplicationEvidenceFiles(resubmitApplication, document.id).length > 0
  ));
  const canContinue = Boolean(
    normalizedSendNo
    && senderNumberType
    && !numberIssue
    && !duplicateIssue
    && !shouldWaitForDuplicateCheck
  );
  const isSubmitting = submitPending || localSubmitting;
  const renderedSubmitError = submitError || localSubmitError;
  const reviewApplication = submittedApplication || (
    step === 'submitted'
      ? { id: resubmitApplication?.id ?? 'submitted', status: 'submitted' }
      : null
  );
  const formContext = useMemo(() => ({
    applicationId: resubmitApplication?.id,
    evidenceDocuments,
    existingEvidenceFiles: resubmitApplication?.evidenceFiles ?? [],
    senderNumberType,
    sendNo: normalizedSendNo,
  }), [evidenceDocuments, normalizedSendNo, resubmitApplication, senderNumberType]);

  function updateSenderNumberType(value) {
    if (value !== senderNumberType) {
      setEvidenceFiles({});
      setLocalSubmitError('');
    }

    setSenderNumberType(value);
  }

  function continueToEvidence(event) {
    event.preventDefault();

    if (!canContinue) {
      return;
    }

    setStep('evidence');
    setLocalSubmitError('');
  }

  function updateEvidenceFile(documentId, event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setEvidenceFiles((current) => ({
      ...current,
      [documentId]: createEvidenceFileDescriptor(file),
    }));
    setLocalSubmitError('');
    event.target.value = '';
  }

  function removeEvidenceFile(documentId) {
    setEvidenceFiles((current) => {
      const next = { ...current };
      delete next[documentId];
      return next;
    });
    setLocalSubmitError('');
  }

  function updateAdditionalEvidenceFiles(event) {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (!selectedFiles.length) {
      return;
    }

    setAdditionalEvidenceFiles((current) => [
      ...current,
      ...selectedFiles.map((file, index) => ({
        ...createEvidenceFileDescriptor(file),
        id: `${file.name}-${file.size}-${file.lastModified ?? 0}-${Date.now()}-${index}`,
      })),
    ]);
    setLocalSubmitError('');
    event.target.value = '';
  }

  function removeAdditionalEvidenceFile(fileId) {
    setAdditionalEvidenceFiles((current) => current.filter((file) => file.id !== fileId));
    setLocalSubmitError('');
  }

  async function submitEvidence(event) {
    event.preventDefault();

    if (!evidenceReady || isSubmitting) {
      return;
    }

    const payload = buildSmsSenderNumberApplicationPayload({
      additionalEvidenceFiles,
      evidenceFiles,
      formContext,
    });

    setLocalSubmitError('');
    setLocalSubmitting(true);

    try {
      await onSubmit?.(payload);
      setStep('submitted');
    } catch (error) {
      setLocalSubmitError(error?.message || '발신번호 신청을 제출하지 못했습니다.');
    } finally {
      setLocalSubmitting(false);
    }
  }

  return (
    <section className="page-frame domain-add-page sms-sender-add-page">
      <DomainAddHeader
        description={isResubmission
          ? '반려 사유를 확인하고 필요한 서류만 교체해 다시 제출합니다.'
          : '발신번호와 증빙서류를 확인한 뒤 운영자 심사로 접수합니다.'}
        title={isResubmission ? '발신번호 재신청' : '발신번호 추가'}
      />
      {onBack ? (
        <button className="sender-resource-back-button sms-sender-back-button" onClick={() => onBack?.()} type="button">
          <ChevronLeft aria-hidden="true" size={15} />
          발신 수단 관리
        </button>
      ) : null}
      <DomainAddSteps>
        {step === 'number' ? (
          <SmsSenderNumberInputStep
            canContinue={canContinue}
            duplicateCheckPending={shouldWaitForDuplicateCheck}
            duplicateIssue={duplicateIssue}
            numberIssue={numberIssue}
            normalizedSendNo={normalizedSendNo}
            onContinue={continueToEvidence}
            onSenderNumberTypeChange={updateSenderNumberType}
            onSendNoChange={setSendNo}
            selectedNumberType={selectedNumberType}
            senderNumberType={senderNumberType}
            sendNo={sendNo}
          />
        ) : (
          <SmsSenderNumberCompletedStep
            selectedNumberType={selectedNumberType}
            sendNo={normalizedSendNo}
          />
        )}

        {step === 'number' ? (
          <DomainStepBody status="locked">
            <DomainStepHeading status="locked">발신번호 증빙서류</DomainStepHeading>
          </DomainStepBody>
        ) : step === 'submitted' ? (
          <SmsEvidenceCompletedStep />
        ) : (
          <SmsEvidenceStep
            additionalEvidenceFiles={additionalEvidenceFiles}
            documents={evidenceDocuments}
            evidenceFiles={evidenceFiles}
            evidenceReady={evidenceReady}
            existingAdditionalEvidenceFiles={getReusableApplicationEvidenceFiles(
              resubmitApplication,
              ADDITIONAL_SENDER_EVIDENCE_FILE.id
            )}
            isResubmission={isResubmission}
            isSubmitting={isSubmitting}
            onAdditionalEvidenceFileChange={updateAdditionalEvidenceFiles}
            onAdditionalEvidenceFileRemove={removeAdditionalEvidenceFile}
            onBack={() => setStep('number')}
            onEvidenceFileChange={updateEvidenceFile}
            onEvidenceFileRemove={removeEvidenceFile}
            onSubmit={submitEvidence}
            rejectReason={resubmitApplication?.rejectReason}
            resubmitApplication={resubmitApplication}
            selectedNumberType={selectedNumberType}
            submitError={renderedSubmitError}
          />
        )}

        <SmsReviewStep
          application={reviewApplication}
          isResubmission={isResubmission}
          isSubmitting={isSubmitting}
          selectedNumberType={selectedNumberType}
          sendNo={normalizedSendNo}
        />
      </DomainAddSteps>
    </section>
  );
}

function SmsSenderNumberInputStep({
  canContinue,
  duplicateCheckPending,
  duplicateIssue,
  numberIssue,
  normalizedSendNo,
  onContinue,
  onSenderNumberTypeChange,
  onSendNoChange,
  selectedNumberType,
  senderNumberType,
  sendNo,
}) {
  const renderedIssue = numberIssue || duplicateIssue?.message || '';

  return (
    <DomainStep
      className="domain-information-step sms-sender-number-step"
      description="하이픈이나 공백이 있어도 괜찮습니다. 숫자만 정리해 심사에 사용합니다."
      status="pending"
      title="발신번호"
    >
      <form className="domain-add-form sms-sender-number-form" onSubmit={onContinue}>
        <div className="domain-add-field sms-sender-type-field">
          <span className="sms-sender-field-label">번호 유형</span>
          <SegmentedControl
            className="sms-sender-number-type-control"
            items={SMS_SENDER_NUMBER_TYPE_OPTIONS}
            onValueChange={onSenderNumberTypeChange}
            value={senderNumberType}
          />
        </div>
        <DomainAddField htmlFor="sms-sender-number-input" label="발신번호">
          <div className="domain-add-input-with-action">
            <DomainTextInput
              aria-describedby="sms-sender-number-help"
              aria-invalid={Boolean(renderedIssue)}
              id="sms-sender-number-input"
              inputMode="numeric"
              onChange={(event) => onSendNoChange(event.target.value)}
              placeholder={senderNumberType === 'personal' ? '010-1234-5678' : '1544-6859'}
              value={sendNo}
            />
            <DomainIconButton label="번호 유형 안내">
              <Info aria-hidden="true" size={16} />
            </DomainIconButton>
          </div>
          <p
            className="sender-number-application-help sms-sender-number-help"
            data-tone={renderedIssue ? 'critical' : 'neutral'}
            id="sms-sender-number-help"
          >
            {renderedIssue || (
              duplicateCheckPending
                ? '기존 발신번호 신청/등록 내역을 확인 중입니다.'
                : null
            ) || (
              normalizedSendNo
                ? `저장될 번호: ${formatSmsSenderNumberForDisplay(normalizedSendNo)} · ${selectedNumberType.label}`
                : '발신번호는 숫자 기준 8자리에서 11자리여야 합니다.'
            )}
          </p>
        </DomainAddField>
        <div className="domain-add-actions">
          <button className="domain-add-primary-button" disabled={!canContinue} type="submit">
            <Plus aria-hidden="true" size={16} />
            <span>다음</span>
          </button>
        </div>
      </form>
    </DomainStep>
  );
}

function SmsSenderNumberCompletedStep({ selectedNumberType, sendNo }) {
  return (
    <DomainStep
      className="domain-information-step sms-sender-number-step"
      description="번호와 유형은 이 신청의 기준 정보로 잠깁니다."
      status="completed"
      title="발신번호"
    >
      <div className="sms-sender-number-readonly-summary">
        <label className="domain-add-field" htmlFor="sms-sender-number-completed">
          <span>신청 번호</span>
          <span className="sms-sender-number-readonly-field">
            <ShieldCheck aria-hidden="true" size={16} />
            <input
              className="domain-add-input"
              id="sms-sender-number-completed"
              readOnly
              value={`${formatSmsSenderNumberForDisplay(sendNo)} · ${selectedNumberType.label}`}
            />
          </span>
        </label>
      </div>
    </DomainStep>
  );
}

function SmsEvidenceStep({
  additionalEvidenceFiles,
  documents,
  evidenceFiles,
  evidenceReady,
  existingAdditionalEvidenceFiles,
  isResubmission,
  isSubmitting,
  onAdditionalEvidenceFileChange,
  onAdditionalEvidenceFileRemove,
  onBack,
  onEvidenceFileChange,
  onEvidenceFileRemove,
  onSubmit,
  rejectReason,
  resubmitApplication,
  selectedNumberType,
  submitError,
}) {
  return (
    <DomainStep
      className="domain-information-step sms-sender-evidence-step"
      description={`${selectedNumberType.label} 등록에 필요한 서류를 업로드하세요.`}
      status={submitError ? 'failed' : 'pending'}
      title="발신번호 증빙서류"
    >
      <form className="sender-number-evidence-form sms-sender-evidence-form" onSubmit={onSubmit}>
        {isResubmission && rejectReason ? (
          <Notice
            className="sms-sender-submit-error sms-sender-rejection-notice"
            title="반려 사유"
            urgent
            variant="critical"
          >
            <p>{rejectReason}</p>
          </Notice>
        ) : null}
        {documents.map((document) => (
          <SmsEvidenceRow
            document={document}
            existingFile={getReusableApplicationEvidenceFiles(resubmitApplication, document.id)[0] ?? null}
            key={document.id}
            onChange={onEvidenceFileChange}
            onRemove={onEvidenceFileRemove}
            selectedFile={evidenceFiles[document.id]}
          />
        ))}
        <SmsAdditionalEvidenceRow
          existingFiles={existingAdditionalEvidenceFiles}
          files={additionalEvidenceFiles}
          onChange={onAdditionalEvidenceFileChange}
          onRemove={onAdditionalEvidenceFileRemove}
        />
        {submitError ? (
          <Notice
            className="sms-sender-submit-error"
            title="제출 오류"
            urgent
            variant="critical"
          >
            <p>{submitError}</p>
          </Notice>
        ) : null}
        <div className="domain-add-actions">
          {!isResubmission ? (
            <button className="domain-add-secondary-button" onClick={onBack} type="button">
              이전
            </button>
          ) : null}
          <button className="domain-add-primary-button" disabled={!evidenceReady || isSubmitting} type="submit">
            <CheckCircle2 aria-hidden="true" size={16} />
            <span>{isSubmitting ? '제출 중' : isResubmission ? '재신청 제출' : '신청 제출'}</span>
          </button>
        </div>
      </form>
    </DomainStep>
  );
}

function SmsEvidenceCompletedStep() {
  return (
    <DomainStep
      className="domain-information-step sms-sender-evidence-step"
      description="제출한 서류는 운영자 심사에 사용됩니다."
      status="completed"
      title="발신번호 증빙서류"
    />
  );
}

function SmsEvidenceRow({
  document,
  existingFile,
  onChange,
  onRemove,
  selectedFile,
}) {
  const displayFile = selectedFile || existingFile;

  return (
    <div className="sender-number-evidence-row">
      <div className="sender-number-evidence-copy">
        <span className="sender-number-evidence-title-row">
          <strong>{document.label}</strong>
          <span aria-label="필수" className="sender-number-evidence-required-star">*</span>
          <SmsEvidenceHelpTooltip document={document} />
        </span>
        <span className="sender-number-evidence-description">{document.description}</span>
      </div>
      <div className="sender-number-evidence-actions">
        {displayFile ? (
          <span
            className={[
              'sender-number-evidence-file-chip',
              !selectedFile && existingFile && 'is-existing',
            ].filter(Boolean).join(' ')}
            title={getEvidenceFileDisplayName(displayFile)}
          >
            <span className="sender-number-evidence-file-name">{getEvidenceFileDisplayName(displayFile)}</span>
            {selectedFile ? (
              <>
                {existingFile ? <span className="sender-number-evidence-existing-label">변경 예정</span> : null}
                <button
                  aria-label={`${document.label} 파일 선택 취소`}
                  className="sender-number-evidence-remove"
                  onClick={() => onRemove(document.id)}
                  type="button"
                >
                  <X aria-hidden="true" size={14} />
                </button>
              </>
            ) : (
              <span className="sender-number-evidence-existing-label">기존</span>
            )}
          </span>
        ) : null}
        <label className="sender-number-evidence-upload" htmlFor={`sms-sender-evidence-${document.id}`}>
          {displayFile ? '변경' : '파일 선택'}
          <input
            accept={SENDER_EVIDENCE_FILE_ACCEPT}
            id={`sms-sender-evidence-${document.id}`}
            onChange={(event) => onChange(document.id, event)}
            type="file"
          />
        </label>
      </div>
    </div>
  );
}

function SmsAdditionalEvidenceRow({ existingFiles, files, onChange, onRemove }) {
  return (
    <div className="sender-number-evidence-row">
      <div className="sender-number-evidence-copy">
        <span className="sender-number-evidence-title-row">
          <strong>{ADDITIONAL_SENDER_EVIDENCE_FILE.label}</strong>
          <span className="sender-number-evidence-requirement-label">선택</span>
          <SmsEvidenceHelpTooltip document={ADDITIONAL_SENDER_EVIDENCE_FILE} />
        </span>
        <span className="sender-number-evidence-description">{ADDITIONAL_SENDER_EVIDENCE_FILE.description}</span>
      </div>
      <div className="sender-number-evidence-actions sender-number-evidence-actions-wrap">
        {existingFiles.map((file) => (
          <span className="sender-number-evidence-file-chip is-existing" key={file.id} title={getEvidenceFileDisplayName(file)}>
            <span className="sender-number-evidence-file-name">{getEvidenceFileDisplayName(file)}</span>
            <span className="sender-number-evidence-existing-label">기존</span>
          </span>
        ))}
        {files.map((file) => (
          <span className="sender-number-evidence-file-chip" key={file.id ?? file.name} title={getEvidenceFileDisplayName(file)}>
            <span className="sender-number-evidence-file-name">{getEvidenceFileDisplayName(file)}</span>
            <button
              aria-label={`${getEvidenceFileDisplayName(file)} 파일 삭제`}
              className="sender-number-evidence-remove"
              onClick={() => onRemove(file.id)}
              type="button"
            >
              <X aria-hidden="true" size={14} />
            </button>
          </span>
        ))}
        <label className="sender-number-evidence-upload" htmlFor="sms-sender-evidence-additional">
          기타서류 추가
          <input
            accept={SENDER_EVIDENCE_FILE_ACCEPT}
            id="sms-sender-evidence-additional"
            multiple
            onChange={onChange}
            type="file"
          />
        </label>
      </div>
    </div>
  );
}

function SmsReviewStep({ application, isResubmission, isSubmitting, selectedNumberType, sendNo }) {
  if (isSubmitting) {
    return (
      <DomainStep
        className="domain-information-step sms-sender-review-step"
        description="제출 정보를 접수하고 있습니다."
        status="validating"
        title="심사 접수"
      >
        <div className="sms-sender-review-panel" data-state="submitting">
          <FileText aria-hidden="true" size={16} />
          <span>접수 처리 중</span>
        </div>
      </DomainStep>
    );
  }

  if (!application) {
    return (
      <DomainStepBody status="locked">
        <DomainStepHeading status="locked">심사 접수</DomainStepHeading>
      </DomainStepBody>
    );
  }

  return (
    <DomainStep
      className="domain-information-step sms-sender-review-step"
      description="운영자가 서류를 확인한 뒤 발신번호를 사용할 수 있게 활성화합니다."
      status="completed"
      title="심사 접수"
    >
      <div className="sms-sender-review-panel" data-state="review-pending" data-submission-state={application.status ?? 'submitted'}>
        <FileText aria-hidden="true" size={16} />
        <span>{isResubmission ? '재신청이 심사 접수되었습니다.' : '신청이 심사 접수되었습니다.'}</span>
        <strong>{formatSmsSenderNumberForDisplay(sendNo)} · {selectedNumberType.label}</strong>
      </div>
    </DomainStep>
  );
}

function SmsEvidenceHelpTooltip({ document }) {
  return (
    <Tooltip
      content={(
        <div className="sender-number-evidence-tooltip">
          <strong>{document.helpTitle}</strong>
          {document.helpLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
      contentClassName="sender-number-evidence-tooltip-content"
      maxWidth={360}
      side="top"
      type="description"
    >
      <button
        aria-label={`${document.label} 도움말`}
        className="sender-number-evidence-help-button"
        type="button"
      >
        <Info aria-hidden="true" size={13} />
      </button>
    </Tooltip>
  );
}

export function normalizeSenderNumberInput(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function getSenderNumberInputIssue(value) {
  const digits = normalizeSenderNumberInput(value);

  if (!digits) {
    return '';
  }

  if (digits.length < 8 || digits.length > 11) {
    return '발신번호는 숫자 기준 8자리에서 11자리여야 합니다.';
  }

  if (/^(010|070)[01]/.test(digits)) {
    return '존재하지 않는 번호 대역은 등록할 수 없습니다.';
  }

  return '';
}

export function formatSmsSenderNumberForDisplay(value) {
  const digits = normalizeSenderNumberInput(value);

  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return digits || '발신번호';
}

export function getSmsSenderEvidenceDocuments(senderNumberType) {
  return senderNumberType === 'personal'
    ? PERSONAL_SENDER_EVIDENCE_FILES
    : COMPANY_SENDER_EVIDENCE_FILES;
}

export function getReusableApplicationEvidenceFiles(application, documentType) {
  const evidenceFiles = Array.isArray(application?.evidenceFiles) ? application.evidenceFiles : [];

  return evidenceFiles.filter((file) => (
    file.documentType === documentType
    && file.status !== 'deleted'
    && !file.deletedAt
  ));
}

export function getEvidenceFileDisplayName(file) {
  return file?.originalFileName || file?.name || '제출 서류';
}

export function buildSmsSenderNumberApplicationPayload({
  additionalEvidenceFiles = [],
  evidenceFiles = {},
  formContext,
}) {
  return {
    additionalEvidenceFiles,
    applicationId: formContext.applicationId,
    evidenceFiles,
    existingEvidenceFiles: formContext.existingEvidenceFiles,
    senderNumberType: formContext.senderNumberType,
    sendNo: formContext.sendNo,
  };
}

function getSmsSenderNumberTypeOption(value) {
  return SMS_SENDER_NUMBER_TYPE_OPTIONS.find((option) => option.value === value)
    ?? SMS_SENDER_NUMBER_TYPE_OPTIONS[0];
}

function createEvidenceFileDescriptor(file) {
  return {
    file,
    name: file.name,
    size: file.size,
  };
}
