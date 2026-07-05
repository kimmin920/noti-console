'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getMessageReservationBatchRecipients,
  getMessageReservationGroupDetail,
  listMessageReservationGroups,
} from './api.js';
import { messageReservationQueryKeys } from './queryKeys.js';

export function useMessageReservationGroupsQuery(filters, options = {}) {
  return useQuery({
    enabled: Boolean(filters?.channel && filters?.from && filters?.to) && options.enabled !== false,
    queryFn: () => listMessageReservationGroups(filters),
    queryKey: messageReservationQueryKeys.groupList(filters),
    staleTime: 0,
  });
}

export function useMessageReservationGroupDetailQuery(selection, options = {}) {
  return useQuery({
    enabled: hasMessageReservationGroupIdentity(selection) && options.enabled !== false,
    queryFn: () => getMessageReservationGroupDetail(selection),
    queryKey: messageReservationQueryKeys.groupDetail(selection),
    staleTime: 0,
  });
}

export function useMessageReservationBatchRecipientsQuery(selection, options = {}) {
  return useQuery({
    enabled: hasMessageReservationBatchSelection(selection) && options.enabled !== false,
    queryFn: () => getMessageReservationBatchRecipients(selection),
    queryKey: messageReservationQueryKeys.batchRecipients(selection),
    staleTime: 0,
  });
}

function hasMessageReservationGroupIdentity(selection) {
  return Boolean(selection?.channel && selection?.from && selection?.groupId && selection?.to);
}

function hasMessageReservationBatchSelection(selection) {
  return Boolean(
    selection?.channel
    && selection?.from
    && selection?.groupId
    && selection?.providerRequestId
    && selection?.to
  );
}
