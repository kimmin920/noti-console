import { describe, expect, it, vi } from 'vitest';
import {
  CHANNELS,
  NHN_DIRECT_API_BASE_URLS,
  NHN_PROVIDER_IDEMPOTENCY,
  RELAY_ERROR_CODES,
} from '../relay/constants.js';
import {
  buildAlimtalkIdempotencyKey,
  buildBrandMessageIdempotencyKey,
  buildGroupingKeys,
  deriveRequestRef,
  parseRecipientGroupingKey,
  parseSenderGroupingKey,
  validateClientRequestId,
} from '../relay/groupingKeys.js';
import {
  classifyProviderFailure,
  isProviderRateLimit,
  isProviderTimeout,
  providerErrorEnvelope,
} from '../relay/errors.js';
import { resolveNhnKakaoBizmessageConfig, resolveNhnRelayConfig } from '../nhn/config.js';
import { createNhnKakaoBizmessageClient } from '../nhn/kakaoBizmessageClient.js';
import { createNhnSmsClient } from '../nhn/smsClient.js';
import { parseRelayRequest } from '../http/relayRoute.js';

const VALID_CLIENT_REQUEST_ID = 'de305d54-75b4-431b-adb2-eb6b9e546014';

function createJsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    statusText: init.statusText,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('NHN relay config', () => {
  it('resolves direct NHN product API defaults from server env values', () => {
    const config = resolveNhnRelayConfig({
      NHN_SMS_APP_KEY: 'sms-app-key',
      NHN_SMS_SECRET_KEY: 'sms-secret-key',
      NHN_KAKAO_BIZMESSAGE_APP_KEY: 'kakao-app-key',
      NHN_KAKAO_BIZMESSAGE_SECRET_KEY: 'kakao-secret-key',
    });

    expect(config.sms).toEqual({
      appKey: 'sms-app-key',
      secretKey: 'sms-secret-key',
      baseUrl: NHN_DIRECT_API_BASE_URLS.SMS,
    });
    expect(config.kakaoBizmessage).toEqual({
      appKey: 'kakao-app-key',
      secretKey: 'kakao-secret-key',
      baseUrl: NHN_DIRECT_API_BASE_URLS.KAKAO_BIZMESSAGE,
    });
  });

  it('resolves Kakao Bizmessage config without requiring SMS credentials', () => {
    const config = resolveNhnKakaoBizmessageConfig({
      NHN_KAKAO_BIZMESSAGE_APP_KEY: 'kakao-app-key',
      NHN_KAKAO_BIZMESSAGE_SECRET_KEY: 'kakao-secret-key',
    });

    expect(config).toEqual({
      appKey: 'kakao-app-key',
      secretKey: 'kakao-secret-key',
      baseUrl: NHN_DIRECT_API_BASE_URLS.KAKAO_BIZMESSAGE,
    });
  });

  it('rejects missing credentials and Notification Hub base URLs', () => {
    expect(() => resolveNhnRelayConfig({})).toThrow('NHN_SMS_APP_KEY is required.');
    expect(() =>
      resolveNhnRelayConfig({
        NHN_SMS_APP_KEY: 'sms-app-key',
        NHN_SMS_SECRET_KEY: 'sms-secret-key',
        NHN_SMS_API_BASE_URL: 'https://notification-hub.api.nhncloudservice.com',
        NHN_KAKAO_BIZMESSAGE_APP_KEY: 'kakao-app-key',
        NHN_KAKAO_BIZMESSAGE_SECRET_KEY: 'kakao-secret-key',
      })
    ).toThrow('direct NHN product API');
  });
});

describe('grouping key helpers', () => {
  it('validates client request IDs and derives compact request refs', () => {
    expect(validateClientRequestId(VALID_CLIENT_REQUEST_ID)).toBe(VALID_CLIENT_REQUEST_ID);
    expect(deriveRequestRef(VALID_CLIENT_REQUEST_ID)).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(() => validateClientRequestId('not-a-uuid')).toThrow('valid UUID');
  });

  it('builds sender and recipient grouping keys within the SMS limit', () => {
    const keys = buildGroupingKeys({
      clientRequestId: VALID_CLIENT_REQUEST_ID,
      userRef: 'user_ref_1234567890',
      billingRef: 'bill_ref_1234567890',
      resourceRef: 'send_no_1234567890',
      recipientIndex: 999,
    });

    expect(keys.senderGroupingKey).toMatch(/^u:user_ref_1234567890:b:bill_ref_1234567890:r:send_no_1234567890:q:/);
    expect(keys.senderGroupingKey.length).toBeLessThanOrEqual(100);
    expect(keys.recipientGroupingKey).toBe(`${keys.senderGroupingKey}:n:999`);
    expect(keys.recipientGroupingKey.length).toBeLessThanOrEqual(100);
    expect(parseSenderGroupingKey(keys.senderGroupingKey)).toMatchObject({
      userRef: 'user_ref_1234567890',
      billingRef: 'bill_ref_1234567890',
      resourceRef: 'send_no_1234567890',
      requestRef: keys.requestRef,
    });
    expect(parseRecipientGroupingKey(keys.recipientGroupingKey)).toMatchObject({
      senderGroupingKey: keys.senderGroupingKey,
      recipientIndex: 999,
    });
    expect(parseSenderGroupingKey('u:user1:b:bill:r:res:q:req:n:0')).toBeNull();
    expect(parseRecipientGroupingKey('u:user1:b:bill:r:res:q:reqextra')).toBeNull();
  });

  it('builds Kakao Bizmessage idempotency keys and marks SMS as not provider-idempotent', () => {
    const requestRef = deriveRequestRef(VALID_CLIENT_REQUEST_ID);

    expect(
      buildAlimtalkIdempotencyKey({
        requestRef,
        userRef: 'user_1',
        resourceRef: 'kakao_1',
      })
    ).toBe(`i:alimtalk:u:user_1:r:kakao_1:q:${requestRef}`);
    expect(
      buildBrandMessageIdempotencyKey({
        requestRef,
        userRef: 'user_1',
        resourceRef: 'kakao_1',
      })
    ).toBe(`i:brand-message:u:user_1:r:kakao_1:q:${requestRef}`);
    expect(NHN_PROVIDER_IDEMPOTENCY[CHANNELS.ALIMTALK]).toBe(true);
    expect(NHN_PROVIDER_IDEMPOTENCY[CHANNELS.BRAND_MESSAGE]).toBe(true);
    expect(NHN_PROVIDER_IDEMPOTENCY[CHANNELS.SMS]).toBe(false);
    expect(NHN_PROVIDER_IDEMPOTENCY[CHANNELS.LMS]).toBe(false);
    expect(NHN_PROVIDER_IDEMPOTENCY[CHANNELS.MMS]).toBe(false);
  });
});

describe('NHN client wrappers', () => {
  it('sends SMS API v3.0 requests with X-Secret-Key and no idempotency header', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: { data: { requestId: 'sms-request-id' } },
      })
    );
    const client = createNhnSmsClient({
      config: {
        appKey: 'sms-app-key',
        secretKey: 'sms-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.SMS,
      },
      fetchImpl,
    });

    await client.sendSms({
      body: 'hello',
      sendNo: '15446859',
      recipientList: [{ recipientNo: '01000000000' }],
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe('https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/sender/sms');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Secret-Key']).toBe('sms-secret-key');
    expect(init.headers['X-NC-API-IDEMPOTENCY-KEY']).toBeUndefined();
    expect(client.request).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({
      body: 'hello',
      sendNo: '15446859',
      recipientList: [{ recipientNo: '01000000000' }],
    });
  });

  it('uses the NHN advertising SMS and MMS endpoints', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: { data: { requestId: 'ad-request-id' } },
      })
    );
    const client = createNhnSmsClient({
      config: {
        appKey: 'sms-app-key',
        secretKey: 'sms-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.SMS,
      },
      fetchImpl,
    });

    await client.sendAdSms({ body: '(광고) SMS', recipientList: [], sendNo: '15446859' });
    await client.sendAdMms({ body: '(광고) LMS', recipientList: [], sendNo: '15446859', title: '광고' });

    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/sender/ad-sms'
    );
    expect(String(fetchImpl.mock.calls[1][0])).toBe(
      'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/sender/ad-mms'
    );
  });

  it('sends KakaoTalk Bizmessage AlimTalk requests with X-Secret-Key and optional idempotency header', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        message: { requestId: 'alimtalk-request-id' },
      })
    );
    const client = createNhnKakaoBizmessageClient({
      config: {
        appKey: 'kakao-app-key',
        secretKey: 'kakao-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.KAKAO_BIZMESSAGE,
      },
      fetchImpl,
    });
    const idempotencyKey = buildAlimtalkIdempotencyKey({
      clientRequestId: VALID_CLIENT_REQUEST_ID,
      userRef: 'user_1',
      resourceRef: 'kakao_1',
    });

    await client.sendAlimtalkMessage(
      {
        senderKey: 'sender-key',
        templateCode: 'template-code',
        recipientList: [{ recipientNo: '01000000000', templateParameter: {} }],
      },
      { idempotencyKey }
    );

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/messages'
    );
    expect(init.headers['X-Secret-Key']).toBe('kakao-secret-key');
    expect(init.headers['X-NC-API-IDEMPOTENCY-KEY']).toBe(idempotencyKey);
    expect(client.request).toBeUndefined();
  });

  it('sends KakaoTalk Bizmessage Brand Message requests with X-Secret-Key and optional idempotency header', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        message: { requestId: 'brand-message-request-id' },
      })
    );
    const client = createNhnKakaoBizmessageClient({
      config: {
        appKey: 'kakao-app-key',
        secretKey: 'kakao-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.KAKAO_BIZMESSAGE,
      },
      fetchImpl,
    });
    const idempotencyKey = buildBrandMessageIdempotencyKey({
      clientRequestId: VALID_CLIENT_REQUEST_ID,
      userRef: 'user_1',
      resourceRef: 'kakao_1',
    });

    await client.sendBrandFreestyleMessage(
      {
        senderKey: 'sender-key',
        chatBubbleType: 'TEXT',
        recipientList: [{ recipientNo: '01000000000' }],
        content: 'hello',
      },
      { idempotencyKey }
    );
    await client.sendBrandBasicMessage(
      {
        senderKey: 'sender-key',
        templateCode: 'template-code',
        recipientList: [{ recipientNo: '01000000000', templateParameter: {} }],
      },
      { idempotencyKey }
    );

    const [freestyleUrl, freestyleInit] = fetchImpl.mock.calls[0];
    const [basicUrl, basicInit] = fetchImpl.mock.calls[1];
    expect(String(freestyleUrl)).toBe(
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/brand-message/v1.0/appkeys/kakao-app-key/freestyle-messages'
    );
    expect(String(basicUrl)).toBe(
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/brand-message/v1.0/appkeys/kakao-app-key/basic-messages'
    );
    expect(freestyleInit.headers['X-Secret-Key']).toBe('kakao-secret-key');
    expect(freestyleInit.headers['X-NC-API-IDEMPOTENCY-KEY']).toBe(idempotencyKey);
    expect(basicInit.headers['X-NC-API-IDEMPOTENCY-KEY']).toBe(idempotencyKey);
    expect(client.request).toBeUndefined();
  });

  it('calls KakaoTalk Bizmessage sender registration, token verification, and sender lookup APIs', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        sender: { senderKey: 'sender-key-1' },
      })
    );
    const client = createNhnKakaoBizmessageClient({
      config: {
        appKey: 'kakao-app-key',
        secretKey: 'kakao-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.KAKAO_BIZMESSAGE,
      },
      fetchImpl,
    });

    await client.listSenderCategories();
    await client.registerSender({ plusFriendId: '@store', phoneNo: '01012345678', categoryCode: '001' });
    await client.verifySenderToken({ plusFriendId: '@store', token: 123456 });
    await client.listSenders({ plusFriendId: '@store', pageNum: 1, pageSize: 20 });
    await client.getSender({ senderKey: 'sender-key-1' });
    await client.getSenderGroup({ groupSenderKey: 'group-key' });
    await client.addSenderToGroup({ groupSenderKey: 'group-key', senderKey: 'sender-key-1' });

    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/sender/categories',
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/senders',
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/sender/token',
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/senders?plusFriendId=%40store&pageNum=1&pageSize=20',
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/senders/sender-key-1',
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/sender-groups/group-key',
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/sender-groups/group-key/senders/sender-key-1',
    ]);
    expect(fetchImpl.mock.calls.map(([, init]) => init.method)).toEqual([
      'GET',
      'POST',
      'POST',
      'GET',
      'GET',
      'GET',
      'POST',
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      plusFriendId: '@store',
      phoneNo: '01012345678',
      categoryCode: '001',
    });
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toEqual({
      plusFriendId: '@store',
      token: 123456,
    });
    expect(fetchImpl.mock.calls[6][1].body).toBeUndefined();
  });

  it('calls NHN template catalog endpoints without exposing credentials in URLs', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: { data: [] },
        templateListResponse: { templates: [] },
      })
    );
    const smsClient = createNhnSmsClient({
      config: {
        appKey: 'sms-app-key',
        secretKey: 'sms-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.SMS,
      },
      fetchImpl,
    });
    const kakaoClient = createNhnKakaoBizmessageClient({
      config: {
        appKey: 'kakao-app-key',
        secretKey: 'kakao-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.KAKAO_BIZMESSAGE,
      },
      fetchImpl,
    });

    await smsClient.listTemplates({ useYn: 'Y', pageNum: 1, pageSize: 1000 });
    await smsClient.getTemplate({ templateId: 'sms-template' });
    await kakaoClient.listAlimtalkTemplates({
      senderKey: 'sender-key',
      templateStatus: 'TSC03',
      pageNum: 1,
      pageSize: 1000,
    });
    await kakaoClient.getAlimtalkTemplate({
      senderKey: 'sender-key',
      templateCode: 'alimtalk-template',
    });
    await kakaoClient.listBrandTemplates({
      senderKey: 'sender-key',
      pageNum: 1,
      pageSize: 1000,
    });
    await kakaoClient.getBrandTemplate({
      senderKey: 'sender-key',
      templateCode: 'brand-template',
    });

    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/templates?useYn=Y&pageNum=1&pageSize=1000',
      'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/templates/sms-template',
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/senders/sender-key/templates?templateStatus=TSC03&pageNum=1&pageSize=1000',
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/senders/sender-key/templates/alimtalk-template',
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/brand-message/v1.0/appkeys/kakao-app-key/senders/sender-key/templates?pageNum=1&pageSize=1000',
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/brand-message/v1.0/appkeys/kakao-app-key/senders/sender-key/templates/brand-template',
    ]);
    expect(fetchImpl.mock.calls.every(([, init]) => init.headers['X-Secret-Key'])).toBe(true);
    expect(fetchImpl.mock.calls.every(([url]) => !String(url).includes('secret'))).toBe(true);
  });

  it('creates SMS templates through the SMS v3 template endpoint as JSON', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      })
    );
    const client = createNhnSmsClient({
      config: {
        appKey: 'sms-app-key',
        secretKey: 'sms-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.SMS,
      },
      fetchImpl,
    });

    await client.createTemplate({
      categoryId: 1,
      templateId: 'SMS_CREATED',
      templateName: 'Created template',
      sendNo: '15446859',
      sendType: '0',
      body: 'hello',
      useYn: 'Y',
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe('https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/templates');
    expect(String(url)).not.toContain('sms-secret-key');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Secret-Key']).toBe('sms-secret-key');
    expect(init.headers['Content-Type']).toBe('application/json;charset=UTF-8');
    expect(JSON.parse(init.body)).toEqual({
      categoryId: 1,
      templateId: 'SMS_CREATED',
      templateName: 'Created template',
      sendNo: '15446859',
      sendType: '0',
      body: 'hello',
      useYn: 'Y',
    });
  });

  it('creates AlimTalk templates through the Kakao Bizmessage template endpoint as JSON', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      })
    );
    const client = createNhnKakaoBizmessageClient({
      config: {
        appKey: 'kakao-app-key',
        secretKey: 'kakao-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.KAKAO_BIZMESSAGE,
      },
      fetchImpl,
    });

    await client.createAlimtalkTemplate({
      senderKey: 'sender-key',
      body: {
        templateCode: 'WELCOME_NOTICE',
        templateContent: 'Welcome #{name}',
        templateMessageType: 'BA',
        templateName: 'Welcome notice',
      },
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe('https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/senders/sender-key/templates');
    expect(String(url)).not.toContain('kakao-secret-key');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Secret-Key']).toBe('kakao-secret-key');
    expect(init.headers['Content-Type']).toBe('application/json;charset=UTF-8');
    expect(JSON.parse(init.body)).toEqual({
      templateCode: 'WELCOME_NOTICE',
      templateContent: 'Welcome #{name}',
      templateMessageType: 'BA',
      templateName: 'Welcome notice',
    });
  });

  it('uploads AlimTalk template images as multipart form data', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        templateImageResponse: {
          templateImageName: 'template.png',
          templateImageUrl: 'https://example.com/template.png',
        },
      })
    );
    const client = createNhnKakaoBizmessageClient({
      config: {
        appKey: 'kakao-app-key',
        secretKey: 'kakao-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.KAKAO_BIZMESSAGE,
      },
      fetchImpl,
    });

    await client.uploadAlimtalkTemplateImage({
      blob: new Blob(['image-bytes'], { type: 'image/png' }),
      fileName: 'template.png',
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe('https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/template-image');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Secret-Key']).toBe('kakao-secret-key');
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('lists, creates, and updates SMS template categories through the SMS v3 category endpoint', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: { data: [] },
      })
    );
    const client = createNhnSmsClient({
      config: {
        appKey: 'sms-app-key',
        secretKey: 'sms-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.SMS,
      },
      fetchImpl,
    });

    await client.listCategories({ pageNum: 1, pageSize: 1000 });
    await client.createCategory({
      categoryParentId: 100,
      categoryName: 'u_user_1_ref',
      categoryDesc: 'Messaging App user user_1_ref',
      useYn: 'Y',
      createUser: 'messaging-app',
    });
    await client.updateCategory({
      categoryId: 101,
      categoryName: 'u_user_1_ref',
      categoryDesc: 'Messaging App user user_1_ref',
      useYn: 'Y',
      updateUser: 'messaging-app',
    });

    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/categories?pageNum=1&pageSize=1000',
      'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/categories',
      'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/categories/101',
    ]);
    expect(fetchImpl.mock.calls[1][1].method).toBe('POST');
    expect(fetchImpl.mock.calls[2][1].method).toBe('PUT');
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      categoryParentId: 100,
      categoryName: 'u_user_1_ref',
      categoryDesc: 'Messaging App user user_1_ref',
      useYn: 'Y',
      createUser: 'messaging-app',
    });
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toEqual({
      categoryName: 'u_user_1_ref',
      categoryDesc: 'Messaging App user user_1_ref',
      useYn: 'Y',
      updateUser: 'messaging-app',
    });
  });

  it('uploads SMS MMS template attachments through the SMS binary upload endpoint as JSON', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: { data: { fileId: 123 } },
      })
    );
    const client = createNhnSmsClient({
      config: {
        appKey: 'sms-app-key',
        secretKey: 'sms-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.SMS,
      },
      fetchImpl,
    });

    await client.uploadAttachFile({
      fileName: 'notice.jpg',
      fileBody: 'anBlZw==',
      createUser: 'user_1',
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/attachfile/binaryUpload'
    );
    expect(String(url)).not.toContain('sms-secret-key');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Secret-Key']).toBe('sms-secret-key');
    expect(init.headers['Content-Type']).toBe('application/json;charset=UTF-8');
    expect(JSON.parse(init.body)).toEqual({
      fileName: 'notice.jpg',
      fileBody: 'anBlZw==',
      createUser: 'user_1',
    });
  });

  it('creates Brand Message templates through the sender template endpoint as JSON', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        template: { templateCode: 'BRAND_CREATED' },
      })
    );
    const client = createNhnKakaoBizmessageClient({
      config: {
        appKey: 'kakao-app-key',
        secretKey: 'kakao-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.KAKAO_BIZMESSAGE,
      },
      fetchImpl,
    });

    await client.createBrandTemplate({
      senderKey: 'sender-key',
      body: {
        templateName: 'June template',
        chatBubbleType: 'TEXT',
        content: 'hello',
      },
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/brand-message/v1.0/appkeys/kakao-app-key/senders/sender-key/templates'
    );
    expect(init.method).toBe('POST');
    expect(init.headers['X-Secret-Key']).toBe('kakao-secret-key');
    expect(init.headers['Content-Type']).toBe('application/json;charset=UTF-8');
    expect(JSON.parse(init.body)).toEqual({
      templateName: 'June template',
      chatBubbleType: 'TEXT',
      content: 'hello',
    });
  });

  it('creates AlimTalk templates through the sender template endpoint as JSON', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        template: { templateCode: 'ALIM_CREATED' },
      })
    );
    const client = createNhnKakaoBizmessageClient({
      config: {
        appKey: 'kakao-app-key',
        secretKey: 'kakao-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.KAKAO_BIZMESSAGE,
      },
      fetchImpl,
    });

    await client.createAlimtalkTemplate({
      senderKey: 'sender-key',
      body: {
        templateCode: 'ALIM_CREATED',
        templateName: 'June template',
        templateContent: 'hello #{name}',
        templateMessageType: 'BA',
        templateEmphasizeType: 'NONE',
      },
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/senders/sender-key/templates'
    );
    expect(init.method).toBe('POST');
    expect(init.headers['X-Secret-Key']).toBe('kakao-secret-key');
    expect(init.headers['Content-Type']).toBe('application/json;charset=UTF-8');
    expect(JSON.parse(init.body)).toEqual({
      templateCode: 'ALIM_CREATED',
      templateName: 'June template',
      templateContent: 'hello #{name}',
      templateMessageType: 'BA',
      templateEmphasizeType: 'NONE',
    });
  });

  it('calls NHN log and detail endpoints with server credentials', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        body: { data: [] },
        messageSearchResultResponse: { messages: [] },
      })
    );
    const smsClient = createNhnSmsClient({
      config: {
        appKey: 'sms-app-key',
        secretKey: 'sms-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.SMS,
      },
      fetchImpl,
    });
    const kakaoClient = createNhnKakaoBizmessageClient({
      config: {
        appKey: 'kakao-app-key',
        secretKey: 'kakao-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.KAKAO_BIZMESSAGE,
      },
      fetchImpl,
    });

    await smsClient.listSmsMessages({ sendNo: '15446859', pageNum: 1, pageSize: 100 });
    await smsClient.getSmsMessage({ requestId: 'sms-request', recipientSeq: 1 });
    await smsClient.listMmsMessages({ sendNo: '15446859', pageNum: 1, pageSize: 100 });
    await smsClient.getMmsMessage({ requestId: 'mms-request', recipientSeq: 2 });
    await smsClient.listMessageResults({ startUpdateDate: '2026-06-01 00:00:00', endUpdateDate: '2026-06-01 23:59:59' });
    await smsClient.listReservations({ requestId: 'sms-reservation-request', pageNum: 1, pageSize: 100 });
    await smsClient.getReservation({ requestId: 'sms-reservation-request', recipientSeq: 7 });
    await smsClient.cancelReservations({
      reservationList: [{ recipientSeq: 7, requestId: 'sms-reservation-request' }],
      updateUser: 'relay-user',
    });
    await kakaoClient.listAlimtalkMessages({ senderKey: 'sender-key', pageNum: 1, pageSize: 100 });
    await kakaoClient.getAlimtalkMessage({ requestId: 'alim-request', recipientSeq: 3 });
    await kakaoClient.listAlimtalkMessageResults({ startUpdateDate: '2026-06-01 00:00', endUpdateDate: '2026-06-01 23:59' });
    await kakaoClient.listBrandMessages({ senderKey: 'sender-key', pageNum: 1, pageSize: 100 });
    await kakaoClient.getBrandMessage({ requestId: 'brand-request', recipientSeq: 4 });

    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/sender/sms?sendNo=15446859&pageNum=1&pageSize=100',
      'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/sender/sms/sms-request?recipientSeq=1',
      'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/sender/mms?sendNo=15446859&pageNum=1&pageSize=100',
      'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/sender/mms/mms-request?recipientSeq=2',
      'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/message-results?startUpdateDate=2026-06-01+00%3A00%3A00&endUpdateDate=2026-06-01+23%3A59%3A59',
      'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/reservations?requestId=sms-reservation-request&pageNum=1&pageSize=100',
      'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/reservations/sms-reservation-request/7',
      'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/reservations/cancel',
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/messages?senderKey=sender-key&pageNum=1&pageSize=100',
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/messages/alim-request/3',
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/message-results?startUpdateDate=2026-06-01+00%3A00&endUpdateDate=2026-06-01+23%3A59',
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/brand-message/v1.0/appkeys/kakao-app-key/messages?senderKey=sender-key&pageNum=1&pageSize=100',
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/brand-message/v1.0/appkeys/kakao-app-key/messages/brand-request/4',
    ]);
    expect(fetchImpl.mock.calls[7][1].method).toBe('PUT');
    expect(JSON.parse(fetchImpl.mock.calls[7][1].body)).toEqual({
      reservationList: [{ recipientSeq: 7, requestId: 'sms-reservation-request' }],
      updateUser: 'relay-user',
    });
    expect(fetchImpl.mock.calls.every(([, init]) => init.headers['X-Secret-Key'])).toBe(true);
    expect(fetchImpl.mock.calls.every(([url]) => !String(url).includes('secret'))).toBe(true);
  });

  it('uploads Brand Message images as multipart form data without forcing a JSON content type', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
        image: { imageSeq: 'image-seq-1' },
      })
    );
    const client = createNhnKakaoBizmessageClient({
      config: {
        appKey: 'kakao-app-key',
        secretKey: 'kakao-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.KAKAO_BIZMESSAGE,
      },
      fetchImpl,
    });
    const formData = new FormData();
    formData.set('imageType', 'IMAGE');
    formData.set('image', new Blob(['image-bytes'], { type: 'image/png' }), 'brand.png');

    await client.uploadBrandImage(formData);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      'https://kakaotalk-bizmessage.api.nhncloudservice.com/brand-message/v1.0/appkeys/kakao-app-key/images'
    );
    expect(init.method).toBe('POST');
    expect(init.body).toBe(formData);
    expect(init.headers['X-Secret-Key']).toBe('kakao-secret-key');
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('classifies NHN 429 responses as provider rate limits', async () => {
    const fetchImpl = vi.fn(async () =>
      createJsonResponse(
        {
          header: { isSuccessful: false, resultCode: 429, resultMessage: 'Too Many Requests' },
        },
        { status: 429, statusText: 'Too Many Requests' }
      )
    );
    const client = createNhnSmsClient({
      config: {
        appKey: 'sms-app-key',
        secretKey: 'sms-secret-key',
        baseUrl: NHN_DIRECT_API_BASE_URLS.SMS,
      },
      fetchImpl,
    });

    let caughtError;
    try {
      await client.sendSms({ body: 'hello', sendNo: '15446859', recipientList: [] });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toMatchObject({ status: 429, providerMessage: 'Too Many Requests' });
    expect(isProviderRateLimit(caughtError)).toBe(true);
    expect(providerErrorEnvelope(caughtError)).toMatchObject({
      ok: false,
      error: {
        source: 'nhn',
        code: RELAY_ERROR_CODES.PROVIDER_RATE_LIMITED,
        message: 'NHN 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.',
        providerCode: '429',
        providerMessage: 'Too Many Requests',
      },
    });
  });

  it('classifies provider timeout and unknown-after-call envelopes', () => {
    const timeoutError = new DOMException('The operation was aborted.', 'TimeoutError');

    expect(isProviderTimeout(timeoutError)).toBe(true);
    expect(classifyProviderFailure(timeoutError)).toEqual({
      code: RELAY_ERROR_CODES.PROVIDER_TIMEOUT,
      retryable: true,
    });
    expect(providerErrorEnvelope(timeoutError, { unknownAfterProviderCall: true })).toMatchObject({
      ok: false,
      error: {
        source: 'nhn',
        code: RELAY_ERROR_CODES.UNKNOWN_AFTER_PROVIDER_CALL,
        message: 'NHN 응답을 확인하지 못했습니다. 중복 발송 가능성을 확인한 뒤 다시 시도하세요.',
      },
    });
    expect(providerErrorEnvelope(timeoutError, { unknownAfterProviderCall: true }).error).not.toHaveProperty(
      'providerMessage'
    );
  });
});

describe('relay route parsing', () => {
  it('treats malformed JSON request bodies as local validation failures', async () => {
    const request = new Request('http://localhost/api/messages/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{"bad-json"',
    });

    await expect(parseRelayRequest(request)).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      state: 'local_validation_failed',
      status: 400,
    });
  });

  it('treats malformed multipart request bodies as local validation failures', async () => {
    const request = new Request('http://localhost/api/messages/brand/images', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=----broken',
      },
      body: 'not a valid multipart body',
    });

    await expect(parseRelayRequest(request)).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
      message: 'Request body must be valid multipart form data.',
      state: 'local_validation_failed',
      status: 400,
    });
  });
});
