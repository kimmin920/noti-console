'use client';

import { ChevronDown, Code2, Copy, MoreHorizontal, Pencil } from 'lucide-react';
import { useId } from 'react';

import { ResendInput } from './primitives/ResendInput.jsx';
import { cx } from './shared.js';

function NodeIconButton({
  className = '',
  hideOnCompact = false,
  icon,
  label,
  size = 'normal',
  type = 'button',
  variant = 'ghost',
  ...props
}) {
  return (
    <button
      aria-label={label}
      className={cx(
        'resend-ui-domain-automation-trigger-node__icon-button',
        `resend-ui-domain-automation-trigger-node__icon-button--${variant}`,
        `resend-ui-domain-automation-trigger-node__icon-button--${size}`,
        hideOnCompact && 'resend-ui-domain-automation-trigger-node__icon-button--compact-hidden',
        className
      )}
      type={type}
      {...props}
    >
      <span className="resend-ui-domain-automation-trigger-node__icon-button-content">
        {icon}
      </span>
    </button>
  );
}

function EventReceivedIcon() {
  return (
    <svg
      aria-hidden="true"
      className="resend-ui-domain-automation-trigger-node__trigger-icon-svg"
      fill="currentColor"
      height="24"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        clipRule="evenodd"
        d="M4.64575 1.56641C4.99923 1.2779 5.52125 1.29841 5.85083 1.62793L8.80103 4.57812C9.15237 4.92961 9.15245 5.50013 8.80103 5.85156C8.44968 6.20266 7.87999 6.20254 7.52856 5.85156L6.1145 4.4375V17.2051C6.11475 18.5841 7.22181 19.6912 8.60083 19.6914C9.98003 19.6914 11.0879 18.5842 11.0881 17.2051V6.83105C11.0883 4.45781 13.002 2.54499 15.3752 2.54492C17.7485 2.54503 19.6622 4.45783 19.6624 6.83105V19.5859L21.0999 18.1494C21.4513 17.7983 22.021 17.7982 22.3723 18.1494C22.7238 18.5009 22.7238 19.0714 22.3723 19.4229L19.4221 22.373C19.0706 22.7243 18.5001 22.7244 18.1487 22.373L15.1985 19.4229C14.8471 19.0714 14.8472 18.5009 15.1985 18.1494C15.55 17.7979 16.1205 17.7979 16.4719 18.1494L17.8616 19.5391V6.83105C17.8614 5.45194 16.7544 4.34483 15.3752 4.34473C13.9961 4.3448 12.8881 5.45192 12.8879 6.83105V17.2051C12.8877 19.5783 10.9741 21.4922 8.60083 21.4922C6.2277 21.492 4.31397 19.5782 4.31372 17.2051V4.4375L2.90063 5.85156C2.54919 6.20283 1.97863 6.20285 1.6272 5.85156C1.27585 5.50014 1.27591 4.92959 1.6272 4.57812L4.57739 1.62793L4.64575 1.56641Z"
        fillRule="evenodd"
      />
    </svg>
  );
}

export function AutomationTriggerNode({
  actionsLabel = 'Node actions',
  apiDrawerLabel = 'Open API drawer',
  className = '',
  copyEventLabel = 'Copy to clipboard',
  editEventLabel = 'Edit event properties',
  eventInputLabel = 'Automation event',
  eventOptions = [],
  eventName = 'event',
  eventPlaceholder = 'Select event',
  eventsLoading = false,
  eventsUnavailable = false,
  onActionsClick,
  onApiDrawerClick,
  onCopyEventClick,
  onEditEventClick,
  onEventChange,
  selectedEventId = '',
  showApiButton = true,
  showConnector = true,
  title = 'Custom event',
  validationMessage = '',
  ...props
}) {
  const validationId = useId();
  const validationMessageId = validationMessage ? `${validationId}-validation` : undefined;
  const normalizedEventOptions = eventOptions
    .map((event) => ({
      id: String(event?.id ?? '').trim(),
      label: String(event?.displayName ?? event?.eventKey ?? event?.id ?? '').trim(),
    }))
    .filter((event) => event.id);
  const hasEventDropdown = typeof onEventChange === 'function' || normalizedEventOptions.length > 0 || eventsLoading || eventsUnavailable;
  const eventSelectDisabled = eventsLoading || eventsUnavailable || normalizedEventOptions.length === 0;

  return (
    <article
      aria-label={title}
      className={cx('resend-ui-domain-automation-trigger-node', className)}
      data-resend-domain-automation-trigger-node
      {...props}
    >
      <div className="resend-ui-domain-automation-trigger-node__content">
        <header className="resend-ui-domain-automation-trigger-node__header">
          <span
            aria-hidden="true"
            className="resend-ui-domain-automation-trigger-node__trigger-icon"
          >
            <EventReceivedIcon />
          </span>
          <span className="resend-ui-domain-automation-trigger-node__title">{title}</span>
          <span className="resend-ui-domain-automation-trigger-node__actions">
            {showApiButton ? (
              <NodeIconButton
                data-resend-domain-automation-trigger-node-action="api"
                hideOnCompact
                icon={<Code2 aria-hidden="true" size={14} />}
                label={apiDrawerLabel}
                onClick={onApiDrawerClick}
                variant="interactive"
              />
            ) : null}
            <NodeIconButton
              aria-expanded="false"
              aria-haspopup="menu"
              data-resend-domain-automation-trigger-node-action="menu"
              icon={<MoreHorizontal aria-hidden="true" size={12} />}
              label={actionsLabel}
              onClick={onActionsClick}
            />
          </span>
        </header>
        <div className="resend-ui-domain-automation-trigger-node__body">
          <div className="resend-ui-domain-automation-trigger-node__field">
            {hasEventDropdown ? (
              <>
                <select
                  aria-describedby={validationMessageId}
                  aria-invalid={validationMessage ? 'true' : undefined}
                  aria-label={eventInputLabel}
                  className="resend-ui-input resend-ui-domain-automation-trigger-node__event-select"
                  disabled={eventSelectDisabled}
                  onChange={(event) => onEventChange?.(event.target.value)}
                  value={selectedEventId}
                >
                  <option value="">
                    {eventsLoading ? 'Loading events...' : eventsUnavailable ? 'Events unavailable' : eventPlaceholder}
                  </option>
                  {normalizedEventOptions.map((event) => (
                    <option key={event.id} value={event.id}>{event.label || event.id}</option>
                  ))}
                  {selectedEventId && !normalizedEventOptions.some((event) => event.id === selectedEventId) ? (
                    <option value={selectedEventId}>{selectedEventId}</option>
                  ) : null}
                </select>
                <span
                  aria-hidden="true"
                  className="resend-ui-domain-automation-trigger-node__select-icon"
                >
                  <ChevronDown size={14} />
                </span>
              </>
            ) : (
              <>
                <ResendInput
                  aria-label={eventInputLabel}
                  className="resend-ui-domain-automation-trigger-node__event-input"
                  placeholder="Type or select an event"
                  readOnly
                  value={eventName}
                />
                <span className="resend-ui-domain-automation-trigger-node__field-actions">
                  <NodeIconButton
                    data-resend-domain-automation-trigger-node-action="edit-event"
                    icon={<Pencil aria-hidden="true" size={14} />}
                    label={editEventLabel}
                    onClick={onEditEventClick}
                    size="compact"
                  />
                  <NodeIconButton
                    data-resend-domain-automation-trigger-node-action="copy-event"
                    icon={<Copy aria-hidden="true" size={15} />}
                    label={copyEventLabel}
                    onClick={onCopyEventClick}
                    size="compact"
                  />
                </span>
              </>
            )}
            {validationMessage ? (
              <p className="automation-message-node-state is-error" id={validationMessageId} role="alert">
                {validationMessage}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      {showConnector ? (
        <span
          aria-hidden="true"
          className="resend-ui-domain-automation-trigger-node__connector"
        />
      ) : null}
    </article>
  );
}
