import { RefreshCcw } from 'lucide-react';
import { Button } from '../../../components/ui/index.js';

export function AutomationTableLoadError({ message, onRetry, title = 'PUBL 이벤트 로드 실패' }) {
  return (
    <div className="publ-event-load-error" role="alert">
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      <Button onClick={onRetry}>
        <RefreshCcw aria-hidden="true" size={14} />
        다시 시도
      </Button>
    </div>
  );
}
