'use client';

import { useId, useRef } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { Button } from './Button.jsx';
import { IconButton } from './IconButton.jsx';
import { TextField } from './TextField.jsx';

export function SectionPanel({
  bodyClassName = '',
  children,
  className = '',
  description,
  footer,
  title,
  ...props
}) {
  return (
    <section className={['section-panel', className].filter(Boolean).join(' ')} {...props}>
      {title || description ? (
        <header className="section-panel-header">
          {title ? <h2>{title}</h2> : null}
          {description ? <p>{description}</p> : null}
        </header>
      ) : null}
      {children ? (
        <div className={['section-panel-body', bodyClassName].filter(Boolean).join(' ')}>
          {children}
        </div>
      ) : null}
      {footer ? <footer className="section-panel-footer">{footer}</footer> : null}
    </section>
  );
}

export function OverviewFormPanel({
  avatarAlt = '',
  avatarFallback = 'T',
  avatarHelpText = 'Maximum file size is 1MB.',
  avatarLabel = 'Avatar',
  avatarSrc,
  avatarUploadAccept = 'image/*',
  avatarUploading = false,
  avatarUploadingLabel = 'Uploading image',
  className = '',
  formId,
  nameLabel = 'Team name',
  nameValue = '',
  onAvatarFileChange,
  onAvatarRemove,
  onAvatarUpdate,
  onNameChange,
  onSubmit,
  removeAvatarLabel = 'Remove image',
  saveDisabled = false,
  saveLabel = 'Save',
  title = 'Overview',
  updateAvatarLabel = 'Update image',
  showRemoveAvatarAction,
}) {
  const generatedFormId = useId();
  const generatedNameId = useId();
  const avatarInputRef = useRef(null);
  const resolvedFormId = formId ?? generatedFormId;
  const resolvedNameId = `${resolvedFormId}-${generatedNameId}-name`;
  const shouldShowRemoveAvatarAction = showRemoveAvatarAction ?? Boolean(avatarSrc);

  function handleAvatarUpdate(event) {
    onAvatarUpdate?.(event);

    if (!event.defaultPrevented && onAvatarFileChange) {
      avatarInputRef.current?.click();
    }
  }

  function handleAvatarFileChange(event) {
    const file = event.target.files?.[0];

    if (file) {
      onAvatarFileChange?.(file, event);
    }

    event.target.value = '';
  }

  return (
    <SectionPanel
      className={['overview-form-panel', className].filter(Boolean).join(' ')}
      footer={(
        <Button disabled={saveDisabled} form={resolvedFormId} type="submit" variant="primary">
          {saveLabel}
        </Button>
      )}
      title={title}
    >
      <form
        className="overview-form-panel-form"
        id={resolvedFormId}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.(event);
        }}
      >
        <div className="overview-form-panel-field">
          <span className="overview-form-panel-label">{avatarLabel}</span>
          <div className="overview-form-panel-avatar-row">
            <div className="overview-form-panel-avatar-preview">
              {avatarSrc ? (
                <span
                  aria-hidden={avatarAlt ? undefined : 'true'}
                  aria-label={avatarAlt || undefined}
                  className="overview-form-panel-avatar-image"
                  role={avatarAlt ? 'img' : undefined}
                  style={{ backgroundImage: `url("${avatarSrc}")` }}
                />
              ) : (
                <span aria-hidden="true" className="overview-form-panel-avatar-fallback">
                  {avatarFallback}
                </span>
              )}
            </div>
            <div className="overview-form-panel-avatar-copy">
              <div className="overview-form-panel-avatar-actions">
                {onAvatarFileChange ? (
                  <input
                    accept={avatarUploadAccept}
                    className="overview-form-panel-avatar-input"
                    disabled={avatarUploading}
                    onChange={handleAvatarFileChange}
                    ref={avatarInputRef}
                    type="file"
                  />
                ) : null}
                <Button
                  aria-busy={avatarUploading}
                  aria-label={avatarUploading ? avatarUploadingLabel : updateAvatarLabel}
                  className={[
                    'overview-form-panel-upload-button',
                    avatarUploading && 'is-loading',
                  ].filter(Boolean).join(' ')}
                  disabled={avatarUploading}
                  onClick={handleAvatarUpdate}
                  variant="secondary"
                >
                  {avatarUploading ? (
                    <span aria-hidden="true" className="overview-form-panel-upload-loader">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : null}
                  <span className="overview-form-panel-upload-content">
                    <Upload aria-hidden="true" size={15} />
                    {updateAvatarLabel}
                  </span>
                </Button>
                {shouldShowRemoveAvatarAction ? (
                  <IconButton
                    disabled={avatarUploading}
                    icon={Trash2}
                    label={removeAvatarLabel}
                    onClick={onAvatarRemove}
                  />
                ) : null}
              </div>
              {avatarHelpText ? <p>{avatarHelpText}</p> : null}
            </div>
          </div>
        </div>

        <div className="overview-form-panel-field overview-form-panel-name-field">
          <label className="overview-form-panel-label" htmlFor={resolvedNameId}>{nameLabel}</label>
          <TextField.Root>
            <TextField.Input
              id={resolvedNameId}
              onChange={(event) => onNameChange?.(event.target.value)}
              readOnly={!onNameChange}
              value={nameValue}
            />
          </TextField.Root>
        </div>
      </form>
    </SectionPanel>
  );
}

export function SplitSection({
  action,
  children,
  className = '',
  copy,
  disabled = false,
  tableLabel,
  tableMeta,
  title,
  ...props
}) {
  return (
    <section
      className={[
        'split-section',
        disabled && 'is-disabled',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      <div className="split-section-copy">
        <h2>{title}</h2>
        {copy ? <p>{copy}</p> : null}
        {action ? <div className="split-section-action">{action}</div> : null}
      </div>
      <div className="split-section-panel">
        {tableLabel || tableMeta ? (
          <div className="split-section-heading-row">
            {tableLabel ? <span>{tableLabel}</span> : <span />}
            {tableMeta ? <small>{tableMeta}</small> : null}
          </div>
        ) : null}
        <div className="property-list">{children}</div>
      </div>
    </section>
  );
}

export function PropertyRow({
  children,
  className = '',
  detail,
  icon,
  label,
  trailing,
  value,
  ...props
}) {
  return (
    <div className={['property-row', className].filter(Boolean).join(' ')} {...props}>
      <span className="property-row-icon" aria-hidden="true">{icon}</span>
      <span className="property-row-copy">
        <span>{label}</span>
        {detail ? <small>{detail}</small> : null}
      </span>
      {children}
      {value ? <strong className="property-row-value">{value}</strong> : null}
      {trailing ? <span className="property-row-trailing">{trailing}</span> : null}
    </div>
  );
}

export function SubscriptionList({ action, className = '', items = [] }) {
  return (
    <div className={['subscription-list', className].filter(Boolean).join(' ')}>
      {items.map((item) => (
        <div className="subscription-list-row" key={item.id ?? item.name}>
          <div className="subscription-list-copy">
            <strong>{item.name}</strong>
            {item.quota ? <span>{item.quota}</span> : null}
          </div>
          <div className="subscription-list-price">
            <strong>{item.price}</strong>
            {item.cadence ? <span>{item.cadence}</span> : null}
          </div>
          {item.action ? <div className="subscription-list-action">{item.action}</div> : null}
        </div>
      ))}
      {action ? <div className="subscription-list-footer">{action}</div> : null}
    </div>
  );
}

export function InlineEmptyState({ action, className = '', copy, title }) {
  return (
    <div className={['inline-empty-state', className].filter(Boolean).join(' ')}>
      {title ? <strong>{title}</strong> : null}
      {copy ? <p>{copy}</p> : null}
      {action ? <div className="inline-empty-state-action">{action}</div> : null}
    </div>
  );
}

export function PreferenceRow({
  checked,
  className = '',
  copy,
  defaultChecked,
  disabled = false,
  id,
  onCheckedChange,
  onChange,
  price,
  title,
}) {
  const controlled = checked !== undefined;

  return (
    <label className={['preference-row', disabled && 'is-disabled', className].filter(Boolean).join(' ')} htmlFor={id}>
      <input
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        id={id}
        onChange={(event) => {
          onChange?.(event);
          onCheckedChange?.(event.target.checked);
        }}
        readOnly={controlled && !onChange && !onCheckedChange}
        type="checkbox"
      />
      <span className="preference-row-copy">
        <span>
          <strong>{title}</strong>
          {price ? <em>{price}</em> : null}
        </span>
        {copy ? <small>{copy}</small> : null}
      </span>
    </label>
  );
}
