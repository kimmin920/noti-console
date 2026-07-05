'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelMessageReservationGroup } from './api.js';
import { messageReservationQueryKeys } from './queryKeys.js';

export function useMessageReservationCancelMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelMessageReservationGroup,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: messageReservationQueryKeys.groupListRoot });
      queryClient.invalidateQueries({ queryKey: messageReservationQueryKeys.groupDetail(variables) });
    },
  });
}
