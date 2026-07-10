'use client';

import { Download } from 'lucide-react';
import { Button } from '../../../components/ui/index.js';

export function MessageLogsExportAction({
  disabled = false,
  isPending = false,
  isPublEmbed = false,
  onExport,
}) {
  if (isPublEmbed) return null;

  return (
    <Button
      disabled={disabled || isPending}
      onClick={onExport}
      variant="secondary"
    >
      <Download aria-hidden="true" size={15} />
      {isPending ? '내보내는 중…' : 'CSV 내보내기'}
    </Button>
  );
}
