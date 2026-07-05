import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  createNhnKakaoBizmessageWebhookReceiver,
  mapKakaoHookSnapshotState,
} from '../nhn/kakaoBizmessageWebhookReceiver.js';
import { CHANNELS } from '../relay/constants.js';
import { buildRecipientGroupingKey } from '../relay/groupingKeys.js';

const WEBHOOK_URL = 'http://localhost/api/nhn/webhooks/kakao-bizmessage';
const ENV = {
  NHN_KAKAO_BIZMESSAGE_APP_KEY: 'kakao-app-key',
  NHN_KAKAO_BIZMESSAGE_WEBHOOK_SIGNATURE: 'webhook-secret',
};
const SENDER_GROUPING_KEY = 'u:user1:b:bill1:r:res1:q:req1';

describe('NHN Kakao Bizmessage webhook receiver', () => {
  it('accepts AlimTalk result webhooks with the documented Toast signature header', async () => {
    const repository = createWebhookRepository([
      createProviderRequestRow({
        channel: CHANNELS.ALIMTALK,
        providerRequestId: 'alimtalk-request-1',
      }),
    ]);
    const receiver = createTestReceiver({ repository });
    const response = await receiver.handleRequest(createWebhookRequest({
      body: createPayload({
        hooks: [
          createHook({
            kakaoMessageType: 'ALIMTALK_NORMAL',
            recipientGroupingKey: buildRecipientGroupingKey(SENDER_GROUPING_KEY, 0),
            recipientNo: '01012345678',
            requestId: 'alimtalk-request-1',
          }),
        ],
      }),
      headers: {
        'X-Toast-Webhook-Signature': 'webhook-secret',
      },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        changedCount: 1,
        ignoredCount: 0,
        malformedCount: 0,
        receivedCount: 1,
        unmatchedCount: 0,
        updatedCount: 1,
        validCount: 1,
      },
    });
    expect(repository.mergeCalls).toEqual([
      {
        authoritative: false,
        channel: CHANNELS.ALIMTALK,
        providerRequestId: 'alimtalk-request-1',
        results: [{ recipientSeq: 1, resultCode: 'MRC01', state: 'S' }],
      },
    ]);
    expect(JSON.stringify(repository.mergeCalls)).not.toContain('01012345678');
  });

  it('passes failed hook recipient numbers into snapshot merge entries', async () => {
    const repository = createWebhookRepository([
      createProviderRequestRow({
        channel: CHANNELS.BRAND_MESSAGE,
        providerRequestId: 'brand-request-failed',
      }),
    ]);
    const receiver = createTestReceiver({ repository });

    await receiver.handleRequest(createWebhookRequest({
      body: createPayload({
        hooks: [
          createHook({
            kakaoMessageType: 'BRAND_MESSAGE_NORMAL',
            recipientNo: ' 01099998888 ',
            requestId: 'brand-request-failed',
            resultCode: 'MRC04',
          }),
        ],
      }),
      headers: {
        'X-Toast-Webhook-Signature': 'webhook-secret',
      },
    }));

    expect(repository.mergeCalls).toEqual([
      {
        authoritative: false,
        channel: CHANNELS.BRAND_MESSAGE,
        providerRequestId: 'brand-request-failed',
        results: [{ recipientNo: '01099998888', recipientSeq: 1, resultCode: 'MRC04', state: 'F' }],
      },
    ]);
  });

  it('accepts the optional NHN signature header for SMS parity', async () => {
    const repository = createWebhookRepository([
      createProviderRequestRow({
        channel: CHANNELS.BRAND_MESSAGE,
        providerRequestId: 'brand-request-1',
      }),
    ]);
    const receiver = createTestReceiver({ repository });
    const response = await receiver.handleRequest(createWebhookRequest({
      body: createPayload({
        hooks: [createHook({ kakaoMessageType: 'BRAND_MESSAGE_NORMAL', requestId: 'brand-request-1' })],
      }),
      headers: {
        'X-Nhn-Webhook-Signature': 'webhook-secret',
      },
    }));

    expect(response.status).toBe(200);
    expect(repository.mergeCalls).toHaveLength(1);
  });

  it('rejects missing or wrong signatures before processing hooks', async () => {
    const missingSignatureRepository = createWebhookRepository([
      createProviderRequestRow({ providerRequestId: 'alimtalk-request-1' }),
    ]);
    const wrongSignatureRepository = createWebhookRepository([
      createProviderRequestRow({ providerRequestId: 'alimtalk-request-1' }),
    ]);
    const receiverWithMissingSignature = createTestReceiver({ repository: missingSignatureRepository });
    const receiverWithWrongSignature = createTestReceiver({ repository: wrongSignatureRepository });

    const missingSignature = await receiverWithMissingSignature.handleRequest(createWebhookRequest({
      body: createPayload({ hooks: [createHook()] }),
    }));
    const wrongSignature = await receiverWithWrongSignature.handleRequest(createWebhookRequest({
      body: createPayload({ hooks: [createHook()] }),
      headers: { 'X-Toast-Webhook-Signature': 'wrong-secret' },
    }));

    expect(missingSignature.status).toBe(401);
    expect(wrongSignature.status).toBe(401);
    expect(missingSignatureRepository.mergeCalls).toEqual([]);
    expect(wrongSignatureRepository.mergeCalls).toEqual([]);
  });

  it('rejects wrong app key, product, event, and oversized hook arrays', async () => {
    const cases = [
      { body: createPayload({ appKey: 'other-app-key' }), status: 403 },
      { body: createPayload({ productName: 'SMS' }), status: 400 },
      { body: createPayload({ event: 'UNSUBSCRIBE' }), status: 400 },
      { body: createPayload({ hooks: Array.from({ length: 1001 }, () => createHook()) }), status: 400 },
    ];

    for (const testCase of cases) {
      const repository = createWebhookRepository([
        createProviderRequestRow({ providerRequestId: 'alimtalk-request-1' }),
      ]);
      const receiver = createTestReceiver({ repository });
      const response = await receiver.handleRequest(createWebhookRequest({
        body: testCase.body,
        headers: { 'X-Toast-Webhook-Signature': 'webhook-secret' },
      }));

      expect(response.status).toBe(testCase.status);
      expect(repository.mergeCalls).toEqual([]);
    }
  });

  it('accepts the signed NHN console verification placeholder without merging hooks', async () => {
    const repository = createWebhookRepository([
      createProviderRequestRow({ providerRequestId: 'alimtalk-request-1' }),
    ]);
    const receiver = createTestReceiver({ repository });
    const response = await receiver.handleRequest(createWebhookRequest({
      body: createPayload({
        appKey: 'String',
        hooks: [createHook({ requestId: 'alimtalk-request-1' })],
      }),
      headers: { 'X-Toast-Webhook-Signature': 'webhook-secret' },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      changedCount: 0,
      ignoredCount: 1,
      malformedCount: 0,
      receivedCount: 1,
      unmatchedCount: 0,
      updatedCount: 0,
      validCount: 0,
    });
    expect(repository.mergeCalls).toEqual([]);
  });

  it('maps Brand Message non-success result codes to compact failures', async () => {
    const repository = createWebhookRepository([
      createProviderRequestRow({
        channel: CHANNELS.BRAND_MESSAGE,
        providerRequestId: 'brand-request-1',
      }),
    ]);
    const receiver = createTestReceiver({ repository });

    await receiver.handleRequest(createWebhookRequest({
      body: createPayload({
        hooks: [
          createHook({
            kakaoMessageType: 'BRAND_MESSAGE_NORMAL',
            recipientSeq: 2,
            requestId: 'brand-request-1',
            resultCode: 'MRC04',
          }),
        ],
      }),
      headers: { 'X-Toast-Webhook-Signature': 'webhook-secret' },
    }));

    expect(repository.mergeCalls[0]).toEqual({
      authoritative: false,
      channel: CHANNELS.BRAND_MESSAGE,
      providerRequestId: 'brand-request-1',
      results: [{ recipientNo: '01012345678', recipientSeq: 2, resultCode: 'MRC04', state: 'F' }],
    });
  });

  it('maps NHN Kakao result code 1000 to compact success', async () => {
    const repository = createWebhookRepository([
      createProviderRequestRow({
        channel: CHANNELS.ALIMTALK,
        providerRequestId: 'alimtalk-request-1000',
      }),
    ]);
    const receiver = createTestReceiver({ repository });

    await receiver.handleRequest(createWebhookRequest({
      body: createPayload({
        hooks: [
          createHook({
            kakaoMessageType: 'ALIMTALK_NORMAL',
            requestId: 'alimtalk-request-1000',
            resultCode: '1000',
          }),
        ],
      }),
      headers: { 'X-Toast-Webhook-Signature': 'webhook-secret' },
    }));

    expect(repository.mergeCalls[0]).toEqual({
      authoritative: false,
      channel: CHANNELS.ALIMTALK,
      providerRequestId: 'alimtalk-request-1000',
      results: [{ recipientSeq: 1, resultCode: '1000', state: 'S' }],
    });
  });

  it('ignores neutral NHN Kakao result codes instead of merging them as failures', async () => {
    const repository = createWebhookRepository([
      createProviderRequestRow({
        channel: CHANNELS.ALIMTALK,
        providerRequestId: 'alimtalk-request-neutral',
      }),
    ]);
    const receiver = createTestReceiver({ repository });
    const response = await receiver.handleRequest(createWebhookRequest({
      body: createPayload({
        hooks: [
          createHook({
            kakaoMessageType: 'ALIMTALK_NORMAL',
            requestId: 'alimtalk-request-neutral',
            resultCode: '0',
          }),
        ],
      }),
      headers: { 'X-Toast-Webhook-Signature': 'webhook-secret' },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      ignoredCount: 1,
      updatedCount: 0,
      validCount: 0,
    });
    expect(repository.mergeCalls).toEqual([]);
  });

  it('ignores unsupported, missing-result, and conflicting-grouping hooks without raw persistence', async () => {
    const repository = createWebhookRepository([
      createProviderRequestRow({ providerRequestId: 'alimtalk-request-1' }),
    ]);
    const receiver = createTestReceiver({ repository });
    const response = await receiver.handleRequest(createWebhookRequest({
      body: createPayload({
        hooks: [
          { kakaoMessageType: 'ALIMTALK_NORMAL', recipientNo: '01011112222' },
          createHook({ kakaoMessageType: 'FRIENDTALK_NORMAL', requestId: 'alimtalk-request-1' }),
          createHook({ requestId: 'alimtalk-request-1', resultCode: null }),
          createHook({
            recipientGroupingKey: buildRecipientGroupingKey(SENDER_GROUPING_KEY, 5),
            requestId: 'alimtalk-request-1',
          }),
        ],
      }),
      headers: { 'X-Toast-Webhook-Signature': 'webhook-secret' },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      ignoredCount: 3,
      malformedCount: 1,
      receivedCount: 4,
      updatedCount: 0,
      validCount: 0,
    });
    expect(repository.mergeCalls).toEqual([]);
    expect(JSON.stringify(repository)).not.toContain('01011112222');
  });

  it('returns success with a safe unmatched count when the local provider request is unknown', async () => {
    const repository = createWebhookRepository([]);
    const receiver = createTestReceiver({ repository });
    const response = await receiver.handleRequest(createWebhookRequest({
      body: createPayload({
        hooks: [
          createHook({ requestId: 'unknown-request-1' }),
          createHook({ recipientSeq: 2, requestId: 'unknown-request-1', resultCode: 'MRC04' }),
        ],
      }),
      headers: { 'X-Toast-Webhook-Signature': 'webhook-secret' },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      changedCount: 0,
      unmatchedCount: 2,
      updatedCount: 0,
      validCount: 2,
    });
    expect(repository.mergeCalls).toEqual([]);
    expect(JSON.stringify(body)).not.toContain('unknown-request-1');
  });

  it('keeps the public route free of browser actor authentication', async () => {
    const routeSource = await readFile(
      new URL('../../app/api/nhn/webhooks/kakao-bizmessage/route.js', import.meta.url),
      'utf8'
    );

    expect(routeSource).not.toContain('resolveRelayActor');
  });

  it('maps final Kakao result codes without treating neutral codes as failures', () => {
    expect(mapKakaoHookSnapshotState({ resultCode: 'MRC01' })).toBe('S');
    expect(mapKakaoHookSnapshotState({ resultCode: '1000' })).toBe('S');
    expect(mapKakaoHookSnapshotState({ resultCode: 'MRC04' })).toBe('F');
    expect(mapKakaoHookSnapshotState({ resultCode: '0' })).toBe(null);
  });
});

function createTestReceiver({ repository }) {
  return createNhnKakaoBizmessageWebhookReceiver({
    env: ENV,
    now: () => new Date('2026-06-10T12:00:00.000Z'),
    repository,
  });
}

function createWebhookRequest({ body, headers = {} } = {}) {
  return new Request(WEBHOOK_URL, {
    body: JSON.stringify(body ?? createPayload()),
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    method: 'POST',
  });
}

function createPayload(overrides = {}) {
  return {
    appKey: 'kakao-app-key',
    event: 'MESSAGE_RESULT_UPDATE',
    hooks: [createHook()],
    hooksId: 'hooks-1',
    productName: 'KakaoTalk Bizmessage',
    webhookConfigId: 'webhook-config-1',
    ...overrides,
  };
}

function createHook(overrides = {}) {
  return {
    _links: {
      self: {
        href: 'https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/kakao-app-key/messages/alimtalk-request-1/1',
      },
    },
    hookId: 'hook-1',
    kakaoMessageType: 'ALIMTALK_NORMAL',
    receiveDate: '2026-06-10T12:00:10',
    recipientGroupingKey: buildRecipientGroupingKey(SENDER_GROUPING_KEY, Number(overrides.recipientSeq ?? 1) - 1),
    recipientNo: '01012345678',
    recipientSeq: 1,
    requestDate: '2026-06-10T12:00:00',
    requestId: 'alimtalk-request-1',
    resultCode: 'MRC01',
    senderGroupingKey: SENDER_GROUPING_KEY,
    ...overrides,
  };
}

function createProviderRequestRow({
  channel = CHANNELS.ALIMTALK,
  providerRequestId,
  requestId = 'ledger_request_1',
} = {}) {
  return {
    group: {
      channel,
      id: 'ledger_group_1',
    },
    providerRequest: {
      id: requestId,
      providerRequestId,
      recipientCount: 10,
    },
  };
}

function createWebhookRepository(rows) {
  return {
    mergeCalls: [],

    async mergeProviderRequestResultSnapshotByProviderRequestId({ authoritative, channel, providerRequestId, results }) {
      const row = rows.find((item) =>
        item.providerRequest.providerRequestId === providerRequestId && item.group.channel === channel
      );

      if (!row) return null;

      this.mergeCalls.push({ authoritative, channel, providerRequestId, results });
      return {
        changedCount: results.length,
        group: null,
        groupId: 'ledger_group_1',
        providerRequest: row.providerRequest,
      };
    },
  };
}
