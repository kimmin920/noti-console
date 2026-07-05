import { describe, expect, it } from 'vitest';

import { createLimitIncreaseRequestService } from '../limitIncreaseRequests/service.js';

const FIXED_NOW = new Date('2026-06-28T00:00:00.000Z');

describe('limit increase request service', () => {
  it('creates SMS monthly limit requests', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });

    const result = await service.createRequest({
      actorUserId: 'user_1',
      payload: {
        channel: 'sms',
        currentLimit: 50_000,
        requestedLimit: 80_000,
        reason: '월 캠페인 물량 증가',
      },
    });

    expect(result.request).toMatchObject({
      channel: 'sms',
      limitScope: 'monthly',
      currentLimit: 50_000,
      requestedLimit: 80_000,
      senderResourceId: null,
      status: 'submitted',
    });
    expect(repository.auditLogs).toContainEqual(expect.objectContaining({
      action: 'limit_increase_request.submitted',
      actorUserId: 'user_1',
    }));
  });

  it('creates Kakao channel daily limit requests', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });

    const result = await service.createRequest({
      actorUserId: 'user_1',
      payload: {
        channel: 'alimtalk',
        requestedLimit: 3000,
        reason: '주문 알림톡 피크 대응',
        senderResourceId: 'kakao_resource_1',
      },
    });

    expect(result.request).toMatchObject({
      channel: 'alimtalk',
      limitScope: 'daily_channel',
      currentLimit: 1000,
      requestedLimit: 3000,
      senderResourceId: 'kakao_resource_1',
      senderResource: {
        displayName: '스토어 채널',
        value: 'sender_key_1',
      },
      status: 'submitted',
    });
  });

  it('lists requests for operators with requester identity', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });

    await service.createRequest({
      actorUserId: 'user_1',
      payload: { channel: 'sms', currentLimit: 1000, requestedLimit: 5000, reason: '테스트 발송량 증가' },
    });

    const result = await service.listAdminRequests({
      actorUserId: 'operator_1',
      query: { status: 'submitted' },
    });

    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]).toMatchObject({
      channel: 'sms',
      user: {
        email: 'user@example.com',
        userRef: 'usr_1',
      },
    });
    await expect(service.listAdminRequests({ actorUserId: 'user_1' })).rejects.toThrow('Operator access is required.');
  });

  it('requires a rejection reason and exposes it to the user', async () => {
    const repository = createMemoryRepository();
    const service = createTestService({ repository });
    const created = await service.createRequest({
      actorUserId: 'user_1',
      payload: { channel: 'brand-message', reason: '브랜드 캠페인', requestedLimit: 4000, senderResourceId: 'kakao_resource_1' },
    });

    await expect(
      service.rejectRequest({
        actorUserId: 'operator_1',
        requestId: created.request.id,
        payload: {},
      })
    ).rejects.toThrow('rejectReason is required.');

    await service.rejectRequest({
      actorUserId: 'operator_1',
      requestId: created.request.id,
      payload: { rejectReason: '카카오 채널 사용량 근거가 부족합니다.' },
    });
    const userRequests = await service.listUserRequests({ actorUserId: 'user_1' });

    expect(userRequests.requests[0]).toMatchObject({
      status: 'rejected',
      rejectReason: '카카오 채널 사용량 근거가 부족합니다.',
      reviewedBy: 'operator_1',
      reviewedAt: FIXED_NOW,
    });
  });
});

function createTestService({ repository }) {
  return createLimitIncreaseRequestService({
    now: () => FIXED_NOW,
    repository,
  });
}

function createMemoryRepository() {
  return {
    auditLogs: [],
    requests: [],
    users: [
      addTimestamps({ id: 'user_1', userRef: 'usr_1', email: 'user@example.com', name: 'User', status: 'active', isOperator: false }),
      addTimestamps({ id: 'operator_1', userRef: 'opr_1', email: 'operator@example.com', name: 'Operator', status: 'active', isOperator: true }),
    ],
    resources: [
      addTimestamps({
        id: 'kakao_resource_1',
        resourceRef: 'sr_kakao_1',
        provider: 'nhn',
        type: 'kakao_sender_key',
        value: 'sender_key_1',
        displayName: '스토어 채널',
        status: 'active',
        providerStatus: 'active',
        metadataJson: null,
      }),
    ],
    links: [
      addTimestamps({
        id: 'link_kakao_1',
        userId: 'user_1',
        senderResourceId: 'kakao_resource_1',
        billingAccountId: 'billing_1',
        role: 'owner',
        status: 'active',
        isDefault: true,
      }),
    ],
    async getUserById(userId) {
      return this.users.find((user) => user.id === userId) ?? null;
    },
    async getUserSenderResource({ userId, senderResourceId }) {
      const link = this.links.find((item) => item.userId === userId && item.senderResourceId === senderResourceId);
      return link ? { link, resource: this.resources.find((resource) => resource.id === senderResourceId) } : null;
    },
    async listUserRequests(userId) {
      return this.requests
        .filter((request) => request.userId === userId)
        .map((request) => ({ request, senderResource: this.resources.find((resource) => resource.id === request.senderResourceId) ?? null }));
    },
    async findSubmittedUserRequest({ channel, senderResourceId, userId }) {
      return this.requests.find((request) => (
        request.userId === userId
        && request.channel === channel
        && request.status === 'submitted'
        && request.senderResourceId === senderResourceId
      )) ?? null;
    },
    async createRequest(values) {
      const request = addTimestamps({ id: `limit_request_${this.requests.length + 1}`, ...values });
      this.requests.unshift(request);
      return request;
    },
    async listRequests({ status } = {}) {
      return this.requests
        .filter((request) => !status || request.status === status)
        .map((request) => ({
          request,
          senderResource: this.resources.find((resource) => resource.id === request.senderResourceId) ?? null,
          user: this.users.find((user) => user.id === request.userId),
        }));
    },
    async getRequestWithUserAndResource(requestId) {
      const request = this.requests.find((item) => item.id === requestId);
      return request
        ? {
          request,
          senderResource: this.resources.find((resource) => resource.id === request.senderResourceId) ?? null,
          user: this.users.find((user) => user.id === request.userId),
        }
        : null;
    },
    async updateRequest(requestId, values) {
      const request = this.requests.find((item) => item.id === requestId);
      Object.assign(request, values, { updatedAt: FIXED_NOW });
      return request;
    },
    async createAuditLog(values) {
      const auditLog = { id: `audit_${this.auditLogs.length + 1}`, ...values };
      this.auditLogs.push(auditLog);
      return auditLog;
    },
  };
}

function addTimestamps(values) {
  return {
    ...values,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  };
}
