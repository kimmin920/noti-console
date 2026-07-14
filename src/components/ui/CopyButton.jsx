'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { AppIconButton as IconButton } from '../ui-extensions/AppIconButton.jsx';

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function CopyButton({
  className = '',
  copiedLabel = '복사됨',
  label = '복사',
  value,
  ...props
}) {
  const [copied, setCopied] = useState(false);
  const Icon = copied ? Check : Copy;

  return (
    <IconButton
      className={['copy-button', copied ? 'copied' : '', className].filter(Boolean).join(' ')}
      icon={Icon}
      label={copied ? copiedLabel : label}
      onClick={async () => {
        await copyText(String(value ?? ''));
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      title=""
      {...props}
    />
  );
}
