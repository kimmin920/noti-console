import { describe, expect, it, vi } from 'vitest';

import {
  PUBL_MEMBER_CONTACT_RESOURCES,
  PUBL_SELLER_BUSINESS_INFORMATION_RESOURCES,
  requestPublMemberContacts,
  requestPublSellerBusinessInformation,
} from '../../features/publClient/tapRequests.js';

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
