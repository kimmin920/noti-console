export function KakaoTemplateCardPreview({ activeVariableKey = '', body, className = '', template }) {
  const actions = getTemplateAlimtalkActions(template);
  const bubbleClassName = [
    'template-card-kakao-bubble',
    actions.length ? 'template-card-kakao-bubble--with-actions' : '',
  ].filter(Boolean).join(' ');
  const senderLabel = getTemplateAlimtalkSenderLabel(template);

  return (
    <span className={['template-card-preview-fallback', 'template-card-preview-fallback--alimtalk', className].filter(Boolean).join(' ')}>
      <span className="template-card-kakao-preview" role="group" aria-label={`${template.name} 알림톡 미리보기`}>
        <span className="template-card-kakao-row">
          <span className="template-card-kakao-avatar" aria-hidden="true">
            {getTemplateAlimtalkAvatarText(senderLabel)}
          </span>
          <span className="template-card-kakao-content">
            <span className="template-card-kakao-sender">{senderLabel}</span>
            <span className={bubbleClassName}>
              <span className="template-card-kakao-badge">알림톡</span>
              <span className="template-card-kakao-text">
                {renderTemplatePreviewText(body, activeVariableKey)}
              </span>
              <TemplateAlimtalkPreviewActions actions={actions} />
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}

function TemplateAlimtalkPreviewActions({ actions }) {
  if (!actions.length) {
    return null;
  }

  return (
    <span className="template-card-kakao-buttons">
      {actions.map((action, index) => (
        <span className="template-card-kakao-button" key={`${action.type}-${action.name ?? index}-${action.ordering}`}>
          {action.name || getTemplateAlimtalkActionLabel(action.type)}
        </span>
      ))}
    </span>
  );
}

function getTemplateAlimtalkSenderLabel(template) {
  return template.codeMetaLabel || template.ownerLabel || '알림톡';
}

function getTemplateAlimtalkAvatarText(senderLabel) {
  return senderLabel.replace(/^@/, '').slice(0, 1).toUpperCase() || 'A';
}

function getTemplateAlimtalkActions(template) {
  return [
    ...(Array.isArray(template.buttons) ? template.buttons : []),
    ...(Array.isArray(template.quickReplies) ? template.quickReplies : []),
  ]
    .filter((action) => action?.name || action?.type)
    .sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0))
    .slice(0, 2);
}

function getTemplateAlimtalkActionLabel(type) {
  if (type === 'WL') return '웹링크';
  if (type === 'AL') return '앱링크';
  if (type === 'AC') return '채널 추가';
  if (type === 'BK') return '봇 키워드';
  if (type === 'MD') return '메시지 전달';
  if (type === 'CT') return '전화';
  return type || '버튼';
}

function renderTemplatePreviewText(text, activeVariableKey = '') {
  const normalizedActiveKey = String(activeVariableKey ?? '').trim();

  return text.split(/(#\{[^}]+\})/g).map((part, index) => {
    if (!part) {
      return null;
    }

    if (!/^#\{[^}]+\}$/.test(part)) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    const variableKey = part.slice(2, -1).trim();
    const tokenClassName = [
      'template-card-kakao-token',
      normalizedActiveKey && variableKey === normalizedActiveKey ? 'is-highlighted' : '',
    ].filter(Boolean).join(' ');

    return (
      <span className={tokenClassName} key={`${part}-${index}`}>
        {part}
      </span>
    );
  });
}
