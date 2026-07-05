'use client';

import { useMemo } from 'react';

import { DraftTemplateNotice } from './DraftTemplateNotice.jsx';
import { ResendInput } from './primitives/ResendInput.jsx';

export function SendEmailSettingsForm({
  errors,
  isLoadingTemplateDetails = false,
  isPublishingTemplate = false,
  onPublishTemplate,
  onValuesChange,
  template,
  values,
  variables,
  verifiedDomainNames,
}) {
  const sortedVariables = useMemo(() => (
    [...variables].sort((first, second) => Number(isRequired(second)) - Number(isRequired(first)))
  ), [variables]);
  const fromError = errors?.from ?? getUnverifiedDomainError(values.from, verifiedDomainNames);

  if (isLoadingTemplateDetails) return <SendEmailSettingsSkeleton />;

  return (
    <form
      className="resend-ui-domain-automation-send-email-node__settings"
      data-resend-domain-automation-send-email-settings
      onSubmit={(event) => event.preventDefault()}
    >
      {template.status === 'draft' ? (
        <DraftTemplateNotice
          isPublishing={isPublishingTemplate}
          onPublishTemplate={onPublishTemplate}
          template={template}
        />
      ) : null}
      <SettingsSection title="Subject">
        <ResendInput
          aria-label="Subject"
          invalid={errors?.subject !== undefined}
          onChange={(event) => updateValues(values, onValuesChange, { subject: event.currentTarget.value })}
          placeholder="Email subject line"
          value={values.subject}
        />
        <FieldError message={errors?.subject} />
      </SettingsSection>
      <SettingsSection title="Sender">
        <ResendInput
          aria-label="From"
          autoComplete="off"
          invalid={fromError !== undefined}
          onChange={(event) => updateValues(values, onValuesChange, { from: event.currentTarget.value })}
          placeholder="Acme <acme@example.com>"
          spellCheck={false}
          value={values.from}
        />
        <FieldError message={fromError} />
        <ResendInput
          aria-label="Reply to"
          invalid={errors?.replyTo !== undefined}
          onChange={(event) => updateValues(values, onValuesChange, { replyTo: event.currentTarget.value })}
          placeholder="Reply to (optional)"
          value={values.replyTo}
        />
        <FieldError message={errors?.replyTo} />
      </SettingsSection>
      {sortedVariables.length > 0 ? (
        <SettingsSection title="Set variables">
          {sortedVariables.map((variable, index) => (
            <VariableField
              error={errors?.variables?.[variable.key]}
              index={index}
              key={variable.id}
              onValuesChange={onValuesChange}
              values={values}
              variable={variable}
            />
          ))}
        </SettingsSection>
      ) : null}
    </form>
  );
}

function SettingsSection({
  children,
  title,
}) {
  return (
    <section className="resend-ui-domain-automation-send-email-node__settings-section">
      <h3>{title}</h3>
      <div className="resend-ui-domain-automation-send-email-node__settings-fields">
        {children}
      </div>
    </section>
  );
}

function VariableField({
  error,
  index,
  onValuesChange,
  values,
  variable,
}) {
  const value = values.variables[variable.key] ?? '';
  const validationMessage = error ?? getVariableError(variable, value);
  const inputDisabled = variable.type === 'object' || variable.type === 'list';

  return (
    <div className="resend-ui-domain-automation-send-email-node__variable">
      {index > 0 ? <div className="resend-ui-domain-automation-send-email-node__variable-rule" /> : null}
      <label>
        <span className="resend-ui-domain-automation-send-email-node__variable-label">
          <code>{`{{{${variable.key}}}}`}</code>
          {!isRequired(variable) ? <small>(optional)</small> : null}
        </span>
        <ResendInput
          aria-label={`Variable ${variable.key}`}
          disabled={inputDisabled}
          invalid={validationMessage !== undefined}
          onChange={(event) => {
            updateVariableValue(values, onValuesChange, variable.key, event.currentTarget.value);
          }}
          placeholder="Type or select a property"
          value={value}
        />
      </label>
      <FieldError message={validationMessage} />
    </div>
  );
}

function SendEmailSettingsSkeleton() {
  return (
    <div
      aria-live="polite"
      className="resend-ui-domain-automation-send-email-node__settings-skeleton"
    >
      <div />
      <div />
    </div>
  );
}

function FieldError({ message }) {
  return message ? (
    <p className="resend-ui-domain-automation-send-email-node__field-error">{message}</p>
  ) : null;
}

function isRequired(variable) {
  return variable.fallbackValue === null;
}

function updateValues(
  values,
  onValuesChange,
  patch
) {
  onValuesChange?.({ ...values, ...patch });
}

function updateVariableValue(
  values,
  onValuesChange,
  key,
  value
) {
  onValuesChange?.({
    ...values,
    variables: {
      ...values.variables,
      [key]: value,
    },
  });
}

function getUnverifiedDomainError(value, domains) {
  const domain = value.includes('@') ? value.split('@').at(-1)?.replace('>', '').trim() : '';
  if (!domain || domains.length === 0 || domains.some((item) => item === domain)) return undefined;
  return 'Use a verified sender domain.';
}

function getVariableError(variable, value) {
  if (isRequired(variable) && value.trim() === '') return 'Choose a value for this variable';

  switch (variable.type) {
    case 'number':
      return value.trim() !== '' && Number.isNaN(Number(value)) ? 'Value must be a valid number' : undefined;
    case 'boolean':
      return value.trim() !== '' && value !== 'true' && value !== 'false' ? 'Value must be true or false' : undefined;
    case 'list':
      return 'List variables must be set via the API';
    case 'object':
      return 'Object variables must be set via the API';
    case 'string':
      return undefined;
    default:
      return undefined;
  }
}
