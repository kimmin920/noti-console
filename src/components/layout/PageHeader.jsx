import { Plus } from 'lucide-react';
import { Button } from '../ui/Button.jsx';

export function PageHeader({ action, onAction, title }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      {action ? (
        <Button onClick={onAction} variant="primary">
          <Plus size={15} />
          {action}
        </Button>
      ) : null}
    </div>
  );
}
