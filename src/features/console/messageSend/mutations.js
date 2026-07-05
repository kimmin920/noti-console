'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { relayGet, relayPost, relayPostForm } from './api.js';
import { messageSendQueryKeys } from './queryKeys.js';
import { templateQueryKeys } from '../templates/queryKeys.js';

export function useSmsSendMutation() {
  return useMutation({
    mutationFn: (payload) => relayPost('/api/messages/sms/send', payload),
  });
}

export function useSmsBulkSendRunMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => relayPost('/api/messages/sms/bulk-send-runs', payload),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.smsBulkRunsActive });
      queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.smsBulkRun(run?.id) });
    },
  });
}

export function useAlimtalkSendMutation() {
  return useMutation({
    mutationFn: (payload) => relayPost('/api/messages/alimtalk/send', payload),
  });
}

export function useBrandMessageSendMutation() {
  return useMutation({
    mutationFn: (payload) => relayPost('/api/messages/brand/send', payload),
  });
}

export function useBrandTemplateCreateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => relayPost('/api/templates/brand', payload),
    onSuccess: (_template, payload) => {
      const senderResourceId = payload?.senderResourceId;
      const invalidateQueries = [
        queryClient.invalidateQueries({ queryKey: templateQueryKeys.brandCatalog }),
      ];

      if (senderResourceId) {
        invalidateQueries.push(queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.brandTemplates(senderResourceId) }));
      }

      return Promise.all(invalidateQueries);
    },
  });
}

export function useBrandImageUploadMutation() {
  return useMutation({
    mutationFn: (formData) => relayPostForm('/api/messages/brand/images', formData),
  });
}

export function useSmsSenderApplicationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData) => relayPostForm('/api/sender-resources/sms/applications', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.senderResources });
    },
  });
}

export function useKakaoConnectRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => relayPost('/api/sender-resources/kakao/connect/request', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.kakaoConnectBootstrap });
    },
  });
}

export function useKakaoConnectVerifyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => relayPost('/api/sender-resources/kakao/connect/verify', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.kakaoConnectBootstrap });
      queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.senderResources });
    },
  });
}

export function useLimitIncreaseRequestCreateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => relayPost('/api/limit-increase-requests', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.limitIncreaseRequests });
      queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.adminLimitIncreaseRequestsRoot });
    },
  });
}

export function useAdminLimitIncreaseRequestApproveMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, payload = {} }) => relayPost(
      `/api/admin/limit-increase-requests/${requestId}/approve`,
      payload
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.limitIncreaseRequests });
      queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.adminLimitIncreaseRequestsRoot });
    },
  });
}

export function useAdminLimitIncreaseRequestRejectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, payload }) => relayPost(
      `/api/admin/limit-increase-requests/${requestId}/reject`,
      payload
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.limitIncreaseRequests });
      queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.adminLimitIncreaseRequestsRoot });
    },
  });
}

export function useAdminSmsSendNoLookupMutation() {
  return useMutation({
    mutationFn: (applicationId) => relayGet(`/api/admin/sender-resource-applications/${applicationId}/nhn-send-no`),
  });
}

export function useAdminSenderResourceApplicationApproveMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ applicationId, payload = {} }) => relayPost(
      `/api/admin/sender-resource-applications/${applicationId}/approve`,
      payload
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.adminSenderResourceApplicationsRoot });
      queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.senderResources });
    },
  });
}

export function useAdminSenderResourceApplicationRejectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ applicationId, payload }) => relayPost(
      `/api/admin/sender-resource-applications/${applicationId}/reject`,
      payload
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.adminSenderResourceApplicationsRoot });
      queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.senderResources });
    },
  });
}
