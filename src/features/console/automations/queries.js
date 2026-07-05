'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  archiveAutomationRule,
  createAutomationRule,
  disableAutomationRule,
  dismissAutomationUnsentDelivery,
  dryRunAutomationRule,
  enableAutomationRule,
  getAutomationRule,
  listAutomationRules,
  listAutomationUnsentDeliveries,
  resendAutomationUnsentDelivery,
  updateAutomationRule,
} from './apiClient.js';
import { automationQueryKeys } from './queryKeys.js';

export function useAutomationRulesQuery(filters = {}, options = {}) {
  return useQuery({
    enabled: options.enabled !== false,
    queryFn: () => listAutomationRules(filters),
    queryKey: automationQueryKeys.rules(filters),
    staleTime: 15_000,
  });
}

export function useAutomationRuleQuery(ruleId, options = {}) {
  return useQuery({
    enabled: Boolean(ruleId) && options.enabled !== false,
    queryFn: () => getAutomationRule(ruleId),
    queryKey: automationQueryKeys.rule(ruleId),
    staleTime: 15_000,
  });
}

function invalidateAutomationRuleQueries(queryClient, ruleId) {
  queryClient.invalidateQueries({ queryKey: automationQueryKeys.rulesRoot });

  if (ruleId) {
    queryClient.invalidateQueries({ queryKey: automationQueryKeys.rule(ruleId) });
  }
}

function invalidateAutomationRuleAndUnsentQueries(queryClient, ruleId) {
  invalidateAutomationRuleQueries(queryClient, ruleId);
  queryClient.invalidateQueries({ queryKey: automationQueryKeys.unsentRoot });
}

export function useAutomationRuleEnableMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ruleId }) => enableAutomationRule(ruleId),
    onSuccess: (_data, variables) => {
      invalidateAutomationRuleAndUnsentQueries(queryClient, variables?.ruleId);
    },
  });
}

export function useAutomationRuleDisableMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ruleId }) => disableAutomationRule(ruleId),
    onSuccess: (_data, variables) => {
      invalidateAutomationRuleAndUnsentQueries(queryClient, variables?.ruleId);
    },
  });
}

export function useAutomationRuleArchiveMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ruleId }) => archiveAutomationRule(ruleId),
    onSuccess: (_data, variables) => {
      invalidateAutomationRuleAndUnsentQueries(queryClient, variables?.ruleId);
    },
  });
}

export function useAutomationRuleDryRunMutation() {
  return useMutation({
    mutationFn: ({ payload, ruleId }) => dryRunAutomationRule(ruleId, payload),
  });
}

export function useAutomationRuleCreateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payload }) => createAutomationRule(payload),
    onSuccess: (data) => {
      invalidateAutomationRuleQueries(queryClient, data?.rule?.id);
    },
  });
}

export function useAutomationRuleUpdateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ payload, ruleId }) => updateAutomationRule(ruleId, payload),
    onSuccess: (_data, variables) => {
      invalidateAutomationRuleQueries(queryClient, variables?.ruleId);
    },
  });
}

export function useAutomationUnsentDeliveriesQuery(filters = {}, options = {}) {
  return useQuery({
    enabled: options.enabled !== false,
    queryFn: () => listAutomationUnsentDeliveries(filters),
    queryKey: automationQueryKeys.unsent(filters),
    staleTime: 15_000,
  });
}

export function useAutomationUnsentResendMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deliveryId }) => resendAutomationUnsentDelivery(deliveryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationQueryKeys.unsentRoot });
    },
  });
}

export function useAutomationUnsentDismissMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deliveryId }) => dismissAutomationUnsentDelivery(deliveryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationQueryKeys.unsentRoot });
    },
  });
}
