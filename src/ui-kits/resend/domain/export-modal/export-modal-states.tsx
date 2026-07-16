import { Dialog as RadixDialog } from 'radix-ui';
import { Button } from '../../primitives/button';
import { ProgressCircle } from './progress-circle';
import type { ExportEntity } from './types';

type DownloadingStateProps = {
  readonly current: number;
  readonly entity: ExportEntity;
  readonly failed?: boolean;
  readonly onClose: () => void;
  readonly total: number;
};

type EnqueuedStateProps = {
  readonly exportsHref: string;
  readonly onClose: () => void;
};

export function DownloadingState({
  current,
  failed = false,
  onClose,
  total,
}: DownloadingStateProps) {
  return (
    <>
      <p className="resend-ui-export-modal__body" data-resend-domain-export-body>
        {failed
          ? 'The export is taking longer than expected or has failed. Please try again or contact support if the issue persists.'
          : 'Your export is being prepared and may take a few seconds. Download will start automatically.'}
      </p>
      <div className="resend-ui-export-modal__progress-row">
        <ProgressCircle current={current} total={total} />
        <span
          className="resend-ui-export-modal__progress-text"
          data-resend-domain-export-progress-text
        >
          Exporting {current.toLocaleString('en-US')} of {total.toLocaleString('en-US')} items...
        </span>
      </div>
      {failed ? (
        <p className="resend-ui-export-modal__banner" data-resend-domain-export-banner role="alert">
          Failed to export {total.toLocaleString('en-US')} items. Please try again or contact support if the issue persists.
        </p>
      ) : null}
      <div className="resend-ui-export-modal__actions">
        <RadixDialog.Close asChild>
          <Button data-resend-domain-export-action onClick={onClose}>
            Close
          </Button>
        </RadixDialog.Close>
      </div>
    </>
  );
}

export function EnqueuedState({ exportsHref, onClose }: EnqueuedStateProps) {
  return (
    <>
      <p className="resend-ui-export-modal__body" data-resend-domain-export-body>
        Your export is being prepared. When it is ready, you will receive an email, and it will be available on the{' '}
        <a className="resend-ui-export-modal__link" href={exportsHref}>
          Exports page
        </a>
        .
      </p>
      <div className="resend-ui-export-modal__actions">
        <Button asChild data-resend-domain-export-action variant="accent">
          <a href={exportsHref}>Go to Exports</a>
        </Button>
        <RadixDialog.Close asChild>
          <Button data-resend-domain-export-action onClick={onClose}>
            Close
          </Button>
        </RadixDialog.Close>
      </div>
    </>
  );
}
