import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { buildRecipientGroupingKey } from '../relay/groupingKeys.js';
import { createNhnSmsWebhookReceiver, mapHookSnapshotState } from '../nhn/smsWebhookReceiver.js';

const WEBHOOK_URL = 'http://localhost/api/nhn/webhooks/sms';
const ENV = {
  NHN_SMS_APP_KEY: 'sms-app-key',
  NHN_SMS_WEBHOOK_SIGNATURE: 'webhook-secret',
};
const SENDER_GROUPING_KEY = 'u:user1:b:bill1:r:res1:q:req1';

describe('NHN SMS webhook receiver', () => {
  it('accepts MESSAGE_RESULT_UPDATE webhooks with the preferred signature header', async () => {
    const repository = createWebhookRepository([
      createProviderRequestRow({ providerRequestId: 'sms-request-1', requestId: 'ledger_request_1' }),
    ]);
    const receiver = createTestReceiver({ repository });
    const response = await receiver.handleRequest(createWebhookRequest({
      body: createPayload({
        hooks: [
          createHook({
            recipientGroupingKey: buildRecipientGroupingKey(SENDER_GROUPING_KEY, 0),
            recipientNo: '01012345678',
            requestId: 'sms-request-1',
          }),
        ],
      }),
      headers: {
        'X-Nhn-Webhook-Signature': 'webhook-secret',
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
        providerRequestId: 'sms-request-1',
        results: [{ recipientSeq: 1, resultCode: '1000', state: 'S' }],
      },
    ]);
    expect(JSON.stringify(repository.mergeCalls)).not.toContain('01012345678');
  });

  it('passes failed hook recipient numbers into snapshot merge entries', async () => {
    const repository = createWebhookRepository([
      createProviderRequestRow({ providerRequestId: 'sms-request-failed', requestId: 'ledger_request_1' }),
    ]);
    const receiver = createTestReceiver({ repository });

    await receiver.handleRequest(createWebhookRequest({
      body: createPayload({
        hooks: [
          createHook({
            messageStatus: 'FAILED',
            recipientNo: ' 01099998888 ',
            requestId: 'sms-request-failed',
            resultCode: '3003',
          }),
        ],
      }),
      headers: {
        'X-Nhn-Webhook-Signature': 'webhook-secret',
      },
    }));

    expect(repository.mergeCalls).toEqual([
      {
        authoritative: false,
        providerRequestId: 'sms-request-failed',
        results: [{ recipientNo: '01099998888', recipientSeq: 1, resultCode: '3003', state: 'F' }],
      },
    ]);
  });

  it('accepts the legacy Toast signature header', async () => {
    const repository = createWebhookRepository([
      createProviderRequestRow({ providerRequestId: 'sms-request-legacy' }),
    ]);
    const receiver = createTestReceiver({ repository });
    const response = await receiver.handleRequest(createWebhookRequest({
      body: createPayload({
        hooks: [createHook({ requestId: 'sms-request-legacy' })],
      }),
      headers: {
        'X-Toast-Webhook-Signature': 'webhook-secret',
      },
    }));

    expect(response.status).toBe(200);
    expect(repository.mergeCalls).toHaveLength(1);
  });

  it('rejects missing or wrong signatures before processing hooks', async () => {
    const missingSignatureRepository = createWebhookRepository([
      createProviderRequestRow({ providerRequestId: 'sms-request-1' }),
    ]);
    const wrongSignatureRepository = createWebhookRepository([
      createProviderRequestRow({ providerRequestId: 'sms-request-1' }),
    ]);
    const receiverWithMissingSignature = createTestReceiver({ repository: missingSignatureRepository });
    const receiverWithWrongSignature = createTestReceiver({ repository: wrongSignatureRepository });

    const missingSignature = await receiverWithMissingSignature.handleRequest(createWebhookRequest({
      body: createPayload({ hooks: [createHook()] }),
    }));
    const wrongSignature = await receiverWithWrongSignature.handleRequest(createWebhookRequest({
      body: createPayload({ hooks: [createHook()] }),
      headers: { 'X-Nhn-Webhook-Signature': 'wrong-secret' },
    }));

    expect(missingSignature.status).toBe(401);
    expect(wrongSignature.status).toBe(401);
    expect(missingSignatureRepository.mergeCalls).toEqual([]);
    expect(wrongSignatureRepository.mergeCalls).toEqual([]);
  });

  it('rejects absent webhook signature configuration', async () => {
    const repository = createWebhookRepository([
      createProviderRequestRow({ providerRequestId: 'sms-request-1' }),
    ]);
    const receiver = createNhnSmsWebhookReceiver({
      env: { NHN_SMS_APP_KEY: 'sms-app-key' },
      repository,
    });

    const response = await receiver.handleRequest(createWebhookRequest({
      body: createPayload({ hooks: [createHook()] }),
      headers: { 'X-Nhn-Webhook-Signature': 'webhook-secret' },
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe('RELAY_CONFIG_ERROR');
    expect(repository.mergeCalls).toEqual([]);
  });

  it('rejects wrong app key, product, and event envelopes', async () => {
    const cases = [
      { body: createPayload({ appKey: 'other-app-key' }), status: 403 },
      { body: createPayload({ productName: 'KAKAO' }), status: 400 },
      { body: createPayload({ event: 'UNSUBSCRIBE' }), status: 400 },
    ];

    for (const testCase of cases) {
      const repository = createWebhookRepository([
        createProviderRequestRow({ providerRequestId: 'sms-request-1' }),
      ]);
      const receiver = createTestReceiver({ repository });
      const response = await receiver.handleRequest(createWebhookRequest({
        body: testCase.body,
        headers: { 'X-Nhn-Webhook-Signature': 'webhook-secret' },
      }));

      expect(response.status).toBe(testCase.status);
      expect(repository.mergeCalls).toEqual([]);
    }
  });

  it('accepts the signed NHN console verification placeholder without merging hooks', async () => {
    const repository = createWebhookRepository([
      createProviderRequestRow({ providerRequestId: 'sms-request-1' }),
    ]);
    const receiver = createTestReceiver({ repository });
    const response = await receiver.handleRequest(createWebhookRequest({
      body: createPayload({
        appKey: 'String',
        hooks: [createHook({ requestId: 'sms-request-1' })],
      }),
      headers: {
        'X-Nhn-Webhook-Signature': 'webhook-secret',
        'X-Toast-Webhook-Signature': 'webhook-secret',
      },
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

  it('ignores malformed, unsupported, non-terminal, and conflicting-grouping hooks without raw persistence', async () => {
    const repository = createWebhookRepository([
      createProviderRequestRow({ providerRequestId: 'sms-request-1' }),
    ]);
    const receiver = createTestReceiver({ repository });
    const response = await receiver.handleRequest(createWebhookRequest({
      body: createPayload({
        hooks: [
          { senderType: 'NORMAL_SMS', recipientNo: '01011112222' },
          createHook({ messageStatus: 'READY', resultCode: null, requestId: 'sms-request-1' }),
          createHook({ requestId: 'sms-request-1', senderType: 'EMAIL' }),
          createHook({
            recipientGroupingKey: buildRecipientGroupingKey(SENDER_GROUPING_KEY, 5),
            requestId: 'sms-request-1',
          }),
        ],
      }),
      headers: { 'X-Nhn-Webhook-Signature': 'webhook-secret' },
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
          createHook({ recipientSeq: 2, requestId: 'unknown-request-1', resultCode: '3003' }),
        ],
      }),
      headers: { 'X-Nhn-Webhook-Signature': 'webhook-secret' },
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

  it('maps webhook terminal states to compact snapshot states', async () => {
    const repository = createWebhookRepository([
      createProviderRequestRow({ providerRequestId: 'sms-request-1', requestId: 'ledger_request_1' }),
    ]);
    const receiver = createTestReceiver({ repository });
    await receiver.handleRequest(createWebhookRequest({
      body: createPayload({
        hooks: [
          createHook({ messageStatus: 'COMPLETED', recipientSeq: 1, requestId: 'sms-request-1', resultCode: null }),
          createHook({ messageStatus: 'CANCEL', recipientSeq: 2, requestId: 'sms-request-1', resultCode: null }),
          createHook({ messageStatus: 'FAILED_AD', recipientSeq: 3, requestId: 'sms-request-1', resultCode: null }),
          createHook({ messageStatus: null, recipientSeq: 4, requestId: 'sms-request-1', resultCode: '3003' }),
        ],
      }),
      headers: { 'X-Nhn-Webhook-Signature': 'webhook-secret' },
    }));

    expect(repository.mergeCalls[0].results).toEqual([
      { recipientSeq: 2, resultCode: null, state: 'C' },
      { recipientNo: '01012345678', recipientSeq: 3, resultCode: null, state: 'F' },
      { recipientNo: '01012345678', recipientSeq: 4, resultCode: '3003', state: 'F' },
    ]);
  });

  it('lets final SMS result codes override completed webhook statuses', () => {
    expect(mapHookSnapshotState({ messageStatus: 'COMPLETED', resultCode: '3003' })).toBe('F');
    expect(mapHookSnapshotState({ messageStatus: 'FAILED', resultCode: '1000' })).toBe('S');
    expect(mapHookSnapshotState({ messageStatus: 'COMPLETED', resultCode: '0' })).toBe(null);
  });

  it('keeps the public route free of browser actor authentication', async () => {
    const routeSource = await readFile(
      new URL('../../app/api/nhn/webhooks/sms/route.js', import.meta.url),
      'utf8'
    );

    expect(routeSource).not.toContain('resolveRelayActor');
  });
});

function createTestReceiver({ repository }) {
  return createNhnSmsWebhookReceiver({
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
    appKey: 'sms-app-key',
    event: 'MESSAGE_RESULT_UPDATE',
    hooks: [createHook()],
    hooksId: 'hooks-1',
    productName: 'SMS',
    webhookConfigId: 'webhook-config-1',
    ...overrides,
  };
}

function createHook(overrides = {}) {
  return {
    _links: {
      self: {
        href: 'https://sms.api.nhncloudservice.com/sms/v3.0/appKeys/sms-app-key/sender/sms/sms-request-1?recipientSeq=1',
      },
    },
    hookId: 'hook-1',
    messageStatus: 'COMPLETED',
    receiveDate: '2026-06-10T12:00:10',
    recipientGroupingKey: buildRecipientGroupingKey(SENDER_GROUPING_KEY, Number(overrides.recipientSeq ?? 1) - 1),
    recipientNo: '01012345678',
    recipientSeq: 1,
    requestDate: '2026-06-10T12:00:00',
    requestId: 'sms-request-1',
    resultCode: '1000',
    sendNo: '15446859',
    senderGroupingKey: SENDER_GROUPING_KEY,
    senderType: 'NORMAL_SMS',
    ...overrides,
  };
}

function createProviderRequestRow({ providerRequestId, requestId = 'ledger_request_1' } = {}) {
  return {
    group: {
      channel: 'sms',
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

    async mergeProviderRequestResultSnapshotByProviderRequestId({ authoritative, providerRequestId, results }) {
      const row = rows.find((item) => item.providerRequest.providerRequestId === providerRequestId);

      if (!row) return null;

      this.mergeCalls.push({ authoritative, providerRequestId, results });
      return {
        changedCount: results.length,
        group: null,
        groupId: 'ledger_group_1',
        providerRequest: row.providerRequest,
      };
    },
  };
}
