import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

type DeleteCopyButtonProps = {
  readonly value: string;
};

async function copyText(value: string): Promise<void> {
  if (typeof navigator === 'undefined' || navigator.clipboard === undefined) return;
  await navigator.clipboard.writeText(value);
}

export function DeleteCopyButton({ value }: DeleteCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    setCopied(true);
    void copyText(value).then(
      () => undefined,
      () => undefined
    );
  }

  return (
    <button
      aria-label="Copy confirmation text"
      className="resend-ui-delete-confirmation-modal__copy"
      data-copy-state={copied ? 'copied' : 'idle'}
      data-resend-delete-confirmation-copy
      onClick={handleCopy}
      type="button"
    >
      {copied ? <Check aria-hidden="true" size={12} /> : <Copy aria-hidden="true" size={12} />}
    </button>
  );
}
