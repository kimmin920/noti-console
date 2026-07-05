'use client';

import {
  defaultAlimtalkSendFormValue,
  defaultAlimtalkSenderProfiles,
  defaultAlimtalkTemplates,
} from './AlimtalkSendForm.jsx';
import { getMessageTemplateVariableValue } from './MessageTemplateVariables.jsx';

function getAlimtalkPreviewValue(value) {
  return {
    ...defaultAlimtalkSendFormValue,
    ...value,
    variables: value?.variables ?? {},
  };
}

function getSelectedSenderProfile(message, senderProfiles) {
  return senderProfiles.find((item) => item.value === message.senderProfileId) ?? senderProfiles[0] ?? null;
}

function getSelectedTemplate(message, templates, senderProfile) {
  const availableTemplates = senderProfile
    ? templates.filter((template) => (
      template.source === 'GROUP'
      || !template.ownerKey
      || template.ownerKey === senderProfile.senderKey
    ))
    : templates;

  return availableTemplates.find((item) => item.value === message.templateId) ?? availableTemplates[0] ?? null;
}

function renderAlimtalkPreviewText(text, variables) {
  return text.split(/(#\{[^}]+\})/g).map((part, index) => {
    const match = part.match(/^#\{(.+)\}$/);

    if (!match) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    const value = getMessageTemplateVariableValue(variables, match[1]);

    return value ? (
      <span key={`${part}-${index}`}>{value}</span>
    ) : (
      <span className="alimtalk-preview-token" key={`${part}-${index}`}>
        {part}
      </span>
    );
  });
}

function getAlimtalkActionLabel(type) {
  if (type === 'WL') return '웹링크';
  if (type === 'AL') return '앱링크';
  if (type === 'AC') return '채널 추가';
  if (type === 'BK') return '봇 키워드';
  if (type === 'MD') return '메시지 전달';
  if (type === 'CT') return '전화';
  return type || '버튼';
}

function getAlimtalkActionLinks(action) {
  return [
    action.linkMo ? { label: '모바일', value: action.linkMo } : null,
    action.linkPc ? { label: 'PC', value: action.linkPc } : null,
    action.schemeIos ? { label: 'iOS', value: action.schemeIos } : null,
    action.schemeAndroid ? { label: 'Android', value: action.schemeAndroid } : null,
    action.telNumber ? { label: '전화번호', value: action.telNumber } : null,
  ].filter(Boolean);
}

function AlimtalkPreviewActions({ actions }) {
  if (!actions.length) {
    return null;
  }

  return (
    <div className="alimtalk-preview-buttons">
      {[...actions].sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0)).map((action, index) => (
        <div className="alimtalk-preview-button" key={`${action.type}-${action.name ?? index}-${action.ordering}`}>
          {action.name || getAlimtalkActionLabel(action.type)}
        </div>
      ))}
    </div>
  );
}

function AlimtalkActionDetails({ actions, variables }) {
  const actionsWithLinks = actions
    .map((action) => ({
      action,
      links: getAlimtalkActionLinks(action),
    }))
    .filter((item) => item.links.length);

  if (!actionsWithLinks.length) {
    return null;
  }

  return (
    <div className="alimtalk-action-details">
      <div className="alimtalk-action-details-title">버튼/링크</div>
      <div className="alimtalk-action-detail-list">
        {actionsWithLinks.map(({ action, links }, index) => (
          <div className="alimtalk-action-detail-row" key={`${action.type}-${action.name ?? index}-${action.ordering}`}>
            <div className="alimtalk-action-detail-head">
              <span className="alimtalk-action-detail-name">
                {action.name || getAlimtalkActionLabel(action.type)}
              </span>
              <span className="alimtalk-action-detail-type">{getAlimtalkActionLabel(action.type)}</span>
            </div>
            <dl className="alimtalk-action-link-list">
              {links.map((link) => (
                <div className="alimtalk-action-link-row" key={link.label}>
                  <dt>{link.label}</dt>
                  <dd>{renderAlimtalkPreviewText(link.value, variables)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AlimtalkPreview({
  className = '',
  senderProfiles = defaultAlimtalkSenderProfiles,
  templates = defaultAlimtalkTemplates,
  timeLabel = '오늘 오후 2:30',
  value,
  ...props
}) {
  const message = getAlimtalkPreviewValue(value);
  const selectedSenderProfile = getSelectedSenderProfile(message, senderProfiles);
  const selectedTemplate = getSelectedTemplate(message, templates, selectedSenderProfile);
  const actions = selectedTemplate
    ? [...(selectedTemplate.buttons ?? []), ...(selectedTemplate.quickReplies ?? [])]
    : [];
  const senderLabel = selectedSenderProfile?.plusFriendId || '채널 미선택';

  return (
    <aside
      aria-label="알림톡 미리보기"
      className={['alimtalk-preview', className].filter(Boolean).join(' ')}
      {...props}
    >
      <div className="alimtalk-preview-title">미리보기</div>
      <div className="alimtalk-preview-phone">
        <div className="alimtalk-preview-time">{timeLabel}</div>
        <div className="alimtalk-preview-scroll">
          <div className="alimtalk-preview-row">
            <div className="alimtalk-preview-avatar">
              {senderLabel.replace(/^@/, '').slice(0, 1).toUpperCase() || 'A'}
            </div>
            <div className="alimtalk-preview-content">
              <div className="alimtalk-preview-sender">{senderLabel}</div>
              <div className="alimtalk-preview-bubble">
                {selectedTemplate ? (
                  <>
                    <div className="alimtalk-preview-text">
                      {renderAlimtalkPreviewText(selectedTemplate.body, message.variables)}
                    </div>
                    <AlimtalkPreviewActions actions={actions} />
                  </>
                ) : (
                  <div className="alimtalk-preview-empty">템플릿을 선택하면 미리보기가 표시됩니다</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <AlimtalkActionDetails actions={actions} variables={message.variables} />
    </aside>
  );
}
