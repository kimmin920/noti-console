export function SmsTemplateCardPreview({ className = '', template }) {
  const body = getSmsTemplateBody(template);

  return (
    <span className={['template-card-sms-preview-shell', className].filter(Boolean).join(' ')}>
      <span className="template-card-sms-phone" role="group" aria-label={`${template.name} SMS 미리보기`}>
        <span className="template-card-sms-thread">
          <span className="template-card-sms-message-row">
            <span className="template-card-sms-bubble">
              <span className="template-card-sms-text">
                {body ? renderSmsTemplatePreviewText(body) : '본문이 없습니다.'}
              </span>
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}

function getSmsTemplateBody(template) {
  return String(template.body ?? template.content ?? template.description ?? '').trim();
}

function renderSmsTemplatePreviewText(text) {
  return text.split(/(##[^#\s][^#]*##)/g).map((part, index) => {
    if (!part) {
      return null;
    }

    if (!/^##[^#\s][^#]*##$/.test(part)) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    return (
      <span className="template-card-sms-token" key={`${part}-${index}`}>
        {part}
      </span>
    );
  });
}
