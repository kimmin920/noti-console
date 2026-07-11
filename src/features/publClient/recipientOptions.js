const PUBL_CONTACT_PHONE_FIELDS = Object.freeze([
  'profileAddInfoContactMobileNumber',
  'profileAddInfoShippingMobileNumber',
  'profileAddInfoBizContactMobileNumber',
  'profileAddInfoContactPhoneNumber',
  'profileAddInfoWorkplacePhoneNumber',
  'profileAddInfo_contactMobileNumber',
  'profileAddInfo_shippingMobileNumber',
  'profileAddInfo_bizContactMobileNumber',
  'profileAddInfo_contactPhoneNumber',
  'profileAddInfo_workplacePhoneNumber',
  'contactMobileNumber',
  'mobileNumber',
  'phoneNumber',
]);

export function getPublMemberContacts(response) {
  const data = getResponseData(response);
  const contacts = data?.memberContacts
    ?? data?.member_contacts
    ?? data?.tap?.queryResult
    ?? data?.queryResult;

  return Array.isArray(contacts) ? contacts : [];
}

export function toPublRecipientOptions(response) {
  const optionsByPhone = new Map();

  getPublMemberContacts(response).forEach((contact) => {
    const phone = getPublContactPhone(contact);
    if (!phone || optionsByPhone.has(phone)) return;

    const externalId = normalizeString(contact?.distinctId ?? contact?.id);
    const label = normalizeString(contact?.nickname) ?? externalId ?? phone;

    optionsByPhone.set(phone, {
      detail: label === phone ? '' : phone,
      externalId,
      label,
      recipientSource: 'publ',
      type: 'publ-contact',
      value: phone,
    });
  });

  return Array.from(optionsByPhone.values());
}

export function getPublContactPhone(contact) {
  if (!contact || typeof contact !== 'object') return null;

  for (const field of PUBL_CONTACT_PHONE_FIELDS) {
    const phone = normalizePhone(contact[field]);
    if (phone) return phone;
  }

  return null;
}

function getResponseData(response) {
  if (response?.data && typeof response.data === 'object') {
    return response.data;
  }

  if (response?.payload?.data && typeof response.payload.data === 'object') {
    return response.payload.data;
  }

  return response;
}

function normalizePhone(value) {
  const normalized = normalizeString(value);
  if (!normalized || !/^\+?[0-9\s-]{7,24}$/.test(normalized)) return null;
  return normalized.replace(/[\s-]/g, '');
}

function normalizeString(value) {
  const normalized = value === undefined || value === null ? '' : String(value).trim();
  return normalized || null;
}
