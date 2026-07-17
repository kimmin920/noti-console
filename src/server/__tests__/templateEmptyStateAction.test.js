import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EmailSendFormTemplateEmptyState } from '../../components/ui/EmailSendForm.jsx';

describe('template empty state action', () => {
  it('shows the template creation link when there are no templates', () => {
    const html = renderToStaticMarkup(createElement(EmailSendFormTemplateEmptyState, {
      emptyActionHref: '/templates/sms/new',
      emptyActionLabel: '새 템플릿 만들기',
      hasQuery: false,
    }));

    expect(html).toContain('href="/templates/sms/new"');
    expect(html).toContain('새 템플릿 만들기');
  });

  it('does not show the creation link for an empty search result', () => {
    const html = renderToStaticMarkup(createElement(EmailSendFormTemplateEmptyState, {
      emptyActionHref: '/templates/sms/new',
      emptyActionLabel: '새 템플릿 만들기',
      hasQuery: true,
    }));

    expect(html).not.toContain('새 템플릿 만들기');
  });
});
