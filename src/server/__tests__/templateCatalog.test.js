import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { createTemplateCatalogService, TEMPLATE_SOURCES } from '../templates/service.js';
import { NhnProviderError } from '../relay/errors.js';
import { CHANNELS, RELAY_ERROR_CODES, SENDER_RESOURCE_TYPES } from '../relay/constants.js';

describe('template catalog service', () => {
  it('keeps the default SMS client wrapper compatible with category-backed template registration', () => {
    const serviceSource = readFileSync(new URL('../templates/service.js', import.meta.url), 'utf8');

    expect(serviceSource).toContain('listCategories: (...args) => getClient().listCategories(...args)');
    expect(serviceSource).toContain('createCategory: (...args) => getClient().createCategory(...args)');
    expect(serviceSource).toContain('updateCategory: (...args) => getClient().updateCategory(...args)');
  });

  it('returns approved common source and sender AlimTalk templates for an active Kakao sender resource', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(async ({ senderKey }) => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        templateListResponse: {
          pageSize: 1000,
          totalCount: senderKey === 'common-visuo-key' ? 2 : 1,
          templates:
            senderKey === 'common-visuo-key'
              ? [
                  createAlimtalkTemplate({
                    senderKey: 'common-visuo-key',
                    plusFriendId: '@비주오',
                    plusFriendType: 'GROUP',
                    templateCode: 'COMMON_VISUO_DELIVERY',
                    status: 'TSC03',
                  }),
                  createAlimtalkTemplate({
                    senderKey: 'common-visuo-key',
                    plusFriendId: '@비주오',
                    plusFriendType: 'GROUP',
                    templateCode: 'COMMON_REJECTED',
                    status: 'TSC04',
                  }),
                ]
              : senderKey === 'common-publ-key'
                ? [
                    createAlimtalkTemplate({
                      senderKey: 'common-publ-key',
                      plusFriendId: '@publ',
                      plusFriendType: 'GROUP',
                      templateCode: 'COMMON_PUBL_NOTICE',
                      status: 'APR',
                    }),
                  ]
                : [
                  createAlimtalkTemplate({
                    senderKey: 'sender-key-1',
                    plusFriendId: '@store',
                    plusFriendType: 'NORMAL',
                    templateCode: 'USER_PICKUP',
                    status: 'APR',
                  }),
                ],
        },
      })),
      getAlimtalkTemplate: vi.fn(),
    };
    const service = createTestService({
      repository,
      kakaoClient,
      alimtalkCommonTemplateSources: [
        { id: 'visuo', label: '@비주오', senderKey: 'common-visuo-key' },
        { id: 'publ', label: '@publ', senderKey: 'common-publ-key' },
      ],
    });

    const result = await service.listAlimtalkTemplates({
      actorUserId: 'user_1',
      senderResourceId: 'kakao_resource_1',
    });

    expect(kakaoClient.listAlimtalkTemplates).toHaveBeenCalledWith({
      senderKey: 'common-visuo-key',
      templateStatus: 'TSC03',
      pageNum: 1,
      pageSize: 1000,
    });
    expect(kakaoClient.listAlimtalkTemplates).toHaveBeenCalledWith({
      senderKey: 'common-publ-key',
      templateStatus: 'TSC03',
      pageNum: 1,
      pageSize: 1000,
    });
    expect(kakaoClient.listAlimtalkTemplates).toHaveBeenCalledWith({
      senderKey: 'sender-key-1',
      templateStatus: 'TSC03',
      pageNum: 1,
      pageSize: 1000,
    });
    expect(result.templates.map((template) => [template.source, template.sourceKey, template.templateCode])).toEqual([
      [TEMPLATE_SOURCES.GROUP, 'common-visuo-key', 'COMMON_VISUO_DELIVERY'],
      [TEMPLATE_SOURCES.GROUP, 'common-publ-key', 'COMMON_PUBL_NOTICE'],
      [TEMPLATE_SOURCES.SENDER_PROFILE, 'sender-key-1', 'USER_PICKUP'],
    ]);
    expect(result.templates[0]).toMatchObject({
      id: 'GROUP:common-visuo-key:COMMON_VISUO_DELIVERY',
      value: 'GROUP:common-visuo-key:COMMON_VISUO_DELIVERY',
      ownerKey: null,
      providerStatus: 'APR',
      requiredVariables: ['orderNo', 'customerName'],
      buttons: [
        {
          type: 'WL',
          name: 'View order',
        },
      ],
    });
  });

  it('returns common AlimTalk templates without duplicate sender-profile lookup when the lookup resource is common', async () => {
    const repository = createMemoryRepository({
      resources: [
        {
          id: 'kakao_common_publ',
          resourceRef: 'sr_kakao_common_publ',
          provider: 'nhn',
          type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
          value: 'common-publ-key',
          displayName: '@publ',
          status: 'active',
          providerStatus: 'active',
        },
      ],
      links: [
        {
          id: 'kakao_common_link',
          userId: 'user_1',
          senderResourceId: 'kakao_common_publ',
          billingAccountId: 'billing_1',
          role: 'owner',
          status: 'active',
          isDefault: true,
        },
      ],
    });
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(async ({ senderKey }) => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        templateListResponse: {
          pageSize: 1000,
          totalCount: 1,
          templates: [
            createAlimtalkTemplate({
              senderKey,
              plusFriendId: senderKey === 'common-visuo-key' ? '@비주오' : '@publ',
              plusFriendType: 'GROUP',
              templateCode: senderKey === 'common-visuo-key' ? 'COMMON_VISUO' : 'COMMON_PUBL',
              status: 'TSC03',
            }),
          ],
        },
      })),
      getAlimtalkTemplate: vi.fn(),
    };
    const service = createTestService({
      repository,
      kakaoClient,
      alimtalkCommonTemplateSources: [
        { id: 'visuo', label: '@비주오', senderKey: 'common-visuo-key' },
        { id: 'publ', label: '@publ', senderKey: 'common-publ-key' },
      ],
    });

    const result = await service.listAlimtalkTemplates({
      actorUserId: 'user_1',
      senderResourceId: 'kakao_common_publ',
    });

    expect(kakaoClient.listAlimtalkTemplates).toHaveBeenCalledTimes(2);
    expect(kakaoClient.listAlimtalkTemplates.mock.calls.map(([call]) => call.senderKey)).toEqual([
      'common-visuo-key',
      'common-publ-key',
    ]);
    expect(result.templates.map((template) => [template.source, template.sourceKey, template.templateCode])).toEqual([
      [TEMPLATE_SOURCES.GROUP, 'common-visuo-key', 'COMMON_VISUO'],
      [TEMPLATE_SOURCES.GROUP, 'common-publ-key', 'COMMON_PUBL'],
    ]);
  });

  it('returns common AlimTalk templates for an active user without a Kakao sender resource', async () => {
    const repository = createMemoryRepository({ resources: [], links: [] });
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(async ({ senderKey }) => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        templateListResponse: {
          pageSize: 1000,
          totalCount: 1,
          templates: [
            createAlimtalkTemplate({
              senderKey,
              plusFriendId: senderKey === 'common-visuo-key' ? '@비주오' : '@publ',
              plusFriendType: 'GROUP',
              templateCode: senderKey === 'common-visuo-key' ? 'COMMON_VISUO' : 'COMMON_PUBL',
              status: 'TSC03',
            }),
          ],
        },
      })),
      getAlimtalkTemplate: vi.fn(),
    };
    const service = createTestService({
      repository,
      kakaoClient,
      alimtalkCommonTemplateSources: [
        { id: 'visuo', label: '@비주오', senderKey: 'common-visuo-key' },
        { id: 'publ', label: '@publ', senderKey: 'common-publ-key' },
      ],
    });

    const result = await service.listAlimtalkTemplates({
      actorUserId: 'user_1',
      query: { templateStatus: 'TSC03' },
    });

    expect(kakaoClient.listAlimtalkTemplates.mock.calls.map(([call]) => call.senderKey)).toEqual([
      'common-visuo-key',
      'common-publ-key',
    ]);
    expect(result.senderResource).toBeNull();
    expect(result.templates.map((template) => [template.source, template.sourceKey, template.templateCode])).toEqual([
      [TEMPLATE_SOURCES.GROUP, 'common-visuo-key', 'COMMON_VISUO'],
      [TEMPLATE_SOURCES.GROUP, 'common-publ-key', 'COMMON_PUBL'],
    ]);
  });

  it('passes AlimTalk template name and status filters to NHN', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        templateListResponse: {
          pageSize: 1000,
          totalCount: 1,
          templates: [
            createAlimtalkTemplate({
              senderKey: 'sender-key-1',
              plusFriendId: '@store',
              plusFriendType: 'NORMAL',
              templateCode: 'USER_REVIEW_WAITING',
              status: 'TSC02',
            }),
          ],
        },
      })),
      getAlimtalkTemplate: vi.fn(),
    };
    const service = createTestService({ repository, kakaoClient });

    const result = await service.listAlimtalkTemplates({
      actorUserId: 'user_1',
      senderResourceId: 'kakao_resource_1',
      query: {
        templateName: '리뷰',
        templateStatus: 'TSC02',
      },
    });

    expect(kakaoClient.listAlimtalkTemplates).toHaveBeenCalledWith({
      senderKey: 'sender-key-1',
      templateName: '리뷰',
      templateStatus: 'TSC02',
      pageNum: 1,
      pageSize: 1000,
    });
    expect(result.templates).toHaveLength(1);
    expect(result.templates[0]).toMatchObject({
      providerStatus: 'REQ',
      providerStatusCode: 'TSC02',
      templateCode: 'USER_REVIEW_WAITING',
    });
  });

  it('omits common AlimTalk templates when rejected status is requested', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(async ({ senderKey }) => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        templateListResponse: {
          pageSize: 1000,
          totalCount: 1,
          templates: [
            createAlimtalkTemplate({
              senderKey,
              plusFriendId: '@store',
              plusFriendType: 'NORMAL',
              templateCode: 'USER_REJECTED',
              status: 'TSC04',
            }),
          ],
        },
      })),
      getAlimtalkTemplate: vi.fn(),
    };
    const service = createTestService({
      repository,
      kakaoClient,
      alimtalkCommonTemplateSources: [
        { id: 'visuo', label: '@비주오', senderKey: 'common-visuo-key' },
        { id: 'publ', label: '@publ', senderKey: 'common-publ-key' },
      ],
    });

    const result = await service.listAlimtalkTemplates({
      actorUserId: 'user_1',
      senderResourceId: 'kakao_resource_1',
      query: { templateStatus: 'TSC04' },
    });

    expect(kakaoClient.listAlimtalkTemplates).toHaveBeenCalledTimes(1);
    expect(kakaoClient.listAlimtalkTemplates).toHaveBeenCalledWith({
      senderKey: 'sender-key-1',
      templateStatus: 'TSC04',
      pageNum: 1,
      pageSize: 1000,
    });
    expect(result.templates.map((template) => [template.source, template.sourceKey, template.templateCode])).toEqual([
      [TEMPLATE_SOURCES.SENDER_PROFILE, 'sender-key-1', 'USER_REJECTED'],
    ]);
  });

  it('rejects unsupported AlimTalk template status filters before calling NHN', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(),
      getAlimtalkTemplate: vi.fn(),
    };
    const service = createTestService({ repository, kakaoClient });

    await expect(
      service.listAlimtalkTemplates({
        actorUserId: 'user_1',
        senderResourceId: 'kakao_resource_1',
        query: { templateStatus: 'WAITING' },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      status: 400,
    });
    expect(kakaoClient.listAlimtalkTemplates).not.toHaveBeenCalled();
  });

  it('creates an AlimTalk template with an active Kakao sender resource and provider-safe body', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(),
      getAlimtalkTemplate: vi.fn(),
      createAlimtalkTemplate: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        template: createAlimtalkTemplate({
          senderKey: 'sender-key-1',
          plusFriendId: '@store',
          plusFriendType: 'NORMAL',
          templateCode: 'ORDER_CREATED',
          status: 'TSC02',
        }),
      })),
      listBrandTemplates: vi.fn(),
      getBrandTemplate: vi.fn(),
      createBrandTemplate: vi.fn(),
    };
    const service = createTestService({ repository, kakaoClient });

    const result = await service.createAlimtalkTemplate({
      actorUserId: 'user_1',
      payload: {
        senderResourceId: 'kakao_resource_1',
        templateCode: 'ORDER_CREATED',
        templateName: '  주문 생성 안내  ',
        templateContent: '주문 #{orderNo} 생성 완료',
        templateMessageType: 'BA',
        templateEmphasizeType: 'NONE',
      },
    });

    expect(kakaoClient.createAlimtalkTemplate).toHaveBeenCalledWith({
      senderKey: 'sender-key-1',
      body: {
        templateCode: 'ORDER_CREATED',
        templateName: '주문 생성 안내',
        templateContent: '주문 #{orderNo} 생성 완료',
        templateMessageType: 'BA',
        templateEmphasizeType: 'NONE',
      },
    });
    expect(result).toMatchObject({
      channel: CHANNELS.ALIMTALK,
      senderResource: {
        id: 'kakao_resource_1',
        type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
      },
      templateCode: 'ORDER_CREATED',
      template: {
        channel: CHANNELS.ALIMTALK,
        source: TEMPLATE_SOURCES.SENDER_PROFILE,
        sourceKey: 'sender-key-1',
        templateCode: 'ORDER_CREATED',
        providerStatus: 'REQ',
        requiredVariables: ['orderNo', 'customerName'],
      },
    });
  });

  it('requires an active Kakao sender resource before creating an AlimTalk template', async () => {
    const repository = createMemoryRepository({
      links: [
        {
          id: 'inactive_link',
          userId: 'user_1',
          senderResourceId: 'kakao_resource_1',
          billingAccountId: 'billing_1',
          role: 'owner',
          status: 'pending',
          isDefault: false,
        },
      ],
    });
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(),
      getAlimtalkTemplate: vi.fn(),
      createAlimtalkTemplate: vi.fn(),
      listBrandTemplates: vi.fn(),
      getBrandTemplate: vi.fn(),
      createBrandTemplate: vi.fn(),
    };
    const service = createTestService({ repository, kakaoClient });

    await expect(
      service.createAlimtalkTemplate({
        actorUserId: 'user_1',
        payload: {
          senderResourceId: 'kakao_resource_1',
          templateCode: 'ORDER_CREATED',
          templateName: '주문 생성 안내',
          templateContent: '주문 생성 완료',
          templateMessageType: 'BA',
          templateEmphasizeType: 'NONE',
        },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.FORBIDDEN,
      status: 403,
    });
    expect(kakaoClient.createAlimtalkTemplate).not.toHaveBeenCalled();
  });

  it('returns usable SMS templates filtered by the selected active sender number', async () => {
    const repository = createMemoryRepository();
    const smsClient = {
      listTemplates: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          pageSize: 1000,
          totalCount: 4,
          data: [
            createSmsTemplate({
              templateId: 'SMS_MATCH',
              sendNo: '1544-6859',
              useYn: 'Y',
              body: 'Hello ##name##',
            }),
            createSmsTemplate({
              templateId: 'SMS_OTHER_SEND_NO',
              sendNo: '0200000000',
              useYn: 'Y',
            }),
            createSmsTemplate({
              templateId: 'SMS_DISABLED',
              sendNo: '15446859',
              useYn: 'N',
            }),
            createSmsTemplate({
              templateId: 'SMS_DELETED',
              sendNo: '15446859',
              useYn: 'Y',
              delYn: 'Y',
            }),
          ],
        },
      })),
      getTemplate: vi.fn(),
    };
    const service = createTestService({ repository, smsClient });

    const result = await service.listSmsTemplates({
      actorUserId: 'user_1',
      senderResourceId: 'sms_resource_1',
    });

    expect(smsClient.listTemplates).toHaveBeenCalledWith({
      useYn: 'Y',
      pageNum: 1,
      pageSize: 1000,
    });
    expect(result.templates).toHaveLength(1);
    expect(result.templates[0]).toMatchObject({
      templateId: 'SMS_MATCH',
      channel: 'sms',
      sendNo: '1544-6859',
      requiredVariables: ['name'],
      attachments: [
        {
          fileId: 123,
          fileName: 'notice.jpg',
          uploadType: 'TEMPORARY',
        },
      ],
    });
    expect(result.templates[0].attachments[0].filePath).toBeUndefined();
    expect(result.templates[0].attachments[0].saveFileName).toBeUndefined();
  });

  it('passes SMS template name filters to NHN', async () => {
    const repository = createMemoryRepository();
    const smsClient = {
      listTemplates: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          pageSize: 1000,
          totalCount: 1,
          data: [
            createSmsTemplate({
              templateId: 'SMS_PICKUP',
              sendNo: '15446859',
              useYn: 'Y',
            }),
          ],
        },
      })),
      getTemplate: vi.fn(),
    };
    const service = createTestService({ repository, smsClient });

    const result = await service.listSmsTemplates({
      actorUserId: 'user_1',
      senderResourceId: 'sms_resource_1',
      query: { templateName: '픽업' },
    });

    expect(smsClient.listTemplates).toHaveBeenCalledWith({
      useYn: 'Y',
      templateName: '픽업',
      pageNum: 1,
      pageSize: 1000,
    });
    expect(result.templates).toHaveLength(1);
    expect(result.templates[0]).toMatchObject({
      templateId: 'SMS_PICKUP',
      templateName: 'SMS_PICKUP name',
    });
  });

  it('uploads SMS MMS template attachments through an active SMS sender resource', async () => {
    const repository = createMemoryRepository();
    const fileBody = Buffer.from('jpeg-bytes').toString('base64');
    const smsClient = {
      listTemplates: vi.fn(),
      getTemplate: vi.fn(),
      createTemplate: vi.fn(),
      uploadAttachFile: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          data: {
            fileId: '123',
            fileName: 'provider-name.jpg',
            filePath: '/provider/internal/path',
            saveFileName: 'secret-name.jpg',
            uploadType: 'TEMPORARY',
          },
        },
      })),
    };
    const service = createTestService({ repository, smsClient });

    const result = await service.uploadSmsTemplateAttachment({
      actorUserId: 'user_1',
      payload: {
        senderResourceId: 'sms_resource_1',
        fileName: 'notice.jpg',
        fileBody,
      },
    });

    expect(smsClient.uploadAttachFile).toHaveBeenCalledWith({
      fileName: 'notice.jpg',
      fileBody,
      createUser: 'user_1',
    });
    expect(result).toEqual({
      channel: CHANNELS.SMS,
      senderResource: {
        id: 'sms_resource_1',
        resourceRef: 'sr_sms_1',
        provider: 'nhn',
        type: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
        value: '15446859',
        displayName: '1544-6859',
        status: 'active',
        providerStatus: 'approved',
      },
      fileId: 123,
      fileName: 'notice.jpg',
      byteSize: 10,
    });
    expect(JSON.stringify(result)).not.toContain(fileBody);
    expect(JSON.stringify(result)).not.toContain('/provider/internal/path');
    expect(JSON.stringify(result)).not.toContain('secret-name.jpg');
    expect(JSON.stringify(result)).not.toContain('provider-name.jpg');
  });

  it('requires an actor-owned active SMS sender resource before uploading template attachments', async () => {
    const inactiveRepository = createMemoryRepository({
      links: [
        {
          id: 'inactive_sms_link',
          userId: 'user_1',
          senderResourceId: 'sms_resource_1',
          billingAccountId: 'billing_1',
          role: 'owner',
          status: 'pending',
          isDefault: false,
        },
      ],
    });
    const unrelatedRepository = createMemoryRepository({
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
          id: 'user_2',
          userRef: 'user_2_ref',
          email: 'other@example.com',
          name: 'Other user',
          status: 'active',
          isOperator: false,
        },
      ],
    });
    const uploadAttachFile = vi.fn();
    const inactiveService = createTestService({
      repository: inactiveRepository,
      smsClient: { listTemplates: vi.fn(), getTemplate: vi.fn(), createTemplate: vi.fn(), uploadAttachFile },
    });
    const unrelatedService = createTestService({
      repository: unrelatedRepository,
      smsClient: { listTemplates: vi.fn(), getTemplate: vi.fn(), createTemplate: vi.fn(), uploadAttachFile },
    });
    const payload = {
      senderResourceId: 'sms_resource_1',
      fileName: 'notice.jpg',
      fileBody: Buffer.from('jpeg-bytes').toString('base64'),
    };

    await expect(
      inactiveService.uploadSmsTemplateAttachment({ actorUserId: 'user_1', payload })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.FORBIDDEN,
      status: 403,
    });
    await expect(
      unrelatedService.uploadSmsTemplateAttachment({ actorUserId: 'user_2', payload })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.FORBIDDEN,
      status: 403,
    });
    expect(uploadAttachFile).not.toHaveBeenCalled();
  });

  it('rejects invalid SMS MMS template attachment uploads before calling the provider', async () => {
    const repository = createMemoryRepository();
    const smsClient = {
      listTemplates: vi.fn(),
      getTemplate: vi.fn(),
      createTemplate: vi.fn(),
      uploadAttachFile: vi.fn(),
    };
    const service = createTestService({ repository, smsClient });
    const basePayload = {
      senderResourceId: 'sms_resource_1',
      fileName: 'notice.jpg',
      fileBody: Buffer.from('jpeg-bytes').toString('base64'),
    };
    const oversizedFileBody = Buffer.alloc((300 * 1024) + 1, 1).toString('base64');
    const invalidPayloads = [
      { fileName: 'notice.png' },
      { fileBody: undefined },
      { fileBody: 'not base64 ###' },
      { fileBody: oversizedFileBody },
      { fileName: `${'a'.repeat(42)}.jpeg` },
    ];

    for (const invalidFields of invalidPayloads) {
      await expect(
        service.uploadSmsTemplateAttachment({
          actorUserId: 'user_1',
          payload: {
            ...basePayload,
            ...invalidFields,
          },
        })
      ).rejects.toMatchObject({
        code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
        status: 400,
      });
    }

    expect(smsClient.uploadAttachFile).not.toHaveBeenCalled();
  });

  it('creates SMS templates with the resolved sender number and provider detail DTO', async () => {
    const repository = createMemoryRepository();
    const smsClient = {
      listTemplates: vi.fn(),
      createTemplate: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      })),
      getTemplate: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          data: createSmsTemplate({
            templateId: 'SMS_REGISTERED',
            sendNo: '15446859',
            useYn: 'Y',
            body: 'Pickup code ##code##',
            sendType: '0',
            attachFileYn: 'N',
            attachFileList: [],
          }),
        },
      })),
    };
    const service = createTestService({ repository, smsClient });

    const result = await service.createSmsTemplate({
      actorUserId: 'user_1',
      payload: {
        senderResourceId: 'sms_resource_1',
        templateId: '  SMS_REGISTERED  ',
        templateName: '  Pickup SMS  ',
        templateDesc: '  Pickup code  ',
        sendType: '0',
        body: '  Pickup code ##code##  ',
        useYn: 'y',
        debugDraftField: 'drop-me',
      },
    });

    expect(smsClient.createTemplate).toHaveBeenCalledWith({
      categoryId: 1,
      templateId: 'SMS_REGISTERED',
      templateName: 'Pickup SMS',
      templateDesc: 'Pickup code',
      sendNo: '15446859',
      sendType: '0',
      body: 'Pickup code ##code##',
      useYn: 'Y',
    });
    expect(smsClient.getTemplate).toHaveBeenCalledWith({ templateId: 'SMS_REGISTERED' });
    expect(result).toMatchObject({
      channel: CHANNELS.SMS,
      senderResource: {
        id: 'sms_resource_1',
        type: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
      },
      templateCode: 'SMS_REGISTERED',
      template: {
        channel: CHANNELS.SMS,
        templateId: 'SMS_REGISTERED',
        templateCode: 'SMS_REGISTERED',
        sendNo: '15446859',
        body: 'Pickup code ##code##',
        requiredVariables: ['code'],
      },
    });
    expect(result.header).toBeUndefined();
    expect(result.template.senderResourceId).toBeUndefined();
  });

  it('ensures a NOTI child category for the user before creating SMS templates', async () => {
    const repository = createMemoryRepository();
    const smsClient = {
      listCategories: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          data: [
            {
              categoryId: 50,
              categoryParentId: 0,
              categoryName: 'Category',
              categoryDesc: 'Provider root category',
              useYn: 'Y',
            },
          ],
        },
      })),
      createCategory: vi.fn(async (payload) => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          data: {
            categoryId: payload.categoryName === 'NOTI' ? 100 : 101,
            categoryParentId: payload.categoryParentId ?? 0,
            categoryName: payload.categoryName,
            categoryDesc: payload.categoryDesc,
            useYn: payload.useYn,
          },
        },
      })),
      listTemplates: vi.fn(),
      createTemplate: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      })),
      getTemplate: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          data: createSmsTemplate({
            templateId: 'SMS_USER_CATEGORY',
            sendNo: '15446859',
            useYn: 'Y',
            body: 'Body',
            sendType: '0',
          }),
        },
      })),
    };
    const service = createTestService({ repository, smsClient });

    await service.createSmsTemplate({
      actorUserId: 'user_1',
      payload: {
        senderResourceId: 'sms_resource_1',
        templateId: 'SMS_USER_CATEGORY',
        templateName: 'User category SMS',
        sendType: '0',
        body: 'Body',
        useYn: 'Y',
      },
    });

    expect(smsClient.createCategory).toHaveBeenCalledWith({
      categoryParentId: 50,
      categoryName: 'NOTI',
      categoryDesc: 'Messaging App notifications',
      useYn: 'Y',
      createUser: 'messaging-app',
    });
    expect(smsClient.createCategory).toHaveBeenCalledWith({
      categoryParentId: 100,
      categoryName: 'user_1_ref',
      categoryDesc: 'Messaging App user user_1_ref',
      useYn: 'Y',
      createUser: 'messaging-app',
    });
    expect(smsClient.createTemplate).toHaveBeenCalledWith(expect.objectContaining({
      categoryId: 101,
      templateId: 'SMS_USER_CATEGORY',
    }));
  });

  it('reactivates existing NOTI user categories before creating SMS templates', async () => {
    const repository = createMemoryRepository();
    const smsClient = {
      listCategories: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          data: [
            {
              categoryId: 50,
              categoryParentId: 0,
              categoryName: 'Category',
              categoryDesc: 'Provider root category',
              useYn: 'Y',
            },
            {
              categoryId: 100,
              categoryParentId: 50,
              categoryName: 'NOTI',
              categoryDesc: 'Messaging App notifications',
              useYn: 'N',
            },
            {
              categoryId: 101,
              categoryParentId: 100,
              categoryName: 'user_1_ref',
              categoryDesc: 'Messaging App user user_1_ref',
              useYn: 'N',
            },
          ],
        },
      })),
      createCategory: vi.fn(),
      updateCategory: vi.fn(async ({ categoryId, ...payload }) => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          data: {
            categoryId,
            categoryParentId: categoryId === 100 ? 50 : 100,
            categoryName: payload.categoryName,
            categoryDesc: payload.categoryDesc,
            useYn: payload.useYn,
          },
        },
      })),
      listTemplates: vi.fn(),
      createTemplate: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      })),
      getTemplate: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          data: createSmsTemplate({
            templateId: 'SMS_ACTIVE_CATEGORY',
            sendNo: '15446859',
            useYn: 'Y',
            body: 'Body',
            sendType: '0',
          }),
        },
      })),
    };
    const service = createTestService({ repository, smsClient });

    await service.createSmsTemplate({
      actorUserId: 'user_1',
      payload: {
        senderResourceId: 'sms_resource_1',
        templateId: 'SMS_ACTIVE_CATEGORY',
        templateName: 'Active category SMS',
        sendType: '0',
        body: 'Body',
        useYn: 'Y',
      },
    });

    expect(smsClient.createCategory).not.toHaveBeenCalled();
    expect(smsClient.updateCategory).toHaveBeenCalledWith({
      categoryId: 100,
      categoryName: 'NOTI',
      categoryDesc: 'Messaging App notifications',
      useYn: 'Y',
      updateUser: 'messaging-app',
    });
    expect(smsClient.updateCategory).toHaveBeenCalledWith({
      categoryId: 101,
      categoryName: 'user_1_ref',
      categoryDesc: 'Messaging App user user_1_ref',
      useYn: 'Y',
      updateUser: 'messaging-app',
    });
    expect(smsClient.createTemplate).toHaveBeenCalledWith(expect.objectContaining({
      categoryId: 101,
      templateId: 'SMS_ACTIVE_CATEGORY',
    }));
  });

  it('creates SMS-family templates with provider-safe payloads and fallback DTOs', async () => {
    const repository = createMemoryRepository();
    const smsClient = {
      listTemplates: vi.fn(),
      createTemplate: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      })),
      getTemplate: vi.fn(async () => {
        throw new NhnProviderError({
          status: 404,
          providerCode: '404',
          providerMessage: 'Template is not available yet.',
        });
      }),
    };
    const service = createTestService({ repository, smsClient });
    const cases = [
      {
        payload: {
          senderResourceId: 'sms_resource_1',
          templateId: 'SMS_CREATE',
          templateName: 'SMS create',
          sendType: '0',
          body: 'Short ##code##',
          useYn: 'Y',
        },
        expectedChannel: CHANNELS.SMS,
        expectedPayload: {
          categoryId: 1,
          templateId: 'SMS_CREATE',
          templateName: 'SMS create',
          sendNo: '15446859',
          sendType: '0',
          body: 'Short ##code##',
          useYn: 'Y',
        },
      },
      {
        payload: {
          senderResourceId: 'sms_resource_1',
          templateId: 'LMS_CREATE',
          templateName: 'LMS create',
          sendType: '1',
          title: 'Notice',
          body: 'Long body ##code##',
          useYn: 'Y',
        },
        expectedChannel: CHANNELS.LMS,
        expectedPayload: {
          categoryId: 1,
          templateId: 'LMS_CREATE',
          templateName: 'LMS create',
          sendNo: '15446859',
          sendType: '1',
          title: 'Notice',
          body: 'Long body ##code##',
          useYn: 'Y',
        },
      },
      {
        payload: {
          senderResourceId: 'sms_resource_1',
          templateId: 'MMS_CREATE',
          templateName: 'MMS create',
          sendType: '1',
          title: 'Image notice',
          body: 'Image body ##code##',
          useYn: 'Y',
          attachFileIdList: [123],
        },
        expectedChannel: CHANNELS.MMS,
        expectedPayload: {
          categoryId: 1,
          templateId: 'MMS_CREATE',
          templateName: 'MMS create',
          sendNo: '15446859',
          sendType: '1',
          title: 'Image notice',
          body: 'Image body ##code##',
          useYn: 'Y',
          attachFileIdList: [123],
        },
      },
    ];

    for (const [index, testCase] of cases.entries()) {
      const result = await service.createSmsTemplate({
        actorUserId: 'user_1',
        payload: testCase.payload,
      });

      expect(smsClient.createTemplate.mock.calls[index][0]).toEqual(testCase.expectedPayload);
      expect(result.template).toMatchObject({
        channel: testCase.expectedChannel,
        templateId: testCase.payload.templateId,
        templateCode: testCase.payload.templateId,
        sendNo: '15446859',
        requiredVariables: ['code'],
      });
    }

    expect(smsClient.getTemplate).toHaveBeenCalledTimes(3);
    expect(smsClient.createTemplate.mock.calls[2][0]).not.toHaveProperty('content');
    expect(smsClient.createTemplate.mock.calls[2][0]).not.toHaveProperty('recipientList');
  });

  it('rejects browser-supplied SMS sender numbers before provider calls', async () => {
    const repository = createMemoryRepository();
    const smsClient = {
      listTemplates: vi.fn(),
      createTemplate: vi.fn(),
      getTemplate: vi.fn(),
    };
    const service = createTestService({ repository, smsClient });

    await expect(
      service.createSmsTemplate({
        actorUserId: 'user_1',
        payload: {
          senderResourceId: 'sms_resource_1',
          sendNo: '0200000000',
          templateId: 'SMS_BROWSER_SEND_NO',
          templateName: 'Browser sendNo',
          sendType: '0',
          body: 'Body',
          useYn: 'Y',
        },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      status: 400,
    });
    expect(smsClient.createTemplate).not.toHaveBeenCalled();
  });

  it('rejects browser-supplied SMS template category ids before provider calls', async () => {
    const repository = createMemoryRepository();
    const smsClient = {
      listCategories: vi.fn(),
      createCategory: vi.fn(),
      listTemplates: vi.fn(),
      createTemplate: vi.fn(),
      getTemplate: vi.fn(),
    };
    const service = createTestService({ repository, smsClient });

    await expect(
      service.createSmsTemplate({
        actorUserId: 'user_1',
        payload: {
          senderResourceId: 'sms_resource_1',
          categoryId: 123,
          templateId: 'SMS_BROWSER_CATEGORY',
          templateName: 'Browser category',
          sendType: '0',
          body: 'Body',
          useYn: 'Y',
        },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      status: 400,
    });
    expect(smsClient.createCategory).not.toHaveBeenCalled();
    expect(smsClient.createTemplate).not.toHaveBeenCalled();
  });

  it('rejects invalid SMS template registration fields before provider calls', async () => {
    const repository = createMemoryRepository();
    const smsClient = {
      listTemplates: vi.fn(),
      createTemplate: vi.fn(),
      getTemplate: vi.fn(),
    };
    const service = createTestService({ repository, smsClient });
    const basePayload = {
      senderResourceId: 'sms_resource_1',
      templateId: 'SMS_VALID',
      templateName: 'Valid template',
      sendType: '0',
      body: 'Body',
      useYn: 'Y',
    };
    const invalidPayloads = [
      { templateId: 'x'.repeat(51) },
      { templateName: 'x'.repeat(51) },
      { templateDesc: 'x'.repeat(101) },
      { sendType: '2' },
      { sendType: '1' },
      { sendType: '1', title: 'x'.repeat(121) },
      { body: 'x'.repeat(4001) },
      { useYn: 'maybe' },
      { attachFileIdList: ['file-id'] },
    ];

    for (const invalidFields of invalidPayloads) {
      await expect(
        service.createSmsTemplate({
          actorUserId: 'user_1',
          payload: {
            ...basePayload,
            ...invalidFields,
          },
        })
      ).rejects.toMatchObject({
        code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
        status: 400,
      });
    }

    expect(smsClient.createTemplate).not.toHaveBeenCalled();
  });

  it('rejects Notification Hub and send-only SMS template fields before provider calls', async () => {
    const repository = createMemoryRepository();
    const smsClient = {
      listTemplates: vi.fn(),
      createTemplate: vi.fn(),
      getTemplate: vi.fn(),
    };
    const service = createTestService({ repository, smsClient });
    const forbiddenPayloads = [
      { messagePurpose: 'NORMAL' },
      { templateLanguage: 'ko' },
      { sender: { phoneNumber: '15446859' } },
      { content: 'Notification Hub body' },
      { recipientList: [{ recipientNo: '01012345678' }] },
      { templateParameter: { code: '1234' } },
      { requestDate: '2026-06-02 15:00' },
      { scheduledAt: '2026-06-02T06:00:00.000Z' },
      { senderGroupingKey: 'browser-grouping-key' },
      { recipientGroupingKey: 'browser-recipient-grouping-key' },
      { unsubscribeNo: '0801234567' },
    ];

    for (const forbiddenFields of forbiddenPayloads) {
      await expect(
        service.createSmsTemplate({
          actorUserId: 'user_1',
          payload: {
            senderResourceId: 'sms_resource_1',
            categoryId: 1,
            templateId: 'SMS_FORBIDDEN',
            templateName: 'Forbidden field',
            sendType: '0',
            body: 'Body',
            useYn: 'Y',
            ...forbiddenFields,
          },
        })
      ).rejects.toMatchObject({
        code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
        status: 400,
      });
    }

    expect(smsClient.createTemplate).not.toHaveBeenCalled();
  });

  it('normalizes SMS template channels from send type and attachment metadata', async () => {
    const repository = createMemoryRepository();
    const smsClient = {
      listTemplates: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          pageSize: 1000,
          totalCount: 3,
          data: [
            createSmsTemplate({
              templateId: 'SMS_WITH_PROVIDER_ATTACHMENTS',
              sendNo: '15446859',
              useYn: 'Y',
              sendType: '0',
              attachFileYn: 'Y',
            }),
            createSmsTemplate({
              templateId: 'LMS_NO_ATTACHMENTS',
              sendNo: '15446859',
              useYn: 'Y',
              sendType: '1',
              attachFileYn: 'N',
              attachFileList: [],
            }),
            createSmsTemplate({
              templateId: 'MMS_WITH_ATTACHMENTS',
              sendNo: '15446859',
              useYn: 'Y',
              sendType: '1',
              attachFileYn: 'Y',
            }),
          ],
        },
      })),
      getTemplate: vi.fn(),
    };
    const service = createTestService({ repository, smsClient });

    const result = await service.listSmsTemplates({
      actorUserId: 'user_1',
      senderResourceId: 'sms_resource_1',
    });
    const channelsByTemplateId = Object.fromEntries(
      result.templates.map((template) => [template.templateId, template.channel])
    );

    expect(channelsByTemplateId).toEqual({
      SMS_WITH_PROVIDER_ATTACHMENTS: CHANNELS.SMS,
      LMS_NO_ATTACHMENTS: CHANNELS.LMS,
      MMS_WITH_ATTACHMENTS: CHANNELS.MMS,
    });
  });

  it('returns usable Brand Message templates for an active Kakao sender resource', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(),
      getAlimtalkTemplate: vi.fn(),
      listBrandTemplates: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        templateListResponse: {
          pageSize: 1000,
          totalCount: 3,
          templates: [
            createBrandTemplate({
              senderKey: 'sender-key-1',
              templateCode: 'BRAND_WELCOME',
              status: 'A',
              content: '안녕하세요 #{name}님',
            }),
            createBrandTemplate({
              senderKey: 'sender-key-1',
              templateCode: 'BRAND_REJECTED',
              status: 'S',
            }),
            createBrandTemplate({
              senderKey: 'sender-key-1',
              templateCode: 'BRAND_BLOCKED',
              status: 'A',
              block: true,
            }),
          ],
        },
      })),
      getBrandTemplate: vi.fn(),
    };
    const service = createTestService({ repository, kakaoClient });

    const result = await service.listBrandTemplates({
      actorUserId: 'user_1',
      senderResourceId: 'kakao_resource_1',
    });

    expect(kakaoClient.listBrandTemplates).toHaveBeenCalledWith({
      senderKey: 'sender-key-1',
      pageNum: 1,
      pageSize: 1000,
    });
    expect(result).toMatchObject({
      channel: CHANNELS.BRAND_MESSAGE,
      senderResource: {
        id: 'kakao_resource_1',
        type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
      },
    });
    expect(result.templates).toHaveLength(1);
    expect(result.templates[0]).toMatchObject({
      channel: CHANNELS.BRAND_MESSAGE,
      source: TEMPLATE_SOURCES.SENDER_PROFILE,
      templateCode: 'BRAND_WELCOME',
      providerStatus: 'A',
      requiredVariables: ['name'],
    });
  });

  it('preserves Brand Message rich template fields needed for preview reconstruction', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(),
      getAlimtalkTemplate: vi.fn(),
      listBrandTemplates: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        templateListResponse: {
          pageSize: 1000,
          totalCount: 6,
          templates: [
            createBrandTemplate({
              senderKey: 'sender-key-1',
              templateCode: 'BRAND_IMAGE',
              status: 'A',
              chatBubbleType: 'IMAGE',
              content: '이미지 #{name}',
              imageUrl: 'https://cdn.example.com/image.jpg',
              imageRatio: '2:1',
            }),
            createBrandTemplate({
              senderKey: 'sender-key-1',
              templateCode: 'BRAND_WIDE_LIST',
              status: 'A',
              chatBubbleType: 'WIDE_ITEM_LIST',
              header: '추천 #{name}',
              item: {
                list: [
                  { imageUrl: 'https://cdn.example.com/wide-main.jpg', title: '대표 #{name}' },
                  { image: { imageUrl: 'https://cdn.example.com/wide-row.jpg' }, title: '행사' },
                ],
              },
            }),
            createBrandTemplate({
              senderKey: 'sender-key-1',
              templateCode: 'BRAND_VIDEO',
              status: 'A',
              chatBubbleType: 'PREMIUM_VIDEO',
              header: '영상 헤더',
              imageUrl: 'https://cdn.example.com/video-cover.jpg',
              video: { title: '영상 #{name}', videoUrl: 'https://cdn.example.com/video.mp4' },
            }),
            createBrandTemplate({
              senderKey: 'sender-key-1',
              templateCode: 'BRAND_COMMERCE',
              status: 'A',
              chatBubbleType: 'COMMERCE',
              additionalContent: '오늘만 #{name}',
              commerce: {
                imageUrl: 'https://cdn.example.com/commerce.jpg',
                regularPrice: '59000',
                discountPrice: '39000',
                title: '상품 #{name}',
              },
            }),
            createBrandTemplate({
              senderKey: 'sender-key-1',
              templateCode: 'BRAND_CAROUSEL_FEED',
              status: 'A',
              chatBubbleType: 'CAROUSEL_FEED',
              carousel: {
                list: [
                  { content: '피드 1 #{name}', imageUrl: 'https://cdn.example.com/feed-1.jpg', title: '피드 1' },
                  { content: '피드 2', image: { imageUrl: 'https://cdn.example.com/feed-2.jpg' }, title: '피드 2' },
                ],
                tail: { isMoreButton: true, linkMo: 'https://example.com/feed-more' },
              },
            }),
            createBrandTemplate({
              senderKey: 'sender-key-1',
              templateCode: 'BRAND_CAROUSEL_COMMERCE',
              status: 'A',
              chatBubbleType: 'CAROUSEL_COMMERCE',
              carousel: {
                head: {
                  content: '인트로 #{name}',
                  header: '인트로',
                  imageUrl: 'https://cdn.example.com/intro.jpg',
                },
                isUseIntro: true,
                list: [
                  {
                    commerce: { regularPrice: '42000', discountPrice: '29000', title: '캐러셀 상품 #{name}' },
                    imageUrl: 'https://cdn.example.com/carousel-commerce.jpg',
                  },
                ],
                tail: { isMoreButton: true, linkMo: 'https://example.com/commerce-more' },
              },
            }),
          ],
        },
      })),
      getBrandTemplate: vi.fn(),
    };
    const service = createTestService({ repository, kakaoClient });

    const result = await service.listBrandTemplates({
      actorUserId: 'user_1',
      senderResourceId: 'kakao_resource_1',
    });
    const byCode = Object.fromEntries(result.templates.map((template) => [template.templateCode, template]));

    expect(byCode.BRAND_IMAGE).toMatchObject({
      image: { imageUrl: 'https://cdn.example.com/image.jpg' },
      imageRatio: '2:1',
      imageUrl: 'https://cdn.example.com/image.jpg',
      requiredVariables: ['name'],
    });
    expect(byCode.BRAND_WIDE_LIST).toMatchObject({
      header: '추천 #{name}',
      item: {
        list: [
          { imageUrl: 'https://cdn.example.com/wide-main.jpg', title: '대표 #{name}' },
          { image: { imageUrl: 'https://cdn.example.com/wide-row.jpg' }, title: '행사' },
        ],
      },
      items: [
        { imageUrl: 'https://cdn.example.com/wide-main.jpg', title: '대표 #{name}' },
        { image: { imageUrl: 'https://cdn.example.com/wide-row.jpg' }, title: '행사' },
      ],
    });
    expect(byCode.BRAND_VIDEO).toMatchObject({
      header: '영상 헤더',
      imageUrl: 'https://cdn.example.com/video-cover.jpg',
      video: { title: '영상 #{name}', videoUrl: 'https://cdn.example.com/video.mp4' },
    });
    expect(byCode.BRAND_COMMERCE).toMatchObject({
      additionalContent: '오늘만 #{name}',
      commerce: {
        imageUrl: 'https://cdn.example.com/commerce.jpg',
        regularPrice: '59000',
        discountPrice: '39000',
        title: '상품 #{name}',
      },
    });
    expect(byCode.BRAND_CAROUSEL_FEED).toMatchObject({
      carousel: {
        list: [
          { content: '피드 1 #{name}', imageUrl: 'https://cdn.example.com/feed-1.jpg', title: '피드 1' },
          { content: '피드 2', image: { imageUrl: 'https://cdn.example.com/feed-2.jpg' }, title: '피드 2' },
        ],
      },
      carouselItems: [
        { content: '피드 1 #{name}', imageUrl: 'https://cdn.example.com/feed-1.jpg', title: '피드 1' },
        { content: '피드 2', image: { imageUrl: 'https://cdn.example.com/feed-2.jpg' }, title: '피드 2' },
      ],
    });
    expect(byCode.BRAND_CAROUSEL_COMMERCE).toMatchObject({
      carousel: {
        head: {
          content: '인트로 #{name}',
          header: '인트로',
          imageUrl: 'https://cdn.example.com/intro.jpg',
        },
        list: [
          {
            commerce: { regularPrice: '42000', discountPrice: '29000', title: '캐러셀 상품 #{name}' },
            imageUrl: 'https://cdn.example.com/carousel-commerce.jpg',
          },
        ],
      },
      carouselItems: [
        {
          commerce: { regularPrice: '42000', discountPrice: '29000', title: '캐러셀 상품 #{name}' },
          imageUrl: 'https://cdn.example.com/carousel-commerce.jpg',
        },
      ],
    });
  });

  it('creates a Brand Message template with an active Kakao sender resource and provider-safe body', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(),
      getAlimtalkTemplate: vi.fn(),
      listBrandTemplates: vi.fn(),
      getBrandTemplate: vi.fn(),
      createBrandTemplate: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        template: createBrandTemplate({
          senderKey: 'sender-key-1',
          templateCode: 'BRAND_CREATED',
          status: 'APR',
          content: '등록 안내 #{name}',
        }),
      })),
    };
    const service = createTestService({ repository, kakaoClient });

    const result = await service.createBrandTemplate({
      actorUserId: 'user_1',
      payload: {
        senderResourceId: 'kakao_resource_1',
        templateName: '  등록 템플릿  ',
        chatBubbleType: 'TEXT',
        content: '등록 안내 #{name}',
        adult: false,
        buttons: [
          {
            ordering: 1,
            type: 'WL',
            name: 'Open',
            linkMo: 'https://example.com',
          },
        ],
        ignoredDraftOnlyField: 'drop-me',
      },
    });

    expect(kakaoClient.createBrandTemplate).toHaveBeenCalledWith({
      senderKey: 'sender-key-1',
      body: {
        templateName: '등록 템플릿',
        chatBubbleType: 'TEXT',
        content: '등록 안내 #{name}',
        adult: false,
        buttons: [
          {
            ordering: 1,
            type: 'WL',
            name: 'Open',
            linkMo: 'https://example.com',
          },
        ],
      },
    });
    expect(result).toMatchObject({
      channel: CHANNELS.BRAND_MESSAGE,
      senderResource: {
        id: 'kakao_resource_1',
        type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
      },
      templateCode: 'BRAND_CREATED',
      template: {
        channel: CHANNELS.BRAND_MESSAGE,
        templateCode: 'BRAND_CREATED',
        templateName: 'BRAND_CREATED name',
        requiredVariables: ['name'],
      },
    });
    expect(result.template.senderResourceId).toBeUndefined();
    expect(result.template.ownerKey).toBe('sender-key-1');
  });

  it('requires an active Kakao sender resource before creating a Brand Message template', async () => {
    const repository = createMemoryRepository({
      links: [
        {
          id: 'inactive_link',
          userId: 'user_1',
          senderResourceId: 'kakao_resource_1',
          billingAccountId: 'billing_1',
          role: 'owner',
          status: 'pending',
          isDefault: false,
        },
      ],
    });
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(),
      getAlimtalkTemplate: vi.fn(),
      listBrandTemplates: vi.fn(),
      getBrandTemplate: vi.fn(),
      createBrandTemplate: vi.fn(),
    };
    const service = createTestService({ repository, kakaoClient });

    await expect(
      service.createBrandTemplate({
        actorUserId: 'user_1',
        payload: {
          senderResourceId: 'kakao_resource_1',
          templateName: '등록 템플릿',
          chatBubbleType: 'TEXT',
          content: '등록 안내',
        },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.FORBIDDEN,
      status: 403,
    });
    expect(kakaoClient.createBrandTemplate).not.toHaveBeenCalled();
  });

  it('rejects send-only Brand Message template registration fields before calling the provider', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(),
      getAlimtalkTemplate: vi.fn(),
      listBrandTemplates: vi.fn(),
      getBrandTemplate: vi.fn(),
      createBrandTemplate: vi.fn(),
    };
    const service = createTestService({ repository, kakaoClient });
    const forbiddenPayloads = [
      { clientRequestId: 'de305d54-75b4-431b-adb2-eb6b9e546014' },
      { senderKey: 'browser-controlled-sender-key' },
      { recipientList: [{ recipientNo: '01012345678' }] },
      { fallback: { enabled: true } },
      { requestDate: '2026-06-02 15:00' },
      { senderGroupingKey: 'browser-grouping-key' },
      { createUser: 'browser-user' },
      { statsId: 'stats1' },
      { resellerCode: 'reseller1' },
      { unsubscribeNo: '0801234567' },
    ];

    for (const forbiddenFields of forbiddenPayloads) {
      await expect(
        service.createBrandTemplate({
          actorUserId: 'user_1',
          payload: {
            senderResourceId: 'kakao_resource_1',
            templateName: '등록 템플릿',
            chatBubbleType: 'TEXT',
            content: '등록 안내',
            ...forbiddenFields,
          },
        })
      ).rejects.toMatchObject({
        code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
        status: 400,
      });
    }

    expect(kakaoClient.createBrandTemplate).not.toHaveBeenCalled();
  });

  it('strips unknown and type-mismatched fields from the Brand Message template provider body', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(),
      getAlimtalkTemplate: vi.fn(),
      listBrandTemplates: vi.fn(),
      getBrandTemplate: vi.fn(),
      createBrandTemplate: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: { data: { templateCode: 'BRAND_STRIPPED', templateName: '등록 템플릿', content: '등록 안내' } },
      })),
    };
    const service = createTestService({ repository, kakaoClient });

    const result = await service.createBrandTemplate({
      actorUserId: 'user_1',
      payload: {
        senderResourceId: 'kakao_resource_1',
        templateName: '등록 템플릿',
        chatBubbleType: 'TEXT',
        content: '등록 안내',
        image: { imageUrl: 'https://example.com/should-not-send.png' },
        carousel: { list: [] },
        debugToken: 'drop-me',
      },
    });

    expect(kakaoClient.createBrandTemplate).toHaveBeenCalledWith({
      senderKey: 'sender-key-1',
      body: {
        templateName: '등록 템플릿',
        chatBubbleType: 'TEXT',
        content: '등록 안내',
      },
    });
    expect(result).toMatchObject({
      templateCode: 'BRAND_STRIPPED',
      template: {
        templateCode: 'BRAND_STRIPPED',
        templateName: '등록 템플릿',
      },
    });
  });

  it('requires an active sender resource before listing templates', async () => {
    const repository = createMemoryRepository({
      links: [
        {
          id: 'inactive_link',
          userId: 'user_1',
          senderResourceId: 'sms_resource_1',
          billingAccountId: 'billing_1',
          role: 'owner',
          status: 'pending',
          isDefault: false,
        },
      ],
    });
    const service = createTestService({ repository });

    await expect(
      service.listSmsTemplates({
        actorUserId: 'user_1',
        senderResourceId: 'sms_resource_1',
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.FORBIDDEN,
      status: 403,
    });
  });

  it('can resolve AlimTalk template detail from the common group when it is not on the user sender', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(),
      getAlimtalkTemplate: vi.fn(async ({ senderKey }) => {
        if (senderKey === 'sender-key-1' || senderKey === 'common-visuo-key') {
          throw new NhnProviderError({
            status: 404,
            providerCode: '404',
            providerMessage: 'Not found',
          });
        }

        return {
          header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
          template: createAlimtalkTemplate({
            senderKey: 'common-publ-key',
            plusFriendId: '@publ',
            plusFriendType: 'GROUP',
            templateCode: 'COMMON_DELIVERY',
            status: 'TSC03',
          }),
        };
      }),
    };
    const service = createTestService({
      repository,
      kakaoClient,
      alimtalkCommonTemplateSources: [
        { id: 'visuo', label: '@비주오', senderKey: 'common-visuo-key' },
        { id: 'publ', label: '@publ', senderKey: 'common-publ-key' },
      ],
    });

    const result = await service.getTemplate({
      actorUserId: 'user_1',
      channel: 'alimtalk',
      templateCode: 'COMMON_DELIVERY',
      query: { senderResourceId: 'kakao_resource_1' },
    });

    expect(kakaoClient.getAlimtalkTemplate.mock.calls.map(([call]) => call.senderKey)).toEqual([
      'sender-key-1',
      'common-visuo-key',
      'common-publ-key',
    ]);
    expect(result.template).toMatchObject({
      source: TEMPLATE_SOURCES.GROUP,
      sourceKey: 'common-publ-key',
      templateCode: 'COMMON_DELIVERY',
      providerStatus: 'APR',
    });
  });

  it('can resolve AlimTalk template detail from a selected common source key', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(),
      getAlimtalkTemplate: vi.fn(async ({ senderKey }) => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        template: createAlimtalkTemplate({
          senderKey,
          plusFriendId: '@publ',
          plusFriendType: 'GROUP',
          templateCode: 'COMMON_DELIVERY',
          status: 'TSC03',
        }),
      })),
    };
    const service = createTestService({
      repository,
      kakaoClient,
      alimtalkCommonTemplateSources: [
        { id: 'visuo', label: '@비주오', senderKey: 'common-visuo-key' },
        { id: 'publ', label: '@publ', senderKey: 'common-publ-key' },
      ],
    });

    const result = await service.getTemplate({
      actorUserId: 'user_1',
      channel: 'alimtalk',
      templateCode: 'COMMON_DELIVERY',
      query: {
        senderResourceId: 'kakao_resource_1',
        source: 'GROUP',
        sourceKey: 'common-publ-key',
      },
    });

    expect(kakaoClient.getAlimtalkTemplate).toHaveBeenCalledTimes(1);
    expect(kakaoClient.getAlimtalkTemplate).toHaveBeenCalledWith({
      senderKey: 'common-publ-key',
      templateCode: 'COMMON_DELIVERY',
    });
    expect(result.template).toMatchObject({
      source: TEMPLATE_SOURCES.GROUP,
      sourceKey: 'common-publ-key',
      templateCode: 'COMMON_DELIVERY',
    });
  });

  it('can resolve selected common AlimTalk template detail without a sender resource', async () => {
    const repository = createMemoryRepository({ resources: [], links: [] });
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(),
      getAlimtalkTemplate: vi.fn(async ({ senderKey }) => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        template: createAlimtalkTemplate({
          senderKey,
          plusFriendId: '@publ',
          plusFriendType: 'GROUP',
          templateCode: 'COMMON_DELIVERY',
          status: 'TSC03',
        }),
      })),
    };
    const service = createTestService({
      repository,
      kakaoClient,
      alimtalkCommonTemplateSources: [
        { id: 'visuo', label: '@비주오', senderKey: 'common-visuo-key' },
        { id: 'publ', label: '@publ', senderKey: 'common-publ-key' },
      ],
    });

    const result = await service.getTemplate({
      actorUserId: 'user_1',
      channel: 'alimtalk',
      templateCode: 'COMMON_DELIVERY',
      query: {
        source: 'GROUP',
        sourceKey: 'common-publ-key',
      },
    });

    expect(kakaoClient.getAlimtalkTemplate).toHaveBeenCalledWith({
      senderKey: 'common-publ-key',
      templateCode: 'COMMON_DELIVERY',
    });
    expect(result.template).toMatchObject({
      source: TEMPLATE_SOURCES.GROUP,
      sourceKey: 'common-publ-key',
      templateCode: 'COMMON_DELIVERY',
    });
  });

  it('rejects SMS template detail when the template belongs to another send number', async () => {
    const repository = createMemoryRepository();
    const smsClient = {
      listTemplates: vi.fn(),
      getTemplate: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          data: createSmsTemplate({
            templateId: 'SMS_OTHER_SEND_NO',
            sendNo: '0200000000',
            useYn: 'Y',
          }),
        },
      })),
    };
    const service = createTestService({ repository, smsClient });

    await expect(
      service.getTemplate({
        actorUserId: 'user_1',
        channel: 'sms',
        templateCode: 'SMS_OTHER_SEND_NO',
        query: { senderResourceId: 'sms_resource_1' },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.FORBIDDEN,
      status: 403,
    });
  });

  it('resolves Brand Message template detail from the selected sender resource', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = {
      listAlimtalkTemplates: vi.fn(),
      getAlimtalkTemplate: vi.fn(),
      listBrandTemplates: vi.fn(),
      getBrandTemplate: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        template: createBrandTemplate({
          senderKey: 'sender-key-1',
          templateCode: 'BRAND_DETAIL',
          status: 'APPROVED',
          content: '쿠폰 #{couponName}',
          buttons: [],
        }),
      })),
    };
    const service = createTestService({ repository, kakaoClient });

    const result = await service.getTemplate({
      actorUserId: 'user_1',
      channel: CHANNELS.BRAND_MESSAGE,
      templateCode: 'BRAND_DETAIL',
      query: { senderResourceId: 'kakao_resource_1' },
    });

    expect(kakaoClient.getBrandTemplate).toHaveBeenCalledWith({
      senderKey: 'sender-key-1',
      templateCode: 'BRAND_DETAIL',
    });
    expect(result).toMatchObject({
      channel: CHANNELS.BRAND_MESSAGE,
      template: {
        channel: CHANNELS.BRAND_MESSAGE,
        templateCode: 'BRAND_DETAIL',
        requiredVariables: ['couponName'],
      },
    });
  });
});

function createTestService({
  repository,
  smsClient,
  kakaoClient,
  alimtalkCommonTemplateSources,
  kakaoDefaultSenderGroupKey = null,
} = {}) {
  const defaultSmsClient = {
    listTemplates: vi.fn(),
    getTemplate: vi.fn(),
    createTemplate: vi.fn(),
    uploadAttachFile: vi.fn(),
    listCategories: vi.fn(async () => ({
      header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      body: {
        data: [
          {
            categoryId: 50,
            categoryParentId: 0,
            categoryName: 'Category',
            categoryDesc: 'Provider root category',
            useYn: 'Y',
          },
          {
            categoryId: 100,
            categoryParentId: 50,
            categoryName: 'NOTI',
            categoryDesc: 'Messaging App notifications',
            useYn: 'Y',
          },
          {
            categoryId: 1,
            categoryParentId: 100,
            categoryName: 'user_1_ref',
            categoryDesc: 'Messaging App user user_1_ref',
            useYn: 'Y',
          },
        ],
      },
    })),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
  };

  return createTemplateCatalogService({
    repository,
    smsClient: {
      ...defaultSmsClient,
      ...(smsClient ?? {}),
    },
    kakaoClient:
      kakaoClient ||
      {
        listAlimtalkTemplates: vi.fn(),
        getAlimtalkTemplate: vi.fn(),
        createAlimtalkTemplate: vi.fn(),
        listBrandTemplates: vi.fn(),
        getBrandTemplate: vi.fn(),
        createBrandTemplate: vi.fn(),
      },
    alimtalkCommonTemplateSources,
    kakaoDefaultSenderGroupKey,
  });
}

function createMemoryRepository(overrides = {}) {
  const repository = {
    users: overrides.users || [
      {
        id: 'user_1',
        userRef: 'user_1_ref',
        email: 'user@example.com',
        name: 'User',
        status: 'active',
        isOperator: false,
      },
    ],
    resources: overrides.resources || [
      {
        id: 'kakao_resource_1',
        resourceRef: 'sr_kakao_1',
        provider: 'nhn',
        type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
        value: 'sender-key-1',
        displayName: '@store',
        status: 'active',
        providerStatus: 'active',
      },
      {
        id: 'sms_resource_1',
        resourceRef: 'sr_sms_1',
        provider: 'nhn',
        type: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
        value: '15446859',
        displayName: '1544-6859',
        status: 'active',
        providerStatus: 'approved',
      },
    ],
    links: overrides.links || [
      {
        id: 'kakao_link_1',
        userId: 'user_1',
        senderResourceId: 'kakao_resource_1',
        billingAccountId: 'billing_1',
        role: 'owner',
        status: 'active',
        isDefault: true,
      },
      {
        id: 'sms_link_1',
        userId: 'user_1',
        senderResourceId: 'sms_resource_1',
        billingAccountId: 'billing_1',
        role: 'owner',
        status: 'active',
        isDefault: true,
      },
    ],

    async getUserById(userId) {
      return this.users.find((user) => user.id === userId) ?? null;
    },

    async getUserSenderResource({ userId, senderResourceId }) {
      const link = this.links.find((item) => item.userId === userId && item.senderResourceId === senderResourceId);
      if (!link) return null;

      return {
        link,
        resource: this.resources.find((resource) => resource.id === senderResourceId),
      };
    },
  };

  return repository;
}

function createAlimtalkTemplate({ senderKey, plusFriendId, plusFriendType, templateCode, status }) {
  return {
    senderKey,
    plusFriendId,
    plusFriendType,
    templateCode,
    kakaoTemplateCode: `KAKAO_${templateCode}`,
    templateName: `${templateCode} name`,
    templateContent: 'Order #{orderNo} was received for #{customerName}.',
    templateMessageType: 'BA',
    templateEmphasizeType: 'NONE',
    status,
    statusName: status === 'TSC04' ? 'Rejected' : 'Approved',
    securityFlag: false,
    categoryCode: '001',
    buttons: [
      {
        ordering: 1,
        type: 'WL',
        name: 'View order',
        linkMo: 'https://example.com/orders/#{orderNo}',
        filePath: '/provider/internal',
      },
    ],
    quickReplies: [],
    createDate: '2026-06-01 09:00:00',
    updateDate: '2026-06-01 09:00:00',
  };
}

function createSmsTemplate({
  templateId,
  sendNo,
  useYn,
  delYn = 'N',
  body = 'Body',
  sendType = '0',
  title = null,
  attachFileYn = 'Y',
  attachFileList = [
    {
      fileId: 123,
      filePath: '/permanent/internal/path',
      fileName: 'notice.jpg',
      saveFileName: 'secret.jpg',
      uploadType: 'TEMPORARY',
    },
  ],
}) {
  return {
    templateId,
    categoryId: 1,
    categoryName: 'General',
    templateName: `${templateId} name`,
    templateDesc: 'Description',
    useYn,
    delYn,
    sendNo,
    sendType,
    sendTypeName: sendType === '1' ? 'LMS send' : 'SMS send',
    title,
    body,
    attachFileYn,
    attachFileList,
    createDate: '2026-06-01 09:00:00',
    updateDate: '2026-06-01 09:00:00',
  };
}

function createBrandTemplate({
  senderKey,
  templateCode,
  status,
  content = 'Brand content',
  block = false,
  buttons,
  ...templateFields
}) {
  return {
    senderKey,
    templateCode,
    templateName: `${templateCode} name`,
    content,
    chatBubbleType: 'TEXT',
    status,
    block,
    dormant: false,
    buttons:
      buttons ??
      [
        {
          ordering: 1,
          type: 'WL',
          name: 'Open #{name}',
          linkMo: 'https://example.com/#{name}',
        },
    ],
    createDate: '2026-06-01 09:00:00',
    updateDate: '2026-06-01 09:00:00',
    ...templateFields,
  };
}
