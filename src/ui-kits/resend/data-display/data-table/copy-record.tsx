import {
  forwardRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type ComponentRef,
} from 'react';

type CopyRecordProps = Omit<ComponentPropsWithoutRef<'span'>, 'children' | 'role' | 'tabIndex'> & {
  readonly children?: ReactNode;
  readonly onCopied?: (value: string) => void;
  readonly onCopyError?: (error: Error) => void;
  readonly value: string;
};

class ClipboardUnavailableError extends Error {
  constructor() {
    super('Clipboard API unavailable');
    this.name = 'ClipboardUnavailableError';
  }
}

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

function normalizeClipboardError(error: unknown) {
  return error instanceof Error ? error : new ClipboardUnavailableError();
}

const CopyRecord = forwardRef<ComponentRef<'span'>, CopyRecordProps>(function CopyRecord({
  'aria-label': ariaLabel,
  children,
  className,
  onClick,
  onCopied,
  onCopyError,
  onKeyDown,
  value,
  ...props
}, ref) {
  const [copyState, setCopyState] = useState<'copied' | 'idle'>('idle');

  async function copyValue() {
    try {
      if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
        throw new ClipboardUnavailableError();
      }
      await navigator.clipboard.writeText(value);
      setCopyState('copied');
      onCopied?.(value);
    } catch (error) {
      setCopyState('idle');
      onCopyError?.(normalizeClipboardError(error));
    }
  }

  function handleClick(event: MouseEvent<HTMLSpanElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    void copyValue();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    void copyValue();
  }

  return (
    <span
      aria-label={ariaLabel ?? `Copy ${value}`}
      className={cx('resend-ui-copy-record', className)}
      data-copy-state={copyState}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      ref={ref}
      tabIndex={0}
      {...props}
    >
      <span className="resend-ui-copy-record__text">{children ?? value}</span>
    </span>
  );
});

export { ClipboardUnavailableError, CopyRecord };
export type { CopyRecordProps };
