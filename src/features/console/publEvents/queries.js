'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { relayDelete, relayGet, relayPatch, relayPost } from '../messageSend/api.js';
import { toPublEventEditorFormError } from './publEventEditorModel.js';

export const publEventQueryKeys = {
  catalog: ['publ-events', 'catalog'],
  detail: (eventKey) => ['publ-events', 'detail', eventKey],
};

export function usePublEventsQuery(options = {}) {
  return useQuery({
    enabled: options.enabled !== false,
    queryKey: publEventQueryKeys.catalog,
    queryFn: () => relayGet('/api/publ-events'),
    staleTime: 60_000,
  });
}

export function usePublEventDetailQuery(eventKey, options = {}) {
  const normalizedEventKey = String(eventKey ?? '');
  const { enabled = true, ...queryOptions } = options;

  return useQuery({
    ...queryOptions,
    enabled: enabled !== false && normalizedEventKey.length > 0,
    queryKey: publEventQueryKeys.detail(normalizedEventKey),
    queryFn: () => {
      const eventKey = normalizedEventKey;
      const encodedEventKey = encodeURIComponent(eventKey);
      return relayGet(`/api/publ-events/${encodedEventKey}`);
    },
    staleTime: queryOptions.staleTime ?? 60_000,
  });
}

export function patchPublEventEditorDraft({ eventKey, payload }) {
  const normalizedEventKey = String(eventKey ?? '');
  const encodedEventKey = encodeURIComponent(normalizedEventKey);

  return relayPatch(`/api/publ-events/${encodedEventKey}`, payload);
}

export function deletePublEventDefinition({ eventKey, payload }) {
  const normalizedEventKey = String(eventKey ?? '');
  const encodedEventKey = encodeURIComponent(normalizedEventKey);

  return relayDelete(`/api/publ-events/${encodedEventKey}`, payload);
}

export function postPublEventDefinition(payload) {
  return relayPost('/api/publ-events', payload);
}

export function usePublEventCreateMutation(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, ...mutationOptions } = options;

  return useMutation({
    ...mutationOptions,
    meta: { relayMethod: 'POST', ...mutationOptions.meta },
    mutationFn: postPublEventDefinition,
    onSuccess: (detail, variables, context) => {
      const eventKey = String(detail?.eventKey ?? '');

      if (eventKey) {
        queryClient.setQueryData(publEventQueryKeys.detail(eventKey), detail);
      }

      queryClient.invalidateQueries({ queryKey: publEventQueryKeys.catalog });
      onSuccess?.(detail, variables, context);
    },
  });
}

export function usePublEventEditorMutation(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, ...mutationOptions } = options;

  return useMutation({
    ...mutationOptions,
    meta: { relayMethod: 'PATCH', ...mutationOptions.meta },
    mutationFn: patchPublEventEditorDraft,
    onSuccess: (detail, variables, context) => {
      const eventKey = String(variables?.eventKey ?? detail?.eventKey ?? '');

      if (eventKey) {
        queryClient.setQueryData(publEventQueryKeys.detail(eventKey), detail);
        queryClient.invalidateQueries({ queryKey: publEventQueryKeys.detail(eventKey) });
      }

      queryClient.invalidateQueries({ queryKey: publEventQueryKeys.catalog });
      onSuccess?.(detail, variables, context);
    },
  });
}

export function usePublEventDeleteMutation(options = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, ...mutationOptions } = options;

  return useMutation({
    ...mutationOptions,
    meta: { relayMethod: 'DELETE', ...mutationOptions.meta },
    mutationFn: deletePublEventDefinition,
    onSuccess: (detail, variables, context) => {
      const eventKey = String(variables?.eventKey ?? detail?.eventKey ?? '');

      if (eventKey) {
        queryClient.removeQueries({ queryKey: publEventQueryKeys.detail(eventKey) });
      }

      queryClient.invalidateQueries({ queryKey: publEventQueryKeys.catalog });
      onSuccess?.(detail, variables, context);
    },
  });
}

export function normalizePublEventEditorMutationError(error) {
  return toPublEventEditorFormError(error);
}
