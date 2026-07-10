'use client';

import { useQuery } from '@tanstack/react-query';
import { requestPublMemberContacts } from './tapRequests.js';
import { getPublMemberContacts } from './recipientOptions.js';

const PUBL_MEMBER_CONTACTS_PAGE_SIZE = 50;
const PUBL_MEMBER_CONTACTS_MAX_PAGES = 200;

export const publClientQueryKeys = Object.freeze({
  memberContacts: ['publ-client', 'member-contacts'],
});

export function usePublMemberContactsQuery({ adapter, clientConfig, enabled = true } = {}) {
  const permissionId = clientConfig?.permissions?.memberContacts;

  return useQuery({
    enabled: enabled !== false && Boolean(adapter && permissionId),
    queryKey: publClientQueryKeys.memberContacts,
    queryFn: () => loadPublMemberContacts({
      adapter,
      clientConfig,
    }),
    staleTime: 30_000,
  });
}

export async function loadPublMemberContacts({
  adapter,
  clientConfig,
  limit = PUBL_MEMBER_CONTACTS_PAGE_SIZE,
  maxPages = PUBL_MEMBER_CONTACTS_MAX_PAGES,
} = {}) {
  const contacts = [];
  let page = 1;
  let pagination = null;

  while (page <= maxPages) {
    const response = await requestPublMemberContacts({
      adapter,
      clientConfig,
      limit,
      page,
    });
    const pageContacts = getPublMemberContacts(response);
    pagination = getPublPagination(response);
    contacts.push(...pageContacts);

    const total = Number(pagination?.total);
    if (!Number.isFinite(total) || contacts.length >= total || pageContacts.length === 0) {
      break;
    }

    page += 1;
  }

  return {
    data: {
      memberContacts: contacts,
      pagination: pagination ? { ...pagination, loaded: contacts.length } : null,
    },
    status: 'OK',
  };
}

function getPublPagination(response) {
  const data = response?.data && typeof response.data === 'object'
    ? response.data
    : response?.payload?.data && typeof response.payload.data === 'object'
      ? response.payload.data
      : response;

  return data?.pagination && typeof data.pagination === 'object' ? data.pagination : null;
}
