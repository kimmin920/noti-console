import { describe, expect, it, vi } from 'vitest';

import { createMessageSendService } from '../messages/service.js';
import { CHANNELS, RELAY_ERROR_CODES, SEND_RESPONSE_STATES, SENDER_RESOURCE_TYPES } from '../relay/constants.js';
import { NhnProviderError } from '../relay/errors.js';

const CLIENT_REQUEST_ID = 'de305d54-75b4-431b-adb2-eb6b9e546014';

describe('message send relay service', () => {
  it('sends SMS through NHN with server-owned sender and grouping keys only', async () => {
    const repository = createMemoryRepository();
    const smsClient = createSmsClient({
      sendSms: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          data: {
            requestId: 'sms-request-1',
            statusCode: '2',
            senderGroupingKey: 'provider-echo',
            sendResultList: [
              {
                recipientNo: '01012345678',
                recipientSeq: 1,
                resultCode: 0,
                resultMessage: 'SUCCESS',
                recipientGroupingKey: 'provider-recipient-key',
              },
            ],
          },
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.sendSms({
      actorUserId: 'user_1',
      payload: {
        clientRequestId: CLIENT_REQUEST_ID,
        senderResourceId: 'sms_resource_1',
        senderGroupingKey: 'browser-supplied-key',
        templateCode: 'SMS_PICKUP',
        body: 'Pickup code ##code##',
        recipients: [
          {
            recipientNo: '010-1234-5678',
            recipientGroupingKey: 'browser-recipient-key',
            templateParameter: { code: '123456' },
          },
        ],
      },
    });

    const providerBody = smsClient.sendSms.mock.calls[0][0];

    expect(providerBody).toMatchObject({
      sendNo: '15446859',
      templateId: 'SMS_PICKUP',
      body: 'Pickup code ##code##',
    });
    expect(providerBody.senderGroupingKey).toMatch(/^u:u1ref:b:b1ref:r:smsref1:q:/);
    expect(providerBody.senderGroupingKey).not.toBe('browser-supplied-key');
    expect(providerBody.recipientList).toEqual([
      {
        recipientNo: '01012345678',
        templateParameter: { code: '123456' },
        recipientGroupingKey: `${providerBody.senderGroupingKey}:n:0`,
      },
    ]);
    expect(result).toMatchObject({
      state: SEND_RESPONSE_STATES.ACCEPTED_BY_PROVIDER,
      channel: CHANNELS.SMS,
      clientRequestId: CLIENT_REQUEST_ID,
      senderResourceId: 'sms_resource_1',
      recipientCount: 1,
      lookup: {
        channel: CHANNELS.SMS,
        senderResourceId: 'sms_resource_1',
        clientRequestId: CLIENT_REQUEST_ID,
      },
      provider: {
        requestId: 'sms-request-1',
        statusCode: '2',
        recipients: [
          {
            recipientSeq: 1,
            resultCode: 0,
            resultMessage: 'SUCCESS',
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain('01012345678');
    expect(JSON.stringify(result)).not.toContain('Pickup code');
    expect(JSON.stringify(result)).not.toContain('123456');
    expect(repository.writeLog).toEqual([]);
  });

  it('uses the MMS endpoint wrapper for LMS/MMS send channels', async () => {
    const repository = createMemoryRepository();
    const ledgerRepository = createMemoryLedgerRepository();
    const smsClient = createSmsClient({
      sendMms: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          data: {
            requestId: 'lms-request-1',
            statusCode: '2',
            sendResultList: [{ recipientSeq: 1, resultCode: 0, resultMessage: 'SUCCESS' }],
          },
        },
      })),
    });
    const service = createTestService({ ledgerRepository, repository, smsClient });

    await service.sendSms({
      actorUserId: 'user_1',
      payload: {
        clientRequestId: CLIENT_REQUEST_ID,
        senderResourceId: 'sms_resource_1',
        channel: 'lms',
        title: 'Notice',
        body: 'Long body',
        recipients: [{ recipientNo: '01012345678' }],
      },
    });

    expect(smsClient.sendSms).not.toHaveBeenCalled();
    expect(smsClient.sendMms).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Notice',
        body: 'Long body',
        sendNo: '15446859',
      })
    );
    expect(ledgerRepository.providerRequests[0]).toMatchObject({
      pendingCount: 1,
      providerRequestId: 'lms-request-1',
      providerState: 'accepted',
      resultSnapshotJson: {
        states: ['P'],
        resultCodes: [null],
      },
      resultState: 'not_synced',
    });
  });

  it('uses the advertising SMS endpoint with server-owned opt-out notices', async () => {
    const repository = createMemoryRepository();
    const smsClient = createSmsClient({
      sendAdSms: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          data: {
            requestId: 'ad-sms-request-1',
            statusCode: '2',
            sendResultList: [{ recipientSeq: 1, resultCode: 0, resultMessage: 'SUCCESS' }],
          },
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    await service.sendSms({
      actorUserId: 'user_1',
      payload: {
        body: '(광고)\n혜택 안내\n[무료 수신 거부]0809999999',
        clientRequestId: CLIENT_REQUEST_ID,
        isAdvertisement: true,
        recipients: [{ recipientNo: '01012345678' }],
        senderResourceId: 'sms_resource_1',
      },
    });

    expect(smsClient.sendSms).not.toHaveBeenCalled();
    expect(smsClient.sendAdSms).toHaveBeenCalledWith(
      expect.objectContaining({
        body: '(광고)\n혜택 안내\n무료수신거부 0801234567',
        sendNo: '15446859',
      })
    );
  });

  it('promotes advertising SMS to the advertising MMS endpoint after adding notices', async () => {
    const repository = createMemoryRepository();
    const smsClient = createSmsClient({
      sendAdMms: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          data: {
            requestId: 'ad-lms-request-1',
            statusCode: '2',
            sendResultList: [{ recipientSeq: 1, resultCode: 0, resultMessage: 'SUCCESS' }],
          },
        },
      })),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.sendSms({
      actorUserId: 'user_1',
      payload: {
        body: '가'.repeat(35),
        clientRequestId: CLIENT_REQUEST_ID,
        isAdvertisement: true,
        recipients: [{ recipientNo: '01012345678' }],
        senderResourceId: 'sms_resource_1',
      },
    });

    expect(smsClient.sendAdSms).not.toHaveBeenCalled();
    expect(smsClient.sendAdMms).toHaveBeenCalledWith(
      expect.objectContaining({
        body: `(광고)\n${'가'.repeat(35)}\n무료수신거부 0801234567`,
        title: '광고',
      })
    );
    expect(result.channel).toBe(CHANNELS.LMS);
  });

  it('writes a minimal ledger row for direct SMS without storing content or recipients', async () => {
    const repository = createMemoryRepository();
    const ledgerRepository = createMemoryLedgerRepository();
    const smsClient = createSmsClient({
      sendSms: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: {
          data: {
            requestId: 'sms-ledger-request-1',
            statusCode: '2',
            sendResultList: [{ recipientSeq: 1, resultCode: 0, resultMessage: 'SUCCESS' }],
          },
        },
      })),
    });
    const service = createTestService({ ledgerRepository, repository, smsClient });

    const result = await service.sendSms({
      actorUserId: 'user_1',
      payload: {
        body: 'Sensitive pickup code ##code##',
        clientRequestId: CLIENT_REQUEST_ID,
        managementTitle: '  June pickup\u0000notice  ',
        recipients: [
          { recipientNo: '01012345678', templateParameter: { code: '123456' } },
          { recipientNo: '01012345679', templateParameter: { code: '987654' } },
        ],
        senderResourceId: 'sms_resource_1',
      },
    });

    expect(result.ledger).toEqual({
      groupId: 'ledger_group_1',
      requestLocalId: 'ledger_request_1',
    });
    expect(ledgerRepository.groups[0]).toMatchObject({
      acceptedRequestCount: 1,
      channel: CHANNELS.SMS,
      managementTitle: 'June pickup notice',
      pendingCount: 2,
      providerRequestCount: 1,
      providerState: 'accepted',
      resultState: 'not_synced',
      sendKind: 'basic',
      totalRecipientCount: 2,
    });
    expect(ledgerRepository.providerRequests[0]).toMatchObject({
      pendingCount: 2,
      providerRequestId: 'sms-ledger-request-1',
      providerState: 'accepted',
      recipientCount: 2,
      resultSnapshotJson: {
        states: ['P', 'P'],
        resultCodes: [null, null],
      },
      resultSnapshotVersion: 0,
      resultState: 'not_synced',
    });
    expect(JSON.stringify(ledgerRepository)).not.toContain('Sensitive pickup code');
    expect(JSON.stringify(ledgerRepository)).not.toContain('01012345678');
    expect(JSON.stringify(ledgerRepository)).not.toContain('01012345679');
    expect(JSON.stringify(ledgerRepository)).not.toContain('123456');
    expect(JSON.stringify(ledgerRepository)).not.toContain('987654');
  });

  it('sends AlimTalk with an idempotency header and authorized SMS fallback sender', async () => {
    const repository = createMemoryRepository();
    const ledgerRepository = createMemoryLedgerRepository();
    const kakaoClient = createKakaoClient({
      sendAlimtalkMessage: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        message: {
          requestId: 'alimtalk-request-1',
          sendResults: [
            {
              recipientNo: '01012345678',
              recipientSeq: 1,
              resultCode: 'MRC01',
              resultMessage: 'SUCCESS',
              recipientGroupingKey: 'provider-recipient-key',
            },
          ],
        },
      })),
    });
    const service = createTestService({ ledgerRepository, repository, kakaoClient });

    const result = await service.sendAlimtalk({
      actorUserId: 'user_1',
      payload: {
        clientRequestId: CLIENT_REQUEST_ID,
        senderResourceId: 'kakao_resource_1',
        templateCode: 'ORDER_READY',
        recipients: [
          {
            recipientNo: '010-1234-5678',
            templateParameter: { orderNo: 'ORDER-123' },
          },
        ],
        fallback: {
          enabled: true,
          smsSenderResourceId: 'sms_resource_1',
          resendType: 'SMS',
        },
      },
    });

    const [providerBody, providerOptions] = kakaoClient.sendAlimtalkMessage.mock.calls[0];

    expect(providerOptions.idempotencyKey).toMatch(/^i:alimtalk:u:u1ref:r:kakaoref1:q:/);
    expect(providerBody).toMatchObject({
      senderKey: 'sender-key-1',
      templateCode: 'ORDER_READY',
      createUser: 'u1ref',
    });
    expect(providerBody.senderGroupingKey).toMatch(/^u:u1ref:b:b1ref:r:kakaoref1:q:/);
    expect(providerBody.recipientList).toEqual([
      {
        recipientNo: '01012345678',
        templateParameter: { orderNo: 'ORDER-123' },
        resendParameter: {
          isResend: true,
          resendSendNo: '15446859',
          resendType: 'SMS',
        },
        recipientGroupingKey: `${providerBody.senderGroupingKey}:n:0`,
      },
    ]);
    expect(result).toMatchObject({
      state: SEND_RESPONSE_STATES.ACCEPTED_BY_PROVIDER,
      channel: CHANNELS.ALIMTALK,
      ledger: {
        groupId: 'ledger_group_1',
        requestLocalId: 'ledger_request_1',
      },
      provider: {
        requestId: 'alimtalk-request-1',
        recipients: [
          {
            recipientSeq: 1,
            resultCode: 'MRC01',
            resultMessage: 'SUCCESS',
          },
        ],
      },
    });
    expect(ledgerRepository.groups[0]).toMatchObject({
      acceptedRequestCount: 1,
      channel: CHANNELS.ALIMTALK,
      pendingCount: 1,
      providerRequestCount: 1,
      providerState: 'accepted',
      resultState: 'not_synced',
      senderResourceId: 'kakao_resource_1',
      totalRecipientCount: 1,
    });
    expect(ledgerRepository.providerRequests[0]).toMatchObject({
      pendingCount: 1,
      providerRequestId: 'alimtalk-request-1',
      providerState: 'accepted',
      recipientCount: 1,
      resultSnapshotJson: {
        states: ['P'],
        resultCodes: [null],
      },
      resultSnapshotVersion: 0,
      resultState: 'not_synced',
    });
    expect(JSON.stringify(result)).not.toContain('01012345678');
    expect(JSON.stringify(result)).not.toContain('ORDER-123');
    expect(JSON.stringify(ledgerRepository)).not.toContain('01012345678');
    expect(JSON.stringify(ledgerRepository)).not.toContain('ORDER-123');
    expect(repository.writeLog).toEqual([]);
  });

  it('rejects AlimTalk fallback when the SMS sender resource is not active for the user', async () => {
    const repository = createMemoryRepository({
      links: [
        createLink({
          id: 'kakao_link_1',
          senderResourceId: 'kakao_resource_1',
          role: 'sender',
          status: 'active',
        }),
        createLink({
          id: 'sms_link_pending',
          senderResourceId: 'sms_resource_1',
          role: 'sender',
          status: 'pending',
        }),
      ],
    });
    const kakaoClient = createKakaoClient();
    const service = createTestService({ repository, kakaoClient });

    await expect(
      service.sendAlimtalk({
        actorUserId: 'user_1',
        payload: {
          clientRequestId: CLIENT_REQUEST_ID,
          senderResourceId: 'kakao_resource_1',
          templateCode: 'ORDER_READY',
          recipients: [{ recipientNo: '01012345678', templateParameter: { orderNo: 'ORDER-123' } }],
          fallback: {
            enabled: true,
            smsSenderResourceId: 'sms_resource_1',
          },
        },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.FORBIDDEN,
      status: 403,
    });
    expect(kakaoClient.sendAlimtalkMessage).not.toHaveBeenCalled();
    expect(repository.writeLog).toEqual([]);
  });

  it('sends Brand Message freestyle with server-owned keys and advertising SMS fallback', async () => {
    const repository = createMemoryRepository();
    const ledgerRepository = createMemoryLedgerRepository();
    const kakaoClient = createKakaoClient({
      sendBrandFreestyleMessage: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        message: {
          requestId: 'brand-request-1',
          sendResults: [
            {
              recipientNo: '01012345678',
              recipientSeq: 1,
              resultCode: 'MRC01',
              resultMessage: 'SUCCESS',
            },
          ],
        },
      })),
    });
    const service = createTestService({
      ledgerRepository,
      repository,
      kakaoClient,
      now: () => new Date('2026-06-05T01:00:00.000Z'),
    });

    const result = await service.sendBrandMessage({
      actorUserId: 'user_1',
      payload: {
        clientRequestId: CLIENT_REQUEST_ID,
        senderResourceId: 'kakao_resource_1',
        senderGroupingKey: 'browser-supplied-key',
        mode: 'freestyle',
        chatBubbleType: 'TEXT',
        content: '브랜드 안내',
        header: '브랜드 소식',
        additionalContent: '이번 주 혜택',
        buttons: [{ type: 'WL', name: '자세히 보기', linkMo: 'https://example.com' }],
        coupon: {
          type: 'PERCENT',
          percent: '10',
          description: '10% 할인',
          linkMo: 'https://example.com/coupon',
        },
        targeting: 'M',
        resellerCode: 'reseller-1',
        statsId: 'brand01',
        recipients: [{ recipientNo: '010-1234-5678' }],
        fallback: {
          enabled: true,
          smsSenderResourceId: 'sms_resource_1',
          resendType: 'SMS',
          resendUnsubscribeNo: '080-999-9999',
        },
      },
    });

    const [providerBody, providerOptions] = kakaoClient.sendBrandFreestyleMessage.mock.calls[0];

    expect(providerOptions.idempotencyKey).toMatch(/^i:brand-message:u:u1ref:r:kakaoref1:q:/);
    expect(providerBody).toMatchObject({
      senderKey: 'sender-key-1',
      chatBubbleType: 'TEXT',
      content: '브랜드 안내',
      createUser: 'u1ref',
      buttons: [{ type: 'WL', name: '자세히 보기', linkMo: 'https://example.com' }],
      coupon: {
        title: '10% 할인 쿠폰',
        description: '10% 할인',
        linkMo: 'https://example.com/coupon',
      },
      targeting: 'I',
      resellerCode: 'reseller-1',
      statsId: 'brand01',
      pushAlarm: true,
    });
    expect(providerBody).not.toHaveProperty('header');
    expect(providerBody).not.toHaveProperty('additionalContent');
    expect(providerBody.senderGroupingKey).toMatch(/^u:u1ref:b:b1ref:r:kakaoref1:q:/);
    expect(providerBody.senderGroupingKey).not.toBe('browser-supplied-key');
    expect(providerBody.recipientList).toEqual([
      {
        recipientNo: '01012345678',
        resendParameter: {
          isResend: true,
          resendSendNo: '15446859',
          resendType: 'SMS',
          resendUnsubscribeNo: '0809999999',
        },
        recipientGroupingKey: `${providerBody.senderGroupingKey}:n:0`,
      },
    ]);
    expect(result).toMatchObject({
      state: SEND_RESPONSE_STATES.ACCEPTED_BY_PROVIDER,
      channel: CHANNELS.BRAND_MESSAGE,
      ledger: {
        groupId: 'ledger_group_1',
        requestLocalId: 'ledger_request_1',
      },
      provider: {
        requestId: 'brand-request-1',
        recipients: [
          {
            recipientSeq: 1,
            resultCode: 'MRC01',
            resultMessage: 'SUCCESS',
          },
        ],
      },
    });
    expect(ledgerRepository.groups[0]).toMatchObject({
      acceptedRequestCount: 1,
      channel: CHANNELS.BRAND_MESSAGE,
      pendingCount: 1,
      providerRequestCount: 1,
      providerState: 'accepted',
      resultState: 'not_synced',
      senderResourceId: 'kakao_resource_1',
      totalRecipientCount: 1,
    });
    expect(ledgerRepository.providerRequests[0]).toMatchObject({
      pendingCount: 1,
      providerRequestId: 'brand-request-1',
      providerState: 'accepted',
      recipientCount: 1,
      resultSnapshotJson: {
        states: ['P'],
        resultCodes: [null],
      },
      resultSnapshotVersion: 0,
      resultState: 'not_synced',
    });
    expect(JSON.stringify(result)).not.toContain('01012345678');
    expect(JSON.stringify(result)).not.toContain('브랜드 안내');
    expect(JSON.stringify(result)).not.toContain('0801234567');
    expect(JSON.stringify(ledgerRepository)).not.toContain('01012345678');
    expect(JSON.stringify(ledgerRepository)).not.toContain('브랜드 안내');
    expect(JSON.stringify(ledgerRepository)).not.toContain('0801234567');
    expect(repository.writeLog).toEqual([]);
  });

  it('rejects Brand Message freestyle coupon placeholders before calling NHN', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = createKakaoClient();
    const service = createTestService({
      repository,
      kakaoClient,
      now: () => new Date('2026-06-05T01:00:00.000Z'),
    });

    await expect(
      service.sendBrandMessage({
        actorUserId: 'user_1',
        payload: {
          clientRequestId: CLIENT_REQUEST_ID,
          senderResourceId: 'kakao_resource_1',
          mode: 'freestyle',
          chatBubbleType: 'TEXT',
          content: '브랜드 안내',
          coupon: {
            title: '#{할인금액}원 할인 쿠폰',
            description: '할인',
            linkMo: 'https://example.com/coupon',
          },
          recipients: [{ recipientNo: '01012345678' }],
        },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      state: SEND_RESPONSE_STATES.LOCAL_VALIDATION_FAILED,
    });
    expect(kakaoClient.sendBrandFreestyleMessage).not.toHaveBeenCalled();
  });

  it('rejects invalid Brand Message AC channel-add buttons before calling NHN', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = createKakaoClient();
    const service = createTestService({
      repository,
      kakaoClient,
      now: () => new Date('2026-06-05T01:00:00.000Z'),
    });

    await expect(
      service.sendBrandMessage({
        actorUserId: 'user_1',
        payload: {
          clientRequestId: CLIENT_REQUEST_ID,
          senderResourceId: 'kakao_resource_1',
          mode: 'freestyle',
          chatBubbleType: 'TEXT',
          content: '브랜드 안내',
          buttons: [{ type: 'AC', name: '친구 추가' }],
          recipients: [{ recipientNo: '01012345678' }],
        },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      state: SEND_RESPONSE_STATES.LOCAL_VALIDATION_FAILED,
    });
    expect(kakaoClient.sendBrandFreestyleMessage).not.toHaveBeenCalled();
    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'local_validation.rejected',
        metadataJson: expect.objectContaining({
          operation: 'messages.brand-message.send',
          senderResourceId: 'kakao_resource_1',
          recipientCount: 1,
        }),
      }),
    ]);
  });

  it.each([
    {
      chatBubbleType: 'IMAGE',
      payload: {
        chatBubbleType: 'IMAGE',
        content: '이미지 안내',
        image: { imageUrl: 'https://cdn.example.com/image.png', imageSeq: 'image-1' },
      },
      expected: {
        chatBubbleType: 'IMAGE',
        content: '이미지 안내',
        image: { imageUrl: 'https://cdn.example.com/image.png', imageSeq: 'image-1' },
      },
    },
    {
      chatBubbleType: 'WIDE_ITEM_LIST',
      payload: {
        chatBubbleType: 'WIDE_ITEM_LIST',
        content: '이번 주 추천',
        header: '추천 상품',
        item: {
          list: [
            {
              image: { imageUrl: 'https://cdn.example.com/main.png' },
              linkMo: 'https://m.example.com/main',
              title: '아우터',
            },
            {
              content: '재입고',
              image: { imageUrl: 'https://cdn.example.com/sub.png' },
              linkMo: 'https://m.example.com/sub',
              title: '니트',
            },
            {
              content: '단독 혜택',
              image: { imageUrl: 'https://cdn.example.com/sub-2.png' },
              linkMo: 'https://m.example.com/sub-2',
              title: '팬츠',
            },
          ],
        },
      },
      expected: {
        chatBubbleType: 'WIDE_ITEM_LIST',
        header: '추천 상품',
        item: {
          list: [
            {
              imageUrl: 'https://cdn.example.com/main.png',
              linkMo: 'https://m.example.com/main',
              title: '아우터',
            },
            {
              imageUrl: 'https://cdn.example.com/sub.png',
              linkMo: 'https://m.example.com/sub',
              title: '니트',
            },
            {
              imageUrl: 'https://cdn.example.com/sub-2.png',
              linkMo: 'https://m.example.com/sub-2',
              title: '팬츠',
            },
          ],
        },
      },
    },
    {
      chatBubbleType: 'PREMIUM_VIDEO',
      payload: {
        chatBubbleType: 'PREMIUM_VIDEO',
        video: {
          thumbnailUrl: 'https://cdn.example.com/thumb.png',
          title: '시즌 필름',
          videoUrl: 'https://tv.kakao.com/v/1234',
        },
      },
      expected: {
        chatBubbleType: 'PREMIUM_VIDEO',
        video: {
          thumbnailUrl: 'https://cdn.example.com/thumb.png',
          title: '시즌 필름',
          videoUrl: 'https://tv.kakao.com/v/1234',
        },
      },
    },
    {
      chatBubbleType: 'COMMERCE',
      payload: {
        chatBubbleType: 'COMMERCE',
        buttons: [{ type: 'WL', name: '구매하기', linkMo: 'https://example.com/bag' }],
        commerce: {
          discountPrice: '39000',
          image: { imageUrl: 'https://cdn.example.com/bag.png' },
          regularPrice: '59000',
          title: '시그니처 백',
        },
      },
      expected: {
        chatBubbleType: 'COMMERCE',
        buttons: [{ type: 'WL', name: '구매하기', linkMo: 'https://example.com/bag' }],
        image: { imageUrl: 'https://cdn.example.com/bag.png' },
        commerce: {
          discountPrice: 39000,
          discountRate: 33,
          regularPrice: 59000,
          title: '시그니처 백',
        },
      },
    },
    {
      chatBubbleType: 'CAROUSEL_COMMERCE',
      payload: {
        chatBubbleType: 'CAROUSEL_COMMERCE',
        carousel: {
          list: [
            {
              buttons: [{ type: 'WL', name: '구매', linkMo: 'https://example.com/commerce-1' }],
              discountPrice: '29000',
              image: { imageUrl: 'https://cdn.example.com/commerce-card-1.png' },
              regularPrice: '42000',
              title: '크로스백 1',
            },
            {
              buttons: [{ type: 'WL', name: '구매', linkMo: 'https://example.com/commerce-2' }],
              discountPrice: '19000',
              image: { imageUrl: 'https://cdn.example.com/commerce-card-2.png' },
              regularPrice: '32000',
              title: '크로스백 2',
            },
          ],
        },
      },
      expected: {
        chatBubbleType: 'CAROUSEL_COMMERCE',
        carousel: {
          list: [
            {
              buttons: [{ type: 'WL', name: '구매', linkMo: 'https://example.com/commerce-1' }],
              imageUrl: 'https://cdn.example.com/commerce-card-1.png',
              commerce: {
                discountPrice: 29000,
                discountRate: 30,
                regularPrice: 42000,
                title: '크로스백 1',
              },
            },
            {
              buttons: [{ type: 'WL', name: '구매', linkMo: 'https://example.com/commerce-2' }],
              imageUrl: 'https://cdn.example.com/commerce-card-2.png',
              commerce: {
                discountPrice: 19000,
                discountRate: 40,
                regularPrice: 32000,
                title: '크로스백 2',
              },
            },
          ],
        },
      },
    },
  ])('passes Brand Message freestyle %s fields to NHN', async ({ payload, expected }) => {
    const repository = createMemoryRepository();
    const kakaoClient = createKakaoClient({
      sendBrandFreestyleMessage: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        message: { requestId: 'brand-rich-request-1', sendResults: [] },
      })),
    });
    const service = createTestService({
      repository,
      kakaoClient,
      now: () => new Date('2026-06-05T01:00:00.000Z'),
    });

    await service.sendBrandMessage({
      actorUserId: 'user_1',
      payload: {
        clientRequestId: CLIENT_REQUEST_ID,
        senderResourceId: 'kakao_resource_1',
        mode: 'freestyle',
        recipients: [{ recipientNo: '010-1234-5678' }],
        ...payload,
      },
    });

    const [providerBody, providerOptions] = kakaoClient.sendBrandFreestyleMessage.mock.calls[0];

    expect(providerOptions.idempotencyKey).toMatch(/^i:brand-message:u:u1ref:r:kakaoref1:q:/);
    expect(providerBody).toMatchObject({
      senderKey: 'sender-key-1',
      createUser: 'u1ref',
      pushAlarm: true,
      ...expected,
    });
    expect(providerBody.senderGroupingKey).toMatch(/^u:u1ref:b:b1ref:r:kakaoref1:q:/);
    expect(providerBody.recipientList).toEqual([
      {
        recipientNo: '01012345678',
        recipientGroupingKey: `${providerBody.senderGroupingKey}:n:0`,
      },
    ]);
    expect(kakaoClient.sendBrandBasicMessage).not.toHaveBeenCalled();
  });

  it('omits rich fields that are not allowed for a WIDE Brand Message before calling NHN', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = createKakaoClient({
      sendBrandFreestyleMessage: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        message: { requestId: 'brand-wide-request-1', sendResults: [] },
      })),
    });
    const service = createTestService({
      repository,
      kakaoClient,
      now: () => new Date('2026-06-05T01:00:00.000Z'),
    });

    await service.sendBrandMessage({
      actorUserId: 'user_1',
      payload: {
        carousel: {
          list: [
            { image: { imageUrl: 'https://cdn.example.com/card-1.png' }, title: '카드 1' },
            { image: { imageUrl: 'https://cdn.example.com/card-2.png' }, title: '카드 2' },
          ],
        },
        chatBubbleType: 'WIDE',
        clientRequestId: CLIENT_REQUEST_ID,
        commerce: {
          image: { imageUrl: 'https://cdn.example.com/commerce.png' },
          title: '상품',
        },
        content: '와이드 이미지 안내',
        image: { imageUrl: 'https://cdn.example.com/wide.png' },
        item: {
          list: [
            { image: { imageUrl: 'https://cdn.example.com/item.png' }, title: '아이템' },
          ],
        },
        mode: 'freestyle',
        recipients: [{ recipientNo: '010-1234-5678' }],
        senderResourceId: 'kakao_resource_1',
        video: {
          thumbnailUrl: 'https://cdn.example.com/thumb.png',
          title: '영상',
          videoUrl: 'https://tv.kakao.com/v/1234',
        },
      },
    });

    const [providerBody] = kakaoClient.sendBrandFreestyleMessage.mock.calls[0];

    expect(providerBody).toMatchObject({
      chatBubbleType: 'WIDE',
      content: '와이드 이미지 안내',
      image: { imageUrl: 'https://cdn.example.com/wide.png' },
    });
    expect(providerBody).not.toHaveProperty('carousel');
    expect(providerBody).not.toHaveProperty('commerce');
    expect(providerBody).not.toHaveProperty('item');
    expect(providerBody).not.toHaveProperty('video');
  });

  it('sends Brand Message basic with NHN template parameters through the basic endpoint', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = createKakaoClient({
      sendBrandBasicMessage: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        message: {
          requestId: 'brand-basic-request-1',
          sendResults: [{ recipientSeq: 1, resultCode: 'MRC01', resultMessage: 'SUCCESS' }],
        },
      })),
    });
    const service = createTestService({
      repository,
      kakaoClient,
      now: () => new Date('2026-06-05T01:00:00.000Z'),
    });

    await service.sendBrandMessage({
      actorUserId: 'user_1',
      payload: {
        clientRequestId: CLIENT_REQUEST_ID,
        senderResourceId: 'kakao_resource_1',
        senderGroupingKey: 'browser-supplied-key',
        mode: 'template',
        templateCode: 'BRAND_TEMPLATE',
        templateParameter: { customerName: '민지' },
        imageParameters: [{ imageUrl: 'https://cdn.example.com/template.png', name: 'hero' }],
        videoParameter: { videoUrl: 'https://tv.kakao.com/v/5555' },
        targeting: 'N',
        unsubscribeNo: '080-123-4567',
        unsubscribeAuthNo: 'AUTH-1',
        resellerCode: 'reseller-2',
        statsId: 'brand02',
        recipients: [{ recipientNo: '010-1234-5678' }],
      },
    });

    const [providerBody, providerOptions] = kakaoClient.sendBrandBasicMessage.mock.calls[0];

    expect(providerOptions.idempotencyKey).toMatch(/^i:brand-message:u:u1ref:r:kakaoref1:q:/);
    expect(providerBody).toMatchObject({
      senderKey: 'sender-key-1',
      templateCode: 'BRAND_TEMPLATE',
      createUser: 'u1ref',
      pushAlarm: true,
      unsubscribeNo: '0801234567',
      unsubscribeAuthNo: 'AUTH-1',
      resellerCode: 'reseller-2',
      statsId: 'brand02',
    });
    expect(providerBody.senderGroupingKey).toMatch(/^u:u1ref:b:b1ref:r:kakaoref1:q:/);
    expect(providerBody.senderGroupingKey).not.toBe('browser-supplied-key');
    expect(providerBody.recipientList).toEqual([
      {
        recipientNo: '01012345678',
        templateParameter: { customerName: '민지' },
        imageParameters: [{ imageUrl: 'https://cdn.example.com/template.png', name: 'hero' }],
        videoParameter: { videoUrl: 'https://tv.kakao.com/v/5555' },
        targeting: 'I',
        recipientGroupingKey: `${providerBody.senderGroupingKey}:n:0`,
      },
    ]);
    expect(kakaoClient.sendBrandFreestyleMessage).not.toHaveBeenCalled();
  });

  it('blocks Brand Message sends during the KST night restriction before calling NHN', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = createKakaoClient();
    const service = createTestService({
      repository,
      kakaoClient,
      now: () => new Date('2026-06-05T12:00:00.000Z'),
    });

    await expect(
      service.sendBrandMessage({
        actorUserId: 'user_1',
        payload: {
          clientRequestId: CLIENT_REQUEST_ID,
          senderResourceId: 'kakao_resource_1',
          mode: 'freestyle',
          chatBubbleType: 'TEXT',
          content: '야간 발송',
          recipients: [{ recipientNo: '01012345678' }],
        },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      state: SEND_RESPONSE_STATES.LOCAL_VALIDATION_FAILED,
    });
    expect(kakaoClient.sendBrandFreestyleMessage).not.toHaveBeenCalled();
    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'local_validation.rejected',
        metadataJson: expect.objectContaining({
          operation: 'messages.brand-message.send',
          senderResourceId: 'kakao_resource_1',
          recipientCount: 1,
        }),
      }),
    ]);
    expect(JSON.stringify(repository.auditLogs)).not.toContain('야간 발송');
    expect(JSON.stringify(repository.auditLogs)).not.toContain('01012345678');
  });

  it('uploads Brand Message images only for an active Kakao sender resource', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = createKakaoClient({
      uploadBrandImage: vi.fn(async () => ({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        image: {
          imageSeq: 'image-seq-1',
          imageUrl: 'https://cdn.example.com/brand.png',
          imageName: 'brand.png',
          imageType: 'CAROUSEL_FEED_IMAGE',
        },
      })),
    });
    const service = createTestService({ repository, kakaoClient });
    const formData = new FormData();

    formData.set('senderResourceId', 'kakao_resource_1');
    formData.set('imageType', 'CAROUSEL_FEED_IMAGE');
    formData.set('image', new Blob(['image-bytes'], { type: 'image/png' }), 'brand.png');

    const result = await service.uploadBrandImage({
      actorUserId: 'user_1',
      formData,
    });
    const providerFormData = kakaoClient.uploadBrandImage.mock.calls[0][0];

    expect(providerFormData.get('imageType')).toBe('CAROUSEL_FEED_IMAGE');
    expect(providerFormData.get('image')).toMatchObject({
      name: 'brand.png',
      size: 11,
      type: 'image/png',
    });
    expect(result).toEqual({
      imageSeq: 'image-seq-1',
      imageUrl: 'https://cdn.example.com/brand.png',
      imageName: 'brand.png',
      imageType: 'CAROUSEL_FEED_IMAGE',
    });
    expect(repository.auditLogs).toEqual([]);
  });

  it('rejects empty Brand Message image uploads before calling NHN', async () => {
    const repository = createMemoryRepository();
    const kakaoClient = createKakaoClient({ uploadBrandImage: vi.fn() });
    const service = createTestService({ repository, kakaoClient });
    const formData = new FormData();

    formData.set('senderResourceId', 'kakao_resource_1');
    formData.set('imageType', 'MAIN_WIDE_ITEMLIST_IMAGE');
    formData.set('image', new Blob([], { type: 'image/png' }), 'empty.png');

    await expect(service.uploadBrandImage({
      actorUserId: 'user_1',
      formData,
    })).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      message: 'image must be between 1 byte and 5 MB.',
      status: 400,
    });
    expect(kakaoClient.uploadBrandImage).not.toHaveBeenCalled();
  });

  it('returns unknown_after_provider_call after a provider timeout without retrying SMS', async () => {
    const repository = createMemoryRepository();
    const ledgerRepository = createMemoryLedgerRepository();
    const smsClient = createSmsClient({
      sendSms: vi.fn(async () => {
        throw new DOMException('NHN request timed out.', 'TimeoutError');
      }),
    });
    const service = createTestService({ ledgerRepository, repository, smsClient });

    const result = await service.sendSms({
      actorUserId: 'user_1',
      payload: {
        clientRequestId: CLIENT_REQUEST_ID,
        senderResourceId: 'sms_resource_1',
        body: 'Timeout body',
        recipients: [{ recipientNo: '01012345678' }],
      },
    });

    expect(smsClient.sendSms).toHaveBeenCalledTimes(1);
    expect(ledgerRepository.providerRequests[0]).toMatchObject({
      pendingCount: 1,
      providerRequestId: null,
      providerState: 'unknown',
      resultState: 'not_synced',
    });
    expect(ledgerRepository.providerRequests[0].resultSnapshotJson).toBeUndefined();
    expect(result).toMatchObject({
      state: SEND_RESPONSE_STATES.UNKNOWN_AFTER_PROVIDER_CALL,
      channel: CHANNELS.SMS,
      lookup: {
        channel: CHANNELS.SMS,
        senderResourceId: 'sms_resource_1',
        clientRequestId: CLIENT_REQUEST_ID,
      },
      error: {
        source: 'nhn',
        code: RELAY_ERROR_CODES.UNKNOWN_AFTER_PROVIDER_CALL,
      },
    });
    expect(repository.writeLog).toEqual([]);
    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'provider.timeout',
        actorUserId: 'user_1',
        targetType: 'sender_resource',
        targetId: 'sms_resource_1',
        metadataJson: expect.objectContaining({
          operation: 'messages.sms.send',
          channel: CHANNELS.SMS,
          state: SEND_RESPONSE_STATES.UNKNOWN_AFTER_PROVIDER_CALL,
          errorCode: RELAY_ERROR_CODES.UNKNOWN_AFTER_PROVIDER_CALL,
          recipientCount: 1,
        }),
      }),
    ]);
    expect(JSON.stringify(repository.auditLogs)).not.toContain('Timeout body');
    expect(JSON.stringify(repository.auditLogs)).not.toContain('01012345678');
  });

  it('audits provider rate limits without retrying or persisting message content', async () => {
    const repository = createMemoryRepository();
    const smsClient = createSmsClient({
      sendSms: vi.fn(async () => {
        throw new NhnProviderError({
          status: 429,
          providerCode: '429',
          providerMessage: 'Too Many Requests',
        });
      }),
    });
    const service = createTestService({ repository, smsClient });

    const result = await service.sendSms({
      actorUserId: 'user_1',
      payload: {
        clientRequestId: CLIENT_REQUEST_ID,
        senderResourceId: 'sms_resource_1',
        body: 'Rate limited body',
        recipients: [{ recipientNo: '01012345678', templateParameter: { code: 'SECRET' } }],
      },
    });

    expect(smsClient.sendSms).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      state: SEND_RESPONSE_STATES.REJECTED_BY_PROVIDER,
      error: {
        source: 'nhn',
        code: RELAY_ERROR_CODES.PROVIDER_RATE_LIMITED,
        message: 'NHN 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.',
        providerCode: '429',
        providerMessage: 'Too Many Requests',
      },
    });
    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'provider.rate_limited',
        actorUserId: 'user_1',
        targetType: 'sender_resource',
        targetId: 'sms_resource_1',
        metadataJson: expect.objectContaining({
          operation: 'messages.sms.send',
          channel: CHANNELS.SMS,
          state: SEND_RESPONSE_STATES.REJECTED_BY_PROVIDER,
          errorCode: RELAY_ERROR_CODES.PROVIDER_RATE_LIMITED,
          providerCode: '429',
          providerMessage: 'Too Many Requests',
        }),
      }),
    ]);
    expect(JSON.stringify(repository.auditLogs)).not.toContain('Rate limited body');
    expect(JSON.stringify(repository.auditLogs)).not.toContain('01012345678');
    expect(JSON.stringify(repository.auditLogs)).not.toContain('SECRET');
    expect(repository.writeLog).toEqual([]);
  });

  it('normalizes provider rejection without echoing recipient or message content', async () => {
    const repository = createMemoryRepository();
    const ledgerRepository = createMemoryLedgerRepository();
    const smsClient = createSmsClient({
      sendSms: vi.fn(async () => {
        throw new NhnProviderError({
          status: 400,
          providerCode: 'BAD_REQUEST',
          providerMessage: 'Template parameter mismatch',
          responseBody: {
            header: {
              isSuccessful: false,
              resultCode: 'BAD_REQUEST',
              resultMessage: 'Template parameter mismatch',
            },
            body: {
              data: {
                requestId: 'sms-request-rejected',
                body: 'Sensitive body',
                sendResultList: [
                  {
                    recipientNo: '01012345678',
                    recipientSeq: 1,
                    resultCode: 999,
                    resultMessage: 'Rejected',
                  },
                ],
              },
            },
          },
        });
      }),
    });
    const service = createTestService({ ledgerRepository, repository, smsClient });

    const result = await service.sendSms({
      actorUserId: 'user_1',
      payload: {
        clientRequestId: CLIENT_REQUEST_ID,
        senderResourceId: 'sms_resource_1',
        body: 'Sensitive body',
        recipients: [{ recipientNo: '01012345678', templateParameter: { code: 'SECRET' } }],
      },
    });

    expect(result).toMatchObject({
      state: SEND_RESPONSE_STATES.REJECTED_BY_PROVIDER,
      error: {
        source: 'nhn',
        code: RELAY_ERROR_CODES.PROVIDER_REJECTED,
        providerCode: 'BAD_REQUEST',
        providerMessage: 'Template parameter mismatch',
      },
      provider: {
        requestId: 'sms-request-rejected',
        recipients: [{ recipientSeq: 1, resultCode: 999, resultMessage: 'Rejected' }],
      },
    });
    expect(ledgerRepository.providerRequests[0]).toMatchObject({
      failedCount: 1,
      pendingCount: 0,
      providerRequestId: null,
      providerState: 'rejected',
      resultFinalizedAt: expect.any(Date),
      resultState: 'synced',
    });
    expect(ledgerRepository.providerRequests[0].resultSnapshotJson).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('01012345678');
    expect(JSON.stringify(result)).not.toContain('Sensitive body');
    expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(repository.writeLog).toEqual([]);
  });

  it('fails local validation before calling NHN', async () => {
    const repository = createMemoryRepository();
    const smsClient = createSmsClient();
    const service = createTestService({ repository, smsClient });

    await expect(
      service.sendSms({
        actorUserId: 'user_1',
        payload: {
          clientRequestId: 'not-a-uuid',
          senderResourceId: 'sms_resource_1',
          body: 'Invalid request',
          recipients: [{ recipientNo: '01012345678' }],
        },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      state: SEND_RESPONSE_STATES.LOCAL_VALIDATION_FAILED,
    });
    expect(smsClient.sendSms).not.toHaveBeenCalled();
    expect(repository.writeLog).toEqual([]);
    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'local_validation.rejected',
        actorUserId: 'user_1',
        targetType: 'message_send',
        targetId: 'sms_resource_1',
        metadataJson: expect.objectContaining({
          operation: 'messages.sms.send',
          senderResourceId: 'sms_resource_1',
          hasClientRequestId: true,
          recipientCount: 1,
          errorCode: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
        }),
      }),
    ]);
    expect(JSON.stringify(repository.auditLogs)).not.toContain('Invalid request');
    expect(JSON.stringify(repository.auditLogs)).not.toContain('01012345678');
  });

  it('rejects SMS/LMS/MMS bodies over 2000 bytes before calling NHN', async () => {
    const repository = createMemoryRepository();
    const smsClient = createSmsClient();
    const service = createTestService({ repository, smsClient });

    await expect(
      service.sendSms({
        actorUserId: 'user_1',
        payload: {
          clientRequestId: CLIENT_REQUEST_ID,
          senderResourceId: 'sms_resource_1',
          channel: 'mms',
          title: 'Notice',
          body: '가'.repeat(1001),
          recipients: [{ recipientNo: '01012345678' }],
        },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      state: SEND_RESPONSE_STATES.LOCAL_VALIDATION_FAILED,
    });
    expect(smsClient.sendSms).not.toHaveBeenCalled();
    expect(smsClient.sendMms).not.toHaveBeenCalled();
    expect(repository.writeLog).toEqual([]);
  });

  it('authenticates before request-shape validation', async () => {
    const repository = createMemoryRepository();
    const smsClient = createSmsClient();
    const service = createTestService({ repository, smsClient });

    await expect(
      service.sendSms({
        actorUserId: null,
        payload: {
          clientRequestId: 'not-a-uuid',
        },
      })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.UNAUTHORIZED,
      status: 401,
    });
    expect(smsClient.sendSms).not.toHaveBeenCalled();
    expect(repository.writeLog).toEqual([]);
  });
});

function createTestService({ repository, ledgerRepository, smsClient, kakaoClient, now } = {}) {
  return createMessageSendService({
    commonSmsUnsubscribeNo: '080-123-4567',
    ledgerRepository,
    repository,
    smsClient: smsClient || createSmsClient(),
    kakaoClient: kakaoClient || createKakaoClient(),
    ...(now ? { now } : {}),
  });
}

function createSmsClient(overrides = {}) {
  return {
    sendAdMms: overrides.sendAdMms || vi.fn(),
    sendAdSms: overrides.sendAdSms || vi.fn(),
    sendSms: overrides.sendSms || vi.fn(),
    sendMms: overrides.sendMms || vi.fn(),
  };
}

function createKakaoClient(overrides = {}) {
  return {
    sendAlimtalkMessage: overrides.sendAlimtalkMessage || vi.fn(),
    sendBrandBasicMessage: overrides.sendBrandBasicMessage || vi.fn(),
    sendBrandFreestyleMessage: overrides.sendBrandFreestyleMessage || vi.fn(),
    uploadBrandImage: overrides.uploadBrandImage || vi.fn(),
  };
}

function createMemoryRepository(overrides = {}) {
  return {
    users: overrides.users || [
      {
        id: 'user_1',
        userRef: 'u1ref',
        email: 'user@example.com',
        status: 'active',
        isOperator: false,
      },
    ],
    billingAccounts: overrides.billingAccounts || [
      {
        id: 'billing_1',
        billingRef: 'b1ref',
        ownerType: 'user',
        ownerId: 'user_1',
        status: 'active',
      },
    ],
    resources: overrides.resources || [
      {
        id: 'kakao_resource_1',
        resourceRef: 'kakaoref1',
        provider: 'nhn',
        type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
        value: 'sender-key-1',
        displayName: '@store',
        status: 'active',
        providerStatus: 'active',
      },
      {
        id: 'sms_resource_1',
        resourceRef: 'smsref1',
        provider: 'nhn',
        type: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
        value: '15446859',
        displayName: '1544-6859',
        status: 'active',
        providerStatus: 'approved',
      },
    ],
    links: overrides.links || [
      createLink({ id: 'kakao_link_1', senderResourceId: 'kakao_resource_1', role: 'sender' }),
      createLink({ id: 'sms_link_1', senderResourceId: 'sms_resource_1', role: 'sender' }),
    ],
    writeLog: [],
    auditLogs: [],

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

    async getBillingAccountById(billingAccountId) {
      return this.billingAccounts.find((billingAccount) => billingAccount.id === billingAccountId) ?? null;
    },

    async findBillingAccountForUser(userId) {
      return (
        this.billingAccounts.find(
          (billingAccount) => billingAccount.ownerType === 'user' && billingAccount.ownerId === userId
        ) ?? null
      );
    },

    async createAuditLog(values) {
      const auditLog = {
        id: `audit_${this.auditLogs.length + 1}`,
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
        ...values,
      };
      this.auditLogs.push(auditLog);
      return auditLog;
    },
  };
}

function createLink({ id, senderResourceId, role = 'sender', status = 'active' }) {
  return {
    id,
    userId: 'user_1',
    senderResourceId,
    billingAccountId: 'billing_1',
    role,
    status,
    isDefault: false,
  };
}

function createMemoryLedgerRepository() {
  return {
    groups: [],
    providerRequests: [],
    async createGroupWithProviderRequests({ group, providerRequests = [], now }) {
      const createdGroup = {
        id: `ledger_group_${this.groups.length + 1}`,
        ...group,
        managementTitle: String(group.managementTitle ?? 'Message send')
          .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
        createdAt: group.createdAt ?? now,
      };
      const createdRequests = providerRequests.map((request) => ({
        id: `ledger_request_${this.providerRequests.length + 1}`,
        groupId: createdGroup.id,
        ...request,
        createdAt: now,
      }));

      this.groups.push(createdGroup);
      this.providerRequests.push(...createdRequests);

      return {
        group: createdGroup,
        providerRequests: createdRequests,
      };
    },
  };
}
