import { randomBytes } from 'node:crypto';

import { getDb } from '../../db/client.js';
import { sanitizeAuditMetadata } from '../audit/service.js';
import { createNhnKakaoBizmessageClient } from '../nhn/kakaoBizmessageClient.js';
import { resolveNhnKakaoBizmessageConfig } from '../nhn/config.js';
import { NHN_ALIMTALK_DEFAULT_SENDER_GROUP_KEY } from '../nhn/kakaoCommonTemplateSources.js';
import { createNhnSmsClient } from '../nhn/smsClient.js';
import { PROVIDERS, RELAY_ERROR_CODES, SENDER_RESOURCE_TYPES } from '../relay/constants.js';
import { NhnProviderError, RelayError, RelayValidationError, extractProviderDetails } from '../relay/errors.js';
import { createEvidenceStore } from '../storage/evidenceStore.js';
import { createSenderResourceRepository } from './repository.js';

const APPLICATION_STATUS = Object.freeze({
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELED: 'canceled',
});

const LINK_STATUS = Object.freeze({
  ACTIVE: 'active',
});

const RESOURCE_STATUS = Object.freeze({
  ACTIVE: 'active',
});

const DEFAULTABLE_RESOURCE_TYPES = new Set([
  SENDER_RESOURCE_TYPES.SMS_SEND_NO,
  SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
]);

const EVIDENCE_STATUS = Object.freeze({
  ACTIVE: 'active',
  DELETE_PENDING: 'delete_pending',
  DELETED: 'deleted',
});

const SENDER_NUMBER_APPLICATION_TYPES = Object.freeze({
  PERSONAL: 'personal',
  COMPANY: 'company',
});

const EVIDENCE_DOCUMENT_TYPES = Object.freeze({
  TELECOM_CERTIFICATE: 'telecom_certificate',
  CONSENT_DOCUMENT: 'consent_document',
  ID_CARD_COPY: 'id_card_copy',
  BUSINESS_REGISTRATION: 'business_registration',
  RELATIONSHIP_PROOF: 'relationship_proof',
  ADDITIONAL_DOCUMENT: 'additional_document',
});

const REQUIRED_SMS_EVIDENCE_DOCUMENTS = Object.freeze({
  [SENDER_NUMBER_APPLICATION_TYPES.PERSONAL]: [
    EVIDENCE_DOCUMENT_TYPES.TELECOM_CERTIFICATE,
    EVIDENCE_DOCUMENT_TYPES.CONSENT_DOCUMENT,
    EVIDENCE_DOCUMENT_TYPES.ID_CARD_COPY,
  ],
  [SENDER_NUMBER_APPLICATION_TYPES.COMPANY]: [
    EVIDENCE_DOCUMENT_TYPES.TELECOM_CERTIFICATE,
    EVIDENCE_DOCUMENT_TYPES.CONSENT_DOCUMENT,
    EVIDENCE_DOCUMENT_TYPES.BUSINESS_REGISTRATION,
    EVIDENCE_DOCUMENT_TYPES.RELATIONSHIP_PROOF,
  ],
});

const SENDER_NUMBER_TYPE_ALIASES = Object.freeze({
  personal: SENDER_NUMBER_APPLICATION_TYPES.PERSONAL,
  company: SENDER_NUMBER_APPLICATION_TYPES.COMPANY,
  EMPLOYEE: SENDER_NUMBER_APPLICATION_TYPES.PERSONAL,
  COMPANY: SENDER_NUMBER_APPLICATION_TYPES.COMPANY,
});

const EVIDENCE_DOCUMENT_TYPE_ALIASES = Object.freeze({
  telecom_certificate: EVIDENCE_DOCUMENT_TYPES.TELECOM_CERTIFICATE,
  telecomCertificate: EVIDENCE_DOCUMENT_TYPES.TELECOM_CERTIFICATE,
  consent_document: EVIDENCE_DOCUMENT_TYPES.CONSENT_DOCUMENT,
  consentDocument: EVIDENCE_DOCUMENT_TYPES.CONSENT_DOCUMENT,
  id_card_copy: EVIDENCE_DOCUMENT_TYPES.ID_CARD_COPY,
  idCardCopy: EVIDENCE_DOCUMENT_TYPES.ID_CARD_COPY,
  business_registration: EVIDENCE_DOCUMENT_TYPES.BUSINESS_REGISTRATION,
  businessRegistration: EVIDENCE_DOCUMENT_TYPES.BUSINESS_REGISTRATION,
  relationship_proof: EVIDENCE_DOCUMENT_TYPES.RELATIONSHIP_PROOF,
  relationshipProof: EVIDENCE_DOCUMENT_TYPES.RELATIONSHIP_PROOF,
  additional_document: EVIDENCE_DOCUMENT_TYPES.ADDITIONAL_DOCUMENT,
  additionalDocument: EVIDENCE_DOCUMENT_TYPES.ADDITIONAL_DOCUMENT,
});

const ALLOWED_EVIDENCE_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png']);
const MAX_EVIDENCE_FILE_BYTES = 5 * 1024 * 1024;

const REJECTED_EVIDENCE_RETENTION_DAYS = 90;
const DEFAULT_EVIDENCE_CLEANUP_LIMIT = 100;

export function createDefaultSenderResourceApprovalService() {
  return createSenderResourceApprovalService({
    repository: createSenderResourceRepository(getDb()),
    evidenceStore: createEvidenceStore(),
    kakaoClient: createLazyNhnKakaoBizmessageClient(),
    kakaoDefaultSenderGroupKey: NHN_ALIMTALK_DEFAULT_SENDER_GROUP_KEY,
    smsClient: createLazyNhnSmsClient(),
  });
}

export function createSenderResourceApprovalService({
  repository,
  evidenceStore,
  kakaoClient,
  kakaoDefaultSenderGroupKey = null,
  smsClient,
  now = () => new Date(),
}) {
  return {
    async listSenderResources({ actorUserId }) {
      const user = await requireActiveUser(repository, actorUserId);
      const resourceRows = await repository.listUserSenderResources(user.id);
      const applicationRows = await repository.listUserApplications(user.id);
      const activeResourceRows = resourceRows.filter(isActiveUserResourceRow);

      return {
        resources: withSingleSmsSenderDefault(activeResourceRows).map(toUserSenderResourceDto),
        applications: applicationRows.map(toApplicationDto),
      };
    },

    async listKakaoResources({ actorUserId }) {
      const user = await requireActiveUser(repository, actorUserId);
      const resourceRows = await repository.listUserSenderResources(user.id);
      const kakaoRows = resourceRows
        .filter(isActiveUserResourceRow)
        .filter((row) => row.resource?.type === SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY);

      return toKakaoResourcesDto(kakaoRows);
    },

    async getKakaoConnectBootstrap({ actorUserId }) {
      const user = await requireActiveUser(repository, actorUserId);
      const [categoriesResponse, resources] = await Promise.all([
        requireKakaoClient(kakaoClient).listSenderCategories(),
        this.listKakaoResources({ actorUserId: user.id }),
      ]);

      return {
        readiness: resources.readiness,
        categories: mapKakaoConnectCategories(extractKakaoCategories(categoriesResponse)),
        existingChannels: resources.items,
        provider: toProviderResult(categoriesResponse),
      };
    },

    async submitSmsApplication({ actorUserId, payload, files = [] }) {
      const user = await requireActiveUser(repository, actorUserId);
      const resubmitApplicationId = normalizeOptionalString(payload.applicationId);

      if (resubmitApplicationId) {
        return resubmitRejectedSmsApplication({
          applicationId: resubmitApplicationId,
          evidenceStore,
          files,
          now,
          payload,
          repository,
          user,
        });
      }

      const requestedValue = normalizeSendNo(payload.sendNo ?? payload.requestedValue);
      const senderNumberType = normalizeSenderNumberType(
        payload.senderNumberType ?? payload.numberType ?? payload.type
      );
      const evidenceInputs = normalizeEvidenceInputs(payload.evidenceFiles, files);

      validateSmsEvidenceInputs({ senderNumberType, evidenceInputs });

      await assertSmsSenderNumberNotAlreadyRegistered({
        repository,
        requestedValue,
        userId: user.id,
      });

      const pendingApplication = await repository.findSubmittedApplicationByUserValue({
        userId: user.id,
        resourceType: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
        requestedValue,
      });

      if (pendingApplication) {
        throw new RelayValidationError('A submitted application already exists for this sender number.');
      }

      const application = await repository.createApplication({
        userId: user.id,
        resourceType: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
        requestedValue,
        senderNumberType,
        status: APPLICATION_STATUS.SUBMITTED,
      });

      let storedEvidence = [];
      let evidenceFiles;

      try {
        storedEvidence = await evidenceStore.storeApplicationFiles({
          applicationId: application.id,
          userId: user.id,
          files: evidenceInputs.map((input) => input.file),
        });
        evidenceFiles = await repository.createEvidenceFiles(
          storedEvidence.map((file, index) => toEvidenceInsert(
            file,
            application.id,
            user.id,
            evidenceInputs[index].documentType
          ))
        );
      } catch (error) {
        if (storedEvidence.length) {
          try {
            await evidenceStore.deleteApplicationFiles(storedEvidence);
          } catch {
            // Keep the original upload/metadata failure as the user-facing error.
          }
        }
        await repository.updateApplication(application.id, {
          status: APPLICATION_STATUS.CANCELED,
          reviewMemo: 'Evidence upload failed.',
        });
        throw error;
      }

      return toApplicationDto({ application, evidenceFiles });
    },

    async requestKakaoConnect({ actorUserId, payload }) {
      const user = await requireActiveUser(repository, actorUserId);
      const registration = normalizeKakaoRegistrationPayload(payload);
      const providerResponse = await kakaoClient.registerSender(registration);
      const application = await repository.createApplication({
        userId: user.id,
        resourceType: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
        requestedValue: registration.plusFriendId,
        status: APPLICATION_STATUS.SUBMITTED,
        reviewMemo: registration.categoryCode,
      });

      return {
        application: toApplicationDto({ application, evidenceFiles: [] }),
        provider: toProviderResult(providerResponse),
      };
    },

    async verifyKakaoConnect({ actorUserId, payload }) {
      const user = await requireActiveUser(repository, actorUserId);
      const applicationId = normalizeRequiredString(payload.applicationId, 'applicationId');
      const applicationRecord = await requireApplication(repository, applicationId);
      const { application } = applicationRecord;

      if (application.userId !== user.id) {
        throw forbidden('You cannot verify this sender resource application.');
      }

      if (application.resourceType !== SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY) {
        throw new RelayValidationError('applicationId must reference a Kakao sender key application.');
      }

      if (application.status !== APPLICATION_STATUS.SUBMITTED) {
        throw new RelayValidationError('Only submitted Kakao sender key applications can be verified.');
      }

      const plusFriendId = normalizeRequiredString(payload.plusFriendId ?? application.requestedValue, 'plusFriendId');
      const token = normalizeIntegerToken(payload.token);
      const providerResponse = await kakaoClient.verifySenderToken({ plusFriendId, token });
      const sender = await resolveVerifiedSender({ kakaoClient, providerResponse, plusFriendId, fallbackSenderKey: payload.senderKey });
      const senderKey = normalizeRequiredString(sender.senderKey, 'senderKey');
      await assertKakaoSenderNotAlreadyLinked({
        repository,
        userId: user.id,
        senderKey,
        plusFriendId: sender.plusFriendId || plusFriendId,
      });
      const { resource, link } = await createOrActivateUserResourceLink({
        repository,
        user,
        resourceType: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
        value: senderKey,
        displayName: sender.plusFriendId || plusFriendId,
        providerStatus: deriveKakaoProviderStatus(sender),
        metadataJson: {
          plusFriendId: sender.plusFriendId || plusFriendId,
          categoryCode: sender.categoryCode ?? null,
        },
      });
      const reviewedAt = now();
      const updatedApplication = await repository.updateApplication(application.id, {
        requestedValue: senderKey,
        status: APPLICATION_STATUS.APPROVED,
        reviewedBy: user.id,
        reviewedAt,
        reviewMemo: null,
        rejectReason: null,
      });
      const senderGroup = await syncDefaultKakaoSenderGroup({
        repository,
        kakaoClient,
        actorUserId: user.id,
        senderResourceId: resource.id,
        senderKey,
        groupSenderKey: kakaoDefaultSenderGroupKey,
      });

      await writeAuditLog(repository, {
        actorUserId: user.id,
        action: 'sender_resource.kakao_verified',
        targetType: 'sender_resource',
        targetId: resource.id,
        metadataJson: {
          applicationId: application.id,
          senderResourceId: resource.id,
          senderGroupConfigured: senderGroup.configured,
          senderGroupAdded: senderGroup.added,
        },
      });

      return {
        application: toApplicationDto({ application: updatedApplication, evidenceFiles: [] }),
        resource: toUserSenderResourceDto({ resource, link }),
        senderGroup,
        provider: toProviderResult(providerResponse),
      };
    },

    async setDefaultKakaoChannel({ actorUserId, senderProfileId }) {
      const user = await requireActiveUser(repository, actorUserId);
      const normalizedSenderProfileId = normalizeRequiredString(senderProfileId, 'senderProfileId');
      const resourceRows = await repository.listUserSenderResources(user.id);
      const activeKakaoRows = resourceRows
        .filter(isActiveUserResourceRow)
        .filter((row) => row.resource?.type === SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY);
      const targetRow = activeKakaoRows.find((row) => (
        row.link.id === normalizedSenderProfileId
        || row.resource.id === normalizedSenderProfileId
        || row.resource.value === normalizedSenderProfileId
      ));

      if (!targetRow) {
        throw new RelayError({
          code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
          message: 'Kakao sender profile was not found.',
          retryable: false,
          status: 404,
        });
      }

      const updatedRows = [];

      for (const row of activeKakaoRows) {
        const link = await repository.updateUserSenderResourceLink(row.link.id, {
          isDefault: row.link.id === targetRow.link.id,
        });
        updatedRows.push({ ...row, link });
      }

      await writeAuditLog(repository, {
        actorUserId: user.id,
        action: 'sender_resource.kakao_default_changed',
        targetType: 'sender_resource',
        targetId: targetRow.resource.id,
        metadataJson: {
          senderProfileId: targetRow.link.id,
          senderKey: targetRow.resource.value,
        },
      });

      return {
        item: toKakaoChannelDto(updatedRows.find((row) => row.link.id === targetRow.link.id)),
        items: toKakaoResourcesDto(updatedRows).items,
      };
    },

    async listApplications({ actorUserId, query = {} }) {
      const user = await requireOperator(repository, actorUserId);
      const applications = await repository.listApplications({
        status: normalizeOptionalString(query.status),
        resourceType: normalizeOptionalString(query.resourceType),
      });

      return {
        applications: applications.map((row) => toOperatorApplicationDto(row)),
        operatorUserId: user.id,
      };
    },

    async lookupSmsSendNo({ actorUserId, applicationId }) {
      await requireOperator(repository, actorUserId);
      const applicationRecord = await requireApplication(repository, applicationId);
      const { application } = applicationRecord;

      if (application.resourceType !== SENDER_RESOURCE_TYPES.SMS_SEND_NO) {
        throw new RelayValidationError('applicationId must reference an SMS sender number application.');
      }

      return lookupSmsSendNoStatus({
        smsClient: requireSmsClient(smsClient),
        sendNo: application.requestedValue,
      });
    },

    async approveApplication({ actorUserId, applicationId, payload = {} }) {
      const operator = await requireOperator(repository, actorUserId);
      const applicationRecord = await requireApplication(repository, applicationId);
      const { application, evidenceFiles } = applicationRecord;

      if (application.status !== APPLICATION_STATUS.SUBMITTED) {
        throw new RelayValidationError('Only submitted applications can be approved.');
      }

      const approvalInput = await resolveApprovalInput({
        application,
        now,
        payload,
        smsClient,
      });

      const { resource, link } = await createOrActivateUserResourceLink({
        repository,
        user: applicationRecord.user,
        resourceType: application.resourceType,
        value: approvalInput.providerValue,
        displayName: approvalInput.displayName,
        providerStatus: approvalInput.providerStatus,
        metadataJson: approvalInput.metadataJson,
      });
      const reviewedAt = now();
      const updatedApplication = await repository.updateApplication(application.id, {
        status: APPLICATION_STATUS.APPROVED,
        reviewedBy: operator.id,
        reviewedAt,
        reviewMemo: normalizeOptionalString(payload.reviewMemo),
        rejectReason: null,
      });
      const evidenceDeletion = await deleteEvidenceFiles({
        repository,
        evidenceStore,
        evidenceFiles,
        deletedAt: reviewedAt,
        deletedBy: operator.id,
      });
      await writeAuditLog(repository, {
        actorUserId: operator.id,
        action: 'sender_resource_application.approved',
        targetType: 'sender_resource_application',
        targetId: application.id,
        metadataJson: {
          resourceType: application.resourceType,
          senderResourceId: resource.id,
          userSenderResourceId: link.id,
          evidenceDeletedCount: evidenceDeletion.deletedFiles.length,
          evidenceDeletePendingCount: evidenceDeletion.pendingFiles.length,
        },
      });

      return {
        application: toApplicationDto({
          application: updatedApplication,
          evidenceFiles: mergeEvidenceDeletionState(evidenceFiles, evidenceDeletion),
        }),
        resource: toUserSenderResourceDto({ resource, link }),
      };
    },

    async rejectApplication({ actorUserId, applicationId, payload = {} }) {
      const operator = await requireOperator(repository, actorUserId);
      const applicationRecord = await requireApplication(repository, applicationId);
      const { application, evidenceFiles } = applicationRecord;

      if (application.status !== APPLICATION_STATUS.SUBMITTED) {
        throw new RelayValidationError('Only submitted applications can be rejected.');
      }

      const rejectReason = normalizeRequiredString(payload.rejectReason, 'rejectReason');
      const rejectedAt = now();
      const deleteAfter = addDays(rejectedAt, REJECTED_EVIDENCE_RETENTION_DAYS);
      const updatedApplication = await repository.updateApplication(application.id, {
        status: APPLICATION_STATUS.REJECTED,
        reviewedBy: operator.id,
        reviewedAt: rejectedAt,
        reviewMemo: normalizeOptionalString(payload.reviewMemo),
        rejectReason,
      });
      await repository.updateEvidenceFiles(
        evidenceFiles.map((file) => file.id),
        {
          status: EVIDENCE_STATUS.DELETE_PENDING,
          deleteAfter,
        }
      );
      await writeAuditLog(repository, {
        actorUserId: operator.id,
        action: 'sender_resource_application.rejected',
        targetType: 'sender_resource_application',
        targetId: application.id,
        metadataJson: {
          resourceType: application.resourceType,
          evidenceRetainedCount: evidenceFiles.length,
          evidenceDeleteAfter: deleteAfter.toISOString(),
        },
      });

      return {
        application: toApplicationDto({
          application: updatedApplication,
          evidenceFiles: evidenceFiles.map((file) => ({
            ...file,
            status: EVIDENCE_STATUS.DELETE_PENDING,
            deleteAfter,
          })),
        }),
      };
    },

    async cleanupExpiredEvidence({ actorUserId = null, limit = DEFAULT_EVIDENCE_CLEANUP_LIMIT } = {}) {
      const actor = actorUserId ? await requireOperator(repository, actorUserId) : null;
      const cutoff = now();
      const evidenceFiles = await repository.listEvidenceFilesReadyForDeletion(cutoff, {
        limit: normalizeCleanupLimit(limit),
      });

      if (!evidenceFiles.length) {
        return {
          cutoff: cutoff.toISOString(),
          selectedCount: 0,
          deletedCount: 0,
          pendingCount: 0,
        };
      }

      const evidenceDeletion = await deleteEvidenceFiles({
        repository,
        evidenceStore,
        evidenceFiles,
        deletedAt: cutoff,
        deletedBy: actor?.id ?? null,
      });

      await writeAuditLog(repository, {
        actorUserId: actor?.id ?? null,
        action: 'evidence_files.cleaned_up',
        targetType: 'sender_resource_application_evidence_file',
        targetId: null,
        metadataJson: {
          cutoff: cutoff.toISOString(),
          selectedCount: evidenceFiles.length,
          evidenceDeletedCount: evidenceDeletion.deletedFiles.length,
          evidenceDeletePendingCount: evidenceDeletion.pendingFiles.length,
        },
      });

      return {
        cutoff: cutoff.toISOString(),
        selectedCount: evidenceFiles.length,
        deletedCount: evidenceDeletion.deletedFiles.length,
        pendingCount: evidenceDeletion.pendingFiles.length,
      };
    },

    async downloadEvidenceFile({ actorUserId, applicationId, evidenceFileId }) {
      await requireOperator(repository, actorUserId);
      const applicationRecord = await requireApplication(repository, applicationId);
      const evidenceFile = applicationRecord.evidenceFiles.find((file) => file.id === evidenceFileId);

      if (!evidenceFile || evidenceFile.status === EVIDENCE_STATUS.DELETED || evidenceFile.deletedAt) {
        throw new RelayError({
          code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
          message: 'Evidence file was not found.',
          retryable: false,
          status: 404,
        });
      }

      const storedFile = await evidenceStore.readApplicationFile(evidenceFile);

      return {
        stream: storedFile.body,
        filename: normalizeDownloadFileName(evidenceFile.originalFileName),
        contentType: storedFile.contentType || evidenceFile.contentType || 'application/octet-stream',
        byteSize: storedFile.byteSize ?? evidenceFile.byteSize ?? null,
      };
    },
  };
}

async function requireActiveUser(repository, actorUserId) {
  const userId = normalizeOptionalString(actorUserId);

  if (!userId) {
    throw unauthorized();
  }

  const user = await repository.getUserById(userId);

  if (!user || user.status !== 'active') {
    throw unauthorized();
  }

  return user;
}

async function requireOperator(repository, actorUserId) {
  const user = await requireActiveUser(repository, actorUserId);

  if (!user.isOperator) {
    throw forbidden('Operator access is required.');
  }

  return user;
}

async function requireApplication(repository, applicationId) {
  const normalizedApplicationId = normalizeRequiredString(applicationId, 'applicationId');
  const application = await repository.getApplicationWithEvidence(normalizedApplicationId);

  if (!application) {
    throw new RelayError({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      message: 'Sender resource application was not found.',
      retryable: false,
      status: 404,
    });
  }

  return application;
}

async function resubmitRejectedSmsApplication({
  applicationId,
  evidenceStore,
  files,
  now,
  payload,
  repository,
  user,
}) {
  const applicationRecord = await requireApplication(repository, applicationId);
  const { application, evidenceFiles } = applicationRecord;

  if (application.userId !== user.id) {
    throw forbidden('You cannot resubmit this sender resource application.');
  }

  if (application.resourceType !== SENDER_RESOURCE_TYPES.SMS_SEND_NO) {
    throw new RelayValidationError('applicationId must reference an SMS sender number application.');
  }

  if (application.status !== APPLICATION_STATUS.REJECTED) {
    throw new RelayValidationError('Only rejected SMS sender number applications can be resubmitted.');
  }

  const requestedValue = normalizeSendNo(payload.sendNo ?? payload.requestedValue ?? application.requestedValue);
  const senderNumberType = normalizeSenderNumberType(
    payload.senderNumberType ?? payload.numberType ?? payload.type ?? application.senderNumberType
  );

  if (requestedValue !== application.requestedValue) {
    throw new RelayValidationError('Rejected applications can only be resubmitted for the same sender number.');
  }

  if (senderNumberType !== application.senderNumberType) {
    throw new RelayValidationError('Rejected applications can only be resubmitted with the same sender number type.');
  }

  await assertSmsSenderNumberNotAlreadyRegistered({
    repository,
    requestedValue,
    userId: user.id,
  });

  const pendingApplication = await repository.findSubmittedApplicationByUserValue({
    userId: user.id,
    resourceType: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
    requestedValue,
  });

  if (pendingApplication && pendingApplication.id !== application.id) {
    throw new RelayValidationError('A submitted application already exists for this sender number.');
  }

  const evidenceInputs = normalizeEvidenceInputs(payload.evidenceFiles, files);
  const replacementDocumentTypes = new Set(
    evidenceInputs
      .map((input) => input.documentType)
      .filter((documentType) => !isAdditionalEvidenceDocumentType(documentType))
  );
  const retainedEvidenceFiles = evidenceFiles.filter((file) => (
    isReusableEvidenceFile(file)
    && !replacementDocumentTypes.has(file.documentType)
  ));

  validateSmsEvidenceInputs({
    senderNumberType,
    evidenceInputs,
    existingEvidenceFiles: retainedEvidenceFiles,
  });

  const resubmittedAt = now();
  const replacedEvidenceFiles = evidenceFiles.filter((file) => (
    isReusableEvidenceFile(file)
    && replacementDocumentTypes.has(file.documentType)
  ));
  let storedEvidence = [];

  try {
    if (evidenceInputs.length) {
      storedEvidence = await evidenceStore.storeApplicationFiles({
        applicationId: application.id,
        userId: user.id,
        files: evidenceInputs.map((input) => input.file),
      });
      await repository.createEvidenceFiles(
        storedEvidence.map((file, index) => toEvidenceInsert(
          file,
          application.id,
          user.id,
          evidenceInputs[index].documentType
        ))
      );
    }

    if (retainedEvidenceFiles.length) {
      await repository.updateEvidenceFiles(
        retainedEvidenceFiles.map((file) => file.id),
        {
          status: EVIDENCE_STATUS.ACTIVE,
          deleteAfter: null,
          deletedAt: null,
          deletedBy: null,
        }
      );
    }

    if (replacedEvidenceFiles.length) {
      await repository.updateEvidenceFiles(
        replacedEvidenceFiles.map((file) => file.id),
        {
          status: EVIDENCE_STATUS.DELETE_PENDING,
          deleteAfter: addDays(resubmittedAt, REJECTED_EVIDENCE_RETENTION_DAYS),
        }
      );
    }

    await repository.updateApplication(application.id, {
      status: APPLICATION_STATUS.SUBMITTED,
      reviewedBy: null,
      reviewedAt: null,
      reviewMemo: normalizeOptionalString(payload.reviewMemo),
      rejectReason: null,
    });
  } catch (error) {
    if (storedEvidence.length) {
      try {
        await evidenceStore.deleteApplicationFiles(storedEvidence);
      } catch {
        // Keep the original resubmission failure as the user-facing error.
      }
    }

    throw error;
  }

  const updatedRecord = await requireApplication(repository, application.id);

  await writeAuditLog(repository, {
    actorUserId: user.id,
    action: 'sender_resource_application.resubmitted',
    targetType: 'sender_resource_application',
    targetId: application.id,
    metadataJson: {
      resourceType: application.resourceType,
      retainedEvidenceCount: retainedEvidenceFiles.length,
      replacedEvidenceCount: replacedEvidenceFiles.length,
      uploadedEvidenceCount: evidenceInputs.length,
    },
  });

  return toApplicationDto(updatedRecord);
}

async function assertSmsSenderNumberNotAlreadyRegistered({ repository, requestedValue, userId }) {
  const resourceRows = await repository.listUserSenderResources(userId);
  const activeDuplicate = resourceRows
    .filter(isActiveUserResourceRow)
    .find((row) => (
      row.resource?.type === SENDER_RESOURCE_TYPES.SMS_SEND_NO
      && normalizeSendNo(row.resource.value) === requestedValue
    ));

  if (activeDuplicate) {
    throw new RelayValidationError('이미 등록된 발신번호입니다.');
  }
}

async function createOrActivateUserResourceLink({
  repository,
  user,
  resourceType,
  value,
  displayName,
  providerStatus,
  metadataJson,
}) {
  let resource = await repository.findSenderResource({
    provider: PROVIDERS.NHN,
    type: resourceType,
    value,
  });

  if (!resource) {
    resource = await repository.createSenderResource({
      resourceRef: createShortRef('sr'),
      provider: PROVIDERS.NHN,
      type: resourceType,
      value,
      displayName: resolveSenderResourceDisplayName({ displayName, resourceType, value }),
      status: RESOURCE_STATUS.ACTIVE,
      providerStatus,
      metadataJson,
    });
  }

  const billingAccount = await repository.findBillingAccountForUser(user.id);
  const shouldUseDefault = await shouldUseDefaultSenderResourceLink({
    repository,
    resourceType,
    senderResourceId: resource.id,
    userId: user.id,
  });
  let link = await repository.findUserSenderResourceLink({
    userId: user.id,
    senderResourceId: resource.id,
  });

  if (link) {
    link = await repository.updateUserSenderResourceLink(link.id, {
      status: LINK_STATUS.ACTIVE,
      role: 'owner',
      billingAccountId: link.billingAccountId ?? billingAccount?.id ?? null,
      isDefault: link.isDefault || shouldUseDefault,
    });
  } else {
    link = await repository.createUserSenderResourceLink({
      userId: user.id,
      senderResourceId: resource.id,
      billingAccountId: billingAccount?.id ?? null,
      role: 'owner',
      status: LINK_STATUS.ACTIVE,
      isDefault: shouldUseDefault,
    });
  }

  return { resource, link };
}

function resolveSenderResourceDisplayName({ displayName, resourceType, value }) {
  if (resourceType === SENDER_RESOURCE_TYPES.SMS_SEND_NO) {
    return null;
  }

  return displayName || value;
}

async function shouldUseDefaultSenderResourceLink({ repository, resourceType, senderResourceId, userId }) {
  if (!DEFAULTABLE_RESOURCE_TYPES.has(resourceType)) {
    return false;
  }

  const resourceRows = await repository.listUserSenderResources(userId);
  const activeRows = resourceRows.filter((row) => (
    row.link?.status === LINK_STATUS.ACTIVE
    && row.resource?.status === RESOURCE_STATUS.ACTIVE
    && row.resource?.type === resourceType
  ));

  if (activeRows.some((row) => row.link?.isDefault)) {
    return false;
  }

  return activeRows.every((row) => row.resource?.id === senderResourceId);
}

function withSingleSmsSenderDefault(resourceRows) {
  const activeSmsRows = resourceRows.filter((row) => row.resource?.type === SENDER_RESOURCE_TYPES.SMS_SEND_NO);

  if (activeSmsRows.length !== 1 || activeSmsRows[0].link?.isDefault) {
    return resourceRows;
  }

  return resourceRows.map((row) => {
    if (row.link?.id !== activeSmsRows[0].link?.id) {
      return row;
    }

    return {
      ...row,
      link: {
        ...row.link,
        isDefault: true,
      },
    };
  });
}

async function resolveVerifiedSender({ kakaoClient, providerResponse, plusFriendId, fallbackSenderKey }) {
  const responseSender = extractSender(providerResponse);

  if (responseSender?.senderKey) {
    return responseSender;
  }

  const senderKey = normalizeOptionalString(fallbackSenderKey);

  if (senderKey) {
    return { ...responseSender, senderKey, plusFriendId };
  }

  const listResponse = await kakaoClient.listSenders({ plusFriendId });
  const listedSender = extractSender(listResponse);

  if (listedSender?.senderKey) {
    return listedSender;
  }

  throw new RelayValidationError('NHN sender verification did not return a senderKey.');
}

async function assertKakaoSenderNotAlreadyLinked({ repository, userId, senderKey, plusFriendId }) {
  const normalizedSenderKey = normalizeRequiredString(senderKey, 'senderKey');
  const normalizedPlusFriendId = normalizeKakaoPlusFriendIdForComparison(plusFriendId);
  const resourceRows = await repository.listUserSenderResources(userId);
  const duplicate = resourceRows
    .filter(isActiveUserResourceRow)
    .find(({ resource }) => {
      if (resource?.type !== SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY) {
        return false;
      }

      if (normalizeOptionalString(resource.value) === normalizedSenderKey) {
        return true;
      }

      return normalizedPlusFriendId
        && normalizeKakaoPlusFriendIdForComparison(getKakaoResourcePlusFriendId(resource)) === normalizedPlusFriendId;
    });

  if (duplicate) {
    throw new RelayValidationError('이미 등록된 카카오 채널입니다.');
  }
}

async function syncDefaultKakaoSenderGroup({
  repository,
  kakaoClient,
  actorUserId,
  senderResourceId,
  senderKey,
  groupSenderKey,
}) {
  const normalizedGroupSenderKey = normalizeOptionalString(groupSenderKey);

  if (!normalizedGroupSenderKey) {
    return { configured: false, added: false };
  }

  try {
    await kakaoClient.addSenderToGroup({ groupSenderKey: normalizedGroupSenderKey, senderKey });
    return { configured: true, added: true, groupSenderKey: normalizedGroupSenderKey };
  } catch (error) {
    await writeAuditLog(repository, {
      actorUserId,
      action: 'sender_resource.kakao_group_sync_failed',
      targetType: 'sender_resource',
      targetId: senderResourceId,
      metadataJson: {
        groupSenderKey: normalizedGroupSenderKey,
        ...toSafeProviderErrorMetadata(error),
      },
    });

    return {
      configured: true,
      added: false,
      groupSenderKey: normalizedGroupSenderKey,
      error: toSafeProviderErrorMetadata(error),
    };
  }
}

async function markEvidenceDeleted({ repository, evidenceFiles, deletedAt, deletedBy }) {
  if (!evidenceFiles.length) {
    return [];
  }

  await repository.updateEvidenceFiles(
    evidenceFiles.map((file) => file.id),
    {
      status: EVIDENCE_STATUS.DELETED,
      deletedAt,
      deletedBy,
    }
  );
}

async function deleteEvidenceFiles({ repository, evidenceStore, evidenceFiles, deletedAt, deletedBy }) {
  if (!evidenceFiles.length) {
    return { deletedFiles: [], pendingFiles: [], results: [] };
  }

  const results = await evidenceStore.deleteApplicationFiles(evidenceFiles);
  const deletedFiles = [];
  const pendingFiles = [];

  for (const [index, file] of evidenceFiles.entries()) {
    if (results[index]?.deleted) {
      deletedFiles.push(file);
    } else {
      pendingFiles.push(file);
    }
  }

  await markEvidenceDeleted({ repository, evidenceFiles: deletedFiles, deletedAt, deletedBy });

  if (pendingFiles.length) {
    await repository.updateEvidenceFiles(
      pendingFiles.map((file) => file.id),
      {
        status: EVIDENCE_STATUS.DELETE_PENDING,
        deleteAfter: deletedAt,
      }
    );
  }

  return { deletedFiles, pendingFiles, results };
}

function mergeEvidenceDeletionState(evidenceFiles, evidenceDeletion) {
  const deletedIds = new Set(evidenceDeletion.deletedFiles.map((file) => file.id));
  const pendingIds = new Set(evidenceDeletion.pendingFiles.map((file) => file.id));

  return evidenceFiles.map((file) => {
    if (deletedIds.has(file.id)) {
      return { ...file, status: EVIDENCE_STATUS.DELETED };
    }

    if (pendingIds.has(file.id)) {
      return { ...file, status: EVIDENCE_STATUS.DELETE_PENDING };
    }

    return file;
  });
}

function normalizeCleanupLimit(value) {
  const limit = Number(value);

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw new RelayValidationError('limit must be an integer between 1 and 1000.');
  }

  return limit;
}

async function writeAuditLog(repository, values) {
  return repository.createAuditLog({
    actorUserId: values.actorUserId,
    action: values.action,
    targetType: values.targetType,
    targetId: values.targetId,
    metadataJson: sanitizeAuditMetadata(values.metadataJson ?? {}),
  });
}

function normalizeKakaoRegistrationPayload(payload) {
  return {
    plusFriendId: normalizeRequiredString(payload.plusFriendId, 'plusFriendId'),
    phoneNo: normalizeRequiredString(payload.phoneNo, 'phoneNo'),
    categoryCode: normalizeRequiredString(payload.categoryCode, 'categoryCode'),
  };
}

async function resolveApprovalInput({ application, now, payload, smsClient }) {
  if (application.resourceType !== SENDER_RESOURCE_TYPES.SMS_SEND_NO) {
    return {
      displayName: normalizeOptionalString(payload.displayName),
      metadataJson: normalizeMetadata(payload.metadataJson),
      providerStatus: normalizeOptionalString(payload.providerStatus) || 'approved',
      providerValue: normalizeRequiredString(payload.providerValue ?? application.requestedValue, 'providerValue'),
    };
  }

  const providerValue = normalizeSendNo(payload.providerValue ?? application.requestedValue);
  const lookup = await lookupSmsSendNoStatus({
    smsClient: requireSmsClient(smsClient),
    sendNo: providerValue,
  });

  if (!lookup.usable) {
    throw new RelayValidationError(getSmsSendNoApprovalBlockMessage(lookup));
  }

  const baseMetadata = normalizeMetadata(payload.metadataJson) ?? {};

  return {
    displayName: null,
    metadataJson: {
      ...baseMetadata,
      nhn: {
        ...(baseMetadata.nhn && typeof baseMetadata.nhn === 'object' && !Array.isArray(baseMetadata.nhn)
          ? baseMetadata.nhn
          : {}),
        sendNo: lookup.sendNo,
        serviceId: lookup.row?.serviceId ?? null,
        useYn: lookup.row?.useYn ?? null,
        blockYn: lookup.row?.blockYn ?? null,
        checkedAt: now().toISOString(),
      },
    },
    providerStatus: 'approved',
    providerValue,
  };
}

async function lookupSmsSendNoStatus({ smsClient, sendNo }) {
  const normalizedSendNo = normalizeSendNo(sendNo);
  const providerResponse = await smsClient.listSendNos({
    sendNo: normalizedSendNo,
    pageNum: 1,
    pageSize: 15,
  });
  const rows = extractSendNoRows(providerResponse);
  const row = rows.find((item) => normalizeSendNoDigits(item?.sendNo) === normalizedSendNo) ?? null;
  const useYn = normalizeNhnYn(row?.useYn);
  const blockYn = normalizeNhnYn(row?.blockYn);
  const usable = Boolean(row && useYn === 'Y' && blockYn === 'N');

  return {
    sendNo: normalizedSendNo,
    status: getSmsSendNoLookupStatus({ row, useYn, blockYn }),
    usable,
    row: row ? toNhnSendNoRowDto(row) : null,
    provider: {
      ...toProviderResult(providerResponse),
      totalCount: providerResponse?.body?.totalCount ?? null,
    },
  };
}

function extractSendNoRows(providerResponse) {
  const data = providerResponse?.body?.data ?? providerResponse?.data ?? [];
  return Array.isArray(data) ? data : [];
}

function getSmsSendNoLookupStatus({ row, useYn, blockYn }) {
  if (!row) {
    return 'not_registered';
  }

  if (useYn === 'Y' && blockYn === 'N') {
    return 'usable';
  }

  if (blockYn === 'Y') {
    return 'blocked';
  }

  return 'unusable';
}

function getSmsSendNoApprovalBlockMessage(lookup) {
  if (lookup.status === 'not_registered') {
    return 'NHN에 등록된 발신번호를 찾지 못했습니다.';
  }

  if (lookup.status === 'blocked') {
    return 'NHN에서 차단된 발신번호는 승인할 수 없습니다.';
  }

  return 'NHN에서 사용 가능한 발신번호로 확인되지 않았습니다.';
}

function toNhnSendNoRowDto(row) {
  return {
    serviceId: row.serviceId ?? null,
    sendNo: normalizeSendNoDigits(row.sendNo) || String(row.sendNo ?? ''),
    useYn: normalizeNhnYn(row.useYn),
    blockYn: normalizeNhnYn(row.blockYn),
    blockReason: row.blockReason ?? null,
    createDate: row.createDate ?? null,
    createUser: row.createUser ?? null,
    updateDate: row.updateDate ?? null,
    updateUser: row.updateUser ?? null,
  };
}

function normalizeNhnYn(value) {
  const normalized = normalizeOptionalString(value)?.toUpperCase();
  return normalized === 'Y' || normalized === 'N' ? normalized : null;
}

function normalizeSendNoDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function requireSmsClient(smsClient) {
  if (!smsClient || typeof smsClient.listSendNos !== 'function') {
    throw new Error('smsClient.listSendNos is required for SMS sender number approval.');
  }

  return smsClient;
}

function normalizeSendNo(value) {
  const sendNo = normalizeRequiredString(value, 'sendNo').replace(/[\s-]/g, '');

  if (!/^\+?[0-9]{7,20}$/.test(sendNo)) {
    throw new RelayValidationError('sendNo must be a plausible sender phone number.');
  }

  return sendNo;
}

function normalizeSenderNumberType(value) {
  const normalized = normalizeRequiredString(value, 'senderNumberType');
  const mapped = SENDER_NUMBER_TYPE_ALIASES[normalized];

  if (!mapped) {
    throw new RelayValidationError('senderNumberType must be personal or company.');
  }

  return mapped;
}

function normalizeEvidenceInputs(payloadEvidenceFiles, requestFiles) {
  if (payloadEvidenceFiles !== undefined && !Array.isArray(payloadEvidenceFiles)) {
    throw new RelayValidationError('evidenceFiles must be an array.');
  }

  const metadata = Array.isArray(payloadEvidenceFiles) ? payloadEvidenceFiles : [];
  const inputs = [];

  for (const [index, requestFile] of (Array.isArray(requestFiles) ? requestFiles : []).entries()) {
    const fileInput = normalizeRequestFileInput(requestFile);
    const metadataDocumentType = metadata[index]?.documentType ?? metadata[index]?.fieldName;
    inputs.push({
      documentType: normalizeEvidenceDocumentType(
        fileInput.documentType ?? fileInput.fieldName ?? metadataDocumentType
      ),
      file: fileInput.file,
    });
  }

  for (const item of metadata) {
    if (isMetadataOnlyEvidenceDescriptor(item)) {
      continue;
    }

    const descriptorInput = normalizeEvidenceDescriptorInput(item);
    inputs.push({
      documentType: normalizeEvidenceDocumentType(descriptorInput.documentType ?? descriptorInput.fieldName),
      file: descriptorInput.file,
    });
  }

  return inputs;
}

function normalizeRequestFileInput(value) {
  if (isFileLike(value)) {
    return { file: value };
  }

  if (value && typeof value === 'object' && isFileLike(value.file)) {
    return {
      documentType: value.documentType,
      fieldName: value.fieldName,
      file: value.file,
    };
  }

  throw new RelayValidationError('Evidence file uploads must be files.');
}

function normalizeEvidenceDescriptorInput(value) {
  if (isFileLike(value)) {
    return { file: value };
  }

  if (value && typeof value === 'object' && isFileLike(value.file)) {
    return {
      documentType: value.documentType,
      fieldName: value.fieldName,
      file: value.file,
    };
  }

  if (value && typeof value === 'object' && (value.r2ObjectKey || value.objectKey)) {
    return {
      documentType: value.documentType,
      fieldName: value.fieldName,
      file: value,
    };
  }

  throw new RelayValidationError('Evidence file metadata must reference an uploaded file or private object key.');
}

function isMetadataOnlyEvidenceDescriptor(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && !isFileLike(value)
    && !isFileLike(value.file)
    && !value.r2ObjectKey
    && !value.objectKey
  );
}

function normalizeEvidenceDocumentType(value) {
  const normalized = normalizeRequiredString(value, 'documentType');
  const mapped = EVIDENCE_DOCUMENT_TYPE_ALIASES[normalized];

  if (!mapped) {
    throw new RelayValidationError(`Unsupported evidence document type: ${normalized}.`);
  }

  return mapped;
}

function validateSmsEvidenceInputs({ senderNumberType, evidenceInputs, existingEvidenceFiles = [] }) {
  if (!evidenceInputs.length && !existingEvidenceFiles.length) {
    throw new RelayValidationError('SMS sender number applications require evidence files.');
  }

  const seen = new Set();

  for (const file of existingEvidenceFiles) {
    if (!isAdditionalEvidenceDocumentType(file.documentType)) {
      seen.add(file.documentType);
    }
  }

  for (const input of evidenceInputs) {
    if (!isAdditionalEvidenceDocumentType(input.documentType) && seen.has(input.documentType)) {
      throw new RelayValidationError(`Evidence document type ${input.documentType} was submitted more than once.`);
    }

    if (!isAdditionalEvidenceDocumentType(input.documentType)) {
      seen.add(input.documentType);
    }

    validateEvidenceFilePolicy(input);
  }

  const missing = REQUIRED_SMS_EVIDENCE_DOCUMENTS[senderNumberType].filter((documentType) => !seen.has(documentType));

  if (missing.length) {
    throw new RelayValidationError(`Missing required evidence document: ${missing[0]}.`);
  }
}

function isAdditionalEvidenceDocumentType(documentType) {
  return documentType === EVIDENCE_DOCUMENT_TYPES.ADDITIONAL_DOCUMENT;
}

function isReusableEvidenceFile(file) {
  return Boolean(file && file.status !== EVIDENCE_STATUS.DELETED && !file.deletedAt);
}

function validateEvidenceFilePolicy({ file }) {
  const filename = getEvidenceFileName(file);
  const extension = getFileExtension(filename);

  if (!ALLOWED_EVIDENCE_EXTENSIONS.has(extension)) {
    throw new RelayValidationError('Evidence files must be PDF, JPG, JPEG, or PNG.');
  }

  const byteSize = Number(file.size ?? file.byteSize);

  if (Number.isFinite(byteSize) && byteSize > MAX_EVIDENCE_FILE_BYTES) {
    throw new RelayValidationError('Evidence files must be 5MB or smaller.');
  }
}

function getEvidenceFileName(file) {
  const filename = normalizeOptionalString(
    file?.name ?? file?.originalFileName ?? file?.r2ObjectKey ?? file?.objectKey
  );

  if (!filename) {
    throw new RelayValidationError('Evidence files must include a filename.');
  }

  return filename;
}

function getFileExtension(filename) {
  const extension = String(filename).split('.').pop()?.toLowerCase();
  return extension === filename ? '' : extension;
}

function isFileLike(value) {
  return value && typeof value === 'object' && typeof value.arrayBuffer === 'function';
}

function normalizeIntegerToken(value) {
  const token = Number(value);

  if (!Number.isSafeInteger(token) || token < 0) {
    throw new RelayValidationError('token must be a non-negative integer.');
  }

  return token;
}

function normalizeMetadata(value) {
  if (value === undefined || value === null) return null;

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new RelayValidationError('metadataJson must be an object.');
  }

  return sanitizeAuditMetadata(value);
}

function normalizeRequiredString(value, name) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    throw new RelayValidationError(`${name} is required.`);
  }

  return normalized;
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeKakaoPlusFriendIdForComparison(value) {
  return normalizeOptionalString(value)?.toLowerCase() ?? null;
}

function normalizeDownloadFileName(value) {
  const filename = normalizeOptionalString(value)?.replace(/[/\\"<>:|?*\x00-\x1F]/g, '-') ?? 'evidence-file';
  return filename.slice(0, 120) || 'evidence-file';
}

function toEvidenceInsert(file, applicationId, uploadedBy, documentType) {
  return {
    applicationId,
    r2Bucket: file.r2Bucket,
    r2ObjectKey: file.r2ObjectKey,
    originalFileName: file.originalFileName,
    documentType,
    contentType: file.contentType,
    byteSize: file.byteSize,
    checksumSha256: file.checksumSha256,
    status: EVIDENCE_STATUS.ACTIVE,
    uploadedBy,
  };
}

function toUserSenderResourceDto({ link, resource }) {
  return {
    id: link.id,
    userId: link.userId,
    senderResourceId: resource.id,
    billingAccountId: link.billingAccountId,
    role: link.role,
    status: link.status,
    isDefault: link.isDefault,
    resource: {
      id: resource.id,
      resourceRef: resource.resourceRef,
      provider: resource.provider,
      type: resource.type,
      value: resource.value,
      displayName: resource.type === SENDER_RESOURCE_TYPES.SMS_SEND_NO ? null : resource.displayName,
      status: resource.status,
      providerStatus: resource.providerStatus,
      metadataJson: resource.metadataJson,
    },
  };
}

function isActiveUserResourceRow({ link, resource }) {
  return link.status === LINK_STATUS.ACTIVE && resource?.status === RESOURCE_STATUS.ACTIVE;
}

function toApplicationDto({ application, evidenceFiles = [] }) {
  return {
    id: application.id,
    userId: application.userId,
    resourceType: application.resourceType,
    requestedValue: application.requestedValue,
    senderNumberType: application.senderNumberType,
    status: application.status,
    reviewedBy: application.reviewedBy,
    reviewedAt: application.reviewedAt,
    reviewMemo: application.reviewMemo,
    rejectReason: application.rejectReason,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    evidenceFiles: evidenceFiles.map(toEvidenceFileDto),
  };
}

function toOperatorApplicationDto({ application, user, evidenceFiles }) {
  return {
    ...toApplicationDto({ application, evidenceFiles }),
    user: {
      id: user.id,
      userRef: user.userRef,
      email: user.email,
      name: user.name,
      status: user.status,
    },
  };
}

function toEvidenceFileDto(file) {
  return {
    id: file.id,
    applicationId: file.applicationId,
    originalFileName: file.originalFileName,
    documentType: file.documentType,
    contentType: file.contentType,
    byteSize: file.byteSize,
    checksumSha256: file.checksumSha256,
    status: file.status,
    deleteAfter: file.deleteAfter,
    deletedAt: file.deletedAt,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

function toProviderResult(providerResponse) {
  const header = providerResponse?.header;

  return {
    resultCode: header?.resultCode ?? null,
    resultMessage: header?.resultMessage ?? null,
    isSuccessful: header?.isSuccessful ?? null,
  };
}

function extractSender(providerResponse) {
  if (!providerResponse || typeof providerResponse !== 'object') return null;

  if (providerResponse.sender && typeof providerResponse.sender === 'object') {
    return providerResponse.sender;
  }

  if (providerResponse.body?.sender && typeof providerResponse.body.sender === 'object') {
    return providerResponse.body.sender;
  }

  if (providerResponse.data?.sender && typeof providerResponse.data.sender === 'object') {
    return providerResponse.data.sender;
  }

  const senders = providerResponse.senders || providerResponse.body?.senders || providerResponse.data?.senders;

  if (Array.isArray(senders)) {
    return senders[0] ?? null;
  }

  return null;
}

function deriveKakaoProviderStatus(sender) {
  if (sender.block || sender.kakaoProfileStatus === 'B') return 'blocked';
  if (sender.dormant || ['C', 'D', 'E'].includes(sender.kakaoProfileStatus)) return 'dormant';
  if (sender.status === 'YSC03' || sender.kakaoProfileStatus === 'A') return 'active';
  return normalizeOptionalString(sender.statusName || sender.status || sender.kakaoProfileStatusName) || 'verified';
}

function toKakaoResourcesDto(rows) {
  const items = rows.map(toKakaoChannelDto);

  return {
    readiness: getKakaoReadiness(items),
    items,
  };
}

function toKakaoChannelDto({ link, resource }) {
  const metadata = resource.metadataJson && typeof resource.metadataJson === 'object' && !Array.isArray(resource.metadataJson)
    ? resource.metadataJson
    : {};

  return {
    id: link.id,
    senderResourceId: resource.id,
    plusFriendId: getKakaoResourcePlusFriendId(resource),
    senderKey: resource.value,
    senderProfileType: normalizeOptionalString(metadata.senderProfileType) || 'alimtalk',
    categoryCode: normalizeOptionalString(metadata.categoryCode),
    status: normalizeKakaoLocalStatus(resource.providerStatus),
    providerStatus: resource.providerStatus,
    isDefault: link.isDefault,
    createdAt: resource.createdAt ?? link.createdAt ?? null,
    updatedAt: resource.updatedAt ?? link.updatedAt ?? null,
  };
}

function getKakaoResourcePlusFriendId(resource) {
  const metadata = resource?.metadataJson && typeof resource.metadataJson === 'object' && !Array.isArray(resource.metadataJson)
    ? resource.metadataJson
    : {};

  return normalizeOptionalString(metadata.plusFriendId) || resource?.displayName || resource?.value || '';
}

function getKakaoReadiness(items) {
  const counts = items.reduce(
    (current, item) => {
      if (item.status === 'ACTIVE') current.activeCount += 1;
      else if (item.status === 'BLOCKED') current.blockedCount += 1;
      else if (item.status === 'DORMANT') current.dormantCount += 1;
      else current.unknownCount += 1;

      return current;
    },
    { activeCount: 0, blockedCount: 0, dormantCount: 0, unknownCount: 0 }
  );

  return {
    status: items.length > 0 ? 'ready' : 'empty',
    totalCount: items.length,
    ...counts,
  };
}

function normalizeKakaoLocalStatus(value) {
  const normalized = normalizeOptionalString(value)?.toLowerCase();

  if (normalized === 'active' || normalized === 'verified' || normalized === 'ysc03') return 'ACTIVE';
  if (normalized === 'blocked' || normalized === 'block') return 'BLOCKED';
  if (normalized === 'dormant') return 'DORMANT';
  return 'UNKNOWN';
}

function extractKakaoCategories(providerResponse) {
  const candidates = [
    providerResponse?.categories,
    providerResponse?.body?.categories,
    providerResponse?.data?.categories,
  ];

  return candidates.find(Array.isArray) ?? [];
}

function mapKakaoConnectCategories(categories, parentCode = '') {
  return categories.flatMap((category) => {
    if (!category || typeof category !== 'object') {
      return [];
    }

    const rawCode = normalizeOptionalString(category.code);
    const label = normalizeOptionalString(category.name ?? category.label);
    const childCategories = Array.isArray(category.subCategories)
      ? category.subCategories
      : Array.isArray(category.children)
        ? category.children
        : [];

    if (!rawCode || !label) {
      return mapKakaoConnectCategories(childCategories, parentCode);
    }

    const code = rawCode.startsWith(parentCode) ? rawCode : `${parentCode}${rawCode}`;

    return [{
      code,
      label,
      depth: Number.isInteger(category.depth) ? category.depth : null,
      children: mapKakaoConnectCategories(childCategories, code),
    }];
  });
}

function requireKakaoClient(client) {
  if (!client || typeof client.listSenderCategories !== 'function') {
    throw new Error('kakaoClient.listSenderCategories is required for Kakao channel bootstrap.');
  }

  return client;
}

function toSafeProviderErrorMetadata(error) {
  if (error instanceof NhnProviderError) {
    const details = extractProviderDetails(error);
    return {
      providerCode: details.providerCode ? String(details.providerCode) : null,
      providerMessage: details.providerMessage ? String(details.providerMessage) : null,
    };
  }

  return {
    providerCode: null,
    providerMessage: error?.message ? String(error.message) : null,
  };
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function createShortRef(prefix) {
  return `${prefix}_${randomBytes(9).toString('base64url')}`.slice(0, 20);
}

function unauthorized() {
  return new RelayError({
    code: RELAY_ERROR_CODES.UNAUTHORIZED,
    message: 'Authentication is required.',
    retryable: false,
    status: 401,
  });
}

function forbidden(message) {
  return new RelayError({
    code: RELAY_ERROR_CODES.FORBIDDEN,
    message,
    retryable: false,
    status: 403,
  });
}

function createLazyNhnKakaoBizmessageClient() {
  let client;

  function getClient() {
    if (!client) {
      client = createNhnKakaoBizmessageClient({ config: resolveNhnKakaoBizmessageConfig() });
    }

    return client;
  }

  return {
    registerSender: (...args) => getClient().registerSender(...args),
    verifySenderToken: (...args) => getClient().verifySenderToken(...args),
    listSenderCategories: (...args) => getClient().listSenderCategories(...args),
    addSenderToGroup: (...args) => getClient().addSenderToGroup(...args),
    getSender: (...args) => getClient().getSender(...args),
    getSenderGroup: (...args) => getClient().getSenderGroup(...args),
    listSenders: (...args) => getClient().listSenders(...args),
  };
}

function createLazyNhnSmsClient() {
  let client;

  function getClient() {
    if (!client) {
      client = createNhnSmsClient();
    }

    return client;
  }

  return {
    listSendNos: (...args) => getClient().listSendNos(...args),
  };
}
