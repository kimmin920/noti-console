'use client';

import {
  getIdentity,
  getPublClientCapabilityState,
  setPublClientCapabilityState,
} from './runtimeSession.js';
import { isPublAuthorizationGranted } from './sdkAdapter.js';

export class PublTapCapabilityError extends Error {
  constructor(message = 'Publ 수신자 조회 권한이 없습니다') {
    super(message);
    this.name = 'PublTapCapabilityError';
    this.code = 'permission-denied';
    this.safeMessage = 'Publ 수신자 조회 권한이 없습니다';
  }
}

export const PUBL_SELLER_BUSINESS_INFORMATION_RESOURCES = Object.freeze([
  'businessLicenseType',
]);

export const PUBL_MEMBER_CONTACT_RESOURCES = Object.freeze([
  'distinctId',
  'nickname',
  'imageSrc',
  'countryCodeAlpha2',
  'registeredAt',
  'marketingPolicyAgreementStatus',
  'marketingPolicySignedAt',
  'supplementaryEmail',
  'profileAddInfoContactEmail',
  'profileAddInfoContactMobileNumber',
  'profileAddInfoContactPhoneNumber',
  'profileAddInfoShippingMobileNumber',
  'profileAddInfoWorkplaceEmail',
  'profileAddInfoWorkplacePhoneNumber',
  'profileAddInfoBizEmail',
  'profileAddInfoBizContactMobileNumber',
  'profileAddInfoBizContactEmail',
]);

export async function requestPublSellerBusinessInformation({
  adapter,
  clientConfig,
  resources = PUBL_SELLER_BUSINESS_INFORMATION_RESOURCES,
}) {
  const permissionId = clientConfig?.permissions?.sellerBusinessInformation;
  if (!permissionId) {
    throw new Error('Publ seller business information permission is not configured.');
  }

  return requestPublTap(adapter, permissionId, {
    resources,
  });
}

export async function requestPublMemberContacts({
  adapter,
  clientConfig,
  filters = {},
  identity = getIdentity(),
  limit = 20,
  order = 'DESC',
  page = 1,
  resources = PUBL_MEMBER_CONTACT_RESOURCES,
  sortBy = 'registeredAt',
}) {
  const permissionId = clientConfig?.permissions?.memberContacts;
  if (!permissionId) {
    throw new PublTapCapabilityError();
  }

  await authorizePublMemberContactsCapability({ adapter, identity, permissionId });

  return requestPublTap(adapter, permissionId, {
    filters,
    limit,
    order,
    page,
    resources,
    sortBy,
  });
}

async function requestPublTap(adapter, permissionId, payload) {
  if (!adapter || typeof adapter.request !== 'function') {
    throw new Error('Publ SDK adapter does not support tap requests.');
  }

  const response = await adapter.request(permissionId, payload);
  const status = response?.status ?? response?.payload?.status;

  if (status && status !== 'OK') {
    throw new PublTapCapabilityError();
  }

  return response;
}

async function authorizePublMemberContactsCapability({ adapter, identity, permissionId }) {
  const cached = getPublClientCapabilityState({ identity, permissionId });
  if (cached === 'granted') return;
  if (cached === 'denied') throw new PublTapCapabilityError();

  if (!adapter || typeof adapter.authorize !== 'function') {
    return;
  }

  try {
    const response = await adapter.authorize([permissionId]);
    if (!isPublAuthorizationGranted(response)) {
      setPublClientCapabilityState({ identity, permissionId, state: 'denied' });
      throw new PublTapCapabilityError();
    }
    setPublClientCapabilityState({ identity, permissionId, state: 'granted' });
  } catch (error) {
    setPublClientCapabilityState({ identity, permissionId, state: 'denied' });
    if (error instanceof PublTapCapabilityError) throw error;
    throw new PublTapCapabilityError();
  }
}
