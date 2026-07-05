'use client';

import {
  Clock,
  SendHorizontal,
  Sparkles,
  Split,
  Timer,
  UserMinus,
  UserPen,
  Users,
} from 'lucide-react';
import { useId } from 'react';

import { cx } from './shared.js';

export const primaryAutomationAction = {
  icon: Sparkles,
  id: 'ai-generate',
  label: 'Create with AI...',
};

export const defaultAutomationActionGroups = [
  {
    actions: [
      {
        icon: SendHorizontal,
        id: 'send_email',
        label: 'Send email',
      },
    ],
    label: 'Messages',
  },
  {
    actions: [
      {
        icon: Split,
        id: 'true_false_branch',
        label: 'Condition',
      },
      {
        icon: Clock,
        id: 'delay',
        label: 'Delay',
      },
      {
        icon: Timer,
        id: 'wait_for_event',
        label: 'Wait for event',
      },
    ],
    label: 'Flow control',
  },
  {
    actions: [
      {
        icon: UserPen,
        id: 'contact_update',
        label: 'Update contact',
      },
      {
        icon: UserMinus,
        id: 'contact_delete',
        label: 'Delete contact',
      },
      {
        icon: Users,
        id: 'add_to_segment',
        label: 'Add to segment',
      },
    ],
    label: 'Audience',
  },
];

export function getAutomationActionId(value, fallback = 'delay') {
  switch (value) {
    case 'add_to_segment':
    case 'ai-generate':
    case 'contact_delete':
    case 'contact_update':
    case 'delay':
    case 'send_email':
    case 'true_false_branch':
    case 'wait_for_event':
      return value;
    default:
      return fallback;
  }
}

function AutomationActionOption({
  action,
  onActionSelect,
  selected,
}) {
  const Icon = action.icon;

  return (
    <button
      aria-disabled={action.disabled === true}
      aria-selected={selected}
      className="resend-ui-domain-automation-action-list__item"
      data-disabled={String(action.disabled === true)}
      data-resend-domain-automation-action-list-action={action.id}
      data-selected={String(selected)}
      disabled={action.disabled}
      onClick={() => onActionSelect?.(action)}
      role="option"
      type="button"
    >
      <span className="resend-ui-domain-automation-action-list__icon">
        <Icon aria-hidden="true" size={14} />
      </span>
      <span className="resend-ui-domain-automation-action-list__label">{action.label}</span>
    </button>
  );
}

export function AutomationActionList({
  actionsLabel = 'Actions',
  className = '',
  groups = defaultAutomationActionGroups,
  onActionSelect,
  primaryAction = primaryAutomationAction,
  selectedActionId = 'delay',
  validationMessage = '',
  ...props
}) {
  const headingBaseId = useId();
  const validationMessageId = validationMessage ? `${headingBaseId}-validation` : undefined;

  return (
    <div
      className={cx('resend-ui-domain-automation-action-list', className)}
      data-resend-domain-automation-action-list
      {...props}
    >
      <div
        aria-describedby={validationMessageId}
        aria-label={actionsLabel}
        className="resend-ui-domain-automation-action-list__list"
        role="listbox"
        tabIndex={0}
      >
        {primaryAction ? (
          <AutomationActionOption
            action={primaryAction}
            onActionSelect={onActionSelect}
            selected={selectedActionId === primaryAction.id}
          />
        ) : null}
        {groups.map((group, groupIndex) => {
          const headingId = `${headingBaseId}-${groupIndex}`;

          return (
            <section
              aria-labelledby={headingId}
              className="resend-ui-domain-automation-action-list__group"
              key={group.label}
              role="group"
            >
              <h3
                className="resend-ui-domain-automation-action-list__heading"
                id={headingId}
              >
                {group.label}
              </h3>
              <div className="resend-ui-domain-automation-action-list__group-items">
                {group.actions.map((action) => (
                  <AutomationActionOption
                    action={action}
                    key={action.id}
                    onActionSelect={onActionSelect}
                    selected={selectedActionId === action.id}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {validationMessage ? (
        <p className="automation-message-node-state is-error" id={validationMessageId} role="alert">
          {validationMessage}
        </p>
      ) : null}
    </div>
  );
}
