import type { ReactNode } from 'react';

type DeleteConfirmationEntity = 'broadcast' | 'domain';

type DeleteConfirmationPayload = {
  readonly confirmation: string;
  readonly entity: DeleteConfirmationEntity;
  readonly ids: readonly string[];
};

type DeleteConfirmationModalProps = {
  readonly children?: ReactNode;
  readonly defaultOpen?: boolean;
  readonly entity?: DeleteConfirmationEntity;
  readonly ids?: readonly string[];
  readonly loading?: boolean;
  readonly name?: string;
  readonly onConfirm?: (payload: DeleteConfirmationPayload) => Promise<void> | void;
  readonly onOpenChange?: (open: boolean) => void;
  readonly open?: boolean;
};

export type {
  DeleteConfirmationEntity,
  DeleteConfirmationModalProps,
  DeleteConfirmationPayload,
};
