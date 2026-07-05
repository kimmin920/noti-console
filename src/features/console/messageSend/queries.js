'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { relayGet, withQuery } from './api.js';
import { messageSendQueryKeys } from './queryKeys.js';

const ACTIVE_SMS_BULK_SEND_RUN_REFETCH_INTERVAL_MS = 1000;

export function useSenderResourcesQuery() {
  return useQuery({
    queryKey: messageSendQueryKeys.senderResources,
    queryFn: () => relayGet('/api/sender-resources'),
  });
}

export function useAdminSenderResourceApplicationsQuery(filters = {}, options = {}) {
  return useQuery({
    enabled: options.enabled !== false,
    queryKey: messageSendQueryKeys.adminSenderResourceApplications(filters),
    queryFn: () => relayGet(withQuery('/api/admin/sender-resource-applications', filters)),
    staleTime: 10_000,
  });
}

export function useLimitIncreaseRequestsQuery(options = {}) {
  return useQuery({
    enabled: options.enabled !== false,
    queryKey: messageSendQueryKeys.limitIncreaseRequests,
    queryFn: () => relayGet('/api/limit-increase-requests'),
    staleTime: 10_000,
  });
}

export function useAdminLimitIncreaseRequestsQuery(filters = {}, options = {}) {
  return useQuery({
    enabled: options.enabled !== false,
    queryKey: messageSendQueryKeys.adminLimitIncreaseRequests(filters),
    queryFn: () => relayGet(withQuery('/api/admin/limit-increase-requests', filters)),
    staleTime: 10_000,
  });
}

export function useCurrentActorQuery(options = {}) {
  return useQuery({
    enabled: options.enabled !== false,
    queryKey: messageSendQueryKeys.currentActor,
    queryFn: () => relayGet('/api/me'),
    retry: false,
  });
}

export function useKakaoConnectBootstrapQuery(options = {}) {
  return useQuery({
    enabled: options.enabled !== false,
    queryKey: messageSendQueryKeys.kakaoConnectBootstrap,
    queryFn: () => relayGet('/api/sender-resources/kakao/connect/bootstrap'),
    staleTime: 30_000,
  });
}

export function useSmsTemplatesQuery(senderResourceId) {
  return useQuery({
    enabled: Boolean(senderResourceId),
    queryKey: messageSendQueryKeys.smsTemplates(senderResourceId),
    queryFn: () => relayGet(withQuery('/api/templates/sms', { senderResourceId })),
  });
}

export function useSmsTemplatesQueries(senderResourceIds) {
  return useTemplateQueries('sms', senderResourceIds);
}

export function useAlimtalkTemplatesQuery(senderResourceId) {
  return useQuery({
    enabled: Boolean(senderResourceId),
    queryKey: messageSendQueryKeys.alimtalkTemplates(senderResourceId),
    queryFn: () => relayGet(withQuery('/api/templates/alimtalk', { senderResourceId })),
  });
}

export function useAlimtalkTemplatesQueries(senderResourceIds) {
  return useTemplateQueries('alimtalk', senderResourceIds);
}

export function useBrandTemplatesQuery(senderResourceId) {
  return useQuery({
    enabled: Boolean(senderResourceId),
    queryKey: messageSendQueryKeys.brandTemplates(senderResourceId),
    queryFn: () => relayGet(withQuery('/api/templates/brand', { senderResourceId })),
  });
}

export function useBrandTemplatesQueries(senderResourceIds) {
  return useTemplateQueries('brand', senderResourceIds);
}

export function useMessageStatusQuery(lookup, options = {}) {
  return useQuery({
    enabled: Boolean(lookup?.channel && lookup?.senderResourceId && lookup?.clientRequestId) && options.enabled !== false,
    queryKey: messageSendQueryKeys.status(lookup),
    queryFn: () => relayGet(withQuery('/api/messages/status', lookup)),
    staleTime: 0,
  });
}

export function useActiveSmsBulkSendRunsQuery(options = {}) {
  return useQuery({
    enabled: options.enabled !== false,
    queryKey: messageSendQueryKeys.smsBulkRunsActive,
    queryFn: () => relayGet(withQuery('/api/messages/sms/bulk-send-runs', { active: true })),
    refetchInterval: options.refetchInterval ?? getActiveSmsBulkSendRunsRefetchInterval,
    staleTime: 0,
  });
}

export function useSmsBulkSendRunQuery(runId, options = {}) {
  return useQuery({
    enabled: Boolean(runId) && options.enabled !== false,
    queryKey: messageSendQueryKeys.smsBulkRun(runId),
    queryFn: () => relayGet(`/api/messages/sms/bulk-send-runs/${runId}`),
    refetchInterval: options.refetchInterval ?? 1000,
    staleTime: 0,
  });
}

function getActiveSmsBulkSendRunsRefetchInterval(query) {
  const runs = Array.isArray(query?.state?.data?.runs) ? query.state.data.runs : [];

  return runs.some(isPollingSmsBulkSendRun)
    ? ACTIVE_SMS_BULK_SEND_RUN_REFETCH_INTERVAL_MS
    : false;
}

function isPollingSmsBulkSendRun(run) {
  const status = run?.status ?? run?.state;

  return status === 'queued' || status === 'running';
}

function useTemplateQueries(family, senderResourceIds) {
  const templateSenderResourceIds = (senderResourceIds ?? []).filter(Boolean);

  return useQueries({
    queries: templateSenderResourceIds.map((senderResourceId) => getTemplateQueryOptions(family, senderResourceId)),
  });
}

function getTemplateQueryOptions(family, senderResourceId) {
  if (family === 'sms') {
    return {
      enabled: Boolean(senderResourceId),
      queryKey: messageSendQueryKeys.smsTemplates(senderResourceId),
      queryFn: () => relayGet(withQuery('/api/templates/sms', { senderResourceId })),
    };
  }

  if (family === 'brand') {
    return {
      enabled: Boolean(senderResourceId),
      queryKey: messageSendQueryKeys.brandTemplates(senderResourceId),
      queryFn: () => relayGet(withQuery('/api/templates/brand', { senderResourceId })),
    };
  }

  return {
    enabled: Boolean(senderResourceId),
    queryKey: messageSendQueryKeys.alimtalkTemplates(senderResourceId),
    queryFn: () => relayGet(withQuery('/api/templates/alimtalk', { senderResourceId })),
  };
}
