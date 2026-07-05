import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { sanitizeAuditMetadata } from '../audit/service.js';
import { closeDb } from '../../db/client.js';
import { NhnProviderError } from '../relay/errors.js';
import { RELAY_ERROR_CODES, SENDER_RESOURCE_TYPES } from '../relay/constants.js';
import {
  createDefaultSenderResourceApprovalService,
  createSenderResourceApprovalService,
} from '../senderResources/service.js';
import { createEvidenceStore } from '../storage/evidenceStore.js';

const FIXED_NOW = new Date('2026-06-02T00:00:00.000Z');
const PERSONAL_SENDER_NUMBER_TYPE = 'personal';
const COMPANY_SENDER_NUMBER_TYPE = 'company';
const PERSONAL_EVIDENCE_DOCUMENT_TYPES = [
  'telecom_certificate',
  'consent_document',
  'id_card_copy',
];
const COMPANY_EVIDENCE_DOCUMENT_TYPES = [
  'telecom_certificate',
  'consent_document',
  'business_registration',
  'relationship_proof',
];

describe('sender resource approval service', () => {
  it('does not require evidence storage config when creating the default read service', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@example.com:5432/app');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('EVIDENCE_STORAGE_DRIVER', '');
    vi.stubEnv('R2_ENDPOINT_URL', '');
    vi.stubEnv('R2_ACCESS_KEY_ID', '');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', '');
    vi.stubEnv('R2_EVIDENCE_BUCKET', '');

    try {
      expect(() => createDefaultSenderResourceApprovalService()).not.toThrow();
    } finally {
      vi.unstubAllEnvs();
      await closeDb();
    }
  });

  it('uploads File evidence to R2 with a signed application-scoped PUT', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const store = createR2TestStore(fetchImpl);
    const [record] = await store.storeApplicationFiles({
      applicationId: 'app_1',
      userId: 'user_1',
      files: [
        createFileLike({
          name: 'registration.pdf',
          type: 'application/pdf',
          content: 'private registration content',
        }),
      ],
    });

    expect(record).toMatchObject({
      r2Bucket: 'private-evidence',
      originalFileName: 'registration.pdf',
      contentType: 'application/pdf',
      byteSize: 28,
      checksumSha256: createHash('sha256').update('private registration content').digest('hex'),
    });
    expect(record.r2ObjectKey).toMatch(/^sender-resource-evidence\/app_1\/.+-registration\.pdf$/);
    expect(JSON.stringify(record)).not.toContain('private registration content');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain('/private-evidence/sender-resource-evidence/app_1/');
    expect(init.method).toBe('PUT');
    expect(Buffer.isBuffer(init.body)).toBe(true);
    expect(init.headers.Authorization).toContain('Credential=access-key/20260602/auto/s3/aws4_request');
    expect(init.headers['content-type']).toBe('application/pdf');
    expect(init.headers['x-amz-content-sha256']).toBe(
      createHash('sha256').update('private registration content').digest('hex')
    );
    expect(String(url)).not.toContain('secret-key');
    expect(JSON.stringify(init.headers)).not.toContain('secret-key');
  });

  it('scopes R2 evidence object keys under the configured private prefix', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const store = createR2TestStore(fetchImpl, {
      objectKeyPrefix: 'dev/sender-resource-evidence',
    });

    const [record] = await store.storeApplicationFiles({
      applicationId: 'app_1',
      userId: 'user_1',
      files: [createFileLike({ name: 'registration.pdf' })],
    });

    expect(store.objectKeyPrefix).toBe('dev/sender-resource-evidence');
    expect(record.r2ObjectKey).toMatch(/^dev\/sender-resource-evidence\/app_1\/.+-registration\.pdf$/);

    const [url] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain('/private-evidence/dev/sender-resource-evidence/app_1/');
  });

  it('submits SMS sender number applications with private evidence metadata', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });

    const result = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: {
        sendNo: '1544-6859',
        senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
        evidenceFiles: createPersonalEvidenceDescriptors(),
      },
    });

    expect(result).toMatchObject({
      userId: 'user_1',
      resourceType: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
      requestedValue: '15446859',
      senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
      status: 'submitted',
      evidenceFiles: expect.arrayContaining([
        expect.objectContaining({
          documentType: 'telecom_certificate',
          originalFileName: 'registration.pdf',
          status: 'active',
        }),
      ]),
    });
    expect(result.evidenceFiles[0].r2ObjectKey).toBeUndefined();
  });

  it('submits company SMS sender number applications with third-party evidence documents', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });

    const result = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: {
        sendNo: '1544-6859',
        senderNumberType: COMPANY_SENDER_NUMBER_TYPE,
        evidenceFiles: createCompanyEvidenceDescriptors(),
      },
    });

    expect(result).toMatchObject({
      requestedValue: '15446859',
      senderNumberType: COMPANY_SENDER_NUMBER_TYPE,
      status: 'submitted',
      evidenceFiles: expect.arrayContaining([
        expect.objectContaining({ documentType: 'business_registration' }),
        expect.objectContaining({ documentType: 'relationship_proof' }),
      ]),
    });
  });

  it('rejects missing required SMS evidence documents', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });

    await expect(
      service.submitSmsApplication({
        actorUserId: 'user_1',
        payload: {
          sendNo: '1544-6859',
          senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
          evidenceFiles: createPersonalEvidenceDescriptors().filter((item) => item.documentType !== 'id_card_copy'),
        },
      })
    ).rejects.toThrow('Missing required evidence document: id_card_copy.');
  });

  it('rejects duplicate evidence document types in one SMS application', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });
    const evidenceFiles = createPersonalEvidenceDescriptors();

    await expect(
      service.submitSmsApplication({
        actorUserId: 'user_1',
        payload: {
          sendNo: '1544-6859',
          senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
          evidenceFiles: [
            ...evidenceFiles,
            { ...evidenceFiles[0], objectKey: 'private/duplicate-registration.pdf' },
          ],
        },
      })
    ).rejects.toThrow('Evidence document type telecom_certificate was submitted more than once.');
  });

  it('rejects unsupported evidence file extensions and files over 5MB', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });

    await expect(
      service.submitSmsApplication({
        actorUserId: 'user_1',
        payload: {
          sendNo: '1544-6859',
          senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
          evidenceFiles: [
            {
              ...createPersonalEvidenceDescriptors()[0],
              objectKey: 'private/registration.txt',
              originalFileName: 'registration.txt',
            },
            ...createPersonalEvidenceDescriptors().slice(1),
          ],
        },
      })
    ).rejects.toThrow('Evidence files must be PDF, JPG, JPEG, or PNG.');

    await expect(
      service.submitSmsApplication({
        actorUserId: 'user_1',
        payload: {
          sendNo: '1544-6859',
          senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
          evidenceFiles: [
            {
              ...createPersonalEvidenceDescriptors()[0],
              byteSize: 5 * 1024 * 1024 + 1,
            },
            ...createPersonalEvidenceDescriptors().slice(1),
          ],
        },
      })
    ).rejects.toThrow('Evidence files must be 5MB or smaller.');
  });

  it('rejects duplicate submitted SMS applications for the same user and sender number', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });
    const payload = {
      sendNo: '1544-6859',
      senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
      evidenceFiles: createPersonalEvidenceDescriptors(),
    };

    await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload,
    });

    await expect(
      service.submitSmsApplication({
        actorUserId: 'user_1',
        payload,
      })
    ).rejects.toThrow('A submitted application already exists for this sender number.');
  });

  it('rejects SMS applications for already registered active sender numbers', async () => {
    const repository = createMemoryRepository();
    repository.resources.push(addTimestamps({
      id: 'resource_existing_sms',
      resourceRef: 'sr_existing_sms',
      provider: 'nhn',
      type: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
      value: '15446859',
      displayName: null,
      status: 'active',
      providerStatus: 'approved',
      metadataJson: null,
    }));
    repository.links.push(addTimestamps({
      id: 'link_existing_sms',
      userId: 'user_1',
      senderResourceId: 'resource_existing_sms',
      billingAccountId: 'billing_1',
      role: 'owner',
      status: 'active',
      isDefault: true,
    }));
    const service = createTestService({ repository });

    await expect(
      service.submitSmsApplication({
        actorUserId: 'user_1',
        payload: {
          sendNo: '1544-6859',
          senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
          evidenceFiles: createPersonalEvidenceDescriptors(),
        },
      })
    ).rejects.toThrow('이미 등록된 발신번호입니다.');
    expect(repository.applications).toHaveLength(0);
  });

  it('cancels the application if required evidence upload fails', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({
      repository,
      evidenceStore: {
        storeApplicationFiles: vi.fn(async () => {
          throw new Error('R2 upload failed');
        }),
        deleteApplicationFiles: vi.fn(),
        readApplicationFile: vi.fn(),
      },
    });

    await expect(
      service.submitSmsApplication({
        actorUserId: 'user_1',
        payload: { sendNo: '1544-6859', senderNumberType: PERSONAL_SENDER_NUMBER_TYPE },
        files: createPersonalEvidenceUploadFiles(),
      })
    ).rejects.toThrow('R2 upload failed');

    expect(repository.applications).toHaveLength(1);
    expect(repository.applications[0]).toMatchObject({
      status: 'canceled',
      reviewMemo: 'Evidence upload failed.',
    });
    expect(repository.evidenceFiles).toEqual([]);
  });

  it('deletes configured R2 evidence objects through a signed server-side request', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const store = createR2TestStore(fetchImpl);

    const result = await store.deleteApplicationFiles([
      {
        r2Bucket: 'private-evidence',
        r2ObjectKey: 'sender-resource-evidence/app-1/registration.pdf',
      },
    ]);

    expect(result).toEqual([
      {
        objectKey: 'sender-resource-evidence/app-1/registration.pdf',
        deleted: true,
        storageDriver: 'r2',
      },
    ]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      'https://account-id.r2.cloudflarestorage.com/private-evidence/sender-resource-evidence/app-1/registration.pdf'
    );
    expect(init.method).toBe('DELETE');
    expect(init.headers.Authorization).toContain('Credential=access-key/20260602/auto/s3/aws4_request');
    expect(String(url)).not.toContain('secret-key');
    expect(JSON.stringify(init.headers)).not.toContain('secret-key');
  });

  it('reports R2 evidence delete failures as retryable delete-pending results', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 500 }));
    const store = createR2TestStore(fetchImpl);

    const result = await store.deleteApplicationFiles([
      {
        r2Bucket: 'private-evidence',
        r2ObjectKey: 'sender-resource-evidence/app-1/registration.pdf',
      },
    ]);

    expect(result).toEqual([
      expect.objectContaining({
        objectKey: 'sender-resource-evidence/app-1/registration.pdf',
        deleted: false,
        reason: 'delete-failed',
      }),
    ]);
  });

  it('downloads configured R2 evidence objects through a signed server-side GET', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('registration file', {
          status: 200,
          headers: {
            'content-length': '17',
            'content-type': 'application/pdf',
          },
        })
    );
    const store = createR2TestStore(fetchImpl);

    const result = await store.readApplicationFile({
      r2Bucket: 'private-evidence',
      r2ObjectKey: 'sender-resource-evidence/app-1/registration.pdf',
      contentType: 'application/octet-stream',
      byteSize: 100,
    });

    expect(result).toMatchObject({
      contentType: 'application/pdf',
      byteSize: 17,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      'https://account-id.r2.cloudflarestorage.com/private-evidence/sender-resource-evidence/app-1/registration.pdf'
    );
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toContain('Credential=access-key/20260602/auto/s3/aws4_request');
    expect(String(url)).not.toContain('secret-key');
    expect(JSON.stringify(init.headers)).not.toContain('secret-key');
  });

  it('approves uploaded evidence by deleting the R2 object immediately', async () => {
    const repository = createMemoryRepository();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const service = createTestService({
      repository,
      evidenceStore: createR2TestStore(fetchImpl),
    });
    const application = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: { sendNo: '15446859', senderNumberType: PERSONAL_SENDER_NUMBER_TYPE },
      files: createPersonalEvidenceUploadFiles({ content: 'registration file' }),
    });

    await service.approveApplication({
      actorUserId: 'operator_1',
      applicationId: application.id,
      payload: { reviewMemo: 'NHN approval completed.' },
    });

    expect(fetchImpl.mock.calls.map(([, init]) => init.method)).toEqual([
      'PUT',
      'PUT',
      'PUT',
      'DELETE',
      'DELETE',
      'DELETE',
    ]);
    expect(repository.evidenceFiles[0]).toMatchObject({
      status: 'deleted',
      deletedBy: 'operator_1',
      deletedAt: FIXED_NOW,
    });
  });

  it('marks approved evidence delete_pending when R2 deletion fails', async () => {
    const repository = createMemoryRepository();
    const fetchImpl = vi.fn(async (_url, init) => new Response(null, { status: init.method === 'PUT' ? 200 : 500 }));
    const service = createTestService({
      repository,
      evidenceStore: createR2TestStore(fetchImpl),
    });
    const application = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: { sendNo: '15446859', senderNumberType: PERSONAL_SENDER_NUMBER_TYPE },
      files: createPersonalEvidenceUploadFiles({ content: 'registration file' }),
    });

    const result = await service.approveApplication({
      actorUserId: 'operator_1',
      applicationId: application.id,
      payload: { displayName: 'Main SMS', reviewMemo: 'NHN approval completed.' },
    });

    expect(result.application.status).toBe('approved');
    expect(repository.evidenceFiles[0]).toMatchObject({
      status: 'delete_pending',
      deleteAfter: FIXED_NOW,
    });
  });

  it('approves submitted SMS applications, activates a user-resource link, deletes evidence, and audits', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });

    const application = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: {
        sendNo: '15446859',
        senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
        evidenceFiles: createPersonalEvidenceDescriptors(),
      },
    });
    const result = await service.approveApplication({
      actorUserId: 'operator_1',
      applicationId: application.id,
      payload: { reviewMemo: 'NHN approval completed.' },
    });

    expect(result.application.status).toBe('approved');
    expect(result.resource).toMatchObject({
      userId: 'user_1',
      billingAccountId: 'billing_1',
      role: 'owner',
      status: 'active',
      resource: {
        provider: 'nhn',
        type: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
        value: '15446859',
        displayName: null,
        status: 'active',
      },
      isDefault: true,
    });
    expect(repository.evidenceFiles[0]).toMatchObject({
      status: 'deleted',
      deletedBy: 'operator_1',
      deletedAt: FIXED_NOW,
    });
    expect(repository.evidenceDeleteCalls).toHaveLength(1);
    expect(repository.auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'sender_resource_application.approved',
          actorUserId: 'operator_1',
          targetId: application.id,
        }),
      ])
    );
  });

  it('looks up NHN sender number status for submitted SMS applications', async () => {
    const repository = createMemoryRepository();
    const smsClient = createSmsClientMock();
    const service = createTestService({ repository, smsClient });
    const application = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: {
        sendNo: '1544-6859',
        senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
        evidenceFiles: createPersonalEvidenceDescriptors(),
      },
    });

    const result = await service.lookupSmsSendNo({
      actorUserId: 'operator_1',
      applicationId: application.id,
    });

    expect(smsClient.listSendNos).toHaveBeenCalledWith({
      sendNo: '15446859',
      pageNum: 1,
      pageSize: 15,
    });
    expect(result).toMatchObject({
      sendNo: '15446859',
      status: 'usable',
      usable: true,
      row: {
        sendNo: '15446859',
        useYn: 'Y',
        blockYn: 'N',
      },
    });
  });

  it('does not replace an existing SMS sender default when approving another number', async () => {
    const repository = createMemoryRepository();
    repository.resources.push(
      addTimestamps({
        id: 'resource_existing',
        resourceRef: 'sr_existing',
        provider: 'nhn',
        type: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
        value: '15446859',
        displayName: null,
        status: 'active',
        providerStatus: 'approved',
        metadataJson: null,
      })
    );
    repository.links.push(
      addTimestamps({
        id: 'link_existing',
        userId: 'user_1',
        senderResourceId: 'resource_existing',
        billingAccountId: 'billing_1',
        role: 'owner',
        status: 'active',
        isDefault: true,
      })
    );
    const service = createTestService({
      repository,
      smsClient: createSmsClientMock({
        rows: [
          { serviceId: 71191, sendNo: '15446859', useYn: 'Y', blockYn: 'N' },
          { serviceId: 71192, sendNo: '0212345678', useYn: 'Y', blockYn: 'N' },
        ],
      }),
    });
    const application = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: {
        sendNo: '0212345678',
        senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
        evidenceFiles: createPersonalEvidenceDescriptors(),
      },
    });

    const result = await service.approveApplication({
      actorUserId: 'operator_1',
      applicationId: application.id,
      payload: { reviewMemo: 'NHN approval completed.' },
    });

    expect(result.resource).toMatchObject({
      isDefault: false,
      resource: {
        type: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
        value: '0212345678',
        displayName: null,
      },
    });
    expect(repository.links.find((link) => link.id === 'link_existing')?.isDefault).toBe(true);
  });

  it('blocks SMS approval when NHN does not have the requested sender number', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({
      repository,
      smsClient: createSmsClientMock({ rows: [] }),
    });
    const application = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: {
        sendNo: '1544-6859',
        senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
        evidenceFiles: createPersonalEvidenceDescriptors(),
      },
    });

    await expect(
      service.approveApplication({
        actorUserId: 'operator_1',
        applicationId: application.id,
        payload: {},
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      message: 'NHN에 등록된 발신번호를 찾지 못했습니다.',
    });
    expect(repository.resources).toHaveLength(0);
  });

  it('blocks SMS approval when NHN marks the sender number as blocked', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({
      repository,
      smsClient: createSmsClientMock({
        rows: [{ sendNo: '15446859', useYn: 'Y', blockYn: 'Y', blockReason: 'blocked by NHN' }],
      }),
    });
    const application = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: {
        sendNo: '1544-6859',
        senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
        evidenceFiles: createPersonalEvidenceDescriptors(),
      },
    });

    await expect(
      service.approveApplication({
        actorUserId: 'operator_1',
        applicationId: application.id,
        payload: {},
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      message: 'NHN에서 차단된 발신번호는 승인할 수 없습니다.',
    });
    expect(repository.resources).toHaveLength(0);
  });

  it('sanitizes operator-supplied sender resource metadata before storing it', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });
    const application = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: {
        sendNo: '15446859',
        senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
        evidenceFiles: createPersonalEvidenceDescriptors(),
      },
    });

    const result = await service.approveApplication({
      actorUserId: 'operator_1',
      applicationId: application.id,
      payload: {
        metadataJson: {
          note: 'approved by NHN',
          signedUrl: 'https://example.com/private.pdf?signature=secret',
          r2ObjectKey: 'sender-resource-evidence/app_1/private.pdf',
          accessToken: 'provider-access-token',
          token: 'verification-token',
          secretKey: 'nhn-secret',
        },
      },
    });

    expect(result.resource.resource.metadataJson).toEqual({
      note: 'approved by NHN',
      nhn: {
        sendNo: '15446859',
        serviceId: 71191,
        useYn: 'Y',
        blockYn: 'N',
        checkedAt: FIXED_NOW.toISOString(),
      },
    });
    expect(JSON.stringify(repository.resources)).not.toContain('provider-access-token');
    expect(JSON.stringify(repository.resources)).not.toContain('nhn-secret');
  });

  it('rejects submitted applications and retains evidence for 90-day cleanup', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });

    const application = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: {
        sendNo: '15446859',
        senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
        evidenceFiles: createPersonalEvidenceDescriptors(),
      },
    });
    const result = await service.rejectApplication({
      actorUserId: 'operator_1',
      applicationId: application.id,
      payload: { rejectReason: 'Document mismatch.' },
    });

    expect(result.application).toMatchObject({
      status: 'rejected',
      rejectReason: 'Document mismatch.',
      evidenceFiles: expect.arrayContaining([
        expect.objectContaining({
          status: 'delete_pending',
          deleteAfter: new Date('2026-08-31T00:00:00.000Z'),
        }),
      ]),
    });
    expect(repository.evidenceDeleteCalls).toHaveLength(0);
    expect(repository.auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'sender_resource_application.rejected',
          actorUserId: 'operator_1',
          targetId: application.id,
        }),
      ])
    );
  });

  it('resubmits rejected SMS applications while retaining, replacing, and adding evidence', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });
    const application = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: {
        sendNo: '15446859',
        senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
        evidenceFiles: createPersonalEvidenceDescriptors(),
      },
    });

    await service.rejectApplication({
      actorUserId: 'operator_1',
      applicationId: application.id,
      payload: { rejectReason: '신분증 사본 보완 필요' },
    });

    const result = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: {
        applicationId: application.id,
        sendNo: '15446859',
        senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
      },
      files: [
        {
          fieldName: 'id_card_copy',
          file: createFileLike({ name: 'id-card-revised.pdf' }),
        },
        {
          fieldName: 'additional_document',
          file: createFileLike({ name: 'supplement-1.pdf' }),
        },
        {
          fieldName: 'additional_document',
          file: createFileLike({ name: 'supplement-2.pdf' }),
        },
      ],
    });

    const telecomCertificate = repository.evidenceFiles.find((file) => file.documentType === 'telecom_certificate');
    const consentDocument = repository.evidenceFiles.find((file) => file.documentType === 'consent_document');
    const idCardFiles = repository.evidenceFiles.filter((file) => file.documentType === 'id_card_copy');
    const additionalFiles = repository.evidenceFiles.filter((file) => file.documentType === 'additional_document');

    expect(result).toMatchObject({
      id: application.id,
      status: 'submitted',
      rejectReason: null,
      reviewedAt: null,
      reviewedBy: null,
    });
    expect(telecomCertificate).toMatchObject({ status: 'active', deleteAfter: null });
    expect(consentDocument).toMatchObject({ status: 'active', deleteAfter: null });
    expect(idCardFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ originalFileName: 'id_card_copy.pdf', status: 'delete_pending' }),
        expect.objectContaining({ originalFileName: 'id-card-revised.pdf', status: 'active' }),
      ])
    );
    expect(additionalFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ originalFileName: 'supplement-1.pdf', status: 'active' }),
        expect.objectContaining({ originalFileName: 'supplement-2.pdf', status: 'active' }),
      ])
    );
    expect(repository.auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'sender_resource_application.resubmitted',
          actorUserId: 'user_1',
          targetId: application.id,
        }),
      ])
    );
  });

  it('cleans up rejected evidence after the 90-day retention window and audits counts', async () => {
    const repository = createMemoryRepository();
    const cleanupNow = new Date('2026-09-01T00:00:00.000Z');
    const service = createTestService({ repository });
    const application = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: {
        sendNo: '15446859',
        senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
        evidenceFiles: createPersonalEvidenceDescriptors(),
      },
    });
    await service.rejectApplication({
      actorUserId: 'operator_1',
      applicationId: application.id,
      payload: { rejectReason: 'Document mismatch.' },
    });
    const cleanupService = createTestService({ repository, now: cleanupNow });

    const result = await cleanupService.cleanupExpiredEvidence({
      actorUserId: 'operator_1',
      limit: 50,
    });

    expect(result).toEqual({
      cutoff: cleanupNow.toISOString(),
      selectedCount: 3,
      deletedCount: 3,
      pendingCount: 0,
    });
    expect(repository.evidenceFiles[0]).toMatchObject({
      status: 'deleted',
      deletedBy: 'operator_1',
      deletedAt: cleanupNow,
    });
    expect(repository.auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'evidence_files.cleaned_up',
          actorUserId: 'operator_1',
          metadataJson: expect.objectContaining({
            selectedCount: 3,
            evidenceDeletedCount: 3,
            evidenceDeletePendingCount: 0,
          }),
        }),
      ])
    );
    expect(JSON.stringify(repository.auditLogs)).not.toContain('sms-registration.pdf');
  });

  it('cleans up expired rejected evidence by deleting the R2 object', async () => {
    const repository = createMemoryRepository();
    const cleanupNow = new Date('2026-09-01T00:00:00.000Z');
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const service = createTestService({
      repository,
      evidenceStore: createR2TestStore(fetchImpl),
    });
    const application = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: { sendNo: '15446859', senderNumberType: PERSONAL_SENDER_NUMBER_TYPE },
      files: createPersonalEvidenceUploadFiles({ content: 'registration file' }),
    });
    await service.rejectApplication({
      actorUserId: 'operator_1',
      applicationId: application.id,
      payload: { rejectReason: 'Document mismatch.' },
    });
    const cleanupService = createTestService({
      repository,
      evidenceStore: createR2TestStore(fetchImpl, { now: cleanupNow }),
      now: cleanupNow,
    });

    await cleanupService.cleanupExpiredEvidence({
      actorUserId: 'operator_1',
      limit: 50,
    });

    expect(fetchImpl.mock.calls.map(([, init]) => init.method)).toEqual([
      'PUT',
      'PUT',
      'PUT',
      'DELETE',
      'DELETE',
      'DELETE',
    ]);
    expect(repository.evidenceFiles[0]).toMatchObject({
      status: 'deleted',
      deletedBy: 'operator_1',
      deletedAt: cleanupNow,
    });
  });

  it('verifies Kakao sender keys through NHN, links the sender resource, and treats group sync failure as non-fatal', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = {
      registerSender: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      })),
      verifySenderToken: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      })),
      listSenders: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        senders: [
          {
            plusFriendId: '@store',
            senderKey: 'sender-key-1',
            categoryCode: '001',
            status: 'YSC03',
            kakaoProfileStatus: 'A',
          },
        ],
      })),
      addSenderToGroup: vi.fn(async () => {
        throw new NhnProviderError({
          status: 429,
          providerCode: '429',
          providerMessage: 'Too Many Requests',
        });
      }),
    };
    const service = createTestService({
      repository,
      kakaoClient,
      kakaoDefaultSenderGroupKey: 'group-key',
    });
    const requestResult = await service.requestKakaoConnect({
      actorUserId: 'user_1',
      payload: {
        plusFriendId: '@store',
        phoneNo: '01012345678',
        categoryCode: '001',
      },
    });

    const result = await service.verifyKakaoConnect({
      actorUserId: 'user_1',
      payload: {
        applicationId: requestResult.application.id,
        token: 123456,
      },
    });

    expect(kakaoClient.registerSender).toHaveBeenCalledWith({
      plusFriendId: '@store',
      phoneNo: '01012345678',
      categoryCode: '001',
    });
    expect(kakaoClient.verifySenderToken).toHaveBeenCalledWith({
      plusFriendId: '@store',
      token: 123456,
    });
    expect(kakaoClient.listSenders).toHaveBeenCalledWith({ plusFriendId: '@store' });
    expect(kakaoClient.addSenderToGroup).toHaveBeenCalledWith({
      groupSenderKey: 'group-key',
      senderKey: 'sender-key-1',
    });
    expect(result).toMatchObject({
      application: {
        status: 'approved',
        requestedValue: 'sender-key-1',
      },
      resource: {
        userId: 'user_1',
        status: 'active',
        isDefault: true,
        resource: {
          type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
          value: 'sender-key-1',
          providerStatus: 'active',
        },
      },
      senderGroup: {
        configured: true,
        added: false,
        groupSenderKey: 'group-key',
        error: {
          providerCode: '429',
          providerMessage: 'Too Many Requests',
        },
      },
    });
    expect(repository.auditLogs.map((log) => log.action)).toEqual(
      expect.arrayContaining(['sender_resource.kakao_group_sync_failed', 'sender_resource.kakao_verified'])
    );
  });

  it('rejects Kakao verification when the sender key is already active for the user', async () => {
    const repository = createMemoryRepository();
    repository.resources.push(addTimestamps({
      id: 'resource_kakao_existing',
      resourceRef: 'sr_kakao_existing',
      provider: 'nhn',
      type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
      value: 'sender-key-1',
      displayName: '@bizuo',
      status: 'active',
      providerStatus: 'active',
      metadataJson: { plusFriendId: '@bizuo' },
    }));
    repository.links.push(addTimestamps({
      id: 'link_kakao_existing',
      userId: 'user_1',
      senderResourceId: 'resource_kakao_existing',
      billingAccountId: 'billing_1',
      role: 'owner',
      status: 'active',
      isDefault: true,
    }));
    const kakaoClient = {
      registerSender: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      })),
      verifySenderToken: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      })),
      listSenders: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        senders: [
          {
            plusFriendId: '@bizuo',
            senderKey: 'sender-key-1',
            categoryCode: '00100010001',
            status: 'YSC03',
            kakaoProfileStatus: 'A',
          },
        ],
      })),
      addSenderToGroup: vi.fn(),
    };
    const service = createTestService({ repository, kakaoClient });
    const requestResult = await service.requestKakaoConnect({
      actorUserId: 'user_1',
      payload: {
        plusFriendId: '@bizuo',
        phoneNo: '01012345678',
        categoryCode: '00100010001',
      },
    });

    await expect(
      service.verifyKakaoConnect({
        actorUserId: 'user_1',
        payload: {
          applicationId: requestResult.application.id,
          token: 123456,
        },
      })
    ).rejects.toThrow('이미 등록된 카카오 채널입니다.');
    expect(kakaoClient.addSenderToGroup).not.toHaveBeenCalled();
    expect(repository.resources).toHaveLength(1);
    expect(repository.links).toHaveLength(1);
  });

  it('rejects evidence descriptors that expose public or signed URLs', async () => {
    const store = createEvidenceStore();

    await expect(
      store.storeApplicationFiles({
        applicationId: 'app_1',
        userId: 'user_1',
        files: [
          {
            objectKey: 'private/file.pdf',
            signedUrl: 'https://example.com/private/file.pdf?signature=secret',
          },
        ],
      })
    ).rejects.toThrow('must not include public or signed URLs');

    await expect(
      store.storeApplicationFiles({
        applicationId: 'app_1',
        userId: 'user_1',
        files: [{ objectKey: 'https://example.com/private/file.pdf' }],
      })
    ).rejects.toThrow('must be a private object key');

    await expect(
      store.storeApplicationFiles({
        applicationId: 'app_1',
        userId: 'user_1',
        files: [{ objectKey: 'private/file.pdf' }],
      })
    ).rejects.toThrow('must be a private object key');
  });

  it('fails closed when production R2 evidence config is missing', () => {
    expect(() =>
      createEvidenceStore({
        env: {
          NODE_ENV: 'production',
        },
      })
    ).toThrow('R2 evidence storage requires endpoint, access key, secret key, and bucket');

    expect(() =>
      createEvidenceStore({
        env: {
          NODE_ENV: 'production',
          EVIDENCE_STORAGE_DRIVER: 'local',
        },
      })
    ).toThrow('Local evidence storage is not allowed in production');
  });

  it('lets operators download evidence through the storage proxy without exposing object keys', async () => {
    const repository = createMemoryRepository();
    const readApplicationFile = vi.fn(async () => ({
      body: Buffer.from('registration file'),
      contentType: 'application/pdf',
      byteSize: 17,
    }));
    const service = createTestService({
      repository,
      evidenceStore: createStubEvidenceStore({ readApplicationFile }),
    });
    const application = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: {
        sendNo: '15446859',
        senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
        evidenceFiles: createPersonalEvidenceDescriptors(),
      },
    });

    const result = await service.downloadEvidenceFile({
      actorUserId: 'operator_1',
      applicationId: application.id,
      evidenceFileId: application.evidenceFiles[0].id,
    });

    expect(result).toEqual({
      stream: expect.any(Buffer),
      filename: 'registration.pdf',
      contentType: 'application/pdf',
      byteSize: 17,
    });
    expect(readApplicationFile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: application.evidenceFiles[0].id,
        r2ObjectKey: 'private/sms-registration.pdf',
      })
    );
    expect(JSON.stringify(result)).not.toContain('r2ObjectKey');
    expect(JSON.stringify(result)).not.toContain('private/sms-registration.pdf');
  });

  it('rejects ordinary-user evidence downloads for another user application', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });
    const application = await service.submitSmsApplication({
      actorUserId: 'user_1',
      payload: {
        sendNo: '15446859',
        senderNumberType: PERSONAL_SENDER_NUMBER_TYPE,
        evidenceFiles: createPersonalEvidenceDescriptors(),
      },
    });

    await expect(
      service.downloadEvidenceFile({
        actorUserId: 'user_2',
        applicationId: application.id,
        evidenceFileId: application.evidenceFiles[0].id,
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.FORBIDDEN,
      status: 403,
    });
  });

  it('redacts evidence storage fields from audit metadata', () => {
    const metadata = sanitizeAuditMetadata({
      r2Bucket: 'private-evidence',
      r2ObjectKey: 'sender-resource-evidence/app_1/registration.pdf',
      signedUrl: 'https://account-id.r2.cloudflarestorage.com/private-evidence/file?signature=secret',
      publicUrl: 'https://public.example/file.pdf',
      accessToken: 'provider-access-token',
      token: 'provider-token',
      secretKey: 'nhn-secret',
      safeCount: 1,
    });

    expect(metadata).toEqual({ safeCount: 1 });
  });

  it('lists only active sender resource links for ordinary users', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });
    repository.resources.push(
      addTimestamps({
        id: 'resource_active',
        resourceRef: 'sr_active',
        provider: 'nhn',
        type: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
        value: '15446859',
        displayName: 'Main SMS',
        status: 'active',
        providerStatus: 'approved',
        metadataJson: null,
      }),
      addTimestamps({
        id: 'resource_suspended',
        resourceRef: 'sr_suspended',
        provider: 'nhn',
        type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
        value: 'sender-key-1',
        displayName: 'Suspended Kakao',
        status: 'suspended',
        providerStatus: 'blocked',
        metadataJson: null,
      })
    );
    repository.links.push(
      addTimestamps({
        id: 'link_active',
        userId: 'user_1',
        senderResourceId: 'resource_active',
        billingAccountId: 'billing_1',
        role: 'owner',
        status: 'active',
        isDefault: false,
      }),
      addTimestamps({
        id: 'link_pending',
        userId: 'user_1',
        senderResourceId: 'resource_suspended',
        billingAccountId: 'billing_1',
        role: 'sender',
        status: 'pending',
        isDefault: false,
      })
    );

    const result = await service.listSenderResources({ actorUserId: 'user_1' });

    expect(result.resources).toHaveLength(1);
    expect(result.resources[0]).toMatchObject({
      id: 'link_active',
      isDefault: true,
      resource: {
        id: 'resource_active',
        displayName: null,
        status: 'active',
      },
    });
  });

  it('returns Kakao connect bootstrap with NHN category tree and existing channels', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = {
      registerSender: vi.fn(),
      verifySenderToken: vi.fn(),
      listSenders: vi.fn(),
      addSenderToGroup: vi.fn(),
      listSenderCategories: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        categories: [
          {
            code: '001',
            name: '비즈니스',
            depth: 1,
            subCategories: [
              {
                code: '0001',
                name: '판매/유통',
                depth: 2,
                subCategories: [{ code: '0001', name: '온라인 쇼핑몰', depth: 3 }],
              },
            ],
          },
        ],
      })),
    };
    repository.resources.push(addTimestamps({
      id: 'resource_kakao_1',
      resourceRef: 'sr_kakao_1',
      provider: 'nhn',
      type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
      value: 'sender-key-1',
      displayName: '@store',
      status: 'active',
      providerStatus: 'active',
      metadataJson: { plusFriendId: '@store', categoryCode: '00100010001' },
    }));
    repository.links.push(addTimestamps({
      id: 'link_kakao_1',
      userId: 'user_1',
      senderResourceId: 'resource_kakao_1',
      billingAccountId: 'billing_1',
      role: 'owner',
      status: 'active',
      isDefault: true,
    }));
    const service = createTestService({ repository, kakaoClient });

    const result = await service.getKakaoConnectBootstrap({ actorUserId: 'user_1' });

    expect(kakaoClient.listSenderCategories).toHaveBeenCalledTimes(1);
    expect(result.categories[0]).toMatchObject({
      code: '001',
      label: '비즈니스',
      children: [
        {
          code: '0010001',
          label: '판매/유통',
          children: [{ code: '00100010001', label: '온라인 쇼핑몰' }],
        },
      ],
    });
    expect(result.readiness).toMatchObject({ totalCount: 1, activeCount: 1, status: 'ready' });
    expect(result.existingChannels).toEqual([
      expect.objectContaining({
        id: 'link_kakao_1',
        plusFriendId: '@store',
        senderKey: 'sender-key-1',
        categoryCode: '00100010001',
        isDefault: true,
      }),
    ]);
  });

  it('switches the default Kakao sender profile for the current user only', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });
    repository.resources.push(
      addTimestamps({
        id: 'resource_kakao_1',
        resourceRef: 'sr_kakao_1',
        provider: 'nhn',
        type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
        value: 'sender-key-1',
        displayName: '@store',
        status: 'active',
        providerStatus: 'active',
        metadataJson: { plusFriendId: '@store' },
      }),
      addTimestamps({
        id: 'resource_kakao_2',
        resourceRef: 'sr_kakao_2',
        provider: 'nhn',
        type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
        value: 'sender-key-2',
        displayName: '@support',
        status: 'active',
        providerStatus: 'active',
        metadataJson: { plusFriendId: '@support' },
      })
    );
    repository.links.push(
      addTimestamps({
        id: 'link_kakao_1',
        userId: 'user_1',
        senderResourceId: 'resource_kakao_1',
        billingAccountId: 'billing_1',
        role: 'owner',
        status: 'active',
        isDefault: true,
      }),
      addTimestamps({
        id: 'link_kakao_2',
        userId: 'user_1',
        senderResourceId: 'resource_kakao_2',
        billingAccountId: 'billing_1',
        role: 'owner',
        status: 'active',
        isDefault: false,
      })
    );

    const result = await service.setDefaultKakaoChannel({
      actorUserId: 'user_1',
      senderProfileId: 'link_kakao_2',
    });

    expect(result.item).toMatchObject({
      id: 'link_kakao_2',
      plusFriendId: '@support',
      senderKey: 'sender-key-2',
      isDefault: true,
    });
    expect(repository.links.find((link) => link.id === 'link_kakao_1').isDefault).toBe(false);
    expect(repository.links.find((link) => link.id === 'link_kakao_2').isDefault).toBe(true);
    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'sender_resource.kakao_default_changed',
        targetId: 'resource_kakao_2',
      }),
    ]);
  });
});

function createTestService({
  repository,
  evidenceStore,
  kakaoClient,
  kakaoDefaultSenderGroupKey,
  smsClient,
  now = FIXED_NOW,
} = {}) {
  return createSenderResourceApprovalService({
    repository,
    evidenceStore: evidenceStore || createStubEvidenceStore({ repository }),
    kakaoClient:
      kakaoClient ||
      {
        registerSender: vi.fn(),
        verifySenderToken: vi.fn(),
        listSenders: vi.fn(),
        listSenderCategories: vi.fn(),
        addSenderToGroup: vi.fn(),
      },
    kakaoDefaultSenderGroupKey,
    smsClient: smsClient || createSmsClientMock(),
    now: () => now,
  });
}

function createSmsClientMock({
  rows = [{ serviceId: 71191, sendNo: '15446859', useYn: 'Y', blockYn: 'N' }],
} = {}) {
  return {
    listSendNos: vi.fn(async () => ({
      header: {
        isSuccessful: true,
        resultCode: 0,
        resultMessage: 'SUCCESS',
      },
      body: {
        pageNum: 1,
        pageSize: rows.length,
        totalCount: rows.length,
        data: rows,
      },
    })),
  };
}

function createStubEvidenceStore({ repository, readApplicationFile } = {}) {
  return {
    storeApplicationFiles: async ({ files }) =>
      files.map((file, index) => ({
        r2Bucket: 'private-evidence',
        r2ObjectKey: file.r2ObjectKey || file.objectKey || `private/file-${index}`,
        originalFileName: file.originalFileName || file.name || `file-${index}.pdf`,
        contentType: file.contentType || 'application/pdf',
        byteSize: file.byteSize ?? 100,
        checksumSha256: file.checksumSha256 ?? null,
      })),
    deleteApplicationFiles: async (files) => {
      repository?.evidenceDeleteCalls.push(files);
      return files.map((file) => ({ objectKey: file.r2ObjectKey, deleted: true }));
    },
    readApplicationFile:
      readApplicationFile ||
      (async () => ({
        body: Buffer.from('evidence file'),
        contentType: 'application/pdf',
        byteSize: 13,
      })),
  };
}

function createR2TestStore(fetchImpl, { now = FIXED_NOW, objectKeyPrefix } = {}) {
  return createEvidenceStore({
    env: {
      NODE_ENV: 'test',
      R2_ENDPOINT_URL: 'https://account-id.r2.cloudflarestorage.com',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_EVIDENCE_BUCKET: 'private-evidence',
      ...(objectKeyPrefix ? { EVIDENCE_STORAGE_OBJECT_PREFIX: objectKeyPrefix } : {}),
    },
    fetchImpl,
    now: () => now,
  });
}

function createFileLike({
  name = 'registration.pdf',
  type = 'application/pdf',
  content = 'registration file',
  size = Buffer.byteLength(content),
} = {}) {
  return {
    name,
    size,
    type,
    async arrayBuffer() {
      return Buffer.from(content);
    },
  };
}

function createPersonalEvidenceDescriptors() {
  return PERSONAL_EVIDENCE_DOCUMENT_TYPES.map((documentType, index) => ({
    documentType,
    objectKey: index === 0 ? 'private/sms-registration.pdf' : `private/${documentType}.pdf`,
    originalFileName: index === 0 ? 'registration.pdf' : `${documentType}.pdf`,
    contentType: 'application/pdf',
    byteSize: 2048,
  }));
}

function createCompanyEvidenceDescriptors() {
  return COMPANY_EVIDENCE_DOCUMENT_TYPES.map((documentType) => ({
    documentType,
    objectKey: `private/${documentType}.pdf`,
    originalFileName: `${documentType}.pdf`,
    contentType: 'application/pdf',
    byteSize: 2048,
  }));
}

function createPersonalEvidenceUploadFiles({ content = 'registration file' } = {}) {
  return PERSONAL_EVIDENCE_DOCUMENT_TYPES.map((documentType) => ({
    fieldName: documentType,
    file: createFileLike({
      name: `${documentType}.pdf`,
      content,
    }),
  }));
}

function createMemoryRepository() {
  const repository = {
    users: [
      {
        id: 'user_1',
        userRef: 'user_1_ref',
        email: 'user@example.com',
        name: 'User',
        status: 'active',
        isOperator: false,
      },
      {
        id: 'operator_1',
        userRef: 'operator_1_ref',
        email: 'operator@example.com',
        name: 'Operator',
        status: 'active',
        isOperator: true,
      },
      {
        id: 'user_2',
        userRef: 'user_2_ref',
        email: 'other-user@example.com',
        name: 'Other User',
        status: 'active',
        isOperator: false,
      },
    ],
    billingAccounts: [
      {
        id: 'billing_1',
        billingRef: 'billing_1_ref',
        ownerType: 'user',
        ownerId: 'user_1',
        status: 'active',
      },
    ],
    applications: [],
    evidenceFiles: [],
    resources: [],
    links: [],
    auditLogs: [],
    evidenceDeleteCalls: [],
    nextId: 1,

    async getUserById(userId) {
      return this.users.find((user) => user.id === userId) ?? null;
    },

    async listUserSenderResources(userId) {
      return this.links
        .filter((link) => link.userId === userId)
        .map((link) => ({
          link,
          resource: this.resources.find((resource) => resource.id === link.senderResourceId),
        }));
    },

    async listUserApplications(userId) {
      return this.applications
        .filter((application) => application.userId === userId)
        .map((application) => ({
          application,
          evidenceFiles: this.evidenceFiles.filter((file) => file.applicationId === application.id),
        }));
    },

    async findSubmittedApplicationByUserValue({ userId, resourceType, requestedValue }) {
      return (
        this.applications.find(
          (application) =>
            application.userId === userId
            && application.resourceType === resourceType
            && application.requestedValue === requestedValue
            && application.status === 'submitted'
        ) ?? null
      );
    },

    async createApplication(values) {
      const application = addTimestamps({
        id: `app_${this.nextId++}`,
        senderNumberType: null,
        reviewedBy: null,
        reviewedAt: null,
        reviewMemo: null,
        rejectReason: null,
        ...values,
      });
      this.applications.push(application);
      return application;
    },

    async updateApplication(applicationId, values) {
      const application = this.applications.find((item) => item.id === applicationId);
      Object.assign(application, values, { updatedAt: FIXED_NOW });
      return application;
    },

    async createEvidenceFiles(records) {
      const files = records.map((record) =>
        addTimestamps({
          id: `evidence_${this.nextId++}`,
          documentType: null,
          deleteAfter: null,
          deletedAt: null,
          deletedBy: null,
          ...record,
        })
      );
      this.evidenceFiles.push(...files);
      return files;
    },

    async updateEvidenceFiles(fileIds, values) {
      return this.evidenceFiles
        .filter((file) => fileIds.includes(file.id))
        .map((file) => {
          Object.assign(file, values, { updatedAt: FIXED_NOW });
          return file;
        });
    },

    async listEvidenceFilesReadyForDeletion(cutoffDate, { limit = 100 } = {}) {
      return this.evidenceFiles
        .filter((file) => file.status === 'delete_pending')
        .filter((file) => file.deleteAfter && file.deleteAfter <= cutoffDate)
        .sort((left, right) => Number(left.deleteAfter) - Number(right.deleteAfter))
        .slice(0, limit);
    },

    async listApplications({ status, resourceType } = {}) {
      return this.applications
        .filter((application) => !status || application.status === status)
        .filter((application) => !resourceType || application.resourceType === resourceType)
        .map((application) => ({
          application,
          user: this.users.find((user) => user.id === application.userId),
          evidenceFiles: this.evidenceFiles.filter((file) => file.applicationId === application.id),
        }));
    },

    async getApplicationWithEvidence(applicationId) {
      const application = this.applications.find((item) => item.id === applicationId);
      if (!application) return null;

      return {
        application,
        user: this.users.find((user) => user.id === application.userId),
        evidenceFiles: this.evidenceFiles.filter((file) => file.applicationId === application.id),
      };
    },

    async findSenderResource({ provider, type, value }) {
      return (
        this.resources.find(
          (resource) => resource.provider === provider && resource.type === type && resource.value === value
        ) ?? null
      );
    },

    async createSenderResource(values) {
      const resource = addTimestamps({
        id: `resource_${this.nextId++}`,
        ...values,
      });
      this.resources.push(resource);
      return resource;
    },

    async findBillingAccountForUser(userId) {
      return this.billingAccounts.find((account) => account.ownerType === 'user' && account.ownerId === userId) ?? null;
    },

    async findUserSenderResourceLink({ userId, senderResourceId }) {
      return this.links.find((link) => link.userId === userId && link.senderResourceId === senderResourceId) ?? null;
    },

    async createUserSenderResourceLink(values) {
      const link = addTimestamps({
        id: `link_${this.nextId++}`,
        ...values,
      });
      this.links.push(link);
      return link;
    },

    async updateUserSenderResourceLink(linkId, values) {
      const link = this.links.find((item) => item.id === linkId);
      Object.assign(link, values, { updatedAt: FIXED_NOW });
      return link;
    },

    async createAuditLog(values) {
      const auditLog = {
        id: `audit_${this.nextId++}`,
        createdAt: FIXED_NOW,
        ...values,
      };
      this.auditLogs.push(auditLog);
      return auditLog;
    },
  };

  return repository;
}

function addTimestamps(value) {
  return {
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...value,
  };
}
