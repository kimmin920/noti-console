import type { ReactNode } from 'react';

export type ExportEntity =
  | 'apiKeys'
  | 'broadcasts'
  | 'contacts'
  | 'domains'
  | 'inboundEmails'
  | 'logs'
  | 'outboundEmails';

export type ExportFieldId =
  | 'apiKey'
  | 'audience'
  | 'date'
  | 'permission'
  | 'status'
  | 'timezone';

export type ExportModalState = 'confirm' | 'downloading' | 'enqueued' | 'failed';

export type ExportFieldOption = {
  readonly label: string;
  readonly value: string;
};

export type ExportFieldConfig = {
  readonly defaultValue: string;
  readonly id: ExportFieldId;
  readonly label: string;
  readonly options: readonly ExportFieldOption[];
};

export type ExportModalPayload = Partial<Record<ExportFieldId, string>> & {
  readonly entity: ExportEntity;
};

export type ExportModalProps = {
  readonly children?: ReactNode;
  readonly confirmationMessage?: string;
  readonly current?: number;
  readonly defaultOpen?: boolean;
  readonly disabled?: boolean;
  readonly entity?: ExportEntity;
  readonly exportsHref?: string;
  readonly fields?: readonly ExportFieldId[];
  readonly initialState?: ExportModalState;
  readonly onExport?: ((payload: ExportModalPayload) => void) | undefined;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
  readonly open?: boolean;
  readonly total?: number;
  readonly triggerAriaLabel?: string | undefined;
  readonly triggerClassName?: string | undefined;
  readonly triggerIconClassName?: string | undefined;
  readonly triggerLabel?: string;
  readonly triggerLabelClassName?: string | undefined;
};
