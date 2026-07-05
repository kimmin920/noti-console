'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { downloadMessageLogsExport, resendMessageLog } from './api.js';
import { messageLogQueryKeys } from './queryKeys.js';

export function useMessageLogResendMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resendMessageLog,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: messageLogQueryKeys.listRoot });
      queryClient.invalidateQueries({ queryKey: messageLogQueryKeys.detail(variables) });
      queryClient.invalidateQueries({ queryKey: messageLogQueryKeys.groupListRoot });
      queryClient.invalidateQueries({ queryKey: messageLogQueryKeys.groupDetailRoot });
    },
  });
}

export function useMessageLogsExportMutation() {
  return useMutation({
    mutationFn: downloadMessageLogsExport,
  });
}
