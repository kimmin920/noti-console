'use client';

import { useMemo } from 'react';
import { usePublClient } from './PublClientContext.jsx';
import { usePublMemberContactsQuery } from './queries.js';
import { toPublRecipientOptions } from './recipientOptions.js';

const PUBL_RECIPIENT_GROUP_LABELS = Object.freeze({
  'publ-contact': 'Publ 수신자',
  'publ-segment': 'Publ 세그먼트',
});

const PUBL_RECIPIENT_GROUP_ORDER = Object.freeze([
  'direct',
  'publ-contact',
  'publ-segment',
]);

export function usePublMessageRecipients() {
  const publClient = usePublClient();
  const contactsPermissionConfigured = Boolean(publClient.clientConfig?.permissions?.memberContacts);
  const contactsQuery = usePublMemberContactsQuery({
    adapter: publClient.adapter,
    clientConfig: publClient.clientConfig,
    enabled: publClient.isPublEmbed,
  });
  const contacts = useMemo(
    () => toPublRecipientOptions(contactsQuery.data),
    [contactsQuery.data]
  );
  const sourceTabs = useMemo(() => [
    {
      allowManual: true,
      emptyDescription: getPublContactsEmptyDescription({
        configured: contactsPermissionConfigured,
        isError: contactsQuery.isError,
        isPending: contactsQuery.isPending,
      }),
      emptyTitle: getPublContactsEmptyTitle({
        configured: contactsPermissionConfigured,
        isError: contactsQuery.isError,
        isPending: contactsQuery.isPending,
      }),
      id: 'publ-contacts',
      label: 'Publ 수신자',
      types: ['publ-contact'],
    },
    {
      allowManual: false,
      emptyDescription: 'Publ 세그먼트 SDK 권한이 추가되면 이 탭에서 바로 조회할 수 있습니다.',
      emptyTitle: 'Publ 세그먼트 연동 준비 중',
      id: 'publ-segments',
      label: 'Publ 세그먼트',
      types: ['publ-segment'],
    },
  ], [contactsPermissionConfigured, contactsQuery.isError, contactsQuery.isPending]);

  if (!publClient.isPublEmbed) {
    return {
      contacts: [],
      contactsState: { isError: false, isPending: false },
      isPublEmbed: false,
      options: [],
      selectProps: {},
    };
  }

  return {
    contacts,
    contactsState: {
      isError: contactsQuery.isError,
      isPending: contactsQuery.isPending,
    },
    isPublEmbed: true,
    options: [],
    selectProps: {
      contactSearchMinLength: 0,
      emptyActionLabel: undefined,
      groupLabels: PUBL_RECIPIENT_GROUP_LABELS,
      groupOrder: PUBL_RECIPIENT_GROUP_ORDER,
      placeholder: 'Publ 수신자 추가...',
      searchPromptEmpty: '',
      searchPromptShort: '',
      sourceTabs,
    },
  };
}

function getPublContactsEmptyTitle({ configured, isError, isPending }) {
  if (!configured) return 'Publ 수신자 권한이 필요합니다';
  if (isPending) return 'Publ 수신자를 불러오는 중입니다';
  if (isError) return 'Publ 수신자를 불러오지 못했습니다';
  return '발송 가능한 Publ 수신자가 없습니다';
}

function getPublContactsEmptyDescription({ configured, isError, isPending }) {
  if (!configured) return '현재 환경의 Publ 연락처 permission ID를 확인해 주세요.';
  if (isPending) return '잠시 후 목록이 표시됩니다.';
  if (isError) return 'Publ 연결 상태를 확인한 뒤 다시 열어 주세요.';
  return '전화번호가 등록된 Publ 수신자만 표시됩니다. 번호를 직접 입력할 수도 있습니다.';
}
