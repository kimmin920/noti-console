import { describe, expect, it, vi } from 'vitest';

import { RELAY_ERROR_CODES, SEND_RESPONSE_STATES } from '../relay/constants.js';
import { SenderResourceQuotaExceededError } from '../messages/quota.js';
import { createMessageSendService } from '../messages/service.js';

const CLIENT_REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-07-17T05:00:00.000Z');

describe('sender resource quota send integration', () => {
  it('reserves quota before calling NHN and keeps the reservation pending after acceptance', async () => {
    const calls = [];
    const ledgerRepository = createQuotaLedgerRepository({ calls });
    const smsClient = createSmsClient({
      sendSms: vi.fn(async () => {
        calls.push('provider');
        return acceptedSmsResponse();
      }),
    });
    const service = createService({ ledgerRepository, smsClient });

    const result = await service.sendSms({
      actorUserId: 'user_1',
      payload: smsPayload(),
    });

    expect(calls).toEqual(['prepare', 'provider', 'outcome:accepted']);
    expect(ledgerRepository.prepareGroupWithProviderRequestsAndQuota).toHaveBeenCalledWith(
      expect.objectContaining({
        quotaReservations: [
          expect.objectContaining({
            kind: 'primary',
            reservedCount: 1,
            quota: expect.objectContaining({
              quotaChannel: 'sms',
              senderResourceId: 'sms_resource_1',
            }),
          }),
        ],
      })
    );
    expect(ledgerRepository.updatePreparedProviderRequestOutcome).toHaveBeenCalledWith({
      clientRequestId: CLIENT_REQUEST_ID,
      providerRequestId: 'sms-provider-1',
      providerState: 'accepted',
    });
    expect(result.state).toBe(SEND_RESPONSE_STATES.ACCEPTED_BY_PROVIDER);
  });

  it('does not call NHN when the sender resource quota reservation fails', async () => {
    const ledgerRepository = createQuotaLedgerRepository({
      prepareError: new SenderResourceQuotaExceededError({
        quotaChannel: 'sms',
        requestedCount: 1,
        senderResourceId: 'sms_resource_1',
      }),
    });
    const smsClient = createSmsClient({ sendSms: vi.fn() });
    const service = createService({ ledgerRepository, smsClient });

    await expect(
      service.sendSms({ actorUserId: 'user_1', payload: smsPayload() })
    ).rejects.toMatchObject({
      code: RELAY_ERROR_CODES.SENDER_RESOURCE_QUOTA_EXCEEDED,
      retryable: false,
      status: 429,
    });
    expect(smsClient.sendSms).not.toHaveBeenCalled();
    expect(ledgerRepository.updatePreparedProviderRequestOutcome).not.toHaveBeenCalled();
  });

  it('returns the existing ledger state without calling NHN for a duplicate client request', async () => {
    const ledgerRepository = createQuotaLedgerRepository({
      preparedResult: {
        deduplicated: true,
        group: { id: 'group_existing' },
        providerRequests: [
          {
            id: 'request_existing',
            providerRequestId: 'sms-provider-existing',
            providerState: 'accepted',
          },
        ],
      },
    });
    const smsClient = createSmsClient({ sendSms: vi.fn() });
    const service = createService({ ledgerRepository, smsClient });

    const result = await service.sendSms({ actorUserId: 'user_1', payload: smsPayload() });

    expect(smsClient.sendSms).not.toHaveBeenCalled();
    expect(ledgerRepository.updatePreparedProviderRequestOutcome).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      state: SEND_RESPONSE_STATES.ACCEPTED_BY_PROVIDER,
      provider: { requestId: 'sms-provider-existing' },
      ledger: { groupId: 'group_existing', requestLocalId: 'request_existing' },
    });
  });

  it('holds the reservation when the NHN outcome is unknown', async () => {
    const ledgerRepository = createQuotaLedgerRepository();
    const timeout = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' });
    const smsClient = createSmsClient({ sendSms: vi.fn(async () => { throw timeout; }) });
    const service = createService({ ledgerRepository, smsClient });

    const result = await service.sendSms({ actorUserId: 'user_1', payload: smsPayload() });

    expect(result).toMatchObject({
      state: SEND_RESPONSE_STATES.UNKNOWN_AFTER_PROVIDER_CALL,
      error: { code: RELAY_ERROR_CODES.UNKNOWN_AFTER_PROVIDER_CALL },
    });
    expect(ledgerRepository.updatePreparedProviderRequestOutcome).toHaveBeenCalledWith({
      clientRequestId: CLIENT_REQUEST_ID,
      providerRequestId: null,
      providerState: 'unknown',
    });
  });

  it('releases only recipients explicitly rejected in the synchronous provider response', async () => {
    const ledgerRepository = createQuotaLedgerRepository();
    const smsClient = createSmsClient({
      sendSms: vi.fn(async () => ({
        body: {
          data: {
            requestId: 'sms-provider-partial',
            sendResultList: [
              { recipientSeq: 1, resultCode: 0, resultMessage: 'SUCCESS' },
              { recipientSeq: 2, resultCode: 101, resultMessage: 'INVALID_RECIPIENT' },
            ],
          },
        },
        header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      })),
    });
    const service = createService({ ledgerRepository, smsClient });

    await service.sendSms({
      actorUserId: 'user_1',
      payload: {
        ...smsPayload(),
        recipients: [
          { recipientNo: '01012345678' },
          { recipientNo: '01012345679' },
        ],
      },
    });

    expect(ledgerRepository.updatePreparedProviderRequestOutcome).toHaveBeenCalledWith({
      clientRequestId: CLIENT_REQUEST_ID,
      providerRequestId: 'sms-provider-partial',
      providerState: 'accepted',
      recipientResults: [{ recipientSeq: 2, resultCode: 101, state: 'F' }],
    });
  });

  it('reserves the Kakao primary quota and SMS fallback quota together before sending', async () => {
    const calls = [];
    const ledgerRepository = createQuotaLedgerRepository({ calls });
    const kakaoClient = createKakaoClient({
      sendAlimtalkMessage: vi.fn(async () => {
        calls.push('provider');
        return acceptedAlimtalkResponse();
      }),
    });
    const service = createService({ kakaoClient, ledgerRepository });

    await service.sendAlimtalk({
      actorUserId: 'user_1',
      payload: {
        clientRequestId: CLIENT_REQUEST_ID,
        senderResourceId: 'kakao_resource_1',
        templateCode: 'ORDER_READY',
        recipients: [{ recipientNo: '01012345678', templateParameter: { orderNo: 'A-1' } }],
        fallback: {
          enabled: true,
          smsSenderResourceId: 'sms_resource_1',
          resendType: 'SMS',
        },
      },
    });

    expect(calls).toEqual(['prepare', 'provider', 'outcome:accepted']);
    const [{ quotaReservations }] = ledgerRepository.prepareGroupWithProviderRequestsAndQuota.mock.calls[0];
    expect(quotaReservations).toEqual([
      expect.objectContaining({
        kind: 'primary',
        reservedCount: 1,
        quota: expect.objectContaining({
          quotaChannel: 'alimtalk',
          senderResourceId: 'kakao_resource_1',
        }),
      }),
      expect.objectContaining({
        kind: 'fallback',
        reservedCount: 1,
        quota: expect.objectContaining({
          quotaChannel: 'sms',
          senderResourceId: 'sms_resource_1',
        }),
        settlementSnapshotJson: {
          states: ['P'],
          resultCodes: [null],
        },
      }),
    ]);
  });
});

function createService({ kakaoClient, ledgerRepository, smsClient } = {}) {
  return createMessageSendService({
    repository: createRepository(),
    ledgerRepository,
    smsClient: smsClient ?? createSmsClient(),
    kakaoClient: kakaoClient ?? createKakaoClient(),
    now: () => NOW,
  });
}

function createRepository() {
  const resources = {
    sms_resource_1: {
      id: 'sms_resource_1',
      displayName: '1544-6859',
      provider: 'nhn',
      resourceRef: 'sms-ref-1',
      status: 'active',
      type: 'sms_send_no',
      value: '15446859',
    },
    kakao_resource_1: {
      id: 'kakao_resource_1',
      displayName: '@store',
      provider: 'nhn',
      resourceRef: 'kakao-ref-1',
      status: 'active',
      type: 'kakao_sender_key',
      value: 'sender-key-1',
    },
  };

  return {
    async getUserById(userId) {
      return userId === 'user_1'
        ? { id: 'user_1', email: 'user@example.com', status: 'active', userRef: 'user-ref-1' }
        : null;
    },
    async getUserSenderResource({ senderResourceId, userId }) {
      const resource = resources[senderResourceId];
      if (userId !== 'user_1' || !resource) return null;
      return {
        link: {
          billingAccountId: 'billing_1',
          role: 'sender',
          status: 'active',
        },
        resource,
      };
    },
    async getBillingAccountById(billingAccountId) {
      return billingAccountId === 'billing_1'
        ? { billingRef: 'billing-ref-1', id: 'billing_1', status: 'active' }
        : null;
    },
    async findBillingAccountForUser() {
      return null;
    },
    async createAuditLog(values) {
      return { id: 'audit_1', ...values };
    },
  };
}

function createQuotaLedgerRepository({ calls = [], prepareError = null, preparedResult = null } = {}) {
  return {
    prepareGroupWithProviderRequestsAndQuota: vi.fn(async ({ group, providerRequests }) => {
      calls.push('prepare');
      if (prepareError) throw prepareError;
      return preparedResult ?? {
        deduplicated: false,
        group: { id: 'group_1', ...group },
        providerRequests: providerRequests.map((request) => ({ id: 'request_1', ...request })),
      };
    }),
    updatePreparedProviderRequestOutcome: vi.fn(async ({ providerRequestId, providerState }) => {
      calls.push(`outcome:${providerState}`);
      return {
        group: { id: 'group_1' },
        providerRequest: {
          groupId: 'group_1',
          id: 'request_1',
          providerRequestId,
          providerState,
        },
      };
    }),
  };
}

function createSmsClient({ sendMms = vi.fn(), sendSms = vi.fn() } = {}) {
  return { sendMms, sendSms };
}

function createKakaoClient({ sendAlimtalkMessage = vi.fn() } = {}) {
  return {
    sendAlimtalkMessage,
    sendBrandBasicMessage: vi.fn(),
    sendBrandFreestyleMessage: vi.fn(),
    sendRawAlimtalkMessage: vi.fn(),
    uploadBrandImage: vi.fn(),
  };
}

function smsPayload() {
  return {
    body: 'hello',
    channel: 'sms',
    clientRequestId: CLIENT_REQUEST_ID,
    recipients: [{ recipientNo: '01012345678' }],
    senderResourceId: 'sms_resource_1',
  };
}

function acceptedSmsResponse() {
  return {
    body: { data: { requestId: 'sms-provider-1', sendResultList: [] } },
    header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
  };
}

function acceptedAlimtalkResponse() {
  return {
    header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
    message: { requestId: 'alim-provider-1', sendResults: [] },
  };
}
