'use client';

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
  limit = 20,
  order = 'DESC',
  page = 1,
  resources = PUBL_MEMBER_CONTACT_RESOURCES,
  sortBy = 'registeredAt',
}) {
  const permissionId = clientConfig?.permissions?.memberContacts;
  if (!permissionId) {
    throw new Error('Publ member contacts permission is not configured.');
  }

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

  return adapter.request(permissionId, payload);
}
