'use client';

import { Ellipsis, ListRestart, RefreshCw } from 'lucide-react';

import {
  ActionMenu,
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuTrigger,
} from '../../../../components/ui/index.js';
import { SendEmailNodeIconButton } from './SendEmailNodeIconButton.jsx';
import { cx } from './shared.js';

export function AutomationSendMessageNodeActionsMenu({
  actionsLabel = '노드 작업',
  className = '',
  onChangeSendAction,
  onChangeTemplate,
}) {
  return (
    <div className={cx('resend-ui-domain-automation-send-email-node__actions', className)}>
      <ActionMenu>
        <ActionMenuTrigger asChild>
          <SendEmailNodeIconButton
            data-resend-domain-automation-send-email-node-action="menu"
            icon={<Ellipsis aria-hidden="true" size={12} />}
            label={actionsLabel}
          />
        </ActionMenuTrigger>
        <ActionMenuContent align="end" sideOffset={8}>
          <ActionMenuItem
            leadingVisual={<RefreshCw size={14} />}
            onSelect={onChangeTemplate}
          >
            템플릿 변경
          </ActionMenuItem>
          <ActionMenuItem
            leadingVisual={<ListRestart size={14} />}
            onSelect={onChangeSendAction}
          >
            발송 채널 변경
          </ActionMenuItem>
        </ActionMenuContent>
      </ActionMenu>
    </div>
  );
}
