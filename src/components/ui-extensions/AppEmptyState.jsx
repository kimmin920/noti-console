import { ArrowUpRight } from 'lucide-react';

import { EmptyState as ResendEmptyState } from '../../ui-kits/resend/data-display/empty-state';

import { AppButton } from './AppButton.jsx';

export function AppEmptyState({ action, copy, icon: Icon, onAction, title }) {
  return (
    <ResendEmptyState.Root>
      <ResendEmptyState.Content>
        {Icon ? (
          <div aria-hidden="true" className="app-rui-empty-state__icon">
            <Icon size={40} strokeWidth={1.4} />
          </div>
        ) : null}
        <ResendEmptyState.Title>{title}</ResendEmptyState.Title>
        <ResendEmptyState.Description>{copy}</ResendEmptyState.Description>
        {action ? (
          <ResendEmptyState.Actions>
            <AppButton onClick={onAction} variant="primary">
              <ArrowUpRight aria-hidden="true" size={15} />
              {action}
            </AppButton>
          </ResendEmptyState.Actions>
        ) : null}
      </ResendEmptyState.Content>
    </ResendEmptyState.Root>
  );
}
