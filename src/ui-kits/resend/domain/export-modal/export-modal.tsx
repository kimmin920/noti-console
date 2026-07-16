import { ArrowDownToLine, X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import { useEffect, useId, useMemo, useState } from 'react';
import { Button } from '../../primitives/button';
import { IconButton } from '../../primitives/icon-button';
import {
  defaultExportConfirmationMessage,
  exportDisabledLabels,
  exportEntityTitles,
  exportFieldConfigs,
  exportFieldPresets,
} from './data';
import { ExportFields } from './export-fields';
import { DownloadingState, EnqueuedState } from './export-modal-states';
import type {
  ExportFieldId,
  ExportModalPayload,
  ExportModalProps,
  ExportModalState,
} from './types';

export function ExportModal({
  children,
  confirmationMessage = defaultExportConfirmationMessage,
  current,
  defaultOpen = false,
  disabled = false,
  entity = 'outboundEmails',
  exportsHref = '/settings/exports',
  fields,
  initialState = 'confirm',
  onExport,
  onOpenChange,
  open,
  total = 0,
  triggerAriaLabel,
  triggerClassName,
  triggerIconClassName,
  triggerLabel = 'Export',
  triggerLabelClassName,
}: ExportModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const fieldIds = fields ?? exportFieldPresets[entity];
  const fieldKey = fieldIds.join('|');
  const initialFieldValues = useMemo(() => makeInitialFieldValues(fieldIds), [fieldKey]);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<ExportModalState>(initialState);
  const [fieldValues, setFieldValues] = useState<Partial<ExportModalPayload>>(initialFieldValues);
  const modalOpen = open ?? internalOpen;
  const title = exportEntityTitles[entity];
  const currentValue = Math.min(current ?? total, total);

  useEffect(() => {
    setFieldValues(initialFieldValues);
  }, [initialFieldValues]);

  useEffect(() => {
    if (modalOpen) setMode(initialState);
  }, [initialState, modalOpen]);

  function handleOpenChange(nextOpen: boolean) {
    if (open === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
    if (!nextOpen) setMode(initialState);
  }

  function handleExport() {
    onExport?.({ ...fieldValues, entity });
    setMode(total >= 1000 ? 'enqueued' : 'downloading');
  }

  return (
    <RadixDialog.Root onOpenChange={handleOpenChange} open={modalOpen}>
      <div data-resend-domain-export-modal>
        <RadixDialog.Trigger asChild>
          {children ?? (
            <Button
              aria-label={disabled ? exportDisabledLabels[entity] : triggerAriaLabel ?? triggerLabel}
              className={cx('resend-ui-export-modal__trigger', triggerClassName)}
              data-resend-domain-export-trigger
              disabled={disabled}
            >
              <ArrowDownToLine aria-hidden="true" className={triggerIconClassName} size={18} />
              <span className={cx('resend-ui-export-modal__trigger-label', triggerLabelClassName)}>{triggerLabel}</span>
            </Button>
          )}
        </RadixDialog.Trigger>
      </div>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="resend-ui-export-modal__overlay">
          <RadixDialog.Content
            aria-describedby={mode === 'confirm' ? descriptionId : undefined}
            aria-labelledby={titleId}
            aria-modal="true"
            className="resend-ui-export-modal__content"
            data-resend-domain-export-modal-content
          >
            <RadixDialog.Title asChild>
              <h2 className="resend-ui-export-modal__title" data-resend-domain-export-title id={titleId}>
                {title}
              </h2>
            </RadixDialog.Title>
            {mode === 'confirm' ? (
              <>
                <RadixDialog.Description asChild>
                  <p
                    className="resend-ui-export-modal__description"
                    data-resend-domain-export-description
                    id={descriptionId}
                  >
                    {confirmationMessage}
                  </p>
                </RadixDialog.Description>
                <ExportFields
                  fields={fieldIds}
                  onChange={(payload) => setFieldValues((currentPayload) => ({ ...currentPayload, ...payload }))}
                />
                <div className="resend-ui-export-modal__actions">
                  <Button
                    className="resend-ui-export-modal__primary-action"
                    data-resend-domain-export-action
                    onClick={handleExport}
                    variant="accent"
                  >
                    Export
                  </Button>
                  <RadixDialog.Close asChild>
                    <Button data-resend-domain-export-action>
                      Cancel
                    </Button>
                  </RadixDialog.Close>
                </div>
              </>
            ) : null}
            {mode === 'downloading' ? (
              <DownloadingState current={currentValue} entity={entity} onClose={() => handleOpenChange(false)} total={total} />
            ) : null}
            {mode === 'failed' ? (
              <DownloadingState current={currentValue} entity={entity} failed onClose={() => handleOpenChange(false)} total={total} />
            ) : null}
            {mode === 'enqueued' ? (
              <EnqueuedState exportsHref={exportsHref} onClose={() => handleOpenChange(false)} />
            ) : null}
            <RadixDialog.Close asChild>
              <IconButton
                className="resend-ui-export-modal__close"
                icon={<X aria-hidden="true" size={18} />}
                label="Close dialog"
              />
            </RadixDialog.Close>
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

function makeInitialFieldValues(fields: readonly ExportFieldId[]) {
  return Object.fromEntries(
    fields.map((field) => [field, exportFieldConfigs[field].defaultValue])
  ) as Partial<ExportModalPayload>;
}
