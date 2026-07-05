import { describe, expect, it } from 'vitest';

import {
  SMS_TEMPLATE_CREATE_FIELD_IDS,
  applySmsTemplateIdChange,
  applySmsTemplateNameChange,
  buildSmsTemplateCreatePayload,
  buildSmsTemplateCreatePayloadWithUploadedAttachments,
  createSmsTemplateSubmissionDraft,
  createSmsTemplatePreviewVariableAssignments,
  extractSmsTemplateVariables,
  getSmsTemplateCreateModel,
  suggestSmsTemplateId,
  validateSmsTemplateCreateDraft,
  validateSmsTemplateCreateSubmissionDraft,
} from '../../features/console/templates/smsTemplateCreateModel.js';
import { templateQueryKeys } from '../../features/console/templates/queryKeys.js';

describe('smsTemplateCreateModel', () => {
  it('derives SMS, LMS, and MMS registration type from body length and attachments', () => {
    expect(buildSmsTemplateCreatePayload(createDraft())).toMatchObject({
      sendType: '0',
    });
    expect(getSmsTemplateCreateModel(createDraft()).messageType).toBe('SMS');

    expect(buildSmsTemplateCreatePayload(createDraft({
      body: `${'a'.repeat(90)}한`,
      title: 'Notice',
    }))).toMatchObject({
      sendType: '1',
      title: 'Notice',
    });
    expect(getSmsTemplateCreateModel(createDraft({ body: `${'a'.repeat(90)}한`, title: 'Notice' })).messageType).toBe('LMS');

    expect(buildSmsTemplateCreatePayload(createDraft({
      attachFileIdList: [123],
      title: 'Image notice',
    }))).toMatchObject({
      attachFileIdList: [123],
      sendType: '1',
      title: 'Image notice',
    });
  });

  it('ignores legacy explicit messageType and warns that SMS variables can bill as LMS', () => {
    const draft = createDraft({
      body: 'Hello ##name##',
      messageType: 'MMS',
      title: '',
    });

    const validation = validateSmsTemplateCreateDraft(draft);
    const payload = buildSmsTemplateCreatePayload(draft);

    expect(validation.isValid).toBe(true);
    expect(validation.warnings.body).toEqual([
      '변수 값에 따라 실제 발송 시 90바이트를 초과하면 LMS 과금이 적용될 수 있습니다.',
    ]);
    expect(getSmsTemplateCreateModel(draft).messageType).toBe('SMS');
    expect(payload.sendType).toBe('0');
    expect(payload).not.toHaveProperty('title');
  });

  it('requires title only for inferred LMS and MMS drafts', () => {
    expect(validateSmsTemplateCreateDraft(createDraft({
      title: '',
    })).errors.title).toBeUndefined();

    expect(validateSmsTemplateCreateDraft(createDraft({
      body: `${'a'.repeat(90)}한`,
      title: '',
    })).errors.title).toEqual(['LMS/MMS 템플릿은 제목이 필요합니다.']);

    expect(validateSmsTemplateCreateDraft(createDraft({
      attachFileIdList: [123],
      title: '',
    })).errors.title).toEqual(['LMS/MMS 템플릿은 제목이 필요합니다.']);
  });

  it('treats uploaded file ids as MMS and rejects browser-only attachment data', () => {
    const browserFile = typeof File === 'function'
      ? new File(['jpeg-bytes'], 'notice.jpg', { type: 'image/jpeg' })
      : { name: 'notice.jpg', size: 10, type: 'image/jpeg' };
    const invalidDrafts = [
      createDraft({ attachFileIdList: [browserFile], title: 'Image notice' }),
      createDraft({ attachFileIdList: ['blob:preview'], title: 'Image notice' }),
      createDraft({ attachFileIdList: ['data:image/jpeg;base64,abc'], title: 'Image notice' }),
      createDraft({ attachFileIdList: [{ fileId: 123 }], title: 'Image notice' }),
      createDraft({
        attachFileIdList: [123],
        imageAttachments: [{ previewUrl: 'blob:preview' }],
        title: 'Image notice',
      }),
    ];

    for (const draft of invalidDrafts) {
      const validation = validateSmsTemplateCreateDraft(draft);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.attachFileIdList).toBeDefined();
    }

    expect(buildSmsTemplateCreatePayload(createDraft({
      attachFileIdList: [123],
      title: 'Image notice',
    })).attachFileIdList).toEqual([123]);
  });

  it('allows MMS submit validation when local attachment upload is pending', () => {
    const uploadPendingValidation = validateSmsTemplateCreateSubmissionDraft(createDraft({
      title: 'Image notice',
    }), {
      pendingAttachmentUploadCount: 1,
    });
    const browserOnlyAttachmentValidation = validateSmsTemplateCreateSubmissionDraft(createDraft({
      imageAttachments: [{ previewUrl: 'blob:preview' }],
      title: 'Image notice',
    }), {
      pendingAttachmentUploadCount: 1,
    });

    expect(uploadPendingValidation.isValid).toBe(true);
    expect(uploadPendingValidation.errors.attachFileIdList).toBeUndefined();
    expect(browserOnlyAttachmentValidation.isValid).toBe(false);
    expect(browserOnlyAttachmentValidation.errors.attachFileIdList).toEqual([
      '첨부 이미지는 업로드를 완료한 fileId만 사용할 수 있습니다.',
    ]);
  });

  it('uses uploaded MMS attachment file ids in the provider-safe template payload', () => {
    const draft = createDraft({
      attachFileIdList: [321],
      sampleVariableAssignments: {
        code: { mode: 'manual', value: '123456' },
      },
      title: 'Image notice',
    });
    const submissionDraft = createSmsTemplateSubmissionDraft(draft, [
      { fileId: '123', fileName: 'notice.jpg', fileBody: 'redacted' },
      { fileId: 456 },
      { fileId: 'not-a-number' },
    ]);
    const payload = buildSmsTemplateCreatePayloadWithUploadedAttachments(draft, [
      { fileId: '123', fileName: 'notice.jpg', fileBody: 'redacted' },
      { fileId: 456 },
    ]);

    expect(submissionDraft.attachFileIdList).toEqual([321, 123, 456]);
    expect(payload).toEqual({
      attachFileIdList: [321, 123, 456],
      body: 'Pickup code ##code##',
      senderResourceId: 'sms_resource_1',
      sendType: '1',
      templateDesc: 'Operational pickup template',
      templateId: 'SMS_PICKUP',
      templateName: 'Pickup notice',
      title: 'Image notice',
      useYn: 'Y',
    });
    expect(payload).not.toHaveProperty('sampleVariableAssignments');
    expect(payload).not.toHaveProperty('file');
    expect(payload).not.toHaveProperty('fileBody');
    expect(payload).not.toHaveProperty('recipientList');
    expect(payload).not.toHaveProperty('requestDate');
    expect(JSON.stringify(payload)).not.toContain('blob:');
    expect(JSON.stringify(payload)).not.toContain('redacted');
    expect(JSON.stringify(payload)).not.toContain('123456');
  });

  it('extracts and dedupes SMS variables and creates preview-only assignments', () => {
    const body = '안녕하세요 ##name##님. 주문 ##orderNo##, 다시 ##name##';
    const variables = extractSmsTemplateVariables(body);
    const previewVariables = createSmsTemplatePreviewVariableAssignments({
      body,
      sampleVariableAssignments: {
        name: { mode: 'manual', value: '민지' },
      },
    });
    const payload = buildSmsTemplateCreatePayload(createDraft({
      body,
      sampleVariableAssignments: previewVariables,
    }));

    expect(variables).toEqual([
      { key: 'name', token: '##name##' },
      { key: 'orderNo', token: '##orderNo##' },
    ]);
    expect(previewVariables).toMatchObject({
      name: { mode: 'manual', value: '민지' },
      orderNo: { mode: 'manual', value: 'ORD-1024' },
    });
    expect(payload.body).toBe(body);
    expect(payload).not.toHaveProperty('sampleVariableAssignments');
    expect(payload).not.toHaveProperty('variables');
    expect(payload).not.toHaveProperty('templateParameter');
    expect(JSON.stringify(payload)).not.toContain('민지');
  });

  it('extracts SMS provider tokens when they are surrounded by literal hash characters', () => {
    const body = '안녕하세요 ###테스트### 입니다.';
    const validation = validateSmsTemplateCreateDraft(createDraft({
      body,
      title: '테스트',
      attachFileIdList: [123],
    }));
    const payload = buildSmsTemplateCreatePayload(createDraft({
      body,
      title: '테스트',
      attachFileIdList: [123],
    }));

    expect(extractSmsTemplateVariables(body)).toEqual([{ key: '테스트', token: '##테스트##' }]);
    expect(validation.errors.body).toBeUndefined();
    expect(payload.body).toBe(body);
  });

  it('suggests safe template ids while preserving manual overrides', () => {
    expect(suggestSmsTemplateId('June pickup reminder!')).toBe('JUNE_PICKUP_REMINDER');
    expect(suggestSmsTemplateId('2026 pickup reminder')).toBe('SMS_2026_PICKUP_REMINDER');
    expect(suggestSmsTemplateId('배송 완료 안내')).toBe('SMS_TEMPLATE');

    const namedDraft = applySmsTemplateNameChange({}, 'June pickup reminder!');
    const manualDraft = applySmsTemplateIdChange(namedDraft, 'custom-id');
    const renamedDraft = applySmsTemplateNameChange(manualDraft, 'July pickup reminder');

    expect(namedDraft.templateId).toBe('JUNE_PICKUP_REMINDER');
    expect(manualDraft).toMatchObject({
      templateId: 'CUSTOM_ID',
      templateIdManuallyEdited: true,
    });
    expect(renamedDraft.templateId).toBe('CUSTOM_ID');
  });

  it('reports max length validation and first field focus id', () => {
    const validation = validateSmsTemplateCreateDraft(createDraft({
      body: 'b'.repeat(4001),
      templateDesc: 'd'.repeat(101),
      templateId: 'T'.repeat(51),
      templateName: 'n'.repeat(51),
      title: 't'.repeat(121),
    }));

    expect(validation.isValid).toBe(false);
    expect(validation.errors.templateName).toEqual(['templateName은(는) 50자 이하여야 합니다.']);
    expect(validation.errors.templateId).toEqual(['templateId은(는) 50자 이하여야 합니다.']);
    expect(validation.errors.title).toEqual(['title은(는) 120자 이하여야 합니다.']);
    expect(validation.errors.body).toEqual(['body은(는) 4000자 이하여야 합니다.']);
    expect(validation.errors.templateDesc).toEqual(['templateDesc은(는) 100자 이하여야 합니다.']);
    expect(validation.firstInvalidFieldId).toBe(SMS_TEMPLATE_CREATE_FIELD_IDS.templateName);
  });

  it('rejects Notification Hub-only and send-only draft fields', () => {
    const forbiddenFields = [
      { messagePurpose: 'NORMAL' },
      { templateLanguage: 'ko' },
      { sender: { phoneNumber: '15446859' } },
      { categoryId: 1 },
      { content: 'Notification Hub body' },
      { sendType: 'MMS' },
      { recipient: 'all' },
      { recipients: [{ recipientNo: '01012345678' }] },
      { templateParameter: { code: '1234' } },
      { requestDate: '2026-06-02 15:00' },
      { scheduledAt: '2026-06-02T06:00:00.000Z' },
      { reservation: { enabled: true } },
      { sendLog: true },
    ];

    for (const forbiddenField of forbiddenFields) {
      const validation = validateSmsTemplateCreateDraft(createDraft(forbiddenField));
      const [field] = Object.keys(forbiddenField);

      expect(validation.isValid).toBe(false);
      expect(validation.errors[field]).toEqual([
        `${field} is not accepted for SMS template registration.`,
      ]);
    }
  });

  it('keeps SMS template catalog invalidation scoped to SMS catalog queries', () => {
    expect(templateQueryKeys.smsCatalog).toEqual(['templates', 'catalog', 'sms']);
    expect(templateQueryKeys.catalog('sms', { senderResourceId: 'sms_resource_1' }).slice(0, 3)).toEqual(
      templateQueryKeys.smsCatalog
    );
  });

  it('returns a derived model with provider send type, variables, preview assignments, and validation', () => {
    const model = getSmsTemplateCreateModel(createDraft({
      body: `${'a'.repeat(90)}한 ##name##`,
      title: 'Notice',
    }));

    expect(model.messageType).toBe('LMS');
    expect(model.providerSendType).toBe('1');
    expect(model.variables).toEqual([{ key: 'name', token: '##name##' }]);
    expect(model.previewVariables.name).toMatchObject({
      mode: 'manual',
      value: '김민준',
    });
    expect(model.validation.isValid).toBe(true);
  });
});

function createDraft(overrides = {}) {
  return {
    body: 'Pickup code ##code##',
    senderResourceId: 'sms_resource_1',
    templateDesc: 'Operational pickup template',
    templateId: 'SMS_PICKUP',
    templateName: 'Pickup notice',
    title: '',
    useYn: 'Y',
    ...overrides,
  };
}
