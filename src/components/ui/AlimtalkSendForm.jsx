'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  defaultEmailSendFormSchedules,
  defaultEmailSendFormSegments,
  EmailSendFormCanvas,
  EmailSendFormDisclosure,
  EmailSendFormGhostButton,
  EmailSendFormLabel,
  EmailSendFormRoot,
  EmailSendFormRow,
  EmailSendFormScheduleField,
  EmailSendFormSelect,
  EmailSendFormSelection,
  EmailSendFormTemplateButton,
  EmailSendFormTemplateDialog,
} from './EmailSendForm.jsx';
import {
  getInitialTemplateVariables,
  getTemplateVariableDetails,
  MessageTemplateDocument,
  MessageTemplateVariablePanel,
} from './MessageTemplateVariables.jsx';
import {
  AlimtalkTemplateDialogCard,
  getAlimtalkTemplateDialogItems,
} from './MessageTemplateDialogAdapters.jsx';
import { RecipientSelect } from './RecipientSelect.jsx';
import {
  defaultSmsFallbackSenderNumbers,
  SmsFallbackSelect,
} from './SmsFallbackSelect.jsx';

export const defaultAlimtalkSenderProfiles = [
  {
    label: '@acme 알림톡',
    plusFriendId: '@acme',
    senderKey: 'acme',
    senderProfileType: '채널',
    value: 'profile-acme',
  },
  {
    label: '@acme_support 고객지원',
    plusFriendId: '@acme_support',
    senderKey: 'acme-support',
    senderProfileType: '채널',
    value: 'profile-support',
  },
];

export const defaultAlimtalkTemplates = [
  {
    body: '#{고객명}님, 주문하신 #{상품명} 배송이 시작되었습니다.\n\n운송장 번호: #{운송장번호}\n도착 예정일: #{도착예정일}',
    buttons: [
      {
        linkMo: 'https://example.com/orders/#{운송장번호}',
        linkPc: 'https://example.com/orders/#{운송장번호}',
        name: '배송 조회',
        ordering: 1,
        type: 'WL',
      },
    ],
    label: '배송 시작 안내 · @acme',
    ownerKey: 'acme',
    ownerLabel: '@acme',
    quickReplies: [
      {
        name: '상담원 연결',
        ordering: 2,
        type: 'BK',
      },
    ],
    requiredVariables: ['고객명', '상품명', '운송장번호', '도착예정일'],
    templateCode: 'AT_DELIVERY_START',
    value: 'template-delivery-start',
    variables: [
      { fallbackValue: '고객', key: '고객명', type: 'string' },
      { fallbackValue: '주문 상품', key: '상품명', type: 'string' },
      { fallbackValue: '운송장번호', key: '운송장번호', type: 'string' },
      { fallbackValue: '도착 예정일', key: '도착예정일', type: 'string' },
    ],
  },
  {
    body: '#{고객명}님, #{예약일시} 예약이 확정되었습니다.\n예약 번호: #{예약번호}\n\n방문 전 변경이 필요하면 아래 버튼을 눌러 주세요.',
    buttons: [
      {
        linkMo: 'https://example.com/reservations/#{예약번호}',
        name: '예약 확인',
        ordering: 1,
        type: 'WL',
      },
      {
        name: '전화 문의',
        ordering: 2,
        telNumber: '1544-0000',
        type: 'CT',
      },
    ],
    label: '예약 확정 안내 · @acme_support',
    ownerKey: 'acme-support',
    ownerLabel: '@acme_support',
    quickReplies: [],
    requiredVariables: ['고객명', '예약일시', '예약번호'],
    templateCode: 'AT_RESERVATION_CONFIRMED',
    value: 'template-reservation-confirmed',
    variables: [
      { fallbackValue: '고객', key: '고객명', type: 'string' },
      { fallbackValue: '예약일시', key: '예약일시', type: 'string' },
      { fallbackValue: '예약번호', key: '예약번호', type: 'string' },
    ],
  },
];

export const defaultAlimtalkFallbackSenderNumbers = defaultSmsFallbackSenderNumbers;

export const defaultAlimtalkSendFormValue = {
  fallbackEnabled: false,
  fallbackSenderNumber: '1544-0000',
  recipient: [],
  scheduledAt: '',
  senderProfileId: 'profile-acme',
  templateId: 'template-delivery-start',
  variables: {},
};

function getAlimtalkSendFormValue(value) {
  const mergedValue = { ...defaultAlimtalkSendFormValue, ...value };

  return {
    ...mergedValue,
    fallbackEnabled: Boolean(mergedValue.fallbackEnabled),
    fallbackSenderNumber: mergedValue.fallbackSenderNumber ?? '',
    recipient: Array.isArray(mergedValue.recipient)
      ? mergedValue.recipient
      : mergedValue.recipient
        ? [mergedValue.recipient]
        : [],
    scheduledAt: mergedValue.scheduledAt ?? '',
    senderProfileId: mergedValue.senderProfileId ?? '',
    templateId: mergedValue.templateId ?? '',
    variables: mergedValue.variables ?? {},
  };
}

function getAvailableAlimtalkTemplates(templates, senderProfile) {
  if (!senderProfile) {
    return templates;
  }

  return templates.filter((template) => (
    template.source === 'GROUP'
    || !template.ownerKey
    || template.ownerKey === senderProfile.senderKey
  ));
}

export function AlimtalkSendForm({
  className = '',
  defaultValue,
  fallbackSenderNumbers = defaultAlimtalkFallbackSenderNumbers,
  onChange,
  onFallbackSenderNumberCreate,
  onRecipientCreate,
  onSenderProfileCreate,
  recipientContacts,
  recipientCreateLabel,
  recipients = defaultEmailSendFormSegments,
  scheduleOptions = defaultEmailSendFormSchedules,
  senderProfileCreateLabel = '발신채널 추가하기',
  senderProfiles = defaultAlimtalkSenderProfiles,
  templates = defaultAlimtalkTemplates,
  value,
  variablePanelRoot,
  ...props
}) {
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(() => getAlimtalkSendFormValue(defaultValue));
  const message = getAlimtalkSendFormValue(isControlled ? value : uncontrolledValue);
  const [scheduleVisible, setScheduleVisible] = useState(() => Boolean(message.scheduledAt));
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [activeVariableKey, setActiveVariableKey] = useState('');
  const selectedSenderProfile = senderProfiles.find((item) => item.value === message.senderProfileId) ?? senderProfiles[0] ?? null;
  const availableTemplates = useMemo(
    () => getAvailableAlimtalkTemplates(templates, selectedSenderProfile),
    [selectedSenderProfile, templates]
  );
  const templateDialogItems = useMemo(
    () => getAlimtalkTemplateDialogItems(availableTemplates),
    [availableTemplates]
  );
  const selectedTemplate = availableTemplates.find((item) => item.value === message.templateId) ?? availableTemplates[0] ?? null;
  const selectedVariable = useMemo(() => (
    getTemplateVariableDetails(selectedTemplate, message.variables, activeVariableKey, 'kakao')
  ), [activeVariableKey, message.variables, selectedTemplate]);

  function updateMessage(patch) {
    const nextMessage = getAlimtalkSendFormValue({ ...message, ...patch });

    if (!isControlled) {
      setUncontrolledValue(nextMessage);
    }

    onChange?.(nextMessage);
  }

  function handleSenderProfileChange(senderProfileId) {
    const nextSenderProfile = senderProfiles.find((item) => item.value === senderProfileId) ?? null;
    const nextTemplates = getAvailableAlimtalkTemplates(templates, nextSenderProfile);
    const nextTemplateId = nextTemplates.some((item) => item.value === message.templateId)
      ? message.templateId
      : nextTemplates[0]?.value ?? '';

    setActiveVariableKey('');
    updateMessage({ senderProfileId, templateId: nextTemplateId });
  }

  function hideScheduleIfEmpty(nextValue) {
    if (!nextValue) {
      setScheduleVisible(false);
    }
  }

  function hideScheduleOnEmptyBackspace() {
    setScheduleVisible(false);
  }

  function handleTemplateSelect(template) {
    setActiveVariableKey('');
    updateMessage({
      templateId: template.value ?? template.id ?? '',
      variables: getInitialTemplateVariables(template, 'kakao', message.variables),
    });
  }

  function updateTemplateVariable(key, nextAssignment) {
    updateMessage({
      variables: {
        ...message.variables,
        [key]: nextAssignment,
      },
    });
  }

  const senderOptions = senderProfiles.map((profile) => ({
    label: `${profile.plusFriendId} (${profile.senderProfileType || '채널'})`,
    value: profile.value,
  }));

  return (
    <EmailSendFormRoot className={['alimtalk-send-form-root', className].filter(Boolean).join(' ')} {...props}>
      <EmailSendFormSelection>
        <EmailSendFormRow>
          <EmailSendFormLabel>발신 채널</EmailSendFormLabel>
          <EmailSendFormSelect
            ariaLabel="발신 채널 선택"
            emptyActionLabel={senderProfileCreateLabel}
            emptyDescription="연결된 알림톡 채널이 없습니다. 채널을 연결하면 알림톡을 발송할 수 있습니다."
            onEmptyAction={onSenderProfileCreate}
            onValueChange={handleSenderProfileChange}
            options={senderOptions}
            placeholder="발신 채널 선택"
            showMenuLabel={false}
            value={message.senderProfileId}
          />
        </EmailSendFormRow>

        <EmailSendFormRow
          action={!scheduleVisible ? (
            <EmailSendFormGhostButton onClick={() => setScheduleVisible(true)}>
              예약
            </EmailSendFormGhostButton>
          ) : null}
          className={!scheduleVisible ? 'sms-send-form-row-before-detail-border' : ''}
        >
          <EmailSendFormLabel>수신자</EmailSendFormLabel>
          <RecipientSelect
            ariaLabel="알림톡 수신자 선택"
            contacts={recipientContacts}
            emptyActionLabel={recipientCreateLabel}
            onEmptyAction={onRecipientCreate}
            onValueChange={(recipient) => updateMessage({ recipient })}
            options={recipients}
            value={message.recipient}
          />
        </EmailSendFormRow>

        {scheduleVisible ? (
          <EmailSendFormDisclosure>
            <EmailSendFormRow className="sms-send-form-row-before-detail-border">
              <EmailSendFormLabel htmlFor="alimtalk-send-form-when">예약</EmailSendFormLabel>
              <EmailSendFormScheduleField
                id="alimtalk-send-form-when"
                onCollapseEmpty={hideScheduleIfEmpty}
                onEmptyBackspace={hideScheduleOnEmptyBackspace}
                onNowSelect={() => {
                  updateMessage({ scheduledAt: '' });
                  setScheduleVisible(false);
                }}
                onValueChange={(scheduledAt) => updateMessage({ scheduledAt })}
                options={scheduleOptions}
                placeholder="날짜 또는 시간을 입력하세요"
                value={message.scheduledAt}
              />
            </EmailSendFormRow>
          </EmailSendFormDisclosure>
        ) : null}

        <EmailSendFormRow className="alimtalk-send-form-group-start">
          <EmailSendFormLabel>SMS 대체</EmailSendFormLabel>
          <SmsFallbackSelect
            description="알림톡 실패 시 SMS로 대체 발송하려면 승인된 발신번호가 필요합니다."
            enabled={message.fallbackEnabled}
            onCreateSenderNumber={onFallbackSenderNumberCreate}
            onValueChange={(nextFallback) => updateMessage({
              fallbackEnabled: nextFallback.enabled,
              fallbackSenderNumber: nextFallback.value,
            })}
            options={fallbackSenderNumbers}
            value={message.fallbackSenderNumber}
          />
        </EmailSendFormRow>

      </EmailSendFormSelection>

      <EmailSendFormCanvas
        aria-label="알림톡 템플릿 본문"
        className="alimtalk-send-form-canvas"
        data-empty={!selectedTemplate ? 'true' : undefined}
      >
        {selectedTemplate ? (
          <div className="alimtalk-send-form-template">
            <MessageTemplateDocument
              activeKey={activeVariableKey}
              className="alimtalk-send-form-template-body"
              onVariableClick={setActiveVariableKey}
              text={selectedTemplate.body}
              variables={message.variables}
            />
            <div className="alimtalk-template-actions">
              <EmailSendFormTemplateDialog
                description="발송에 사용할 승인된 알림톡 템플릿을 선택하세요."
                emptyCopy="발신 채널에 승인된 템플릿이 있으면 여기에 표시됩니다."
                emptyTitle="선택 가능한 알림톡 템플릿이 없습니다"
                onOpenChange={setTemplateDialogOpen}
                onTemplateSelect={handleTemplateSelect}
                open={templateDialogOpen}
                renderTemplateCard={AlimtalkTemplateDialogCard}
                searchLabel="알림톡 템플릿 검색"
                searchPlaceholder="템플릿 이름 또는 코드 검색"
                templates={templateDialogItems}
                title="알림톡 템플릿 선택"
                trigger={(
                  <EmailSendFormTemplateButton className="alimtalk-template-action" onClick={() => setTemplateDialogOpen(true)}>
                    템플릿 변경
                  </EmailSendFormTemplateButton>
                )}
              />
            </div>
          </div>
        ) : (
          <div className="alimtalk-send-form-template">
            <div className="alimtalk-send-form-empty">템플릿을 선택하세요.</div>
            <div className="alimtalk-template-actions">
              <EmailSendFormTemplateDialog
                description="발송에 사용할 승인된 알림톡 템플릿을 선택하세요."
                emptyCopy="발신 채널에 승인된 템플릿이 있으면 여기에 표시됩니다."
                emptyTitle="선택 가능한 알림톡 템플릿이 없습니다"
                onOpenChange={setTemplateDialogOpen}
                onTemplateSelect={handleTemplateSelect}
                open={templateDialogOpen}
                renderTemplateCard={AlimtalkTemplateDialogCard}
                searchLabel="알림톡 템플릿 검색"
                searchPlaceholder="템플릿 이름 또는 코드 검색"
                templates={templateDialogItems}
                title="알림톡 템플릿 선택"
                trigger={(
                  <EmailSendFormTemplateButton className="alimtalk-template-action" onClick={() => setTemplateDialogOpen(true)}>
                    템플릿 선택
                  </EmailSendFormTemplateButton>
                )}
              />
            </div>
          </div>
        )}
      </EmailSendFormCanvas>
      {variablePanelRoot
        ? createPortal(
            <MessageTemplateVariablePanel
              onClose={() => setActiveVariableKey('')}
              onValueChange={updateTemplateVariable}
              selectedVariable={selectedVariable}
            />,
            variablePanelRoot
          )
        : null}
    </EmailSendFormRoot>
  );
}
