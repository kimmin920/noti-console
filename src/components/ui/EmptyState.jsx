import { ArrowUpRight } from 'lucide-react';
import { Button } from './Button.jsx';

export function EmptyState({ action, copy, icon: Icon, onAction, title }) {
  return (
    <div className="empty-panel">
      <div className="empty-content">
        <div className="empty-art">
          <Icon size={52} strokeWidth={1.4} />
        </div>
        <h2>{title}</h2>
        <p>{copy}</p>
        {action ? (
          <Button onClick={onAction} variant="primary">
            <ArrowUpRight size={15} />
            {action}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
