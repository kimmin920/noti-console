'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { relayGet, withQuery } from '../messageSend/api.js';
import { messageSendQueryKeys } from '../messageSend/queryKeys.js';
import {
  createAlimtalkTemplate,
  createSmsTemplate,
  uploadAlimtalkTemplateImage,
  uploadSmsTemplateAttachmentFromFile,
} from './api.js';
import { templateQueryKeys } from './queryKeys.js';

const TEMPLATE_CHANNEL_PATHS = Object.freeze({
  SMS: 'sms',
  알림톡: 'alimtalk',
  '브랜드 메시지': 'brand',
});

export const ALIMTALK_TEMPLATE_STATUS_OPTIONS = Object.freeze([
  { label: '승인', value: 'TSC03', tone: 'green' },
  { label: '검수중', value: 'TSC02', tone: 'blue' },
  { label: '반려', value: 'TSC04', tone: 'red' },
  { label: '요청', value: 'TSC01', tone: 'yellow' },
]);

export const DEFAULT_ALIMTALK_TEMPLATE_STATUS = 'TSC03';

export function useTemplateCatalogQuery({
  enabled = true,
  senderResourceId,
  tab,
  templateName,
  templateStatus,
}) {
  const channelPath = TEMPLATE_CHANNEL_PATHS[tab];
  const params = {
    ...(senderResourceId ? { senderResourceId } : {}),
    ...(templateName ? { templateName } : {}),
    ...(channelPath === 'alimtalk' && templateStatus ? { templateStatus } : {}),
  };
  const canQueryCatalog = channelPath === 'alimtalk'
    ? Boolean(channelPath)
    : Boolean(channelPath && senderResourceId);

  return useQuery({
    enabled: enabled && canQueryCatalog,
    queryKey: templateQueryKeys.catalog(channelPath, params),
    queryFn: () => relayGet(withQuery(`/api/templates/${channelPath}`, params)),
  });
}

export function useSmsTemplateAttachmentUploadMutation() {
  return useMutation({
    mutationFn: uploadSmsTemplateAttachmentFromFile,
  });
}

export function useAlimtalkTemplateImageUploadMutation() {
  return useMutation({
    mutationFn: uploadAlimtalkTemplateImage,
  });
}

export function useAlimtalkTemplateCreateMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAlimtalkTemplate,
    onSuccess: async (data, variables, context) => {
      const senderResourceId = variables?.senderResourceId ?? data?.senderResource?.id;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: templateQueryKeys.alimtalkCatalog }),
        senderResourceId
          ? queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.alimtalkTemplates(senderResourceId) })
          : Promise.resolve(),
      ]);
      await options.onSuccess?.(data, variables, context);
    },
  });
}

export function useSmsTemplateCreateMutation(options = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSmsTemplate,
    onSuccess: async (data, variables, context) => {
      const senderResourceId = variables?.senderResourceId ?? data?.senderResource?.id;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: templateQueryKeys.smsCatalog }),
        senderResourceId
          ? queryClient.invalidateQueries({ queryKey: messageSendQueryKeys.smsTemplates(senderResourceId) })
          : Promise.resolve(),
      ]);
      await options.onSuccess?.(data, variables, context);
    },
  });
}
