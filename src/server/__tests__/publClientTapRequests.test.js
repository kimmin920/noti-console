import { describe, expect, it, vi } from 'vitest';

import {
  PublTapCapabilityError,
  PUBL_MEMBER_CONTACT_RESOURCES,
  PUBL_SELLER_BUSINESS_INFORMATION_RESOURCES,
  requestPublMemberContacts,
  requestPublSellerBusinessInformation,
} from '../../features/publClient/tapRequests.js';
import {
  getPublMemberContacts,
  toPublRecipientOptions,
} from '../../features/publClient/recipientOptions.js';
import { loadPublMemberContacts, publClientQueryKeys } from '../../features/publClient/queries.js';

describe('Publ common/catalog tap request helpers', () => {
  it('requests seller business information through the configured permission', async () => {
    const adapter = createAdapter();
    const clientConfig = createClientConfig({
      sellerBusinessInformation: 'PM_SELLER_INFO',
    });

    await requestPublSellerBusinessInformation({ adapter, clientConfig });

    expect(adapter.request).toHaveBeenCalledWith('PM_SELLER_INFO', {
      resources: PUBL_SELLER_BUSINESS_INFORMATION_RESOURCES,
    });
  });

  it('requests member contacts with the catalog pagination payload', async () => {
    const adapter = createAdapter();
    const clientConfig = createClientConfig({
      memberContacts: 'PM_CONTACTS',
    });

    await requestPublMemberContacts({
      adapter,
      clientConfig,
      limit: 2,
      page: 3,
    });

    expect(adapter.request).toHaveBeenCalledWith('PM_CONTACTS', {
      filters: {},
      limit: 2,
      order: 'DESC',
      page: 3,
      resources: PUBL_MEMBER_CONTACT_RESOURCES,
      sortBy: 'registeredAt',
    });
  });

  it('fails clearly when a tap permission is not configured', async () => {
    await expect(requestPublSellerBusinessInformation({
      adapter: createAdapter(),
      clientConfig: createClientConfig({ sellerBusinessInformation: null }),
    })).rejects.toThrow('Publ seller business information permission is not configured.');
  });

  it('rejects non-OK Publ tap responses instead of treating them as empty data', async () => {
    const adapter = {
      request: vi.fn(async () => ({ status: 'FORBIDDEN', data: { msg: 'denied' } })),
    };

    await expect(requestPublMemberContacts({
      adapter,
      clientConfig: createClientConfig({ memberContacts: 'PM_CONTACTS' }),
    })).rejects.toMatchObject({
      code: 'permission-denied',
      safeMessage: 'Publ 수신자 조회 권한이 없습니다',
    });
  });

  it('skips member contact tap requests when contact permission is not configured', async () => {
    const adapter = createAdapter();

    await expect(requestPublMemberContacts({
      adapter,
      clientConfig: createClientConfig({ memberContacts: null }),
    })).rejects.toBeInstanceOf(PublTapCapabilityError);
    expect(adapter.request).not.toHaveBeenCalled();
  });

  it('authorizes the contact capability only once per runtime identity', async () => {
    const adapter = {
      authorize: vi.fn(async () => ({ status: 'OK' })),
      request: vi.fn(async () => ({ data: { memberContacts: [] }, status: 'OK' })),
    };
    const clientConfig = createClientConfig({ memberContacts: 'PM_CONTACTS' });
    const identity = { identityKey: 'consumer:session:user' };

    await requestPublMemberContacts({ adapter, clientConfig, identity });
    await requestPublMemberContacts({ adapter, clientConfig, identity });

    expect(adapter.authorize).toHaveBeenCalledTimes(1);
    expect(adapter.authorize).toHaveBeenCalledWith(['PM_CONTACTS']);
    expect(adapter.request).toHaveBeenCalledTimes(2);
  });

  it.each([
    false,
    { authorized: false },
    { payload: { authorized: false } },
    undefined,
  ])('fails closed when contact authorization is not explicitly granted: %j', async (authorizationResult) => {
    const adapter = {
      authorize: vi.fn(async () => authorizationResult),
      request: vi.fn(),
    };

    await expect(requestPublMemberContacts({
      adapter,
      clientConfig: createClientConfig({ memberContacts: 'PM_CONTACTS' }),
      identity: { identityKey: `denied:${JSON.stringify(authorizationResult)}` },
    })).rejects.toBeInstanceOf(PublTapCapabilityError);
    expect(adapter.request).not.toHaveBeenCalled();
  });

  it('repeats contact capability authorization for a fresh runtime identity', async () => {
    const adapter = {
      authorize: vi.fn(async () => ({ status: 'OK' })),
      request: vi.fn(async () => ({ data: { memberContacts: [] }, status: 'OK' })),
    };
    const clientConfig = createClientConfig({ memberContacts: 'PM_CONTACTS' });

    await requestPublMemberContacts({ adapter, clientConfig, identity: { identityKey: 'first' } });
    await requestPublMemberContacts({ adapter, clientConfig, identity: { identityKey: 'second' } });

    expect(adapter.authorize).toHaveBeenCalledTimes(2);
  });

  it('maps Publ member contacts with phone numbers into sendable recipient options', () => {
    const response = {
      payload: {
        data: {
          memberContacts: [
            {
              distinctId: 'member-1',
              nickname: '홍길동',
              profileAddInfoContactMobileNumber: '010-1234-5678',
            },
            {
              distinctId: 'member-2',
              nickname: '번호 없음',
              profileAddInfoContactMobileNumber: null,
            },
          ],
        },
      },
    };

    expect(getPublMemberContacts(response)).toHaveLength(2);
    expect(toPublRecipientOptions(response)).toEqual([{
      detail: '01012345678',
      externalId: 'member-1',
      label: '홍길동',
      recipientSource: 'publ',
      type: 'publ-contact',
      value: '01012345678',
    }]);
  });

  it('loads all Publ member contact pages reported by the SDK pagination', async () => {
    const adapter = {
      request: vi.fn(async (_permissionId, payload) => ({
        data: {
          memberContacts: [{
            distinctId: `member-${payload.page}`,
            profileAddInfoContactMobileNumber: `0100000000${payload.page}`,
          }],
          pagination: { limit: 1, page: payload.page, total: 2 },
        },
        status: 'OK',
      })),
    };

    await expect(loadPublMemberContacts({
      adapter,
      clientConfig: createClientConfig({ memberContacts: 'PM_CONTACTS' }),
      limit: 1,
    })).resolves.toMatchObject({
      data: {
        memberContacts: [
          { distinctId: 'member-1' },
          { distinctId: 'member-2' },
        ],
        pagination: { loaded: 2, total: 2 },
      },
    });
    expect(adapter.request).toHaveBeenCalledTimes(2);
  });

  it('scopes member contact query keys by active Publ identity', () => {
    expect(publClientQueryKeys.memberContacts({
      consumerId: 'merchant_a',
      sessionId: 'session_a',
      userId: 'user_a',
    })).toEqual([
      'publ-client',
      'member-contacts',
      'merchant_a',
      'session_a',
      'user_a',
    ]);
    expect(publClientQueryKeys.memberContacts({
      consumerId: 'merchant_b',
      sessionId: 'session_b',
      userId: 'user_b',
    })).not.toEqual(publClientQueryKeys.memberContacts({
      consumerId: 'merchant_a',
      sessionId: 'session_a',
      userId: 'user_a',
    }));
  });
});

function createAdapter() {
  return {
    request: vi.fn(async () => ({ data: { ok: true } })),
  };
}

function createClientConfig(permissions) {
  return {
    permissions: {
      exchangeToken: 'PM_00000_EXCHANGE_TOKEN',
      memberContacts: null,
      refreshToken: 'PM_00000_REFRESH_TOKEN',
      sellerBusinessInformation: null,
      ...permissions,
    },
  };
}
