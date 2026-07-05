'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getMessageLogDetail,
  getMessageLogGroupDetail,
  getMessageLogGroupRequestRecipientDetail,
  listMessageLogGroupRequestFailures,
  listMessageLogGroupRequestRecipients,
  listMessageLogGroups,
  listMessageLogs,
} from './api.js';
import { messageLogQueryKeys } from './queryKeys.js';

export function useMessageLogsQuery(filters, options = {}) {
  return useQuery({
    enabled: Boolean(filters?.channel && filters?.from && filters?.to) && options.enabled !== false,
    queryKey: messageLogQueryKeys.list(filters),
    queryFn: () => listMessageLogs(filters),
    staleTime: 0,
  });
}

export function useMessageLogGroupsQuery(filters, options = {}) {
  return useQuery({
    enabled: Boolean(filters?.channel && filters?.from && filters?.to) && options.enabled !== false,
    queryKey: messageLogQueryKeys.groupList(filters),
    queryFn: () => listMessageLogGroups(filters),
    staleTime: 0,
  });
}

export function useMessageLogGroupDetailQuery(selection, options = {}) {
  return useQuery({
    enabled: hasMessageLogGroupIdentity(selection) && options.enabled !== false,
    queryKey: messageLogQueryKeys.groupDetail(selection),
    queryFn: () => getMessageLogGroupDetail(selection),
    staleTime: 0,
  });
}

export function useMessageLogGroupRequestRecipientsQuery(selection, options = {}) {
  return useQuery({
    enabled: hasMessageLogGroupRequestIdentity(selection) && options.enabled !== false,
    queryKey: messageLogQueryKeys.groupRequestRecipients(selection),
    queryFn: () => listMessageLogGroupRequestRecipients(selection),
    staleTime: 0,
  });
}

export function useMessageLogGroupRequestFailuresQuery(selection, options = {}) {
  return useQuery({
    enabled: hasMessageLogGroupRequestIdentity(selection) && options.enabled !== false,
    queryKey: messageLogQueryKeys.groupRequestFailures(selection),
    queryFn: () => listMessageLogGroupRequestFailures(selection),
    staleTime: 0,
  });
}

export function useMessageLogGroupRequestRecipientDetailQuery(selection, options = {}) {
  return useQuery({
    enabled: hasMessageLogGroupRequestRecipientIdentity(selection) && options.enabled !== false,
    queryKey: messageLogQueryKeys.groupRequestRecipientDetail(selection),
    queryFn: () => getMessageLogGroupRequestRecipientDetail(selection),
    staleTime: 0,
  });
}

export function useMessageLogDetailQuery(selection, options = {}) {
  return useQuery({
    enabled: hasMessageLogIdentity(selection) && options.enabled !== false,
    queryKey: messageLogQueryKeys.detail(selection),
    queryFn: () => getMessageLogDetail(selection),
    staleTime: 0,
  });
}

function hasMessageLogIdentity(selection) {
  return Boolean(
    selection?.channel
      && selection?.requestId
      && selection.recipientSeq !== undefined
      && selection.recipientSeq !== null
      && selection.recipientSeq !== ''
  );
}

function hasMessageLogGroupIdentity(selection) {
  return Boolean(selection?.groupId && selection?.channel && selection?.from && selection?.to);
}

function hasMessageLogGroupRequestIdentity(selection) {
  return Boolean(selection?.groupId && selection?.requestLocalId);
}

function hasMessageLogGroupRequestRecipientIdentity(selection) {
  return Boolean(
    selection?.groupId
      && selection?.requestLocalId
      && selection.recipientSeq !== undefined
      && selection.recipientSeq !== null
      && selection.recipientSeq !== ''
  );
}
