import { afterEach, describe, expect, it, vi } from 'vitest';

const MOCKED_MODULES = [
  '../../db/client.js',
  '../messageLogs/repository.js',
  '../messages/repository.js',
  '../nhn/config.js',
  '../nhn/kakaoBizmessageClient.js',
  '../nhn/smsClient.js',
];

describe('default message send service', () => {
  afterEach(() => {
    for (const modulePath of MOCKED_MODULES) {
      vi.doUnmock(modulePath);
    }
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('uploads Brand Message images through the lazy Kakao client', async () => {
    vi.resetModules();

    const uploadBrandImage = vi.fn(async () => ({
      header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      image: {
        imageName: 'brand.png',
        imageSeq: 'image-seq-1',
        imageType: 'WIDE_IMAGE',
        imageUrl: 'https://cdn.example.com/brand.png',
      },
    }));

    vi.doMock('../../db/client.js', () => ({
      getDb: () => ({}),
    }));
    vi.doMock('../messageLogs/repository.js', () => ({
      createMessageSendLedgerRepository: () => ({}),
    }));
    vi.doMock('../messages/repository.js', () => ({
      createMessageSendRepository: () => ({
        createAuditLog: vi.fn(),
        findBillingAccountForUser: vi.fn(async (userId) => (
          userId === 'user_1' ? { id: 'billing_1', status: 'active' } : null
        )),
        getBillingAccountById: vi.fn(async (billingAccountId) => (
          billingAccountId === 'billing_1' ? { id: 'billing_1', status: 'active' } : null
        )),
        getUserById: vi.fn(async (userId) => (
          userId === 'user_1'
            ? { id: 'user_1', status: 'active', userRef: 'u1ref' }
            : null
        )),
        getUserSenderResource: vi.fn(async ({ senderResourceId, userId }) => (
          userId === 'user_1' && senderResourceId === 'kakao_resource_1'
            ? {
                link: { billingAccountId: 'billing_1', role: 'sender', status: 'active' },
                resource: {
                  id: 'kakao_resource_1',
                  provider: 'nhn',
                  status: 'active',
                  type: 'kakao_sender_key',
                },
              }
            : null
        )),
      }),
      createSmsBulkSendRunRepository: () => ({}),
    }));
    vi.doMock('../nhn/config.js', () => ({
      resolveNhnKakaoBizmessageConfig: () => ({
        appKey: 'kakao-app-key',
        baseUrl: 'https://example.invalid',
        secretKey: 'kakao-secret-key',
      }),
      resolveNhnSmsConfig: () => ({
        appKey: 'sms-app-key',
        baseUrl: 'https://example.invalid',
        secretKey: 'sms-secret-key',
      }),
    }));
    vi.doMock('../nhn/kakaoBizmessageClient.js', () => ({
      createNhnKakaoBizmessageClient: vi.fn(() => ({
        sendAlimtalkMessage: vi.fn(),
        sendBrandBasicMessage: vi.fn(),
        sendBrandFreestyleMessage: vi.fn(),
        uploadBrandImage,
      })),
    }));
    vi.doMock('../nhn/smsClient.js', () => ({
      createNhnSmsClient: vi.fn(() => ({
        sendMms: vi.fn(),
        sendSms: vi.fn(),
      })),
    }));

    const { createDefaultMessageSendService } = await import('../messages/service.js');
    const formData = new FormData();

    formData.set('senderResourceId', 'kakao_resource_1');
    formData.set('imageType', 'WIDE_IMAGE');
    formData.set('image', new Blob(['image-bytes'], { type: 'image/png' }), 'brand.png');

    const result = await createDefaultMessageSendService().uploadBrandImage({
      actorUserId: 'user_1',
      formData,
    });
    const providerFormData = uploadBrandImage.mock.calls[0][0];

    expect(uploadBrandImage).toHaveBeenCalledTimes(1);
    expect(providerFormData.get('imageType')).toBe('WIDE_IMAGE');
    expect(providerFormData.get('image')).toMatchObject({
      name: 'brand.png',
      size: 11,
      type: 'image/png',
    });
    expect(result).toEqual({
      imageName: 'brand.png',
      imageSeq: 'image-seq-1',
      imageType: 'WIDE_IMAGE',
      imageUrl: 'https://cdn.example.com/brand.png',
    });
  });
});
