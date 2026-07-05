'use client';

import { useId } from 'react';

import {
  getRelayErrorMessage,
} from '../../messageSend/api.js';
import { AutomationSetVariables } from './AutomationSetVariables.jsx';

const SMS_CHANNEL_ITEMS = [
  { label: 'SMS', value: 'sms' },
  { label: 'LMS', value: 'lms' },
  { label: 'MMS', value: 'mms' },
];

export function AutomationMessageSettingsForm({
  configuration,
  draft,
  family,
  isLoadingTemplateDetails = false,
  mappingPolicy,
  onSenderResourceChange,
  onSmsChannelChange,
  onVariableMappingChange,
  validation = {},
}) {
  const validationId = useId();

  if (isLoadingTemplateDetails) return <AutomationMessageSettingsSkeleton />;

  const senderOptions = configuration?.senderOptions ?? [];
  const senderResourcesQuery = configuration?.senderResourcesQuery;
  const senderError = validation.sender ?? '';
  const senderErrorId = senderError ? `${validationId}-sender` : undefined;

  return (
    <div
      className="resend-ui-domain-automation-send-email-node__settings"
      data-resend-domain-automation-send-message-settings
    >
      {family === 'sms' ? (
        <SettingsSection title="문자 유형">
          <label>
            <span>발송 유형</span>
            <select
              className="automation-rule-editor-select"
              onChange={(event) => onSmsChannelChange?.(event.target.value)}
              value={draft.sendChannel}
            >
              {SMS_CHANNEL_ITEMS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
        </SettingsSection>
      ) : null}

      <SettingsSection title={family === 'sms' ? '발신번호' : '카카오 발신 프로필'}>
        <label>
          <span>발신 리소스</span>
          <select
            aria-describedby={senderErrorId}
            aria-invalid={senderError ? 'true' : undefined}
            className="automation-rule-editor-select"
            disabled={senderResourcesQuery?.isLoading || senderResourcesQuery?.isError}
            onChange={(event) => onSenderResourceChange?.(event.target.value)}
            value={draft.senderResourceId}
          >
            <option value="">발신 리소스 선택</option>
            {senderOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <QueryState
          emptyMessage="호환되는 발신 리소스가 없습니다."
          loadingMessage="발신 리소스를 불러오는 중입니다."
          query={senderResourcesQuery}
          values={senderOptions}
        />
        {senderError ? (
          <p className="automation-message-node-state is-error" id={senderErrorId} role="alert">
            {senderError}
          </p>
        ) : null}
      </SettingsSection>

      <AutomationSetVariables
        onVariableMappingChange={onVariableMappingChange}
        optionalTemplateVariables={mappingPolicy?.optionalTemplateVariables ?? []}
        requiredTemplateVariables={mappingPolicy?.requiredTemplateVariables ?? []}
        selectedEvent={mappingPolicy?.selectedEvent ?? null}
        validation={validation?.variables ?? {}}
        variableMapping={mappingPolicy?.variableMapping ?? {}}
        variableOptions={mappingPolicy?.variableOptions ?? []}
      />
    </div>
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

function QueryState({ emptyMessage, loadingMessage, query, values }) {
  if (query?.isLoading) return <p className="automation-message-node-state">{loadingMessage}</p>;
  if (query?.isSuccess && values.length === 0) return <p className="automation-message-node-state">{emptyMessage}</p>;
  if (!query?.isError) return null;

  return (
    <p className="automation-message-node-state is-error" role="alert">
      {getRelayErrorMessage(query.error, '데이터를 불러오지 못했습니다.')}
    </p>
  );
}

function AutomationMessageSettingsSkeleton() {
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
